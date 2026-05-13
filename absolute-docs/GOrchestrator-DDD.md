# GOrchestrator — Design & Development Document

**Version:** 0.1 (Pre-Hackathon Draft)
**Owner:** Vlad
**Last Updated:** May 2026
**Status:** Architecture lock-in phase
**Related Documents:** GMirror-DDD.md, GToM-DDD.md, GBrain (external), GStack (external)

---

## 0. Reading Guide

This document is the architectural and build-plan reference for **GOrchestrator**, the parallel agent execution manager in the five-tool agent stack (GBrain, GStack, GOrchestrator, GMirror, GToM).

Sections 1–3 are the *what* and *why* (read for context and pitch).
Sections 4–8 are the *how* (read before writing code).
Sections 9–11 are the *when* and *what-if* (read for project planning and risk).
Section 12 is the open-questions log — update as decisions are made.

This DDD is written as a full product roadmap. The hackathon MVP is **Section 9.1** — start there if you only have a weekend.

---

## 1. Executive Summary

GOrchestrator is the layer that turns a single task into N parallel attempts, runs each in an isolated sandbox with its own agent configuration, scores the outputs against verifiable criteria (via GMirror), and selects or merges the winner. The losing attempts are not discarded — they are stored in GBrain as training signal for future agent selection.

The core thesis is that **agent quality at the task level is not primarily a function of how smart a single agent is; it is a function of how many attempts you can afford, how well you can score them, and how well you can learn from the distribution of outcomes**. GOrchestrator operationalizes that thesis.

In the broader stack, GOrchestrator is the *crew boss*. GBrain knows what matters, GStack does the work, GMirror tests against simulated minds, GToM models intent and prevents collision. GOrchestrator dispatches, races, scores, picks, and records.

### 1.1 What it is

- A task decomposition and dispatch engine.
- A sandbox lifecycle manager (provision, run, snapshot, destroy).
- A parallel execution coordinator with bounded concurrency.
- A scoring and selection pipeline (delegating actual scoring to GMirror).
- A memory writer that records full attempt histories — winners and losers — back to GBrain.
- A re-runner: given a stored attempt history, can replay or vary configurations.

### 1.2 What it is not

- It is not a verification engine. That is GMirror.
- It is not a memory store. That is GBrain.
- It is not a skill executor. That is GStack.
- It is not a coordination protocol. That is GToM.
- It does not write agent reasoning logic — it composes existing agents.

### 1.3 Headline metrics (targets, hedged)

- **Quality multiplier:** 1.5–2.0× single-attempt task success rate at N=5 attempts, given a calibrated selector. Source basis: best-of-N curves on SWE-bench, GAIA, τ-bench style benchmarks. Falls off sharply if the selector agreement with ground truth drops below ~75%.
- **Wall-clock overhead:** 1.1–1.3× single-attempt time. Parallel execution hides most of the cost; the overhead is verification + selection.
- **Compute cost:** 4–5× single-attempt cost at N=5. This is the price of the quality lift. Cost-quality frontier is tunable via N.
- **Learning curve:** task families show measurable improvement after ~20–50 stored attempt sets per family — at which point GBrain priors begin meaningfully shifting attempt configurations.

These are targets, not commitments. Real numbers depend on task domain, selector quality, and the diversity of agent configurations sampled.

---

## 2. Problem Statement

### 2.1 The gap in the existing stack

GStack provides skills (CEO review, engineering review, QA, release, browser testing, security, deployment). GBrain provides memory, context, and knowledge retrieval. Both assume a single-threaded execution model: one agent, one attempt, one outcome.

This is a structural limitation. Modern agent benchmarks (SWE-bench Verified, GAIA, τ-bench, WebArena) consistently show that:

1. Single-attempt success rates on non-trivial tasks plateau in the 30–50% range even with frontier models.
2. Best-of-N selection from independent attempts lifts success rates substantially when a good selector is available.
3. Most agent failures are *configuration failures* (wrong tool, wrong sub-task decomposition, wrong reasoning depth) rather than capability failures. Sampling across configurations recovers many of these.

The existing stack has no answer for any of this. GOrchestrator is the answer.

### 2.2 Why now

The cost of parallel agent execution has dropped sharply with smaller capable models (Haiku-class, open-weights at 7–70B), aggressive context caching, and inference providers offering sub-second cold-start sandboxes. What was prohibitively expensive in 2023 — running five agents to do one task — is now within the cost envelope of most production workloads, especially when amortized against the value of higher task success.

At the same time, the rise of long-horizon agent tasks (Devin-class workflows, multi-step coding agents, autonomous research) makes single-shot reliability genuinely insufficient. The market is ready for the orchestration layer; what is missing is one that does scoring and learning correctly.

### 2.3 Why GOrchestrator specifically

The orchestration category is crowded — LangGraph, CrewAI, AutoGen, OpenAI Swarm, Inngest's agent kit. Most of these treat orchestration as **workflow composition** (DAGs of agent steps). GOrchestrator treats orchestration as **distribution sampling and selection** (N attempts, score, pick, learn). These are different products. The DAG-composition tools assume you know the right workflow; GOrchestrator assumes you don't, and finds it empirically.

