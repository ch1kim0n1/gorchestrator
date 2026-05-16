import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TrendOptions {
  runs: number;
  json: boolean;
  metric?: string;
}

const WINDOW_SIZE = 20;
const Z_SCORE_THRESHOLD = 1.5;
const SUCCESS_RATE_HISTORY_PATH = path.join(
  process.cwd(),
  '.gbrain-corpus',
  'gorchestrator-success-rate-history.json',
);

function loadSuccessRateHistory(): number[] {
  // Try cwd-relative path first (matches where orchestrator writes it)
  const candidates = [
    SUCCESS_RATE_HISTORY_PATH,
    path.join(os.homedir(), '.gorchestrator', 'gorchestrator-success-rate-history.json'),
  ];

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (!Array.isArray(parsed)) continue;
      return parsed
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
        .slice(-50);
    } catch {
      // Try next candidate
    }
  }
  return [];
}

function computeZScore(values: number[]): {
  mean: number;
  stddev: number;
  zScore: number;
  direction: 'DEGRADING' | 'IMPROVING' | 'STABLE';
} {
  const n = values.length;
  if (n === 0) {
    return { mean: 0, stddev: 0, zScore: 0, direction: 'STABLE' };
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / n;

  const variance = n > 1
    ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)
    : 0;
  const stddev = Math.sqrt(variance);

  const latest = values[values.length - 1] ?? mean;
  const zScore = stddev > 0 ? (latest - mean) / stddev : 0;

  let direction: 'DEGRADING' | 'IMPROVING' | 'STABLE';
  if (zScore < -Z_SCORE_THRESHOLD) {
    direction = 'DEGRADING';
  } else if (zScore > Z_SCORE_THRESHOLD) {
    direction = 'IMPROVING';
  } else {
    direction = 'STABLE';
  }

  return { mean, stddev, zScore, direction };
}

export async function trendCommand(options: TrendOptions): Promise<void> {
  const metricName = options.metric ?? 'task_success_rate';
  const history = loadSuccessRateHistory();

  if (history.length === 0) {
    const message = 'No success rate history found. Run some tasks through GOrchestrator to build history.';
    if (options.json) {
      console.log(JSON.stringify({ metric: metricName, message, values: [], direction: 'STABLE' }, null, 2));
    } else {
      console.log(chalk.gray(message));
    }
    return;
  }

  // Use the requested window (capped at actual history length)
  const windowValues = history.slice(-Math.min(WINDOW_SIZE, history.length));
  const last5 = history.slice(-5);

  const { mean, stddev, zScore, direction } = computeZScore(windowValues);

  if (options.json) {
    console.log(JSON.stringify({
      metric: metricName,
      last_5_values: last5,
      direction,
      z_score: Math.round(zScore * 1000) / 1000,
      mean: Math.round(mean * 1000) / 1000,
      stddev: Math.round(stddev * 1000) / 1000,
      window_size: windowValues.length,
      total_history: history.length,
    }, null, 2));
    return;
  }

  // Human-readable output
  const directionColor = direction === 'DEGRADING'
    ? chalk.red
    : direction === 'IMPROVING'
      ? chalk.green
      : chalk.blue;

  console.log(chalk.blue.bold('GOrchestrator Trend Analysis'));
  console.log('');
  console.log(`  Metric:      ${chalk.bold(metricName)}`);
  console.log(`  Last 5:      [${last5.map(v => v.toFixed(3)).join(', ')}]`);
  console.log(`  Direction:   ${directionColor.bold(direction)}`);
  console.log(`  Z-score:     ${zScore.toFixed(3)} (threshold: ±${Z_SCORE_THRESHOLD})`);
  console.log(`  Mean:        ${mean.toFixed(3)}`);
  console.log(`  Std dev:     ${stddev.toFixed(3)}`);
  console.log(`  Window size: ${windowValues.length} (of ${history.length} total)`);

  if (direction === 'DEGRADING') {
    console.log('');
    console.log(chalk.red('Warning: Success rate is significantly below recent average.'));
    console.log(chalk.gray('Check recent task runs and error logs for root cause.'));
  } else if (direction === 'IMPROVING') {
    console.log('');
    console.log(chalk.green('Success rate is significantly above recent average.'));
  }
}
