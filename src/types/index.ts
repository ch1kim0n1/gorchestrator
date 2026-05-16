import { z } from 'zod';

// ============================================================================
// Core Type Schemas with Zod Validation
// ============================================================================

export const ConstraintSchema = z.object({
  type: z.enum(['latency', 'cost', 'security', 'compliance', 'performance']),
  value: z.string(),
  operator: z.enum(['<', '>', '<=', '>=', '=', '!=']),
  priority: z.number().min(0).max(10),
});

export type Constraint = z.infer<typeof ConstraintSchema>;

export const OutcomeShapeSchema = z.object({
  type: z.enum(['code', 'document', 'deployment', 'research', 'config_change']),
  format: z.string(),
  validation_criteria: z.array(z.string()),
});

export type OutcomeShape = z.infer<typeof OutcomeShapeSchema>;

export const GBrainRefSchema = z.object({
  ref_type: z.enum(['page', 'entity', 'skill', 'pattern']),
  ref_id: z.string(),
  confidence: z.number().min(0).max(1),
});

export type GBrainRef = z.infer<typeof GBrainRefSchema>;

export const TaskSignatureSchema = z.object({
  task_type: z.string(),
  surfaces: z.array(z.string()),
  constraints: z.array(ConstraintSchema),
  outcome_shape: OutcomeShapeSchema,
  context_refs: z.array(GBrainRefSchema),
  hash: z.string(),
});

export type TaskSignature = z.infer<typeof TaskSignatureSchema>;

