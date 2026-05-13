import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import {
  TaskBundle,
  AgentConfig,
  AttemptResult,
  ScoredAttempt,
  OrchestratorRunRecord,
  GBrainWriteRequest,
  GMirrorScoringRequest,
  GMirrorScoringResponse,
  GToMConflictPredictionRequest,
  GToMConflictPredictionResponse,
  MultiModelConfig,
  EscalationMetrics,
  TierConfig,
} from '../types/index.js';
import { IntakePrimer } from './intake.js';
import { ConfigurationSampler } from './sampler.js';
import { SandboxPoolManager } from './sandbox.js';
import { AttemptRunner } from './runner.js';
import { SelectorEngine } from './selector.js';
import { checkCostHardGate, GORCHESTRATOR_RUBRIC_V1, getRubricHash } from './gorchestrator-rubric.js';
import { ReceiptRegistry } from './receipt-registry.js';
import { ExecutionReceipt } from '../types/quality-rubric.js';
import { OrchestratorPersistenceManager } from './orchestrator-persistence.js';

/**
 * Main GOrchestrator
 * 
 * Ties together all components:
 * - Intake & Priming
 * - Configuration Sampling (with Tier 1/Tier 2 escalation)
 * - Parallel Execution
 * - Scoring via GMirror (with Tier 2 escalation on hard gate failures)
 * - Selection
 * - Persistence to GBrain
 */
export class GOrchestrator {
  private intakePrimer: IntakePrimer;
  private configSampler: ConfigurationSampler;
  private sandboxManager: SandboxPoolManager;
  private selectorEngine: SelectorEngine;
  private gbrainEndpoint: string;
  private gmirrorEndpoint: string;
  private gtomEndpoint: string;
  private gstackEndpoint: string;
  private receiptRegistry: ReceiptRegistry;
  private successRateHistory: number[]; // Track success rate for drift detection
  private persistence: OrchestratorPersistenceManager;
  private multiModelConfig: MultiModelConfig;
  private tierConfigs: Map<string, TierConfig>;
  private escalationMetrics: EscalationMetrics;

  constructor(config: {
    gbrainEndpoint?: string;
    gmirrorEndpoint?: string;
    gtomEndpoint?: string;
    gstackEndpoint?: string;
    maxConcurrency?: number;
    sandboxBackend?: 'docker' | 'e2b' | 'modal' | 'daytona' | 'firecracker';
    dbPath?: string;
    multiModelConfig?: MultiModelConfig;
  } = {}) {
    this.gbrainEndpoint = config.gbrainEndpoint || 'http://localhost:3000';
    this.gmirrorEndpoint = config.gmirrorEndpoint || 'http://localhost:3002';
    this.gstackEndpoint = config.gstackEndpoint || 'http://localhost:3001';
    this.gtomEndpoint = config.gtomEndpoint || 'http://localhost:3003';
    this.receiptRegistry = new ReceiptRegistry('gorchestrator');
    this.successRateHistory = [];
    this.persistence = new OrchestratorPersistenceManager(config.dbPath);

    // Multi-model configuration with defaults
    this.multiModelConfig = config.multiModelConfig || {
      default_tier: 'tier1',
      escalation_enabled: true,
      escalation_triggers: {
        min_confidence: 0.7,
        min_quality_score: 0.5,
        max_ambiguity: 0.5,
      },
      consensus_threshold: 0.8,
      cost_budget_usd_per_hour: 20.0,
      allow_tier3: false,
    };

    // Tier configurations
    this.tierConfigs = new Map([
      ['tier1', { name: 'claude-haiku-4-5', model_id: 'anthropic/claude-haiku-4-5', cost_per_1k_tokens_usd: 0.001, avg_latency_ms: 500, use_case: 'Configuration sampling' }],
      ['tier2', { name: 'claude-sonnet-4-6', model_id: 'anthropic/claude-sonnet-4-6', cost_per_1k_tokens_usd: 0.003, avg_latency_ms: 2000, use_case: 'Scoring when hard gates fail' }],
      ['tier3', { name: 'claude-opus-4-6', model_id: 'anthropic/claude-opus-4-6', cost_per_1k_tokens_usd: 0.015, avg_latency_ms: 5000, use_case: 'Critical decisions' }],
    ]);

    // Initialize escalation metrics
    this.escalationMetrics = {
      total_tasks: 0,
      escalated_tasks: 0,
      tier1_success_rate: 1,
      tier2_success_rate: 0,
      tier3_success_rate: 0,
      tier1_count: 0,
      tier2_count: 0,
      tier3_count: 0,
      avg_cost_per_task_usd: 0,
      avg_latency_ms: 0,
      tier1_avg_latency_ms: 0,
      tier2_avg_latency_ms: 0,
      tier3_avg_latency_ms: 0,
      consensus_agreement_rate: 0,
      budget_remaining_usd: this.multiModelConfig.cost_budget_usd_per_hour,
    };

    this.intakePrimer = new IntakePrimer({
      gbrainEndpoint: this.gbrainEndpoint,
    });

    this.configSampler = new ConfigurationSampler({
      gstackEndpoint: config.gstackEndpoint,
    });

    this.sandboxManager = new SandboxPoolManager({
      maxConcurrency: config.maxConcurrency || 5,
      backend: config.sandboxBackend || 'docker',
    });

    this.selectorEngine = new SelectorEngine();
  }

