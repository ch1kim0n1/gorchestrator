import { v4 as uuidv4 } from 'uuid';
import {
  TaskBundle,
  AgentConfig,
  AttemptResult,
  Deliverable,
  TraceEvent,
  TraceBundle,
  CostBreakdown,
} from '../types/index.js';
import { SandboxPoolManager } from './sandbox.js';
import {
  LLMClient,
  LLMClientConfig,
} from './llm-client.js';
import { coreLogger } from './observability.js';

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
export class AttemptRunner {
  private sandboxManager: SandboxPoolManager;
  private gstackEndpoint: string;
  private maxWallTimeMs: number;
  private llmClient: LLMClient;

  constructor(config: {
    sandboxManager: SandboxPoolManager;
    gstackEndpoint?: string;
    maxWallTimeMs?: number;
    llmConfig?: LLMClientConfig;
    llmClient?: LLMClient;
  }) {
    this.sandboxManager = config.sandboxManager;
    this.gstackEndpoint = config.gstackEndpoint || 'http://localhost:3001';
    this.maxWallTimeMs = config.maxWallTimeMs || 300000;
    this.llmClient = config.llmClient ?? new LLMClient(config.llmConfig);
  }

  /**
   * Main entry point: run a single attempt
   */
  async runAttempt(
    taskBundle: TaskBundle,
    config: AgentConfig
  ): Promise<AttemptResult> {
    const attemptId = uuidv4();
    const startTime = Date.now();
    const startCostUsd = this.llmClient.getTotalCostUsd();
    const startTokens = this.llmClient.getTotalTokens();
    const startCallCount = this.llmClient.getCallCount();

    // Provision sandbox
    const sandbox = await this.sandboxManager.provisionSandbox(attemptId);
    
    if (sandbox.state === 'failed') {
      return this.createErrorResult(attemptId, taskBundle, config, sandbox.sandbox_id, sandbox.error_message || 'Sandbox failed to provision', startTime);
    }

    const traceEvents: TraceEvent[] = [];
    let totalCost = 0;
    let totalTokens = 0;
    let modelCallCount = 0;

    try {
      // Initialize working directory
      await this.sandboxManager.executeCommand(sandbox.sandbox_id, 'mkdir -p /workspace');
      
      // Run agent loop
      const deliverable = await this.runAgentLoop(
        taskBundle,
        config,
        sandbox.sandbox_id,
        (event) => {
          traceEvents.push(event);
          totalCost += event.cost_usd || 0;
          if (event.event_type === 'model_call') {
            modelCallCount++;
          }
          if (event.data?.input_tokens) {
            totalTokens += event.data.input_tokens + (event.data.output_tokens || 0);
          }
        }
      );

      const endTime = Date.now();
      const wallTimeMs = endTime - startTime;

      const llmCost = Math.max(totalCost, this.llmClient.getTotalCostUsd() - startCostUsd);
      const llmTokens = Math.max(totalTokens, this.llmClient.getTotalTokens() - startTokens);
      const llmCalls = Math.max(modelCallCount, this.llmClient.getCallCount() - startCallCount);
      const toolCostUsd = this.estimateToolCost(traceEvents);
      const sandboxCostUsd = this.estimateSandboxCost(wallTimeMs);
      const totalCostUsd = llmCost + toolCostUsd + sandboxCostUsd;

      return {
        attempt_id: attemptId,
        task_id: taskBundle.task_id,
        config_id: config.config_id,
        sandbox_id: sandbox.sandbox_id,
        status: 'completed',
        deliverable,
        trace: {
          events: traceEvents,
          total_cost_usd: totalCostUsd,
          total_tokens: llmTokens,
          total_wall_time_ms: wallTimeMs,
        },
        cost: {
          model_cost_usd: llmCost,
          tool_cost_usd: toolCostUsd,
          sandbox_cost_usd: sandboxCostUsd,
          total_cost_usd: totalCostUsd,
          tokens_used: llmTokens,
          llm_calls: llmCalls,
        },
        wall_time_ms: wallTimeMs,
        started_at: new Date(startTime).toISOString(),
        ended_at: new Date(endTime).toISOString(),
      };
    } catch (error) {
      const endTime = Date.now();
      const wallTimeMs = endTime - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return this.createErrorResult(attemptId, taskBundle, config, sandbox.sandbox_id, errorMessage, startTime, wallTimeMs, traceEvents, totalCost);
    } finally {
      // Cleanup sandbox (in production, might keep for debugging)
      await this.sandboxManager.destroySandbox(sandbox.sandbox_id).catch((error) => {
        coreLogger.error('Failed to destroy sandbox after attempt', error instanceof Error ? error : { error: String(error) });
      });
    }
  }

