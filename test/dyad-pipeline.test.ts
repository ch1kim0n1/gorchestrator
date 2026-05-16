import { DetectorPool } from '../src/core/detector-pool.js';
import { DyadPipeline } from '../src/core/dyad-pipeline.js';
import {
  DetectorName,
  DetectorOutput,
  RelationshipAnalysisTask,
  RelationshipAnalysisTaskSchema,
} from '../src/types/index.js';

const detectors: DetectorName[] = [
  'emotion_labeling',
  'bid_classification',
  'repair_detection',
  'labor_asymmetry',
  'phantom_third_party',
  'predictive_divergence',
];

describe('DYAD relationship pipeline', () => {
  it('validates RelationshipAnalysisTask payloads', () => {
    expect(RelationshipAnalysisTaskSchema.parse(makeTask()).dyad_id).toBe(makeTask().dyad_id);

    const invalid = { ...makeTask() } as any;
    delete invalid.dyad_id;
    expect(() => RelationshipAnalysisTaskSchema.parse(invalid)).toThrow();
  });

  it('runs all six detectors in parallel through the DetectorPool', async () => {
    const call = jest.fn(async (_prompt: string, options: any) => ({
      content: JSON.stringify({ result: { ok: true }, confidence: 0.9 }),
      input_tokens: 10,
      output_tokens: 10,
      model_id: options.model,
      cost_usd: 0.01,
      latency_ms: 5,
    }));
    const pool = new DetectorPool({ call }, {
      tier1_model: 'tier1-model',
      tier2_model: 'tier2-model',
      consensus_threshold: 0.7,
    });

    const outputs = await pool.runDetectors(makeTask(), detectors);

    expect(outputs).toHaveLength(6);
    expect(new Set(outputs.map(output => output.detector))).toEqual(new Set(detectors));
    expect(call).toHaveBeenCalledTimes(6);
    expect(call.mock.calls.every(callArgs => callArgs[1].model === 'tier1-model')).toBe(true);
  });

  it('escalates low-confidence detector results to tier 2', async () => {
    const call = jest.fn(async (_prompt: string, options: any) => ({
      content: JSON.stringify({
        result: { model: options.model },
        confidence: options.model === 'tier1-model' ? 0.4 : 0.86,
      }),
      input_tokens: 10,
      output_tokens: 10,
      model_id: options.model,
      cost_usd: 0.01,
      latency_ms: 5,
    }));
    const pool = new DetectorPool({ call }, {
      tier1_model: 'tier1-model',
      tier2_model: 'tier2-model',
      consensus_threshold: 0.7,
    });

    const outputs = await pool.runDetectors(makeTask({ detectors: ['emotion_labeling'] }), ['emotion_labeling']);

    expect(outputs).toHaveLength(1);
    expect(outputs[0].model_used).toBe('tier2-model');
    expect(call.mock.calls.map(callArgs => callArgs[1].model)).toEqual(['tier1-model', 'tier2-model']);
  });

  it('returns partial detector results when the cost budget is exhausted', async () => {
    const call = jest.fn(async (_prompt: string, options: any) => ({
      content: JSON.stringify({ result: { ok: true }, confidence: 0.9 }),
      input_tokens: 10,
      output_tokens: 10,
      model_id: options.model,
      cost_usd: 0.2,
      latency_ms: 5,
    }));
    const pool = new DetectorPool({ call }, {
      tier1_model: 'tier1-model',
      tier2_model: 'tier2-model',
      consensus_threshold: 0.7,
    });

    const outputs = await pool.runDetectors(makeTask({ budget: { max_cost_usd: 0.5, max_latency_ms: 60_000 } }), detectors);

    expect(outputs.length).toBeLessThan(detectors.length);
    expect(outputs.reduce((sum, output) => sum + output.cost_usd, 0)).toBeLessThanOrEqual(0.5);
  });

  it('refuses before detector execution when GToM reports high relational risk', async () => {
    const runDetectors = jest.fn();
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ aggregate_risk: 0.92, reason: 'coercive_pattern' }),
    } as Response));
    const pipeline = makePipeline({ runDetectors, fetchImpl });

    const result = await pipeline.run(makeTask());

    expect(result.verdict).toBe('refused');
    expect(result.detector_outputs).toEqual([]);
    expect(runDetectors).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('routes low-risk detector output to GMirror score-insight with dyad scoring mode', async () => {
    const detectorOutput = makeDetectorOutput('bid_classification', 0.82);
    const runDetectors = jest.fn(async () => [detectorOutput]);
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/gtom/predict-relational-conflicts')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ aggregate_risk: 0.2, conflicts: [] }),
        } as Response;
      }
      expect(url).toContain('/gmirror/score-insight');
      const body = JSON.parse(String(init?.body));
      expect(body.dyad_id).toBe(makeTask().dyad_id);
      expect(body.scoring_mode).toBe('dyad_insight');
      expect(body.insight_type).toBe('bid_classification');
      return {
        ok: true,
        status: 200,
        json: async () => ({ overall: 'pass', score: 0.88, scoring_mode: 'dyad_insight' }),
      } as Response;
    });
    const pipeline = makePipeline({ runDetectors, fetchImpl });

    const result = await pipeline.run(makeTask());

    expect(result.verdict).toBe('pass');
    expect(result.detector_outputs).toEqual([detectorOutput]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('uses a local fail score and skips GMirror when a detector requests refusal', async () => {
    const runDetectors = jest.fn(async () => [
      makeDetectorOutput('emotion_labeling', 0.93, { should_refuse: true }),
    ]);
    const fetchImpl = jest.fn(async (url: string) => {
      expect(url).toContain('/gtom/predict-relational-conflicts');
      return {
        ok: true,
        status: 200,
        json: async () => ({ aggregate_risk: 0.1, conflicts: [] }),
      } as Response;
    });
    const pipeline = makePipeline({ runDetectors, fetchImpl });

    const result = await pipeline.run(makeTask());

    expect(result.verdict).toBe('fail');
    expect(result.scoring_result.scoring_mode).toBe('dyad_insight');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('allows detector execution when the GToM pre-check fails closed to unavailable', async () => {
    const logger = { warn: jest.fn() };
    const runDetectors = jest.fn(async () => [makeDetectorOutput('repair_detection', 0.78)]);
    const fetchImpl = jest.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ overall: 'pass', score: 0.75, scoring_mode: 'dyad_insight' }),
      } as Response);
    const pipeline = makePipeline({ runDetectors, fetchImpl, logger });

    const result = await pipeline.run(makeTask());

    expect(result.verdict).toBe('pass');
    expect(runDetectors).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'GToM relational conflict check failed; allowing detector execution',
      expect.objectContaining({ error: 'timeout' }),
    );
  });
});

