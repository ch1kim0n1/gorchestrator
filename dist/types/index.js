"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GStackSkillManifestSchema = exports.GToMConflictPredictionResponseSchema = exports.GToMConflictPredictionRequestSchema = exports.GMirrorScoringResponseSchema = exports.GMirrorScoringRequestSchema = exports.GBrainWriteRequestSchema = exports.GBrainPrimingRequestSchema = exports.SelectionResultSchema = exports.SelectionStrategySchema = exports.SamplingPlanSchema = exports.SamplingStrategySchema = exports.SandboxSchema = exports.SandboxStateSchema = exports.SandboxConfigSchema = exports.OrchestratorRunRecordSchema = exports.ScoredAttemptSchema = exports.GMirrorScoreBundleSchema = exports.AttemptResultSchema = exports.CostBreakdownSchema = exports.TraceBundleSchema = exports.TraceEventSchema = exports.DeliverableSchema = exports.AgentConfigSchema = exports.ConfigProvenanceSchema = exports.ToolScopeSchema = exports.SamplingParamsSchema = exports.ReasoningStyleSchema = exports.TaskBundleSchema = exports.ExecutionBudgetSchema = exports.GBrainPriorBundleSchema = exports.TaskSignatureSchema = exports.GBrainRefSchema = exports.OutcomeShapeSchema = exports.ConstraintSchema = void 0;
const zod_1 = require("zod");
// ============================================================================
// Core Type Schemas with Zod Validation
// ============================================================================
exports.ConstraintSchema = zod_1.z.object({
    type: zod_1.z.enum(['latency', 'cost', 'security', 'compliance', 'performance']),
    value: zod_1.z.string(),
    operator: zod_1.z.enum(['<', '>', '<=', '>=', '=', '!=']),
    priority: zod_1.z.number().min(0).max(10),
});
exports.OutcomeShapeSchema = zod_1.z.object({
    type: zod_1.z.enum(['code', 'document', 'deployment', 'research', 'config_change']),
    format: zod_1.z.string(),
    validation_criteria: zod_1.z.array(zod_1.z.string()),
});
exports.GBrainRefSchema = zod_1.z.object({
    ref_type: zod_1.z.enum(['page', 'entity', 'skill', 'pattern']),
    ref_id: zod_1.z.string(),
    confidence: zod_1.z.number().min(0).max(1),
});
exports.TaskSignatureSchema = zod_1.z.object({
    task_type: zod_1.z.string(),
    surfaces: zod_1.z.array(zod_1.z.string()),
    constraints: zod_1.z.array(exports.ConstraintSchema),
    outcome_shape: exports.OutcomeShapeSchema,
    context_refs: zod_1.z.array(exports.GBrainRefSchema),
    hash: zod_1.z.string(),
});
exports.GBrainPriorBundleSchema = zod_1.z.object({
    similar_tasks: zod_1.z.array(exports.TaskSignatureSchema),
    winning_configs: zod_1.z.array(zod_1.z.object({
        config: zod_1.z.any(), // AgentConfig - circular reference handled below
        win_rate: zod_1.z.number().min(0).max(1),
        n: zod_1.z.number().int().positive(),
    })),
    known_failure_modes: zod_1.z.array(zod_1.z.object({
        pattern: zod_1.z.string(),
        frequency: zod_1.z.number(),
        severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
    })),
    recommended_n: zod_1.z.number().int().positive(),
    user_preferences: zod_1.z.record(zod_1.z.any()),
    domain_constraints: zod_1.z.record(zod_1.z.any()),
});
exports.ExecutionBudgetSchema = zod_1.z.object({
    max_attempts: zod_1.z.number().int().positive().default(5),
    max_cost_usd: zod_1.z.number().positive().default(100),
    max_wall_time_ms: zod_1.z.number().int().positive().default(300000), // 5 minutes
    max_parallelism: zod_1.z.number().int().positive().default(5),
});
exports.TaskBundleSchema = zod_1.z.object({
    task_id: zod_1.z.string().uuid(),
    raw_description: zod_1.z.string(),
    signature: exports.TaskSignatureSchema,
    priors: exports.GBrainPriorBundleSchema,
    budget: exports.ExecutionBudgetSchema,
    created_at: zod_1.z.string().datetime(),
});
exports.ReasoningStyleSchema = zod_1.z.enum([
    'depth_first',
    'breadth_first',
    'plan_then_act',
    'react_style',
    'hybrid',
]);
exports.SamplingParamsSchema = zod_1.z.object({
    temperature: zod_1.z.number().min(0).max(2).default(0.7),
    top_p: zod_1.z.number().min(0).max(1).default(0.9),
    top_k: zod_1.z.number().int().positive().optional(),
    frequency_penalty: zod_1.z.number().min(-2).max(2).default(0),
    presence_penalty: zod_1.z.number().min(-2).max(2).default(0),
});
exports.ToolScopeSchema = zod_1.z.object({
    tool_name: zod_1.z.string(),
    access_level: zod_1.z.enum(['none', 'read', 'write', 'admin']),
    constraints: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.ConfigProvenanceSchema = zod_1.z.enum([
    'exploit',
    'perturb',
    'explore',
    'manual',
]);
exports.AgentConfigSchema = zod_1.z.object({
    config_id: zod_1.z.string().uuid(),
    base_model: zod_1.z.string(),
    reasoning_budget: zod_1.z.number().positive().default(100000), // tokens
    skill_set: zod_1.z.array(zod_1.z.string()), // GStack skill references
    decomposition_strategy: zod_1.z.string(),
    tool_scopes: zod_1.z.array(exports.ToolScopeSchema),
    reasoning_style: exports.ReasoningStyleSchema,
    sampling: exports.SamplingParamsSchema,
    provenance: exports.ConfigProvenanceSchema,
    parent_config_id: zod_1.z.string().uuid().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
exports.DeliverableSchema = zod_1.z.object({
    type: zod_1.z.enum(['code', 'document', 'deployment', 'research', 'config_change']),
    content: zod_1.z.string(),
    artifacts: zod_1.z.array(zod_1.z.object({
        path: zod_1.z.string(),
        content: zod_1.z.string().optional(),
        hash: zod_1.z.string(),
    })),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
exports.TraceEventSchema = zod_1.z.object({
    timestamp: zod_1.z.string().datetime(),
    event_type: zod_1.z.enum([
        'model_call',
        'tool_call',
        'file_mutation',
        'error',
        'checkpoint',
        'decision',
    ]),
    data: zod_1.z.record(zod_1.z.any()),
    cost_usd: zod_1.z.number().optional(),
});
exports.TraceBundleSchema = zod_1.z.object({
    events: zod_1.z.array(exports.TraceEventSchema),
    total_cost_usd: zod_1.z.number(),
    total_tokens: zod_1.z.number(),
    total_wall_time_ms: zod_1.z.number(),
});
exports.CostBreakdownSchema = zod_1.z.object({
    model_cost_usd: zod_1.z.number(),
    tool_cost_usd: zod_1.z.number(),
    sandbox_cost_usd: zod_1.z.number(),
    total_cost_usd: zod_1.z.number(),
});
exports.AttemptResultSchema = zod_1.z.object({
    attempt_id: zod_1.z.string().uuid(),
    task_id: zod_1.z.string().uuid(),
    config_id: zod_1.z.string().uuid(),
    sandbox_id: zod_1.z.string().uuid(),
    status: zod_1.z.enum(['completed', 'timeout', 'errored', 'aborted']),
    deliverable: exports.DeliverableSchema.optional(),
    trace: exports.TraceBundleSchema,
    cost: exports.CostBreakdownSchema,
    wall_time_ms: zod_1.z.number(),
    started_at: zod_1.z.string().datetime(),
    ended_at: zod_1.z.string().datetime(),
    error_message: zod_1.z.string().optional(),
});
exports.GMirrorScoreBundleSchema = zod_1.z.object({
    correctness: zod_1.z.object({
        score: zod_1.z.number().min(0).max(1),
        confidence: zod_1.z.number().min(0).max(1),
        evidence: zod_1.z.array(zod_1.z.string()),
    }),
    user_outcome: zod_1.z.object({
        score: zod_1.z.number().min(0).max(1),
        confidence: zod_1.z.number().min(0).max(1),
        evidence: zod_1.z.array(zod_1.z.string()),
    }),
    robustness: zod_1.z.object({
        score: zod_1.z.number().min(0).max(1),
        confidence: zod_1.z.number().min(0).max(1),
        evidence: zod_1.z.array(zod_1.z.string()),
    }),
    risk: zod_1.z.object({
        score: zod_1.z.number().min(0).max(1),
        confidence: zod_1.z.number().min(0).max(1),
        evidence: zod_1.z.array(zod_1.z.string()),
    }),
    overall_score: zod_1.z.number().min(0).max(1),
    hard_gates_passed: zod_1.z.boolean(),
});
exports.ScoredAttemptSchema = exports.AttemptResultSchema.extend({
    scores: exports.GMirrorScoreBundleSchema,
    selected: zod_1.z.boolean(),
    selection_reason: zod_1.z.string().optional(),
});
exports.OrchestratorRunRecordSchema = zod_1.z.object({
    task_id: zod_1.z.string().uuid(),
    task_bundle: exports.TaskBundleSchema,
    attempts: zod_1.z.array(exports.ScoredAttemptSchema),
    winner: zod_1.z.string().uuid(),
    merged_output: exports.DeliverableSchema.optional(),
    total_cost: exports.CostBreakdownSchema,
    total_wall_time_ms: zod_1.z.number(),
    gbrain_write_status: zod_1.z.enum(['pending', 'written', 'failed']),
    created_at: zod_1.z.string().datetime(),
    completed_at: zod_1.z.string().datetime(),
});
// ============================================================================
// Sandbox Types
// ============================================================================
exports.SandboxConfigSchema = zod_1.z.object({
    backend: zod_1.z.enum(['docker', 'e2b', 'modal', 'daytona', 'firecracker']),
    image: zod_1.z.string(),
    resource_limits: zod_1.z.object({
        cpu_cores: zod_1.z.number().positive().default(2),
        memory_mb: zod_1.z.number().int().positive().default(4096),
        disk_gb: zod_1.z.number().positive().default(10),
        max_wall_time_ms: zod_1.z.number().int().positive().default(300000),
    }),
    network_isolation: zod_1.z.boolean().default(true),
    allowlisted_domains: zod_1.z.array(zod_1.z.string()).default([]),
    snapshot_enabled: zod_1.z.boolean().default(true),
});
exports.SandboxStateSchema = zod_1.z.enum([
    'provisioning',
    'ready',
    'running',
    'completed',
    'failed',
    'destroyed',
]);
exports.SandboxSchema = zod_1.z.object({
    sandbox_id: zod_1.z.string().uuid(),
    config: exports.SandboxConfigSchema,
    state: exports.SandboxStateSchema,
    attempt_id: zod_1.z.string().uuid().optional(),
    created_at: zod_1.z.string().datetime(),
    started_at: zod_1.z.string().datetime().optional(),
    completed_at: zod_1.z.string().datetime().optional(),
    error_message: zod_1.z.string().optional(),
    trace_stream_url: zod_1.z.string().optional(),
});
// ============================================================================
// Configuration Sampler Types
// ============================================================================
exports.SamplingStrategySchema = zod_1.z.enum([
    'exploit',
    'perturb',
    'explore',
    'manual',
]);
exports.SamplingPlanSchema = zod_1.z.object({
    configs: zod_1.z.array(exports.AgentConfigSchema),
    strategy_distribution: zod_1.z.record(zod_1.z.number().min(0).max(1)),
    total_configs: zod_1.z.number().int().positive(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
// ============================================================================
// Selection Types
// ============================================================================
exports.SelectionStrategySchema = zod_1.z.enum([
    'highest_score',
    'component_substitution',
    'synthesized_merge',
]);
exports.SelectionResultSchema = zod_1.z.object({
    winner_attempt_id: zod_1.z.string().uuid(),
    strategy_used: exports.SelectionStrategySchema,
    selected_deliverable: exports.DeliverableSchema,
    merge_sources: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    rationale: zod_1.z.string(),
    confidence: zod_1.z.number().min(0).max(1),
});
// ============================================================================
// Integration Types
// ============================================================================
exports.GBrainPrimingRequestSchema = zod_1.z.object({
    signature_hash: zod_1.z.string(),
    max_results: zod_1.z.number().int().positive().default(10),
    similarity_threshold: zod_1.z.number().min(0).max(1).default(0.7),
});
exports.GBrainWriteRequestSchema = zod_1.z.object({
    run_record: exports.OrchestratorRunRecordSchema,
    priority: zod_1.z.enum(['low', 'normal', 'high']).default('normal'),
});
exports.GMirrorScoringRequestSchema = zod_1.z.object({
    task: exports.TaskBundleSchema,
    attempts: zod_1.z.array(exports.AttemptResultSchema),
    scoring_profile: zod_1.z.string(),
    budget_ms: zod_1.z.number().int().positive().default(30000),
});
exports.GMirrorScoringResponseSchema = zod_1.z.object({
    score_set: zod_1.z.array(zod_1.z.object({
        attempt_id: zod_1.z.string().uuid(),
        scores: exports.GMirrorScoreBundleSchema,
    })),
    latency_ms: zod_1.z.number(),
    simulated_user_coverage: zod_1.z.number().min(0).max(1),
});
exports.GToMConflictPredictionRequestSchema = zod_1.z.object({
    task: exports.TaskBundleSchema,
    active_attempts: zod_1.z.array(zod_1.z.object({
        attempt_id: zod_1.z.string().uuid(),
        config_id: zod_1.z.string().uuid(),
        current_state: zod_1.z.record(zod_1.z.any()),
        recent_actions: zod_1.z.array(zod_1.z.string()),
    })),
});
exports.GToMConflictPredictionResponseSchema = zod_1.z.object({
    predicted_conflicts: zod_1.z.array(zod_1.z.object({
        attempt_ids: zod_1.z.tuple([zod_1.z.string().uuid(), zod_1.z.string().uuid()]),
        conflict_type: zod_1.z.enum(['file', 'resource', 'semantic', 'goal']),
        severity: zod_1.z.number().min(0).max(1),
        predicted_at_step: zod_1.z.number().int().optional(),
        recommended_action: zod_1.z.enum(['reroute', 'serialize', 'merge', 'ignore']),
    })),
});
exports.GStackSkillManifestSchema = zod_1.z.object({
    skill_id: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    input_schema: zod_1.z.record(zod_1.z.any()),
    output_schema: zod_1.z.record(zod_1.z.any()),
    cost_estimate_usd: zod_1.z.number(),
    typical_duration_ms: zod_1.z.number(),
});
//# sourceMappingURL=index.js.map