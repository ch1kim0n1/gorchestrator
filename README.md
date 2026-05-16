## Quickstart (60 seconds)

```bash
npm install gorchestrator
```

```typescript
import { GStackSDK } from 'gorchestrator';
const stack = new GStackSDK({ apiKey: process.env.ANTHROPIC_API_KEY });
const result = await stack.run('write a TypeScript function to validate emails');
console.log(result.output);
```

> No Docker. No services. Run any task through parallel LLM attempts and get the best result.

---

# GOrchestrator — Parallel Agent Execution Manager

The crew boss of the G-Stack. GOrchestrator turns a single task into N parallel attempts, runs each in an isolated sandbox with its own agent configuration, scores the outputs against verifiable criteria, and selects or merges the winner.

## What It Does

- **Task decomposition and dispatch**: Break down tasks and dispatch them to multiple agent configurations in parallel
- **Sandbox lifecycle management**: Provision, run, snapshot, and destroy isolated execution environments
- **Bounded concurrency**: Control resource usage with configurable parallelism limits
- **Scoring and selection pipeline**: Evaluate outputs via GMirror and select the best result
- **Memory persistence**: Record full attempt histories (winners and losers) to GBrain for learning
- **Replay capability**: Rerun or vary configurations based on stored attempt histories
- **Production observability**: Export Prometheus and OpenTelemetry metrics, decision audit logs, shell-job audit logs, and Grafana dashboards

## Core Thesis

Agent quality at the task level is not primarily a function of how smart a single agent is; it is a function of how many attempts you can afford, how well you can score them, and how well you can learn from the distribution of outcomes. GOrchestrator operationalizes this thesis.

## Installation

```bash
npm install
npm run build
npm link
```

## Quick Start

```bash
# Run a task with parallel attempts
gorchestrator run "implement user authentication" --attempts 5

# Run with custom configuration
gorchestrator run "build REST API" --config custom-config.json

# Check system health
gorchestrator health

# View recent run records
gorchestrator history
```

### No Docker? Use in-process mode

If Docker is not available or you prefer not to use containers, GOrchestrator can run tasks directly via LLM calls without sandbox isolation:

```bash
# Set in-process backend in .env
SANDBOX_BACKEND=inprocess

# Or use environment variable
export SANDBOX_BACKEND=inprocess
gorchestrator run "implement user authentication"
```

The in-process backend:
- Executes tasks via direct LLM API calls (no containers)
- Requires ANTHROPIC_API_KEY or OPENAI_API_KEY
- Provides cost tracking and execution metrics
- Has no isolation (use with trusted prompts only)
- Auto-detects Docker availability and falls back when unavailable

## CLI Commands

| Command | Description |
|---------|-------------|
| `run <task>` | Execute task with parallel attempts |
| `health` | Check system status and dependencies |
| `sync` | Register stack tool sources with GBrain using incremental, full, and dry-run modes |
| `attempts` | View recent attempt records |
| `replay <run-id>` | Replay a previous run with variations |
| `benchmark` | Run tracked synthetic latency and memory benchmarks |
| `receipts` | Query execution receipts |
| `drift` | Check drift detector output |
| `cost` | Inspect budget ledger spend |
| `metrics` | Export Prometheus, OpenTelemetry, or JSON observability data |
| `secrets rotate`, `secrets list` | Rotate and inspect local secret-manager records without printing values |
| `backup`, `restore`, `export` | Operate on persisted state |

`gorchestrator sync --incremental` emits gstack-compatible stage results, registers each
stack tool as a federated GBrain source with a `pathhash8` ID, and writes a
`.gbrain-source` attachment into each tool path. `gorchestrator sync --full` also removes
legacy source IDs from the prior sync state. `gorchestrator sync --dry-run --json` shows
planned commands without acquiring a lock, writing source dotfiles, or updating state.

## Configuration

GOrchestrator uses a configuration file (default: `~/.gorchestrator/config.json`) to define:

- **Endpoints**: GBrain, GStack, GMirror, GToM service URLs
- **Sandbox settings**: Backend type (docker/local), max concurrency
- **Sampling parameters**: Default N, strategy distribution
- **Budget limits**: Max cost, max wall time, max attempts per task

Example configuration:

```json
{
  "endpoints": {
    "gbrain": "http://localhost:3000",
    "gstack": "http://localhost:3001",
    "gmirror": "http://localhost:3002",
    "gtom": "http://localhost:3003"
  },
  "sandbox": {
    "backend": "docker",
    "maxConcurrency": 5
  },
  "sampling": {
    "defaultN": 3,
    "strategyDistribution": {
      "exploit": 0.3,
      "perturb": 0.3,
      "explore": 0.4
    }
  },
  "budget": {
    "maxCostUSD": 10.0,
    "maxWallTimeMs": 300000,
    "maxAttempts": 10
  }
}
```

## Architecture

