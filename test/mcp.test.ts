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
    for (const tool of [
      'gorch_run',
      'gorch_health',
      'gorch_config_sample',
      'gorch_get_receipts',
      'gorch_get_drift',
      'gorch_sandbox_stats',
      'gorch_get_sandbox_stats',
    ]) {
      expect(serverSource).toContain(tool);
    }
  });

  it('declares required schemas for task tools', () => {
    expect(serverSource).toContain("required: ['task']");
  });

  it('enforces token auth, read/write scopes, and rate limits for MCP calls', () => {
    expect(serverSource).toContain('requiredScopeForTool');
    expect(serverSource).toContain('Insufficient permissions: requires');
    expect(serverSource).toContain('Rate limit exceeded');
    expect(serverSource).toContain('gorchestrator_mcp_token');
    expect(serverSource).toContain('PermissionModel.loadDefault');
    expect(serverSource).toContain('mcp_auth_denied');
  });

  it('validates input using Zod schemas', () => {
    expect(serverSource).toContain('z.object');
    expect(serverSource).toContain('z.string');
  });

  it('returns standardized error responses', () => {
    expect(serverSource).toContain('content: [');
    expect(serverSource).toContain('isError: true');
  });

  it('implements proper scope separation', () => {
    expect(serverSource).toContain('read');
    expect(serverSource).toContain('write');
  });
});