The defensibility comes from three places:

- **The scoring contract with GMirror.** Most orchestrators have weak selectors (LLM-as-judge with no grounding). GOrchestrator outsources scoring to a system designed to assert against simulated minds and verifiable checks. This is the moat.
- **The memory contract with GBrain.** Storing the full attempt set — not just winners — and querying it on future tasks is rare. Most frameworks discard losing attempts.
- **The coordination contract with GToM.** Preventing inter-attempt collisions and conflicts via belief modeling, not locks, is novel.

---

## 3. System Overview

### 3.1 Conceptual model

A GOrchestrator run has six phases:

1. **Intake.** A task description arrives, with optional constraints (max attempts, max wall time, max cost).
2. **Priming.** GBrain is queried for: similar past task signatures, winning configurations for those signatures, known failure modes, recommended attempt count.
3. **Dispatch.** N agent configurations are sampled (some from prior winners, some perturbed, some exploratory). N sandboxes are provisioned. Each attempt begins.
4. **Execution.** Each attempt runs in isolation, invoking GStack skills. GToM watches across attempts for predicted conflicts and routes around them.
5. **Scoring & selection.** Completed attempts are passed to GMirror. GMirror returns per-attempt verdicts and evidence. GOrchestrator selects a winner (or constructs a merge).
6. **Persistence.** The full attempt set — task signature, all configurations tried, all scores, the winning configuration, evidence, traces — is written to GBrain. Future runs of similar tasks consult this record.

### 3.2 One-line mental model

> **Try many ways. Score them. Pick what works. Remember why.**

### 3.3 Cyberpunk framing (for pitch)

GOrchestrator is the *fixer*. You give it a job. It dispatches a crew — five netrunners, each with a different load-out and a different plan of attack. They run in parallel against the target. You watch the run on five monitors. The one who delivers gets paid. The crew that died teaches the next run what kills. The fixer remembers.

This framing is not decoration. It maps cleanly onto the architecture: dispatch, parallel execution, scoring, payment (selection), and memory.

---

## 4. Architecture

### 4.1 Component diagram

```
                    ┌─────────────────────────────────────────┐
                    │              GOrchestrator              │
                    │                                         │
   Task ──────────► │  ┌──────────┐    ┌──────────────────┐  │
                    │  │ Intake & │───►│ Configuration    │  │
                    │  │ Priming  │    │ Sampler          │  │
                    │  └────┬─────┘    └────────┬─────────┘  │
                    │       │                   │            │
                    │       ▼                   ▼            │
                    │  ┌─────────────────────────────────┐   │
                    │  │     Sandbox Pool Manager        │   │
                    │  │  (provision, run, destroy)      │   │
                    │  └────────────┬────────────────────┘   │
                    │               │                        │
                    │   ┌───────────┴───────────────┐        │
                    │   │ Attempt 1   Attempt 2 ... │        │
                    │   │  ┌─────┐    ┌─────┐       │        │
                    │   │  │Agent│    │Agent│  ...  │        │
                    │   │  └──┬──┘    └──┬──┘       │        │
                    │   └─────┼──────────┼──────────┘        │
                    │         ▼          ▼                   │
                    │  ┌─────────────────────────────────┐   │
                    │  │   Result Collector & Trace      │   │
                    │  │   Aggregator                    │   │
                    │  └────────────┬────────────────────┘   │
                    │               │                        │
                    │               ▼                        │
                    │  ┌─────────────────────────────────┐   │
                    │  │  Selector & Merge Engine        │   │
                    │  └────────────┬────────────────────┘   │
                    │               │                        │
                    └───────────────┼────────────────────────┘
                                    │
                                    ▼
                              ┌─────────┐
                              │ Output  │
                              └─────────┘

   Sidecar integrations (read/write):
   ─────────────────────────────────
   GBrain   ◄──── priors ─── Intake   ◄────► attempts written
   GMirror  ◄──── attempts ── Selector ───► verdicts returned
   GToM     ◄──── states ──── Attempts ───► conflicts predicted
   GStack   ◄──── invoked ──── inside each Attempt
```

### 4.2 Core components

#### 4.2.1 Intake & Priming

**Responsibility:** Accept a task description, normalize it into a task signature, and query GBrain for relevant priors.

A task signature is a structured fingerprint of the task that allows similarity lookup. It includes:
- Task type (code generation, refactor, research, deployment, document write, etc.)
- Affected surfaces (which files, modules, APIs, data stores)
- Constraints (latency, cost, security, compliance)
- Outcome shape (what the deliverable looks like)
- User and company context references (pulled from GBrain)

The signature is the join key for retrieval. Two semantically similar tasks should produce signatures with high overlap so that learned priors transfer.

**Input:** raw task description, optional execution constraints, user/session context.
**Output:** an enriched TaskBundle containing the original task, the signature, GBrain priors, and a recommended attempt budget.

