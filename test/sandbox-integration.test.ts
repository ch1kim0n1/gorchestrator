// gorchestrator/test/sandbox-integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { SandboxPoolManager } from '../src/core/sandbox';
import { sanitizeDockerImage, sanitizeContainerName, sanitizeResourceLimit } from '../src/core/security';

describe('Sandbox Integration Tests', () => {
  let poolManager: SandboxPoolManager;

  beforeAll(() => {
    // Set mock mode for testing
    process.env.MOCK_SANDBOX = '1';
    poolManager = new SandboxPoolManager({
      maxConcurrency: 3,
      backend: 'inprocess',
    });
  });

  afterAll(async () => {
    await poolManager.cleanup();
    delete process.env.MOCK_SANDBOX;
  });

  describe('Docker Command Sanitization', () => {
    it('sanitizes Docker image names correctly', () => {
      const validImage = 'python:3.11-slim';
      const sanitized = sanitizeDockerImage(validImage, 'image');
      expect(sanitized).toBe(validImage);

      const invalidImage = 'rm -rf /; python:3.11';
      expect(() => sanitizeDockerImage(invalidImage, 'image')).toThrow();
    });

    it('sanitizes container names correctly', () => {
      const validName = 'gorch-test-123';
      const sanitized = sanitizeContainerName(validName, 'container name');
      expect(sanitized).toBe(validName);

      const invalidName = '../etc/passwd';
      expect(() => sanitizeContainerName(invalidName, 'container name')).toThrow();
    });

    it('sanitizes resource limits correctly', () => {
      const cpuCores = sanitizeResourceLimit(2, 'cpu_cores', 1, 8);
      expect(cpuCores).toBe(2);

      const memoryMb = sanitizeResourceLimit(2048, 'memory_mb', 512, 16384);
      expect(memoryMb).toBe(2048);

      expect(() => sanitizeResourceLimit(16, 'cpu_cores', 1, 8)).toThrow();
      expect(() => sanitizeResourceLimit(500, 'memory_mb', 512, 16384)).toThrow();
    });
  });

  describe('Sandbox Lifecycle', () => {
    it('creates and destroys a sandbox in mock mode', async () => {
      const sandbox = await poolManager.provisionSandbox('test-attempt-1', {
        image: 'python:3.11-slim',
        resource_limits: {
          cpu_cores: 1,
          memory_mb: 1024,
          disk_gb: 10,
          max_wall_time_ms: 300000,
        },
        network_isolation: false,
        allowlisted_domains: [],
      });

      expect(sandbox).toBeDefined();
      expect(sandbox.sandbox_id).toBeDefined();
      expect(sandbox.state).toBe('ready');

      await poolManager.destroySandbox(sandbox.sandbox_id);
    });

    it('enforces maximum sandbox limit', async () => {
      const maxSandboxes = 3;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < maxSandboxes; i++) {
        promises.push(
          poolManager.provisionSandbox(`test-attempt-${i}`, {
            image: 'python:3.11-slim',
            resource_limits: { cpu_cores: 1, memory_mb: 1024, disk_gb: 10, max_wall_time_ms: 300000 },
            network_isolation: false,
            allowlisted_domains: [],
          })
        );
      }

      const sandboxes = await Promise.all(promises);
      expect(sandboxes).toHaveLength(maxSandboxes);

      // Cleanup
      for (const sandbox of sandboxes) {
        await poolManager.destroySandbox(sandbox.sandbox_id);
      }
    });
  });

  describe('Network Restrictions', () => {
    it('validates allowlisted domains in config', async () => {
      const sandbox = await poolManager.provisionSandbox('test-attempt-network', {
        image: 'python:3.11-slim',
        resource_limits: { cpu_cores: 1, memory_mb: 1024, disk_gb: 10, max_wall_time_ms: 300000 },
        network_isolation: true,
        allowlisted_domains: ['api.example.com', 'cdn.example.com'],
      });

      expect(sandbox.config.allowlisted_domains).toHaveLength(2);
      await poolManager.destroySandbox(sandbox.sandbox_id);
    });
  });

  describe('Command Execution', () => {
    it('executes commands in mock mode', async () => {
      const sandbox = await poolManager.provisionSandbox('test-attempt-exec', {
        image: 'python:3.11-slim',
        resource_limits: { cpu_cores: 1, memory_mb: 1024, disk_gb: 10, max_wall_time_ms: 300000 },
        network_isolation: false,
        allowlisted_domains: [],
      });

      const result = await poolManager.executeCommand(sandbox.sandbox_id, 'echo hello');

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);

      await poolManager.destroySandbox(sandbox.sandbox_id);
    });

    it('handles invalid commands gracefully', async () => {
      const sandbox = await poolManager.provisionSandbox('test-attempt-invalid', {
        image: 'python:3.11-slim',
        resource_limits: { cpu_cores: 1, memory_mb: 1024, disk_gb: 10, max_wall_time_ms: 300000 },
        network_isolation: false,
        allowlisted_domains: [],
      });

      await expect(
        poolManager.executeCommand(sandbox.sandbox_id, 'invalid-command-that-does-not-exist')
      ).rejects.toThrow();

      await poolManager.destroySandbox(sandbox.sandbox_id);
    });
  });

  describe('Error Handling', () => {
    it('handles invalid sandbox IDs gracefully', async () => {
      await expect(
        poolManager.executeCommand('invalid-id', 'echo test')
      ).rejects.toThrow();
    });

    it('handles concurrent operations safely', async () => {
      const sandbox = await poolManager.provisionSandbox('test-attempt-concurrent', {
        image: 'python:3.11-slim',
        resource_limits: { cpu_cores: 1, memory_mb: 1024, disk_gb: 10, max_wall_time_ms: 300000 },
        network_isolation: false,
        allowlisted_domains: [],
      });

      const promises = Array(5).fill(null).map(() =>
        poolManager.executeCommand(sandbox.sandbox_id, 'echo concurrent')
      );

      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result.exitCode).toBe(0);
      });

      await poolManager.destroySandbox(sandbox.sandbox_id);
    });
  });
});
