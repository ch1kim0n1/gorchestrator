# GOrchestrator Performance

## SLO And SLI

| SLI | SLO | Measurement |
| --- | --- | --- |
| Task success rate | >= 95% for production task runs | `runTask` completion receipts and benchmark summary `success_rate`. |
| Task p95 wall time | <= 30s for standard tasks | `total_wall_time_ms`, benchmark `p95_ms`, and load-test response time. |
| Health p95 latency | <= 200ms | `/health` load tests and health-check metrics. |
| Sandbox queue pressure | queued <= 2x `maxConcurrency` | `getTaskProcessingStats()` and sandbox stats. |
| Memory baseline | RSS <= 256MB for benchmark smoke suite | `gorchestrator benchmark --json` `max_rss_mb`. |

## Benchmarks

Run the tracked synthetic benchmark suite before release-sensitive changes:

```bash
npm run build
node dist/gorchestrator/src/cli.js benchmark --n 10 --max-concurrency 2 --json
```

The benchmark uses mock sandboxes by default when `MOCK_SANDBOX` is unset, records per-run latency,
success, heap usage, RSS, p50, and p95. Store release baselines in CI artifacts or the eval ledger.

## Load Testing

Use either k6 or Artillery against a running service:

```bash
k6 run load/k6.js
artillery run load/artillery.yml
```

Set `GORCH_URL`, `VUS`, and `DURATION` for k6. Artillery target and rates are in
`load/artillery.yml`.

## Backpressure And Cancellation

`GOrchestrator` enforces overall task concurrency with `maxConcurrency` and `maxQueueDepth`, separate
from sandbox pool concurrency. Calls beyond queue capacity fail with a retryable backpressure error.
Queued tasks can be cancelled with `AbortSignal`, and in-flight tasks check cancellation between major
pipeline phases.

## Streaming And Progress

Long operations expose progress in two forms:

- `runTask({ onProgress })` calls back with phase, message, progress ratio, timestamp, and metadata.
- `runTaskStream(...)` is an async generator that yields progress events and then the final result.

Progress phases are `queued`, `intake`, `sampling`, `execution`, `scoring`, `selection`,
`cognitive_check`, `persistence`, `complete`, and `cancelled`.

## Caching

GBrain prior lookups use an in-process LRU-style TTL cache. Configure TTL with
`GORCH_PRIORS_CACHE_TTL_MS`; the default is five minutes. This reduces repeated priming latency while
preserving eventual freshness.

## Model Resolution

Model choice follows an eight-step resolution chain:

1. Explicit task model
2. Winning GBrain config
3. Task-type default
4. Low-cost fast path
5. Quality escalation
6. Cross-vendor consensus
7. Critical decision
8. Safe fallback