function makeTask(overrides: Partial<RelationshipAnalysisTask> = {}): RelationshipAnalysisTask {
  return {
    task_type: 'relationship_analysis',
    dyad_id: '0123456789abcdef0123456789abcdef',
    message_window: [
      {
        message_id: 'm1',
        participant: 'a',
        text: 'I felt alone when dinner plans changed.',
        timestamp: '2026-05-16T10:00:00.000Z',
      },
      {
        message_id: 'm2',
        participant: 'b',
        text: 'I can see why that hurt. Can we try again tonight?',
        timestamp: '2026-05-16T10:02:00.000Z',
      },
    ],
    detectors,
    time_range: {
      start: '2026-05-16T10:00:00.000Z',
      end: '2026-05-16T10:05:00.000Z',
    },
    budget: {
      max_cost_usd: 1,
      max_latency_ms: 60_000,
    },
    ...overrides,
  };
}

function makeDetectorOutput(
  detector: DetectorName,
  confidence: number,
  result: Record<string, unknown> = { label: 'toward' },
): DetectorOutput {
  return {
    detector,
    dyad_id: makeTask().dyad_id,
    result,
    confidence,
    model_used: 'tier1-model',
    cost_usd: 0.01,
    latency_ms: 10,
  };
}

function makePipeline(args: {
  runDetectors: jest.Mock;
  fetchImpl: jest.Mock;
  logger?: { warn: jest.Mock };
}): DyadPipeline {
  return new DyadPipeline({
    detectorPool: { runDetectors: args.runDetectors } as unknown as DetectorPool,
    gtomEndpoint: 'http://gtom.local',
    gmirrorEndpoint: 'http://gmirror.local',
    fetchImpl: args.fetchImpl as unknown as typeof fetch,
    logger: args.logger,
  });
}
