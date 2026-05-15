import { analyzeCohortDrift, deterministicSample, parseWindowDuration } from '../src/core/drift-analysis.js';

const now = new Date('2026-05-15T12:00:00.000Z');

function snapshot(cohort: string, daysAgo: number, metrics: Record<string, number>, frustrated = false) {
  return {
    cohort,
    timestamp: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    count: metrics.count ?? 1,
    total: 1,
    frustrated,
    metrics,
  };
}

describe('cohort drift analysis', () => {
  it('parses duration windows for the drift CLI', () => {
    expect(parseWindowDuration('7d')).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseWindowDuration('24h')).toBe(24 * 60 * 60 * 1000);
    expect(() => parseWindowDuration('seven')).toThrow();
  });

  it('uses deterministic sampling with lexicographic tie-breaking', () => {
    const items = ['b', 'a', 'c'];
    expect(deterministicSample(items, 10, item => item)).toEqual(['a', 'b', 'c']);
    expect(deterministicSample(items, 2, item => item, 'seed')).toEqual(
      deterministicSample([...items].reverse(), 2, item => item, 'seed'),
    );
  });

  it('detects per-cohort anomalies with zero-stddev fallback', () => {
    const snapshots = [
      snapshot('enterprise', 14, { count: 2, latency_ms: 100 }),
      snapshot('enterprise', 13, { count: 2, latency_ms: 100 }),
      snapshot('enterprise', 12, { count: 2, latency_ms: 100 }),
      snapshot('enterprise', 2, { count: 4, latency_ms: 130 }),
      snapshot('enterprise', 1, { count: 4, latency_ms: 130 }),
    ];

    const [result] = analyzeCohortDrift(snapshots, {
      windowMs: parseWindowDuration('7d'),
      minSamples: 2,
      now,
    });

    expect(result.cohort).toBe('enterprise');
    expect(result.anomalies.map(anomaly => anomaly.reason)).toContain('zero_stddev_fallback');
  });

  it('flags brand-new cohort count anomalies and exposes Wilson frustration intervals', () => {
    const snapshots = [
      snapshot('new-cohort', 2, { count: 3, latency_ms: 100 }, true),
      snapshot('new-cohort', 1, { count: 3, latency_ms: 110 }, true),
      snapshot('stable', 14, { count: 1 }, false),
      snapshot('stable', 13, { count: 1 }, false),
      snapshot('stable', 2, { count: 1 }, true),
      snapshot('stable', 1, { count: 1 }, true),
    ];

    const results = analyzeCohortDrift(snapshots, {
      windowMs: parseWindowDuration('7d'),
      minSamples: 2,
      now,
    });

    const brandNew = results.find(result => result.cohort === 'new-cohort');
    const stable = results.find(result => result.cohort === 'stable');

    expect(brandNew?.brand_new).toBe(true);
    expect(brandNew?.anomalies.map(anomaly => anomaly.reason)).toContain('new_cohort_count');
    expect(stable?.frustration_wilson_95_ci.current.lower).toBeGreaterThanOrEqual(0);
  });
});