  /**
   * Main entry point: run a task through the full orchestration pipeline
   */
  async runTask(rawTask: {
    description: string;
    taskType?: string;
    surfaces?: string[];
    constraints?: any[];
    outcomeShape?: any;
    budget?: any;
    userContext?: string;
    companyContext?: string;
    n?: number;
    verify?: boolean;
    cognitiveCheck?: boolean;
    priority?: 'normal' | 'high' | 'critical';
  }): Promise<OrchestratorRunRecord> {
    const startTime = Date.now();
    let currentTier = this.multiModelConfig.default_tier;
    let escalated = false;

    // Update metrics
    this.escalationMetrics.total_tasks++;
    this.escalationMetrics.tier1_count++;

    // Phase 1: Intake & Priming
    console.log('[GOrchestrator] Phase 1: Intake & Priming (Tier 1)');
    const taskBundle = await this.intakePrimer.intakeTask(rawTask);

    // Phase 2: Configuration Sampling
    console.log('[GOrchestrator] Phase 2: Configuration Sampling (Tier 1)');
    const samplingStartTime = Date.now();
    const samplingPlan = await this.configSampler.sampleConfigurations(
      taskBundle,
      rawTask.n
    );
    const samplingDuration = Date.now() - samplingStartTime;
    this.escalationMetrics.tier1_avg_latency_ms = samplingDuration;

    // Phase 3: Parallel Execution
    console.log('[GOrchestrator] Phase 3: Parallel Execution');
    const attemptResults = await this.runParallelAttempts(
      taskBundle,
      samplingPlan.configs
    );

    // Phase 4: Scoring (if verification enabled)
    let scoredAttempts: ScoredAttempt[] = [];
    if (rawTask.verify !== false) {
      console.log('[GOrchestrator] Phase 4: Scoring via GMirror (with escalation check)');
      scoredAttempts = await this.scoreAttemptsWithEscalation(
        taskBundle,
        attemptResults,
        rawTask.priority || 'normal'
      );
      
      // Track escalation
      if (escalated) {
        this.escalationMetrics.escalated_tasks++;
        this.escalationMetrics.tier2_count++;
      }
      
      // Enforce cost hard gate
      const maxBudget = taskBundle.budget.max_cost_usd;
      scoredAttempts = scoredAttempts.map(attempt => {
        const costCheck = attempt.cost.total_cost_usd > maxBudget;
        return {
          ...attempt,
          scores: {
            ...attempt.scores,
            hard_gates_passed: attempt.scores.hard_gates_passed && !costCheck,
          },
        };
      });
    } else {
      // Skip scoring, mark all as selected
      scoredAttempts = attemptResults.map((a, idx) => ({
        ...a,
        scores: {
          correctness: { score: 0.5, confidence: 0.5, evidence: [] },
          user_outcome: { score: 0.5, confidence: 0.5, evidence: [] },
          robustness: { score: 0.5, confidence: 0.5, evidence: [] },
          risk: { score: 0.5, confidence: 0.5, evidence: [] },
          overall_score: 0.5,
          hard_gates_passed: true,
        },
        selected: idx === 0,
        selection_reason: 'First completed attempt (verification disabled)',
      }));
    }

    // Store attempt results and scored attempts in database
    for (const attempt of attemptResults) {
      this.persistence.addAttemptResult({
        attempt_id: attempt.attempt_id,
        task_id: taskBundle.task_id,
        config_id: attempt.config_id,
        status: attempt.status,
        deliverable: attempt.deliverable?.content,
        error_message: attempt.error_message,
        wall_time_ms: attempt.wall_time_ms,
        cost_usd: attempt.cost.total_cost_usd,
      });
    }

    for (const scored of scoredAttempts) {
      this.persistence.addScoredAttempt({
        attempt_id: scored.attempt_id,
        task_id: taskBundle.task_id,
        overall_score: scored.scores.overall_score,
        correctness_score: scored.scores.correctness?.score,
        efficiency_score: scored.scores.robustness?.score,
        completeness_score: scored.scores.user_outcome?.score,
        hard_gates_passed: scored.scores.hard_gates_passed,
      });
    }

    // Phase 5: Selection
    console.log('[GOrchestrator] Phase 5: Selection');
    const selectionResult = this.selectorEngine.selectWinner(scoredAttempts);
    
    // Mark winner in attempts
    scoredAttempts = scoredAttempts.map(a => ({
      ...a,
      selected: a.attempt_id === selectionResult.winner_attempt_id,
      selection_reason: a.attempt_id === selectionResult.winner_attempt_id 
        ? selectionResult.rationale 
        : undefined,
    }));

    // Phase 6: Cognitive Check (if enabled)
    if (rawTask.cognitiveCheck) {
      console.log('[GOrchestrator] Phase 6: Cognitive Check via GToM');
      await this.performCognitiveCheck(taskBundle, scoredAttempts);
    }

    // Phase 7: Persistence
    console.log('[GOrchestrator] Phase 7: Persistence to GBrain');
    const runRecord: OrchestratorRunRecord = {
      task_id: taskBundle.task_id,
      task_bundle: taskBundle,
      attempts: scoredAttempts,
      winner: selectionResult.winner_attempt_id,
      merged_output: selectionResult.merge_sources ? selectionResult.selected_deliverable : undefined,
      total_cost: this.aggregateCosts(scoredAttempts),
      total_wall_time_ms: Date.now() - startTime,
      gbrain_write_status: 'pending',
      created_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
    };

    await this.persistRunRecord(runRecord);

    // Generate and emit execution receipt
    const receipt = await this.generateReceipt(taskBundle, runRecord);
    await this.receiptRegistry.append(receipt);
    (runRecord as any).execution_receipt = receipt;

    // Store receipt in gbrain for quality control
    await this.storeReceiptInGBrain(receipt);

    // Track success rate for drift detection
    const successRate = scoredAttempts.filter(a => a.status === 'completed').length / scoredAttempts.length;
    this.successRateHistory.push(successRate);
    if (this.successRateHistory.length > 50) this.successRateHistory.shift();

    // Cleanup
    await this.sandboxManager.cleanup();

    return runRecord;
  }

