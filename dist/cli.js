#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const orchestrator_js_1 = require("./core/orchestrator.js");
const program = new commander_1.Command();
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
    console.log(chalk_1.default.blue.bold('[GOrchestrator] Starting orchestration run'));
    console.log(chalk_1.default.gray(`Task: ${task}`));
    console.log(chalk_1.default.gray(`Attempts: ${options.attempts}`));
    console.log(chalk_1.default.gray(`Verify: ${options.verify}`));
    console.log(chalk_1.default.gray(`Cognitive Check: ${options.cognitiveCheck}`));
    const orchestrator = new orchestrator_js_1.GOrchestrator({
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
        console.log(chalk_1.default.green.bold('\n[GOrchestrator] Run completed successfully'));
        console.log(chalk_1.default.gray(`Task ID: ${result.task_id}`));
        console.log(chalk_1.default.gray(`Winner: ${result.winner}`));
        console.log(chalk_1.default.gray(`Attempts: ${result.attempts.length}`));
        console.log(chalk_1.default.gray(`Total Cost: $${result.total_cost.total_cost_usd.toFixed(4)}`));
        console.log(chalk_1.default.gray(`Duration: ${(duration / 1000).toFixed(2)}s`));
        console.log(chalk_1.default.gray(`GBrain Status: ${result.gbrain_write_status}`));
        // Print attempt summary
        console.log(chalk_1.default.bold('\nAttempt Summary:'));
        result.attempts.forEach((attempt, idx) => {
            const status = attempt.status === 'completed' ? chalk_1.default.green('✓') : chalk_1.default.red('✗');
            const score = attempt.scores ? attempt.scores.overall_score.toFixed(3) : 'N/A';
            const selected = attempt.selected ? chalk_1.default.yellow(' [WINNER]') : '';
            console.log(`  ${status} Attempt ${idx + 1}: score=${score}${selected}`);
        });
        process.exit(0);
    }
    catch (error) {
        console.error(chalk_1.default.red('[GOrchestrator] Run failed:'), error);
        process.exit(1);
    }
    finally {
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
    .action(async (options) => {
    const orchestrator = new orchestrator_js_1.GOrchestrator({
        gbrainEndpoint: options.gbrain,
        gmirrorEndpoint: options.gmirror,
        gtomEndpoint: options.gtom,
    });
    const health = await orchestrator.healthCheck();
    console.log(chalk_1.default.bold('GOrchestrator Health Check'));
    console.log(chalk_1.default.gray(`Status: ${health.status}`));
    console.log('');
    console.log('Components:');
    console.log(`  GBrain: ${health.components.gbrain === 'ok' ? chalk_1.default.green('✓') : chalk_1.default.red('✗')}`);
    console.log(`  GMirror: ${health.components.gmirror === 'ok' ? chalk_1.default.green('✓') : chalk_1.default.red('✗')}`);
    console.log(`  GToM: ${health.components.gtom === 'ok' ? chalk_1.default.green('✓') : chalk_1.default.red('✗')}`);
    console.log(`  Sandbox: ${health.components.sandbox === 'ok' ? chalk_1.default.green('✓') : chalk_1.default.red('✗')}`);
    process.exit(health.status === 'healthy' ? 0 : 1);
});
// Replay a previous run
program
    .command('replay')
    .description('Replay a previous run from GBrain')
    .argument('<task-id>', 'Task ID to replay')
    .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
    .action(async (taskId, options) => {
    console.log(chalk_1.default.blue.bold(`[GOrchestrator] Replaying task: ${taskId}`));
    // In production, would fetch run record from GBrain and replay
    console.log(chalk_1.default.yellow('Replay not implemented in MVP'));
    process.exit(0);
});
// Benchmark mode
program
    .command('benchmark')
    .description('Run benchmark tests')
    .option('--n <number>', 'Number of benchmark runs', '10')
    .action(async (options) => {
    console.log(chalk_1.default.blue.bold('[GOrchestrator] Running benchmarks'));
    console.log(chalk_1.default.yellow('Benchmark not implemented in MVP'));
    process.exit(0);
});
program.parse();
//# sourceMappingURL=cli.js.map