#### 4.2.2 Configuration Sampler

**Responsibility:** Decide what N is, and produce N distinct agent configurations to attempt the task with.

A configuration includes:
- Base model and reasoning budget
- Skill set from GStack to make available
- Sub-task decomposition strategy
- Tool access scopes
- Reasoning style (depth-first, breadth-first, plan-then-act, react-style)
- Temperature / sampling parameters

The sampler uses three strategies, blended:
- **Exploit:** sample winning configurations for similar past task signatures.
- **Perturb:** take a winner and vary one or two parameters.
- **Explore:** sample novel configurations to expand the search space.

The exploit/perturb/explore ratio is itself a learned parameter, tuned per task family. Early in a task family's history, exploration dominates; later, exploit and perturb take over.

**Input:** TaskBundle.
**Output:** list of `N` AgentConfig objects.

#### 4.2.3 Sandbox Pool Manager

**Responsibility:** Provision, monitor, and destroy isolated execution environments for each attempt.

Sandboxes are the unit of isolation. Each attempt runs in one. Sandboxes provide:
- Filesystem isolation (each attempt has its own working tree)
- Network isolation (controlled egress)
- Process isolation (no shared state between attempts)
- Resource limits (CPU, memory, wall time, cost ceiling)
- Snapshot capability (for replay and post-hoc analysis)
- Live trace stream (stdout/stderr, tool calls, file changes)

The pool manager handles concurrency limits, queueing, cold-start optimization, and cleanup. It exposes a uniform sandbox API regardless of backend (local container, remote VM, cloud function).

**Backend options considered:**
- **Local Docker** for hackathon-scale and local dev.
- **E2B / Modal / Daytona / Codesandbox SDK** for cloud-scale parallel execution.
- **Firecracker microVMs** for production-grade isolation with fast cold start.

For the hackathon, **local Docker with a thin abstraction layer** is the right choice. The abstraction is what matters; the backend can be swapped later.

#### 4.2.4 Attempt Runner

**Responsibility:** Inside a single sandbox, run one agent configuration against the task to completion or timeout.

Each attempt is its own self-contained agent loop. It receives a TaskBundle and an AgentConfig, and produces an AttemptResult. Inside the loop, it invokes GStack skills as needed. It reports live trace events to the trace aggregator.

Attempts are designed to be **idempotent and replayable**. Given the same TaskBundle, AgentConfig, and a seed, the attempt should produce a deterministic result modulo non-determinism in the underlying model. This is critical for debugging and for the eval pipeline.

#### 4.2.5 Result Collector & Trace Aggregator

**Responsibility:** Gather completed AttemptResults, normalize them, attach trace data, and forward to scoring.

Trace data is rich: every tool call, every file mutation, every model call, every cost incurred, every wall-clock segment. This is what GBrain stores as the training signal — not just the final output, but the *path* each attempt took.

#### 4.2.6 Selector & Merge Engine

**Responsibility:** Given N scored attempts (scores provided by GMirror), select a winner or construct a merged output.

Selection is straightforward when one attempt dominates. The interesting case is **merge**: when no single attempt is best across all dimensions (e.g., attempt 3 has the best correctness, attempt 5 has the best UX, attempt 2 has the best performance).

Merge strategies, in order of complexity:

1. **Pick highest weighted score.** Simple, robust, default.
2. **Component substitution.** Take the dominant attempt, substitute superior components from others (e.g., better error messages from attempt 3 into the otherwise-best attempt 5).
3. **Synthesized merge.** Generate a new attempt that combines features of multiple. This requires another agent call and is itself a candidate to be scored.

For the hackathon MVP, strategy 1 only. Strategy 2 in v1. Strategy 3 in v2 (and gated behind a separate cost budget).

### 4.3 Data model

#### 4.3.1 Core types

```typescript
type TaskSignature = {
  task_type: string;                // canonical type
  surfaces: string[];               // affected files/modules/APIs
  constraints: Constraint[];
  outcome_shape: OutcomeShape;
  context_refs: GBrainRef[];        // pointers into GBrain
  hash: string;                     // deterministic fingerprint
};

type TaskBundle = {
  task_id: UUID;
  raw_description: string;
  signature: TaskSignature;
  priors: GBrainPriorBundle;        // winners, failure modes, etc.
  budget: ExecutionBudget;          // max attempts, time, cost
  created_at: Timestamp;
};

type AgentConfig = {
  config_id: UUID;
  base_model: string;
  reasoning_budget: number;
  skill_set: GStackSkillRef[];
  decomposition_strategy: string;
  tool_scopes: ToolScope[];
  reasoning_style: ReasoningStyle;
  sampling: SamplingParams;
  provenance: ConfigProvenance;     // exploit | perturb | explore
  parent_config_id?: UUID;          // for perturb tracking
};

type AttemptResult = {
  attempt_id: UUID;
  task_id: UUID;
  config_id: UUID;
  sandbox_id: UUID;
  status: 'completed' | 'timeout' | 'errored' | 'aborted';
  deliverable: Deliverable;         // typed by task_type
  trace: TraceBundle;
  cost: CostBreakdown;
  wall_time_ms: number;
  started_at: Timestamp;
  ended_at: Timestamp;
};

type ScoredAttempt = AttemptResult & {
  scores: GMirrorScoreBundle;       // see GMirror DDD
  selected: boolean;
  selection_reason?: string;
};

type OrchestratorRunRecord = {
  task_id: UUID;
  task_bundle: TaskBundle;
  attempts: ScoredAttempt[];
  winner: UUID;                     // attempt_id
  merged_output?: Deliverable;
  total_cost: CostBreakdown;
  total_wall_time_ms: number;
  gbrain_write_status: 'pending' | 'written' | 'failed';
};
```

