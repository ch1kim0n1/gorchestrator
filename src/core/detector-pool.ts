import {
  DetectorName,
  DetectorOutput,
  RelationshipAnalysisTask,
} from '../types/index.js';

export interface DetectorPoolConfig {
  tier1_model: string;
  tier2_model: string;
  consensus_threshold: number;
}

export interface LLMClient {
  call(prompt: string, options: { model: string; temperature?: number }): Promise<{
    content: string;
    input_tokens: number;
    output_tokens: number;
    model_id: string;
    cost_usd: number;
    latency_ms: number;
  }>;
}

// Positive and negative sentiment word sets for predictive_divergence
const POSITIVE_WORDS = new Set([
  'love', 'happy', 'good', 'great', 'wonderful', 'amazing', 'thank', 'thanks',
  'appreciate', 'glad', 'joy', 'smile', 'excited', 'yes', 'okay', 'sure',
  'together', 'care', 'wonderful', 'beautiful', 'lovely', 'sweet', 'kind',
]);

const NEGATIVE_WORDS = new Set([
  'hate', 'angry', 'bad', 'terrible', 'awful', 'hurt', 'alone', 'sad',
  'no', 'never', 'stop', 'leave', 'gone', 'miss', 'wrong', 'disappointed',
  'frustrated', 'upset', 'ignored', 'abandoned', 'cold', 'distant', 'lost',
]);

function messageSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lower = text.toLowerCase();
  const words = lower.split(/\W+/);
  let pos = 0;
  let neg = 0;
  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) pos++;
    if (NEGATIVE_WORDS.has(word)) neg++;
  }
  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}

type Message = {
  participant: string;
  text: string;
  timestamp: string;
  type?: string;
};

type DetectionResult = {
  detector: string;
  detected: boolean;
  confidence: number;
  evidence: string[];
};

function runBidClassification(messages: Message[]): DetectionResult {
  const BID_PATTERNS = /\?$|\bcan we\b|\bcould we\b|\blet's\b|\blets\b/i;
  const evidence: string[] = [];

  for (const message of messages) {
    const trimmed = message.text.trim();
    if (BID_PATTERNS.test(trimmed)) {
      evidence.push(`[${message.participant}] ${trimmed}`);
    }
  }

  const detected = evidence.length > 0;
  const confidence = detected
    ? Math.min(0.5 + evidence.length * 0.1, 0.95)
    : 0.1;

  return { detector: 'bid_classification', detected, confidence, evidence };
}

function runBidAsymmetry(messages: Message[]): DetectionResult {
  const counts: Record<string, number> = {};
  for (const message of messages) {
    counts[message.participant] = (counts[message.participant] ?? 0) + 1;
  }
  const total = messages.length;
  const evidence: string[] = [];
  let detected = false;
  let maxShare = 0;

  for (const [participant, count] of Object.entries(counts)) {
    const share = total > 0 ? count / total : 0;
    if (share > 0.7) {
      detected = true;
      evidence.push(`Participant ${participant} sent ${count}/${total} messages (${(share * 100).toFixed(0)}%)`);
    }
    if (share > maxShare) maxShare = share;
  }

  const confidence = detected ? Math.min(0.5 + (maxShare - 0.7) * 3, 0.95) : 0.15;
  return { detector: 'bid_asymmetry', detected, confidence, evidence };
}

function runRepairDetection(messages: Message[]): DetectionResult {
  const REPAIR_PATTERNS = /\bsorry\b|\bi didn'?t mean\b|\bcan we talk\b|\bi was wrong\b/i;
  const evidence: string[] = [];

  for (const message of messages) {
    if (REPAIR_PATTERNS.test(message.text)) {
      evidence.push(`[${message.participant}] ${message.text.trim()}`);
    }
  }

  const detected = evidence.length > 0;
  const confidence = detected ? Math.min(0.6 + evidence.length * 0.1, 0.95) : 0.1;
  return { detector: 'repair_detection', detected, confidence, evidence };
}

