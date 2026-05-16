import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';
import { loadRunById, saveRun } from '../db.js';
import { randomUUID } from 'crypto';

export interface RegressOptions {
  baseline: string;
  model: string;
  threshold: number;
  json: boolean;
}

export async function regressCommand(task: string, options: RegressOptions): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(chalk.red('Error: ANTHROPIC_API_KEY not set'));
    process.exit(1);
  }

  const baseline = loadRunById(options.baseline);
  if (!baseline) {
    console.error(chalk.red(`Baseline run not found: ${options.baseline}`));
    console.error(chalk.gray('Use run_id from a previous best-of run, or "last" for the most recent.'));
    process.exit(1);
  }

  if (!options.json) {
    console.log(chalk.blue(`Regression test: "${task}"`));
    console.log(chalk.gray(`Baseline: ${options.baseline} (score: ${(baseline.score * 100).toFixed(0)}%)`));
    console.log('');
  }

  const client = new Anthropic({ apiKey });

  // Run the task fresh
  const response = await client.messages.create({
    model: options.model,
    max_tokens: 2048,
    messages: [{ role: 'user', content: task }],
  });
  const currentOutput = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n');

  // Score: compare current vs baseline
  const scoringResponse = await client.messages.create({
    model: options.model,
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Compare these two responses to the task: "${task}"

BASELINE (reference):
---
${baseline.output.slice(0, 2000)}
---

CURRENT (new):
---
${currentOutput.slice(0, 2000)}
---

Is the current response as good or better than the baseline?
Score the current response relative to baseline: 1.0 = same quality, >1.0 = better, <1.0 = worse.
Return ONLY JSON: {"relative_score":0.95,"current_score":0.85,"reasoning":"one sentence","regression":false}
Set regression=true if relative_score < ${options.threshold}.`,
    }],
  });

  const raw = scoringResponse.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error(chalk.red('Scorer did not return valid JSON'));
    process.exit(1);
  }

  const result = JSON.parse(match[0]) as { relative_score: number; current_score: number; reasoning: string; regression: boolean };

  // Save current run
  saveRun({
    run_id: randomUUID(),
    task,
    output: currentOutput,
    score: result.current_score ?? 0,
    model: options.model,
    cost_usd: 0,
    timestamp: new Date().toISOString(),
  });

  if (options.json) {
    console.log(JSON.stringify({ ...result, task, baseline_run: options.baseline }, null, 2));
    return;
  }

  const statusColor = result.regression ? chalk.red : chalk.green;
  const statusIcon = result.regression ? '✗ REGRESSION' : '✓ NO REGRESSION';
  console.log(`${statusColor(statusIcon)}`);
  console.log(`Relative score: ${(result.relative_score * 100).toFixed(0)}% (threshold: ${(options.threshold * 100).toFixed(0)}%)`);
  console.log(`Current score:  ${(result.current_score * 100).toFixed(0)}%`);
  console.log(`Baseline score: ${(baseline.score * 100).toFixed(0)}%`);
  if (result.reasoning) console.log(chalk.gray(`\nNote: ${result.reasoning}`));

  if (result.regression) process.exit(1);
}