#### 4.3.2 Storage layout (logical)

- `tasks` — TaskBundle records, indexed by signature hash.
- `attempts` — AttemptResult records, indexed by task_id and config_id.
- `runs` — OrchestratorRunRecord, the canonical per-task record.
- `configs` — AgentConfig records, deduplicated via content hash.
- `traces` — large trace blobs, content-addressed.

In the hackathon MVP, all of these live in SQLite + a local object store. In v1+, the canonical home is GBrain, with GOrchestrator holding only short-lived in-flight state.

### 4.4 Concurrency, isolation, and failure semantics

#### 4.4.1 Concurrency model

Each attempt is an independent process. The orchestrator coordinates via a job queue with bounded parallelism. The bound is set per-run based on budget and per-deployment based on capacity.

Within an attempt, the agent loop may itself spawn parallel sub-agents (via GStack). These are *not* GOrchestrator-managed parallelism; they are scoped to the attempt's sandbox.

#### 4.4.2 Isolation guarantees

- **Filesystem:** Each attempt sees its own working tree. No shared writable paths.
- **Network:** Egress is controlled and audited. By default, attempts cannot reach the broader internet — only allowlisted endpoints (GStack-required APIs, model providers).
- **State:** Attempts cannot read each other's in-flight state. Communication, if needed, goes through GToM (belief modeling) or through explicit coordination primitives.
- **Resources:** Per-attempt limits on CPU, RAM, disk, wall time, and dollar cost.

#### 4.4.3 Failure modes per component

| Component | Failure mode | Detection | Mitigation |
|---|---|---|---|
| Intake | Malformed task, missing context | Schema validation | Reject with clear error |
| Priming | GBrain unreachable | Timeout | Proceed with empty priors, log degradation |
| Config sampler | All N configs collapse to identical | Diversity check | Inject exploration configs |
| Sandbox provisioner | Provisioning timeout | Watchdog | Reduce N, log, continue |
| Attempt runner | Hung agent loop | Wall-clock timeout | Abort attempt, mark as errored |
| Attempt runner | Sandbox escape attempt | Audit logs | Kill sandbox, alert, record |
| Result collector | Trace corruption | Checksums | Discard attempt, do not score |
| Selector | GMirror unreachable | Timeout | Fall back to deterministic scoring (tests pass, etc.); flag as degraded |
| Selector | All attempts failed | Score check | Return error, write to GBrain anyway |
| Persistence | GBrain write failure | Retry queue | Queue locally, retry; never block return |

The orchestrator's invariant: **partial failure must never lose data**. Every attempt's trace is preserved even if scoring or persistence fails. The run record can be reconstructed from local logs.

### 4.5 Determinism and replayability

Every run is replayable given:
- The TaskBundle (hashed and stored).
- The AgentConfigs (hashed and stored).
- The model snapshots (versioned).
- The seed values for each attempt.

This is non-negotiable for debugging and for using GOrchestrator outputs as training data. Non-determinism in the model layer is acknowledged and tracked — replay results are compared to original within a tolerance band.

---

## 5. Integration Contracts

### 5.1 GOrchestrator ↔ GBrain

#### 5.1.1 Reads (Priming)

```
GET /gbrain/priors
  params:
    signature_hash: string
    max_results: int
    similarity_threshold: float
  returns:
    {
      similar_tasks: [TaskSignature, ...],
      winning_configs: [{config: AgentConfig, win_rate: float, n: int}, ...],
      known_failure_modes: [FailureMode, ...],
      recommended_n: int,
      user_preferences: UserPrefBundle,
      domain_constraints: DomainConstraintBundle
    }
```

The priming call is best-effort and has a hard timeout (default 500ms). If it fails, the orchestrator proceeds with empty priors and logs the degradation.

#### 5.1.2 Writes (Persistence)

```
POST /gbrain/runs
  body: OrchestratorRunRecord
  returns: { ack_id: UUID, write_status: 'queued' | 'persisted' }
```

Writes are queued asynchronously. The orchestrator does not block on persistence. A local write-ahead log guarantees no run record is lost on crash.

#### 5.1.3 What GBrain promises in return

- **Indexing.** Run records are indexed by signature hash, user, time, and outcome.
- **Aggregation.** Winning-config statistics are aggregated and made available to future priming calls.
- **Failure-mode extraction.** Failed attempts contribute to a failure-mode library that GMirror can subscribe to.
- **Eventual consistency.** New runs may take seconds to be queryable. GOrchestrator must not assume read-after-write.

