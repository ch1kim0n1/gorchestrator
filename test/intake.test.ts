// gorchestrator/test/intake.test.ts
import { IntakePrimer } from '../src/core/intake.js';

global.fetch = jest.fn().mockRejectedValue(new Error('Network unavailable'));

describe('IntakePrimer', () => {
  let primer: IntakePrimer;

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network unavailable'));
    primer = new IntakePrimer({
      gbrainEndpoint: 'http://localhost:3000',
      primingTimeoutMs: 100,
      gbrainMaxRetries: 0,
      gbrainCircuitBreakerFailureThreshold: 99,
    });
  });

  it('intakeTask returns a TaskBundle with required fields', async () => {
    const bundle = await primer.intakeTask({
      description: 'Build a REST API in TypeScript',
      taskType: 'code_generation',
    });
    expect(bundle.task_id).toBeDefined();
    expect(bundle.raw_description).toBe('Build a REST API in TypeScript');
    expect(bundle.signature).toBeDefined();
    expect(bundle.signature.hash).toBeDefined();
    expect(bundle.priors).toBeDefined();
    expect(bundle.budget).toBeDefined();
    expect(bundle.created_at).toBeDefined();
  });

  it('intakeTask proceeds with empty priors when GBrain is unreachable', async () => {
    const bundle = await primer.intakeTask({
      description: 'Simple task with no GBrain connection',
    });
    expect(bundle.priors.similar_tasks).toEqual([]);
    expect(bundle.priors.winning_configs).toEqual([]);
    expect(bundle.priors.known_failure_modes).toEqual([]);
  });

  it('intakeTask uses validated priors returned by GBrain', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        similar_tasks: [],
        winning_configs: [],
        known_failure_modes: [{ pattern: 'missing tests', frequency: 3, severity: 'medium' }],
        recommended_n: 7,
        user_preferences: { reviewer: 'strict' },
        domain_constraints: { language: 'typescript' },
      }),
    } as Response);

    const bundle = await primer.intakeTask({
      description: 'Build a robust TypeScript API',
      taskType: 'code_generation',
    });

    expect(bundle.priors.recommended_n).toBe(7);
    expect(bundle.budget.max_attempts).toBe(7);
    expect(bundle.priors.known_failure_modes[0].pattern).toBe('missing tests');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/gbrain/priors',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('signature hash is consistent for same task description', async () => {
    const b1 = await primer.intakeTask({ description: 'identical task', taskType: 'code_generation' });
    const b2 = await primer.intakeTask({ description: 'identical task', taskType: 'code_generation' });
    expect(b1.signature.hash).toBe(b2.signature.hash);
  });

  it('different descriptions produce different signature hashes', async () => {
    const b1 = await primer.intakeTask({ description: 'Task A' });
    const b2 = await primer.intakeTask({ description: 'Task B' });
    expect(b1.signature.hash).not.toBe(b2.signature.hash);
  });

  it('budget defaults are applied when not provided', async () => {
    const bundle = await primer.intakeTask({ description: 'Budget default test' });
    expect(bundle.budget.max_attempts).toBeGreaterThan(0);
    expect(bundle.budget.max_cost_usd).toBeGreaterThan(0);
    expect(bundle.budget.max_wall_time_ms).toBeGreaterThan(0);
  });
});
