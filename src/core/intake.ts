import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  TaskBundle,
  TaskSignature,
  Constraint,
  OutcomeShape,
  GBrainRef,
  GBrainPriorBundle,
  ExecutionBudget,
  GBrainPrimingRequest,
} from '../types/index.js';
import { LLMClient } from './llm-client.js';
import { coreLogger } from './observability.js';
import {
  GBrainIntegrationClient,
  GBrainIntegrationConfig,
  GBrainIntegrationMode,
} from './gbrain-integration.js';
import { TTLCache } from './performance.js';

/**
 * Intake & Priming Module
 * 
 * Responsibilities:
 * - Accept task description and normalize into structured form
 * - Generate task signature for similarity lookup
 * - Query GBrain for priors (winning configs, failure modes, etc.)
 * - Enrich task with priors and recommended budget
 */
export class IntakePrimer {
  private llmClient: LLMClient;
  private gbrainClient: GBrainIntegrationClient;
  private priorsCache: TTLCache<string, GBrainPriorBundle>;

  constructor(config: {
    gbrainEndpoint?: string;
    gbrainMcpEndpoint?: string;
    gbrainMode?: GBrainIntegrationMode;
    gbrainAuthToken?: string;
    gbrainMaxRetries?: number;
    gbrainInitialBackoffMs?: number;
    gbrainCircuitBreakerFailureThreshold?: number;
    gbrainCircuitBreakerCooldownMs?: number;
    primingTimeoutMs?: number;
    llmClient?: LLMClient;
    gbrainClient?: GBrainIntegrationClient;
    priorsCache?: TTLCache<string, GBrainPriorBundle>;
  } = {}) {
    this.llmClient = config.llmClient ?? new LLMClient();
    this.gbrainClient = config.gbrainClient ?? new GBrainIntegrationClient({
      endpoint: config.gbrainEndpoint,
      mcpEndpoint: config.gbrainMcpEndpoint,
      mode: config.gbrainMode,
      authToken: config.gbrainAuthToken,
      timeoutMs: config.primingTimeoutMs ?? 500,
      maxRetries: config.gbrainMaxRetries,
      initialBackoffMs: config.gbrainInitialBackoffMs,
      circuitBreakerFailureThreshold: config.gbrainCircuitBreakerFailureThreshold,
      circuitBreakerCooldownMs: config.gbrainCircuitBreakerCooldownMs,
    } satisfies GBrainIntegrationConfig);
    this.priorsCache = config.priorsCache ?? new TTLCache<string, GBrainPriorBundle>(256, Number(process.env.GORCH_PRIORS_CACHE_TTL_MS ?? 5 * 60 * 1000));
  }

  /**
   * Main entry point: convert raw task into enriched TaskBundle
   */
  async intakeTask(rawTask: {
    description: string;
    taskType?: string;
    surfaces?: string[];
    constraints?: Partial<Constraint>[];
    outcomeShape?: Partial<OutcomeShape>;
    budget?: Partial<ExecutionBudget>;
    userContext?: string;
    companyContext?: string;
  }): Promise<TaskBundle> {
    const taskId = uuidv4();
    const signature = await this.generateSignature(rawTask);
    
    // Query GBrain for priors (with timeout)
    const cachedPriors = this.priorsCache.get(signature.hash);
    const priors = cachedPriors ?? await this.queryPriors(signature).then((result) => {
      this.priorsCache.set(signature.hash, result);
      return result;
    }).catch((error) => {
      coreLogger.warn('GBrain priming failed; proceeding with empty priors', {
        error: error instanceof Error ? error.message : String(error),
      });
      const empty = this.emptyPriors();
      this.priorsCache.set(signature.hash, empty);
      return empty;
    });

    // Determine recommended budget from priors or defaults
    const budget = this.determineBudget(rawTask.budget, priors);

    const taskBundle: TaskBundle = {
      task_id: taskId,
      raw_description: rawTask.description,
      signature,
      priors,
      budget,
      created_at: new Date().toISOString(),
    };

    return taskBundle;
  }