### 5.2 GOrchestrator ↔ GMirror

#### 5.2.1 Submission

```
POST /gmirror/score
  body:
    {
      task: TaskBundle,
      attempts: [AttemptResult, ...],
      scoring_profile: ScoringProfile  // which checks to run
    }
  returns:
    {
      score_set: [GMirrorScoreBundle, ...],   // one per attempt
      latency_ms: int,
      simulated_user_coverage: float
    }
```

Submission is synchronous from GOrchestrator's perspective but internally GMirror may parallelize. The latency budget is `max(attempt_wall_times) * 0.3` by default — verification should not dominate the run.

#### 5.2.2 ScoringProfile

The scoring profile is selected based on task_type and constraints. For a code-write task, it might include: unit tests, type checks, security scan, simulated user comprehension of resulting UI. For a research task: factuality checks, citation verification, coverage of question.

Profiles are versioned and stored in GBrain. The orchestrator selects a profile but GMirror is authoritative on what the profile means.

#### 5.2.3 Fallback when GMirror is unavailable

If GMirror is down or times out, the orchestrator falls back to a deterministic minimum: did the attempt complete? Did its tests pass? Did GStack skills report success? This produces a degraded score that is flagged as such in the run record. **Degraded scores are not written into GBrain's winning-config aggregates** — they would poison the training signal.

### 5.3 GOrchestrator ↔ GToM

#### 5.3.1 Conflict prediction

```
POST /gtom/predict-conflicts
  body:
    {
      task: TaskBundle,
      active_attempts: [
        {attempt_id, config_id, current_state, recent_actions}, ...
      ]
    }
  returns:
    {
      predicted_conflicts: [
        {
          attempt_ids: [UUID, UUID],
          conflict_type: 'file' | 'resource' | 'semantic' | 'goal',
          severity: float,
          predicted_at_step: int,
          recommended_action: 'reroute' | 'serialize' | 'merge' | 'ignore'
        }, ...
      ]
    }
```

GToM is called periodically during execution (every K seconds or after every major attempt event). Conflict predictions are advisory — the orchestrator decides what to do. The default policy is to reroute the lower-confidence attempt.

#### 5.3.2 User intent re-spec

```
GET /gtom/user-intent
  params: task_id, user_id
  returns:
    {
      inferred_intent: string,
      confidence: float,
      evidence: [Reference, ...],
      suggested_respec: string | null
    }
```

Called during priming. If GToM suggests a re-spec (e.g., user said "export as PDF" but historically means "export *what's visible on screen*"), the orchestrator can either inject the re-spec into all attempts or run a split test (half with re-spec, half without) to validate the inference.

### 5.4 GOrchestrator ↔ GStack

#### 5.4.1 Skill invocation

GStack skills are invoked inside each attempt's sandbox. GOrchestrator does not call GStack directly — it provides skill references in the AgentConfig, and the attempt's agent loop invokes them.

The contract is: GStack skills are **side-effectful but sandboxed**. A skill that deploys code, in an attempt's sandbox, deploys to that sandbox's isolated environment, not to production. Production deploys require explicit elevation and live outside the per-attempt sandbox boundary.

#### 5.4.2 Skill discovery

```
GET /gstack/skills
  params: task_type, constraints
  returns:
    {
      available_skills: [SkillManifest, ...],
      recommended_skills: [SkillRef, ...]
    }
```

Called during config sampling. The sampler uses recommended_skills as a starting point and varies skill sets across attempts (e.g., one attempt with deep security scanning, one without, to measure the marginal value).

### 5.5 Summary contract table

| Producer | Consumer | Object | Frequency | Sync/Async |
|---|---|---|---|---|
| GBrain | GOrch | Priors | Per task | Sync (500ms budget) |
| GOrch | GBrain | RunRecord | Per task | Async, queued |
| GOrch | GMirror | Attempts | Per task | Sync (within budget) |
| GMirror | GOrch | ScoreBundle | Per task | Sync return |
| GOrch | GToM | AttemptStates | Per K seconds | Sync, advisory |
| GToM | GOrch | ConflictPredictions | Per K seconds | Sync return |
| GToM | GOrch | UserIntent | Per task | Sync (during priming) |
| GStack | GOrch | SkillManifests | Per task | Sync (cacheable) |
| GOrch | GStack | (invoked inside attempts, not directly) | — | — |

---

## 6. Selection and Scoring

### 6.1 The scoring problem

The hard part of best-of-N is not running N — it is selecting from N. A bad selector turns a 1.7× quality multiplier into a 1.1× quality multiplier, and the entire system's value evaporates.

GOrchestrator's design choice is to **outsource scoring entirely to GMirror** rather than implementing a thin LLM-as-judge. This is the single most important architectural decision in the system. The reason: an LLM judge scoring its own family's outputs has known calibration failures (length bias, style bias, self-preference). GMirror grounds scoring in verifiable checks and simulated user outcomes, both of which are model-independent.

