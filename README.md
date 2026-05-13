# GOrchestrator — Parallel Agent Execution Manager

The crew boss of the G-Stack. GOrchestrator turns a single task into N parallel attempts, runs each in an isolated sandbox with its own agent configuration, scores the outputs against verifiable criteria, and selects or merges the winner.

## What It Does

- **Task decomposition and dispatch**: Break down tasks and dispatch them to multiple agent configurations in parallel
- **Sandbox lifecycle management**: Provision, run, snapshot, and destroy isolated execution environments
- **Bounded concurrency**: Control resource usage with configurable parallelism limits
- **Scoring and selection pipeline**: Evaluate outputs via GMirror and select the best result
- **Memory persistence**: Record full attempt histories (winners and losers) to GBrain for learning
- **Replay capability**: Rerun or vary configurations based on stored attempt histories

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

## CLI Commands

| Command | Description |
|---------|-------------|
| `run <task>` | Execute task with parallel attempts |
| `health` | Check system status and dependencies |
| `history` | View recent run records |
| `replay <run-id>` | Replay a previous run with variations |
| `config` | Manage configuration |

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

# Watch mode
npm run dev
```

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

- `GBRAIN_ENDPOINT` — Override GBrain endpoint
- `GSTACK_ENDPOINT` — Override GStack endpoint
- `GMIRROR_ENDPOINT` — Override GMirror endpoint
- `GTOM_ENDPOINT` — Override GToM endpoint
- `MOCK_SANDBOX` — Set to `1` to use mock sandbox mode (for testing)
- `MAX_CONCURRENCY` — Override max concurrent sandboxes

## Contributing

See `ARCHITECTURE.md` for detailed design documentation.

## License

MIT
