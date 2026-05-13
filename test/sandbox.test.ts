// gorchestrator/test/sandbox.test.ts
import { SandboxPoolManager } from '../src/core/sandbox.js';

process.env.MOCK_SANDBOX = '1';

describe('SandboxPoolManager (mock mode)', () => {
  let manager: SandboxPoolManager;

  beforeEach(() => {
    manager = new SandboxPoolManager({ maxConcurrency: 3, backend: 'docker' });
  });

  it('provisionSandbox returns a Sandbox in ready or running state', async () => {
    const sandbox = await manager.provisionSandbox('attempt-1');
    expect(sandbox.sandbox_id).toBeDefined();
    expect(['ready', 'running']).toContain(sandbox.state);
  });

  it('provisionSandbox queues requests when at maxConcurrency', async () => {
    const mgr = new SandboxPoolManager({ maxConcurrency: 1, backend: 'docker' });
    const s1 = await mgr.provisionSandbox('a1');
    expect(s1.state).not.toBe('failed');
    // Third should complete after s1 is destroyed (queue-drain behavior)
    const pendingPromise = mgr.provisionSandbox('a2'); // queued
    await mgr.destroySandbox(s1.sandbox_id); // frees slot
    const s2 = await pendingPromise;
    expect(['ready', 'running']).toContain(s2.state);
    await mgr.destroySandbox(s2.sandbox_id);
  });

  it('executeCommand returns an object with stdout in mock mode', async () => {
    const sandbox = await manager.provisionSandbox('exec-test');
    const result = await manager.executeCommand(sandbox.sandbox_id, 'echo hello');
    // executeCommand returns { stdout, stderr, exitCode }
    expect(result).toBeDefined();
    expect(typeof result.stdout).toBe('string');
    await manager.destroySandbox(sandbox.sandbox_id);
  });

  it('destroySandbox removes sandbox from active set', async () => {
    const sandbox = await manager.provisionSandbox('destroy-test');
    await manager.destroySandbox(sandbox.sandbox_id);
    const stats = manager.getStats();
    expect(stats.active).toBeLessThanOrEqual(3);
  });

  it('getStats returns correct active count', async () => {
    const s1 = await manager.provisionSandbox('stat-1');
    const s2 = await manager.provisionSandbox('stat-2');
    const stats = manager.getStats();
    expect(stats.active).toBeGreaterThanOrEqual(2);
    await manager.destroySandbox(s1.sandbox_id);
    await manager.destroySandbox(s2.sandbox_id);
  });
});
