import {
  ScoredAttempt,
  SelectionResult,
  SelectionStrategy,
  Deliverable,
  MultiModelConfig,
  ModelTier,
} from '../types/index.js';
import { LLMClient } from './llm-client.js';

// Rubric dimensions and weights from orchestrator-rubric
const RUBRIC_WEIGHTS = {
  correctness: 0.3,
  latency: 0.2,
  robustness: 0.2,
  cost_efficiency: 0.15,
  resource_utilization: 0.15,
};

interface SelectionConsensusVote {
  tier: ModelTier;
  model_id: string;
  winner_attempt_id?: string;
  confidence?: number;
  dimensions: Record<string, number>;
  rationale?: string;
  disqualified: boolean;
  disqualification_reason?: string;
}

interface DimensionAgreement {
  participating_models: number;
  agreement: number;
  wilson_95_ci: { lower: number; upper: number };
  small_sample_note: boolean;
  values: Record<string, number>;
}

interface SelectionConsensusSummary {
  winner_attempt_id?: string;
  agreed: boolean;
  agreement_ratio: number;
  consensus_threshold: number;
  votes_required: number;
  valid_votes: number;
  tier3_invoked: boolean;
  early_stopped: boolean;
  small_sample_note: boolean;
  per_dimension_agreement: Record<string, DimensionAgreement>;
  votes: SelectionConsensusVote[];
}

const CONSENSUS_DIMENSIONS = ['correctness', 'robustness', 'risk', 'cost_efficiency'];

/**
 * Selector & Merge Engine
 * 
 * Responsibilities:
 * - Select winner from scored attempts
 * - Support multiple selection strategies
 * - Merge outputs when appropriate
 * - Provide rationale for selection
 */
export class SelectorEngine {
  private defaultStrategy: SelectionStrategy;
  private llmClient: LLMClient;
  private multiModelConfig: MultiModelConfig;
  private lastConsensusSummary?: SelectionConsensusSummary;

  constructor(config: {
    defaultStrategy?: SelectionStrategy;
    llmClient?: LLMClient;
    multiModelConfig?: MultiModelConfig;
  } = {}) {
    this.defaultStrategy = config.defaultStrategy || 'highest_score';
    this.llmClient = config.llmClient ?? new LLMClient();
    this.multiModelConfig = config.multiModelConfig || {
      default_tier: 'tier1',
      escalation_enabled: true,
      escalation_triggers: {
        min_confidence: 0.7,
        min_quality_score: 0.5,
        max_ambiguity: 0.5,
      },
      consensus_threshold: 0.8,
      cost_budget_usd_per_hour: 20,
      allow_tier3: true,
    };
  }

  /**
   * Main entry point: select winner from scored attempts
   */
  async selectWinner(
    attempts: ScoredAttempt[],
    strategy?: SelectionStrategy
  ): Promise<SelectionResult> {
    if (attempts.length === 0) {
      throw new Error('No attempts to select from');
    }

    const selectedStrategy = strategy || this.defaultStrategy;

    switch (selectedStrategy) {
      case 'highest_score':
        return this.selectWithLLMJudgment(attempts);
      case 'component_substitution':
        return this.selectWithComponentSubstitution(attempts);
      case 'synthesized_merge':
        return this.selectWithSynthesizedMerge(attempts);
      default:
        return this.selectWithLLMJudgment(attempts);
    }
  }

  private async selectWithLLMJudgment(attempts: ScoredAttempt[]): Promise<SelectionResult> {
    const validAttempts = attempts.filter(
      a => a.status === 'completed' && a.scores.hard_gates_passed && a.deliverable
    );
    if (validAttempts.length === 0) {
      return this.selectHighestScore(attempts);
    }

    const prompt = this.buildSelectionPrompt(validAttempts);
    try {
      const consensus = await this.judgeSelectionWithConsensus(prompt, validAttempts);
      const winner = validAttempts.find(a => a.attempt_id === consensus.winner_attempt_id);
      if (!winner?.deliverable) {
        return this.selectHighestScore(attempts);
      }

      return {
        winner_attempt_id: winner.attempt_id,
        strategy_used: 'highest_score',
        selected_deliverable: winner.deliverable,
        rationale: consensus.votes.find(vote => vote.winner_attempt_id === winner.attempt_id)?.rationale
          || `Consensus selected attempt ${winner.attempt_id}`,
        confidence: this.clampConfidence(consensus.agreement_ratio, this.calculateConfidence(winner, validAttempts)),
      };
    } catch (error) {
      this.lastConsensusSummary = undefined;
      return this.selectHighestScore(attempts);
    }
  }

