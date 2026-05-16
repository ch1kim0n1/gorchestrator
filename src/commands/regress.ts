import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import { OrchestratorPersistenceManager } from '../core/orchestrator-persistence.js';
import { ReceiptRegistry } from '../core/receipt-registry.js';

export interface RegressOptions {
  baseline: string;
  model: string;
  threshold: number;
  json: boolean;
  record?: boolean;
  n?: number;
}

const TOLERANCE = 0.05;

interface RubricRow {
  dimension: string;
  current: number | null;
  baseline: number | null;
  delta: number | null;
  passed: boolean;
}

/**
 * Load the baseline receipt from the registry.
 * Returns null if no baseline is found.
 */
async function loadBaselineReceipt(registry: ReceiptRegistry, baselineId?: string): Promise<any | null> {
  if (baselineId && baselineId !== 'last') {
    return registry.getByIdOrPath(baselineId);
  }
  const receipts = await registry.getAllBetween(new Date(0), new Date());
  if (receipts.length === 0) return null;
  // Use the earliest receipt as baseline (first recorded)
  return receipts[0];
}

/**
 * Load N most recent scored attempts from SQLite.
 */
function loadRecentScoredAttempts(persistence: OrchestratorPersistenceManager, n: number): Array<{
  attempt_id: string;
  overall_score: number;
  correctness_score: number | null;
  efficiency_score: number | null;
  completeness_score: number | null;
  hard_gates_passed: boolean;
  timestamp: string;
}> {
  // We query across all tasks, just need recent scores
  const db = (persistence as any).db;
  return db.prepare(`
    SELECT attempt_id, overall_score, correctness_score, efficiency_score, completeness_score,
           hard_gates_passed, timestamp
    FROM scored_attempts
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(n);
}

export async function regressCommand(task: string, options: RegressOptions): Promise<void> {
  const n = options.n ?? 5;

  // If --record flag: capture current state as new baseline (informational only)
  if (options.record) {
    console.log(chalk.blue('Recording current state as baseline is handled by the receipt registry automatically.'));
    console.log(chalk.gray('Run tasks normally and the latest receipt becomes the baseline for future comparisons.'));
    return;
  }

  const persistence = new OrchestratorPersistenceManager();
  const registry = new ReceiptRegistry('gorchestrator');
  let anyRegressed = false;

  try {
    // Load baseline receipt
    const baseline = await loadBaselineReceipt(registry, options.baseline !== 'last' ? options.baseline : undefined);

    if (!baseline) {
      console.log(chalk.yellow('No baseline found. Run with --record to capture baseline.'));
      persistence.close();
      return;
    }

    // Load recent scored attempts from SQLite
    let recentAttempts: ReturnType<typeof loadRecentScoredAttempts>;
    try {
      recentAttempts = loadRecentScoredAttempts(persistence, n);
    } catch (error) {
      recentAttempts = [];
    }

    if (recentAttempts.length === 0) {
      console.log(chalk.yellow('No recent attempt data found in SQLite. Run some tasks first.'));
      persistence.close();
      return;
    }

    // Average scores across recent attempts
    const avgScore = (field: 'overall_score' | 'correctness_score' | 'efficiency_score' | 'completeness_score') => {
      const values = recentAttempts
        .map(attempt => attempt[field])
        .filter((v): v is number => v !== null && typeof v === 'number');
      return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    };

    // Build rubric dimension comparison table
    const baselineScores = baseline.scores ?? {};
    const currentDimensions: Record<string, number | null> = {
      overall_score: avgScore('overall_score'),
      correctness: avgScore('correctness_score'),
      robustness: avgScore('efficiency_score'),
      user_outcome: avgScore('completeness_score'),
    };

    const rows: RubricRow[] = [];

    // Include all dimensions from baseline scores + our computed ones
    const allDimensions = new Set([
      ...Object.keys(baselineScores),
      ...Object.keys(currentDimensions),
    ]);

    for (const dimension of allDimensions) {
      const baselineVal: number | null =
        baselineScores[dimension]?.score ?? null;
      const currentVal: number | null = currentDimensions[dimension] ?? null;

      let delta: number | null = null;
      let passed = true;

      if (baselineVal !== null && currentVal !== null) {
        delta = currentVal - baselineVal;
        passed = delta >= -TOLERANCE;
        if (!passed) anyRegressed = true;
      }

      rows.push({ dimension, current: currentVal, baseline: baselineVal, delta, passed });
    }

    if (options.json) {
      console.log(JSON.stringify({
        task,
        baseline_receipt: baseline.receipt_id,
        baseline_timestamp: baseline.timestamp,
        recent_attempts_sampled: recentAttempts.length,
        tolerance: TOLERANCE,
        regressed: anyRegressed,
        dimensions: rows,
      }, null, 2));
      persistence.close();
      if (anyRegressed) process.exit(1);
      return;
    }

    // Print diff table
    console.log(chalk.blue.bold('GOrchestrator Regression Check'));
    console.log(chalk.gray(`Baseline receipt: ${baseline.receipt_id} (${baseline.timestamp})`));
    console.log(chalk.gray(`Recent attempts sampled: ${recentAttempts.length} (last ${n})`));
    console.log(chalk.gray(`Tolerance: ±${TOLERANCE}`));
    console.log('');

    const colWidths = { dim: 20, cur: 10, base: 10, delta: 10, status: 10 };
    const header = [
      'Dimension'.padEnd(colWidths.dim),
      'Current'.padEnd(colWidths.cur),
      'Baseline'.padEnd(colWidths.base),
      'Delta'.padEnd(colWidths.delta),
      'Status',
    ].join('  ');

    console.log(chalk.bold(header));
    console.log('-'.repeat(header.length));

    for (const row of rows) {
      const curStr = row.current !== null ? row.current.toFixed(3) : 'N/A';
      const baseStr = row.baseline !== null ? row.baseline.toFixed(3) : 'N/A';
      const deltaStr = row.delta !== null
        ? (row.delta >= 0 ? '+' : '') + row.delta.toFixed(3)
        : 'N/A';

      const statusStr = row.delta === null
        ? chalk.gray('N/A')
        : row.passed
          ? chalk.green('PASS')
          : chalk.red('FAIL');

      const deltaColored = row.delta === null
        ? chalk.gray(deltaStr)
        : row.delta >= 0
          ? chalk.green(deltaStr)
          : Math.abs(row.delta) > TOLERANCE
            ? chalk.red(deltaStr)
            : chalk.yellow(deltaStr);

      console.log([
        row.dimension.padEnd(colWidths.dim),
        curStr.padEnd(colWidths.cur),
        baseStr.padEnd(colWidths.base),
        deltaColored.padEnd(colWidths.delta + 10), // chalk adds invisible chars
        statusStr,
      ].join('  '));
    }

    console.log('');
    if (anyRegressed) {
      console.log(chalk.red.bold('REGRESSION DETECTED: One or more dimensions dropped beyond tolerance.'));
    } else {
      console.log(chalk.green.bold('NO REGRESSION: All dimensions within tolerance.'));
    }
  } finally {
    persistence.close();
  }

  if (anyRegressed) process.exit(1);
}
