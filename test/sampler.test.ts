// gorchestrator/test/sampler.test.ts
import { ConfigurationSampler } from '../src/core/sampler.js';
import { GBrainPriorBundle, TaskBundle } from '../src/types/index.js';
import { LLMClient } from '../src/core/llm-client.js';

function makeEmptyPriors(): GBrainPriorBundle {
  return {
    similar_tasks: [],
    winning_configs: [],
    known_failure_modes: [],
    recommended_n: 3,
    user_preferences: {},
    domain_constraints: {},
  };
}

function makeTaskBundle(): TaskBundle {
  return {
    task_id: '00000000-0000-0000-0000-000000000001',
    raw_description: 'Build REST API',
    signature: {
      task_type: 'code_generation',
      surfaces: ['api'],
      constraints: [],
      outcome_shape: { type: 'code', format: 'typescript', validation_criteria: [] },
      context_refs: [],
      hash: 'abc123',
    },
    priors: makeEmptyPriors(),
    budget: { max_attempts: 5, max_cost_usd: 10, max_wall_time_ms: 60000, max_parallelism: 3 },
    created_at: new Date().toISOString(),
  };
}

describe('ConfigurationSampler', () => {
  let sampler: ConfigurationSampler;

  beforeEach(() => {
    sampler = new ConfigurationSampler();
  });

  it('createSamplingPlan returns a SamplingPlan with n configs', () => {
    const plan = sampler.createSamplingPlan(makeTaskBundle(), makeEmptyPriors(), 3);
    expect(plan.configs).toHaveLength(3);
    expect(plan.total_configs).toBe(3);
  });

  it('all generated configs have required fields', () => {
    const plan = sampler.createSamplingPlan(makeTaskBundle(), makeEmptyPriors(), 4);
    for (const config of plan.configs) {
      expect(config.config_id).toBeDefined();
      expect(config.base_model).toBeDefined();
      expect(config.skill_set).toBeInstanceOf(Array);
      expect(['exploit', 'perturb', 'explore', 'manual']).toContain(config.provenance);
      expect(config.reasoning_style).toBeDefined();
    }
  });

  it('configs are diverse — no two configs have the same config_id', () => {
    const plan = sampler.createSamplingPlan(makeTaskBundle(), makeEmptyPriors(), 5);
    const ids = new Set(plan.configs.map(c => c.config_id));
    expect(ids.size).toBe(5);
  });

  it('exploit strategy reuses winning_configs when available', () => {
    const priors: GBrainPriorBundle = {
      ...makeEmptyPriors(),
      winning_configs: [
        {
          config: {
            config_id: '00000000-0000-0000-0000-000000000099',
            base_model: 'claude-sonnet-4-6',
            reasoning_budget: 100000,
            skill_set: ['debug', 'test'],
            decomposition_strategy: 'waterfall',
            tool_scopes: [],
            reasoning_style: 'plan_then_act',
            sampling: { temperature: 0.7, top_p: 0.9, frequency_penalty: 0, presence_penalty: 0 },
            provenance: 'exploit',
          },
          win_rate: 0.9,
          n: 10,
        },
      ],
      recommended_n: 3,
    };
    const plan = sampler.createSamplingPlan(makeTaskBundle(), priors, 3);
    const exploitConfig = plan.configs.find(c => c.provenance === 'exploit');
    expect(exploitConfig).toBeDefined();
    expect(exploitConfig!.base_model).toBe('claude-sonnet-4-6');
  });

  it('strategy_distribution values sum to approximately 1', () => {
    const plan = sampler.createSamplingPlan(makeTaskBundle(), makeEmptyPriors(), 5);
    const total = Object.values(plan.strategy_distribution).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 1);
  });

  it('uses LLM-guided perturbation when sampling perturb configs', async () => {
    const priors: GBrainPriorBundle = {
      ...makeEmptyPriors(),
      winning_configs: [
        {
          config: {
            config_id: '00000000-0000-0000-0000-000000000099',
            base_model: 'claude-sonnet-4-6',
            reasoning_budget: 100000,
            skill_set: ['debug', 'test'],
            decomposition_strategy: 'waterfall',
            tool_scopes: [],
            reasoning_style: 'plan_then_act',
            sampling: { temperature: 0.7, top_p: 0.9, frequency_penalty: 0, presence_penalty: 0 },
            provenance: 'exploit',
          },
          win_rate: 0.9,
          n: 10,
        },
      ],
      recommended_n: 3,
    };
    const task = { ...makeTaskBundle(), priors };
    const call = jest.fn().mockResolvedValue({
      content: JSON.stringify({
        base_model: 'claude-sonnet-4-6',
        reasoning_budget: 120000,
        skill_set: ['debug', 'security_scan'],
        decomposition_strategy: 'iterative',
        tool_scopes: [{ tool_name: 'filesystem', access_level: 'write' }],
        reasoning_style: 'hybrid',
        sampling: { temperature: 0.55, top_p: 0.85, frequency_penalty: 0, presence_penalty: 0.1 },
      }),
      input_tokens: 50,
      output_tokens: 30,
      cost_usd: 0.001,
      model_id: 'claude-haiku-4-5-20251001',
      latency_ms: 1,
    });
    const fakeClient = {
      call,
      getModelByTier: jest.fn().mockReturnValue('claude-haiku-4-5-20251001'),
    } as unknown as LLMClient;
    const llmSampler = new ConfigurationSampler({ llmClient: fakeClient });

    const plan = await llmSampler.sampleConfigurations(task, 2);
    const perturbConfig = plan.configs.find(config => config.provenance === 'perturb');

    expect(call).toHaveBeenCalledTimes(1);
    expect(perturbConfig?.reasoning_style).toBe('hybrid');
    expect(perturbConfig?.skill_set).toContain('security_scan');
  });
});