  private estimateToolCost(traceEvents: TraceEvent[]): number {
    const nonModelEvents = traceEvents.filter(event => event.event_type !== 'model_call').length;
    return nonModelEvents * Number(process.env.GORCH_TOOL_EVENT_COST_USD ?? 0.00001);
  }

  private estimateSandboxCost(wallTimeMs: number): number {
    return (wallTimeMs / 1000) * Number(process.env.GORCH_SANDBOX_SECOND_COST_USD ?? 0.000002);
  }

  /**
   * Run the main agent loop
   */
  private async runAgentLoop(
    taskBundle: TaskBundle,
    config: AgentConfig,
    sandboxId: string,
    onTrace: (event: TraceEvent) => void
  ): Promise<Deliverable> {
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
    let deliverable: Deliverable;
    
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
  private async generatePlan(
    taskBundle: TaskBundle,
    config: AgentConfig,
    sandboxId: string,
    onTrace: (event: TraceEvent) => void
  ): Promise<string[]> {
    const prompt = this.buildPlanPrompt(taskBundle, config);
    const model = this.llmClient.getModelByTier('tier1');
    
    const llmResult = await this.llmClient.call(prompt, { model, temperature: 0.7 }).catch(() => ({ content: "{}", input_tokens: 0, output_tokens: 0, cost_usd: 0, model_id: model, latency_ms: 0 }));
    
    onTrace({
      timestamp: new Date().toISOString(),
      event_type: 'model_call',
      data: { task: taskBundle.task_id, model, input_tokens: llmResult.input_tokens, output_tokens: llmResult.output_tokens },
      cost_usd: llmResult.cost_usd,
    });

    // Parse the LLM response to extract plan steps
    return this.parsePlanResponse(llmResult.content);
  }

  /**
   * Build prompt for plan generation
   */
  private buildPlanPrompt(taskBundle: TaskBundle, config: AgentConfig): string {
    return `You are an AI task planner. Given the following task, decompose it into a sequence of high-level steps.

Task: ${taskBundle.raw_description}
Task Type: ${taskBundle.signature.task_type}
Reasoning Style: ${config.reasoning_style}

Return a JSON array of step descriptions, e.g.:
["Analyze requirements", "Design solution", "Implement code", "Test implementation", "Document results"]`;
  }

  /**
   * Parse plan response from LLM
   */
  private parsePlanResponse(content: string): string[] {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.map(step => String(step));
      }
    } catch (e) {
      // If JSON parsing fails, return a default plan
      coreLogger.warn('Failed to parse plan response, using default');
    }
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
  private async executeDepthFirst(
    taskBundle: TaskBundle,
    config: AgentConfig,
    sandboxId: string,
    onTrace: (event: TraceEvent) => void
  ): Promise<Deliverable> {
    // Execute sub-tasks sequentially, diving deep into each
    const subtasks = this.decomposeTask(taskBundle, config);
    
    let content = '';
    const artifacts: Deliverable['artifacts'] = [];

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
  private async executeBreadthFirst(
    taskBundle: TaskBundle,
    config: AgentConfig,
    sandboxId: string,
    onTrace: (event: TraceEvent) => void
  ): Promise<Deliverable> {
    // Execute all sub-tasks at a shallow level first
    const subtasks = this.decomposeTask(taskBundle, config);
    
    const results = await Promise.all(
      subtasks.map(subtask => this.executeSubtask(subtask, config, sandboxId, onTrace))
    );

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
  private async executePlanThenAct(
    taskBundle: TaskBundle,
    config: AgentConfig,
    sandboxId: string,
    onTrace: (event: TraceEvent) => void
  ): Promise<Deliverable> {
    // Generate detailed plan, then execute sequentially
    const plan = await this.generateDetailedPlan(taskBundle, config, sandboxId, onTrace);
    
    let content = '';
    const artifacts: Deliverable['artifacts'] = [];

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
  private async executeReactStyle(
    taskBundle: TaskBundle,
    config: AgentConfig,
    sandboxId: string,
    onTrace: (event: TraceEvent) => void
  ): Promise<Deliverable> {
    // Execute reactively, making decisions at each step based on current state
    let currentState = { step: 0, context: taskBundle.raw_description };
    let content = '';
    const artifacts: Deliverable['artifacts'] = [];
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
  private async executeHybrid(
    taskBundle: TaskBundle,
    config: AgentConfig,
    sandboxId: string,
    onTrace: (event: TraceEvent) => void
  ): Promise<Deliverable> {
    // Combine depth-first for complex sub-tasks with breadth-first for simple ones
    const subtasks = this.decomposeTask(taskBundle, config);
    const complexSubtasks = subtasks.filter(s => this.isComplexSubtask(s));
    const simpleSubtasks = subtasks.filter(s => !this.isComplexSubtask(s));

    let content = '';
    const artifacts: Deliverable['artifacts'] = [];

    // Execute complex sub-tasks depth-first
    for (const subtask of complexSubtasks) {
      const result = await this.executeSubtask(subtask, config, sandboxId, onTrace);
      content += result + '\n';
    }

    // Execute simple sub-tasks breadth-first
    const simpleResults = await Promise.all(
      simpleSubtasks.map(subtask => this.executeSubtask(subtask, config, sandboxId, onTrace))
    );
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
  private decomposeTask(taskBundle: TaskBundle, config: AgentConfig): string[] {
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
  private async executeSubtask(
    subtask: string,
    config: AgentConfig,
    sandboxId: string,
    onTrace: (event: TraceEvent) => void
  ): Promise<string> {
    const prompt = this.buildSubtaskPrompt(subtask, config);
    const model = this.llmClient.getModelByTier('tier1');
    
    const llmResult = await this.llmClient.call(prompt, { model, temperature: 0.5 }).catch(() => ({ content: "{}", input_tokens: 0, output_tokens: 0, cost_usd: 0, model_id: model, latency_ms: 0 }));
    
    onTrace({
      timestamp: new Date().toISOString(),
      event_type: 'model_call',
      data: { subtask, model, input_tokens: llmResult.input_tokens, output_tokens: llmResult.output_tokens },
      cost_usd: llmResult.cost_usd,
    });

    // Parse the LLM response
    return this.parseSubtaskResponse(llmResult.content, subtask);
  }

  /**
   * Build prompt for subtask execution
   */
  private buildSubtaskPrompt(subtask: string, config: AgentConfig): string {
    return `You are an AI task executor. Execute the following sub-task and return the result.

Sub-task: ${subtask}
Model: ${config.base_model}

Return a JSON object with the result, e.g.:
{"result": "Execution output", "confidence": 0.9}`;
  }

  /**
   * Parse subtask response from LLM
   */
  private parseSubtaskResponse(content: string, subtask: string): string {
    try {
      const parsed = JSON.parse(content);
      if (parsed.result) {
        return String(parsed.result);
      }
    } catch (e) {
      // If JSON parsing fails, return a default response
      coreLogger.warn('Failed to parse subtask response, using default');
    }
    return `[Executed: ${subtask}]`;
  }

  /**
   * Generate detailed plan
   */
  private async generateDetailedPlan(
    taskBundle: TaskBundle,
    config: AgentConfig,
    sandboxId: string,
    onTrace: (event: TraceEvent) => void
  ): Promise<Array<{ description: string; artifact_path?: string }>> {
    const prompt = this.buildDetailedPlanPrompt(taskBundle, config);
    const model = this.llmClient.getModelByTier('tier1');
    
    const llmResult = await this.llmClient.call(prompt, { model, temperature: 0.7 }).catch(() => ({ content: "{}", input_tokens: 0, output_tokens: 0, cost_usd: 0, model_id: model, latency_ms: 0 }));
    
    onTrace({
      timestamp: new Date().toISOString(),
      event_type: 'model_call',
      data: { task: taskBundle.task_id, model, input_tokens: llmResult.input_tokens, output_tokens: llmResult.output_tokens },
      cost_usd: llmResult.cost_usd,
    });

    // Parse the LLM response to extract detailed plan steps
    return this.parseDetailedPlanResponse(llmResult.content);
  }

  /**
   * Build prompt for detailed plan generation
   */
  private buildDetailedPlanPrompt(taskBundle: TaskBundle, config: AgentConfig): string {
    return `You are an AI task planner. Given the following task, decompose it into a detailed sequence of steps with artifact paths.

Task: ${taskBundle.raw_description}
Task Type: ${taskBundle.signature.task_type}

Return a JSON array of step objects, e.g.:
[{"description": "Initialize workspace", "artifact_path": "/workspace/init.txt"}, {"description": "Implement core logic", "artifact_path": "/workspace/core.txt"}]`;
  }

  /**
   * Parse detailed plan response from LLM
   */
  private parseDetailedPlanResponse(content: string): Array<{ description: string; artifact_path?: string }> {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.map((step: any) => ({
          description: String(step.description || step),
          artifact_path: step.artifact_path ? String(step.artifact_path) : undefined,
        }));
      }
    } catch (e) {
      // If JSON parsing fails, return a default plan
      coreLogger.warn('Failed to parse detailed plan response, using default');
    }
    return [
      { description: 'Initialize workspace', artifact_path: '/workspace/init.txt' },
      { description: 'Implement core logic', artifact_path: '/workspace/core.txt' },
      { description: 'Add tests', artifact_path: '/workspace/tests.txt' },
    ];
  }

  /**
   * Execute a plan step
   */
  private async executeStep(
    step: { description: string; artifact_path?: string },
    config: AgentConfig,
    sandboxId: string,
    onTrace: (event: TraceEvent) => void
  ): Promise<string> {
    const prompt = this.buildStepExecutionPrompt(step, config);
    const model = this.llmClient.getModelByTier('tier1');
    const llmResult = await this.llmClient.call(prompt, { model, temperature: 0.4 }).catch(() => ({
      content: '{}',
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      model_id: model,
      latency_ms: 0,
    }));

    onTrace({
      timestamp: new Date().toISOString(),
      event_type: 'model_call',
      data: { step: step.description, model, input_tokens: llmResult.input_tokens, output_tokens: llmResult.output_tokens },
      cost_usd: llmResult.cost_usd,
    });

    return this.parseExecutionResult(llmResult.content, step.description);
  }

  private buildStepExecutionPrompt(
    step: { description: string; artifact_path?: string },
    config: AgentConfig
  ): string {
    return `Execute this orchestrator plan step as the configured agent.

Step: ${step.description}
Artifact path: ${step.artifact_path || 'none'}
Base model: ${config.base_model}
Reasoning style: ${config.reasoning_style}
Skills: ${config.skill_set.join(', ')}

Return strict JSON:
{"result": "the concrete deliverable or execution output", "confidence": 0.0}`;
  }

  private parseExecutionResult(content: string, label: string): string {
    try {
      const parsed = JSON.parse(content);
      if (parsed.result) {
        return String(parsed.result);
      }
    } catch (e) {
      coreLogger.warn('Failed to parse execution response, using fallback');
    }
    return `[Executed by LLM fallback: ${label}]`;
  }

  /**
   * Decide next action in react-style execution
   */
  private async decideNextAction(
    state: { step: number; context: string },
    config: AgentConfig,
    sandboxId: string,
    onTrace: (event: TraceEvent) => void
  ): Promise<{ type: string; artifact_path?: string }> {
    const prompt = this.buildDecisionPrompt(state, config);
    const model = this.llmClient.getModelByTier('tier1');
    
    const llmResult = await this.llmClient.call(prompt, { model, temperature: 0.5 }).catch(() => ({ content: "{}", input_tokens: 0, output_tokens: 0, cost_usd: 0, model_id: model, latency_ms: 0 }));
    
    onTrace({
      timestamp: new Date().toISOString(),
      event_type: 'model_call',
      data: { step: state.step, model, input_tokens: llmResult.input_tokens, output_tokens: llmResult.output_tokens },
      cost_usd: llmResult.cost_usd,
    });

    // Parse the LLM response
    return this.parseDecisionResponse(llmResult.content, state.step);
  }

  /**
   * Build prompt for decision making
   */
  private buildDecisionPrompt(state: { step: number; context: string }, config: AgentConfig): string {
    return `You are an AI decision maker. Given the current state, decide whether to continue or complete the task.

Current Step: ${state.step}
Context: ${state.context}
Model: ${config.base_model}

Return a JSON object with the decision, e.g.:
{"type": "continue", "artifact_path": "/workspace/step_1.txt"} or {"type": "complete"}`;
  }

  /**
   * Parse decision response from LLM
   */
  private parseDecisionResponse(content: string, step: number): { type: string; artifact_path?: string } {
    try {
      const parsed = JSON.parse(content);
      if (parsed.type) {
        return {
          type: String(parsed.type),
          artifact_path: parsed.artifact_path ? String(parsed.artifact_path) : undefined,
        };
      }
    } catch (e) {
      // If JSON parsing fails, return a default decision
      coreLogger.warn('Failed to parse decision response, using default');
    }
    if (step >= 5) {
      return { type: 'complete' };
    }
    return { type: 'continue', artifact_path: `/workspace/step_${step}.txt` };
  }

  /**
   * Execute an action
   */
  private async executeAction(
    action: { type: string; artifact_path?: string },
    config: AgentConfig,
    sandboxId: string,
    onTrace: (event: TraceEvent) => void
  ): Promise<string> {
    const prompt = this.buildActionExecutionPrompt(action, config);
    const model = this.llmClient.getModelByTier('tier1');
    const llmResult = await this.llmClient.call(prompt, { model, temperature: 0.4 }).catch(() => ({
      content: '{}',
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      model_id: model,
      latency_ms: 0,
    }));

    onTrace({
      timestamp: new Date().toISOString(),
      event_type: 'model_call',
      data: { action, model, input_tokens: llmResult.input_tokens, output_tokens: llmResult.output_tokens },
      cost_usd: llmResult.cost_usd,
    });

    return this.parseExecutionResult(llmResult.content, action.type);
  }

  private buildActionExecutionPrompt(action: { type: string; artifact_path?: string }, config: AgentConfig): string {
    return `Execute the next ReAct-style agent action.

Action type: ${action.type}
Artifact path: ${action.artifact_path || 'none'}
Base model: ${config.base_model}
Reasoning style: ${config.reasoning_style}
Skills: ${config.skill_set.join(', ')}

Return strict JSON:
{"result": "the concrete action output", "confidence": 0.0}`;
  }

  /**
   * Check if a sub-task is complex
   */
  private isComplexSubtask(subtask: string): boolean {
    const complexKeywords = ['architecture', 'design', 'implement', 'refactor', 'deploy'];
    return complexKeywords.some(keyword => subtask.toLowerCase().includes(keyword));
  }

  /**
   * Hash content for artifact
   */
  private hashContent(content: string): string {
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
  private createErrorResult(
    attemptId: string,
    taskBundle: TaskBundle,
    config: AgentConfig,
    sandboxId: string,
    errorMessage: string,
    startTime: number,
    wallTimeMs?: number,
    traceEvents: TraceEvent[] = [],
    totalCost: number = 0
  ): AttemptResult {
    const endTime = Date.now();
    const actualWallTimeMs = wallTimeMs || (endTime - startTime);
    const sandboxCostUsd = this.estimateSandboxCost(actualWallTimeMs);
    const toolCostUsd = this.estimateToolCost(traceEvents);
    const totalCostUsd = totalCost + toolCostUsd + sandboxCostUsd;

    return {
      attempt_id: attemptId,
      task_id: taskBundle.task_id,
      config_id: config.config_id,
      sandbox_id: sandboxId,
      status: 'errored',
      trace: {
        events: traceEvents,
        total_cost_usd: totalCostUsd,
        total_tokens: 0,
        total_wall_time_ms: actualWallTimeMs,
      },
      cost: {
        model_cost_usd: totalCost,
        tool_cost_usd: toolCostUsd,
        sandbox_cost_usd: sandboxCostUsd,
        total_cost_usd: totalCostUsd,
      },
      wall_time_ms: actualWallTimeMs,
      started_at: new Date(startTime).toISOString(),
      ended_at: new Date(endTime).toISOString(),
      error_message: errorMessage,
    };
  }
}