  private async judgeSelectionWithConsensus(
    prompt: string,
    attempts: ScoredAttempt[],
  ): Promise<SelectionConsensusSummary> {
    const votes: SelectionConsensusVote[] = [];
    let tier3Invoked = false;
    let earlyStopped = false;

    for (const tier of ['tier1', 'tier2'] as ModelTier[]) {
      votes.push(await this.collectSelectionVote(tier, prompt, attempts));
    }

    let consensus = this.evaluateSelectionConsensus(votes, attempts.length, false, false);
    if (consensus.agreed && consensus.winner_attempt_id) {
      earlyStopped = true;
    } else if (this.multiModelConfig.allow_tier3) {
      tier3Invoked = true;
      votes.push(await this.collectSelectionVote('tier3', prompt, attempts));
    }

    consensus = this.evaluateSelectionConsensus(votes, attempts.length, tier3Invoked, earlyStopped);
    this.lastConsensusSummary = consensus;

    if (!consensus.agreed || !consensus.winner_attempt_id) {
      throw new Error('Selection consensus failed');
    }

    return consensus;
  }

  private async collectSelectionVote(
    tier: ModelTier,
    prompt: string,
    attempts: ScoredAttempt[],
  ): Promise<SelectionConsensusVote> {
    const model = this.llmClient.getModelByTier(tier);
    try {
      const result = await this.llmClient.call(prompt, { model, temperature: 0.2 });
      const parsed = this.parseJsonObject(result.content);
      return this.normalizeSelectionVote(tier, result.model_id || model, parsed, attempts);
    } catch (error) {
      return {
        tier,
        model_id: model,
        dimensions: {},
        disqualified: true,
        disqualification_reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private normalizeSelectionVote(
    tier: ModelTier,
    modelId: string,
    parsed: any,
    attempts: ScoredAttempt[],
  ): SelectionConsensusVote {
    const winnerAttemptId = typeof parsed?.winner_attempt_id === 'string' ? parsed.winner_attempt_id : undefined;
    const dimensions = this.normalizeDimensions(parsed?.dimensions);
    const missingDimensions = CONSENSUS_DIMENSIONS.filter(dimension => dimensions[dimension] === undefined);
    const reasons: string[] = [];

    if (!winnerAttemptId || !attempts.some(attempt => attempt.attempt_id === winnerAttemptId)) {
      reasons.push('winner_attempt_id is missing or invalid');
    }
    if (missingDimensions.length > 0) {
      reasons.push(`missing dimensions: ${missingDimensions.join(', ')}`);
    }

    return {
      tier,
      model_id: modelId,
      winner_attempt_id: winnerAttemptId,
      confidence: this.clampConfidence(parsed?.confidence, 0),
      dimensions,
      rationale: typeof parsed?.rationale === 'string' ? parsed.rationale : undefined,
      disqualified: reasons.length > 0,
      disqualification_reason: reasons.join('; ') || undefined,
    };
  }

  private normalizeDimensions(value: any): Record<string, number> {
    const dimensions: Record<string, number> = {};
    if (!value || typeof value !== 'object') {
      return dimensions;
    }

    for (const dimension of CONSENSUS_DIMENSIONS) {
      const raw = Number(value[dimension]);
      if (Number.isFinite(raw)) {
        dimensions[dimension] = this.clampConfidence(raw, 0);
      }
    }

    return dimensions;
  }

  private parseJsonObject(content: string): any {
    try {
      return JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('LLM response did not contain JSON');
      }
      return JSON.parse(match[0]);
    }
  }

  private evaluateSelectionConsensus(
    votes: SelectionConsensusVote[],
    attemptCount: number,
    tier3Invoked: boolean,
    earlyStopped: boolean,
  ): SelectionConsensusSummary {
    const validVotes = votes.filter(vote => !vote.disqualified && vote.winner_attempt_id !== undefined);
    const counts = new Map<string, number>();
    for (const vote of validVotes) {
      counts.set(vote.winner_attempt_id!, (counts.get(vote.winner_attempt_id!) || 0) + 1);
    }

    let winnerAttemptId: string | undefined;
    let winningVotes = 0;
    for (const [candidate, count] of counts.entries()) {
      if (count > winningVotes) {
        winnerAttemptId = candidate;
        winningVotes = count;
      }
    }

    const agreementRatio = validVotes.length > 0 ? winningVotes / validVotes.length : 0;
    const votesRequired = validVotes.length >= 3 ? 2 : 2;
    const thresholdMet = agreementRatio >= Math.min(this.multiModelConfig.consensus_threshold, 2 / 3);

    return {
      winner_attempt_id: winnerAttemptId,
      agreed: winningVotes >= votesRequired && thresholdMet && winnerAttemptId !== undefined,
      agreement_ratio: agreementRatio,
      consensus_threshold: this.multiModelConfig.consensus_threshold,
      votes_required: votesRequired,
      valid_votes: validVotes.length,
      tier3_invoked: tier3Invoked,
      early_stopped: earlyStopped,
      small_sample_note: attemptCount < 30,
      per_dimension_agreement: this.calculateDimensionAgreement(validVotes),
      votes,
    };
  }

  private calculateDimensionAgreement(votes: SelectionConsensusVote[]): Record<string, DimensionAgreement> {
    const agreements: Record<string, DimensionAgreement> = {};
    const tolerance = 1 - this.multiModelConfig.consensus_threshold;

    for (const dimension of CONSENSUS_DIMENSIONS) {
      const values: number[] = [];
      const valuesByModel: Record<string, number> = {};
      for (const vote of votes) {
        const value = vote.dimensions[dimension];
        if (value !== undefined) {
          values.push(value);
          valuesByModel[vote.model_id] = value;
        }
      }

      if (values.length === 0) {
        agreements[dimension] = {
          participating_models: 0,
          agreement: 0,
          wilson_95_ci: this.wilson95(0, 0),
          small_sample_note: true,
          values: valuesByModel,
        };
        continue;
      }

      const sorted = [...values].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const agreeing = values.filter(value => Math.abs(value - median) <= tolerance).length;
      agreements[dimension] = {
        participating_models: values.length,
        agreement: agreeing / values.length,
        wilson_95_ci: this.wilson95(agreeing, values.length),
        small_sample_note: values.length < 30,
        values: valuesByModel,
      };
    }

    return agreements;
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
      lower: this.clampConfidence((center - margin) / denominator, 0),
      upper: this.clampConfidence((center + margin) / denominator, 0),
    };
  }

  private buildSelectionPrompt(attempts: ScoredAttempt[]): string {
    const summary = attempts.map(attempt => ({
      attempt_id: attempt.attempt_id,
      overall_score: attempt.scores.overall_score,
      hard_gates_passed: attempt.scores.hard_gates_passed,
      correctness: attempt.scores.correctness.score,
      robustness: attempt.scores.robustness.score,
      risk: attempt.scores.risk.score,
      cost_usd: attempt.cost.total_cost_usd,
      wall_time_ms: attempt.wall_time_ms,
      content_preview: attempt.deliverable?.content.slice(0, 1000),
      artifact_paths: attempt.deliverable?.artifacts.map(artifact => artifact.path) || [],
    }));

    return `Judge the best GOrchestrator attempt for production use.
You are one voter in a multi-model consensus. Return strict JSON only.
The dimensions object is required. Use scores from 0 to 1 for correctness, robustness, risk, and cost_efficiency.

Consider score, hard gates, correctness, robustness, risk, cost, latency, and deliverable quality.

${JSON.stringify(summary, null, 2)}

Return strict JSON:
{"winner_attempt_id": "uuid", "rationale": "brief reason", "confidence": 0.0, "dimensions": {"correctness": 0.0, "robustness": 0.0, "risk": 0.0, "cost_efficiency": 0.0}}`;
  }

  private clampConfidence(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.min(1, value))
      : fallback;
  }

