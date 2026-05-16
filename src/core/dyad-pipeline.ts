import {
  DetectorOutput,
  DyadPipelineResult,
  RelationshipAnalysisTask,
  RelationshipAnalysisTaskSchema,
  RelationalConflictPredictionResponse,
  RelationalInsightScoreRequest,
  ScoreResponse,
} from '../types/index.js';
import { DetectorPool } from './detector-pool.js';

export class DyadPipeline {
  constructor(private readonly config: {
    detectorPool: DetectorPool;
    gtomEndpoint?: string;
    gmirrorEndpoint?: string;
    fetchImpl?: typeof fetch;
    logger?: { warn: (message: string, context?: Record<string, unknown>) => void };
  }) {}

  async run(task: RelationshipAnalysisTask): Promise<DyadPipelineResult> {
    const parsed = RelationshipAnalysisTaskSchema.parse(task);
    const start = performance.now();
    const relationalRisk = await this.checkRelationalConflicts(parsed);

    if (relationalRisk.aggregate_risk > 0.8) {
      return this.buildRefusalResult(parsed, relationalRisk, performance.now() - start);
    }

    const detectorOutputs = await this.config.detectorPool.runDetectors(parsed, parsed.detectors);
    const scoringResult = detectorOutputs.some(output => output.result?.should_refuse === true)
      ? this.refusalScore()
      : await this.scoreWithGMirror(parsed, detectorOutputs);
    const verdict = scoringResult.overall === 'fail' ? 'fail' : 'pass';

    return {
      dyad_id: parsed.dyad_id,
      detector_outputs: detectorOutputs,
      scoring_result: scoringResult,
      gtom_risk: relationalRisk.aggregate_risk,
      verdict,
      cost_usd: detectorOutputs.reduce((sum, output) => sum + output.cost_usd, 0),
      latency_ms: performance.now() - start,
    };
  }

  async checkRelationalConflicts(task: RelationshipAnalysisTask): Promise<RelationalConflictPredictionResponse> {
    const fetchImpl = this.config.fetchImpl ?? fetch;
    try {
      const response = await fetchImpl(`${this.config.gtomEndpoint}/gtom/predict-relational-conflicts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dyad_id: task.dyad_id,
          participant_a: this.buildParticipant(task, 'a'),
          participant_b: this.buildParticipant(task, 'b'),
          message_window: task.message_window,
          analysis_mode: 'relational',
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        throw new Error(`GToM returned ${response.status}`);
      }
      const data = await response.json();
      return {
        aggregate_risk: this.clamp(data.aggregate_risk ?? data.risk ?? 0, 0),
        conflicts: data.conflicts || data.predicted_conflicts || [],
        reason: data.reason,
      };
    } catch (error) {
      this.config.logger?.warn('GToM relational conflict check failed; allowing detector execution', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { aggregate_risk: 0, conflicts: [], reason: 'gtom_unavailable_allow' };
    }
  }

  buildRefusalResult(
    task: RelationshipAnalysisTask,
    relationalRisk: RelationalConflictPredictionResponse,
    latencyMs = 0,
  ): DyadPipelineResult {
    return {
      dyad_id: task.dyad_id,
      detector_outputs: [],
      scoring_result: this.refusalScore(),
      gtom_risk: relationalRisk.aggregate_risk,
      verdict: 'refused',
      reason: relationalRisk.reason || `Relational risk ${relationalRisk.aggregate_risk.toFixed(2)} exceeds threshold`,
      cost_usd: 0,
      latency_ms: latencyMs,
    };
  }

  async scoreWithGMirror(
    task: RelationshipAnalysisTask,
    detectorOutputs: DetectorOutput[],
  ): Promise<ScoreResponse> {
    if (!this.config.gmirrorEndpoint) {
      const confidence = detectorOutputs.length > 0
        ? detectorOutputs.reduce((sum, o) => sum + o.confidence, 0) / detectorOutputs.length
        : 0.8;
      return { overall: 'pass', confidence, scores: {} };
    }
    const fetchImpl = this.config.fetchImpl ?? fetch;
    const request = this.buildScoreInsightRequest(task, detectorOutputs);
    const response = await fetchImpl(`${this.config.gmirrorEndpoint}/gmirror/score-insight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(`GMirror returned ${response.status}`);
    }
    return response.json();
  }

  buildScoreInsightRequest(
    task: RelationshipAnalysisTask,
    detectorOutputs: DetectorOutput[],
  ): RelationalInsightScoreRequest {
    const primary = detectorOutputs[0];
    const confidence = detectorOutputs.length > 0
      ? detectorOutputs.reduce((sum, output) => sum + output.confidence, 0) / detectorOutputs.length
      : 0;
    const insightText = primary
      ? `${primary.detector}: ${JSON.stringify(primary.result)}`
      : 'No relationship insight generated.';

    return {
      insight_id: `${task.dyad_id}:${primary?.detector || 'none'}`,
      dyad_id: task.dyad_id,
      scoring_mode: 'dyad_insight',
      insight_type: this.mapDetectorToInsightType(primary?.detector),
      insight_text: insightText,
      supporting_evidence: task.message_window.map(message => message.text),
      ethical_refusal_triggered: detectorOutputs.some(output => output.result?.should_refuse === true),
      confidence,
    };
  }

  private buildParticipant(task: RelationshipAnalysisTask, participant: 'a' | 'b') {
    return {
      participant_id: participant,
      message_count: task.message_window.filter(message => message.participant === participant).length,
    };
  }

  private mapDetectorToInsightType(detector?: DetectorOutput['detector']): RelationalInsightScoreRequest['insight_type'] {
    switch (detector) {
      case 'emotion_labeling':
        return 'emotion_label';
      case 'bid_classification':
        return 'bid_classification';
      case 'repair_detection':
      case 'predictive_divergence':
        return 'repair_suggestion';
      case 'labor_asymmetry':
      case 'phantom_third_party':
      default:
        return 'labor_asymmetry';
    }
  }

  private refusalScore(): ScoreResponse {
    return {
      score: 0,
      confidence: 1,
      overall: 'fail',
      scoring_mode: 'dyad_insight',
      scores: {},
      timestamp: new Date().toISOString(),
    };
  }

  private clamp(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.min(1, value))
      : fallback;
  }
}