function runLaborAsymmetry(messages: Message[]): DetectionResult {
  const EMOTIONAL_WORDS = /\bfeel\b|\bfelt\b|\bhurt\b|\bcare\b|\bworry\b|\bworried\b|\bsad\b|\bhappy\b|\bangry\b|\balone\b|\bmiss\b|\bneed\b|\bscared\b|\bexcited\b|\bjoy\b|\bgrief\b|\bstressed\b/i;
  const emotionalCounts: Record<string, number> = {};
  const totalCounts: Record<string, number> = {};

  for (const message of messages) {
    totalCounts[message.participant] = (totalCounts[message.participant] ?? 0) + 1;
    const emotionalWordCount = (message.text.match(EMOTIONAL_WORDS) ?? []).length;
    emotionalCounts[message.participant] = (emotionalCounts[message.participant] ?? 0) + emotionalWordCount;
  }

  const total = Object.values(emotionalCounts).reduce((sum, count) => sum + count, 0);
  const evidence: string[] = [];
  let detected = false;
  let maxShare = 0;

  for (const [participant, count] of Object.entries(emotionalCounts)) {
    const share = total > 0 ? count / total : 0;
    if (share > 0.7) {
      detected = true;
      evidence.push(`Participant ${participant} carries ${(share * 100).toFixed(0)}% of emotional content`);
    }
    if (share > maxShare) maxShare = share;
  }

  const confidence = detected ? Math.min(0.5 + (maxShare - 0.7) * 3, 0.9) : 0.15;
  return { detector: 'labor_asymmetry', detected, confidence, evidence };
}

function runPhantomThirdParty(messages: Message[]): DetectionResult {
  const THIRD_PARTY_PATTERNS = /\bmy ex\b|\bmy mom\b|\bmy dad\b|\bmy boss\b|\bmy friend\b/gi;
  const mentionCounts: Record<string, number> = {};

  for (const message of messages) {
    const matches = message.text.match(THIRD_PARTY_PATTERNS) ?? [];
    for (const match of matches) {
      const normalized = match.toLowerCase();
      mentionCounts[normalized] = (mentionCounts[normalized] ?? 0) + 1;
    }
  }

  const evidence: string[] = [];
  let detected = false;

  for (const [phrase, count] of Object.entries(mentionCounts)) {
    if (count >= 3) {
      detected = true;
      evidence.push(`"${phrase}" mentioned ${count} times`);
    }
  }

  const totalMentions = Object.values(mentionCounts).reduce((sum, count) => sum + count, 0);
  const confidence = detected ? Math.min(0.55 + totalMentions * 0.03, 0.9) : 0.1;
  return { detector: 'phantom_third_party', detected, confidence, evidence };
}

function runPredictiveDivergence(messages: Message[]): DetectionResult {
  if (messages.length < 2) {
    return {
      detector: 'predictive_divergence',
      detected: false,
      confidence: 0.1,
      evidence: ['Insufficient message count for divergence analysis'],
    };
  }

  const sentiments = messages.map(message => messageSentiment(message.text));
  let alternations = 0;
  for (let i = 1; i < sentiments.length; i++) {
    const prev = sentiments[i - 1];
    const curr = sentiments[i];
    if (
      (prev === 'positive' && curr === 'negative') ||
      (prev === 'negative' && curr === 'positive')
    ) {
      alternations++;
    }
  }

  const alternationRate = alternations / (sentiments.length - 1);
  const detected = alternationRate > 0.3;
  const evidence = detected
    ? [`Sentiment alternation rate: ${(alternationRate * 100).toFixed(0)}% (${alternations}/${sentiments.length - 1} transitions)`]
    : [];

  return {
    detector: 'predictive_divergence',
    detected,
    confidence: 0.5,
    evidence,
  };
}

