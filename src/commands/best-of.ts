import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';
import { saveRun } from '../db.js';
import { randomUUID } from 'crypto';

export interface BestOfOptions {
  n: number;
  model: string;
  scorerModel: string;
  system?: string;
  json: boolean;
  maxCost?: number;
}

const MODEL_COSTS: Record<string, [number, number]> = {
  'claude-haiku-4-5-20251001': [0.25, 1.25],
  'claude-3-5-haiku-20241022': [0.25, 1.25],
  'claude-sonnet-4-6': [3.0, 15.0],
  'claude-3-5-sonnet-20241022': [3.0, 15.0],
  'claude-opus-4-6': [15.0, 75.0],
};

interface Attempt {
  index: number;
  output: string;
  score: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

async function scoreOutput(client: Anthropic, task: string, output: string, model: string): Promise<{ score: number; reason: string }> {
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Rate this response to the task on a scale 0.0–1.0. Consider: accuracy, completeness, clarity, conciseness.

Task: "${task}"

Response:
---
${output.slice(0, 3000)}
---

Return ONLY valid JSON: {"score":0.85,"reason":"brief one-line reason"}`,
      }],
    });
    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { score: 0.5, reason: 'parse error' };
    const parsed = JSON.parse(match[0]) as { score?: number; reason?: string };
    return { score: typeof parsed.score === 'number' ? Math.max(0, Math.min(1, parsed.score)) : 0.5, reason: parsed.reason ?? '' };
  } catch {
    return { score: 0.5, reason: 'scoring error' };
  }
}

export async function bestOfCommand(task: string, options: BestOfOptions): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(chalk.red('Error: ANTHROPIC_API_KEY not set'));
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  const [inRate, outRate] = MODEL_COSTS[options.model] ?? [3.0, 15.0];

  if (options.maxCost !== undefined) {
    // Estimate: ~1000 input tokens + 2048 output per attempt
    const estimatedCost = options.n * (1000 * inRate + 2048 * outRate) / 1_000_000;
    if (estimatedCost > options.maxCost) {
      console.error(chalk.red(`Budget check: estimated cost ~$${estimatedCost.toFixed(4)} exceeds --max-cost $${options.maxCost.toFixed(4)}`));
      console.error(chalk.gray(`To proceed anyway, remove --max-cost or increase the limit.`));
      process.exit(1);
    }
    if (!options.json) {
      console.log(chalk.gray(`Budget: ~$${estimatedCost.toFixed(4)} estimated / $${options.maxCost.toFixed(4)} limit`));
    }
  }

  if (!options.json) {
    console.log(chalk.blue(`Running ${options.n} parallel attempts...`));
    console.log(chalk.gray(`Generator: ${options.model} | Scorer: ${options.scorerModel}`));
    console.log('');
  }

  const systemPrompt = options.system ?? 'You are a helpful, precise assistant. Give your best answer.';

  // Run all attempts in parallel
  const attemptPromises = Array.from({ length: options.n }, (_, i) =>
    client.messages.create({
      model: options.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: task }],
    }).then(response => {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('\n');
      const cost = (response.usage.input_tokens * inRate + response.usage.output_tokens * outRate) / 1_000_000;
      if (!options.json) process.stdout.write(chalk.gray(`  \u2713 Attempt ${i + 1} complete\n`));
      return { index: i, text, input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens, cost };
    })
  );

  const rawAttempts = await Promise.all(attemptPromises);

  if (!options.json) {
    console.log('');
    console.log(chalk.gray('Scoring attempts...'));
  }

  // Score all attempts in parallel
  const scorePromises = rawAttempts.map(async a => {
    const { score, reason } = await scoreOutput(client, task, a.text, options.scorerModel);
    return { index: a.index, output: a.text, score, input_tokens: a.input_tokens, output_tokens: a.output_tokens, cost_usd: a.cost, reason } as Attempt & { reason: string };
  });

  const attempts = await Promise.all(scorePromises);
  attempts.sort((a, b) => b.score - a.score);
  const winner = attempts[0]!;
  const totalCost = attempts.reduce((s, a) => s + a.cost_usd, 0);
  const totalTokens = attempts.reduce((s, a) => s + a.input_tokens + a.output_tokens, 0);

  // Persist winner to local run history
  saveRun({
    run_id: randomUUID(),
    task,
    output: winner.output,
    score: winner.score,
    model: options.model,
    cost_usd: totalCost,
    timestamp: new Date().toISOString(),
  });

  if (options.json) {
    console.log(JSON.stringify({ winner, all_attempts: attempts, total_cost_usd: totalCost, total_tokens: totalTokens }, null, 2));
    return;
  }

  console.log('');
  console.log(chalk.green('\u2500'.repeat(60)));
  console.log(chalk.green(`Best attempt (${(winner.score * 100).toFixed(0)}% score):`));
  console.log(chalk.green('\u2500'.repeat(60)));
  console.log(winner.output);
  console.log(chalk.green('\u2500'.repeat(60)));
  console.log('');
  console.log(chalk.blue('All attempt scores:'));
  for (const a of attempts) {
    const filled = Math.round(a.score * 10);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);
    const color = a.score >= 0.7 ? chalk.green : a.score >= 0.5 ? chalk.yellow : chalk.red;
    const isWinner = a.index === winner.index ? chalk.bold(' \u2190 winner') : '';
    console.log(`  Attempt ${a.index + 1}: ${color(bar)} ${(a.score * 100).toFixed(0)}%${isWinner}`);
  }
  console.log('');
  console.log(chalk.gray(`Total cost: $${totalCost.toFixed(5)} | Tokens: ${totalTokens}`));
}