  /**
   * Generate deterministic task signature from task description and context
   */
  private async generateSignature(rawTask: {
    description: string;
    taskType?: string;
    surfaces?: string[];
    constraints?: Partial<Constraint>[];
    outcomeShape?: Partial<OutcomeShape>;
    userContext?: string;
    companyContext?: string;
  }): Promise<TaskSignature> {
    const taskType = rawTask.taskType || await this.inferTaskType(rawTask.description);
    const surfaces = rawTask.surfaces || await this.inferSurfaces(rawTask.description);
    
    const constraints: Constraint[] = (rawTask.constraints || []).map((c, idx) => ({
      type: c.type || 'performance',
      value: c.value || 'default',
      operator: c.operator || '<=',
      priority: c.priority ?? 5,
    }));

    const outcomeShape: OutcomeShape = rawTask.outcomeShape as OutcomeShape || {
      type: this.inferOutcomeType(taskType),
      format: 'text',
      validation_criteria: [],
    } as OutcomeShape;

    const contextRefs: GBrainRef[] = [];
    if (rawTask.userContext) {
      contextRefs.push({
        ref_type: 'entity',
        ref_id: this.hashContext(rawTask.userContext),
        confidence: 0.8,
      });
    }
    if (rawTask.companyContext) {
      contextRefs.push({
        ref_type: 'entity',
        ref_id: this.hashContext(rawTask.companyContext),
        confidence: 0.9,
      });
    }

    // Generate deterministic hash from signature components
    const signatureString = JSON.stringify({
      description: rawTask.description,
      taskType,
      surfaces: surfaces.sort(),
      constraints: constraints.map(c => `${c.type}:${c.value}:${c.operator}`),
      outcomeType: outcomeShape.type,
    });
    const hash = crypto.createHash('sha256').update(signatureString).digest('hex');

    return {
      task_type: taskType,
      surfaces,
      constraints,
      outcome_shape: outcomeShape,
      context_refs: contextRefs,
      hash,
    };
  }

  /**
   * Infer task type from description using LLM with heuristic fallback
   */
  private async inferTaskType(description: string): Promise<string> {
    try {
      const prompt = `Classify the following task description into one of these categories:
- code_generation: Writing new code or adding features
- refactor: Restructuring or optimizing existing code
- deployment: Deploying or releasing code
- research: Investigating or analyzing
- document_write: Writing documentation or explanations
- general: Other tasks

Task description: ${description}

Return only the category name.`;
      const model = this.llmClient.getModelByTier('tier1');
      const result = await this.llmClient.call(prompt, { model, temperature: 0.3 });
      const taskType = result.content.trim().toLowerCase();
      const validTypes = ['code_generation', 'refactor', 'deployment', 'research', 'document_write', 'general'];
      return validTypes.includes(taskType) ? taskType : this.inferTaskTypeHeuristic(description);
    } catch (error) {
      coreLogger.warn('LLM task type inference failed, using heuristic', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.inferTaskTypeHeuristic(description);
    }
  }

  /**
   * Infer task type using heuristics (fallback)
   */
  private inferTaskTypeHeuristic(description: string): string {
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('implement') || lowerDesc.includes('write code') || lowerDesc.includes('add feature')) {
      return 'code_generation';
    }
    if (lowerDesc.includes('refactor') || lowerDesc.includes('clean up') || lowerDesc.includes('optimize')) {
      return 'refactor';
    }
    if (lowerDesc.includes('deploy') || lowerDesc.includes('release') || lowerDesc.includes('ship')) {
      return 'deployment';
    }
    if (lowerDesc.includes('research') || lowerDesc.includes('investigate') || lowerDesc.includes('analyze')) {
      return 'research';
    }
    if (lowerDesc.includes('document') || lowerDesc.includes('write docs') || lowerDesc.includes('explain')) {
      return 'document_write';
    }
    
    return 'general';
  }

