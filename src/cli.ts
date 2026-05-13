#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { GOrchestrator } from './core/orchestrator.js';

const program = new Command();

program
  .name('gorchestrator')
  .description('Parallel agent execution manager for the G-Stack')
  .version('0.1.0');

// Run a task through orchestration
program
  .command('run')
  .description('Run a task through parallel orchestration')
  .argument('<task>', 'Task description')
  .option('-n, --attempts <number>', 'Number of parallel attempts', '5')
  .option('--type <type>', 'Task type (code_generation, refactor, deployment, etc.)')
  .option('--no-verify', 'Skip GMirror verification')
  .option('--cognitive-check', 'Enable GToM cognitive check')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .option('--gmirror <url>', 'GMirror endpoint', 'http://localhost:3002')
  .option('--gtom <url>', 'GToM endpoint', 'http://localhost:3003')
  .option('--gstack <url>', 'GStack endpoint', 'http://localhost:3001')
  .action(async (task, options) => {
    console.log(chalk.blue.bold('[GOrchestrator] Starting orchestration run'));
    console.log(chalk.gray(`Task: ${task}`));
    console.log(chalk.gray(`Attempts: ${options.attempts}`));
    console.log(chalk.gray(`Verify: ${options.verify}`));
    console.log(chalk.gray(`Cognitive Check: ${options.cognitiveCheck}`));

    const orchestrator = new GOrchestrator({
      gbrainEndpoint: options.gbrain,
      gmirrorEndpoint: options.gmirror,
      gtomEndpoint: options.gtom,
      gstackEndpoint: options.gstack,
    });

    try {
      const startTime = Date.now();
      const result = await orchestrator.runTask({
        description: task,
        taskType: options.type,
        n: parseInt(options.attempts),
        verify: options.verify,
        cognitiveCheck: options.cognitiveCheck,
      });

      const duration = Date.now() - startTime;

      console.log(chalk.green.bold('\n[GOrchestrator] Run completed successfully'));
      console.log(chalk.gray(`Task ID: ${result.task_id}`));
      console.log(chalk.gray(`Winner: ${result.winner}`));
      console.log(chalk.gray(`Attempts: ${result.attempts.length}`));
      console.log(chalk.gray(`Total Cost: $${result.total_cost.total_cost_usd.toFixed(4)}`));
      console.log(chalk.gray(`Duration: ${(duration / 1000).toFixed(2)}s`));
      console.log(chalk.gray(`GBrain Status: ${result.gbrain_write_status}`));

      // Print attempt summary
      console.log(chalk.bold('\nAttempt Summary:'));
      result.attempts.forEach((attempt, idx) => {
        const status = attempt.status === 'completed' ? chalk.green('✓') : chalk.red('✗');
        const score = attempt.scores ? attempt.scores.overall_score.toFixed(3) : 'N/A';
        const selected = attempt.selected ? chalk.yellow(' [WINNER]') : '';
        console.log(`  ${status} Attempt ${idx + 1}: score=${score}${selected}`);
      });

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('[GOrchestrator] Run failed:'), error);
      process.exit(1);
    } finally {
      await orchestrator.cleanup();
    }
  });

// Health check
program
  .command('health')
  .description('Check health of GOrchestrator and dependencies')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .option('--gmirror <url>', 'GMirror endpoint', 'http://localhost:3002')
  .option('--gtom <url>', 'GToM endpoint', 'http://localhost:3003')
  .action(async (options: any) => {
    const orchestrator = new GOrchestrator({
      gbrainEndpoint: options.gbrain,
      gmirrorEndpoint: options.gmirror,
      gtomEndpoint: options.gtom,
    });

    const health = await orchestrator.healthCheck();

    console.log(chalk.bold('GOrchestrator Health Check'));
    console.log(chalk.gray(`Status: ${health.status}`));
    console.log('');
    console.log('Components:');
    console.log(`  GBrain: ${health.components.gbrain === 'ok' ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`  GMirror: ${health.components.gmirror === 'ok' ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`  GToM: ${health.components.gtom === 'ok' ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`  Sandbox: ${health.components.sandbox === 'ok' ? chalk.green('✓') : chalk.red('✗')}`);

    process.exit(health.status === 'healthy' ? 0 : 1);
  });

// Replay a previous run
program
  .command('replay')
  .description('Replay a previous run from GBrain')
  .argument('<task-id>', 'Task ID to replay')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .action(async (taskId: string, options: any) => {
    console.log(chalk.blue.bold(`[GOrchestrator] Replaying task: ${taskId}`));

    // In production, would fetch run record from GBrain and replay
    console.log(chalk.yellow('Replay not implemented in MVP'));
    process.exit(0);
  });

// Benchmark mode
program
  .command('benchmark')
  .description('Run benchmark tests')
  .option('--n <number>', 'Number of benchmark runs', '10')
  .action(async (options: any) => {
    console.log(chalk.blue.bold('[GOrchestrator] Running benchmarks'));
    console.log(chalk.yellow('Benchmark not implemented in MVP'));
    process.exit(0);
  });

program.parse();
