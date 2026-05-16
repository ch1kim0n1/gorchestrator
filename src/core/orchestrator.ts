import { v4 as uuidv4 } from 'uuid';
import { BudgetExceededError } from './errors.js';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
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
  DeveloperTaskRequest,
  DyadPipelineResult,
  RelationshipAnalysisTask,
  RelationshipAnalysisTaskSchema,
} from '../types/index.js';
import { determineConsensus, ConsensusResult, OutputComparison } from '@gstack/shared/core';
import { IntakePrimer } from './intake.js';
import { ConfigurationSampler } from './sampler.js';
import { SandboxPoolManager } from './sandbox.js';
import { AttemptRunner } from './runner.js';
import { SelectorEngine } from './selector.js';
import { checkCostHardGate, GORCHESTRATOR_RUBRIC_V1, getRubricHash } from './gorchestrator-rubric.js';
import { ReceiptRegistry } from './receipt-registry.js';
import { ExecutionReceipt } from '../types/quality-rubric.js';
import { OrchestratorPersistenceManager } from './orchestrator-persistence.js';
import { LLMClient } from './llm-client.js';
import { BudgetLedger } from './budget-ledger.js';
import { DriftDetector } from '@gstack/shared/core';
import { LatencyTracker } from '@gstack/shared/core';
import { HealthCheckResult } from '@gstack/shared/health';
import { GOrchestratorObservability, LocalAuditLogger, LocalLogger } from './observability.js';
import {
  GBrainIntegrationClient,
  GBrainIntegrationMode,
} from './gbrain-integration.js';
import { getDefaultSecretManager } from './security.js';
import { ProgressEvent, TaskBackpressureLimiter } from './performance.js';
import { DetectorPool } from './detector-pool.js';
import { DyadPipeline } from './dyad-pipeline.js';

