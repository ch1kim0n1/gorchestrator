// gorchestrator/test/runner.test.ts
import { AttemptRunner } from '../src/core/runner.js';
import { SandboxPoolManager } from '../src/core/sandbox.js';
import { AgentConfig, TaskBundle } from '../src/types/index.js';
import { LLMClient } from '../src/core/llm-client.js';

process.env.MOCK_SANDBOX = '1';

function makeConfig(style: AgentConfig['reasoning_style'] = 'depth_first'): AgentConfig {
  return {
    config_id: '00000000-0000-0000-0000-000000000001',
    base_model: 'claude-sonnet-4-6',
    reasoning_budget: 10000,
    skill_set: ['debug', 'test'],
    decomposition_strategy: 'iterative',
    tool_scopes: [],
    reasoning_style: style,
    sampling: { temperature: 0.7, top_p: 0.9, frequency_penalty: 0, presence_penalty: 0 },
    provenance: 'explore',
  };
}

function makeTaskBundle(): TaskBundle {
  return {
    task_id: '00000000-0000-0000-0000-000000000002',
    raw_description: 'Write a hello world TypeScript function',
    signature: {
      task_type: 'code_generation',
      surfaces: ['file'],
      constraints: [],
      outcome_shape: { type: 'code', format: 'typescript', validation_criteria: [] },
      context_refs: [],
      hash: 'hash123',
    },
    priors: {
      similar_tasks: [], winning_configs: [], known_failure_modes: [],
      recommended_n: 3, user_preferences: {}, domain_constraints: {},
    },
    budget: { max_attempts: 3, max_cost_usd: 5, max_wall_time_ms: 30000, max_parallelism: 3 },
    created_at: new Date().toISOString(),
  };
}

describe('AttemptRunner', () => {
  let sandboxManager: SandboxPoolManager;
  let runner: AttemptRunner;

  beforeEach(() => {
    sandboxManager = new SandboxPoolManager({ maxConcurrency: 3, backend: 'docker' });
    runner = new AttemptRunner({ sandboxManager });
  });

  it('runAttempt returns a completed AttemptResult', async () => {
    const result = await runner.runAttempt(makeTaskBundle(), makeConfig());
    expect(result.attempt_id).toBeDefined();
    expect(result.task_id).toBe('00000000-0000-0000-0000-000000000002');
    expect(result.config_id).toBe('00000000-0000-0000-0000-000000000001');
    expect(['completed', 'timeout', 'errored', 'aborted']).toContain(result.status);
    expect(result.wall_time_ms).toBeGreaterThanOrEqual(0);
  });

  it('completed result has a deliverable with content', async () => {
    const result = await runner.runAttempt(makeTaskBundle(), makeConfig());
    if (result.status === 'completed') {
      expect(result.deliverable).toBeDefined();
      expect(typeof result.deliverable!.content).toBe('string');
    }
  });

  it('trace events are recorded during execution', async () => {
    const result = await runner.runAttempt(makeTaskBundle(), makeConfig('plan_then_act'));
    expect(result.trace.events.length).toBeGreaterThan(0);
  });

  it('cost fields are non-negative', async () => {
    const result = await runner.runAttempt(makeTaskBundle(), makeConfig());
    expect(result.cost.total_cost_usd).toBeGreaterThanOrEqual(0);
    expect(result.cost.model_cost_usd).toBeGreaterThanOrEqual(0);
  });

  it('started_at is before ended_at', async () => {
    const result = await runner.runAttempt(makeTaskBundle(), makeConfig());
    expect(new Date(result.started_at).getTime()).toBeLessThanOrEqual(
      new Date(result.ended_at).getTime()
    );
  });

  it('uses LLM output for plan step deliverables', async () => {
    const call = jest.fn().mockImplementation(async (prompt: string) => {
      if (prompt.includes('detailed sequence of steps')) {
        return {
          content: JSON.stringify([{ description: 'Implement greeting function', artifact_path: '/workspace/greet.ts' }]),
          input_tokens: 20,
          output_tokens: 12,
          cost_usd: 0.001,
          model_id: 'claude-haiku-4-5-20251001',
          latency_ms: 1,
        };
      }
      if (prompt.includes('Execute this orchestrator plan step')) {
        return {
          content: JSON.stringify({ result: 'export const hello = () => "hello";', confidence: 0.9 }),
          input_tokens: 30,
          output_tokens: 10,
          cost_usd: 0.001,
          model_id: 'claude-haiku-4-5-20251001',
          latency_ms: 1,
        };
      }
      return {
        content: JSON.stringify(['Plan implementation']),
        input_tokens: 10,
        output_tokens: 5,
        cost_usd: 0.001,
        model_id: 'claude-haiku-4-5-20251001',
        latency_ms: 1,
      };
    });
    const fakeClient = {
      call,
      getModelByTier: jest.fn().mockReturnValue('claude-haiku-4-5-20251001'),
      getTotalCostUsd: jest.fn().mockReturnValue(0.003),
      getTotalTokens: jest.fn().mockReturnValue(87),
      getCallCount: jest.fn().mockReturnValue(3),
    } as unknown as LLMClient;
    const llmRunner = new AttemptRunner({ sandboxManager, llmClient: fakeClient });

    const result = await llmRunner.runAttempt(makeTaskBundle(), makeConfig('plan_then_act'));

    expect(result.deliverable?.content).toContain('export const hello');
    expect(call).toHaveBeenCalledWith(
      expect.stringContaining('Execute this orchestrator plan step'),
      expect.any(Object)
    );
  });
}, 30000);
