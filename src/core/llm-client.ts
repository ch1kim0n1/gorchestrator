/**
 * LLM Client for G-Stack Tools
 * 
 * Provides:
 * - Model pricing tables (Anthropic, OpenAI)
 * - Token counting and cost tracking
 * - Standardized LLM call interface
 * - Multi-tier model selection
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { encoding_for_model, get_encoding, TiktokenModel } from 'tiktoken';
import { createLogger } from './shared-utils.js';
import * as fs from 'fs';
import * as path from 'path';
import { coreLogger } from './observability.js';

export interface ModelPricing {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
  /** Average latency in ms. */
  avg_latency_ms: number;
}

export interface LLMCallResult {
  content: string;
  input_tokens: number;
  output_tokens: number;
  model_id: string;
  cost_usd: number;
  latency_ms: number;
}

export interface LLMClientConfig {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  defaultModel?: string;
  maxTokens?: number;
  timeoutMs?: number;
  /** Hook called after each LLM call with cost info (for BudgetLedger integration). */
  onSpend?: (modelId: string, inputTokens: number, outputTokens: number, costUsd: number) => Promise<void>;
  /** Optional JSON file used to persist aggregate cost metrics across process restarts. */
  metricsPersistencePath?: string;
}

/** Anthropic model pricing (as of 2026-05-01) */
export const ANTHROPIC_PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-7': { input: 5.00, output: 25.00, avg_latency_ms: 5000 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00, avg_latency_ms: 2000 },
  'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00, avg_latency_ms: 500 },
  // Alias used as a default-tier id across the orchestrator/detector-pool.
  'claude-haiku-4-5': { input: 1.00, output: 5.00, avg_latency_ms: 500 },
  'claude-opus-4-6': { input: 5.00, output: 25.00, avg_latency_ms: 5000 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00, avg_latency_ms: 2000 },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00, avg_latency_ms: 500 },
};

/** OpenAI model pricing (as of 2026-05-01) */
export const OPENAI_PRICING: Record<string, ModelPricing> = {
  'gpt-4o': { input: 2.50, output: 10.00, avg_latency_ms: 1500 },
  'gpt-4o-mini': { input: 0.15, output: 0.60, avg_latency_ms: 300 },
  'gpt-4-turbo': { input: 10.00, output: 30.00, avg_latency_ms: 3000 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50, avg_latency_ms: 800 },
};

/** Combined pricing map */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  ...ANTHROPIC_PRICING,
  ...OPENAI_PRICING,
};

/** Model tier configurations */
export const MODEL_TIERS = {
  tier1: 'claude-haiku-4-5-20251001',
  tier2: 'claude-sonnet-4-6',
  tier3: 'claude-opus-4-7',
};

export const MODEL_RESOLUTION_CHAIN = [
  { tier: 'tier1', source: 'explicit_task_model', model: undefined },
  { tier: 'tier1', source: 'winning_gbrain_config', model: undefined },
  { tier: 'tier1', source: 'task_type_default', model: MODEL_TIERS.tier1 },
  { tier: 'tier1', source: 'low_cost_fast_path', model: 'gpt-4o-mini' },
  { tier: 'tier2', source: 'quality_escalation', model: MODEL_TIERS.tier2 },
  { tier: 'tier2', source: 'cross_vendor_consensus', model: 'gpt-4o' },
  { tier: 'tier3', source: 'critical_decision', model: MODEL_TIERS.tier3 },
  { tier: 'tier1', source: 'safe_fallback', model: MODEL_TIERS.tier1 },
] as const;

export type ModelResolutionSource = typeof MODEL_RESOLUTION_CHAIN[number]['source'];

/**
 * Estimate cost for a model call
 */
/**
 * Conservative fallback pricing applied when a model id is not found in the
 * pricing table. Using a non-zero, deliberately expensive rate keeps budget
 * gates meaningful (they will trip) rather than silently allowing unbounded
 * spend at $0. This matches the most expensive tier in the table.
 */
export const FALLBACK_PRICING: ModelPricing = { input: 5.00, output: 25.00, avg_latency_ms: 5000 };