GOrchestrator consists of several core modules:

- **IntakePrimer**: Ingests tasks, queries GBrain for priors, builds task bundles
- **ConfigurationSampler**: Generates diverse agent configurations using exploit/perturb/explore strategies
- **SandboxManager**: Manages Docker sandbox lifecycle with concurrency control
- **SyntheticUserRunner**: (via GMirror) Executes tasks in sandboxes
- **ScoringPipeline**: (via GMirror) Scores outputs against verifiable criteria
- **SelectionEngine**: Selects or merges winners based on scores
- **PersistenceLayer**: Writes attempt histories to GBrain

## MCP Integration

GOrchestrator exposes an MCP server for Claude Code integration:

```json
{
  "mcpServers": {
    "gorchestrator": {
      "command": "gorchestrator",
      "args": ["mcp"]
    }
  }
}
```

Exposed tools:
- `gorch_run` — Execute task with parallel attempts
- `gorch_health` — Check system status
- `gorch_history` — Query run records

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Type check
npm run typecheck

# Full verification
npm run verify

# Generate TypeDoc API docs
npm run docs:api

# Watch mode
npm run dev
```

## Documentation

| Document | Purpose |
| --- | --- |
| `CLAUDE.md` | Agent-readable runtime contract |
| `ARCHITECTURE.md` | System overview and component responsibilities |
| `MIGRATIONS.md` | Database migration and rollback policy |
| `OPERATIONS.md` | Deployment and operational procedures |
| `TESTING.md` | Test strategy and local verification |
| `SECURITY.md` | Security reporting and baseline policy |
| `docs/API.md` | TypeDoc entrypoints and public API summary |
| `docs/MCP_CONTRACT.md` | MCP tool contract |
| `docs/EVAL_BASELINE.md` | Evaluation baseline policy |
| `docs/PERFORMANCE.md` | Benchmarks, load tests, SLO/SLI, backpressure, streaming, cancellation, and caching |
| `docs/RUNBOOK.md` | Common operator tasks |
| `docs/TROUBLESHOOTING.md` | Failure diagnosis |
| `docs/SECURITY_MODEL.md` | Trust boundaries and controls |
| `docs/DATA_FLOW.md` | Mermaid data-flow diagram |
| `docs/INTEGRATION.md` | CLI, MCP, library, and observability integration |
| `docs/adr/` | Architecture Decision Records |

## Testing

GOrchestrator includes comprehensive test coverage:

- Unit tests for core modules (intake, sampler, sandbox, selector)
- Integration tests for full orchestration flow with mocked dependencies
- Sandbox lifecycle tests with mock mode
- Configuration sampling tests with various strategies

Run tests:

```bash
npm test                    # All tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
```

## Environment Variables

- `GBRAIN_ENDPOINT` — Override GBrain HTTP endpoint
- `GBRAIN_INTEGRATION_MODE` — `http` or `mcp` transport for priors and persistence
- `GBRAIN_MCP_ENDPOINT` — Override GBrain MCP endpoint when MCP mode is enabled
- `GBRAIN_AUTH_TOKEN` — Bearer token for GBrain HTTP/MCP calls
- `GBRAIN_TIMEOUT_MS` — Per-call GBrain timeout
- `GBRAIN_MAX_RETRIES` — Retry count for transient GBrain failures
- `GBRAIN_BACKOFF_MS` — Initial retry backoff for GBrain calls
- `GBRAIN_CIRCUIT_FAILURES` — Consecutive transient failures before opening the GBrain circuit
- `GBRAIN_CIRCUIT_COOLDOWN_MS` — GBrain circuit breaker cooldown
- `GSTACK_ENDPOINT` — Override GStack endpoint
- `GMIRROR_ENDPOINT` — Override GMirror endpoint
- `GTOM_ENDPOINT` — Override GToM endpoint
- `GORCHESTRATOR_SYNC_ROOT` - Override the `gstack-gbrain-sync` lock and state directory
- `GORCHESTRATOR_TOOL_<NAME>_PATH` - Override a source path for `gbrain`, `gstack`, `gorchestrator`, `gmirror`, `gtom`, or `glearn`
- `GORCHESTRATOR_SECRET_DIR` - Override the local file-backed secret-manager directory
- `GORCHESTRATOR_PERMISSIONS_FILE` - JSON file mapping token hashes to allowed MCP scopes
- `GORCHESTRATOR_HEALTH_RATE_LIMIT_RPM` - Rate limit for public health endpoints
- `GORCHESTRATOR_HEALTH_SHUTDOWN_TOKEN` - Legacy env fallback for the `health_shutdown_token` secret
- `MOCK_SANDBOX` — Set to `1` to use mock sandbox mode (for testing)
- `MAX_CONCURRENCY` — Override max concurrent sandboxes

## Contributing

See `ARCHITECTURE.md` for detailed design documentation.

## License

MIT
