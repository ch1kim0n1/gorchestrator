import {
  DetectorName,
  DetectorOutput,
  RelationshipAnalysisTask,
} from '../types/index.js';
import { LLMClient } from './llm-client.js';

type DetectorLLMClient = Pick<LLMClient, 'call'>;

export const DETECTOR_PROMPTS: Record<DetectorName, string> = {
  emotion_labeling: 'Identify tentative emotion labels in the redacted DYAD message window. Avoid diagnosis. Return JSON with result and confidence.',
  bid_classification: 'Classify bids for connection and responses as toward, away, against, or unclear. Return JSON with result and confidence.',
  repair_detection: 'Detect repair attempts, repair success signals, and missed repair windows. Return JSON with result and confidence.',
  labor_asymmetry: 'Assess emotional labor asymmetry without blame. Return JSON with result and confidence.',
  phantom_third_party: 'Detect references to a recurring outside comparison or phantom third party. Return JSON with result and confidence.',
  predictive_divergence: 'Predict where interaction trajectories may diverge if a bid is acknowledged or ignored. Return JSON with result and confidence.',
};

export class DetectorPool {
  private cumulativeCostUsd = 0;

  constructor(
    private readonly llmClient: DetectorLLMClient,
    private readonly config: {
      tier1_model: string;
      tier2_model: string;
      consensus_threshold?: number;
    },
  ) {}

  async runDetectors(
    task: RelationshipAnalysisTask,
    detectors: DetectorName[],
  ): Promise<DetectorOutput[]> {
    this.cumulativeCostUsd = 0;
    const settled = await Promise.all(
      detectors.map(detector => this.runDetectorWithBudget(task, detector))
    );

    return settled.filter((output): output is DetectorOutput => output !== null);
  }

  private async runDetectorWithBudget(
    task: RelationshipAnalysisTask,
    detector: DetectorName,
  ): Promise<DetectorOutput | null> {
    if (this.cumulativeCostUsd >= task.budget.max_cost_usd) {
      return null;
    }

    const primary = await this.callDetector(task, detector, this.config.tier1_model);
    let output = primary;

    if (primary.confidence < (this.config.consensus_threshold ?? 0.7)) {
      const tier2 = await this.callDetector(task, detector, this.config.tier2_model);
      output = tier2.confidence >= primary.confidence ? tier2 : primary;
    }

    if (this.cumulativeCostUsd + output.cost_usd > task.budget.max_cost_usd) {
      return null;
    }

    this.cumulativeCostUsd += output.cost_usd;
    return output;
  }

  private async callDetector(
    task: RelationshipAnalysisTask,
    detector: DetectorName,
    model: string,
  ): Promise<DetectorOutput> {
    const start = performance.now();
    const prompt = `${DETECTOR_PROMPTS[detector]}

Dyad ID: ${task.dyad_id}
Time range: ${task.time_range.start} - ${task.time_range.end}
Messages:
${JSON.stringify(task.message_window, null, 2)}

Return strict JSON:
{
  "result": {},
  "confidence": 0.0
}`;

    try {
      const response = await this.llmClient.call(prompt, {
        model,
        maxTokens: 512,
        temperature: 0.2,
      });
      const parsed = this.parseJsonObject(response.content);
      return {
        detector,
        dyad_id: task.dyad_id,
        result: typeof parsed.result === 'object' && parsed.result !== null ? parsed.result : parsed,
        confidence: this.clamp(parsed.confidence, 0.5),
        model_used: response.model_id || model,
        cost_usd: Math.max(0, response.cost_usd || 0),
        latency_ms: response.latency_ms ?? performance.now() - start,
      };
    } catch (error) {
      return {
        detector,
        dyad_id: task.dyad_id,
        result: {
          fallback: true,
          reason: error instanceof Error ? error.message : String(error),
        },
        confidence: 0.5,
        model_used: model,
        cost_usd: 0,
        latency_ms: performance.now() - start,
      };
    }
  }

  private parseJsonObject(content: string): any {
    try {
      return JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : {};
    }
  }

  private clamp(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.min(1, value))
      : fallback;
  }
}