### 6.2 Score dimensions

A GMirrorScoreBundle has multiple dimensions:

- **Correctness** — does the deliverable meet the spec, verifiably?
- **User outcome** — do simulated users succeed with the deliverable?
- **Robustness** — does it survive adversarial / red-team probes?
- **Cost** — how much did the attempt consume to produce this?
- **Risk** — security, compliance, reversibility flags.
- **Confidence** — GMirror's own confidence in the scoring (calibration signal).

Each dimension is a number in [0, 1] with associated evidence.

### 6.3 The aggregation function

The default aggregation is a weighted sum, with weights drawn from the task signature:

```
score = w_c · correctness
      + w_u · user_outcome
      + w_r · robustness
      - w_$ · normalized_cost
      - w_x · risk
```

Weights are stored in GBrain per task type and per user/company. They evolve over time as outcomes are observed.

The aggregated score is **only used for ranking, not for thresholding**. A high-score attempt that fails a hard check (e.g., security scan blocks deployment) is rejected regardless of aggregate. Hard checks are encoded as gates, not as score contributions.

### 6.4 Calibration loop

GMirror's scores are themselves evaluated over time. When a winning attempt is later observed to fail in production (via the real-world feedback loop, which writes to GBrain), the scoring is treated as miscalibrated for that task family. The calibration error feeds back into the scoring profile selection and the weight learning. This closes the loop and is the long-term mechanism by which the system improves.

---

## 7. Cost & Performance Model

### 7.1 Cost breakdown per run

For an N-attempt run, total cost is:

```
total_cost = N · attempt_cost
           + mirror_scoring_cost
           + tom_overhead_cost
           + brain_io_cost
           + sandbox_overhead_cost
```

In a typical code-task run with N=5:
- attempt_cost dominates (≈85–90% of total)
- mirror_scoring_cost ≈ 5–10%
- tom_overhead_cost ≈ 1–3%
- brain_io_cost ≈ 1–2%
- sandbox_overhead_cost ≈ 1–3%

### 7.2 Wall-clock model

```
wall_clock = max(attempt_wall_times) + scoring_wall_time + selection_wall_time
```

Attempts run in parallel; their wall times do not add. Scoring is parallelized within GMirror. Selection is fast (deterministic given scores).

Net: an N=5 run takes roughly the time of the slowest single attempt plus a verification overhead of 5–20%. This is the wall-clock case for parallel orchestration.

### 7.3 The cost-quality frontier

N is the primary tuning knob. As N grows:
- Quality lift increases sub-linearly (diminishing returns; typically saturates around N=10 for most task families).
- Cost grows roughly linearly.
- Wall clock grows logarithmically (due to slowest-attempt scaling).

The right N depends on the task's value. For high-value tasks (production deploys, customer-facing changes), N=10+ may be justified. For low-value tasks (internal refactors, exploratory research), N=2–3 may be enough.

GOrchestrator's budget system makes this explicit. Each run carries an `ExecutionBudget` with `max_attempts`, `max_cost`, and `max_wall_time`. The orchestrator picks N to optimize quality within those bounds.

### 7.4 Caching

Three levels of caching reduce cost:

- **Priming cache.** Identical task signatures hit a memoized priors bundle for some TTL.
- **Sub-task cache.** If two attempts decompose into the same sub-task, the sub-task result is shared (within the run only, to preserve attempt independence).
- **Skill output cache.** GStack skill outputs are cached per skill version + input hash. This is GStack's responsibility, not GOrchestrator's, but the orchestrator benefits from it.

---

## 8. Observability

### 8.1 What gets logged

Every run produces:
- A structured run record (canonical, written to GBrain).
- A trace per attempt (every tool call, every model call, every file change).
- A timeline of orchestrator events (intake → priming → dispatch → execution → scoring → selection → persistence).
- Cost ledger entries per attempt.
- Conflict-prediction events from GToM.
- Failure events with stack traces.

### 8.2 Dashboards (v1+)

- **Per-run dashboard:** the full run as a flame graph of attempts, with scores and selection rationale.
- **Per-task-family dashboard:** quality lift over time, winning-config drift, cost trends.
- **Per-agent dashboard:** which agent configurations win most, on what task families.
- **Calibration dashboard:** GMirror score vs. observed production outcome.

### 8.3 Alerting

Alerts fire on:
- Run failure rate > threshold.
- Quality regression on a task family (winning attempts now scoring worse than historical mean).
- Cost regression on a task family.
- GMirror calibration drift.
- Sandbox isolation violations.

---

## 9. Build Plan & Milestones

### 9.1 Hackathon MVP (the weekend)

**Goal:** a working demo that takes one task, runs N=3 attempts in parallel, scores them with a stub of GMirror (real verification but no synthetic users), picks a winner, and stores the run.

**Scope:**

