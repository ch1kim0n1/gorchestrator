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
  private gbrainEndpoint: string;
  private primingTimeoutMs: number;
  private llmClient: LLMClient;

  constructor(config: {
    gbrainEndpoint?: string;
    primingTimeoutMs?: number;
  } = {}) {
    this.gbrainEndpoint = config.gbrainEndpoint || 'http://localhost:3000';
    this.primingTimeoutMs = config.primingTimeoutMs || 500;
    this.llmClient = new LLMClient();
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
    const priors = await this.queryPriors(signature).catch((error) => {
      console.warn(`[IntakePrimer] GBrain priming failed: ${error.message}. Proceeding with empty priors.`);
      return this.emptyPriors();
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
      console.warn('[IntakePrimer] LLM task type inference failed, using heuristic:', error);
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
      console.warn('[IntakePrimer] LLM surfaces inference failed, using heuristic:', error);
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.primingTimeoutMs);

    try {
      const response = await fetch(`${this.gbrainEndpoint}/gbrain/priors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`GBrain returned ${response.status}`);
      }

      const data = await response.json();
      return this.validatePriors(data);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Validate and normalize priors from GBrain
   */
  private validatePriors(data: any): GBrainPriorBundle {
    // In production, use Zod schema validation
    // For now, return structured default if validation fails
    return {
      similar_tasks: data.similar_tasks || [],
      winning_configs: data.winning_configs || [],
      known_failure_modes: data.known_failure_modes || [],
      recommended_n: data.recommended_n || 5,
      user_preferences: data.user_preferences || {},
      domain_constraints: data.domain_constraints || {},
    };
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