export const GBrainPriorBundleSchema = z.object({
  similar_tasks: z.array(TaskSignatureSchema),
  winning_configs: z.array(z.object({
    config: z.any(), // AgentConfig - circular reference handled below
    win_rate: z.number().min(0).max(1),
    n: z.number().int().positive(),
  })),
  known_failure_modes: z.array(z.object({
    pattern: z.string(),
    frequency: z.number(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
  })),
  recommended_n: z.number().int().positive(),
  user_preferences: z.record(z.any()),
  domain_constraints: z.record(z.any()),
});

export type GBrainPriorBundle = z.infer<typeof GBrainPriorBundleSchema>;

export const ExecutionBudgetSchema = z.object({
  max_attempts: z.number().int().positive().default(5),
  max_cost_usd: z.number().positive().default(100),
  max_wall_time_ms: z.number().int().positive().default(300000), // 5 minutes
  max_parallelism: z.number().int().positive().default(5),
});

export type ExecutionBudget = z.infer<typeof ExecutionBudgetSchema>;

export const TaskBundleSchema = z.object({
  task_id: z.string().uuid(),
  raw_description: z.string(),
  signature: TaskSignatureSchema,
  priors: GBrainPriorBundleSchema,
  budget: ExecutionBudgetSchema,
  created_at: z.string().datetime(),
});

export type TaskBundle = z.infer<typeof TaskBundleSchema>;

export const ReasoningStyleSchema = z.enum([
  'depth_first',
  'breadth_first',
  'plan_then_act',
  'react_style',
  'hybrid',
]);

export type ReasoningStyle = z.infer<typeof ReasoningStyleSchema>;

export const SamplingParamsSchema = z.object({
  temperature: z.number().min(0).max(2).default(0.7),
  top_p: z.number().min(0).max(1).default(0.9),
  top_k: z.number().int().positive().optional(),
  frequency_penalty: z.number().min(-2).max(2).default(0),
  presence_penalty: z.number().min(-2).max(2).default(0),
});

export type SamplingParams = z.infer<typeof SamplingParamsSchema>;

export const ToolScopeSchema = z.object({
  tool_name: z.string(),
  access_level: z.enum(['none', 'read', 'write', 'admin']),
  constraints: z.array(z.string()).optional(),
});

export type ToolScope = z.infer<typeof ToolScopeSchema>;

export const ConfigProvenanceSchema = z.enum([
  'exploit',
  'perturb',
  'explore',
  'manual',
]);

export type ConfigProvenance = z.infer<typeof ConfigProvenanceSchema>;

export const AgentConfigSchema = z.object({
  config_id: z.string().uuid(),
  base_model: z.string(),
  reasoning_budget: z.number().positive().default(100000), // tokens
  skill_set: z.array(z.string()), // GStack skill references
  decomposition_strategy: z.string(),
  tool_scopes: z.array(ToolScopeSchema),
  reasoning_style: ReasoningStyleSchema,
  sampling: SamplingParamsSchema,
  provenance: ConfigProvenanceSchema,
  parent_config_id: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
  execution_receipt: z.any().optional(), // ExecutionReceipt from quality-rubric
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const DeliverableSchema = z.object({
  type: z.enum(['code', 'document', 'deployment', 'research', 'config_change']),
  content: z.string(),
  artifacts: z.array(z.object({
    path: z.string(),
    content: z.string().optional(),
    hash: z.string(),
  })),
  metadata: z.record(z.any()).optional(),
});

export type Deliverable = z.infer<typeof DeliverableSchema>;

export const TraceEventSchema = z.object({
  timestamp: z.string().datetime(),
  event_type: z.enum([
    'model_call',
    'tool_call',
    'file_mutation',
    'error',
    'checkpoint',
    'decision',
  ]),
  data: z.record(z.any()),
  cost_usd: z.number().optional(),
});

export type TraceEvent = z.infer<typeof TraceEventSchema>;

export const TraceBundleSchema = z.object({
  events: z.array(TraceEventSchema),
  total_cost_usd: z.number(),
  total_tokens: z.number(),
  total_wall_time_ms: z.number(),
});

export type TraceBundle = z.infer<typeof TraceBundleSchema>;

export const CostBreakdownSchema = z.object({
  model_cost_usd: z.number(),
  tool_cost_usd: z.number(),
  sandbox_cost_usd: z.number(),
  total_cost_usd: z.number(),
  tokens_used: z.number().optional(),
  llm_calls: z.number().optional(),
});

export type CostBreakdown = z.infer<typeof CostBreakdownSchema>;

export const AttemptResultSchema = z.object({
  attempt_id: z.string().uuid(),
  task_id: z.string().uuid(),
  config_id: z.string().uuid(),
  sandbox_id: z.string().uuid(),
  status: z.enum(['completed', 'timeout', 'errored', 'aborted']),
  deliverable: DeliverableSchema.optional(),
  trace: TraceBundleSchema,
  cost: CostBreakdownSchema,
  wall_time_ms: z.number(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  error_message: z.string().optional(),
});

export type AttemptResult = z.infer<typeof AttemptResultSchema>;

export const GMirrorScoreBundleSchema = z.object({
  correctness: z.object({
    score: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    evidence: z.array(z.string()),
  }),
  user_outcome: z.object({
    score: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    evidence: z.array(z.string()),
  }),
  robustness: z.object({
    score: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    evidence: z.array(z.string()),
  }),
  risk: z.object({
    score: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    evidence: z.array(z.string()),
  }),
  overall_score: z.number().min(0).max(1),
  hard_gates_passed: z.boolean(),
});

export type GMirrorScoreBundle = z.infer<typeof GMirrorScoreBundleSchema>;

export const ScoredAttemptSchema = AttemptResultSchema.extend({
  scores: GMirrorScoreBundleSchema,
  selected: z.boolean(),
  selection_reason: z.string().optional(),
});

export type ScoredAttempt = z.infer<typeof ScoredAttemptSchema>;

export const OrchestratorRunRecordSchema = z.object({
  task_id: z.string().uuid(),
  task_bundle: TaskBundleSchema,
  attempts: z.array(ScoredAttemptSchema),
  winner: z.string().uuid(),
  merged_output: DeliverableSchema.optional(),
  total_cost: CostBreakdownSchema,
  total_wall_time_ms: z.number(),
  gbrain_write_status: z.enum(['pending', 'written', 'failed']),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime(),
});

export type OrchestratorRunRecord = z.infer<typeof OrchestratorRunRecordSchema>;

// ============================================================================
// Sandbox Types
// ============================================================================

export const SandboxConfigSchema = z.object({
  backend: z.enum(['docker', 'e2b', 'modal', 'daytona', 'firecracker', 'inprocess']),
  image: z.string(),
  resource_limits: z.object({
    cpu_cores: z.number().int().positive(),
    memory_mb: z.number().int().positive(),
    disk_gb: z.number().int().positive(),
    max_wall_time_ms: z.number().int().positive(),
  }),
  network_isolation: z.boolean().default(true),
  allowlisted_domains: z.array(z.string()).default([]),
  snapshot_enabled: z.boolean().default(true),
});

export type SandboxConfig = z.infer<typeof SandboxConfigSchema>;

export const SandboxStateSchema = z.enum([
  'provisioning',
  'ready',
  'running',
  'completed',
  'failed',
  'destroyed',
]);

export type SandboxState = z.infer<typeof SandboxStateSchema>;

export const SandboxSchema = z.object({
  sandbox_id: z.string().uuid(),
  config: SandboxConfigSchema,
  state: SandboxStateSchema,
  attempt_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  error_message: z.string().optional(),
  trace_stream_url: z.string().optional(),
});

export type Sandbox = z.infer<typeof SandboxSchema>;

// ============================================================================
// Configuration Sampler Types
// ============================================================================

export const SamplingStrategySchema = z.enum([
  'exploit',
  'perturb',
  'explore',
  'manual',
]);

export type SamplingStrategy = z.infer<typeof SamplingStrategySchema>;

export const SamplingPlanSchema = z.object({
  configs: z.array(AgentConfigSchema),
  strategy_distribution: z.record(z.number().min(0).max(1)),
  total_configs: z.number().int().positive(),
  metadata: z.record(z.any()).optional(),
});

export type SamplingPlan = z.infer<typeof SamplingPlanSchema>;

// ============================================================================
// Selection Types
// ============================================================================

export const SelectionStrategySchema = z.enum([
  'highest_score',
  'component_substitution',
  'synthesized_merge',
]);

export type SelectionStrategy = z.infer<typeof SelectionStrategySchema>;

export const SelectionResultSchema = z.object({
  winner_attempt_id: z.string().uuid(),
  strategy_used: SelectionStrategySchema,
  selected_deliverable: DeliverableSchema,
  merge_sources: z.array(z.string().uuid()).optional(),
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
});

export type SelectionResult = z.infer<typeof SelectionResultSchema>;

// ============================================================================
// Integration Types
// ============================================================================

export const GBrainPrimingRequestSchema = z.object({
  signature_hash: z.string(),
  max_results: z.number().int().positive().default(10),
  similarity_threshold: z.number().min(0).max(1).default(0.7),
});

export type GBrainPrimingRequest = z.infer<typeof GBrainPrimingRequestSchema>;

export const GBrainWriteRequestSchema = z.object({
  run_record: OrchestratorRunRecordSchema,
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});

export type GBrainWriteRequest = z.infer<typeof GBrainWriteRequestSchema>;

export const GMirrorScoringRequestSchema = z.object({
  task: TaskBundleSchema,
  attempts: z.array(AttemptResultSchema),
  scoring_profile: z.string(),
  budget_ms: z.number().int().positive().default(30000),
});

export type GMirrorScoringRequest = z.infer<typeof GMirrorScoringRequestSchema>;

export const GMirrorScoringResponseSchema = z.object({
  score_set: z.array(z.object({
    attempt_id: z.string().uuid(),
    scores: GMirrorScoreBundleSchema,
  })),
  latency_ms: z.number(),
  simulated_user_coverage: z.number().min(0).max(1),
});

export type GMirrorScoringResponse = z.infer<typeof GMirrorScoringResponseSchema>;

// ============================================================================
// DYAD Relationship Analysis Types
// ============================================================================

export const DetectorNameSchema = z.enum([
  'emotion_labeling',
  'bid_classification',
  'repair_detection',
  'labor_asymmetry',
  'phantom_third_party',
  'predictive_divergence',
]);

export type DetectorName = z.infer<typeof DetectorNameSchema>;

export const RedactedMessageSchema = z.object({
  message_id: z.string().optional(),
  participant: z.enum(['a', 'b']),
  text: z.string(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.any()).optional(),
});

export type RedactedMessage = z.infer<typeof RedactedMessageSchema>;

export const RelationshipAnalysisTaskSchema = z.object({
  task_type: z.literal('relationship_analysis'),
  dyad_id: z.string(),
  message_window: z.array(RedactedMessageSchema),
  detectors: z.array(DetectorNameSchema).min(1),
  time_range: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  budget: z.object({
    max_cost_usd: z.number().positive(),
    max_latency_ms: z.number().int().positive(),
  }),
});

export type RelationshipAnalysisTask = z.infer<typeof RelationshipAnalysisTaskSchema>;

export const DetectorOutputSchema = z.object({
  detector: DetectorNameSchema,
  dyad_id: z.string(),
  result: z.record(z.unknown()),
  confidence: z.number().min(0).max(1),
  model_used: z.string(),
  cost_usd: z.number(),
  latency_ms: z.number(),
});

export type DetectorOutput = z.infer<typeof DetectorOutputSchema>;

export const ScoreResponseSchema = z.object({
  insight_id: z.string().optional(),
  attempt_id: z.string().optional(),
  score: z.number().min(0).max(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  overall: z.enum(['pass', 'pass_with_warnings', 'risky', 'fail']).optional(),
  scoring_mode: z.string().optional(),
  scores: z.record(z.any()).optional(),
  breakdown: z.record(z.any()).optional(),
  timestamp: z.string().optional(),
});

export type ScoreResponse = z.infer<typeof ScoreResponseSchema>;

export const DyadPipelineResultSchema = z.object({
  dyad_id: z.string(),
  detector_outputs: z.array(DetectorOutputSchema),
  scoring_result: ScoreResponseSchema,
  gtom_risk: z.number().min(0).max(1),
  verdict: z.enum(['pass', 'fail', 'refused']),
  reason: z.string().optional(),
  cost_usd: z.number(),
  latency_ms: z.number(),
});

export type DyadPipelineResult = z.infer<typeof DyadPipelineResultSchema>;

export interface DeveloperTaskRequest {
  description: string;
  taskType?: string;
  surfaces?: string[];
  constraints?: any[];
  outcomeShape?: any;
  budget?: any;
  userContext?: string;
  companyContext?: string;
  n?: number;
  verify?: boolean;
  cognitiveCheck?: boolean;
  priority?: 'normal' | 'high' | 'critical';
  signal?: AbortSignal;
  onProgress?: (event: any) => void;
}

export type OrchestratorTask = DeveloperTaskRequest | RelationshipAnalysisTask;

export interface RelationalInsightScoreRequest {
  insight_id: string;
  dyad_id: string;
  scoring_mode: 'dyad_insight';
  insight_type: 'emotion_label' | 'bid_classification' | 'repair_suggestion' | 'labor_asymmetry';
  insight_text: string;
  supporting_evidence: string[];
  ethical_refusal_triggered: boolean;
  confidence?: number;
}

export interface RelationalConflictPredictionResponse {
  aggregate_risk: number;
  conflicts?: Array<Record<string, unknown>>;
  reason?: string;
}

export const GToMConflictPredictionRequestSchema = z.object({
  task: TaskBundleSchema,
  active_attempts: z.array(z.object({
    attempt_id: z.string().uuid(),
    config_id: z.string().uuid(),
    current_state: z.record(z.any()),
    recent_actions: z.array(z.string()),
  })),
});

export type GToMConflictPredictionRequest = z.infer<typeof GToMConflictPredictionRequestSchema>;

export const GToMConflictPredictionResponseSchema = z.object({
  predicted_conflicts: z.array(z.object({
    attempt_ids: z.tuple([z.string().uuid(), z.string().uuid()]),
    conflict_type: z.enum(['file', 'resource', 'semantic', 'goal']),
    severity: z.number().min(0).max(1),
    predicted_at_step: z.number().int().optional(),
    recommended_action: z.enum(['reroute', 'serialize', 'merge', 'ignore']),
  })),
});

export type GToMConflictPredictionResponse = z.infer<typeof GToMConflictPredictionResponseSchema>;

export const GStackSkillManifestSchema = z.object({
  skill_id: z.string(),
  name: z.string(),
  description: z.string(),
  input_schema: z.record(z.any()),
  output_schema: z.record(z.any()),
  cost_estimate_usd: z.number(),
  typical_duration_ms: z.number(),
});

export type GStackSkillManifest = z.infer<typeof GStackSkillManifestSchema>;

// ============================================================================
// Multi-Model Consensus Types
// ============================================================================

export const MultiModelConfigSchema = z.object({
  default_tier: z.enum(['tier1', 'tier2', 'tier3']),
  escalation_enabled: z.boolean(),
  escalation_triggers: z.object({
    min_confidence: z.number().min(0).max(1),
    min_quality_score: z.number().min(0).max(1),
    max_ambiguity: z.number().min(0).max(1),
  }),
  consensus_threshold: z.number().min(0).max(1),
  cost_budget_usd_per_hour: z.number().positive(),
  allow_tier3: z.boolean(),
});

export type MultiModelConfig = z.infer<typeof MultiModelConfigSchema>;

export const ModelTierSchema = z.enum(['tier1', 'tier2', 'tier3']);

export type ModelTier = z.infer<typeof ModelTierSchema>;

export const TierConfigSchema = z.object({
  name: z.string(),
  model_id: z.string(),
  cost_per_1k_tokens_usd: z.number(),
  avg_latency_ms: z.number(),
  use_case: z.string(),
});

export type TierConfig = z.infer<typeof TierConfigSchema>;

export const EscalationMetricsSchema = z.object({
  total_tasks: z.number().int(),
  escalated_tasks: z.number().int(),
  tier1_success_rate: z.number().min(0).max(1),
  tier2_success_rate: z.number().min(0).max(1),
  tier3_success_rate: z.number().min(0).max(1),
  success_rate_trend: z.enum(['increasing', 'decreasing', 'stable']),
  tier1_count: z.number().int(),
  tier2_count: z.number().int(),
  tier3_count: z.number().int(),
  avg_cost_per_task_usd: z.number(),
  avg_latency_ms: z.number(),
  tier1_avg_latency_ms: z.number(),
  tier2_avg_latency_ms: z.number(),
  tier3_avg_latency_ms: z.number(),
  consensus_agreement_rate: z.number().min(0).max(1),
  budget_remaining_usd: z.number(),
});

export type EscalationMetrics = z.infer<typeof EscalationMetricsSchema>;

// ============================================================================
// Shared Quality Rubric Types (for regression gating and receipts)
// ============================================================================
export * from './quality-rubric.js';
