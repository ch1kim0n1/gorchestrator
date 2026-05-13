import { TaskBundle, AgentConfig, AttemptResult } from '../types/index.js';
import { SandboxPoolManager } from './sandbox.js';
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
export declare class AttemptRunner {
    private sandboxManager;
    private gstackEndpoint;
    private maxWallTimeMs;
    constructor(config: {
        sandboxManager: SandboxPoolManager;
        gstackEndpoint?: string;
        maxWallTimeMs?: number;
    });
    /**
     * Main entry point: run a single attempt
     */
    runAttempt(taskBundle: TaskBundle, config: AgentConfig): Promise<AttemptResult>;
    /**
     * Run the main agent loop
     */
    private runAgentLoop;
    /**
     * Generate a plan for the task
     */
    private generatePlan;
    /**
     * Depth-first execution
     */
    private executeDepthFirst;
    /**
     * Breadth-first execution
     */
    private executeBreadthFirst;
    /**
     * Plan-then-act execution
     */
    private executePlanThenAct;
    /**
     * React-style execution
     */
    private executeReactStyle;
    /**
     * Hybrid execution
     */
    private executeHybrid;
    /**
     * Decompose task into sub-tasks
     */
    private decomposeTask;
    /**
     * Execute a single sub-task
     */
    private executeSubtask;
    /**
     * Generate detailed plan
     */
    private generateDetailedPlan;
    /**
     * Execute a plan step
     */
    private executeStep;
    /**
     * Decide next action in react-style execution
     */
    private decideNextAction;
    /**
     * Execute an action
     */
    private executeAction;
    /**
     * Check if a sub-task is complex
     */
    private isComplexSubtask;
    /**
     * Hash content for artifact
     */
    private hashContent;
    /**
     * Create error result
     */
    private createErrorResult;
}
//# sourceMappingURL=runner.d.ts.map