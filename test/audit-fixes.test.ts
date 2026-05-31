import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  LLMClient,
  estimateCostUsd,
  MODEL_PRICING,
  MODEL_TIERS,
} from '../src/core/llm-client';
import { BudgetLedger } from '../src/core/budget-ledger';
import { redactPII, redactFreeTextPII } from '../src/core/observability';
import { DetectorPool } from '../src/core/detector-pool';

describe('audit fixes', () => {
  describe('#45 LLMClient env key resolution + error propagation', () => {
    const savedAnthropic = process.env.ANTHROPIC_API_KEY;
    const savedOpenAI = process.env.OPENAI_API_KEY;

    afterEach(() => {
      if (savedAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = savedAnthropic;
      if (savedOpenAI === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = savedOpenAI;
    });

    it('reads ANTHROPIC_API_KEY from the environment when not passed in config', async () => {
      process.env.ANTHROPIC_API_KEY = 'env-anthropic-key';
      const client = new LLMClient({ defaultModel: 'claude-sonnet-4-6' });
      const created = jest.fn<any>().mockResolvedValue({
        content: [{ type: 'text', text: 'hello' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
      // Force lazy client creation, then assert it was created (no throw).
      (client as any).getAnthropicClient = function () {
        (this as any).anthropicClient = { messages: { create: created } };
        return (this as any).anthropicClient;
      };
      const result = await client.call('hi', { model: 'claude-sonnet-4-6' });
      expect(result.content).toBe('hello');
      expect(created).toHaveBeenCalled();
    });

    it('throws (does not silently succeed) when no Anthropic key is available', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      const client = new LLMClient({ defaultModel: 'claude-sonnet-4-6' });
      await expect(client.call('hi', { model: 'claude-sonnet-4-6' })).rejects.toThrow(
        /Anthropic API key not provided/
      );
    });
  });

  describe('#46 pricing coverage / non-zero unknown-model cost', () => {
    it('all configured tier models exist in the pricing table', () => {
      for (const model of Object.values(MODEL_TIERS)) {
        expect(MODEL_PRICING[model]).toBeDefined();
      }
      // Default DYAD tier ids used by the orchestrator/detector-pool.
      expect(MODEL_PRICING['claude-haiku-4-5']).toBeDefined();
      expect(MODEL_PRICING['claude-sonnet-4-6']).toBeDefined();
    });

    it('canonicalizes vendor-prefixed model ids', () => {
      expect(estimateCostUsd('anthropic/claude-sonnet-4-6', 1_000_000, 0)).toBeGreaterThan(0);
    });

    it('an unknown model does not produce $0 cost', () => {
      const cost = estimateCostUsd('totally-unknown-model', 1_000_000, 1_000_000);
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('#61 empty content/choices arrays do not throw', () => {
    it('Anthropic empty content array yields empty string', async () => {
      const client = new LLMClient({ anthropicApiKey: 'k', defaultModel: 'claude-sonnet-4-6' });
      (client as any).anthropicClient = {
        messages: { create: jest.fn<any>().mockResolvedValue({ content: [], usage: { input_tokens: 1, output_tokens: 0 } }) },
      };
      const result = await client.call('x', { model: 'claude-sonnet-4-6' });
      expect(result.content).toBe('');
    });

    it('OpenAI empty choices array yields empty string', async () => {
      const client = new LLMClient({ openaiApiKey: 'k', defaultModel: 'gpt-4o-mini' });
      (client as any).openaiClient = {
        chat: { completions: { create: jest.fn<any>().mockResolvedValue({ choices: [], usage: { prompt_tokens: 1, completion_tokens: 0 } }) } },
      };
      const result = await client.call('x', { model: 'gpt-4o-mini' });
      expect(result.content).toBe('');
    });
  });

  describe('#65 provider-reported input tokens', () => {
    it('uses usage.input_tokens from the provider response', async () => {
      const client = new LLMClient({ anthropicApiKey: 'k', defaultModel: 'claude-sonnet-4-6' });
      (client as any).anthropicClient = {
        messages: { create: jest.fn<any>().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 12345, output_tokens: 7 } }) },
      };
      const result = await client.call('x', { model: 'claude-sonnet-4-6' });
      expect(result.input_tokens).toBe(12345);
      expect(result.output_tokens).toBe(7);
    });
  });

  describe('#48 / #54 redactPII', () => {
    it('redacts phone, SSN, and credit card numbers in free text', () => {
      const text = 'call me at 415-555-1234, ssn 123-45-6789, card 4111 1111 1111 1111';
      const redacted = redactFreeTextPII(text);
      expect(redacted).not.toContain('415-555-1234');
      expect(redacted).not.toContain('123-45-6789');
      expect(redacted).not.toContain('4111 1111 1111 1111');
      expect(redacted).toContain('[REDACTED_PHONE]');
      expect(redacted).toContain('[REDACTED_SSN]');
      expect(redacted).toContain('[REDACTED_CARD]');
    });

    it('handles circular structures without a stack overflow', () => {
      const obj: any = { a: 1, text: 'email me at x@y.com' };
      obj.self = obj;
      const out: any = redactPII(obj);
      expect(out.self).toBe('[REDACTED_CIRCULAR]');
      expect(out.text).toContain('[REDACTED_EMAIL]');
    });

    it('caps deeply nested structures', () => {
      let deep: any = { v: 'leaf' };
      for (let i = 0; i < 100; i++) deep = { next: deep };
      expect(() => redactPII(deep)).not.toThrow();
    });
  });

  describe('#53 BudgetLedger concurrent reserve+commit never overruns', () => {
    it('does not exceed max_budget_usd under concurrency', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gorch-budget-race-'));
      const ledger = new BudgetLedger({ max_budget_usd: 1 }, 'gorchestrator', dir);
      await ledger.init();

      // 100 concurrent attempts, each reserving the full remaining budget upper
      // bound of 0.05; only ~20 should succeed (20 * 0.05 = 1.0).
      const results = await Promise.allSettled(
        Array.from({ length: 100 }, (_, i) =>
          ledger.reserveAndCommit('llm', 0.05, 0.05, 60_000, { scope: 'execution' }, {
            model_id: 'claude-haiku-4-5',
            input_tokens: 1,
            output_tokens: 1,
            operation: 'llm',
            metadata: { scope: 'execution' },
          })
        )
      );
      const status = ledger.getStatus();
      expect(status.total_committed).toBeLessThanOrEqual(1.0000001);
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      expect(succeeded).toBeLessThanOrEqual(20);
    });
  });

  describe('#57 DetectorPool non-JSON LLM output falls back to rule-based', () => {
    it('uses the deterministic detector when the LLM returns non-JSON', async () => {
      const fakeLLM = {
        call: jest.fn<any>().mockResolvedValue({
          content: 'this is not json at all',
          input_tokens: 1,
          output_tokens: 1,
          model_id: 'claude-haiku-4-5',
          cost_usd: 0.001,
          latency_ms: 1,
        }),
      };
      const pool = new DetectorPool(fakeLLM as any, {
        tier1_model: 'claude-haiku-4-5',
        tier2_model: 'claude-sonnet-4-6',
        escalation_confidence_threshold: 0.8,
      });
      const task: any = {
        task_type: 'relationship_analysis',
        dyad_id: 'hash:abc',
        message_window: [
          { participant: 'a', text: 'sorry, can we talk?', timestamp: new Date().toISOString() },
          { participant: 'b', text: "let's", timestamp: new Date().toISOString() },
        ],
        detectors: ['repair_detection'],
        time_range: { start: new Date().toISOString(), end: new Date().toISOString() },
        budget: { max_cost_usd: 1, max_latency_ms: 1000 },
      };
      const outputs = await pool.runDetectors(task, ['repair_detection']);
      expect(outputs).toHaveLength(1);
      expect((outputs[0].result as any).fallback).toBe('rule_based');
    });
  });
});
