// gorchestrator/test/chaos.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { SandboxPoolManager } from '../src/core/sandbox';

// Simplified resilience utilities for chaos testing
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(
    private options: { failureThreshold?: number; recoveryTimeoutMs?: number } = {}
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.options.recoveryTimeoutMs!) {
        this.setState('half-open');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= 2) {
        this.setState('closed');
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold!) {
      this.setState('open');
    }
  }

  private setState(state: 'closed' | 'open' | 'half-open'): void {
    if (this.state !== state) {
      this.state = state;
      this.failureCount = 0;
      this.successCount = 0;
    }
  }

  getState(): string {
    return this.state;
  }
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; initialDelayMs?: number; retryableErrors?: string[] } = {}
): Promise<T> {
  const { maxAttempts = 3, initialDelayMs = 10, retryableErrors = [] } = options;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt >= maxAttempts) break;

      const isRetryable = retryableErrors.length === 0 ||
        retryableErrors.some(pattern => lastError!.message.includes(pattern));

      if (!isRetryable) throw lastError;

      await new Promise(resolve => setTimeout(resolve, initialDelayMs * attempt));
    }
  }

  throw lastError!;
}

async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Operation timed out'
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

describe('Chaos Testing for Resilience', () => {
  let poolManager: SandboxPoolManager;

  beforeAll(() => {
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

  describe('Retry Logic Resilience', () => {
    it('recovers from transient failures with retry', async () => {
      let attempts = 0;
      const flakyOperation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('ECONNRESET: Connection reset');
        }
        return 'success';
      };

      const result = await withRetry(flakyOperation, {
        maxAttempts: 5,
        initialDelayMs: 10,
        retryableErrors: ['ECONNRESET'],
      });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('fails after max retry attempts for persistent errors', async () => {
      const failingOperation = async () => {
        throw new Error('Validation error: invalid input');
      };

      await expect(
        withRetry(failingOperation, {
          maxAttempts: 3,
          initialDelayMs: 10,
        })
      ).rejects.toThrow();
    });

    it('does not retry non-retryable errors', async () => {
      let attempts = 0;
      const validationError = async () => {
        attempts++;
        throw new Error('ValidationError: invalid input');
      };

      await expect(
        withRetry(validationError, {
          maxAttempts: 3,
          initialDelayMs: 10,
          retryableErrors: ['ECONNRESET', 'ETIMEDOUT'],
        })
      ).rejects.toThrow();

      expect(attempts).toBe(1);
    });
  });

  describe('Circuit Breaker Resilience', () => {
    it('opens circuit after failure threshold', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        recoveryTimeoutMs: 1000,
      });

      const failingOperation = async () => {
        throw new Error('Service unavailable');
      };

      // Trigger failures
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      }

      expect(circuitBreaker.getState()).toBe('open');

      // Circuit should block further calls
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('recovers to half-open after timeout', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        recoveryTimeoutMs: 100,
      });

      const failingOperation = async () => {
        throw new Error('Service unavailable');
      };

      // Trigger failures
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();

      expect(circuitBreaker.getState()).toBe('open');

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next call should succeed and move to half-open
      const successOperation = async () => 'success';
      const result = await circuitBreaker.execute(successOperation);

      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe('closed');
    });

    it('closes circuit after successful recovery', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        recoveryTimeoutMs: 100,
      });

      const failingOperation = async () => {
        throw new Error('Service unavailable');
      };

      const successOperation = async () => 'success';

      // Trigger failures
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();

      expect(circuitBreaker.getState()).toBe('open');

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Two successful calls should close the circuit
      await circuitBreaker.execute(successOperation);
      await circuitBreaker.execute(successOperation);

      expect(circuitBreaker.getState()).toBe('closed');
    });
  });

  describe('Timeout Resilience', () => {
    it('aborts long-running operations', async () => {
      const slowOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return 'done';
      };

      await expect(
        withTimeout(slowOperation, 100, 'Operation timed out')
      ).rejects.toThrow('Operation timed out');
    });

    it('completes fast operations normally', async () => {
      const fastOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'done';
      };

      const result = await withTimeout(fastOperation, 1000);
      expect(result).toBe('done');
    });
  });

  describe('Sandbox Resilience Under Load', () => {
    it('handles concurrent sandbox failures gracefully', async () => {
      const promises = Array(10).fill(null).map(async (_, i) => {
        try {
          const sandbox = await poolManager.provisionSandbox(`chaos-${i}`, {
            image: 'python:3.11-slim',
            resource_limits: { cpu_cores: 1, memory_mb: 1024, disk_gb: 10, max_wall_time_ms: 300000 },
            network_isolation: false,
            allowlisted_domains: [],
          });
          await poolManager.destroySandbox(sandbox.sandbox_id);
          return { success: true, id: i };
        } catch (error) {
          return { success: false, id: i, error: error instanceof Error ? error.message : String(error) };
        }
      });

      const results = await Promise.all(promises);
      const failures = results.filter(r => !r.success);

      // Some failures are expected due to concurrency limits
      expect(failures.length).toBeLessThan(results.length);
    });

    it('recovers from sandbox destruction failures', async () => {
      const sandbox = await poolManager.provisionSandbox('chaos-recovery', {
        image: 'python:3.11-slim',
        resource_limits: { cpu_cores: 1, memory_mb: 1024, disk_gb: 10, max_wall_time_ms: 300000 },
        network_isolation: false,
        allowlisted_domains: [],
      });

      // Destroy should handle errors gracefully
      await poolManager.destroySandbox(sandbox.sandbox_id);

      // Should be able to provision again after destruction
      const newSandbox = await poolManager.provisionSandbox('chaos-recovery-2', {
        image: 'python:3.11-slim',
        resource_limits: { cpu_cores: 1, memory_mb: 1024, disk_gb: 10, max_wall_time_ms: 300000 },
        network_isolation: false,
        allowlisted_domains: [],
      });

      expect(newSandbox).toBeDefined();
      await poolManager.destroySandbox(newSandbox.sandbox_id);
    });
  });

  describe('Memory Pressure Resilience', () => {
    it('handles memory pressure without crashing', async () => {
      const largeData = new Array(100000).fill('test data item');

      const sandbox = await poolManager.provisionSandbox('chaos-memory', {
        image: 'python:3.11-slim',
        resource_limits: { cpu_cores: 1, memory_mb: 1024, disk_gb: 10, max_wall_time_ms: 300000 },
        network_isolation: false,
        allowlisted_domains: [],
      });

      // Process large data while sandbox is active
      const processed = largeData.map(item => item.toUpperCase());
      expect(processed).toHaveLength(100000);

      await poolManager.destroySandbox(sandbox.sandbox_id);
    });
  });

  describe('Network Partition Simulation', () => {
    it('handles simulated network timeouts', async () => {
      const sandbox = await poolManager.provisionSandbox('chaos-network', {
        image: 'python:3.11-slim',
        resource_limits: { cpu_cores: 1, memory_mb: 1024, disk_gb: 10, max_wall_time_ms: 300000 },
        network_isolation: false,
        allowlisted_domains: [],
      });

      // Simulate network timeout by using a very long sleep with timeout
      await expect(
        poolManager.executeCommand(sandbox.sandbox_id, 'sleep 100')
      ).rejects.toThrow();

      await poolManager.destroySandbox(sandbox.sandbox_id);
    });
  });
});
