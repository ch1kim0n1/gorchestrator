import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GOrchestrator } from '../src/core/orchestrator';
import { GOrchestratorObservability, redactPII } from '../src/core/observability';

describe('GOrchestrator observability', () => {
  const originalAuditDir = process.env.GORCHESTRATOR_AUDIT_DIR;

  afterEach(() => {
    if (originalAuditDir === undefined) delete process.env.GORCHESTRATOR_AUDIT_DIR;
    else process.env.GORCHESTRATOR_AUDIT_DIR = originalAuditDir;
  });

  it('redacts PII from structured payloads', () => {
    expect(redactPII({
      user_email: 'person@example.com',
      nested: { api_key: 'test-key' },
      message: 'contact person@example.com',
    })).toEqual({
      user_email: '[REDACTED]',
      nested: { api_key: '[REDACTED]' },
      message: 'contact [REDACTED_EMAIL]',
    });
  });

  it('exports Prometheus and OpenTelemetry metrics with latency quantiles', () => {
    const observability = new GOrchestratorObservability('gorchestrator');
    observability.metrics.recordPublicMethod('runTask', 10, 'ok');
    observability.metrics.recordPublicMethod('runTask', 20, 'ok');
    observability.metrics.recordPublicMethod('runTask', 30, 'error');

    const prometheus = observability.metrics.prometheus();
    expect(prometheus).toContain('gorchestrator_public_method_throughput_total{method="runTask",status="ok"} 2');
    expect(prometheus).toContain('gorchestrator_public_method_errors_total{method="runTask"} 1');
    expect(prometheus).toContain('quantile="0.95"');
    expect(JSON.stringify(observability.metrics.openTelemetry())).toContain('service.name');
  });

  it('writes decision and shell-job audit JSONL files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gorchestrator-audit-'));
    process.env.GORCHESTRATOR_AUDIT_DIR = dir;
    const observability = new GOrchestratorObservability('gorchestrator');

    observability.audit.logDecision({
      operation: 'runTask',
      decision: 'winner_selected',
      success: true,
      metadata: { email: 'person@example.com' },
    });
    observability.audit.logShellJob({
      command: 'npm test',
      exit_code: 0,
      metadata: { token: 'test-token' },
    });

    const files = fs.readdirSync(dir);
    expect(files.some(file => file.startsWith('decisions-'))).toBe(true);
    expect(files.some(file => file.startsWith('shell-jobs-'))).toBe(true);
    const content = files.map(file => fs.readFileSync(path.join(dir, file), 'utf8')).join('\n');
    expect(content).toContain('[REDACTED]');
    expect(content).not.toContain('person@example.com');
    expect(content).not.toContain('test-token');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('exposes metrics and trace snapshots from health checks', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gorchestrator-obs-db-'));
    const orchestrator = new GOrchestrator({
      dbPath: path.join(dir, 'orchestrator.db'),
      gbrainEndpoint: 'http://127.0.0.1:1',
      gmirrorEndpoint: 'http://127.0.0.1:1',
      gtomEndpoint: 'http://127.0.0.1:1',
      gstackEndpoint: 'http://127.0.0.1:1',
    });
    await orchestrator.healthCheck();

    expect(orchestrator.exportPrometheusMetrics()).toContain('gorchestrator_public_method_throughput_total');
    expect(JSON.stringify(orchestrator.exportOpenTelemetryMetrics())).toContain('resourceMetrics');
    expect(JSON.stringify(orchestrator.getObservabilitySnapshot())).toContain('GOrchestrator.healthCheck');
    (orchestrator as any).persistence.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
