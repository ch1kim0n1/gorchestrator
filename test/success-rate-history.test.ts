import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GOrchestrator } from '../src/core/orchestrator.js';

describe('success rate history persistence', () => {
  const originalCwd = process.cwd();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gorchestrator-history-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads persisted successRateHistory across orchestrator instances', () => {
    const first = new GOrchestrator();
    (first as any).successRateHistory = [0.9, 0.8, 0.7];
    (first as any).saveSuccessRateHistory();
    (first as any).persistence.close();

    const second = new GOrchestrator();
    expect((second as any).successRateHistory).toEqual([0.9, 0.8, 0.7]);
    (second as any).persistence.close();
  });
});