  /**
   * Calculate weighted score using rubric dimensions
   */
  private calculateWeightedScore(attempt: ScoredAttempt): number {
    const scores = attempt.scores;
    
    // Use GMirror scores as proxies for orchestrator rubric dimensions
    const correctness = scores.correctness.score;
    const robustness = scores.robustness.score;
    const risk = 1 - scores.risk.score; // Invert risk (higher risk = lower score)
    
    // Cost efficiency: lower cost is better
    const costEfficiency = Math.max(0, 1 - (attempt.cost.total_cost_usd / 0.1)); // Assume $0.10 baseline
    
    // Latency: use trace total wall time (lower is better)
    const latencyScore = Math.max(0, 1 - (attempt.trace.total_wall_time_ms / 30000)); // Assume 30s baseline
    
    // Resource utilization: use cost as proxy (simplified)
    const resourceUtil = costEfficiency;
    
    // Calculate weighted score
    const weightedScore = 
      correctness * RUBRIC_WEIGHTS.correctness +
      latencyScore * RUBRIC_WEIGHTS.latency +
      robustness * RUBRIC_WEIGHTS.robustness +
      costEfficiency * RUBRIC_WEIGHTS.cost_efficiency +
      resourceUtil * RUBRIC_WEIGHTS.resource_utilization;
    
    return weightedScore;
  }