- Single task type: code generation in a Python project.
- Local Docker sandboxes (one container per attempt).
- N=3, fixed.
- Configuration sampler: hardcoded — three predefined configs (cautious, balanced, aggressive) varying temperature and reasoning budget.
- Attempt runner: a thin agent loop that takes a task, writes code, runs tests.
- Scoring: deterministic. Tests pass + lint clean + type-check clean = base score. Bonus for shorter diff. (This is the GMirror stub.)
- Selection: highest score wins, ties broken by cheapest.
- Persistence: SQLite file. No real GBrain integration.
- GToM, GMirror, GBrain integrations: stubs only, with the real API shapes so the demo shows the integration surface.

**Demo flow (90 seconds):**

1. User submits a task: "Add a CSV export endpoint to this Flask app."
2. Screen splits into three panes — three agents racing.
3. Each pane streams its diff in real time.
4. Pane 1 finishes first but tests fail. Pane 3 finishes second with passing tests. Pane 2 takes longer but produces the cleanest diff.
5. Scores appear. Pane 3 wins on correctness; pane 2 wins on diff quality; selector picks pane 3 because correctness is weighted higher.
6. Pane shows the winning diff being applied. SQLite shows the run record.
7. Re-run the same task. Priming pulls from SQLite, biases toward pane 3's config, run completes faster.

**Time budget:**
- Friday night: sandbox abstraction, attempt runner, basic agent loop (8h).
- Saturday: config sampler, parallel execution, result collector, scoring stub (10h).
- Saturday night: selector, persistence, basic UI (6h).
- Sunday: demo polish, the second-run learning beat, pitch (8h).

**Risk:**
- The single biggest risk is the agent loop quality. If individual attempts fail too often, the demo doesn't show the quality-lift effect convincingly. Mitigation: pick a task type and an agent setup that has ≥40% single-attempt success rate; that's enough for N=3 to clearly outperform.
- Second risk: parallel execution flakiness in Docker. Mitigation: cap N=3, use prebuilt images, smoke-test the parallel run on Friday night before depending on it.

### 9.2 V1 — Production-shaped prototype (post-hackathon, ~6 weeks)

**Goal:** the architecture from this DDD, end to end, but at single-user scale and with minimum operational hardening.

**New scope vs MVP:**

- Real integration with GMirror (cognitive synthetic users, even if the synthetic user population is small).
- Real integration with GBrain (priors actually flow back into the next run).
- Real integration with GToM (file-collision prediction at minimum).
- Real integration with GStack (live skill manifests).
- Sandbox backend abstraction: local Docker + at least one cloud option (E2B or Modal).
- N=2–10, dynamic based on task signature and budget.
- Full data model (TaskSignature, AgentConfig with provenance, ScoredAttempt, OrchestratorRunRecord).
- Two task types supported end-to-end (e.g., code-change and document-write).
- Replay capability: any run can be re-executed from its record.
- Basic per-run dashboard.

**Milestones:**

- **Week 1:** Data model + storage layer + sandbox abstraction.
- **Week 2:** Configuration sampler with exploit/perturb/explore strategies.
- **Week 3:** GBrain integration (priors + writes), GStack integration (skill manifests).
- **Week 4:** GMirror integration (real scoring, not stub).
- **Week 5:** GToM integration (conflict prediction), replay capability.
- **Week 6:** Dashboard, calibration loop wiring, polish.

**Exit criteria:**
- Quality lift measurable and reproducible on two task families.
- Run records flow correctly into GBrain and meaningfully shift the next run's configurations.
- Replay produces results within tolerance of original.

### 9.3 V2 — Multi-tenant, production-grade (months 2–4)

**New scope:**

- Multi-tenant isolation (per-user, per-organization).
- Production sandbox backend (Firecracker microVMs or equivalent).
- Synthesized merge (Strategy 3 from §4.2.6).
- Cost ceilings enforced at the org level.
- Full observability stack (per-run, per-family, per-agent, calibration dashboards).
- Alerting and SLOs.
- Authentication, authorization, audit logs.
- Per-org scoring profiles in GMirror.
- A "shadow run" mode: run new configurations against historical tasks without acting on the output (for safe exploration).

**Milestones:**

- **Month 2:** Multi-tenancy, auth, audit.
- **Month 3:** Production sandbox backend, synthesized merge, observability stack.
- **Month 4:** Shadow runs, calibration dashboards, SLO hardening.

### 9.4 V3 — Platform (months 4+)

- Third-party skill packages (GStack ecosystem).
- Public scoring-profile marketplace (community-contributed).
- Open evaluation suite for task families.
- API for external orchestrators (use GOrchestrator as a service).
- Federated GBrain (share aggregated priors without sharing data).

V3 is intentionally sketched, not specified. The shape will be informed by what gets used in V2.

### 9.5 Engineering principles to enforce throughout

- **Contract first.** Every integration point has a versioned schema. No undocumented coupling.
- **Replay or it didn't happen.** No run is acceptable that can't be deterministically replayed (modulo model nondeterminism).
- **Cost is a first-class signal.** Every operation reports cost. Every run record includes the full breakdown.
- **Degradation over failure.** When a sub-system is down, degrade explicitly (and flag it). Never silently fall through.
- **Memory is sacred.** Never write degraded or unreliable data into GBrain's training signal. Flag, route to a quarantine table, but do not poison the main aggregates.

