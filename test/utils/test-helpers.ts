/**
 * Test utilities for GOrchestrator
 */

import { Database } from 'better-sqlite3';

export async function withTestDatabase(fn: (db: Database) => Promise<void>): Promise<void> {
  const db = new Database(':memory:');
  
  // Enable WAL mode for better concurrency in tests
  db.pragma('journal_mode = WAL');
  
  try {
    await fn(db);
  } finally {
    db.close();
  }
}

export function mockService(service: string, responses: any[]) {
  let callCount = 0;
  
  return {
    call: async (...args: any[]) => {
      const response = responses[callCount % responses.length];
      callCount++;
      return response;
    },
    getCallCount: () => callCount,
    reset: () => { callCount = 0; }
  };
}

export async function waitForCondition(
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}

export function createMockLogger() {
  const logs: Array<{ level: string; message: string; meta?: any }> = [];
  
  return {
    info: (message: string, meta?: any) => logs.push({ level: 'info', message, meta }),
    warn: (message: string, meta?: any) => logs.push({ level: 'warn', message, meta }),
    error: (message: string, meta?: any) => logs.push({ level: 'error', message, meta }),
    debug: (message: string, meta?: any) => logs.push({ level: 'debug', message, meta }),
    getLogs: () => logs,
    clearLogs: () => logs.length = 0
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function randomString(length: number = 10): string {
  return Math.random().toString(36).substring(2, 2 + length);
}
