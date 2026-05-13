import { ScoredAttempt, SelectionResult, SelectionStrategy } from '../types/index.js';
/**
 * Selector & Merge Engine
 *
 * Responsibilities:
 * - Select winner from scored attempts
 * - Support multiple selection strategies
 * - Merge outputs when appropriate
 * - Provide rationale for selection
 */
export declare class SelectorEngine {
    private defaultStrategy;
    constructor(config?: {
        defaultStrategy?: SelectionStrategy;
    });
    /**
     * Main entry point: select winner from scored attempts
     */
    selectWinner(attempts: ScoredAttempt[], strategy?: SelectionStrategy): SelectionResult;
    /**
     * Select attempt with highest overall score
     */
    private selectHighestScore;
    /**
     * Select winner and substitute superior components from other attempts
     */
    private selectWithComponentSubstitution;
    /**
     * Substitute components from other attempts
     */
    private substituteComponents;
    /**
     * Synthesize a new merged output from multiple attempts
     */
    private selectWithSynthesizedMerge;
    /**
     * Calculate confidence in selection
     */
    private calculateConfidence;
    /**
     * Get selection statistics
     */
    getSelectionStats(attempts: ScoredAttempt[]): {
        totalAttempts: number;
        completedAttempts: number;
        passedHardGates: number;
        averageScore: number;
        scoreRange: {
            min: number;
            max: number;
        };
        scoreStdDev: number;
    };
}
//# sourceMappingURL=selector.d.ts.map