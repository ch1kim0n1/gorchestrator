// gorchestrator/test/selector.test.ts
import { SelectorEngine } from '../src/core/selector.js';
import { ScoredAttempt, Deliverable } from '../src/types/index.js';
import { LLMClient } from '../src/core/llm-client.js';

function makeDeliverable(): Deliverable {
  return {
    type: 'code',
    content: 'const x = 1;',
    artifacts: [{ path: '/workspace/out.ts', content: 'const x = 1;', hash: 'abc' }],
  };
}

function idToUuid(label: string): string {
  const hex = Buffer.from(label).toString('hex').padEnd(12, '0').slice(0, 12);
  return `00000000-0000-0000-0000-${hex}`;
}

function makeScoredAttempt(id: string, overallScore: number, hardGatesPassed = true): ScoredAttempt {
  const attemptUuid = idToUuid(id);
  return {
    attempt_id: attemptUuid,
    task_id: '00000000-0000-0000-0000-000000000001',
    config_id: '00000000-0000-0000-0000-000000000002',
    sandbox_id: '00000000-0000-0000-0000-000000000003',
    status: 'completed',
    deliverable: makeDeliverable(),
    trace: { events: [], total_cost_usd: 0.01, total_tokens: 1000, total_wall_time_ms: 2000 },
    cost: { model_cost_usd: 0.008, tool_cost_usd: 0.001, sandbox_cost_usd: 0.001, total_cost_usd: 0.01 },
    wall_time_ms: 2000,
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString(),
    scores: {
      correctness: { score: overallScore, confidence: 0.9, evidence: [] },
      user_outcome: { score: overallScore * 0.9, confidence: 0.8, evidence: [] },
      robustness: { score: 0.8, confidence: 0.7, evidence: [] },
      risk: { score: 0.1, confidence: 0.9, evidence: [] },
      overall_score: overallScore,
      hard_gates_passed: hardGatesPassed,
    },
    selected: false,
  };
}

function selectionVote(winnerAttemptId: string, dimensions?: Record<string, number>) {
  return JSON.stringify({
    winner_attempt_id: winnerAttemptId,
    rationale: 'Consensus vote rationale',
    confidence: 0.8,
    dimensions: dimensions || {
      correctness: 0.8,
      robustness: 0.8,
      risk: 0.2,
      cost_efficiency: 0.7,
    },
  });
}

function makeConsensusEngine(responses: string[]) {
  const modelsByTier = {
    tier1: 'claude-haiku-4-5-20251001',
    tier2: 'claude-sonnet-4-6',
    tier3: 'claude-opus-4-7',
  };
  const calls: string[] = [];
  const fakeClient = {
    call: jest.fn(async (_prompt: string, options: { model?: string }) => {
      const content = responses[calls.length];
      calls.push(options.model || '');
      return {
        content,
        input_tokens: 80,
        output_tokens: 20,
        cost_usd: 0.001,
        model_id: options.model,
        latency_ms: 1,
      };
    }),
    getModelByTier: jest.fn((tier: keyof typeof modelsByTier) => modelsByTier[tier]),
  } as unknown as LLMClient;

  return { engine: new SelectorEngine({ llmClient: fakeClient }), calls };
}

