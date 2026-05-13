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

function makeScoredAttempt(id: string, overallScore: number, hardGatesPassed = true): ScoredAttempt {
  return {
    attempt_id: id,
    task_id: 'task-1',
    config_id: `config-${id}`,
    sandbox_id: `sandbox-${id}`,
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
    const result = engine.selectWinner([
      makeScoredAttempt('low', 0.4),
      makeScoredAttempt('high', 0.9),
      makeScoredAttempt('mid', 0.6),
    ]);
    expect(result.winner_attempt_id).toBe('high');
    expect(result.strategy_used).toBe('highest_score');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('selectWinner prefers attempt that passed hard gates', () => {
    const result = engine.selectWinner([
      makeScoredAttempt('failed-gates', 0.95, false),
      makeScoredAttempt('passed-gates', 0.7, true),
    ]);
    expect(result.winner_attempt_id).toBe('passed-gates');
  });

  it('selectWinner with component_substitution returns a valid result', () => {
    const result = engine.selectWinner(
      [makeScoredAttempt('a', 0.8), makeScoredAttempt('b', 0.6)],
      'component_substitution'
    );
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
