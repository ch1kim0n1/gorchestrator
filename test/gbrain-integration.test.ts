import {
  GBrainIntegrationClient,
  GBrainIntegrationError,
} from '../src/core/gbrain-integration.js';

const emptyPriors = {
  similar_tasks: [],
  winning_configs: [],
  known_failure_modes: [],
  recommended_n: 5,
  user_preferences: {},
  domain_constraints: {},
};

describe('GBrainIntegrationClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('sends auth headers and validates HTTP prior responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => emptyPriors,
    } as Response);

    const client = new GBrainIntegrationClient({
      endpoint: 'http://gbrain.local',
      authToken: 'secret-token',
      maxRetries: 0,
    });

    const priors = await client.getPriors({
      signature_hash: 'abc',
      max_results: 3,
      similarity_threshold: 0.75,
    });

    expect(priors.recommended_n).toBe(5);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://gbrain.local/gbrain/priors',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-token',
        }),
      }),
    );
  });

  it('retries transient HTTP failures with backoff', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ack_id: 'ack-1' }) } as Response);

    const client = new GBrainIntegrationClient({
      endpoint: 'http://gbrain.local',
      maxRetries: 1,
      initialBackoffMs: 1,
    });

    await expect(client.writeRunRecord({
      run_record: makeRunRecord(),
      priority: 'normal',
    })).resolves.toEqual(expect.objectContaining({ ack_id: 'ack-1' }));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('opens the circuit breaker after repeated transient failures', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as Response);

    const client = new GBrainIntegrationClient({
      endpoint: 'http://gbrain.local',
      maxRetries: 0,
      circuitBreakerFailureThreshold: 1,
      circuitBreakerCooldownMs: 1000,
    });

    await expect(client.getPriors({
      signature_hash: 'abc',
      max_results: 3,
      similarity_threshold: 0.75,
    })).rejects.toBeInstanceOf(GBrainIntegrationError);

    await expect(client.getPriors({
      signature_hash: 'abc',
      max_results: 3,
      similarity_threshold: 0.75,
    })).rejects.toMatchObject({ kind: 'circuit_open' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('supports MCP tool transport', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: emptyPriors }),
    } as Response);

    const client = new GBrainIntegrationClient({
      endpoint: 'http://gbrain.local',
      mcpEndpoint: 'http://gbrain.local/mcp',
      mode: 'mcp',
      maxRetries: 0,
    });

    const priors = await client.getPriors({
      signature_hash: 'abc',
      max_results: 3,
      similarity_threshold: 0.75,
    });

    expect(priors.recommended_n).toBe(5);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://gbrain.local/mcp/tools/gbrain.query_priors',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

function makeRunRecord(): any {
  const now = new Date().toISOString();
  return {
    task_id: '00000000-0000-4000-8000-000000000001',
    task_bundle: {
      task_id: '00000000-0000-4000-8000-000000000001',
      raw_description: 'test',
      signature: {
        task_type: 'code_generation',
        surfaces: ['code'],
        constraints: [],
        outcome_shape: { type: 'code', format: 'text', validation_criteria: [] },
        context_refs: [],
        hash: 'abc',
      },
      priors: emptyPriors,
      budget: {
        max_attempts: 1,
        max_cost_usd: 1,
        max_wall_time_ms: 1000,
        max_parallelism: 1,
      },
      created_at: now,
    },
    attempts: [],
    winner: '00000000-0000-4000-8000-000000000002',
    total_cost: {
      model_cost_usd: 0,
      tool_cost_usd: 0,
      sandbox_cost_usd: 0,
      total_cost_usd: 0,
    },
    total_wall_time_ms: 1,
    gbrain_write_status: 'pending',
    created_at: now,
    completed_at: now,
  };
}
