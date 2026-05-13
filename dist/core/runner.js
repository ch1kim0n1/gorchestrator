"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttemptRunner = void 0;
const uuid_1 = require("uuid");
/**
 * Attempt Runner
 *
 * Responsibilities:
 * - Run a single agent configuration against a task in a sandbox
 * - Invoke GStack skills as needed
 * - Collect trace data (model calls, tool calls, file changes)
 * - Track cost and wall time
 * - Handle timeouts and errors
 */
class AttemptRunner {
    sandboxManager;
    gstackEndpoint;
    maxWallTimeMs;
    constructor(config) {
        this.sandboxManager = config.sandboxManager;
        this.gstackEndpoint = config.gstackEndpoint || 'http://localhost:3001';
        this.maxWallTimeMs = config.maxWallTimeMs || 300000;
    }
    /**
     * Main entry point: run a single attempt
     */
    async runAttempt(taskBundle, config) {
        const attemptId = (0, uuid_1.v4)();
        const startTime = Date.now();
        // Provision sandbox
        const sandbox = await this.sandboxManager.provisionSandbox(attemptId);
        if (sandbox.state === 'failed') {
            return this.createErrorResult(attemptId, taskBundle, config, sandbox.sandbox_id, sandbox.error_message || 'Sandbox failed to provision', startTime);
        }
        const traceEvents = [];
        let totalCost = 0;
        let totalTokens = 0;
        try {
            // Initialize working directory
            await this.sandboxManager.executeCommand(sandbox.sandbox_id, 'mkdir -p /workspace');
            // Run agent loop
            const deliverable = await this.runAgentLoop(taskBundle, config, sandbox.sandbox_id, (event) => {
                traceEvents.push(event);
                totalCost += event.cost_usd || 0;
            });
            const endTime = Date.now();
            const wallTimeMs = endTime - startTime;
            return {
                attempt_id: attemptId,
                task_id: taskBundle.task_id,
                config_id: config.config_id,
                sandbox_id: sandbox.sandbox_id,
                status: 'completed',
                deliverable,
                trace: {
                    events: traceEvents,
                    total_cost_usd: totalCost,
                    total_tokens: totalTokens,
                    total_wall_time_ms: wallTimeMs,
                },
                cost: {
                    model_cost_usd: totalCost * 0.8,
                    tool_cost_usd: totalCost * 0.1,
                    sandbox_cost_usd: totalCost * 0.1,
                    total_cost_usd: totalCost,
                },
                wall_time_ms: wallTimeMs,
                started_at: new Date(startTime).toISOString(),
                ended_at: new Date(endTime).toISOString(),
            };
        }
        catch (error) {
            const endTime = Date.now();
            const wallTimeMs = endTime - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            return this.createErrorResult(attemptId, taskBundle, config, sandbox.sandbox_id, errorMessage, startTime, wallTimeMs, traceEvents, totalCost);
        }
        finally {
            // Cleanup sandbox (in production, might keep for debugging)
            await this.sandboxManager.destroySandbox(sandbox.sandbox_id).catch(console.error);
        }
    }
    /**
     * Run the main agent loop
     */
    async runAgentLoop(taskBundle, config, sandboxId, onTrace) {
        // For hackathon MVP, implement a simplified agent loop
        // In production, this would be a full agent execution engine
        const startTime = Date.now();
        // Step 1: Plan (if using plan-then-act or hybrid style)
        if (config.reasoning_style === 'plan_then_act' || config.reasoning_style === 'hybrid') {
            const plan = await this.generatePlan(taskBundle, config, sandboxId, onTrace);
            onTrace({
                timestamp: new Date().toISOString(),
                event_type: 'decision',
                data: { plan },
            });
        }
        // Step 2: Execute based on reasoning style
        let deliverable;
        switch (config.reasoning_style) {
            case 'depth_first':
                deliverable = await this.executeDepthFirst(taskBundle, config, sandboxId, onTrace);
                break;
            case 'breadth_first':
                deliverable = await this.executeBreadthFirst(taskBundle, config, sandboxId, onTrace);
                break;
            case 'plan_then_act':
                deliverable = await this.executePlanThenAct(taskBundle, config, sandboxId, onTrace);
                break;
            case 'react_style':
                deliverable = await this.executeReactStyle(taskBundle, config, sandboxId, onTrace);
                break;
            case 'hybrid':
                deliverable = await this.executeHybrid(taskBundle, config, sandboxId, onTrace);
                break;
            default:
                deliverable = await this.executeDepthFirst(taskBundle, config, sandboxId, onTrace);
        }
        return deliverable;
    }
    /**
     * Generate a plan for the task
     */
    async generatePlan(taskBundle, config, sandboxId, onTrace) {
        // In production, call LLM to generate plan
        // For MVP, return a simple decomposition
        return [
            'Analyze task requirements',
            'Implement solution',
            'Test implementation',
            'Refine based on feedback',
        ];
    }
    /**
     * Depth-first execution
     */
    async executeDepthFirst(taskBundle, config, sandboxId, onTrace) {
        // Execute sub-tasks sequentially, diving deep into each
        const subtasks = this.decomposeTask(taskBundle, config);
        let content = '';
        const artifacts = [];
        for (const subtask of subtasks) {
            const result = await this.executeSubtask(subtask, config, sandboxId, onTrace);
            content += result + '\n';
            if (subtask.includes('file') || subtask.includes('code')) {
                artifacts.push({
                    path: `/workspace/${subtask.replace(/\s+/g, '_')}.txt`,
                    content: result,
                    hash: this.hashContent(result),
                });
            }
        }
        return {
            type: taskBundle.signature.outcome_shape.type,
            content: content.trim(),
            artifacts,
            metadata: {
                execution_style: 'depth_first',
                subtask_count: subtasks.length,
            },
        };
    }
    /**
     * Breadth-first execution
     */
    async executeBreadthFirst(taskBundle, config, sandboxId, onTrace) {
        // Execute all sub-tasks at a shallow level first
        const subtasks = this.decomposeTask(taskBundle, config);
        const results = await Promise.all(subtasks.map(subtask => this.executeSubtask(subtask, config, sandboxId, onTrace)));
        const content = results.join('\n\n');
        const artifacts = subtasks.map((subtask, idx) => ({
            path: `/workspace/${subtask.replace(/\s+/g, '_')}.txt`,
            content: results[idx],
            hash: this.hashContent(results[idx]),
        }));
        return {
            type: taskBundle.signature.outcome_shape.type,
            content,
            artifacts,
            metadata: {
                execution_style: 'breadth_first',
                subtask_count: subtasks.length,
            },
        };
    }
    /**
     * Plan-then-act execution
     */
    async executePlanThenAct(taskBundle, config, sandboxId, onTrace) {
        // Generate detailed plan, then execute sequentially
        const plan = await this.generateDetailedPlan(taskBundle, config, sandboxId, onTrace);
        let content = '';
        const artifacts = [];
        for (const step of plan) {
            const result = await this.executeStep(step, config, sandboxId, onTrace);
            content += `Step: ${step.description}\nResult: ${result}\n\n`;
            if (step.artifact_path) {
                artifacts.push({
                    path: step.artifact_path,
                    content: result,
                    hash: this.hashContent(result),
                });
            }
        }
        return {
            type: taskBundle.signature.outcome_shape.type,
            content: content.trim(),
            artifacts,
            metadata: {
                execution_style: 'plan_then_act',
                step_count: plan.length,
            },
        };
    }
    /**
     * React-style execution
     */
    async executeReactStyle(taskBundle, config, sandboxId, onTrace) {
        // Execute reactively, making decisions at each step based on current state
        let currentState = { step: 0, context: taskBundle.raw_description };
        let content = '';
        const artifacts = [];
        let iterations = 0;
        const maxIterations = 20;
        while (iterations < maxIterations) {
            const action = await this.decideNextAction(currentState, config, sandboxId, onTrace);
            if (action.type === 'complete') {
                break;
            }
            const result = await this.executeAction(action, config, sandboxId, onTrace);
            content += result + '\n';
            if (action.artifact_path) {
                artifacts.push({
                    path: action.artifact_path,
                    content: result,
                    hash: this.hashContent(result),
                });
            }
            currentState = {
                step: currentState.step + 1,
                context: result,
            };
            iterations++;
        }
        return {
            type: taskBundle.signature.outcome_shape.type,
            content: content.trim(),
            artifacts,
            metadata: {
                execution_style: 'react_style',
                iterations,
            },
        };
    }
    /**
     * Hybrid execution
     */
    async executeHybrid(taskBundle, config, sandboxId, onTrace) {
        // Combine depth-first for complex sub-tasks with breadth-first for simple ones
        const subtasks = this.decomposeTask(taskBundle, config);
        const complexSubtasks = subtasks.filter(s => this.isComplexSubtask(s));
        const simpleSubtasks = subtasks.filter(s => !this.isComplexSubtask(s));
        let content = '';
        const artifacts = [];
        // Execute complex sub-tasks depth-first
        for (const subtask of complexSubtasks) {
            const result = await this.executeSubtask(subtask, config, sandboxId, onTrace);
            content += result + '\n';
        }
        // Execute simple sub-tasks breadth-first
        const simpleResults = await Promise.all(simpleSubtasks.map(subtask => this.executeSubtask(subtask, config, sandboxId, onTrace)));
        content += simpleResults.join('\n\n');
        return {
            type: taskBundle.signature.outcome_shape.type,
            content: content.trim(),
            artifacts,
            metadata: {
                execution_style: 'hybrid',
                complex_subtasks: complexSubtasks.length,
                simple_subtasks: simpleSubtasks.length,
            },
        };
    }
    /**
     * Decompose task into sub-tasks
     */
    decomposeTask(taskBundle, config) {
        // In production, use LLM to decompose based on strategy
        // For MVP, use simple heuristics
        const taskType = taskBundle.signature.task_type;
        switch (taskType) {
            case 'code_generation':
                return [
                    'Analyze requirements',
                    'Design solution architecture',
                    'Implement core functionality',
                    'Add error handling',
                    'Write tests',
                    'Document code',
                ];
            case 'refactor':
                return [
                    'Analyze existing code',
                    'Identify refactoring opportunities',
                    'Apply refactoring',
                    'Verify functionality preserved',
                ];
            case 'deployment':
                return [
                    'Prepare deployment configuration',
                    'Build artifacts',
                    'Run pre-deployment checks',
                    'Deploy to environment',
                    'Verify deployment',
                ];
            default:
                return [
                    'Understand task',
                    'Execute task',
                    'Verify results',
                ];
        }
    }
    /**
     * Execute a single sub-task
     */
    async executeSubtask(subtask, config, sandboxId, onTrace) {
        // In production, invoke GStack skills or LLM
        // For MVP, return a simulated result
        onTrace({
            timestamp: new Date().toISOString(),
            event_type: 'model_call',
            data: { subtask, model: config.base_model },
            cost_usd: 0.001,
        });
        return `[Executed: ${subtask} with ${config.base_model}]`;
    }
    /**
     * Generate detailed plan
     */
    async generateDetailedPlan(taskBundle, config, sandboxId, onTrace) {
        // In production, use LLM
        return [
            { description: 'Initialize workspace', artifact_path: '/workspace/init.txt' },
            { description: 'Implement core logic', artifact_path: '/workspace/core.txt' },
            { description: 'Add tests', artifact_path: '/workspace/tests.txt' },
        ];
    }
    /**
     * Execute a plan step
     */
    async executeStep(step, config, sandboxId, onTrace) {
        onTrace({
            timestamp: new Date().toISOString(),
            event_type: 'tool_call',
            data: { step: step.description },
            cost_usd: 0.0005,
        });
        return `[Completed: ${step.description}]`;
    }
    /**
     * Decide next action in react-style execution
     */
    async decideNextAction(state, config, sandboxId, onTrace) {
        // In production, use LLM to decide
        if (state.step >= 5) {
            return { type: 'complete' };
        }
        return { type: 'continue', artifact_path: `/workspace/step_${state.step}.txt` };
    }
    /**
     * Execute an action
     */
    async executeAction(action, config, sandboxId, onTrace) {
        onTrace({
            timestamp: new Date().toISOString(),
            event_type: 'decision',
            data: { action },
            cost_usd: 0.0005,
        });
        return `[Action executed]`;
    }
    /**
     * Check if a sub-task is complex
     */
    isComplexSubtask(subtask) {
        const complexKeywords = ['architecture', 'design', 'implement', 'refactor', 'deploy'];
        return complexKeywords.some(keyword => subtask.toLowerCase().includes(keyword));
    }
    /**
     * Hash content for artifact
     */
    hashContent(content) {
        // Simple hash for MVP
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
    /**
     * Create error result
     */
    createErrorResult(attemptId, taskBundle, config, sandboxId, errorMessage, startTime, wallTimeMs, traceEvents = [], totalCost = 0) {
        const endTime = Date.now();
        const actualWallTimeMs = wallTimeMs || (endTime - startTime);
        return {
            attempt_id: attemptId,
            task_id: taskBundle.task_id,
            config_id: config.config_id,
            sandbox_id: sandboxId,
            status: 'errored',
            trace: {
                events: traceEvents,
                total_cost_usd: totalCost,
                total_tokens: 0,
                total_wall_time_ms: actualWallTimeMs,
            },
            cost: {
                model_cost_usd: 0,
                tool_cost_usd: 0,
                sandbox_cost_usd: 0,
                total_cost_usd: totalCost,
            },
            wall_time_ms: actualWallTimeMs,
            started_at: new Date(startTime).toISOString(),
            ended_at: new Date(endTime).toISOString(),
            error_message: errorMessage,
        };
    }
}
exports.AttemptRunner = AttemptRunner;
//# sourceMappingURL=runner.js.map