  /**
   * Infer affected surfaces from description using LLM with heuristic fallback
   */
  private async inferSurfaces(description: string): Promise<string[]> {
    try {
      const prompt = `Identify which surfaces are affected by the following task description.
Possible surfaces: api, database, ui, auth, config, code, deployment, monitoring.

Task description: ${description}

Return a JSON array of surface names (e.g., ["api", "database"]).`;
      const model = this.llmClient.getModelByTier('tier1');
      const result = await this.llmClient.call(prompt, { model, temperature: 0.3 });
      const parsed = JSON.parse(result.content);
      const validSurfaces = ['api', 'database', 'ui', 'auth', 'config', 'code', 'deployment', 'monitoring'];
      const surfaces = Array.isArray(parsed) ? parsed.filter((s: string) => validSurfaces.includes(s)) : [];
      return surfaces.length > 0 ? surfaces : this.inferSurfacesHeuristic(description);
    } catch (error) {
      coreLogger.warn('LLM surfaces inference failed, using heuristic', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.inferSurfacesHeuristic(description);
    }
  }

  /**
   * Infer surfaces using heuristics (fallback)
   */
  private inferSurfacesHeuristic(description: string): string[] {
    const surfaces: string[] = [];
    const lowerDesc = description.toLowerCase();

    if (lowerDesc.includes('api') || lowerDesc.includes('endpoint')) {
      surfaces.push('api');
    }
    if (lowerDesc.includes('database') || lowerDesc.includes('db') || lowerDesc.includes('schema')) {
      surfaces.push('database');
    }
    if (lowerDesc.includes('ui') || lowerDesc.includes('frontend') || lowerDesc.includes('interface')) {
      surfaces.push('ui');
    }
    if (lowerDesc.includes('auth') || lowerDesc.includes('authentication') || lowerDesc.includes('login')) {
      surfaces.push('auth');
    }
    if (lowerDesc.includes('config') || lowerDesc.includes('configuration') || lowerDesc.includes('settings')) {
      surfaces.push('config');
    }

    return surfaces.length > 0 ? surfaces : ['code'];
  }

  /**
   * Infer outcome type from task type
   */
  private inferOutcomeType(taskType: string): OutcomeShape['type'] {
    const typeMap: Record<string, OutcomeShape['type']> = {
      code_generation: 'code',
      refactor: 'code',
      deployment: 'deployment',
      research: 'document',
      document_write: 'document',
    };
    
    return typeMap[taskType] || 'code';
  }

  /**
   * Hash context string for GBrain reference
   */
  private hashContext(context: string): string {
    return crypto.createHash('md5').update(context).digest('hex');
  }

  /**
   * Query GBrain for priors on similar tasks
   */
  private async queryPriors(signature: TaskSignature): Promise<GBrainPriorBundle> {
    const request: GBrainPrimingRequest = {
      signature_hash: signature.hash,
      max_results: 10,
      similarity_threshold: 0.7,
    };

    return this.gbrainClient.getPriors(request);
  }

  /**
   * Return empty priors when GBrain is unavailable
   */
  private emptyPriors(): GBrainPriorBundle {
    return {
      similar_tasks: [],
      winning_configs: [],
      known_failure_modes: [],
      recommended_n: 5,
      user_preferences: {},
      domain_constraints: {},
    };
  }

  /**
   * Determine execution budget from priors and user input
   */
  private determineBudget(
    userBudget: Partial<ExecutionBudget> = {},
    priors: GBrainPriorBundle
  ): ExecutionBudget {
    const recommendedN = priors.recommended_n || 5;
    
    return {
      max_attempts: userBudget.max_attempts || recommendedN,
      max_cost_usd: userBudget.max_cost_usd || 100,
      max_wall_time_ms: userBudget.max_wall_time_ms || 300000,
      max_parallelism: userBudget.max_parallelism || Math.min(recommendedN, 5),
    };
  }
}
