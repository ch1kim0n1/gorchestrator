import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.GORCHESTRATOR_DATA_DIR || path.join(process.env.HOME || '/tmp', '.gorchestrator');
fs.mkdirSync(DATA_DIR, { recursive: true });

interface RunRecord {
  run_id: string;
  task: string;
  output: string;
  score: number;
  model: string;
  cost_usd: number;
  timestamp: string;
}

const RUNS_FILE = path.join(DATA_DIR, 'runs.jsonl');

export function saveRun(record: RunRecord): void {
  try {
    fs.appendFileSync(RUNS_FILE, JSON.stringify(record) + '\n', 'utf-8');
  } catch { /* non-fatal */ }
}

export function loadRuns(limit = 100): RunRecord[] {
  try {
    if (!fs.existsSync(RUNS_FILE)) return [];
    const lines = fs.readFileSync(RUNS_FILE, 'utf-8').trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map(l => JSON.parse(l) as RunRecord).reverse();
  } catch { return []; }
}

export function loadRunById(runId: string): RunRecord | null {
  try {
    if (!fs.existsSync(RUNS_FILE)) return null;
    const lines = fs.readFileSync(RUNS_FILE, 'utf-8').trim().split('\n').filter(Boolean);
    if (runId === 'last') {
      if (lines.length === 0) return null;
      return JSON.parse(lines[lines.length - 1]!) as RunRecord;
    }
    for (const line of lines) {
      const r = JSON.parse(line) as RunRecord;
      if (r.run_id === runId) return r;
    }
    return null;
  } catch { return null; }
}
