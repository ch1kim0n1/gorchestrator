"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectorEngine = void 0;
/**
 * Selector & Merge Engine
 *
 * Responsibilities:
 * - Select winner from scored attempts
 * - Support multiple selection strategies
 * - Merge outputs when appropriate
 * - Provide rationale for selection
 */
class SelectorEngine {
    defaultStrategy;
    constructor(config = {}) {
        this.defaultStrategy = config.defaultStrategy || 'highest_score';
    }
    /**
     * Main entry point: select winner from scored attempts
     */
    selectWinner(attempts, strategy) {
        if (attempts.length === 0) {
            throw new Error('No attempts to select from');
        }
        const selectedStrategy = strategy || this.defaultStrategy;
        switch (selectedStrategy) {
            case 'highest_score':
                return this.selectHighestScore(attempts);
            case 'component_substitution':
                return this.selectWithComponentSubstitution(attempts);
            case 'synthesized_merge':
                return this.selectWithSynthesizedMerge(attempts);
            default:
                return this.selectHighestScore(attempts);
        }
    }
    /**
     * Select attempt with highest overall score
     */
    selectHighestScore(attempts) {
        // Filter to only completed attempts with passed hard gates
        const validAttempts = attempts.filter(a => a.status === 'completed' && a.scores.hard_gates_passed);
        if (validAttempts.length === 0) {
            // Fall back to completed attempts even if gates failed
            const completedAttempts = attempts.filter(a => a.status === 'completed');
            if (completedAttempts.length === 0) {
                throw new Error('No completed attempts to select from');
            }
            return this.selectHighestScore(completedAttempts);
        }
        // Sort by overall score, then by cost (lower is better)
        const sorted = [...validAttempts].sort((a, b) => {
            const scoreDiff = b.scores.overall_score - a.scores.overall_score;
            if (Math.abs(scoreDiff) > 0.01) {
                return scoreDiff;
            }
            return a.cost.total_cost_usd - b.cost.total_cost_usd;
        });
        const winner = sorted[0];
        const runnerUp = sorted[1];
        let rationale = `Selected attempt ${winner.attempt_id} with highest score (${winner.scores.overall_score.toFixed(3)})`;
        if (runnerUp) {
            const scoreGap = winner.scores.overall_score - runnerUp.scores.overall_score;
            if (scoreGap < 0.1) {
                rationale += `. Close second: attempt ${runnerUp.attempt_id} (${runnerUp.scores.overall_score.toFixed(3)})`;
            }
        }
        return {
            winner_attempt_id: winner.attempt_id,
            strategy_used: 'highest_score',
            selected_deliverable: winner.deliverable,
            rationale,
            confidence: this.calculateConfidence(winner, sorted),
        };
    }
    /**
     * Select winner and substitute superior components from other attempts
     */
    selectWithComponentSubstitution(attempts) {
        const baseSelection = this.selectHighestScore(attempts);
        const winner = attempts.find(a => a.attempt_id === baseSelection.winner_attempt_id);
        // Identify components that can be improved
        const improvedDeliverable = this.substituteComponents(winner, attempts);
        if (improvedDeliverable === winner.deliverable) {
            // No substitutions made, return base selection
            return baseSelection;
        }
        return {
            winner_attempt_id: winner.attempt_id,
            strategy_used: 'component_substitution',
            selected_deliverable: improvedDeliverable,
            merge_sources: attempts
                .filter(a => a.attempt_id !== winner.attempt_id)
                .map(a => a.attempt_id),
            rationale: `Selected attempt ${winner.attempt_id} as base and substituted superior components from other attempts`,
            confidence: baseSelection.confidence * 0.9, // Slightly lower confidence for merged output
        };
    }
    /**
     * Substitute components from other attempts
     */
    substituteComponents(base, attempts) {
        // For hackathon MVP, implement simple artifact substitution
        // In production, would analyze artifacts and substitute intelligently
        const otherAttempts = attempts.filter(a => a.attempt_id !== base.attempt_id);
        if (!base.deliverable || otherAttempts.length === 0) {
            return base.deliverable;
        }
        const improvedArtifacts = [...(base.deliverable.artifacts || [])];
        for (const other of otherAttempts) {
            if (!other.deliverable?.artifacts)
                continue;
            // Find artifacts with same path but better scores
            for (const artifact of other.deliverable.artifacts) {
                const existingIndex = improvedArtifacts.findIndex(a => a.path === artifact.path);
                if (existingIndex >= 0) {
                    // Compare scores and substitute if other is better
                    if (other.scores.correctness.score > base.scores.correctness.score) {
                        improvedArtifacts[existingIndex] = artifact;
                    }
                }
                else {
                    // Add new artifact if it doesn't exist in base
                    improvedArtifacts.push(artifact);
                }
            }
        }
        return {
            ...base.deliverable,
            artifacts: improvedArtifacts,
        };
    }
    /**
     * Synthesize a new merged output from multiple attempts
     */
    selectWithSynthesizedMerge(attempts) {
        // For hackathon MVP, fall back to component substitution
        // In production, would use LLM to synthesize new output
        return this.selectWithComponentSubstitution(attempts);
    }
    /**
     * Calculate confidence in selection
     */
    calculateConfidence(winner, sorted) {
        // Confidence based on:
        // 1. Gap between winner and runner-up
        // 2. Overall score level
        // 3. Hard gate status
        const winnerScore = winner.scores.overall_score;
        const winnerHardGates = winner.scores.hard_gates_passed;
        let confidence = winnerScore;
        // Boost confidence if hard gates passed
        if (winnerHardGates) {
            confidence *= 1.1;
        }
        // Reduce confidence if score is low
        if (winnerScore < 0.5) {
            confidence *= 0.8;
        }
        // Cap at 1.0
        return Math.min(1.0, confidence);
    }
    /**
     * Get selection statistics
     */
    getSelectionStats(attempts) {
        const completed = attempts.filter(a => a.status === 'completed');
        const passedGates = completed.filter(a => a.scores.hard_gates_passed);
        const scores = passedGates.map(a => a.scores.overall_score);
        const averageScore = scores.length > 0
            ? scores.reduce((sum, s) => sum + s, 0) / scores.length
            : 0;
        const minScore = scores.length > 0 ? Math.min(...scores) : 0;
        const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
        const variance = scores.length > 1
            ? scores.reduce((sum, s) => sum + Math.pow(s - averageScore, 2), 0) / (scores.length - 1)
            : 0;
        const stdDev = Math.sqrt(variance);
        return {
            totalAttempts: attempts.length,
            completedAttempts: completed.length,
            passedHardGates: passedGates.length,
            averageScore,
            scoreRange: { min: minScore, max: maxScore },
            scoreStdDev: stdDev,
        };
    }
}
exports.SelectorEngine = SelectorEngine;
//# sourceMappingURL=selector.js.map