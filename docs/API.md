# API Documentation

GOrchestrator API documentation is generated from TypeScript source with TypeDoc.

## Generate

```bash
npm run docs:api
```

The generated HTML output is written to `docs/api/`. The checked-in TypeDoc entrypoints are:

- `src/core/orchestrator.ts`
- `src/core/intake.ts`
- `src/core/sampler.ts`
- `src/core/sandbox.ts`
- `src/core/selector.ts`
- `src/core/observability.ts`
- `src/types/index.ts`

## Public Surfaces

### GOrchestrator

Primary orchestration facade. It exposes task execution, health checks, receipt queries, drift queries, cost stats, metrics export, and shell-job audit logging.

### IntakePrimer

Normalizes raw task requests, applies defaults, queries GBrain priors, and creates signed task bundles.

### ConfigurationSampler

Creates exploit, perturb, and explore configurations from priors and local sampling policy.

### SandboxPoolManager

Controls sandbox provisioning, execution, snapshotting, cleanup, and bounded concurrency.

### SelectorEngine

Chooses the winning scored attempt and records selection reasoning.

### GOrchestratorObservability

Exports Prometheus metrics, OpenTelemetry-shaped metrics, trace spans, health-drop webhooks, and JSONL audit logs.

## Stability

The TypeScript interfaces in `src/types/index.ts` are treated as the compatibility contract for external callers. Breaking changes require a semver minor or major version bump and an entry in `CHANGELOG.md`.
