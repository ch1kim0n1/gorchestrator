#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { GOrchestrator } from './core/orchestrator.js';
import { bestOfCommand } from './commands/best-of.js';
import { regressCommand } from './commands/regress.js';
import { trendCommand } from './commands/trend.js';
import { OrchestratorPersistenceManager } from './core/orchestrator-persistence.js';
import { GStackGBrainSync } from './core/gstack-gbrain-sync.js';
import {
  getDefaultSecretManager,
  sanitizeCliInteger,
  sanitizeCliPath,
  sanitizeCliString,
  sanitizeCliUrl,
} from './core/security.js';
import { BenchmarkSample, memorySnapshotMb, summarizeBenchmark } from './core/performance.js';

const program = new Command();

program
  .name('gorchestrator')
  .description('Parallel agent execution manager for the G-Stack')
  .version('0.1.0');

program
  .command('backup [destination]')
  .description('Backup GOrchestrator SQLite state')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (destination, options) => {
    const persistence = new OrchestratorPersistenceManager();
    try {
      const backupPath = persistence.backup(destination);
      if (options.json) {
        console.log(JSON.stringify({ backup_path: backupPath }, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.green(`Backup written: ${backupPath}`));
      }
    } finally {
      persistence.close();
    }
  });

program
  .command('restore <backup>')
  .description('Restore GOrchestrator SQLite state from backup')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (backup, options) => {
    const persistence = new OrchestratorPersistenceManager();
    try {
      persistence.restore(backup);
      if (options.json) {
        console.log(JSON.stringify({ restored_from: backup }, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.green(`Restored from: ${backup}`));
      }
    } finally {
      persistence.close();
    }
  });

program
  .command('export')
  .description('Export persisted GOrchestrator state')
  .option('--format <format>', 'Export format: json', 'json')
  .option('--json', 'Alias for --format json')
  .action(async (options) => {
    const format = options.json ? 'json' : String(options.format || 'json').toLowerCase();
    if (format !== 'json') {
      console.error(chalk.red(`Unsupported export format: ${format}`));
      process.exit(1);
    }

    const persistence = new OrchestratorPersistenceManager();
    try {
      console.log(JSON.stringify(persistence.exportJson(), null, 2));
    } finally {
      persistence.close();
    }
  });

const secretsCommand = program
  .command('secrets')
  .description('Manage GOrchestrator local secret-manager records');

