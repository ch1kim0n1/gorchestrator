// gorchestrator/test/orchestrator.test.ts
import { GOrchestrator } from '../src/core/orchestrator.js';

process.env.MOCK_SANDBOX = '1';

global.fetch = jest.fn().mockImplementation(async (url: string) => {
  const urlStr = String(url);
  if (urlStr.includes('gbrain')) {
    return { ok: false, status: 503, json: async () => ({}) } as Response;
  }
  if (urlStr.includes('gmirror')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        score_set: [],
        latency_ms: 100,
        simulated_user_coverage: 0.0,
      }),
    } as Response;
  }
  if (urlStr.includes('gtom')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ predicted_conflicts: [] }),
    } as Response;
  }
  return { ok: false, status: 503, json: async () => ({}) } as Response;
});

describe('GOrchestrator (e2e with mocks)', () => {
  let orchestrator: GOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator = new GOrchestrator({
      gbrainEndpoint: 'http://localhost:3000',
      gmirrorEndpoint: 'http://localhost:3002',
      gtomEndpoint: 'http://localhost:3003',
      gstackEndpoint: 'http://localhost:3001',
      maxConcurrency: 2,
    });
  });

  it('runTask completes without throwing', async () => {
    const result = await orchestrator.runTask({
      description: 'Write a hello world function',
      taskType: 'code_generation',
      budget: { max_attempts: 2, max_cost_usd: 1, max_wall_time_ms: 15000, max_parallelism: 2 },
    });
    expect(result).toBeDefined();
  }, 20000);

  it('runTask returns a run record with winner and attempts', async () => {
    const result = await orchestrator.runTask({
      description: 'Build a TypeScript utility function',
      budget: { max_attempts: 2, max_cost_usd: 1, max_wall_time_ms: 15000, max_parallelism: 2 },
    });
    expect(result.task_id).toBeDefined();
    expect(result.winner).toBeDefined();
    expect(result.attempts.map((a: any) => a.attempt_id)).toContain(result.winner);
    expect(Array.isArray(result.attempts)).toBe(true);
    expect(result.attempts.length).toBeGreaterThan(0);
  }, 20000);

  it('healthCheck returns status object', async () => {
    const health = await orchestrator.healthCheck();
    expect(health).toBeDefined();
    expect(typeof health.status).toBe('string');
  });
}, 25000);