describe('SelectorEngine', () => {
  let engine: SelectorEngine;

  beforeEach(() => {
    engine = new SelectorEngine();
  });

  it('selectWinner throws when no attempts provided', async () => {
    await expect(engine.selectWinner([])).rejects.toThrow('No attempts to select from');
  });

  it('selectWinner (highest_score) picks the attempt with the highest overall_score', async () => {
    const low = makeScoredAttempt('low', 0.4);
    const high = makeScoredAttempt('high', 0.9);
    const mid = makeScoredAttempt('mid', 0.6);
    const result = await engine.selectWinner([low, high, mid]);
    expect(result.winner_attempt_id).toBe(high.attempt_id);
    expect(result.strategy_used).toBe('highest_score');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('selectWinner prefers attempt that passed hard gates', async () => {
    const failedGates = makeScoredAttempt('failed-gates', 0.95, false);
    const passedGates = makeScoredAttempt('passed-gates', 0.7, true);
    const result = await engine.selectWinner([failedGates, passedGates]);
    expect(result.winner_attempt_id).toBe(passedGates.attempt_id);
  });

  it('selectWinner with component_substitution returns a valid result', async () => {
    const a = makeScoredAttempt('a', 0.8);
    const b = makeScoredAttempt('b', 0.6);
    const result = await engine.selectWinner([a, b], 'component_substitution');
    expect(result.winner_attempt_id).toBeDefined();
    expect(result.strategy_used).toBe('component_substitution');
  });

  it('uses LLM judgment to select among valid attempts', async () => {
    const low = makeScoredAttempt('low', 0.4);
    const high = makeScoredAttempt('high', 0.9);
    const call = jest.fn().mockResolvedValue({
      content: JSON.stringify({
        winner_attempt_id: low.attempt_id,
        rationale: 'Lower score has a more complete deliverable for the requested task.',
        confidence: 0.74,
        dimensions: {
          correctness: 0.8,
          robustness: 0.8,
          risk: 0.2,
          cost_efficiency: 0.7,
        },
      }),
      input_tokens: 80,
      output_tokens: 20,
      cost_usd: 0.001,
      model_id: 'claude-sonnet-4-6',
      latency_ms: 1,
    });
    const fakeClient = {
      call,
      getModelByTier: jest.fn().mockReturnValue('claude-sonnet-4-6'),
    } as unknown as LLMClient;
    const llmEngine = new SelectorEngine({ llmClient: fakeClient });

    const result = await llmEngine.selectWinner([low, high]);

    expect(call).toHaveBeenCalledTimes(2);
    expect(result.winner_attempt_id).toBe(low.attempt_id);
    expect(result.rationale).toContain('more complete deliverable');
    expect(result.confidence).toBe(1);
  });

  it('invokes tier3 when tier1 and tier2 disagree', async () => {
    const low = makeScoredAttempt('low', 0.4);
    const high = makeScoredAttempt('high', 0.9);
    const { engine: consensusEngine, calls } = makeConsensusEngine([
      selectionVote(low.attempt_id),
      selectionVote(high.attempt_id),
      selectionVote(low.attempt_id),
    ]);

    const result = await consensusEngine.selectWinner([low, high]);
    const consensus = consensusEngine.getLastConsensusSummary();

    expect(result.winner_attempt_id).toBe(low.attempt_id);
    expect(calls).toEqual(['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-7']);
    expect(consensus?.tier3_invoked).toBe(true);
    expect(consensus?.agreement_ratio).toBeCloseTo(2 / 3);
    expect(consensus?.per_dimension_agreement.correctness.wilson_95_ci.lower).toBeGreaterThanOrEqual(0);
    expect(consensus?.small_sample_note).toBe(true);
  });

  it('disqualifies model votes with missing dimensions', async () => {
    const low = makeScoredAttempt('low', 0.4);
    const high = makeScoredAttempt('high', 0.9);
    const { engine: consensusEngine } = makeConsensusEngine([
      selectionVote(low.attempt_id, { correctness: 0.8, robustness: 0.8, risk: 0.2 }),
      selectionVote(high.attempt_id),
      selectionVote(high.attempt_id),
    ]);

    const result = await consensusEngine.selectWinner([low, high]);
    const consensus = consensusEngine.getLastConsensusSummary();

    expect(result.winner_attempt_id).toBe(high.attempt_id);
    expect(consensus?.votes[0].disqualified).toBe(true);
    expect(consensus?.votes[0].disqualification_reason).toContain('missing dimensions: cost_efficiency');
    expect(consensus?.valid_votes).toBe(2);
  });

  it('getSelectionStats calculates average score correctly', () => {
    const stats = engine.getSelectionStats([
      makeScoredAttempt('a', 0.8),
      makeScoredAttempt('b', 0.4),
    ]);
    expect(stats.totalAttempts).toBe(2);
    expect(stats.completedAttempts).toBe(2);
    expect(stats.averageScore).toBeCloseTo(0.6, 1);
  });

  it('getSelectionStats stdDev is 0 when all scores are equal', () => {
    const stats = engine.getSelectionStats([
      makeScoredAttempt('a', 0.7),
      makeScoredAttempt('b', 0.7),
    ]);
    expect(stats.scoreStdDev).toBeCloseTo(0, 5);
  });
});
