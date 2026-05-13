// gorchestrator/test/mcp.test.ts
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('GOrchestrator MCP Server', () => {
  const serverSource = readFileSync(join(__dirname, '../src/mcp/server.ts'), 'utf8');

  it('declares the expected server identity', () => {
    expect(serverSource).toContain("name: 'gorchestrator'");
    expect(serverSource).toContain("version: '0.1.0'");
  });

  it('declares the expected tool names', () => {
    for (const tool of ['gorch_run', 'gorch_health', 'gorch_config_sample']) {
      expect(serverSource).toContain(tool);
    }
  });

  it('declares required schemas for task tools', () => {
    expect(serverSource).toContain("required: ['task']");
  });
});
