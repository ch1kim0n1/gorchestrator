/**
 * Test data factories for GOrchestrator
 */

import { Config, Task, Attempt, Configuration } from '../types';

export function createMockConfig(overrides: Partial<Config> = {}): Config {
  return {
    endpoints: {
      gbrain: overrides.endpoints?.gbrain || 'http://localhost:3000',
      gstack: overrides.endpoints?.gstack || 'http://localhost:3001',
      gmirror: overrides.endpoints?.gmirror || 'http://localhost:3002',
      gtom: overrides.endpoints?.gtom || 'http://localhost:3003',
      ...overrides.endpoints
    },
    sandbox: {
      backend: overrides.sandbox?.backend || 'docker',
      maxConcurrency: overrides.sandbox?.maxConcurrency || 5,
      ...overrides.sandbox
    },
    sampling: {
      defaultN: overrides.sampling?.defaultN || 3,
      strategyDistribution: overrides.sampling?.strategyDistribution || {
        exploit: 0.3,
        perturb: 0.3,
        explore: 0.4
      },
      ...overrides.sampling
    },
    budget: {
      maxCostUSD: overrides.budget?.maxCostUSD || 10.0,
      maxWallTimeMs: overrides.budget?.maxWallTimeMs || 300000,
      maxAttempts: overrides.budget?.maxAttempts || 10,
      ...overrides.budget
    }
  };
}

export function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id || 'test-task-1',
    description: overrides.description || 'Test task',
    status: overrides.status || 'pending',
    attempts: overrides.attempts || [],
    createdAt: overrides.createdAt || new Date().toISOString(),
    ...overrides
  };
}

export function createMockAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: overrides.id || 'test-attempt-1',
    taskId: overrides.taskId || 'test-task-1',
    status: overrides.status || 'pending',
    output: overrides.output || '',
    score: overrides.score || 0,
    costUSD: overrides.costUSD || 0,
    durationMs: overrides.durationMs || 0,
    sandboxId: overrides.sandboxId || 'test-sandbox-1',
    createdAt: overrides.createdAt || new Date().toISOString(),
    ...overrides
  };
}

export function createMockConfiguration(overrides: Partial<Configuration> = {}): Configuration {
  return {
    model: overrides.model || 'claude-3-opus-20240229',
    temperature: overrides.temperature || 0.7,
    maxTokens: overrides.maxTokens || 4096,
    systemPrompt: overrides.systemPrompt || 'You are a helpful assistant.',
    ...overrides
  };
}