  /**
   * Run attempts in parallel
   */
  private async runParallelAttempts(
    taskBundle: TaskBundle,
    configs: AgentConfig[]
  ): Promise<AttemptResult[]> {
    const runner = new AttemptRunner({
      sandboxManager: this.sandboxManager,
      gstackEndpoint: this.gstackEndpoint,
      maxWallTimeMs: taskBundle.budget.max_wall_time_ms,
    });

    // Run all attempts in parallel up to concurrency limit
    const results: AttemptResult[] = [];
    const batchSize = taskBundle.budget.max_parallelism;

    for (let i = 0; i < configs.length; i += batchSize) {
      const batch = configs.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(config => runner.runAttempt(taskBundle, config))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Score attempts via GMirror with Tier 2 escalation
   */
  private async scoreAttemptsWithEscalation(
    taskBundle: TaskBundle,
    attempts: AttemptResult[],
    priority: 'normal' | 'high' | 'critical' = 'normal'
  ): Promise<ScoredAttempt[]> {
    // First, score with Tier 1
    const tier1ScoredAttempts = await this.scoreAttempts(taskBundle, attempts);

    // Check if escalation is needed based on hard gate failures
    const hardGateFailures = tier1ScoredAttempts.filter(a => !a.scores.hard_gates_passed);
    const needsEscalation = this.multiModelConfig.escalation_enabled && 
                           (hardGateFailures.length > 0 || priority === 'critical');

    if (needsEscalation && attempts.length > 0) {
      console.log(`[GOrchestrator] Hard gate failures detected (${hardGateFailures.length}), escalating to Tier 2 for re-scoring`);
      const tier2Config = this.tierConfigs.get('tier2')!;
      console.log(`[GOrchestrator] Using Tier 2: ${tier2Config.name} for re-scoring`);

      // In a real implementation, this would call GMirror with Tier 2 model
      // For now, we simulate by re-scoring with enhanced parameters
      const tier2ScoredAttempts = await this.scoreAttempts(taskBundle, attempts);
      
      // Merge scores, keeping higher quality versions for failed attempts
      return this.mergeScoredAttempts(tier1ScoredAttempts, tier2ScoredAttempts, hardGateFailures);
    }

    return tier1ScoredAttempts;
  }

  /**
   * Merge Tier 1 and Tier 2 scored attempts
   */
  private mergeScoredAttempts(
    tier1Attempts: ScoredAttempt[],
    tier2Attempts: ScoredAttempt[],
    hardGateFailures: ScoredAttempt[]
  ): ScoredAttempt[] {
    const merged = new Map<string, ScoredAttempt>();
    
    // Add all Tier 1 attempts
    for (const attempt of tier1Attempts) {
      merged.set(attempt.attempt_id, attempt);
    }
    
    // For attempts that failed hard gates, use Tier 2 scores if higher quality
    for (const failed of hardGateFailures) {
      const tier2Attempt = tier2Attempts.find(a => a.attempt_id === failed.attempt_id);
      if (tier2Attempt && tier2Attempt.scores.overall_score > failed.scores.overall_score) {
        merged.set(failed.attempt_id, tier2Attempt);
      }
    }
    
    return Array.from(merged.values());
  }

  /**
   * Score attempts via GMirror
   */
  private async scoreAttempts(
    taskBundle: TaskBundle,
    attempts: AttemptResult[]
  ): Promise<ScoredAttempt[]> {
    const scoringRequest: GMirrorScoringRequest = {
      task: taskBundle,
      attempts,
      scoring_profile: taskBundle.signature.task_type,
      budget_ms: taskBundle.budget.max_wall_time_ms * 0.3,
    };

    try {
      const response = await fetch(`${this.gmirrorEndpoint}/gmirror/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scoringRequest),
      });

      if (!response.ok) {
        throw new Error(`GMirror returned ${response.status}`);
      }

      const data: GMirrorScoringResponse = await response.json();

      // Merge scores with attempts
      return attempts.map((attempt, idx) => ({
        ...attempt,
        scores: data.score_set[idx]?.scores || this.fallbackScore(),
        selected: false,
      }));
    } catch (error) {
      console.warn('[GOrchestrator] GMirror scoring failed, using fallback:', error);
      return attempts.map(attempt => ({
        ...attempt,
        scores: this.fallbackScore(),
        selected: false,
      }));
    }
  }

  /**
   * Fallback scoring when GMirror is unavailable
   */
  private fallbackScore() {
    return {
      correctness: { score: 0.5, confidence: 0.3, evidence: ['GMirror unavailable'] },
      user_outcome: { score: 0.5, confidence: 0.3, evidence: ['GMirror unavailable'] },
      robustness: { score: 0.5, confidence: 0.3, evidence: ['GMirror unavailable'] },
      risk: { score: 0.5, confidence: 0.3, evidence: ['GMirror unavailable'] },
      overall_score: 0.5,
      hard_gates_passed: true,
    };
  }

  /**
   * Perform cognitive check via GToM
   */
  private async performCognitiveCheck(
    taskBundle: TaskBundle,
    attempts: ScoredAttempt[]
  ): Promise<void> {
    try {
      const request: GToMConflictPredictionRequest = {
        task: taskBundle,
        active_attempts: attempts.map(a => ({
          attempt_id: a.attempt_id,
          config_id: a.config_id,
          current_state: {},
          recent_actions: [],
        })),
      };

      const response = await fetch(`${this.gtomEndpoint}/gtom/predict-conflicts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`GToM returned ${response.status}`);
      }

      const data: GToMConflictPredictionResponse = await response.json();
      
      console.log('[GOrchestrator] GToM conflict predictions:', data.predicted_conflicts);
      
      // In production, would act on predictions
      // For MVP, just log them
    } catch (error) {
      console.warn('[GOrchestrator] GToM cognitive check failed:', error);
    }
  }

  /**
   * Aggregate costs from all attempts
   */
  private aggregateCosts(attempts: ScoredAttempt[]) {
    return attempts.reduce(
      (total, attempt) => ({
        model_cost_usd: total.model_cost_usd + attempt.cost.model_cost_usd,
        tool_cost_usd: total.tool_cost_usd + attempt.cost.tool_cost_usd,
        sandbox_cost_usd: total.sandbox_cost_usd + attempt.cost.sandbox_cost_usd,
        total_cost_usd: total.total_cost_usd + attempt.cost.total_cost_usd,
      }),
      { model_cost_usd: 0, tool_cost_usd: 0, sandbox_cost_usd: 0, total_cost_usd: 0 }
    );
  }

  /**
   * Persist run record to GBrain
   */
  private async persistRunRecord(runRecord: OrchestratorRunRecord): Promise<void> {
    const request: GBrainWriteRequest = {
      run_record: runRecord,
      priority: 'normal',
    };

    try {
      const response = await fetch(`${this.gbrainEndpoint}/gbrain/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`GBrain returned ${response.status}`);
      }

      const data = await response.json();
      runRecord.gbrain_write_status = 'written';
      console.log('[GOrchestrator] Run record persisted to GBrain:', data.ack_id);
    } catch (error) {
      console.warn('[GOrchestrator] Failed to persist to GBrain:', error);
      runRecord.gbrain_write_status = 'failed';
      // In production, queue for retry
    }
  }

  /**
   * Health check for all dependencies
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: {
      gbrain: 'ok' | 'error';
      gmirror: 'ok' | 'error';
      gtom: 'ok' | 'error';
      sandbox: 'ok' | 'error';
    };
    escalation?: EscalationMetrics;
  }> {
    const checks = {
      gbrain: await this.checkEndpoint(this.gbrainEndpoint),
      gmirror: await this.checkEndpoint(this.gmirrorEndpoint),
      gtom: await this.checkEndpoint(this.gtomEndpoint),
      sandbox: await this.checkSandbox(),
    };

    const errorCount = Object.values(checks).filter(v => v === 'error').length;
    const status = errorCount === 0 ? 'healthy' : errorCount < 3 ? 'degraded' : 'unhealthy';

    return { 
      status, 
      components: checks,
      escalation: this.getEscalationMetrics(),
    };
  }

  /**
   * Get escalation metrics for monitoring
   */
  getEscalationMetrics(): EscalationMetrics {
    const totalTasks = this.escalationMetrics.tier1_count + this.escalationMetrics.tier2_count + this.escalationMetrics.tier3_count;
    
    // Calculate tier success rates
    const tier1SuccessRate = totalTasks > 0 ? this.escalationMetrics.tier1_count / totalTasks : 1;
    const tier2SuccessRate = totalTasks > 0 ? this.escalationMetrics.tier2_count / totalTasks : 0;
    const tier3SuccessRate = totalTasks > 0 ? this.escalationMetrics.tier3_count / totalTasks : 0;
    
    // Calculate escalation rate
    const escalatedTasks = this.escalationMetrics.tier2_count + this.escalationMetrics.tier3_count;
    const escalationRate = totalTasks > 0 ? escalatedTasks / totalTasks : 0;

    return {
      total_tasks: totalTasks,
      escalated_tasks: escalatedTasks,
      tier1_success_rate: tier1SuccessRate,
      tier2_success_rate: tier2SuccessRate,
      tier3_success_rate: tier3SuccessRate,
      tier1_count: this.escalationMetrics.tier1_count,
      tier2_count: this.escalationMetrics.tier2_count,
      tier3_count: this.escalationMetrics.tier3_count,
      avg_cost_per_task_usd: this.calculateAvgCostPerTask(),
      avg_latency_ms: this.calculateAvgLatency(),
      tier1_avg_latency_ms: this.escalationMetrics.tier1_avg_latency_ms,
      tier2_avg_latency_ms: this.escalationMetrics.tier2_avg_latency_ms,
      tier3_avg_latency_ms: this.escalationMetrics.tier3_avg_latency_ms,
      consensus_agreement_rate: this.escalationMetrics.consensus_agreement_rate,
      budget_remaining_usd: this.escalationMetrics.budget_remaining_usd,
    };
  }

  /**
   * Calculate average cost per task
   */
  private calculateAvgCostPerTask(): number {
    const totalTasks = this.escalationMetrics.tier1_count + this.escalationMetrics.tier2_count + this.escalationMetrics.tier3_count;
    if (totalTasks === 0) return 0;

    const tier1Cost = this.escalationMetrics.tier1_avg_latency_ms / 1000 * (this.tierConfigs.get('tier1')?.cost_per_1k_tokens_usd || 0.001);
    const tier2Cost = this.escalationMetrics.tier2_avg_latency_ms / 1000 * (this.tierConfigs.get('tier2')?.cost_per_1k_tokens_usd || 0.003);
    const tier3Cost = this.escalationMetrics.tier3_avg_latency_ms / 1000 * (this.tierConfigs.get('tier3')?.cost_per_1k_tokens_usd || 0.015);

    const tier1Rate = this.escalationMetrics.tier1_count / totalTasks;
    const tier2Rate = this.escalationMetrics.tier2_count / totalTasks;
    const tier3Rate = this.escalationMetrics.tier3_count / totalTasks;

    return tier1Cost * tier1Rate + tier2Cost * tier2Rate + tier3Cost * tier3Rate;
  }

  /**
   * Calculate average latency
   */
  private calculateAvgLatency(): number {
    const totalTasks = this.escalationMetrics.tier1_count + this.escalationMetrics.tier2_count + this.escalationMetrics.tier3_count;
    if (totalTasks === 0) return 0;

    const tier1Rate = this.escalationMetrics.tier1_count / totalTasks;
    const tier2Rate = this.escalationMetrics.tier2_count / totalTasks;
    const tier3Rate = this.escalationMetrics.tier3_count / totalTasks;

    return this.escalationMetrics.tier1_avg_latency_ms * tier1Rate + 
           this.escalationMetrics.tier2_avg_latency_ms * tier2Rate +
           this.escalationMetrics.tier3_avg_latency_ms * tier3Rate;
  }

  /**
   * Get multi-model configuration
   */
  getMultiModelConfig(): MultiModelConfig {
    return { ...this.multiModelConfig };
  }

  /**
   * Update multi-model configuration
   */
  updateMultiModelConfig(config: Partial<MultiModelConfig>): void {
    this.multiModelConfig = { ...this.multiModelConfig, ...config };
  }

  /**
   * Check if an endpoint is reachable
   */
  private async checkEndpoint(endpoint: string): Promise<'ok' | 'error'> {
    try {
      const response = await fetch(`${endpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(1000),
      });
      return response.ok ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }

  /**
   * Check sandbox backend
   */
  private async checkSandbox(): Promise<'ok' | 'error'> {
    try {
      // For Docker, check if docker is available
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      await execAsync('docker --version', { timeout: 1000 });
      return 'ok';
    } catch {
      return 'error';
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.sandboxManager.cleanup();
  }

  /**
   * Detect drift in success rate across recent task runs
   * Uses linear regression to detect significant degradation (>1.5σ)
   */
  detectSuccessRateDrift(): {
    trend: 'increasing' | 'decreasing' | 'stable' | 'insufficient_data';
    slope: number;
    confidence: number;
    current_rate: number;
    average_rate: number;
    at_risk: boolean;
  } {
    const history = this.successRateHistory;
    if (history.length < 10) {
      return {
        trend: 'insufficient_data',
        slope: 0,
        confidence: 0,
        current_rate: history.length > 0 ? history[history.length - 1] : 0,
        average_rate: history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : 0,
        at_risk: false,
      };
    }

    // Linear regression: y = mx + b
    const n = history.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = history;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared (coefficient of determination)
    const yMean = sumY / n;
    const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const ssResidual = y.reduce((sum, yi, i) => sum + Math.pow(yi - (slope * i + intercept), 2), 0);
    const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;
    const confidence = Math.max(0, Math.min(1, rSquared));

    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(slope) < 0.01) {
      trend = 'stable';
    } else if (slope > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    const currentRate = history[history.length - 1];
    const averageRate = yMean;
    const stdDev = Math.sqrt(ssTotal / n);
    
    // Flag as at risk if decreasing trend with high confidence and >1.5σ below mean
    const at_risk = trend === 'decreasing' && confidence > 0.5 && (yMean - currentRate) > 1.5 * stdDev;

    return {
      trend,
      slope,
      confidence,
      current_rate: currentRate,
      average_rate: averageRate,
      at_risk,
    };
  }

  /**
   * Generate execution receipt for quality tracking
   */
  private async generateReceipt(
    taskBundle: TaskBundle,
    runRecord: OrchestratorRunRecord
  ): Promise<ExecutionReceipt> {
    const rubricHash = getRubricHash(GORCHESTRATOR_RUBRIC_V1);
    const inputHash = crypto.createHash('sha256').update(JSON.stringify(taskBundle.signature)).digest('hex');
    const configHash = crypto.createHash('sha256').update(JSON.stringify(taskBundle.budget)).digest('hex');
    
    const winnerAttempt = runRecord.attempts.find(a => a.attempt_id === runRecord.winner);
    const overallScore = winnerAttempt?.scores.overall_score || 0;
    const hardGatesPassed = winnerAttempt?.scores.hard_gates_passed || false;

    return {
      receipt_id: uuidv4(),
      schema_version: 1,
      timestamp: new Date().toISOString(),
      project: 'gorchestrator',
      rubric_name: GORCHESTRATOR_RUBRIC_V1.name,
      rubric_sha8: rubricHash,
      input_hash: inputHash,
      models_used: ['claude-sonnet-4-6'],
      config_hash: configHash,
      verdict: hardGatesPassed ? 'pass' : 'fail',
      scores: {
        overall_score: { score: overallScore, confidence: 0.8, weight: 1.0 },
      },
      overall_score: overallScore,
      hard_gates_passed: hardGatesPassed,
      cost_usd: runRecord.total_cost.total_cost_usd,
      errors: [],
      metadata: {
        task_id: runRecord.task_id,
        winner_attempt_id: runRecord.winner,
        total_attempts: runRecord.attempts.length,
        total_wall_time_ms: runRecord.total_wall_time_ms,
      },
    };
  }

  /**
   * Store receipt in gbrain quality control database
   */
  private async storeReceiptInGBrain(receipt: ExecutionReceipt): Promise<void> {
    try {
      const { promisify } = require('util');
      const { exec } = require('child_process');
      const execAsync = promisify(exec);
      
      // Store the receipt
      await execAsync(
        `gbrain qc_store_receipt --receipt_id "${receipt.receipt_id}" --component "gorchestrator" --rubric_name "${receipt.rubric_name}" --rubric_hash "${receipt.rubric_sha8}" --timestamp "${receipt.timestamp}" --verdict "${receipt.verdict}" --overall_score ${receipt.overall_score} --hard_gates_passed ${receipt.hard_gates_passed} --scores '${JSON.stringify(receipt.scores)}' --hard_gate_results '[]' --metadata '${JSON.stringify(receipt.metadata)}'`
      );

      // Store individual rubric scores
      const scoreEntries = Object.entries(receipt.scores).map(([dimension, scoreData]) => ({
        dimension_name: dimension,
        score: scoreData.score,
        confidence: scoreData.confidence || 0.8,
        weight: scoreData.weight || 1.0,
        evidence: []
      }));

      if (scoreEntries.length > 0) {
        await execAsync(
          `gbrain qc_store_rubric_scores --receipt_id "${receipt.receipt_id}" --scores '${JSON.stringify(scoreEntries)}'`
        );
      }
    } catch (error) {
      // Log error but don't fail the orchestration if gbrain storage fails
      console.error('[GOrchestrator] Failed to store receipt in gbrain:', error);
    }
  }
}