secretsCommand
  .command('rotate <name>')
  .description('Rotate or set a secret-manager value')
  .option('--value <value>', 'Explicit secret value; omit to generate a new high-entropy value')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action((name: string, options: any) => {
    try {
      const manager = getDefaultSecretManager();
      const record = manager.rotate(name, options.value ? sanitizeCliString(options.value, 'secret value', 8192) : undefined);
      const output = {
        name: record.name,
        version: record.version,
        rotated_at: record.rotated_at,
        path: manager.pathFor(record.name),
      };
      if (options.json) {
        console.log(JSON.stringify(output, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.green(`Secret rotated: ${record.name} v${record.version}`));
        console.log(chalk.gray(`Path: ${output.path}`));
      }
    } catch (error) {
      console.error(chalk.red(`Secret rotation failed: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

secretsCommand
  .command('list')
  .description('List configured secret-manager records without values')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action((options: any) => {
    const records = getDefaultSecretManager().list();
    if (options.json) {
      console.log(JSON.stringify(records, null, 2));
    } else if (!options.quiet) {
      for (const record of records) {
        console.log(`${record.name}\tv${record.version}\t${record.source}\t${record.rotated_at}`);
      }
    }
  });

program
  .command('metrics')
  .description('Export GOrchestrator observability metrics')
  .option('--format <format>', 'Export format: prometheus, otel, or json', 'prometheus')
  .option('--json', 'Alias for --format json')
  .action(async (options) => {
    const format = options.json ? 'json' : String(options.format || 'prometheus').toLowerCase();
    const orchestrator = new GOrchestrator();
    if (format === 'prometheus') {
      console.log(orchestrator.exportPrometheusMetrics());
    } else if (format === 'otel') {
      console.log(JSON.stringify(orchestrator.exportOpenTelemetryMetrics(), null, 2));
    } else if (format === 'json') {
      console.log(JSON.stringify(orchestrator.getObservabilitySnapshot(), null, 2));
    } else {
      console.error(chalk.red(`Unsupported metrics format: ${format}`));
      process.exit(1);
    }
  });

// Run a task through orchestration
program
  .command('run')
  .description('Run a task through parallel orchestration')
  .argument('<task>', 'Task description')
  .option('-f, --task-file <path>', 'Read task from file')
  .option('-n, --attempts <number>', 'Number of parallel attempts', '5')
  .option('--cycles <number>', 'Number of orchestration cycles to run', '1')
  .option('--budget-usd <number>', 'Maximum task budget in USD', '100')
  .option('--type <type>', 'Task type (code_generation, refactor, deployment, etc.)')
  .option('--no-verify', 'Skip GMirror verification')
  .option('--cognitive-check', 'Enable GToM cognitive check')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .option('--gmirror <url>', 'GMirror endpoint', 'http://localhost:3002')
  .option('--gtom <url>', 'GToM endpoint', 'http://localhost:3003')
  .option('--gstack <url>', 'GStack endpoint', 'http://localhost:3001')
  .option('-o, --output <path>', 'Write output to file (JSON format)')
  .option('--json', 'Output as JSON to stdout')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (task, options) => {
    // Basic input validation
    task = sanitizeCliString(task, 'task', 10000).trim();
    if (!task) {
      console.error(chalk.red('Error: Task must be a non-empty string'));
      process.exit(1);
    }

    const attempts = sanitizeCliInteger(options.attempts, 'attempts', 1, 100);
    const cycles = sanitizeCliInteger(options.cycles, 'cycles', 1, 100);
    const budgetUsd = parseFloat(options.budgetUsd);
    if (isNaN(budgetUsd) || budgetUsd <= 0) {
      console.error(chalk.red('Error: Budget must be a positive number'));
      process.exit(1);
    }
    options.gbrain = sanitizeCliUrl(options.gbrain, 'gbrain endpoint');
    options.gmirror = sanitizeCliUrl(options.gmirror, 'gmirror endpoint');
    options.gtom = sanitizeCliUrl(options.gtom, 'gtom endpoint');
    options.gstack = sanitizeCliUrl(options.gstack, 'gstack endpoint');

    if (!options.quiet) {
      console.log(chalk.blue.bold('[GOrchestrator] Starting orchestration run'));
      console.log(chalk.gray(`Task: ${task}`));
      console.log(chalk.gray(`Attempts: ${attempts}`));
      console.log(chalk.gray(`Cycles: ${cycles}`));
      console.log(chalk.gray(`Budget: $${budgetUsd.toFixed(2)}`));
      console.log(chalk.gray(`Verify: ${options.verify}`));
      console.log(chalk.gray(`Cognitive Check: ${options.cognitiveCheck}`));
    }

    const orchestrator = new GOrchestrator({
      gbrainEndpoint: options.gbrain,
      gmirrorEndpoint: options.gmirror,
      gtomEndpoint: options.gtom,
      gstackEndpoint: options.gstack,
    });

    try {
      let taskDescription = task;
      if (options.taskFile) {
        const taskFile = sanitizeCliPath(options.taskFile, 'task file');
        const fs = await import('fs/promises');
        const fileContent = await fs.readFile(taskFile, 'utf-8');
        taskDescription = fileContent.trim();
      }

      const cycleOutputs = [];
      for (let cycle = 0; cycle < cycles; cycle++) {
        if (cycles > 1 && !options.quiet) {
          console.log(chalk.gray(`Cycle ${cycle + 1}/${cycles}`));
        }
        const startTime = Date.now();
        const result = await orchestrator.runTask({
          description: taskDescription,
          taskType: options.type,
          n: attempts,
          verify: options.verify,
          cognitiveCheck: options.cognitiveCheck,
          budget: {
            max_attempts: attempts,
            max_cost_usd: budgetUsd,
            max_wall_time_ms: 300000,
            max_parallelism: attempts,
          },
        });

        const duration = Date.now() - startTime;
        cycleOutputs.push({
          cycle: cycle + 1,
          task_id: result.task_id,
          winner: result.winner,
          attempts: result.attempts,
          total_cost_usd: result.total_cost?.total_cost_usd || 0,
          wall_time_ms: duration,
          gbrain_write_status: result.gbrain_write_status,
          timestamp: new Date().toISOString(),
        });
      }

      const output = cycles === 1 ? cycleOutputs[0] : {
        cycles,
        budget_usd: budgetUsd,
        total_runs: cycleOutputs.length,
        avg_cost_usd: cycleOutputs.reduce((sum, result) => sum + result.total_cost_usd, 0) / cycleOutputs.length,
        avg_wall_time_ms: cycleOutputs.reduce((sum, result) => sum + result.wall_time_ms, 0) / cycleOutputs.length,
        results: cycleOutputs,
      };
      const latest = cycleOutputs[cycleOutputs.length - 1];

      if (options.json) {
        console.log(JSON.stringify(output, null, 2));
      } else if (options.output) {
        const fs = await import('fs/promises');
        await fs.writeFile(options.output, JSON.stringify(output, null, 2));
        if (!options.quiet) {
          console.log(chalk.green(`[GOrchestrator] Results written to ${options.output}`));
        }
      } else if (!options.quiet) {
        console.log(chalk.green.bold('\n[GOrchestrator] Orchestration completed'));
        console.log(chalk.gray(`Task ID: ${latest.task_id}`));
        console.log(chalk.gray(`Winner: ${latest.winner}`));
        console.log(chalk.gray(`Attempts: ${latest.attempts.length}`));
        console.log(chalk.gray(`Total Cost: $${latest.total_cost_usd.toFixed(4)}`));
        console.log(chalk.gray(`Wall Time: ${latest.wall_time_ms}ms`));
        console.log(chalk.gray(`GBrain Status: ${latest.gbrain_write_status}`));
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
  .option('--gstack <url>', 'GStack endpoint', 'http://localhost:3001')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options: any) => {
    const orchestrator = new GOrchestrator({
      gbrainEndpoint: options.gbrain,
      gmirrorEndpoint: options.gmirror,
      gtomEndpoint: options.gtom,
      gstackEndpoint: options.gstack,
    });

    const health = await orchestrator.healthCheck();
    const components = health.components;
    const status = health.status;

    if (options.json) {
      console.log(JSON.stringify(health, null, 2));
    } else if (!options.quiet) {
      console.log(chalk.bold('GOrchestrator Health Check'));
      console.log(chalk.gray(`Status: ${status}`));
      console.log('');
      console.log('Components:');
      console.log(`  GStack: ${components.gstack === 'ok' ? chalk.green('ok') : chalk.red('error')}`);
      console.log(`  GBrain: ${components.gbrain === 'ok' ? chalk.green('✓') : chalk.red('✗')}`);
      console.log(`  GMirror: ${components.gmirror === 'ok' ? chalk.green('✓') : chalk.red('✗')}`);
      console.log(`  GToM: ${components.gtom === 'ok' ? chalk.green('✓') : chalk.red('✗')}`);
      console.log(`  Sandbox: ${components.sandbox === 'ok' ? chalk.green('✓') : chalk.red('✗')}`);
    }

    process.exit(status === 'healthy' ? 0 : 1);
  });

program
  .command('sync')
  .description('Sync GOrchestrator and stack tool sources into GBrain')
  .option('--incremental', 'Run incremental sync (default)')
  .option('--full', 'Run full sync and clean legacy source registrations')
  .option('--dry-run', 'Show planned sync without writing files or registering sources')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options: any) => {
    const mode = options.full ? 'full' : 'incremental';
    const sync = new GStackGBrainSync();

    if (!options.quiet && !options.json) {
      console.log(chalk.blue(`[GOrchestrator] Syncing stack sources (${mode}${options.dryRun ? ', dry run' : ''})`));
    }

    const result = await sync.run({ mode, dryRun: options.dryRun });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!options.quiet) {
      for (const stage of result.stages) {
        const color = stage.status === 'ok' ? 'green' : stage.status === 'skipped' ? 'yellow' : 'red';
        console.log(`  ${chalk[color](stage.status.padEnd(7))} ${stage.stage}: ${stage.items_changed}/${stage.items_total} changed`);
        if (stage.error) console.log(`    ${chalk.red(stage.error)}`);
      }
      const statusColor = result.status === 'ok' ? 'green' : result.status === 'partial' ? 'yellow' : 'red';
      console.log(chalk[statusColor](`[GOrchestrator] Sync ${result.status}`));
    }

    process.exit(result.status === 'ok' ? 0 : 1);
  });

// Replay a previous run
program
  .command('replay')
  .description('Replay a previous run from receipt or corpus')
  .argument('<id>', 'Receipt path, receipt ID, corpus_sha8, or content hash to replay')
  .option('--corpus <path>', 'Path to corpus directory', './.gbrain-corpus')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (id: string, options: any) => {
    try {
      const isHash = /^[a-f0-9]{64}$/i.test(id);
      const isCorpusSha8 = /^[a-f0-9]{8}$/i.test(id);
      if (!isHash) {
        const { ReceiptRegistry } = await import('./core/receipt-registry.js');
        const receiptRegistry = new ReceiptRegistry('gorchestrator');
        const receipt = isCorpusSha8
          ? (await receiptRegistry.getByCorpusSha8(id)).at(-1)
          : await receiptRegistry.getByIdOrPath(id);

        if (!receipt) {
          console.error(chalk.red(`[GOrchestrator] Receipt not found: ${id}`));
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify(receipt, null, 2));
        } else if (!options.quiet) {
          console.log(chalk.blue.bold(`[GOrchestrator] Replaying receipt: ${receipt.receipt_id}`));
          console.log(chalk.gray(`Timestamp: ${receipt.timestamp}`));
          console.log(chalk.gray(`Corpus: ${receipt.metadata?.corpus_sha8 || receipt.input_hash.substring(0, 8)}`));
          console.log(chalk.gray(`Verdict: ${receipt.verdict}`));
          console.log(chalk.gray(`Score: ${receipt.overall_score.toFixed(3)}`));
        }
        process.exit(0);
      }

      const { ReplayManager } = await import('../../shared/src/core/replay-manager.js');
      const replayManager = new ReplayManager(options.corpus);
      
      const result = await replayManager.retrieve(id);
      
      if (!result.found) {
        console.error(chalk.red(`[GOrchestrator] Hash not found in corpus: ${id}`));
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.blue.bold(`[GOrchestrator] Replaying hash: ${id}`));
        console.log(chalk.gray(`Tool: ${result.metadata.tool}`));
        console.log(chalk.gray(`Timestamp: ${result.metadata.timestamp}`));
        console.log(chalk.gray(`Task: ${result.metadata.task || 'N/A'}`));
        console.log(chalk.green('\nContent:'));
        console.log(result.content);
      }
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('[GOrchestrator] Replay failed:'), error);
      process.exit(1);
    }
  });

// Benchmark mode
program
  .command('benchmark')
  .description('Run benchmark tests')
  .option('--n <number>', 'Number of benchmark runs', '10')
  .option('--max-concurrency <number>', 'Overall task concurrency limit', '2')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options: any) => {
    const n = sanitizeCliInteger(options.n, '--n', 1, 100);
    const maxConcurrency = sanitizeCliInteger(options.maxConcurrency, '--max-concurrency', 1, 64);
    const previousMock = process.env.MOCK_SANDBOX;
    process.env.MOCK_SANDBOX = previousMock ?? '1';
    const orchestrator = new GOrchestrator({ maxConcurrency });
    const samples: BenchmarkSample[] = [];
    for (let i = 0; i < n; i++) {
      const started = performance.now();
      let success = false;
      try {
        await orchestrator.runTask({
          description: `Benchmark synthetic task ${i + 1}`,
          taskType: 'code_generation',
          budget: { max_attempts: 1, max_cost_usd: 1, max_wall_time_ms: 15000, max_parallelism: maxConcurrency },
          verify: false,
        });
        success = true;
      } catch {
        success = false;
      }
      const memory = memorySnapshotMb();
      samples.push({
        name: `synthetic-${i + 1}`,
        duration_ms: Number((performance.now() - started).toFixed(2)),
        success,
        ...memory,
      });
    }
    if (previousMock === undefined) {
      delete process.env.MOCK_SANDBOX;
    } else {
      process.env.MOCK_SANDBOX = previousMock;
    }
    const result = {
      status: 'completed',
      n,
      maxConcurrency,
      summary: summarizeBenchmark(samples),
      samples,
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!options.quiet) {
      console.log(chalk.blue.bold('[GOrchestrator] Running benchmarks'));
      console.log(chalk.green(`Completed ${n} runs`));
      console.log(chalk.gray(`p50=${result.summary.p50_ms}ms p95=${result.summary.p95_ms}ms success=${(result.summary.success_rate * 100).toFixed(1)}% maxRSS=${result.summary.max_rss_mb}MB`));
    }
    process.exit(result.summary.success_rate === 1 ? 0 : 1);
  });

// Eval command
program
  .command('eval')
  .description('Run evaluation on a test corpus')
  .argument('[mode]', 'Optional mode, e.g. regress')
  .option('-c, --corpus <path>', 'Path to test corpus JSON')
  .option('--against <receipt>', 'Receipt path or ID to compare against in regress mode')
  .option('--cycles <number>', 'Number of cycles to run', '1')
  .option('--budget-usd <number>', 'Maximum task budget in USD per eval case', '100')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .option('-o, --output <path>', 'Write output to file (JSON format)')
  .option('--json', 'Output as JSON to stdout')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (mode: string | undefined, options: any) => {
    if (mode === 'regress') {
      await runReceiptRegression(options.against, options);
      return;
    }

    const cycles = parseInt(options.cycles);
    const budgetUsd = parseFloat(options.budgetUsd);
    if (isNaN(budgetUsd) || budgetUsd <= 0) {
      console.error(chalk.red('[GOrchestrator] --budget-usd must be a positive number'));
      process.exit(1);
    }
    const result = {
      cycles,
      budget_usd: budgetUsd,
      corpus: options.corpus,
      status: 'not_implemented',
      message: 'Eval requires additional setup - see TESTING.md for implementation guidance',
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!options.quiet) {
      console.log(chalk.blue.bold('[GOrchestrator] Running evaluation'));
      console.log(chalk.yellow(`Eval not fully implemented in MVP (${cycles} cycles requested)`));
      console.log(chalk.gray('See TESTING.md for implementation guidance'));
    }
    process.exit(0);
  });

program
  .command('receipts')
  .description('List execution receipts')
  .option('--since <date>', 'Only include receipts since YYYY-MM-DD')
  .option('--until <date>', 'Only include receipts up to YYYY-MM-DD')
  .option('--limit <n>', 'Maximum number of receipts to print', '50')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options: any) => {
    try {
      const { ReceiptRegistry } = await import('./core/receipt-registry.js');
      const receiptRegistry = new ReceiptRegistry('gorchestrator');
      const start = options.since ? new Date(options.since) : new Date(0);
      const end = options.until ? new Date(options.until) : new Date();
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        console.error(chalk.red('[GOrchestrator] --since/--until must be valid dates'));
        process.exit(1);
      }

      const limit = parseInt(options.limit);
      if (isNaN(limit) || limit < 1) {
        console.error(chalk.red('[GOrchestrator] --limit must be a positive integer'));
        process.exit(1);
      }

      const receipts = (await receiptRegistry.getAllBetween(start, end)).slice(-limit);
      if (options.json) {
        console.log(JSON.stringify(receipts, null, 2));
      } else if (!options.quiet) {
        for (const receipt of receipts) {
          console.log(`${receipt.timestamp} ${receipt.receipt_id} ${receipt.verdict} score=${receipt.overall_score.toFixed(3)} corpus=${receipt.metadata?.corpus_sha8 || receipt.input_hash.substring(0, 8)}`);
        }
      }
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('[GOrchestrator] Receipt query failed:'), error);
      process.exit(1);
    }
  });

program
  .command('diff <receiptA> <receiptB>')
  .description('Diff two execution receipts')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (receiptA: string, receiptB: string, options: any) => {
    try {
      const { ReceiptRegistry } = await import('./core/receipt-registry.js');
      const receiptRegistry = new ReceiptRegistry('gorchestrator');
      const a = await receiptRegistry.getByIdOrPath(receiptA);
      const b = await receiptRegistry.getByIdOrPath(receiptB);
      if (!a || !b) {
        console.error(chalk.red('[GOrchestrator] Both receipts must exist'));
        process.exit(1);
      }

      const diff = receiptRegistry.diff(a, b);
      if (options.json) {
        console.log(JSON.stringify(diff, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.blue.bold('[GOrchestrator] Receipt Diff'));
        console.log(`  Verdict: ${diff.verdict.from} -> ${diff.verdict.to}`);
        console.log(`  Overall score: ${diff.overall_score.from} -> ${diff.overall_score.to} (${diff.overall_score.delta >= 0 ? '+' : ''}${diff.overall_score.delta.toFixed(3)})`);
        console.log(`  Cost: $${diff.cost_usd.from.toFixed(4)} -> $${diff.cost_usd.to.toFixed(4)} (${diff.cost_usd.delta >= 0 ? '+' : ''}${diff.cost_usd.delta.toFixed(4)})`);
      }
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('[GOrchestrator] Receipt diff failed:'), error);
      process.exit(1);
    }
  });

// Regress command
program
  .command('regress <task>')
  .description('Test for regression against a baseline run')
  .option('-b, --baseline <run_id>', 'Baseline run ID to compare against (or "last")', 'last')
  .option('-m, --model <model>', 'Model to use', 'claude-haiku-4-5-20251001')
  .option('-t, --threshold <n>', 'Regression threshold (relative score below this = regression)', (v: string) => parseFloat(v), 0.85)
  .option('--json', 'Output as JSON')
  .action(async (task: string, opts: any) => {
    await regressCommand(task, {
      baseline: opts.baseline,
      model: opts.model,
      threshold: opts.threshold,
      json: opts.json ?? false,
    });
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
    const limit = parseInt(options.limit);
    const result = {
      limit,
      status: 'not_implemented',
      message: 'Attempts command requires additional setup - see TESTING.md for implementation guidance',
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!options.quiet) {
      console.log(chalk.blue.bold('[GOrchestrator] Fetching attempt statistics'));
      console.log(chalk.yellow(`Attempts command not fully implemented in MVP (limit: ${limit})`));
      console.log(chalk.gray('See TESTING.md for implementation guidance'));
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
      message: 'Sandbox-stats requires additional setup - see TESTING.md for implementation guidance',
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!options.quiet) {
      console.log(chalk.blue.bold('[GOrchestrator] Fetching sandbox statistics'));
      console.log(chalk.yellow('Sandbox-stats not fully implemented in MVP'));
      console.log(chalk.gray('See TESTING.md for implementation guidance'));
    }
    process.exit(0);
  });

// Drift command
program
  .command('drift')
  .description('Check for performance drift over time')
  .option('--corpus <path>', 'Path to corpus directory for drift data', './.gbrain-corpus')
  .option('--window <duration>', 'Current analysis window, e.g. 7d, 24h, 30m', '7d')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options: any) => {
    try {
      const { ReceiptRegistry } = await import('./core/receipt-registry.js');
      const { analyzeCohortDrift, parseWindowDuration } = await import('./core/drift-analysis.js');
      const windowMs = parseWindowDuration(options.window);
      const registry = new ReceiptRegistry('gorchestrator');
      const end = new Date();
      const start = new Date(end.getTime() - windowMs * 2);
      const receipts = await registry.getAllBetween(start, end);
      const snapshots = receipts.map((receipt: any) => {
        const successRate = receipt.hard_gates_passed && receipt.verdict !== 'fail' ? 1 : 0;
        return {
          cohort: receipt.metadata?.cohort || receipt.metadata?.task_type || receipt.metadata?.task_id || 'default',
          timestamp: receipt.timestamp,
          count: 1,
          total: 1,
          frustrated: successRate < 0.5,
          metrics: {
            success_rate: successRate,
            latency_ms: Number(receipt.metadata?.latency_ms || receipt.metadata?.duration_ms || 0),
            cost_usd: receipt.cost_usd || 0,
          },
        };
      });
      const driftResults = analyzeCohortDrift(snapshots, { windowMs, now: end, seed: 'gorchestrator-drift' });
      const alerts = driftResults.filter(result =>
        result.anomalies.length > 0 || result.frustration_wilson_95_ci.degraded,
      );

      if (options.json) {
        console.log(JSON.stringify({
          window: options.window,
          cohorts: driftResults,
          drift_results: driftResults,
          alerts,
        }, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.blue.bold('[GOrchestrator] Checking for drift'));
        console.log(chalk.green.bold('\n[GOrchestrator] Drift Analysis'));
        console.log(chalk.gray(`Window: ${options.window}`));
        console.log(chalk.gray(`Cohorts tracked: ${driftResults.length}`));
        console.log(chalk.gray(`Drift detected: ${alerts.length > 0 ? 'Yes' : 'No'}`));
        
        if (driftResults.length > 0) {
          console.log(chalk.bold('\nDrift Results:'));
          for (const result of driftResults) {
            const status = result.anomalies.length > 0 || result.frustration_wilson_95_ci.degraded ? chalk.red('ALERT') : chalk.green('OK');
            console.log(`  ${status} ${result.cohort}: samples=${result.sample_size} anomalies=${result.anomalies.length} new=${result.brand_new}`);
          }
        }

        if (alerts.length > 0) {
          console.log(chalk.red.bold('\nAlerts:'));
          for (const alert of alerts) {
            console.log(`  ${alert.cohort}: ${alert.anomalies.map((anomaly: any) => `${anomaly.metric}:${anomaly.reason}`).join(', ') || 'success_rate_wilson_degraded'}`);
          }
        }
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('[GOrchestrator] Drift check failed:'), error);
      process.exit(1);
    }
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
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options: any) => {
    try {
      const { BudgetLedger } = await import('./core/budget-ledger.js');
      const ledger = new BudgetLedger({ max_budget_usd: 1000 }, 'gorchestrator');
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
        const breakdown: Record<string, any> = {};
        if (options.byModel) {
          breakdown['by_model'] = ledger.getSpendByModel();
        }
        if (options.byOperation) {
          breakdown['by_operation'] = ledger.getSpendByOperation();
        }
        console.log(JSON.stringify({ spend, ...breakdown }, null, 2));
      } else if (!options.quiet) {
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
          const byOp = ledger.getSpendByOperation();
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

// Trend command
program
  .command('trend')
  .description('Show score trend over recent best-of runs')
  .option('-n, --runs <n>', 'Number of recent runs to analyze', (v: string) => parseInt(v, 10), 50)
  .option('--json', 'Output as JSON')
  .action(async (opts: any) => {
    await trendCommand({
      runs: opts.runs,
      json: opts.json ?? false,
    });
  });

program
  .command('completion')
  .description('Print shell completion script')
  .argument('[shell]', 'Shell type: bash, zsh, or fish', 'bash')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action((shell: string, options: any) => {
    const normalized = String(shell).toLowerCase();
    const script = buildCompletionScript(normalized);
    if (!script) {
      console.error(chalk.red('[GOrchestrator] Shell must be one of: bash, zsh, fish'));
      process.exit(1);
    }
    if (options.json) {
      console.log(JSON.stringify({ shell: normalized, script }, null, 2));
    } else if (!options.quiet) {
      console.log(script);
    }
    process.exit(0);
  });

program
  .command('best-of <task>')
  .description('Run N parallel LLM attempts and return the best-scored one (no external services required)')
  .option('-n, --n <count>', 'Number of parallel attempts', (v: string) => parseInt(v, 10), 3)
  .option('-m, --model <model>', 'Generator model', 'claude-haiku-4-5-20251001')
  .option('--scorer-model <model>', 'Scorer model', 'claude-haiku-4-5-20251001')
  .option('-s, --system <prompt>', 'System prompt override')
  .option('--max-cost <usd>', 'Abort if estimated cost exceeds this amount', parseFloat)
  .option('--json', 'Output as JSON')
  .action(async (task: string, opts: any) => {
    await bestOfCommand(task, {
      n: opts.n,
      model: opts.model,
      scorerModel: opts.scorerModel,
      system: opts.system,
      maxCost: opts.maxCost,
      json: opts.json ?? false,
    });
  });

async function runReceiptRegression(against: string | undefined, options: any): Promise<void> {
  if (!against) {
    console.error(chalk.red('[GOrchestrator] --against is required for receipt regression'));
    process.exit(1);
  }

  const { ReceiptRegistry } = await import('./core/receipt-registry.js');
  const receiptRegistry = new ReceiptRegistry('gorchestrator');
  const baseline = await receiptRegistry.getByIdOrPath(against);
  const latest = await receiptRegistry.getLatest();

  if (!baseline || !latest) {
    console.error(chalk.red('[GOrchestrator] Baseline and latest receipts must both exist'));
    process.exit(1);
  }

  const diff = receiptRegistry.diff(baseline, latest);
  const regressionPassed =
    latest.overall_score >= baseline.overall_score &&
    latest.hard_gates_passed &&
    latest.verdict !== 'fail';

  const result = {
    passed: regressionPassed,
    baseline_receipt: baseline.receipt_id,
    current_receipt: latest.receipt_id,
    baseline_score: baseline.overall_score,
    current_score: latest.overall_score,
    delta: latest.overall_score - baseline.overall_score,
    diff,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!options.quiet) {
    console.log(chalk.blue.bold('[GOrchestrator] Receipt Regression Check'));
    console.log(`  Status: ${regressionPassed ? chalk.green('PASSED') : chalk.red('FAILED')}`);
    console.log(`  Baseline: ${baseline.receipt_id} (${baseline.overall_score.toFixed(3)})`);
    console.log(`  Current: ${latest.receipt_id} (${latest.overall_score.toFixed(3)})`);
    console.log(`  Delta: ${result.delta >= 0 ? chalk.green(`+${result.delta.toFixed(3)}`) : chalk.red(result.delta.toFixed(3))}`);
  }

  process.exit(regressionPassed ? 0 : 1);
}

function buildCompletionScript(shell: string): string | null {
  const commands = [
    'backup',
    'restore',
    'export',
    'metrics',
    'secrets',
    'rotate',
    'list',
    'run',
    'health',
    'sync',
    'replay',
    'benchmark',
    'eval',
    'receipts',
    'diff',
    'regress',
    'attempts',
    'sandbox-stats',
    'drift',
    'cost',
    'trend',
    'completion',
  ];
  const options = [
    '--help',
    '--version',
    '--json',
    '--format',
    '--quiet',
    '--cycles',
    '--budget-usd',
    '--attempts',
    '--gbrain',
    '--gmirror',
    '--gtom',
    '--gstack',
    '--output',
    '--corpus',
    '--against',
    '--incremental',
    '--full',
    '--dry-run',
    '--value',
  ];
  const words = [...commands, ...options].join(' ');

  if (shell === 'bash') {
    return `_gorchestrator_completions()
{
  local cur
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  COMPREPLY=( $(compgen -W "${words}" -- "$cur") )
}
complete -F _gorchestrator_completions gorchestrator`;
  }

  if (shell === 'zsh') {
    return `#compdef gorchestrator
_arguments '1:command:(${commands.join(' ')})' '*::option:(${options.join(' ')})'`;
  }

  if (shell === 'fish') {
    return [
      ...commands.map(command => `complete -c gorchestrator -f -a ${command}`),
      ...options.map(option => `complete -c gorchestrator -f -l ${option.slice(2)}`),
    ].join('\n');
  }

  return null;
}

program.parse();