const RULE_BASED_DETECTORS: Record<string, (messages: Message[]) => DetectionResult> = {
  bid_classification: runBidClassification,
  bid_asymmetry: runBidAsymmetry,
  repair_detection: runRepairDetection,
  labor_asymmetry: runLaborAsymmetry,
  phantom_third_party: runPhantomThirdParty,
  predictive_divergence: runPredictiveDivergence,
  // emotion_labeling falls through to a simple rule-based stub
  emotion_labeling: (messages: Message[]) => {
    const EMOTION_PATTERNS = /\bfeel\b|\bfelt\b|\bhurt\b|\bsad\b|\bhappy\b|\bangry\b|\balone\b|\bscared\b|\bjoy\b|\bguilty\b|\basham/i;
    const evidence: string[] = [];
    for (const message of messages) {
      if (EMOTION_PATTERNS.test(message.text)) {
        evidence.push(`[${message.participant}] ${message.text.trim()}`);
      }
    }
    const detected = evidence.length > 0;
    return {
      detector: 'emotion_labeling',
      detected,
      confidence: detected ? Math.min(0.55 + evidence.length * 0.08, 0.9) : 0.1,
      evidence,
    };
  },
};

export class DetectorPool {
  private llmClient: LLMClient;
  private config: DetectorPoolConfig;

  constructor(llmClient: LLMClient, config: DetectorPoolConfig) {
    this.llmClient = llmClient;
    this.config = config;
  }

  /**
   * Run detectors against a message window.
   * Uses LLM for detection with tier escalation for low confidence results.
   */
  async runDetectors(
    task: RelationshipAnalysisTask,
    detectors: DetectorName[],
  ): Promise<DetectorOutput[]> {
    const messages: Message[] = task.message_window.map(msg => ({
      participant: msg.participant,
      text: msg.text,
      timestamp: msg.timestamp,
      type: (msg as any).type,
    }));

    const results: DetectorOutput[] = [];
    let totalCost = 0;
    const maxCost = task.budget?.max_cost_usd ?? Infinity;

    for (const detector of detectors) {
      if (totalCost >= maxCost) break;
      // Use running average to predict whether the next call would exceed budget
      if (results.length > 0) {
        const avgCostPerDetector = totalCost / results.length;
        if (totalCost + avgCostPerDetector > maxCost) break;
      }

      const result = await this.runDetectorWithTierEscalation(task, detector, messages);
      totalCost += result.cost_usd;
      results.push(result);
    }

    return results;
  }

  private async runDetectorWithTierEscalation(
    task: RelationshipAnalysisTask,
    detector: DetectorName,
    messages: Message[],
  ): Promise<DetectorOutput> {
    // First attempt with tier1 model
    let result = await this.runDetectorLLM(task, detector, messages, this.config.tier1_model);

    // Escalate to tier2 if confidence is below threshold
    if (result.confidence < this.config.consensus_threshold) {
      const tier2Result = await this.runDetectorLLM(task, detector, messages, this.config.tier2_model);
      // Use tier2 result if it has higher confidence
      if (tier2Result.confidence > result.confidence) {
        result = tier2Result;
      }
    }

    return result;
  }

  private async runDetectorLLM(
    task: RelationshipAnalysisTask,
    detector: DetectorName,
    messages: Message[],
    model: string,
  ): Promise<DetectorOutput> {
    const prompt = this.buildDetectorPrompt(detector, messages);
    const response = await this.llmClient.call(prompt, { model });

    let parsed: any;
    try {
      parsed = JSON.parse(response.content);
    } catch {
      parsed = { detected: false, confidence: 0.1 };
    }

    return {
      detector,
      dyad_id: task.dyad_id,
      result: {
        detected: parsed.detected ?? false,
        evidence: parsed.evidence ?? [],
      },
      confidence: parsed.confidence ?? 0.1,
      model_used: response.model_id,
      cost_usd: response.cost_usd,
      latency_ms: response.latency_ms,
    };
  }

  private buildDetectorPrompt(detector: DetectorName, messages: Message[]): string {
    const messagesText = messages.map(m => `[${m.participant}]: ${m.text}`).join('\n');
    return `You are a relationship analysis detector specializing in ${detector}.

Analyze the following conversation messages and detect patterns related to ${detector}:
${messagesText}

Return a JSON object with:
{
  "detected": boolean,
  "confidence": number (0-1),
  "evidence": [array of string explanations]
}`;
  }
}
