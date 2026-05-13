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
  .option('-f, --task-file <path>', 'Read task from file')
  .option('-n, --attempts <number>', 'Number of parallel attempts', '5')
  .option('--type <type>', 'Task type (code_generation, refactor, deployment, etc.)')
  .option('--no-verify', 'Skip GMirror verification')
  .option('--cognitive-check', 'Enable GToM cognitive check')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .option('--gmirror <url>', 'GMirror endpoint', 'http://localhost:3002')
  .option('--gtom <url>', 'GToM endpoint', 'http://localhost:3003')
  .option('--gstack <url>', 'GStack endpoint', 'http://localhost:3001')
  .option('-o, --output <path>', 'Write output to file (JSON format)')
  .option('--json', 'Output as JSON to stdout')
  .action(async (task, options) => {
    // Basic input validation
    if (!task || typeof task !== 'string' || task.trim().length === 0) {
      console.error(chalk.red('Error: Task must be a non-empty string'));
      process.exit(1);
    }

    if (task.length > 10000) {
      console.error(chalk.red('Error: Task description too long (max 10000 characters)'));
      process.exit(1);
    }

    if (task.includes('\0')) {
      console.error(chalk.red('Error: Task contains invalid characters'));
      process.exit(1);
    }

    const attempts = parseInt(options.attempts);
    if (isNaN(attempts) || attempts < 1 || attempts > 100) {
      console.error(chalk.red('Error: Attempts must be between 1 and 100'));
      process.exit(1);
    }

    console.log(chalk.blue.bold('[GOrchestrator] Starting orchestration run'));
    console.log(chalk.gray(`Task: ${task}`));
    console.log(chalk.gray(`Attempts: ${attempts}`));
    console.log(chalk.gray(`Verify: ${options.verify}`));
    console.log(chalk.gray(`Cognitive Check: ${options.cognitiveCheck}`));

    const orchestrator = new GOrchestrator({
      gbrainEndpoint: options.gbrain,
      gmirrorEndpoint: options.gmirror,
      gtomEndpoint: options.gtom,
      gstackEndpoint: options.gstack,
    });

    try {
      let taskDescription = task;
      if (options.taskFile) {
        const fs = await import('fs/promises');
        const fileContent = await fs.readFile(options.taskFile, 'utf-8');
        taskDescription = fileContent.trim();
      }

      const startTime = Date.now();
      const result = await orchestrator.runTask({
        description: taskDescription,
        taskType: options.type,
        n: attempts,
        verify: options.verify,
        cognitiveCheck: options.cognitiveCheck,
      });

      const duration = Date.now() - startTime;
      const output = {
        task_id: result.task_id,
        winner: result.winner,
        attempts: result.attempts,
        total_cost_usd: result.total_cost?.total_cost_usd || 0,
        wall_time_ms: duration,
        gbrain_write_status: result.gbrain_write_status,
        timestamp: new Date().toISOString(),
      };

      if (options.json) {
        console.log(JSON.stringify(output, null, 2));
      } else if (options.output) {
        const fs = await import('fs/promises');
        await fs.writeFile(options.output, JSON.stringify(output, null, 2));
        console.log(chalk.green(`[GOrchestrator] Results written to ${options.output}`));
      } else {
        console.log(chalk.green.bold('\n[GOrchestrator] Orchestration completed'));
        console.log(chalk.gray(`Task ID: ${result.task_id}`));
        console.log(chalk.gray(`Winner: ${result.winner}`));
        console.log(chalk.gray(`Attempts: ${result.attempts.length}`));
        console.log(chalk.gray(`Total Cost: $${(result.total_cost?.total_cost_usd || 0).toFixed(4)}`));
        console.log(chalk.gray(`Wall Time: ${duration}ms`));
        console.log(chalk.gray(`GBrain Status: ${result.gbrain_write_status}`));
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('[GOrchestrator] Orchestration failed:'), error);
      process.exit(1);
    }
  });

// Health check
program
  .command('health')
  .description('Check health of GOrchestrator and dependencies')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .option('--gmirror <url>', 'GMirror endpoint', 'http://localhost:3002')
  .option('--gtom <url>', 'GToM endpoint', 'http://localhost:3003')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options: any) => {
    const orchestrator = new GOrchestrator({
      gbrainEndpoint: options.gbrain,
      gmirrorEndpoint: options.gmirror,
      gtomEndpoint: options.gtom,
    });

    const health = await orchestrator.healthCheck();

    if (options.json) {
      console.log(JSON.stringify(health, null, 2));
    } else if (!options.quiet) {
      console.log(chalk.bold('GOrchestrator Health Check'));
      console.log(chalk.gray(`Status: ${health.status}`));
      console.log('');
      console.log('Components:');
      console.log(`  GBrain: ${health.components.gbrain === 'ok' ? chalk.green('✓') : chalk.red('✗')}`);
      console.log(`  GMirror: ${health.components.gmirror === 'ok' ? chalk.green('✓') : chalk.red('✗')}`);
      console.log(`  GToM: ${health.components.gtom === 'ok' ? chalk.green('✓') : chalk.red('✗')}`);
      console.log(`  Sandbox: ${health.components.sandbox === 'ok' ? chalk.green('✓') : chalk.red('✗')}`);
    }

    process.exit(health.status === 'healthy' ? 0 : 1);
  });

// Replay a previous run
program
  .command('replay')
  .description('Replay a previous run from GBrain')
  .argument('<task-id>', 'Task ID to replay')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (taskId: string, options: any) => {
    const result = {
      task_id: taskId,
      status: 'not_implemented',
      message: 'Replay not implemented in MVP',
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!options.quiet) {
      console.log(chalk.blue.bold(`[GOrchestrator] Replaying task: ${taskId}`));
      console.log(chalk.yellow('Replay not implemented in MVP'));
    }
    process.exit(0);
  });

