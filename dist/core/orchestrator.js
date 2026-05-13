"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GOrchestrator = void 0;
const intake_js_1 = require("./intake.js");
const sampler_js_1 = require("./sampler.js");
const sandbox_js_1 = require("./sandbox.js");
const runner_js_1 = require("./runner.js");
const selector_js_1 = require("./selector.js");
/**
 * Main GOrchestrator
 *
 * Ties together all components:
 * - Intake & Priming
 * - Configuration Sampling
 * - Parallel Execution
 * - Scoring via GMirror
 * - Selection
 * - Persistence to GBrain
 */
class GOrchestrator {
    intakePrimer;
    configSampler;
    sandboxManager;
    selectorEngine;
    gbrainEndpoint;
    gmirrorEndpoint;
    gtomEndpoint;
    gstackEndpoint;
    constructor(config = {}) {
        this.gbrainEndpoint = config.gbrainEndpoint || 'http://localhost:3000';
        this.gmirrorEndpoint = config.gmirrorEndpoint || 'http://localhost:3002';
        this.gstackEndpoint = config.gstackEndpoint || 'http://localhost:3001';
        this.gtomEndpoint = config.gtomEndpoint || 'http://localhost:3003';
        this.intakePrimer = new intake_js_1.IntakePrimer({
            gbrainEndpoint: this.gbrainEndpoint,
        });
        this.configSampler = new sampler_js_1.ConfigurationSampler({
            gstackEndpoint: config.gstackEndpoint,
        });
        this.sandboxManager = new sandbox_js_1.SandboxPoolManager({
            maxConcurrency: config.maxConcurrency || 5,
            backend: config.sandboxBackend || 'docker',
        });
        this.selectorEngine = new selector_js_1.SelectorEngine();
    }
    /**
     * Main entry point: run a task through the full orchestration pipeline
     */
    async runTask(rawTask) {
        const startTime = Date.now();
        // Phase 1: Intake & Priming
        console.log('[GOrchestrator] Phase 1: Intake & Priming');
        const taskBundle = await this.intakePrimer.intakeTask(rawTask);
        // Phase 2: Configuration Sampling
        console.log('[GOrchestrator] Phase 2: Configuration Sampling');
        const samplingPlan = await this.configSampler.sampleConfigurations(taskBundle, rawTask.n);
        // Phase 3: Parallel Execution
        console.log('[GOrchestrator] Phase 3: Parallel Execution');
        const attemptResults = await this.runParallelAttempts(taskBundle, samplingPlan.configs);
        // Phase 4: Scoring (if verification enabled)
        let scoredAttempts = [];
        if (rawTask.verify !== false) {
            console.log('[GOrchestrator] Phase 4: Scoring via GMirror');
            scoredAttempts = await this.scoreAttempts(taskBundle, attemptResults);
        }
        else {
            // Skip scoring, mark all as selected
            scoredAttempts = attemptResults.map((a, idx) => ({
                ...a,
                scores: {
                    correctness: { score: 0.5, confidence: 0.5, evidence: [] },
                    user_outcome: { score: 0.5, confidence: 0.5, evidence: [] },
                    robustness: { score: 0.5, confidence: 0.5, evidence: [] },
                    risk: { score: 0.5, confidence: 0.5, evidence: [] },
                    overall_score: 0.5,
                    hard_gates_passed: true,
                },
                selected: idx === 0,
                selection_reason: 'First completed attempt (verification disabled)',
            }));
        }
        // Phase 5: Selection
        console.log('[GOrchestrator] Phase 5: Selection');
        const selectionResult = this.selectorEngine.selectWinner(scoredAttempts);
        // Mark winner in attempts
        scoredAttempts = scoredAttempts.map(a => ({
            ...a,
            selected: a.attempt_id === selectionResult.winner_attempt_id,
            selection_reason: a.attempt_id === selectionResult.winner_attempt_id
                ? selectionResult.rationale
                : undefined,
        }));
        // Phase 6: Cognitive Check (if enabled)
        if (rawTask.cognitiveCheck) {
            console.log('[GOrchestrator] Phase 6: Cognitive Check via GToM');
            await this.performCognitiveCheck(taskBundle, scoredAttempts);
        }
        // Phase 7: Persistence
        console.log('[GOrchestrator] Phase 7: Persistence to GBrain');
        const runRecord = {
            task_id: taskBundle.task_id,
            task_bundle: taskBundle,
            attempts: scoredAttempts,
            winner: selectionResult.winner_attempt_id,
            merged_output: selectionResult.merge_sources ? selectionResult.selected_deliverable : undefined,
            total_cost: this.aggregateCosts(scoredAttempts),
            total_wall_time_ms: Date.now() - startTime,
            gbrain_write_status: 'pending',
            created_at: new Date(startTime).toISOString(),
            completed_at: new Date().toISOString(),
        };
        await this.persistRunRecord(runRecord);
        // Cleanup
        await this.sandboxManager.cleanup();
        return runRecord;
    }
    /**
     * Run attempts in parallel
     */
    async runParallelAttempts(taskBundle, configs) {
        const runner = new runner_js_1.AttemptRunner({
            sandboxManager: this.sandboxManager,
            gstackEndpoint: this.gstackEndpoint,
            maxWallTimeMs: taskBundle.budget.max_wall_time_ms,
        });
        // Run all attempts in parallel up to concurrency limit
        const results = [];
        const batchSize = taskBundle.budget.max_parallelism;
        for (let i = 0; i < configs.length; i += batchSize) {
            const batch = configs.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(config => runner.runAttempt(taskBundle, config)));
            results.push(...batchResults);
        }
        return results;
    }
    /**
     * Score attempts via GMirror
     */
    async scoreAttempts(taskBundle, attempts) {
        const scoringRequest = {
            task: taskBundle,
            attempts,
            scoring_profile: taskBundle.signature.task_type,
            budget_ms: taskBundle.budget.max_wall_time_ms * 0.3,
        };
        try {
            const response = await fetch(`${this.gmirrorEndpoint}/gmirror/score`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scoringRequest),
            });
            if (!response.ok) {
                throw new Error(`GMirror returned ${response.status}`);
            }
            const data = await response.json();
            // Merge scores with attempts
            return attempts.map((attempt, idx) => ({
                ...attempt,
                scores: data.score_set[idx]?.scores || this.fallbackScore(),
                selected: false,
            }));
        }
        catch (error) {
            console.warn('[GOrchestrator] GMirror scoring failed, using fallback:', error);
            return attempts.map(attempt => ({
                ...attempt,
                scores: this.fallbackScore(),
                selected: false,
            }));
        }
    }
    /**
     * Fallback scoring when GMirror is unavailable
     */
    fallbackScore() {
        return {
            correctness: { score: 0.5, confidence: 0.3, evidence: ['GMirror unavailable'] },
            user_outcome: { score: 0.5, confidence: 0.3, evidence: ['GMirror unavailable'] },
            robustness: { score: 0.5, confidence: 0.3, evidence: ['GMirror unavailable'] },
            risk: { score: 0.5, confidence: 0.3, evidence: ['GMirror unavailable'] },
            overall_score: 0.5,
            hard_gates_passed: true,
        };
    }
    /**
     * Perform cognitive check via GToM
     */
    async performCognitiveCheck(taskBundle, attempts) {
        try {
            const request = {
                task: taskBundle,
                active_attempts: attempts.map(a => ({
                    attempt_id: a.attempt_id,
                    config_id: a.config_id,
                    current_state: {},
                    recent_actions: [],
                })),
            };
            const response = await fetch(`${this.gtomEndpoint}/gtom/predict-conflicts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
            });
            if (!response.ok) {
                throw new Error(`GToM returned ${response.status}`);
            }
            const data = await response.json();
            console.log('[GOrchestrator] GToM conflict predictions:', data.predicted_conflicts);
            // In production, would act on predictions
            // For MVP, just log them
        }
        catch (error) {
            console.warn('[GOrchestrator] GToM cognitive check failed:', error);
        }
    }
    /**
     * Aggregate costs from all attempts
     */
    aggregateCosts(attempts) {
        return attempts.reduce((total, attempt) => ({
            model_cost_usd: total.model_cost_usd + attempt.cost.model_cost_usd,
            tool_cost_usd: total.tool_cost_usd + attempt.cost.tool_cost_usd,
            sandbox_cost_usd: total.sandbox_cost_usd + attempt.cost.sandbox_cost_usd,
            total_cost_usd: total.total_cost_usd + attempt.cost.total_cost_usd,
        }), { model_cost_usd: 0, tool_cost_usd: 0, sandbox_cost_usd: 0, total_cost_usd: 0 });
    }
    /**
     * Persist run record to GBrain
     */
    async persistRunRecord(runRecord) {
        const request = {
            run_record: runRecord,
            priority: 'normal',
        };
        try {
            const response = await fetch(`${this.gbrainEndpoint}/gbrain/runs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
            });
            if (!response.ok) {
                throw new Error(`GBrain returned ${response.status}`);
            }
            const data = await response.json();
            runRecord.gbrain_write_status = 'written';
            console.log('[GOrchestrator] Run record persisted to GBrain:', data.ack_id);
        }
        catch (error) {
            console.warn('[GOrchestrator] Failed to persist to GBrain:', error);
            runRecord.gbrain_write_status = 'failed';
            // In production, queue for retry
        }
    }
    /**
     * Health check for all dependencies
     */
    async healthCheck() {
        const checks = {
            gbrain: await this.checkEndpoint(this.gbrainEndpoint),
            gmirror: await this.checkEndpoint(this.gmirrorEndpoint),
            gtom: await this.checkEndpoint(this.gtomEndpoint),
            sandbox: await this.checkSandbox(),
        };
        const errorCount = Object.values(checks).filter(v => v === 'error').length;
        const status = errorCount === 0 ? 'healthy' : errorCount < 3 ? 'degraded' : 'unhealthy';
        return { status, components: checks };
    }
    /**
     * Check if an endpoint is reachable
     */
    async checkEndpoint(endpoint) {
        try {
            const response = await fetch(`${endpoint}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(1000),
            });
            return response.ok ? 'ok' : 'error';
        }
        catch {
            return 'error';
        }
    }
    /**
     * Check sandbox backend
     */
    async checkSandbox() {
        try {
            // For Docker, check if docker is available
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            await execAsync('docker --version', { timeout: 1000 });
            return 'ok';
        }
        catch {
            return 'error';
        }
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        await this.sandboxManager.cleanup();
    }
}
exports.GOrchestrator = GOrchestrator;
//# sourceMappingURL=orchestrator.js.map