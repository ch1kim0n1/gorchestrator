import chalk from 'chalk';
import { loadRuns } from '../db.js';

export interface TrendOptions {
  runs: number;
  json: boolean;
}

export async function trendCommand(options: TrendOptions): Promise<void> {
  const runs = loadRuns(options.runs);

  if (runs.length === 0) {
    console.log(chalk.gray('No runs yet. Use `gorchestrator best-of` to run some tasks first.'));
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(runs, null, 2));
    return;
  }

  // Group by day
  const byDay = new Map<string, typeof runs>();
  for (const run of runs) {
    const day = run.timestamp.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(run);
  }

  const totalRuns = runs.length;
  const avgScore = runs.reduce((s, r) => s + r.score, 0) / runs.length;
  const totalCost = runs.reduce((s, r) => s + r.cost_usd, 0);

  console.log(chalk.blue(`GOrchestrator Trend — last ${totalRuns} runs`));
  console.log(chalk.gray(`Avg score: ${(avgScore * 100).toFixed(0)}% | Total cost: $${totalCost.toFixed(4)}`));
  console.log('');

  // Sort days chronologically
  const sortedDays = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));

  for (const [day, dayRuns] of sortedDays) {
    const avgDayScore = dayRuns.reduce((s, r) => s + r.score, 0) / dayRuns.length;
    const filled = Math.round(avgDayScore * 20);
    const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
    const color = avgDayScore >= 0.7 ? chalk.green : avgDayScore >= 0.5 ? chalk.yellow : chalk.red;
    console.log(`  ${day}  ${color(bar)}  ${(avgDayScore * 100).toFixed(0)}%  (${dayRuns.length} runs)`);
  }

  console.log('');
  // Recent runs
  console.log(chalk.blue('Recent runs:'));
  for (const run of runs.slice(0, 5)) {
    const scoreColor = run.score >= 0.7 ? chalk.green : run.score >= 0.5 ? chalk.yellow : chalk.red;
    const task = run.task.length > 50 ? run.task.slice(0, 47) + '...' : run.task;
    console.log(`  ${scoreColor((run.score * 100).toFixed(0) + '%')} ${task}`);
  }
}
