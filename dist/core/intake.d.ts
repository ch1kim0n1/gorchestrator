import { TaskBundle, Constraint, OutcomeShape, ExecutionBudget } from '../types/index.js';
/**
 * Intake & Priming Module
 *
 * Responsibilities:
 * - Accept task description and normalize into structured form
 * - Generate task signature for similarity lookup
 * - Query GBrain for priors (winning configs, failure modes, etc.)
 * - Enrich task with priors and recommended budget
 */
export declare class IntakePrimer {
    private gbrainEndpoint;
    private primingTimeoutMs;
    constructor(config?: {
        gbrainEndpoint?: string;
        primingTimeoutMs?: number;
    });
    /**
     * Main entry point: convert raw task into enriched TaskBundle
     */
    intakeTask(rawTask: {
        description: string;
        taskType?: string;
        surfaces?: string[];
        constraints?: Partial<Constraint>[];
        outcomeShape?: Partial<OutcomeShape>;
        budget?: Partial<ExecutionBudget>;
        userContext?: string;
        companyContext?: string;
    }): Promise<TaskBundle>;
    /**
     * Generate deterministic task signature from task description and context
     */
    private generateSignature;
    /**
     * Infer task type from description using simple heuristics
     */
    private inferTaskType;
    /**
     * Infer affected surfaces from description
     */
    private inferSurfaces;
    /**
     * Infer outcome type from task type
     */
    private inferOutcomeType;
    /**
     * Hash context string for GBrain reference
     */
    private hashContext;
    /**
     * Query GBrain for priors on similar tasks
     */
    private queryPriors;
    /**
     * Validate and normalize priors from GBrain
     */
    private validatePriors;
    /**
     * Return empty priors when GBrain is unavailable
     */
    private emptyPriors;
    /**
     * Determine execution budget from priors and user input
     */
    private determineBudget;
}
//# sourceMappingURL=intake.d.ts.map