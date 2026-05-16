import { describe, it, expect, afterEach } from '@jest/globals';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import {
  FileSecretManager,
  sanitizeCliInteger,
  sanitizeCliString,
  sanitizeCliUrl,
} from '../src/core/security';

describe('security controls', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rotates secrets through the file-backed secret manager without listing values', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gorchestrator-secrets-'));
    roots.push(root);
    const manager = new FileSecretManager(root);

    const first = manager.rotate('openai_api_key', 'sk-test-value');
    const second = manager.rotate('openai_api_key', 'sk-next-value');
    const listed = manager.list();

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(manager.get('openai_api_key')).toBe('sk-next-value');
    expect(listed[0]).toMatchObject({ name: 'openai_api_key', version: 2, source: 'file' });
    expect(JSON.stringify(listed)).not.toContain('sk-next-value');
  });

  it('rejects unsafe CLI input shapes before command handlers use them', () => {
    expect(sanitizeCliString('safe task', 'task')).toBe('safe task');
    expect(() => sanitizeCliString('bad\0task', 'task')).toThrow(/NUL/);
    expect(() => sanitizeCliInteger('101', 'attempts', 1, 100)).toThrow(/between/);
    expect(() => sanitizeCliUrl('file:///tmp/socket', 'gbrain endpoint')).toThrow(/http/);
  });

  it('pins Docker and public endpoint security implementation details', () => {
    const sandboxSource = readFileSync(path.join(__dirname, '../src/core/sandbox.ts'), 'utf8');
    const healthSource = readFileSync(path.join(__dirname, '../src/core/public-health-server.ts'), 'utf8');

    expect(sandboxSource).toContain("'exec',");
    expect(sandboxSource).toContain("'-w', workDir");
    expect(sandboxSource).not.toContain('cd ${workDir}');
    expect(sandboxSource).toContain("'--network', sandbox.config.network_isolation ? 'none' : 'bridge'");
    expect(healthSource).toContain('GORCHESTRATOR_HEALTH_RATE_LIMIT_RPM');
    expect(healthSource).toContain('health_shutdown_token');
    expect(healthSource).toContain('rate_limited');
  });
});