// Benchmark mode
program
  .command('benchmark')
  .description('Run benchmark tests')
  .option('--n <number>', 'Number of benchmark runs', '10')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options: any) => {
    const result = {
      n: parseInt(options.n),
      status: 'not_implemented',
      message: 'Benchmark not implemented in MVP',
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!options.quiet) {
      console.log(chalk.blue.bold('[GOrchestrator] Running benchmarks'));
      console.log(chalk.yellow('Benchmark not implemented in MVP'));
    }
    process.exit(0);
  });

// Eval command
program
  .command('eval')
  .description('Run evaluation on a test corpus')
  .option('-c, --corpus <path>', 'Path to test corpus JSON')
  .option('--cycles <number>', 'Number of cycles to run', '1')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .option('-o, --output <path>', 'Write output to file (JSON format)')
  .option('--json', 'Output as JSON to stdout')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options: any) => {
    const result = {
      cycles: parseInt(options.cycles),
      corpus: options.corpus,
      status: 'not_implemented',
      message: 'Eval not implemented in MVP',
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!options.quiet) {
      console.log(chalk.blue.bold('[GOrchestrator] Running evaluation'));
      console.log(chalk.yellow('Eval not implemented in MVP'));
    }
    process.exit(0);
  });

// Regress command
program
  .command('regress')
  .description('Compare current performance against baseline')
  .option('-b, --baseline <path>', 'Path to baseline file')
  .option('-c, --corpus <path>', 'Path to test corpus JSON')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .option('--tolerance <number>', 'Tolerance for regression detection', '0.05')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options: any) => {
    const result = {
      baseline: options.baseline,
      corpus: options.corpus,
      tolerance: parseFloat(options.tolerance),
      status: 'not_implemented',
      message: 'Regress not implemented in MVP',
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!options.quiet) {
      console.log(chalk.blue.bold('[GOrchestrator] Running regression test'));
      console.log(chalk.yellow('Regress not implemented in MVP'));
    }
    process.exit(0);
  });

// Attempts command
program
  .command('attempts')
  .description('Show attempt statistics from recent runs')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .option('--limit <number>', 'Number of recent runs to show', '10')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options: any) => {
    const result = {
      limit: parseInt(options.limit),
      status: 'not_implemented',
      message: 'Attempts command not implemented in MVP',
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!options.quiet) {
      console.log(chalk.blue.bold('[GOrchestrator] Fetching attempt statistics'));
      console.log(chalk.yellow('Attempts command not implemented in MVP'));
    }
    process.exit(0);
  });

// Sandbox-stats command
program
  .command('sandbox-stats')
  .description('Show sandbox execution statistics')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options: any) => {
    const result = {
      status: 'not_implemented',
      message: 'Sandbox-stats not implemented in MVP',
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!options.quiet) {
      console.log(chalk.blue.bold('[GOrchestrator] Fetching sandbox statistics'));
      console.log(chalk.yellow('Sandbox-stats not implemented in MVP'));
    }
    process.exit(0);
  });

// Drift command
program
  .command('drift')
  .description('Check for performance drift over time')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options: any) => {
    const result = {
      status: 'not_implemented',
      message: 'Drift not implemented in MVP',
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!options.quiet) {
      console.log(chalk.blue.bold('[GOrchestrator] Checking for drift'));
      console.log(chalk.yellow('Drift not implemented in MVP'));
    }
    process.exit(0);
  });

// Cost command
program
  .command('cost')
  .description('Show cost information')
  .option('--day', 'Show today\'s spend (default)')
  .option('--week', 'Show this week\'s spend')
  .option('--month', 'Show this month\'s spend')
  .option('--by-model', 'Break down by model')
  .option('--by-operation', 'Break down by operation')
  .option('--json', 'Output as JSON')
  .action(async (options: any) => {
    try {
      const { BudgetLedger } = await import('../core/budget-ledger.js');
      const ledger = new BudgetLedger('gorchestrator');
      await ledger.init();

      let spend = 0;
      if (options.week) {
        spend = ledger.getWeeklySpend();
      } else if (options.month) {
        spend = ledger.getMonthlySpend();
      } else {
        spend = ledger.getDailySpend();
      }

      if (options.json) {
        const breakdown = {};
        if (options.byModel) {
          breakdown['by_model'] = ledger.getSpendByModel();
        }
        if (options.byOperation) {
          breakdown['by_operation'] = ledger.getSpendByScope();
        }
        console.log(JSON.stringify({ spend, ...breakdown }, null, 2));
      } else {
        const period = options.week ? 'this week' : options.month ? 'this month' : 'today';
        console.log(chalk.blue(`LLM Spend ${period}: $${spend.toFixed(4)}`));
        
        if (options.byModel) {
          const byModel = ledger.getSpendByModel();
          console.log(chalk.gray('\nBy model:'));
          for (const [model, cost] of Object.entries(byModel)) {
            console.log(`  ${model}: $${(cost as number).toFixed(4)}`);
          }
        }
        
        if (options.byOperation) {
          const byOp = ledger.getSpendByScope();
          console.log(chalk.gray('\nBy operation:'));
          for (const [op, cost] of Object.entries(byOp)) {
            console.log(`  ${op}: $${(cost as number).toFixed(4)}`);
          }
        }
      }
      
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('[GOrchestrator] Cost query failed:'), error);
      process.exit(1);
    }
  });

program.parse();