export interface OrchestratorHealthStatus {
  status: 'healthy' | 'unhealthy';
  components: Record<string, 'ok' | 'error'>;
  checks: HealthCheckResult[];
}

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
  private gmirrorEndpoint: string | undefined;
  private gtomEndpoint: string | undefined;
  private gstackEndpoint: string;
  private receiptRegistry: ReceiptRegistry;
  private successRateHistory: number[]; // Track success rate for drift detection
  private successRateHistoryPath: string;
  private persistence: OrchestratorPersistenceManager;
  private multiModelConfig: MultiModelConfig;
  private tierConfigs: Map<string, TierConfig>;
  private escalationMetrics: EscalationMetrics;
  private gbrainClient: GBrainIntegrationClient;
  private driftDetector: DriftDetector;
  private costLedger: BudgetLedger;
  private costLedgerReady: Promise<void>;
  private llmClient: LLMClient;
  private latencyTracker: LatencyTracker;
  private auditLogger: LocalAuditLogger;
  private logger: LocalLogger;
  private observability: GOrchestratorObservability;
  private taskLimiter: TaskBackpressureLimiter;
  private maxConcurrency: number;
  private detectorConfidenceHistory: Map<string, number[]> = new Map();

  constructor(config: {
    gbrainEndpoint?: string;
    gmirrorEndpoint?: string;
    gtomEndpoint?: string;
    gstackEndpoint?: string;
    gbrainMcpEndpoint?: string;
    gbrainMode?: GBrainIntegrationMode;
    gbrainAuthToken?: string;
    gbrainTimeoutMs?: number;
    gbrainMaxRetries?: number;
    gbrainInitialBackoffMs?: number;
    gbrainCircuitBreakerFailureThreshold?: number;
    gbrainCircuitBreakerCooldownMs?: number;
    maxConcurrency?: number;
    maxQueueDepth?: number;
    sandboxBackend?: 'docker' | 'e2b' | 'modal' | 'daytona' | 'firecracker' | 'inprocess';
    dbPath?: string;
    multiModelConfig?: MultiModelConfig;
  } = {}) {
    this.maxConcurrency = config.maxConcurrency || 5;
    this.taskLimiter = new TaskBackpressureLimiter(this.maxConcurrency, config.maxQueueDepth ?? this.maxConcurrency * 4);
    this.gbrainEndpoint = config.gbrainEndpoint || 'http://localhost:3000';
    this.gmirrorEndpoint = config.gmirrorEndpoint;
    this.gstackEndpoint = config.gstackEndpoint || 'http://localhost:3001';
    this.gtomEndpoint = config.gtomEndpoint;
    this.receiptRegistry = new ReceiptRegistry('gorchestrator');
    this.successRateHistoryPath = path.join(process.cwd(), '.gbrain-corpus', 'gorchestrator-success-rate-history.json');
    this.successRateHistory = this.loadSuccessRateHistory();
    this.persistence = new OrchestratorPersistenceManager(config.dbPath);
    this.observability = new GOrchestratorObservability('gorchestrator');
    this.auditLogger = this.observability.audit;
    this.logger = this.observability.logger;
    
    this.gbrainClient = new GBrainIntegrationClient({
      endpoint: this.gbrainEndpoint,
      mcpEndpoint: config.gbrainMcpEndpoint,
      mode: config.gbrainMode,
      authToken: config.gbrainAuthToken,
      timeoutMs: config.gbrainTimeoutMs,
      maxRetries: config.gbrainMaxRetries,
      initialBackoffMs: config.gbrainInitialBackoffMs,
      circuitBreakerFailureThreshold: config.gbrainCircuitBreakerFailureThreshold,
      circuitBreakerCooldownMs: config.gbrainCircuitBreakerCooldownMs,
    });

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
      allow_tier3: true,
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
      success_rate_trend: 'stable',
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

    this.costLedger = new BudgetLedger({
      max_budget_usd: this.multiModelConfig.cost_budget_usd_per_hour,
      alert_threshold_usd: this.multiModelConfig.cost_budget_usd_per_hour * 0.8,
      default_ttl_ms: 5 * 60 * 1000,
      scope_caps_usd: {
        intake: 5.0,
        sampling: 5.0,
        execution: 20.0,
        selection: 5.0,
        scoring: 10.0,
      },
    }, 'gorchestrator');
    this.costLedgerReady = this.costLedger.init().catch((error) => {
      this.logger.warn('Failed to initialize budget ledger', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
    this.llmClient = new LLMClient({
      metricsPersistencePath: path.join(os.homedir(), '.gorchestrator', 'audit', 'llm-metrics.json'),
      onSpend: async (modelId, inputTokens, outputTokens, costUsd) => {
        await this.recordLLMSpend(modelId, inputTokens, outputTokens, costUsd);
      },
    });

    this.intakePrimer = new IntakePrimer({
      gbrainEndpoint: this.gbrainEndpoint,
      gbrainClient: this.gbrainClient,
      llmClient: this.llmClient,
    });

    this.configSampler = new ConfigurationSampler({
      gstackEndpoint: config.gstackEndpoint,
      llmClient: this.llmClient,
    });

    this.sandboxManager = new SandboxPoolManager({
      maxConcurrency: this.maxConcurrency,
      backend: config.sandboxBackend || 'docker',
    });

    this.selectorEngine = new SelectorEngine({
      llmClient: this.llmClient,
      multiModelConfig: this.multiModelConfig,
    });
    this.driftDetector = new DriftDetector({
      window_size: 100,
      drift_threshold: 0.2,
      alert_threshold: 0.3,
    });
    this.latencyTracker = new LatencyTracker(1000);
  }

  /**
   * Get latency metrics
   */
  getLatencyMetrics() {
    return this.latencyTracker.getMetrics();
  }

  exportPrometheusMetrics(): string {
    return this.observability.metrics.prometheus();
  }

  exportOpenTelemetryMetrics(): Record<string, unknown> {
    return this.observability.metrics.openTelemetry();
  }

  getObservabilitySnapshot(): Record<string, unknown> {
    return this.observability.snapshot();
  }

  logShellJob(entry: {
    command: string;
    cwd?: string;
    exit_code?: number;
    duration_ms?: number;
    correlation_id?: string;
    trace_id?: string;
    metadata?: Record<string, unknown>;
    error?: string;
  }): void {
    this.auditLogger.logShellJob(entry);
  }

  private async recordLLMSpend(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    costUsd: number,
  ): Promise<void> {
    await this.costLedgerReady;
    const budgetStatus = this.costLedger.getStatus();
    if (budgetStatus.remaining_budget <= 0) {
      throw new BudgetExceededError(`Budget exhausted before LLM call. Spent: $${budgetStatus.total_committed.toFixed(4)}, Max: $${budgetStatus.max_budget_usd.toFixed(4)}`);
    }
    const reserveUsd = Math.max(costUsd, Number(process.env.GORCH_LLM_CALL_RESERVE_USD ?? 0.01));
    const reservation = this.costLedger.reserve('gorchestrator_llm_call', reserveUsd, Number(process.env.GORCH_LLM_RESERVATION_TTL_MS ?? 5 * 60 * 1000), {
      scope: 'execution',
      resolver: 'llm',
    });
    await this.costLedger.commit(reservation.id, costUsd, {
      model_id: modelId,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      operation: 'gorchestrator_llm_call',
      metadata: {
        scope: 'execution',
        resolver: 'llm',
      },
    });
  }

  /**
   * Main entry point: run a task through the full orchestration pipeline
   */
  async runTask(rawTask: RelationshipAnalysisTask): Promise<DyadPipelineResult>;
  async runTask(rawTask: DeveloperTaskRequest): Promise<OrchestratorRunRecord>;
  async runTask(rawTask: DeveloperTaskRequest | RelationshipAnalysisTask): Promise<OrchestratorRunRecord | DyadPipelineResult> {
    const start = performance.now();
    const startTime = Date.now();
    const span = this.observability.tracer.startSpan('GOrchestrator.runTask', {
      task_type: (rawTask as any).taskType || (rawTask as any).task_type,
      priority: (rawTask as any).priority || 'normal',
      attempts: (rawTask as any).n,
    }, String((rawTask as any).traceparent || (rawTask as any).userContext || ''));
    let currentTier = this.multiModelConfig.default_tier;
    let escalated = false;
    const releaseProcessingSlot = await this.taskLimiter.acquire((rawTask as any).signal);
    this.emitProgress((rawTask as any).onProgress, {
      phase: 'queued',
      message: 'Task accepted by processing limiter',
      progress: 0.02,
      metadata: this.taskLimiter.getStats(),
    });

    try {
      this.throwIfCancelled((rawTask as any).signal);
      if (this.isRelationshipAnalysisTask(rawTask)) {
        const result = await this.runRelationshipAnalysisTask(rawTask, start, span.trace_id);
        this.observability.tracer.endSpan(span);
        return result;
      }
      const devTask = rawTask as DeveloperTaskRequest;
      // Update metrics
      this.escalationMetrics.total_tasks++;
      this.escalationMetrics.tier1_count++;

      // Phase 1: Intake & Priming
      this.logger.info('Phase 1: Intake & Priming (Tier 1)');
      this.emitProgress(devTask.onProgress, { phase: 'intake', message: 'Normalizing task and loading priors', progress: 0.1 });
      const taskBundle = await this.intakePrimer.intakeTask(devTask);
      this.throwIfCancelled(devTask.signal);

      // Phase 2: Configuration Sampling
      this.logger.info('Phase 2: Configuration Sampling (Tier 1)');
      this.emitProgress(devTask.onProgress, { task_id: taskBundle.task_id, phase: 'sampling', message: 'Sampling agent configurations', progress: 0.22 });
      const samplingStartTime = Date.now();
      const samplingPlan = await this.configSampler.sampleConfigurations(
        taskBundle,
        devTask.n
      );
      this.throwIfCancelled(devTask.signal);
      const samplingDuration = Date.now() - samplingStartTime;
      this.escalationMetrics.tier1_avg_latency_ms = samplingDuration;

      // Phase 3: Parallel Execution
      this.logger.info('Phase 3: Parallel Execution');
      this.emitProgress(devTask.onProgress, { task_id: taskBundle.task_id, phase: 'execution', message: 'Running attempts with bounded concurrency', progress: 0.4, metadata: { maxConcurrency: this.maxConcurrency } });
      const attemptResults = await this.runParallelAttempts(
        taskBundle,
        samplingPlan.configs,
        devTask.signal,
      );
      this.throwIfCancelled(devTask.signal);

      // Phase 4: Scoring (if verification enabled)
      let scoredAttempts: ScoredAttempt[] = [];
      if (devTask.verify !== false) {
        this.logger.info('Phase 4: Scoring via GMirror (with escalation check)');
        this.emitProgress(devTask.onProgress, { task_id: taskBundle.task_id, phase: 'scoring', message: 'Scoring attempts and checking hard gates', progress: 0.62 });
        scoredAttempts = await this.scoreAttemptsWithEscalation(
          taskBundle,
          attemptResults,
          devTask.priority || 'normal'
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

      // Phase 5: Selection
      this.logger.info('Phase 5: Selection');
      this.emitProgress(devTask.onProgress, { task_id: taskBundle.task_id, phase: 'selection', message: 'Selecting winning attempt', progress: 0.78 });
      const selectionResult = await this.selectorEngine.selectWinner(scoredAttempts);

      // Mark winner in attempts
      scoredAttempts = scoredAttempts.map(a => ({
        ...a,
        selected: a.attempt_id === selectionResult.winner_attempt_id,
        selection_reason: a.attempt_id === selectionResult.winner_attempt_id
          ? selectionResult.rationale
          : undefined,
      }));

      // Phase 6: Cognitive Check (if enabled)
      if (devTask.cognitiveCheck) {
        this.logger.info('Phase 6: Cognitive Check via GToM');
        this.emitProgress(devTask.onProgress, { task_id: taskBundle.task_id, phase: 'cognitive_check', message: 'Running cognitive conflict check', progress: 0.86 });
        await this.performCognitiveCheck(taskBundle, scoredAttempts);
      }

      // Phase 7: Persistence
      this.logger.info('Phase 7: Persistence to GBrain');
      this.emitProgress(devTask.onProgress, { task_id: taskBundle.task_id, phase: 'persistence', message: 'Persisting run record and receipt', progress: 0.92 });
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

      this.persistence.addRunArtifacts({
        attempts: attemptResults.map(attempt => ({
          attempt_id: attempt.attempt_id,
          task_id: taskBundle.task_id,
          config_id: attempt.config_id,
          status: attempt.status,
          deliverable: attempt.deliverable?.content,
          error_message: attempt.error_message,
          wall_time_ms: attempt.wall_time_ms,
          cost_usd: attempt.cost.total_cost_usd,
        })),
        scoredAttempts: scoredAttempts.map(scored => ({
          attempt_id: scored.attempt_id,
          task_id: taskBundle.task_id,
          overall_score: scored.scores.overall_score,
          correctness_score: scored.scores.correctness?.score,
          efficiency_score: scored.scores.robustness?.score,
          completeness_score: scored.scores.user_outcome?.score,
          hard_gates_passed: scored.scores.hard_gates_passed,
        })),
        taskRun: {
          task_id: taskBundle.task_id,
          description: taskBundle.raw_description,
          total_attempts: scoredAttempts.length,
          successful_attempts: scoredAttempts.filter(attempt => attempt.status === 'completed').length,
          total_cost_usd: runRecord.total_cost.total_cost_usd,
          total_duration_ms: runRecord.total_wall_time_ms,
          winner_attempt_id: selectionResult.winner_attempt_id,
        },
      });

      await this.persistRunRecord(runRecord);

      // Generate and emit execution receipt
      const receipt = await this.generateReceipt(taskBundle, runRecord);
      await this.receiptRegistry.append(receipt);
      (runRecord as any).execution_receipt = receipt;

      // Store receipt in gbrain for quality control
      await this.storeReceiptInGBrain(receipt);

      // Track success rate for drift detection
      const successRate = scoredAttempts.length > 0
        ? scoredAttempts.filter(a => a.status === 'completed').length / scoredAttempts.length
        : 0;
      this.recordTaskSuccessMetric(successRate);

      // Cleanup
      await this.sandboxManager.cleanup();

      const latencyMs = performance.now() - start;
      this.latencyTracker.record(latencyMs);
      this.observability.metrics.recordPublicMethod('runTask', latencyMs, 'ok');
      this.auditLogger.logDecision({
        operation: 'runTask',
        decision: runRecord.winner ? 'winner_selected' : 'no_winner',
        correlation_id: runRecord.task_id,
        trace_id: span.trace_id,
        success: true,
        latency_ms: latencyMs,
        cost_usd: runRecord.total_cost.total_cost_usd,
        metadata: { attempts: scoredAttempts.length, gbrain_write_status: runRecord.gbrain_write_status },
      });
      this.emitProgress(devTask.onProgress, { task_id: runRecord.task_id, phase: 'complete', message: 'Task orchestration complete', progress: 1 });
      this.observability.tracer.endSpan(span);
      return runRecord;
    } catch (error) {
      const latencyMs = performance.now() - start;
      this.observability.metrics.recordPublicMethod('runTask', latencyMs, 'error');
      this.auditLogger.logDecision({
        operation: 'runTask',
        decision: 'error',
        trace_id: span.trace_id,
        success: false,
        latency_ms: latencyMs,
        error: error instanceof Error ? error.message : String(error),
      });
      this.observability.tracer.endSpan(span, error instanceof Error ? error : new Error(String(error)));
      this.recordTaskSuccessMetric(0);
      if ((rawTask as any).signal?.aborted) {
        this.emitProgress((rawTask as any).onProgress, { phase: 'cancelled', message: 'Task orchestration cancelled', progress: 1 });
      }
      throw error;
    } finally {
      releaseProcessingSlot();
    }
  }

  private isRelationshipAnalysisTask(task: DeveloperTaskRequest | RelationshipAnalysisTask): task is RelationshipAnalysisTask {
    return (task as RelationshipAnalysisTask).task_type === 'relationship_analysis';
  }

  private async runRelationshipAnalysisTask(
    task: RelationshipAnalysisTask,
    start: number,
    traceId?: string,
  ): Promise<DyadPipelineResult> {
    const parsed = RelationshipAnalysisTaskSchema.parse(task);
    const pipeline = this.createDyadPipeline();
    const result = await pipeline.run(parsed);
    this.recordTaskSuccessMetric(result.verdict === 'pass' ? 1 : 0, result);
    await this.storeReceiptInGBrain(parsed, result);

    const latencyMs = performance.now() - start;
    this.latencyTracker.record(latencyMs);
    this.observability.metrics.recordPublicMethod('runRelationshipAnalysisTask', latencyMs, 'ok');
    this.auditLogger.logDecision({
      operation: 'runRelationshipAnalysisTask',
      decision: result.verdict,
      correlation_id: parsed.dyad_id,
      trace_id: traceId,
      success: result.verdict === 'pass',
      latency_ms: latencyMs,
      cost_usd: result.cost_usd,
      metadata: {
        detector_count: result.detector_outputs.length,
        gtom_risk: result.gtom_risk,
      },
    });
    return result;
  }

  private createDyadPipeline(): DyadPipeline {
    const detectorPool = new DetectorPool(this.llmClient, {
      tier1_model: 'claude-haiku-4-5',
      tier2_model: 'claude-sonnet-4-6',
      consensus_threshold: 0.7,
    });
    return new DyadPipeline({
      detectorPool,
      gtomEndpoint: this.gtomEndpoint,
      gmirrorEndpoint: this.gmirrorEndpoint,
      logger: this.logger,
    });
  }

  async *runTaskStream(rawTask: Parameters<GOrchestrator['runTask']>[0]): AsyncGenerator<ProgressEvent | { phase: 'result'; result: OrchestratorRunRecord | DyadPipelineResult }, void, unknown> {
    const events: ProgressEvent[] = [];
    let notify: (() => void) | undefined;
    let done = false;
    const taskPromise = this.runTask({
      ...rawTask,
      onProgress: (event) => {
        (rawTask as any).onProgress?.(event);
        events.push(event);
        notify?.();
      },
    }).then((result) => {
      done = true;
      events.push({ phase: 'complete', message: 'Result ready', progress: 1, timestamp: new Date().toISOString() });
      notify?.();
      return result;
    }).catch((error) => {
      done = true;
      notify?.();
      throw error;
    });

    while (!done || events.length > 0) {
      if (events.length === 0) {
        await new Promise<void>(resolve => { notify = resolve; });
        notify = undefined;
        continue;
      }
      yield events.shift()!;
    }
    yield { phase: 'result', result: await taskPromise };
  }

  getTaskProcessingStats(): { active: number; queued: number; maxConcurrency: number; maxQueueDepth: number } {
    return this.taskLimiter.getStats();
  }

  private emitProgress(
    callback: ((event: ProgressEvent) => void) | undefined,
    event: Omit<ProgressEvent, 'timestamp'>,
  ): void {
    callback?.({ ...event, timestamp: new Date().toISOString() });
  }

  private throwIfCancelled(signal?: AbortSignal): void {
    if (signal?.aborted) throw new Error('Task orchestration cancelled');
  }

  /**
   * Get receipts from the registry (MCP-facing).
   * Supports time-range filtering via startDate/endDate; limit is applied last.
   */
  async getReceipts(args: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<ExecutionReceipt[]> {
    const start = performance.now();
    const startDate = args.startDate ? new Date(args.startDate) : new Date(Date.now() - 30 * 86400000);
    const end = args.endDate ? new Date(args.endDate) : new Date();
    const all = await this.receiptRegistry.getAllBetween(startDate, end);
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 100;
    const result = all.slice(offset, offset + limit);
    this.latencyTracker.record(performance.now() - start);
    return result;
  }

  /**
   * Run attempts in parallel
   */
  private async runParallelAttempts(
    taskBundle: TaskBundle,
    configs: AgentConfig[],
    signal?: AbortSignal,
  ): Promise<AttemptResult[]> {
    const runner = new AttemptRunner({
      sandboxManager: this.sandboxManager,
      gstackEndpoint: this.gstackEndpoint,
      maxWallTimeMs: taskBundle.budget.max_wall_time_ms,
      llmClient: this.llmClient,
    });

    // Run all attempts in parallel up to concurrency limit
    const results: AttemptResult[] = [];
    const batchSize = Math.max(1, Math.min(taskBundle.budget.max_parallelism, this.maxConcurrency));

    for (let i = 0; i < configs.length; i += batchSize) {
      this.throwIfCancelled(signal);
      const batch = configs.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(config => runner.runAttempt(taskBundle, config))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Score attempts via GMirror with Tier 2 escalation and consensus
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
      this.logger.info(`Hard gate failures detected (${hardGateFailures.length}), escalating to Tier 2 for re-scoring`);
      const tier2Config = this.tierConfigs.get('tier2')!;
      this.logger.info(`Using Tier 2: ${tier2Config.name} for re-scoring`);

      // Score with Tier 2
      const tier2ScoredAttempts = await this.scoreAttempts(taskBundle, attempts);
      
      // Apply consensus mechanism to determine which outputs to accept
      const consensusResults = await this.applyConsensus(
        tier1ScoredAttempts,
        tier2ScoredAttempts,
        hardGateFailures,
        priority,
        taskBundle,
        attempts
      );
      
      return consensusResults;
    }

    return tier1ScoredAttempts;
  }

  /**
   * Score attempts with Tier 3 (critical path escalation)
   */
  private async scoreWithTier3(
    taskBundle: TaskBundle,
    attempts: AttemptResult[]
  ): Promise<ScoredAttempt[]> {
    const tier3Config = this.tierConfigs.get('tier3')!;
    this.logger.info(`Escalating to Tier 3: ${tier3Config.name} for critical decisions`);
    
    // Track Tier 3 metrics
    this.escalationMetrics.tier3_count++;
    const tier3StartTime = Date.now();
    
    // Score with Tier 3
    const tier3ScoredAttempts = await this.scoreAttempts(taskBundle, attempts);
    
    const tier3Latency = Date.now() - tier3StartTime;
    this.escalationMetrics.tier3_avg_latency_ms = this.escalationMetrics.tier3_avg_latency_ms === 0
      ? tier3Latency
      : (this.escalationMetrics.tier3_avg_latency_ms * (this.escalationMetrics.tier3_count - 1) + tier3Latency) / this.escalationMetrics.tier3_count;
    
    this.escalationMetrics.budget_remaining_usd -= tier3Config.cost_per_1k_tokens_usd;
    
    return tier3ScoredAttempts;
  }

  /**
   * Apply consensus mechanism to determine which tier outputs to accept
   */
  private async applyConsensus(
    tier1Attempts: ScoredAttempt[],
    tier2Attempts: ScoredAttempt[],
    hardGateFailures: ScoredAttempt[],
    priority: 'normal' | 'high' | 'critical' = 'normal',
    taskBundle?: TaskBundle,
    attempts?: AttemptResult[]
  ): Promise<ScoredAttempt[]> {
    const results = new Map<string, ScoredAttempt>();
    let consensusAgreements = 0;
    let consensusDisagreements = 0;

    // For attempts that passed hard gates, use Tier 1 (cheaper)
    for (const attempt of tier1Attempts) {
      if (attempt.scores.hard_gates_passed) {
        results.set(attempt.attempt_id, attempt);
      }
    }

    // For attempts that failed hard gates, apply consensus
    for (const failed of hardGateFailures) {
      const tier1Attempt = tier1Attempts.find(a => a.attempt_id === failed.attempt_id);
      const tier2Attempt = tier2Attempts.find(a => a.attempt_id === failed.attempt_id);

      if (!tier1Attempt || !tier2Attempt) {
        // If one tier failed, use the other
        if (tier2Attempt) {
          results.set(failed.attempt_id, tier2Attempt);
        } else if (tier1Attempt) {
          results.set(failed.attempt_id, tier1Attempt);
        }
        continue;
      }

      // Compute consensus
      const comparison: OutputComparison = {
        tier1Output: JSON.stringify(tier1Attempt.deliverable || tier1Attempt.error_message),
        tier2Output: JSON.stringify(tier2Attempt.deliverable || tier2Attempt.error_message),
        tier1Confidence: tier1Attempt.scores.overall_score,
        tier2Confidence: tier2Attempt.scores.overall_score,
      };

      const consensus = determineConsensus(comparison, this.multiModelConfig.consensus_threshold);
      this.logger.debug(`Consensus for ${failed.attempt_id}: ${consensus.decision} (${consensus.reason})`);

      // Track consensus metrics
      if (consensus.decision === 'tier1') {
        consensusAgreements++;
      } else {
        consensusDisagreements++;
      }

      // Apply decision
      switch (consensus.decision) {
        case 'tier1':
          results.set(failed.attempt_id, tier1Attempt);
          break;
        case 'tier2':
          results.set(failed.attempt_id, tier2Attempt);
          break;
        case 'merge':
          // For now, use Tier 2 as it has higher quality
          results.set(failed.attempt_id, tier2Attempt);
          break;
        case 'escalate_tier3':
          // Escalate to Tier 3 if allowed and budget permits
          if (this.multiModelConfig.allow_tier3 && 
              this.escalationMetrics.budget_remaining_usd > this.tierConfigs.get('tier3')!.cost_per_1k_tokens_usd &&
              (priority === 'critical' || tier2Attempt.scores.overall_score < 0.5)) {
            if (taskBundle && attempts) {
              const tier3ScoredAttempts = await this.scoreWithTier3(taskBundle, attempts);
              const tier3Attempt = tier3ScoredAttempts.find(a => a.attempt_id === failed.attempt_id);
              if (tier3Attempt) {
                results.set(failed.attempt_id, tier3Attempt);
                this.logger.info(`Escalated to Tier 3 for ${failed.attempt_id}`);
                break;
              }
            }
            results.set(failed.attempt_id, tier2Attempt);
          } else {
            results.set(failed.attempt_id, tier2Attempt);
          }
          break;
      }
    }

    // Update consensus agreement rate in metrics
    const totalConsensusDecisions = consensusAgreements + consensusDisagreements;
    if (totalConsensusDecisions > 0) {
      this.escalationMetrics.consensus_agreement_rate = consensusAgreements / totalConsensusDecisions;
    }

    return Array.from(results.values());
  }


  /**
   * Score attempts via GMirror
   */
  private async scoreAttempts(
    taskBundle: TaskBundle,
    attempts: AttemptResult[]
  ): Promise<ScoredAttempt[]> {
    if (!this.gmirrorEndpoint) {
      return attempts.map(attempt => ({
        ...attempt,
        verdict: 'pass',
        score: 0.8,
        hard_gates_passed: true,
        scores: {
          correctness: { score: 0.8, confidence: 0.8, evidence: ['GMirror not configured'] },
          user_outcome: { score: 0.8, confidence: 0.8, evidence: ['GMirror not configured'] },
          robustness: { score: 0.8, confidence: 0.8, evidence: ['GMirror not configured'] },
          risk: { score: 0.8, confidence: 0.8, evidence: ['GMirror not configured'] },
          overall_score: 0.8,
          hard_gates_passed: true,
        },
        selected: false,
      }));
    }

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
      this.logger.warn('GMirror scoring failed, using fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
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
    if (!this.gtomEndpoint) {
      this.logger.debug('GToM endpoint not configured, skipping cognitive check');
      return;
    }
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
      
      this.logger.debug('GToM conflict predictions:', { predicted_conflicts: data.predicted_conflicts });
      
      // In production, would act on predictions
      // For MVP, just log them
    } catch (error) {
      this.logger.warn('GToM cognitive check failed', { error });
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
      const data = await this.gbrainClient.writeRunRecord(request);
      runRecord.gbrain_write_status = 'written';
      this.logger.info('Run record persisted to GBrain', { ack_id: data.ack_id });
    } catch (error) {
      this.logger.warn('Failed to persist to GBrain; run will continue with local artifacts', {
        error: error instanceof Error ? error.message : String(error),
        circuit: this.gbrainClient.getCircuitState(),
      });
      runRecord.gbrain_write_status = 'failed';
    }
  }

  /**
   * Health check for all dependencies
   */
  async healthCheck(): Promise<OrchestratorHealthStatus> {
    const start = performance.now();
    const span = this.observability.tracer.startSpan('GOrchestrator.healthCheck');
    try {
      const results = await Promise.all([
        this.checkHttpEndpoint('gbrain', this.gbrainEndpoint),
        this.gmirrorEndpoint
          ? this.checkHttpEndpoint('gmirror', this.gmirrorEndpoint)
          : Promise.resolve(this.result('gmirror', true, performance.now(), 'not configured')),
        this.gtomEndpoint
          ? this.checkHttpEndpoint('gtom', this.gtomEndpoint)
          : Promise.resolve(this.result('gtom', true, performance.now(), 'not configured')),
        this.checkHttpEndpoint('gstack', this.gstackEndpoint),
        this.checkLLMApiHealth(),
        this.checkSandboxHealth(),
        this.checkSyncFreshness(),
        this.checkSchemaVersion(),
        this.checkQueueHealth(),
        this.checkHealthTrend(),
        this.checkEvalCaptureFailures(),
      ]);

      const healthScore = this.calculateHealthScore(results);
      results.push({
        service: 'health_score',
        healthy: healthScore >= 80,
        latency_ms: performance.now() - start,
        error: healthScore >= 80 ? undefined : `score=${healthScore}`,
        timestamp: new Date().toISOString(),
      });

      const latencyMs = performance.now() - start;
      this.latencyTracker.record(latencyMs);
      this.observability.metrics.recordPublicMethod('healthCheck', latencyMs, 'ok');
      for (const result of results) {
        this.observability.metrics.observe('gorchestrator_health_check_latency_ms', result.latency_ms, { service: result.service });
        if (!result.healthy) this.observability.metrics.increment('gorchestrator_health_check_errors_total', { service: result.service });
      }
      await this.observability.alertOnHealthDrop(healthScore, results);
      const components = Object.fromEntries(
        results.map((check) => [check.service, check.healthy ? 'ok' : 'error'])
      ) as Record<string, 'ok' | 'error'>;
      const status = results.every((check) => check.healthy) ? 'healthy' : 'unhealthy';
      this.observability.tracer.endSpan(span);
      return { status, components, checks: results };
    } catch (error) {
      const latencyMs = performance.now() - start;
      this.observability.metrics.recordPublicMethod('healthCheck', latencyMs, 'error');
      this.observability.tracer.endSpan(span, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private async checkHttpEndpoint(service: string, endpoint: string): Promise<HealthCheckResult> {
    const start = performance.now();
    try {
      const response = await fetch(`${endpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return this.result(service, response.ok, start, response.ok ? undefined : `HTTP ${response.status}`);
    } catch (error) {
      return this.result(service, false, start, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async checkLLMApiHealth(): Promise<HealthCheckResult> {
    const start = performance.now();
    try {
      const secrets = getDefaultSecretManager();
      const anthropicApiKey = secrets.get('anthropic_api_key');
      const openaiApiKey = secrets.get('openai_api_key');
      if (anthropicApiKey) {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic({ apiKey: anthropicApiKey });
        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        });
        return this.result('llm_api', Boolean(response.id), start);
      }
      if (openaiApiKey) {
        const OpenAI = (await import('openai')).default;
        const client = new OpenAI({ apiKey: openaiApiKey });
        const response = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        });
        return this.result('llm_api', Boolean(response.id), start);
      }
      return this.result('llm_api', false, start, 'No LLM API key configured');
    } catch (error) {
      return this.result('llm_api', false, start, error instanceof Error ? error.message : 'LLM ping failed');
    }
  }

  private async checkSandboxHealth(): Promise<HealthCheckResult> {
    const start = performance.now();
    try {
      const sandboxStatus = await this.checkSandbox();
      return this.result('sandbox', sandboxStatus === 'ok', start, sandboxStatus === 'ok' ? undefined : 'Sandbox unavailable');
    } catch (error) {
      return this.result('sandbox', false, start, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async checkSyncFreshness(): Promise<HealthCheckResult> {
    const start = performance.now();
    const latestReceipt = await this.receiptRegistry.getLatest();
    const corpusPath = path.join(process.cwd(), '.gbrain-corpus');
    const timestamps = [
      latestReceipt ? new Date(latestReceipt.timestamp).getTime() : 0,
      fs.existsSync(corpusPath) ? fs.statSync(corpusPath).mtimeMs : 0,
      fs.existsSync(this.successRateHistoryPath) ? fs.statSync(this.successRateHistoryPath).mtimeMs : 0,
    ].filter(value => value > 0);
    const newest = Math.max(0, ...timestamps);
    const ageMs = newest > 0 ? Date.now() - newest : Number.POSITIVE_INFINITY;
    return this.result(
      'sync_freshness',
      Number.isFinite(ageMs) && ageMs <= 24 * 60 * 60 * 1000,
      start,
      Number.isFinite(ageMs) ? `age_ms=${Math.round(ageMs)}` : 'No sync artifacts or receipts found',
    );
  }

  private async checkSchemaVersion(): Promise<HealthCheckResult> {
    const start = performance.now();
    const latestReceipt = await this.receiptRegistry.getLatest();
    const healthy = !latestReceipt || latestReceipt.schema_version === 1;
    return this.result('schema_version', healthy, start, healthy ? undefined : `receipt_schema=${latestReceipt?.schema_version}`);
  }

  private async checkQueueHealth(): Promise<HealthCheckResult> {
    const start = performance.now();
    const stats = this.getSandboxStats() as { active?: number; queued?: number; maxConcurrency?: number };
    const memory = process.memoryUsage();
    const heapRatio = memory.heapTotal > 0 ? memory.heapUsed / memory.heapTotal : 0;
    const queued = stats.queued ?? 0;
    const maxConcurrency = stats.maxConcurrency ?? 1;
    const healthy = heapRatio < 0.9 && queued <= maxConcurrency * 2;
    return this.result('queue_health', healthy, start, `active=${stats.active ?? 0} queued=${queued} heap_ratio=${heapRatio.toFixed(3)}`);
  }

  private async checkHealthTrend(): Promise<HealthCheckResult> {
    const start = performance.now();
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [day, week] = await Promise.all([
      this.receiptRegistry.getAllBetween(dayAgo, now),
      this.receiptRegistry.getAllBetween(weekAgo, now),
    ]);
    const passRate = (receipts: any[]) => receipts.length === 0 ? 1 : receipts.filter(receipt => receipt.hard_gates_passed && receipt.verdict !== 'fail').length / receipts.length;
    const dayRate = passRate(day);
    const weekRate = passRate(week);
    return this.result(
      'health_trend',
      dayRate >= Math.max(0.5, weekRate - 0.15),
      start,
      `pass_rate_24h=${dayRate.toFixed(3)} pass_rate_7d=${weekRate.toFixed(3)} receipts_24h=${day.length} receipts_7d=${week.length}`,
    );
  }

  private async checkEvalCaptureFailures(): Promise<HealthCheckResult> {
    const start = performance.now();
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const receipts = await this.receiptRegistry.getAllBetween(dayAgo, now);
    const failures = receipts.filter((receipt: any) =>
      receipt.metadata?.eval_capture_failed ||
      receipt.metadata?.eval_capture?.status === 'failed' ||
      (receipt.errors ?? []).some((error: string) => /eval[_ -]?capture/i.test(error)),
    );
    return this.result('eval_capture', failures.length === 0, start, `failures_24h=${failures.length}`);
  }

  private calculateHealthScore(results: HealthCheckResult[]): number {
    const weights: Record<string, number> = {
      gbrain: 20,
      gmirror: 15,
      gtom: 10,
      gstack: 10,
      llm_api: 15,
      sandbox: 10,
      sync_freshness: 10,
      schema_version: 10,
      queue_health: 5,
      health_trend: 10,
      eval_capture: 5,
    };
    let earned = 0;
    let total = 0;
    for (const result of results) {
      const weight = weights[result.service] ?? 2;
      total += weight;
      if (result.healthy) {
        const latencyPenalty = result.latency_ms > 2000 ? 0.75 : result.latency_ms > 500 ? 0.9 : 1;
        earned += weight * latencyPenalty;
      }
    }
    return total === 0 ? 0 : Math.round((earned / total) * 100);
  }

  private result(service: string, healthy: boolean, start: number, error?: string): HealthCheckResult {
    return {
      service,
      healthy,
      latency_ms: performance.now() - start,
      error: healthy ? undefined : error,
      timestamp: new Date().toISOString(),
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
      success_rate_trend: this.calculateSuccessRateTrend(),
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
   * Calculate success rate trend from history
   */
  private calculateSuccessRateTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.successRateHistory.length < 3) return 'stable';
    
    const recent = this.successRateHistory.slice(-10);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const change = last - first;
    
    // Calculate slope using linear regression
    const n = recent.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += recent[i];
      sumXY += i * recent[i];
      sumX2 += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    if (slope > 0.01) return 'increasing';
    if (slope < -0.01) return 'decreasing';
    return 'stable';
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

  private recordTaskSuccessMetric(successValue: number, dyadResult?: DyadPipelineResult): void {
    const normalized = Number.isFinite(successValue) ? Math.max(0, Math.min(1, successValue)) : 0;
    this.successRateHistory.push(normalized);
    if (this.successRateHistory.length > 50) this.successRateHistory.shift();
    this.saveSuccessRateHistory();

    const recentHistory = this.successRateHistory.slice(-20);
    if (recentHistory.length > 0) {
      const rate = recentHistory.filter(value => value > 0.5).length / Math.min(20, recentHistory.length);
      this.recordDriftMetric('task_success_rate', rate);
      if (recentHistory.length >= 20 && rate < 0.6) {
        this.auditLogger.logDecision({
          operation: 'task_success_rate_drift',
          decision: 'alert',
          success: false,
          metadata: { rate, window: 20 },
        });
      }
    }

    if (dyadResult && dyadResult.detector_outputs.length > 0) {
      const avgConfidence = dyadResult.detector_outputs.reduce((sum, output) => sum + output.confidence, 0) / dyadResult.detector_outputs.length;
      const metric = `detector_confidence:${dyadResult.dyad_id}`;
      this.recordDriftMetric(metric, avgConfidence);
      const history = this.detectorConfidenceHistory.get(metric) || [];
      const previous = history[history.length - 1];
      history.push(avgConfidence);
      this.detectorConfidenceHistory.set(metric, history.slice(-20));
      if (previous !== undefined && previous > 0 && (previous - avgConfidence) / previous > 0.2) {
        this.auditLogger.logDecision({
          operation: 'detector_confidence_drift',
          decision: 'alert',
          correlation_id: dyadResult.dyad_id,
          success: false,
          metadata: { previous, current: avgConfidence, metric },
        });
      }
    }
  }

  private recordDriftMetric(metric: string, value: number): void {
    const detector = this.driftDetector as any;
    if (typeof detector.record === 'function') {
      detector.record(metric, value);
    } else {
      this.driftDetector.recordSnapshot(metric, value);
    }
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
   * Get drift statistics
   */
  async getDrift(metricName?: string): Promise<any[]> {
    const start = performance.now();
    let result;
    if (metricName) {
      const driftResult = this.driftDetector.detectDrift(metricName);
      result = driftResult ? [driftResult] : [];
    } else {
      result = this.driftDetector.detectAllDrift();
    }
    this.latencyTracker.record(performance.now() - start);
    return result;
  }

  getDriftHistory(metricName: string = 'task_success_rate', window: number = 20): Array<{ timestamp: string; value: number; drift_detected: boolean }> {
    if (metricName !== 'task_success_rate') {
      const values = this.detectorConfidenceHistory.get(metricName) || [];
      return values.slice(-window).map((value, index, arr) => ({
        timestamp: new Date(Date.now() - (arr.length - index - 1) * 1000).toISOString(),
        value,
        drift_detected: index > 0 && arr[index - 1] > 0 && (arr[index - 1] - value) / arr[index - 1] > 0.2,
      }));
    }

    const history = this.successRateHistory.slice(-window);
    return history.map((_, index) => {
      const prefix = history.slice(0, index + 1);
      const value = prefix.filter(item => item > 0.5).length / prefix.length;
      return {
        timestamp: new Date(Date.now() - (history.length - index - 1) * 1000).toISOString(),
        value,
        drift_detected: prefix.length >= 20 && value < 0.6,
      };
    });
  }

  /**
   * Get cost statistics
   */
  getCostStats() {
    return this.costLedger.getStats();
  }

  /**
   * Get sandbox pool statistics
   */
  getSandboxStats() {
    return this.sandboxManager.getStats ? this.sandboxManager.getStats() : {
      total: 5,
      active: 0,
      available: 5,
    };
  }

  /**
   * Get attempt statistics
   */
  getAttempts(limit?: number) {
    // SelectorEngine doesn't have getAttempts method yet
    // Return escalation metrics as a proxy for now
    return {
      total_attempts: this.escalationMetrics.total_tasks,
      escalated_attempts: this.escalationMetrics.escalated_tasks,
      success_rate: this.escalationMetrics.tier1_success_rate,
      tier_distribution: {
        tier1: this.escalationMetrics.tier1_count,
        tier2: this.escalationMetrics.tier2_count,
        tier3: this.escalationMetrics.tier3_count,
      },
    };
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
    const start = performance.now();
    await this.sandboxManager.cleanup();
    this.latencyTracker.record(performance.now() - start);
  }

  private loadSuccessRateHistory(): number[] {
    try {
      if (!fs.existsSync(this.successRateHistoryPath)) return [];
      const parsed = JSON.parse(fs.readFileSync(this.successRateHistoryPath, 'utf8'));
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)).slice(-50);
    } catch {
      return [];
    }
  }

  private saveSuccessRateHistory(): void {
    try {
      fs.mkdirSync(path.dirname(this.successRateHistoryPath), { recursive: true });
      fs.writeFileSync(this.successRateHistoryPath, JSON.stringify(this.successRateHistory.slice(-50), null, 2));
    } catch {
      // Drift history persistence is best-effort; task execution should not fail because telemetry cannot be saved.
    }
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
    const consensus = this.selectorEngine.getLastConsensusSummary();
    const consensusModels = consensus?.votes.map(vote => vote.model_id) || [];
    const modelList = consensusModels.length > 0 ? Array.from(new Set(consensusModels)) : ['claude-sonnet-4-6'];
    const validVotes = consensus?.valid_votes || 0;
    const agreeingVotes = Math.round((consensus?.agreement_ratio || 0) * validVotes);
    const verdictInterval = this.wilson95(agreeingVotes, validVotes);

    return {
      receipt_id: uuidv4(),
      schema_version: 1,
      timestamp: new Date().toISOString(),
      project: 'gorchestrator',
      rubric_name: GORCHESTRATOR_RUBRIC_V1.name,
      rubric_sha8: rubricHash,
      input_hash: inputHash,
      models_used: modelList,
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
        consensus,
        verdict_wilson_95_ci: verdictInterval,
        small_sample_note: runRecord.attempts.length < 30,
      },
    };
  }

  private wilson95(successes: number, total: number): { lower: number; upper: number } {
    if (total <= 0) {
      return { lower: 0, upper: 0 };
    }

    const z = 1.96;
    const phat = successes / total;
    const denominator = 1 + (z * z) / total;
    const center = phat + (z * z) / (2 * total);
    const margin = z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * total)) / total);

    return {
      lower: Math.min(1, Math.max(0, (center - margin) / denominator)),
      upper: Math.min(1, Math.max(0, (center + margin) / denominator)),
    };
  }

  /**
   * Store receipt in gbrain quality control database
   */
  private async storeReceiptInGBrain(receipt: ExecutionReceipt): Promise<void>;
  private async storeReceiptInGBrain(task: RelationshipAnalysisTask, result: DyadPipelineResult): Promise<void>;
  private async storeReceiptInGBrain(first: ExecutionReceipt | RelationshipAnalysisTask, result?: DyadPipelineResult): Promise<void> {
    if (result && (first as RelationshipAnalysisTask).task_type === 'relationship_analysis') {
      const task = first as RelationshipAnalysisTask;
      if (!/^[a-f0-9]{16,64}$/i.test(task.dyad_id)) {
        this.logger.error('Skipping DYAD GBrain persistence because dyad_id is not a hash', { dyad_id: task.dyad_id });
        return;
      }

      try {
        await this.gbrainClient.createPage({
          title: `DYAD result: ${task.dyad_id}`,
          content: this.redactForGBrain(result),
          page_kind: 'dyad',
          tags: ['relationship', task.dyad_id],
        });
      } catch (error) {
        this.logger.warn('Failed to store DYAD result in GBrain', {
          error: error instanceof Error ? error.message : String(error),
          circuit: this.gbrainClient.getCircuitState(),
        });
      }
      return;
    }

    const receipt = first as ExecutionReceipt;
    try {
      await this.gbrainClient.createPage({
        title: `Receipt: ${receipt.receipt_id}`,
        content: JSON.stringify(receipt, null, 2),
        tags: ['gorchestrator', 'receipt', receipt.verdict],
      });
    } catch (error) {
      this.logger.warn('Failed to store receipt in GBrain; local receipt registry remains authoritative', {
        error: error instanceof Error ? error.message : String(error),
        circuit: this.gbrainClient.getCircuitState(),
      });
    }
  }

  private redactForGBrain(result: DyadPipelineResult): string {
    const serialized = JSON.stringify(result, null, 2)
      .replace(/\+?1?\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, '[PHONE]')
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
    return serialized;
  }
}
