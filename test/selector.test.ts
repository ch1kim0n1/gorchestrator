// gorchestrator/test/selector.test.ts
import { SelectorEngine } from '../src/core/selector.js';
import { ScoredAttempt, Deliverable } from '../src/types/index.js';

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

describe('SelectorEngine', () => {
  let engine: SelectorEngine;

  beforeEach(() => {
    engine = new SelectorEngine();
  });

  it('selectWinner throws when no attempts provided', () => {
    expect(() => engine.selectWinner([])).toThrow('No attempts to select from');
  });

  it('selectWinner (highest_score) picks the attempt with the highest overall_score', () => {
    const low = makeScoredAttempt('low', 0.4);
    const high = makeScoredAttempt('high', 0.9);
    const mid = makeScoredAttempt('mid', 0.6);
    const result = engine.selectWinner([low, high, mid]);
    expect(result.winner_attempt_id).toBe(high.attempt_id);
    expect(result.strategy_used).toBe('highest_score');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('selectWinner prefers attempt that passed hard gates', () => {
    const failedGates = makeScoredAttempt('failed-gates', 0.95, false);
    const passedGates = makeScoredAttempt('passed-gates', 0.7, true);
    const result = engine.selectWinner([failedGates, passedGates]);
    expect(result.winner_attempt_id).toBe(passedGates.attempt_id);
  });

  it('selectWinner with component_substitution returns a valid result', () => {
    const a = makeScoredAttempt('a', 0.8);
    const b = makeScoredAttempt('b', 0.6);
    const result = engine.selectWinner([a, b], 'component_substitution');
    expect(result.winner_attempt_id).toBeDefined();
    expect(result.strategy_used).toBe('component_substitution');
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
