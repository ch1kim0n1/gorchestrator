"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntakePrimer = void 0;
const crypto_1 = __importDefault(require("crypto"));
const uuid_1 = require("uuid");
/**
 * Intake & Priming Module
 *
 * Responsibilities:
 * - Accept task description and normalize into structured form
 * - Generate task signature for similarity lookup
 * - Query GBrain for priors (winning configs, failure modes, etc.)
 * - Enrich task with priors and recommended budget
 */
class IntakePrimer {
    gbrainEndpoint;
    primingTimeoutMs;
    constructor(config = {}) {
        this.gbrainEndpoint = config.gbrainEndpoint || 'http://localhost:3000';
        this.primingTimeoutMs = config.primingTimeoutMs || 500;
    }
    /**
     * Main entry point: convert raw task into enriched TaskBundle
     */
    async intakeTask(rawTask) {
        const taskId = (0, uuid_1.v4)();
        const signature = this.generateSignature(rawTask);
        // Query GBrain for priors (with timeout)
        const priors = await this.queryPriors(signature).catch((error) => {
            console.warn(`[IntakePrimer] GBrain priming failed: ${error.message}. Proceeding with empty priors.`);
            return this.emptyPriors();
        });
        // Determine recommended budget from priors or defaults
        const budget = this.determineBudget(rawTask.budget, priors);
        const taskBundle = {
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
    generateSignature(rawTask) {
        const taskType = rawTask.taskType || this.inferTaskType(rawTask.description);
        const surfaces = rawTask.surfaces || this.inferSurfaces(rawTask.description);
        const constraints = (rawTask.constraints || []).map((c, idx) => ({
            type: c.type || 'performance',
            value: c.value || 'default',
            operator: c.operator || '<=',
            priority: c.priority ?? 5,
        }));
        const outcomeShape = rawTask.outcomeShape || {
            type: this.inferOutcomeType(taskType),
            format: 'text',
            validation_criteria: [],
        };
        const contextRefs = [];
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
            taskType,
            surfaces: surfaces.sort(),
            constraints: constraints.map(c => `${c.type}:${c.value}:${c.operator}`),
            outcomeType: outcomeShape.type,
        });
        const hash = crypto_1.default.createHash('sha256').update(signatureString).digest('hex');
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
     * Infer task type from description using simple heuristics
     */
    inferTaskType(description) {
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
     * Infer affected surfaces from description
     */
    inferSurfaces(description) {
        const surfaces = [];
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
    inferOutcomeType(taskType) {
        const typeMap = {
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
    hashContext(context) {
        return crypto_1.default.createHash('md5').update(context).digest('hex');
    }
    /**
     * Query GBrain for priors on similar tasks
     */
    async queryPriors(signature) {
        const request = {
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
        }
        catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    /**
     * Validate and normalize priors from GBrain
     */
    validatePriors(data) {
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
    emptyPriors() {
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
    determineBudget(userBudget = {}, priors) {
        const recommendedN = priors.recommended_n || 5;
        return {
            max_attempts: userBudget.max_attempts || recommendedN,
            max_cost_usd: userBudget.max_cost_usd || 100,
            max_wall_time_ms: userBudget.max_wall_time_ms || 300000,
            max_parallelism: userBudget.max_parallelism || Math.min(recommendedN, 5),
        };
    }
}
exports.IntakePrimer = IntakePrimer;
//# sourceMappingURL=intake.js.map