---

## 10. Risks & Mitigations

### 10.1 Technical risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| GMirror calibration is weak; bad scoring kills quality lift | High | Critical | Calibration loop from §6.4; hard gates separate from soft scores; fall back to deterministic-only when calibration drift detected |
| Parallel sandbox provisioning is slow; wall-clock advantage disappears | Medium | High | Pre-warmed sandbox pools; investigate Firecracker; aggressive cold-start optimization |
| Cost runs away on long-tail tasks | Medium | High | Hard budget gates; per-attempt cost ceilings; abort-on-budget logic |
| Memory growth in GBrain makes priming slow | Medium | Medium | Aggregation at write time, not at read time; tiered storage; signature-based indexing |
| Attempts collide despite GToM (false-negative on conflict prediction) | Medium | Medium | Filesystem isolation is hard, not soft — collisions at the FS layer are impossible; semantic collisions are advisory anyway |
| Selector bias toward certain configurations creates monoculture | Low | Medium | Exploration budget enforced; periodic forced exploration even when exploit is winning |

### 10.2 Product risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Crowded orchestration category; pattern-matched to LangGraph/CrewAI | High | High | Lead with scoring + memory contracts in pitch, not with "we run agents in parallel" |
| Cost economics don't work for low-value tasks | High | Medium | Make N tunable; default to N=2 for cheap tasks; offer single-attempt fallback |
| Customers want workflow composition, not distribution sampling | Medium | High | Don't fight it; let GOrchestrator be invoked from a workflow node (it composes well as a node inside LangGraph etc.) |
| GBrain becomes a vendor lock-in concern | Medium | Medium | Export tooling from day one; document the data model publicly |

### 10.3 Hackathon-specific risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Demo doesn't visibly show the parallel-attempts win | Medium | Critical | Designed split-screen UI is the primary demo asset — invest in it; record a backup video |
| Single-attempt success rate too high for chosen task → no quality lift visible | Medium | High | Test task selection on Friday night; if any single attempt always wins, switch task |
| Single-attempt success rate too low → all attempts fail | Medium | High | Same test on Friday; have a backup task ready |
| Theme fit not strong enough vs Cyberpunk 2077 framing | Low | Medium | Lean hard into the "fixer dispatching a crew" framing in the demo UI |

---

## 11. Open Questions

These are decisions deferred from the current draft. Each should be resolved before V1 begins.

1. **Configuration similarity metric.** When the sampler perturbs a winning config, how do we measure "small perturbation" vs "large"? Initial guess: structured edit distance over the config dict. Needs validation.

2. **Cross-task learning.** Should winning configs for task family A transfer to task family B if signatures partially overlap? V1 defaults to no (per-family only). V2 may revisit.

3. **Skill versioning.** GStack skills will version. How do we treat a run whose winning config used skill v3 when skill v4 is now available — do we replay against v3 or v4? V1 default: replay against the original (deterministic); production uses latest.

4. **User control over N.** Do end users see and tune N, or is it fully autonomous? V1: visible but autonomous-by-default with override.

5. **Merge synthesis cost accounting.** When Strategy 3 merge generates a new attempt, does it count against the original budget or get its own? V2 question.

6. **Hot vs cold task families.** Should hot task families (high-volume) get larger N (more learning signal) or smaller N (cost optimization)? Hypothesis: larger early, smaller as confidence grows. Test in V2.

7. **What's the right level for the user to specify constraints?** Per-task? Per-session? Per-org? Initial answer: per-task overrides per-session overrides per-org.

8. **Failure-as-signal.** Should attempts that *almost* succeed get partial credit in the training signal, or is it binary? Argument for partial: more information density. Argument against: poisoning. V1 default: binary; V2 may relax.

---

## 12. Appendix

### 12.1 Glossary

- **Attempt** — a single agent run against a task, in an isolated sandbox.
- **Configuration** — the parameters defining how one attempt runs (model, skills, style, etc.).
- **Run** — the collection of all attempts on one task, plus scoring and selection.
- **Signature** — a structured fingerprint of a task used for retrieval and learning.
- **Profile** — a set of scoring checks GMirror applies; per task type.
- **Prior** — historical data from GBrain that biases sampling toward known winners.
- **Provenance** — the lineage of a configuration (exploit / perturb / explore).

### 12.2 Versioning

This document is v0.1. Material changes require a version bump. Changes are tracked in a separate CHANGELOG.md.

### 12.3 Related references (for the team to read)

- Best-of-N selection literature on code generation (compute-optimal sampling).
- SWE-bench Verified methodology — the verification harness is informative for GMirror.
- LangGraph, CrewAI, AutoGen documentation — for what GOrchestrator is *not*.
- Sandbox security models from cloud function providers (Cloudflare Workers, AWS Lambda, Modal) — for V2 backend choices.

---

*End of GOrchestrator DDD v0.1.*
