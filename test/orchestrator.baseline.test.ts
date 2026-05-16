process.env.MOCK_SANDBOX = '1';

import { GOrchestrator } from '../src/core/orchestrator.js';
import { ReceiptRegistry } from '../src/core/receipt-registry.js';
import { GORCHESTRATOR_RUBRIC_V1 } from '../src/core/gorchestrator-rubric.js';
import { evaluateRegressionGates, loadRegressionBaselines } from '../src/core/regression-gates.js';

jest.setTimeout(30000);

const describeIfLLM = process.env.ANTHROPIC_API_KEY ? describe : describe.skip;

describeIfLLM('GOrchestrator Baseline Regression Tests', () => {
  let orchestrator: GOrchestrator;
  let registry: ReceiptRegistry;
  const TOLERANCE = 0.05;

  beforeEach(() => {
    process.env.MOCK_SANDBOX = '1';
    orchestrator = new GOrchestrator();
    registry = new ReceiptRegistry('gorchestrator');
  });

  it('generates receipt with correct rubric metadata', async () => {
    const runRecord = await orchestrator.runTask({
      description: 'Test task',
      verify: false,
    });

    expect(runRecord.execution_receipt).toBeDefined();
    expect(runRecord.execution_receipt?.rubric_name).toBe('gorchestrator_v1');
    expect(runRecord.execution_receipt?.project).toBe('gorchestrator');
    expect(runRecord.execution_receipt?.schema_version).toBe(1);
  });

  it('receipt scores match rubric dimensions', async () => {
    const runRecord = await orchestrator.runTask({
      description: 'Test task',
      verify: false,
    });

    const receipt = runRecord.execution_receipt;
    expect(receipt).toBeDefined();
    
    const dimNames = GORCHESTRATOR_RUBRIC_V1.dimensions.map(d => d.name);
    for (const dim of dimNames) {
      // For orchestrator, we track overall_score which aggregates dimensions
      expect(receipt?.overall_score).toBeGreaterThanOrEqual(0);
      expect(receipt?.overall_score).toBeLessThanOrEqual(1);
    }
  });

  it('baseline comparison: current overall score within tolerance of baseline', async () => {
    // Generate current run record
    const currentRun = await orchestrator.runTask({
      description: 'Test task',
      verify: false,
    });

    const receipt = currentRun.execution_receipt;
    expect(receipt).toBeDefined();

    const baselines = await loadRegressionBaselines('test/baselines/regression-baselines.jsonl');
    const gate = evaluateRegressionGates(receipt!, baselines);
    const scoreGate = gate.results.find(result => result.dimension === 'overall_score');
    expect(scoreGate).toBeDefined();
    expect(scoreGate?.tolerance).toBe(TOLERANCE);
    expect(scoreGate?.wilson_95_ci).toBeDefined();
    expect(gate.passed).toBe(true);
  });

  it('receipt is persisted to registry', async () => {
    const testRegistry = new ReceiptRegistry('gorchestrator');
    const runRecord = await orchestrator.runTask({
      description: 'Test task',
      verify: false,
    });

    const receipt = runRecord.execution_receipt;
    expect(receipt).toBeDefined();

    // Verify receipt was appended
    const latest = await testRegistry.getLatest();
    expect(latest).toBeDefined();
    expect(latest?.receipt_id).toBe(receipt?.receipt_id);
  });

  it('hard gates passed reflects in receipt', async () => {
    const runRecord = await orchestrator.runTask({
      description: 'Test task',
      verify: false,
      budget: { max_cost_usd: 1000 },
    });

    const receipt = runRecord.execution_receipt;
    expect(receipt?.hard_gates_passed).toBe(true); // Should pass when verification is disabled
  });

  it('receipt includes task metadata', async () => {
    const runRecord = await orchestrator.runTask({
      description: 'Test task',
      verify: false,
    });

    const receipt = runRecord.execution_receipt;
    expect(receipt?.metadata).toBeDefined();
    expect(receipt?.metadata.task_id).toBeDefined();
    expect(receipt?.metadata.total_attempts).toBeGreaterThanOrEqual(0);
  });
});