/** Strip vendor prefixes (e.g. "anthropic/", "openai/") to canonicalize a model id. */
export function canonicalizeModelId(modelId: string): string {
  return modelId.replace(/^(anthropic|openai)\//, '');
}

export function estimateCostUsd(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[modelId] || MODEL_PRICING[canonicalizeModelId(modelId)];
  const resolved = pricing ?? FALLBACK_PRICING;
  if (!pricing) {
    // Unknown model must NOT silently produce $0 cost (would defeat budget gates).
    coreLogger.warn('No pricing for model; applying conservative fallback rate', {
      model_id: modelId,
    });
  }
  return (
    (inputTokens / 1_000_000) * resolved.input +
    (outputTokens / 1_000_000) * resolved.output
  );
}

/**
 * Get pricing for a model
 */
export function getModelPricing(modelId: string): ModelPricing | null {
  return MODEL_PRICING[modelId] || null;
}

/**
 * Enhanced token counter using tiktoken with fallback
 */
export function estimateTokens(text: string, modelId?: string): number {
  if (!text) return 0;
  
  try {
    let encoder;
    try {
      // Try to get model-specific encoding
      encoder = encoding_for_model((modelId || 'gpt-4o') as TiktokenModel);
    } catch (e) {
      // Fallback to cl100k_base (used by GPT-4 and recent models)
      encoder = get_encoding('cl100k_base');
    }
    
    const tokens = encoder.encode(text).length;
    encoder.free();
    return tokens;
  } catch (e) {
    // Final fallback: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

/**
 * LLM Client class
 */
export class LLMClient {
  private config: LLMClientConfig;
  private totalCostUsd: number = 0;
  private totalTokens: number = 0;
  private callCount: number = 0;
  private anthropicClient?: Anthropic;
  private openaiClient?: OpenAI;
  private logger = createLogger('gorchestrator');
  private metricsPersistencePath?: string;

  constructor(config: LLMClientConfig = {}) {
    this.config = {
      defaultModel: 'claude-sonnet-4-6',
      maxTokens: 4096,
      timeoutMs: 30000,
      ...config,
    };
    this.metricsPersistencePath = this.config.metricsPersistencePath;
    this.loadPersistedMetrics();
  }

  /**
   * Resolve the Anthropic API key from explicit config or environment.
   * Falls back to ANTHROPIC_API_KEY so env-based deployment works without
   * threading the key through every constructor.
   */
  private resolveAnthropicApiKey(): string | undefined {
    return this.config.anthropicApiKey || process.env.ANTHROPIC_API_KEY || undefined;
  }

  private resolveOpenAIApiKey(): string | undefined {
    return this.config.openaiApiKey || process.env.OPENAI_API_KEY || undefined;
  }

  /**
   * Lazily construct the Anthropic SDK client, reading the key from config or
   * the ANTHROPIC_API_KEY environment variable. Throws a clear error when no
   * key is available so the failure surfaces instead of producing empty output.
   */
  private getAnthropicClient(): Anthropic {
    if (!this.anthropicClient) {
      const apiKey = this.resolveAnthropicApiKey();
      if (!apiKey) {
        throw new Error(
          'Anthropic API key not provided. Set ANTHROPIC_API_KEY in the environment or pass anthropicApiKey in the client config.'
        );
      }
      this.anthropicClient = new Anthropic({
        apiKey,
        timeout: this.config.timeoutMs,
      });
    }
    return this.anthropicClient;
  }

  private getOpenAIClient(): OpenAI {
    if (!this.openaiClient) {
      const apiKey = this.resolveOpenAIApiKey();
      if (!apiKey) {
        throw new Error(
          'OpenAI API key not provided. Set OPENAI_API_KEY in the environment or pass openaiApiKey in the client config.'
        );
      }
      this.openaiClient = new OpenAI({
        apiKey,
        timeout: this.config.timeoutMs,
      });
    }
    return this.openaiClient;
  }

  /**
   * Call an LLM with the given prompt
   */
  async call(
    prompt: string,
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      signal?: AbortSignal;
    } = {}
  ): Promise<LLMCallResult> {
    const model = options.model || this.config.defaultModel || 'claude-sonnet-4-6';
    const maxTokens = options.maxTokens || this.config.maxTokens || 4096;
    const startTime = Date.now();

    // Estimate input tokens up front; replaced with provider-reported usage when available.
    let inputTokens = estimateTokens(prompt, model);

    let content = '';
    let outputTokens = 0;

    if (model.startsWith('claude') || model.startsWith('anthropic/')) {
      const result = await this.callAnthropic(prompt, model, options);
      content = result.content;
      outputTokens = result.outputTokens;
      if (typeof result.inputTokens === 'number') inputTokens = result.inputTokens;
    } else if (model.includes('gpt')) {
      const result = await this.callOpenAI(prompt, model, options);
      content = result.content;
      outputTokens = result.outputTokens;
      if (typeof result.inputTokens === 'number') inputTokens = result.inputTokens;
    } else {
      // Fallback to legacy simulation if no real call possible
      content = await this.simulateLLMCall(prompt, model, options.temperature);
      outputTokens = estimateTokens(content, model);
    }

    const latency = Date.now() - startTime;
    const cost = estimateCostUsd(model, inputTokens, outputTokens);

    // Track metrics
    this.totalCostUsd += cost;
    this.totalTokens += inputTokens + outputTokens;
    this.callCount++;
    this.persistMetrics();

    if (this.config.onSpend) {
      await this.config.onSpend(model, inputTokens, outputTokens, cost);
    }

    return {
      content,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      model_id: model,
      cost_usd: cost,
      latency_ms: latency,
    };
  }

  /**
   * Real call to Anthropic SDK
   */
  private async callAnthropic(
    prompt: string,
    model: string,
    options: any
  ): Promise<{ content: string; outputTokens: number; inputTokens?: number }> {
    const client = this.getAnthropicClient();

    const response = await client.messages.create(
      {
        // Strip vendor prefix (e.g. "anthropic/claude-...") for the SDK.
        model: model.replace(/^anthropic\//, ''),
        max_tokens: options.maxTokens || this.config.maxTokens || 4096,
        temperature: options.temperature,
        messages: [{ role: 'user', content: prompt }],
      },
      { signal: options.signal, timeout: this.config.timeoutMs }
    );

    const block = Array.isArray(response.content) ? response.content[0] : undefined;
    const content = block && block.type === 'text' ? block.text : '';
    return {
      content,
      outputTokens: response.usage?.output_tokens ?? estimateTokens(content, model),
      inputTokens: response.usage?.input_tokens,
    };
  }

  /**
   * Real call to OpenAI SDK
   */
  private async callOpenAI(
    prompt: string,
    model: string,
    options: any
  ): Promise<{ content: string; outputTokens: number; inputTokens?: number }> {
    const client = this.getOpenAIClient();

    const response = await client.chat.completions.create(
      {
        model: model.replace(/^openai\//, ''),
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options.maxTokens || this.config.maxTokens || 4096,
        temperature: options.temperature,
      },
      { signal: options.signal, timeout: this.config.timeoutMs }
    );

    const choice = Array.isArray(response.choices) ? response.choices[0] : undefined;
    const content = choice?.message?.content ?? '';
    return {
      content,
      outputTokens: response.usage?.completion_tokens ?? estimateTokens(content, model),
      inputTokens: response.usage?.prompt_tokens,
    };
  }

  /**
   * Simulate an LLM call (fallback)
   */
  private async simulateLLMCall(
    prompt: string,
    model: string,
    temperature?: number
  ): Promise<string> {
    const pricing = MODEL_PRICING[model];
    const latency = pricing?.avg_latency_ms || 1000;
    await new Promise(resolve => setTimeout(resolve, latency / 10));

    if (prompt.toLowerCase().includes('plan') || prompt.toLowerCase().includes('decompose')) {
      return JSON.stringify([
        'Analyze task requirements',
        'Design solution architecture',
        'Implement core functionality',
        'Test implementation',
        'Document results'
      ]);
    }

    if (prompt.toLowerCase().includes('execute') || prompt.toLowerCase().includes('subtask')) {
      return JSON.stringify({
        result: 'Executed successfully',
        confidence: 0.85
      });
    }

    if (prompt.toLowerCase().includes('action') || prompt.toLowerCase().includes('decision')) {
      return JSON.stringify({
        type: 'continue',
        reasoning: 'Task not yet complete'
      });
    }

    return JSON.stringify({
      response: 'Processed',
      confidence: 0.7
    });
  }

  getTotalCostUsd(): number {
    return this.totalCostUsd;
  }

  getTotalTokens(): number {
    return this.totalTokens;
  }

  getCallCount(): number {
    return this.callCount;
  }

  resetMetrics(): void {
    this.totalCostUsd = 0;
    this.totalTokens = 0;
    this.callCount = 0;
    this.persistMetrics();
  }

  getModelByTier(tier: 'tier1' | 'tier2' | 'tier3', preferredModel?: string): string {
    if (preferredModel && MODEL_PRICING[preferredModel]) return preferredModel;
    const resolved = MODEL_RESOLUTION_CHAIN.find(entry => entry.tier === tier && entry.model);
    return resolved?.model || MODEL_TIERS[tier];
  }

  getModelResolutionChain(): typeof MODEL_RESOLUTION_CHAIN {
    return MODEL_RESOLUTION_CHAIN;
  }

  private loadPersistedMetrics(): void {
    if (!this.metricsPersistencePath || !fs.existsSync(this.metricsPersistencePath)) {
      return;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.metricsPersistencePath, 'utf-8'));
      this.totalCostUsd = typeof parsed.totalCostUsd === 'number' ? parsed.totalCostUsd : 0;
      this.totalTokens = typeof parsed.totalTokens === 'number' ? parsed.totalTokens : 0;
      this.callCount = typeof parsed.callCount === 'number' ? parsed.callCount : 0;
    } catch (error) {
      this.logger.warn('Failed to load persisted LLM metrics', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private persistMetrics(): void {
    if (!this.metricsPersistencePath) {
      return;
    }

    try {
      fs.mkdirSync(path.dirname(this.metricsPersistencePath), { recursive: true });
      fs.writeFileSync(this.metricsPersistencePath, JSON.stringify({
        totalCostUsd: this.totalCostUsd,
        totalTokens: this.totalTokens,
        callCount: this.callCount,
        updatedAt: new Date().toISOString(),
      }, null, 2), { mode: 0o600 });
    } catch (error) {
      this.logger.warn('Failed to persist LLM metrics', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