  /**
   * Select attempt with highest overall score
   */
  private selectHighestScore(attempts: ScoredAttempt[]): SelectionResult {
    // Filter to only completed attempts with passed hard gates
    const validAttempts = attempts.filter(
      a => a.status === 'completed' && a.scores.hard_gates_passed
    );

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
      selected_deliverable: winner.deliverable!,
      rationale,
      confidence: this.calculateConfidence(winner, sorted),
    };
  }

  /**
   * Select winner and substitute superior components from other attempts
   */
  private selectWithComponentSubstitution(attempts: ScoredAttempt[]): SelectionResult {
    const baseSelection = this.selectHighestScore(attempts);
    const winner = attempts.find(a => a.attempt_id === baseSelection.winner_attempt_id)!;
    
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
  private substituteComponents(
    base: ScoredAttempt,
    attempts: ScoredAttempt[]
  ): Deliverable {
    // For hackathon MVP, implement simple artifact substitution
    // In production, would analyze artifacts and substitute intelligently
    
    const otherAttempts = attempts.filter(a => a.attempt_id !== base.attempt_id);
    if (!base.deliverable || otherAttempts.length === 0) {
      return base.deliverable!;
    }

    const improvedArtifacts = [...(base.deliverable.artifacts || [])];

    for (const other of otherAttempts) {
      if (!other.deliverable?.artifacts) continue;

      // Find artifacts with same path but better scores
      for (const artifact of other.deliverable.artifacts) {
        const existingIndex = improvedArtifacts.findIndex(a => a.path === artifact.path);
        if (existingIndex >= 0) {
          // Compare scores and substitute if other is better
          if (other.scores.correctness.score > base.scores.correctness.score) {
            improvedArtifacts[existingIndex] = artifact;
          }
        } else {
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
  private selectWithSynthesizedMerge(attempts: ScoredAttempt[]): SelectionResult {
    // For hackathon MVP, fall back to component substitution
    // In production, would use LLM to synthesize new output
    return this.selectWithComponentSubstitution(attempts);
  }

  /**
   * Calculate confidence in selection
   */
  private calculateConfidence(winner: ScoredAttempt, sorted: ScoredAttempt[]): number {
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
  getSelectionStats(attempts: ScoredAttempt[]): {
    totalAttempts: number;
    completedAttempts: number;
    passedHardGates: number;
    averageScore: number;
    scoreRange: { min: number; max: number };
    scoreStdDev: number;
  } {
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

  getLastConsensusSummary(): SelectionConsensusSummary | undefined {
    return this.lastConsensusSummary;
  }
}
