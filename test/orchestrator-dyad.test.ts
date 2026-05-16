import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GOrchestrator } from '../src/core/orchestrator.js';
import {
  DetectorOutput,
  DyadPipelineResult,
  RelationshipAnalysisTask,
} from '../src/types/index.js';

describe('GOrchestrator DYAD routing and persistence', () => {
  const originalCwd = process.cwd();
  let tmpDir: string;
  let orchestrator: GOrchestrator;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gorchestrator-dyad-'));
    process.chdir(tmpDir);
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as Response));
    orchestrator = new GOrchestrator({
      gbrainMaxRetries: 0,
      gbrainCircuitBreakerFailureThreshold: 1,
      gbrainCircuitBreakerCooldownMs: 1,
      maxConcurrency: 1,
    });
  });

  afterEach(() => {
    (orchestrator as any).persistence.close();
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('routes relationship_analysis tasks through the DyadPipeline', async () => {
    const result = makeResult();
    const pipelineRun = jest.fn(async () => result);
    (orchestrator as any).createDyadPipeline = () => ({ run: pipelineRun });
    (orchestrator as any).storeReceiptInGBrain = jest.fn(async () => undefined);

    const output = await orchestrator.runTask(makeTask());

    expect(output).toEqual(result);
    expect(pipelineRun).toHaveBeenCalledWith(makeTask());
    expect((orchestrator as any).storeReceiptInGBrain).toHaveBeenCalledWith(makeTask(), result);
  });

  it('rejects malformed relationship_analysis tasks before pipeline execution', async () => {
    const invalid = { ...makeTask() } as any;
    delete invalid.dyad_id;
    const pipelineRun = jest.fn();
    (orchestrator as any).createDyadPipeline = () => ({ run: pipelineRun });

    await expect(orchestrator.runTask(invalid)).rejects.toThrow();
    expect(pipelineRun).not.toHaveBeenCalled();
  });

  it('does not classify non-relationship task_type values as DYAD tasks', () => {
    expect((orchestrator as any).isRelationshipAnalysisTask({
      task_type: 'other',
      description: 'regular developer task',
    })).toBe(false);
  });

  it('stores DYAD results in GBrain as page_kind dyad after redacting direct contact PII', async () => {
    const createPage = jest.fn(async () => ({ page_id: 'page-1' }));
    (orchestrator as any).gbrainClient = {
      createPage,
      getCircuitState: () => ({ open: false, consecutiveFailures: 0 }),
    };
    const result = makeResult({
      detector_outputs: [
        makeDetectorOutput({
          result: {
            evidence: 'Text me at 555-123-4567 or alex@example.com.',
          },
        }),
      ],
    });

    await (orchestrator as any).storeReceiptInGBrain(makeTask(), result);

    expect(createPage).toHaveBeenCalledWith(expect.objectContaining({
      title: `DYAD result: ${makeTask().dyad_id}`,
      page_kind: 'dyad',
      tags: ['relationship', makeTask().dyad_id],
    }));
    const content = createPage.mock.calls[0][0].content;
    expect(content).toContain('[PHONE]');
    expect(content).toContain('[EMAIL]');
    expect(content).not.toContain('555-123-4567');
    expect(content).not.toContain('alex@example.com');
  });

  it('skips GBrain persistence when dyad_id is not a hash', async () => {
    const createPage = jest.fn();
    const error = jest.fn();
    (orchestrator as any).gbrainClient = {
      createPage,
      getCircuitState: () => ({ open: false, consecutiveFailures: 0 }),
    };
    (orchestrator as any).logger = {
      ...(orchestrator as any).logger,
      error,
    };

    await (orchestrator as any).storeReceiptInGBrain({
      ...makeTask(),
      dyad_id: 'alex@example.com',
    }, makeResult({ dyad_id: 'alex@example.com' }));

    expect(createPage).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      'Skipping DYAD GBrain persistence because dyad_id is not a hash',
      { dyad_id: 'alex@example.com' },
    );
  });

  it('records rolling success rate drift without dividing by zero', () => {
    const record = jest.fn();
    const logDecision = jest.fn();
    (orchestrator as any).driftDetector = { record };
    (orchestrator as any).auditLogger = {
      ...(orchestrator as any).auditLogger,
      logDecision,
    };
    (orchestrator as any).successRateHistory = [];

    expect(orchestrator.getDriftHistory()).toEqual([]);

    for (let index = 0; index < 10; index++) {
      (orchestrator as any).recordTaskSuccessMetric(1);
    }
    for (let index = 0; index < 10; index++) {
      (orchestrator as any).recordTaskSuccessMetric(0);
    }

    expect(record).toHaveBeenLastCalledWith('task_success_rate', 0.5);
    expect(logDecision).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'task_success_rate_drift',
      decision: 'alert',
    }));
  });

  it('records DYAD detector confidence drift per dyad', () => {
    const record = jest.fn();
    const logDecision = jest.fn();
    (orchestrator as any).driftDetector = { record };
    (orchestrator as any).auditLogger = {
      ...(orchestrator as any).auditLogger,
      logDecision,
    };
    (orchestrator as any).successRateHistory = [];

    (orchestrator as any).recordTaskSuccessMetric(1, makeResult({
      detector_outputs: [makeDetectorOutput({ confidence: 0.9 })],
    }));
    (orchestrator as any).recordTaskSuccessMetric(1, makeResult({
      detector_outputs: [makeDetectorOutput({ confidence: 0.6 })],
    }));

    const metric = `detector_confidence:${makeTask().dyad_id}`;
    expect(record).toHaveBeenCalledWith(metric, 0.9);
    expect(record).toHaveBeenCalledWith(metric, 0.6);
    expect(orchestrator.getDriftHistory(metric)).toEqual([
      expect.objectContaining({ value: 0.9, drift_detected: false }),
      expect.objectContaining({ value: 0.6, drift_detected: true }),
    ]);
    expect(logDecision).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'detector_confidence_drift',
      decision: 'alert',
    }));
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
        text: 'I felt alone when plans changed.',
        timestamp: '2026-05-16T10:00:00.000Z',
      },
      {
        message_id: 'm2',
        participant: 'b',
        text: 'That makes sense. Can we reset tonight?',
        timestamp: '2026-05-16T10:02:00.000Z',
      },
    ],
    detectors: ['emotion_labeling', 'bid_classification'],
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

function makeResult(overrides: Partial<DyadPipelineResult> = {}): DyadPipelineResult {
  return {
    dyad_id: makeTask().dyad_id,
    detector_outputs: [makeDetectorOutput()],
    scoring_result: {
      overall: 'pass',
      score: 0.84,
      confidence: 0.8,
      scoring_mode: 'dyad_insight',
    },
    gtom_risk: 0.2,
    verdict: 'pass',
    cost_usd: 0.01,
    latency_ms: 20,
    ...overrides,
  };
}

function makeDetectorOutput(overrides: Partial<DetectorOutput> = {}): DetectorOutput {
  return {
    detector: 'emotion_labeling',
    dyad_id: makeTask().dyad_id,
    result: { label: 'hurt' },
    confidence: 0.82,
    model_used: 'tier1-model',
    cost_usd: 0.01,
    latency_ms: 10,
    ...overrides,
  };
}
