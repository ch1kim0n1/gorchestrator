# GOrchestrator — Agent-Readable Contract

## Purpose
GOrchestrator coordinates multi-tool task execution with multi-model consensus (cheap-then-expensive escalation), health monitoring via Wilson CI, cost tracking with reserve/commit semantics, and integration with GBrain/GMirror/GToM. It currently orchestrates **developer-productivity task pipelines**. For DYAD it must also orchestrate **relationship analysis pipelines** — ingesting message windows, dispatching detectors, scoring insights with GMirror's DYAD rubric, and persisting results to GBrain.

## Current Core Capabilities
- Intake & Priming (IntakePrimer)
- Configuration Sampling (ConfigurationSampler, Tier 1/2/3 escalation)
- Parallel execution via SandboxPoolManager
- Conflict pre-check via GToM before execution
- Scoring via GMirror with hard-gate enforcement
- Selection via SelectorEngine (picks best attempt)
- Persistence to GBrain
- Wilson CI on health checks and success rates
- Cost hard gate (exceeding budget fails verdict, no winner returned)
- Circuit-breaker on GBrain client (60s timeout)
- DriftDetector, CostLedger, LatencyTracker, AuditLogger, StructuredLogger (all wired)
- SQLite persistence with schema_version + migrations
- CLI commands: `replay`, `regress`, `trend`, `drift`, `cost` (implemented). Stubs (return "not implemented in MVP"): `eval`, `attempts`, `sandbox-stats`.

## API Contract (current)

```typescript
interface TaskRequest {
  task: string;
  context?: string;
  constraints?: string[];
  multi_model_config?: MultiModelConfig;
  budget?: { max_cost_usd: number; max_latency_ms: number };
}

interface TaskResult {
  output: string;
  tier_used: 'tier1' | 'tier2' | 'tier3';
  consensus_decision: string;
  escalation_metrics: EscalationMetrics;
  cost_usd: number;
}
```

### Multi-Model Configuration
```typescript
interface MultiModelConfig {
  tier1_model: string;           // pricing-table default: claude-haiku-4-5-20251001 (alias 'claude-haiku-4-5' also priced)
  tier2_model: string;           // default: claude-sonnet-4-6
  tier3_model?: string;          // default: claude-opus-4-7 (claude-opus-4-6 also priced)
  consensus_threshold: number;   // default: 0.8
  max_escalations: number;
  allow_tier3: boolean;          // currently true
}
```

### Health Check
```typescript
interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  statistical_confidence?: {
    success_rate_wilson_ci: WilsonCI;
    error_rate_wilson_ci: WilsonCI;
  };
}
```

---

## What Must Change for DYAD

### 1. DYAD Analysis Pipeline Task Type
Add a `RelationshipAnalysisTask` type alongside the existing developer-task pipeline:

```typescript
interface RelationshipAnalysisTask {
  task_type: 'relationship_analysis';
  dyad_id: string;
  message_window: RawMessage[];  // GAgent SHOULD pre-redact; the DyadPipeline ALSO redacts free-text PII (phone/SSN/CC/email) before any egress to GToM/GMirror/LLM as defense-in-depth.
  detectors: DetectorName[];
  time_range: { start: string; end: string };
  budget: { max_cost_usd: number; max_latency_ms: number };
}

type DetectorName =
  | 'emotion_labeling'
  | 'bid_classification'
  | 'repair_detection'
  | 'labor_asymmetry'
  | 'phantom_third_party'
  | 'predictive_divergence';
```

**File to modify:** `src/types/index.ts` — add `RelationshipAnalysisTask` to the task union type
**File to create:** `src/core/dyad-pipeline.ts` — orchestrates the 6 DYAD detectors

### 2. Detector Orchestration (replace SandboxPoolManager for DYAD)
The current `SandboxPoolManager` executes code in Docker/E2B/Modal sandboxes. For DYAD detectors (which are LLM calls, not arbitrary code), add a `DetectorPool` that runs detectors in parallel:

```typescript
class DetectorPool {
  async runDetectors(
    task: RelationshipAnalysisTask,
    detectors: DetectorName[]
  ): Promise<DetectorOutput[]>;
}

interface DetectorOutput {
  detector: DetectorName;
  dyad_id: string;
  result: Record<string, any>;
  confidence: number;
  model_used: string;
  cost_usd: number;
}
```

**File to create:** `src/core/detector-pool.ts`

### 3. DYAD Scoring via GMirror
After detectors run, score each insight using GMirror's `GMIRROR_DYAD_RUBRIC_V1` rather than the default task rubric. The existing `scoreSingleAttempt()` call to GMirror needs a mode flag:

```typescript
// In src/core/orchestrator.ts, for DYAD tasks:
const scoreResponse = await this.scoreWithGMirror(attempt, {
  scoring_mode: 'dyad_insight',    // NEW: tells GMirror to use DYAD rubric
  ethical_refusal_triggered: refusalResult.should_refuse,
});
```

**File to modify:** `src/core/orchestrator.ts` — check `task_type` and set scoring mode accordingly

### 4. GToM Relational Pre-Check
For DYAD tasks, call GToM's new `predict-relational-conflicts` endpoint instead of `predict-conflicts`:

```typescript
// In src/core/orchestrator.ts, before detector execution:
if (task.task_type === 'relationship_analysis') {
  const relationalRisk = await this.checkRelationalConflicts(task);
  if (relationalRisk.aggregate_risk > 0.8) {
    // High risk of harmful framing — refuse before spending tokens
    return this.buildRefusalResult(task, relationalRisk);
  }
}
```

**File to modify:** `src/core/orchestrator.ts`

### 5. `regress` and `trend` CLI Commands (IMPLEMENTED)
NOTE: `regress` and `trend` are now fully implemented (`src/commands/regress.ts`, `src/commands/trend.ts`, wired in `src/cli.ts`). The remaining stubs that still print "not implemented in MVP" are `eval`, `attempts`, and `sandbox-stats`. The design notes below are retained for historical context:

**`regress`** — compare current detector accuracy against the locked baseline receipt:
```typescript
// In src/cli.ts, regress command:
// 1. Load latest receipt from ReceiptRegistry
// 2. Run aggregateVerdict on a small held-out test set
// 3. Compare each rubric dimension to baseline ± tolerance
// 4. Exit 1 if any dimension regressed beyond tolerance
```

**`trend`** — already added but uses stub data. Wire it to the real DriftDetector:
```typescript
// In src/cli.ts, trend command:
const driftResults = this.orchestrator.getDrift(options.metric);
// Format and display
```

**File to modify:** `src/cli.ts`

### 6. Privacy: GBrain Persistence for DYAD
When persisting DYAD results to GBrain, enforce:
- `dyad_id` is a hash (never raw phone number)
- Message excerpts used as evidence are PII-redacted
- Results stored with `page_kind: 'dyad'` (new GBrain page type)

```typescript
// In src/core/orchestrator.ts, storeReceiptInGBrain():
if (task.task_type === 'relationship_analysis') {
  await this.gbrainClient.write({
    content: this.redactForGBrain(result),  // strip any remaining PII
    page_kind: 'dyad',
    tags: ['relationship', task.dyad_id],
  });
}
```

### 7. Success Rate Drift Detection (implement from plan)
The `successRateHistory` array is tracked but never fed into `driftDetector`. Wire it:

```typescript
// In src/core/orchestrator.ts, after each task completes:
const rate = this.successRateHistory.slice(-20).filter(x => x > 0.5).length / Math.min(20, this.successRateHistory.length);
this.driftDetector.record('task_success_rate', rate);
```

**File to modify:** `src/core/orchestrator.ts`

---

## Service Endpoints
- **GBrain:** `http://localhost:3000`
- **GMirror:** `http://localhost:3002`
- **GToM:** `http://localhost:3003`
- **GStack:** `http://localhost:3001`

## CLI Commands
`replay`, `regress`, `trend`, `drift`, `cost` are implemented. `eval`, `attempts`, and `sandbox-stats` are stubs that print "not implemented in MVP".

## Persistence
- SQLite: `~/.gorchestrator/gorchestrator.db` (via `OrchestratorPersistenceManager`, REQUIRED — construction throws if the SQLite engine cannot initialize). This requires the native `better-sqlite3` binding to be built for the host.
- Schema: `attempt_results`, `scored_attempts`, `task_runs`, `schema_version`
- Receipts: JSONL per ISO week
- Success-rate history: best-effort JSON at `~/.gorchestrator/...` (now written after each task; serialized via an async write lock).
- `src/db.ts` is a separate, best-effort JSONL run log (`runs.jsonl`) whose write errors are intentionally swallowed; it is NOT the authoritative store.

## Integration Points
- **Called by:** GStack (top-level orchestration), DYAD (relationship analysis pipeline)
- **Calls:** GBrain, GMirror, GToM, GAgent, GLearn, IntakePrimer, ConfigurationSampler, SandboxPoolManager / DetectorPool (new for DYAD)
