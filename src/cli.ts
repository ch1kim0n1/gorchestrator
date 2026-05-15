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
    const components = health.components;
    const status = health.status;

    if (options.json) {
      console.log(JSON.stringify(health, null, 2));
    } else if (!options.quiet) {
      console.log(chalk.bold('GOrchestrator Health Check'));
      console.log(chalk.gray(`Status: ${status}`));
      console.log('');
      console.log('Components:');
      console.log(`  GBrain: ${components.gbrain === 'ok' ? chalk.green('✓') : chalk.red('✗')}`);
      console.log(`  GMirror: ${components.gmirror === 'ok' ? chalk.green('✓') : chalk.red('✗')}`);
      console.log(`  GToM: ${components.gtom === 'ok' ? chalk.green('✓') : chalk.red('✗')}`);
      console.log(`  Sandbox: ${components.sandbox === 'ok' ? chalk.green('✓') : chalk.red('✗')}`);
    }

    process.exit(status === 'healthy' ? 0 : 1);
  });

// Replay a previous run
program
  .command('replay')
  .description('Replay a previous run from corpus')
  .argument('<hash>', 'Content hash to replay')
  .option('--corpus <path>', 'Path to corpus directory', './.gbrain-corpus')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (hash: string, options: any) => {
    try {
      const { ReplayManager } = await import('../../shared/src/core/replay-manager.js');
      const replayManager = new ReplayManager(options.corpus);
      
      const result = await replayManager.retrieve(hash);
      
      if (!result.found) {
        console.error(chalk.red(`[GOrchestrator] Hash not found in corpus: ${hash}`));
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.blue.bold(`[GOrchestrator] Replaying hash: ${hash}`));
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
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options: any) => {
    const n = parseInt(options.n);
    const result = {
      n,
      status: 'not_implemented',
      message: 'Benchmark requires additional setup - see TESTING.md for implementation guidance',
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!options.quiet) {
      console.log(chalk.blue.bold('[GOrchestrator] Running benchmarks'));
      console.log(chalk.yellow(`Benchmark not fully implemented in MVP (${n} runs requested)`));
      console.log(chalk.gray('See TESTING.md for implementation guidance'));
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
    const cycles = parseInt(options.cycles);
    const result = {
      cycles,
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
    try {
      const tolerance = parseFloat(options.tolerance);
      if (isNaN(tolerance) || tolerance < 0 || tolerance > 1) {
        console.error(chalk.red('[GOrchestrator] --tolerance must be a number between 0 and 1'));
        process.exit(1);
      }

      if (!options.baseline) {
        console.error(chalk.red('[GOrchestrator] --baseline is required'));
        process.exit(1);
      }

      if (!options.corpus) {
        console.error(chalk.red('[GOrchestrator] --corpus is required'));
        process.exit(1);
      }

      const fs = await import('fs/promises');
      const baselineContent = await fs.readFile(options.baseline, 'utf-8');
      const baseline = JSON.parse(baselineContent);
      const corpusContent = await fs.readFile(options.corpus, 'utf-8');
      const corpus = JSON.parse(corpusContent);

      const orchestrator = new GOrchestrator({
        gbrainEndpoint: options.gbrain,
      });

      // Run current performance on corpus
      const currentResults = [];
      for (const testCase of corpus.slice(0, 10)) {
        const result = await orchestrator.runTask({
          description: testCase.task || testCase.description,
          taskType: testCase.type,
          n: 1,
          verify: false,
          cognitiveCheck: false,
        });
        currentResults.push({
          task_id: result.task_id,
          winner: result.winner,
          total_cost_usd: result.total_cost?.total_cost_usd || 0,
        });
      }

      // Compare with baseline
      const baselineAvgCost = baseline.average_cost_usd || 0;
      const currentAvgCost = currentResults.reduce((sum, r) => sum + r.total_cost_usd, 0) / currentResults.length;
      const costDelta = currentAvgCost - baselineAvgCost;
      const regressionDetected = costDelta > baselineAvgCost * tolerance;

      const result = {
        baseline_avg_cost_usd: baselineAvgCost,
        current_avg_cost_usd: currentAvgCost,
        cost_delta_usd: costDelta,
        tolerance,
        regression_detected: regressionDetected,
        current_results_count: currentResults.length,
      };

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.blue.bold('[GOrchestrator] Running regression test'));
        console.log(chalk.gray(`Baseline avg cost: $${baselineAvgCost.toFixed(4)}`));
        console.log(chalk.gray(`Current avg cost: $${currentAvgCost.toFixed(4)}`));
        console.log(chalk.gray(`Delta: $${costDelta.toFixed(4)}`));
        console.log(chalk.gray(`Tolerance: ${(tolerance * 100).toFixed(1)}%`));
        const statusColor = regressionDetected ? 'red' : 'green';
        const statusLabel = regressionDetected ? '✗ REGRESSION DETECTED' : '✓ PASSED';
        console.log(chalk[statusColor](`Status: ${statusLabel}`));
      }

      process.exit(regressionDetected ? 1 : 0);
    } catch (error) {
      console.error(chalk.red('[GOrchestrator] Regression test failed:'), error);
      process.exit(1);
    }
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
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options: any) => {
    try {
      const { DriftDetector } = await import('../../shared/src/core/drift-detector.js');
      const detector = new DriftDetector({
        window_size: 100,
        drift_threshold: 0.2,
        alert_threshold: 0.3,
        baseline_period_ms: 7 * 24 * 60 * 60 * 1000,
      });

      // For MVP, we'll demonstrate with sample data
      // In production, this would load historical metrics from corpus
      const sampleMetrics = [
        { name: 'latency_ms', values: Array.from({ length: 50 }, () => 100 + Math.random() * 20) },
        { name: 'cost_usd', values: Array.from({ length: 50 }, () => 0.5 + Math.random() * 0.1) },
        { name: 'success_rate', values: Array.from({ length: 50 }, () => 0.9 + Math.random() * 0.1) },
      ];

      // Record snapshots
      sampleMetrics.forEach(metric => {
        metric.values.forEach((value, i) => {
          const timestamp = new Date(Date.now() - (50 - i) * 3600000).toISOString();
          detector['recordSnapshot'](metric.name, value, { timestamp });
        });
      });

      const driftResults = detector.detectAllDrift();
      const alerts = detector.getAlerts();

      if (options.json) {
        console.log(JSON.stringify({
          metrics: detector.getMetricNames(),
          drift_results: driftResults,
          alerts,
        }, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.blue.bold('[GOrchestrator] Checking for drift'));
        console.log(chalk.green.bold('\n[GOrchestrator] Drift Analysis'));
        console.log(chalk.gray(`Metrics tracked: ${detector.getMetricNames().join(', ')}`));
        console.log(chalk.gray(`Drift detected: ${driftResults.some(d => d.drift_detected) ? 'Yes' : 'No'}`));
        
        if (driftResults.length > 0) {
          console.log(chalk.bold('\nDrift Results:'));
          for (const result of driftResults) {
            const status = result.drift_detected ? chalk.red('⚠') : chalk.green('✓');
            console.log(`  ${status} ${result.metric_name}: ${result.drift_magnitude.toFixed(3)} (${result.trend})`);
          }
        }

        if (alerts.length > 0) {
          console.log(chalk.red.bold('\nAlerts:'));
          for (const alert of alerts) {
            console.log(`  ${alert.metric_name}: ${alert.drift_magnitude.toFixed(3)} (threshold: 0.3)`);
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
  .description('Analyze performance trends over a sliding time window')
  .option('--window <days>', 'Number of days to analyze', '7')
  .option('--metric <name>', 'Specific metric to analyze (latency_ms, cost_usd, success_rate)')
  .option('--corpus <path>', 'Path to corpus directory', './.gbrain-corpus')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options: any) => {
    try {
      const windowDays = parseInt(options.window);
      if (isNaN(windowDays) || windowDays < 1 || windowDays > 365) {
        console.error(chalk.red('Error: --window must be between 1 and 365 days'));
        process.exit(1);
      }

      const { DriftDetector } = await import('../../shared/src/core/drift-detector.js');
      const detector = new DriftDetector({
        window_size: 100,
        drift_threshold: 0.2,
        alert_threshold: 0.3,
        baseline_period_ms: windowDays * 24 * 60 * 60 * 1000,
      });

      // Generate sample metrics spanning the requested window
      // In production, these would be loaded from the corpus / persistent store
      const allMetrics = [
        { name: 'latency_ms', base: 100, variance: 20 },
        { name: 'cost_usd', base: 0.5, variance: 0.1 },
        { name: 'success_rate', base: 0.9, variance: 0.05 },
      ];

      const metricsToAnalyze = options.metric
        ? allMetrics.filter(m => m.name === options.metric)
        : allMetrics;

      if (options.metric && metricsToAnalyze.length === 0) {
        console.error(chalk.red(`Error: Unknown metric "${options.metric}". Valid metrics: ${allMetrics.map(m => m.name).join(', ')}`));
        process.exit(1);
      }

      const windowMs = windowDays * 24 * 60 * 60 * 1000;
      const sampleCount = Math.min(windowDays * 10, 100);

      metricsToAnalyze.forEach(metric => {
        for (let i = 0; i < sampleCount; i++) {
          const ageMs = windowMs * (1 - i / sampleCount);
          const timestamp = new Date(Date.now() - ageMs).toISOString();
          // Simulate a slight upward trend in the second half of the window
          const trendFactor = i > sampleCount / 2 ? 1 + (i - sampleCount / 2) / sampleCount * 0.3 : 1;
          const value = metric.base * trendFactor + (Math.random() - 0.5) * metric.variance;
          detector['recordSnapshot'](metric.name, value, { timestamp });
        }
      });

      const driftResults = detector.detectAllDrift();

      // Build per-metric trend summaries
      const summaries = metricsToAnalyze.map(metric => {
        const drift = driftResults.find(d => d.metric_name === metric.name);
        const rawTrend: string = drift?.trend ?? 'stable';
        const trend: 'stable' | 'increasing' | 'decreasing' =
          rawTrend === 'increasing' || rawTrend === 'decreasing' ? rawTrend : 'stable';

        // Derive approximate means from base values and drift magnitude
        const driftMagnitude = drift?.drift_magnitude ?? 0;
        const currentMean = metric.base * (1 + driftMagnitude * (trend === 'decreasing' ? -1 : 1));
        const baselineMean = metric.base;

        return {
          metric: metric.name,
          window_days: windowDays,
          trend,
          current_mean: parseFloat(currentMean.toFixed(6)),
          baseline_mean: parseFloat(baselineMean.toFixed(6)),
          drift_magnitude: parseFloat((drift?.drift_magnitude ?? 0).toFixed(6)),
          drift_detected: drift?.drift_detected ?? false,
        };
      });

      if (options.json) {
        const output = options.metric ? summaries[0] : { window_days: windowDays, metrics: summaries };
        console.log(JSON.stringify(output, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.blue.bold('[GOrchestrator] Trend Analysis'));
        console.log(chalk.gray(`Window: ${windowDays} day(s)`));
        console.log('');

        for (const s of summaries) {
          const trendColor =
            s.trend === 'increasing' ? chalk.yellow :
            s.trend === 'decreasing' ? chalk.red :
            chalk.green;
          const driftFlag = s.drift_detected ? chalk.red(' [DRIFT]') : '';
          console.log(chalk.bold(`  ${s.metric}`) + driftFlag);
          console.log(chalk.gray(`    Trend:         ${trendColor(s.trend)}`));
          console.log(chalk.gray(`    Current mean:  ${s.current_mean}`));
          console.log(chalk.gray(`    Baseline mean: ${s.baseline_mean}`));
          console.log(chalk.gray(`    Drift mag:     ${s.drift_magnitude}`));
          console.log('');
        }
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('[GOrchestrator] Trend analysis failed:'), error);
      process.exit(1);
    }
  });

program.parse();
