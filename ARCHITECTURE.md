# GOrchestrator Architecture

## System Overview

GOrchestrator is the parallel agent execution manager that turns a single task into N parallel attempts, runs each in an isolated sandbox, scores the outputs, and selects the winner.

## Core Components

### 1. IntakePrimer
**Location**: `src/core/intake.ts`

Ingests tasks and prepares them for execution:
- Parses task descriptions and constraints
- Queries GBrain for similar tasks and winning configurations
- Generates task bundles with signatures and priors
- Handles GBrain unavailability gracefully with empty priors

### 2. ConfigurationSampler
**Location**: `src/core/sampler.ts`

Generates diverse agent configurations:
- **Exploit strategy**: Reuses known winning configurations
- **Perturb strategy**: Mutates successful configs with small variations
- **Explore strategy**: Generates novel configurations
- Uses GStack skill manifests to inform sampling
- Creates sampling plans with strategy distribution

### 3. SandboxManager
**Location**: `src/core/sandbox.ts`

Manages Docker sandbox lifecycle:
- Provisions Docker containers with workspace mounts
- Executes commands in isolated environments
- Supports snapshot/restore for state management
- Enforces max concurrency limits
- Includes mock mode for testing

### 4. SyntheticUserRunner
**Location**: `src/core/runner.ts`

Executes tasks in sandboxes:
- Runs agent configurations in parallel
- Collects execution traces and outputs
- Measures cost and duration
- Handles sandbox errors and timeouts

### 5. ScoringPipeline
**Location**: Delegates to GMirror

Scores execution outputs:
- Sends outputs to GMirror for evaluation
- Collects multi-dimensional verdicts
- Aggregates scores across attempts

### 6. SelectionEngine
**Location**: `src/core/selector.ts`

Selects or merges winners:
- Selects best-scoring attempt
- Supports merging strategies for compatible outputs
- Applies risk gates for harmful outcomes
- Returns final result with metadata

### 7. PersistenceLayer
**Location**: Integrated in orchestrator

Writes attempt histories to GBrain:
- Stores full attempt records (winners and losers)
- Includes configuration metadata
- Enables replay and learning
- Handles GBrain write failures gracefully

## Data Flow

```
Task Request
    ↓
IntakePrimer (query GBrain for priors)
    ↓
ConfigurationSampler (generate N configs)
    ↓
SandboxManager (provision N sandboxes)
    ↓
SyntheticUserRunner (execute in parallel)
    ↓
ScoringPipeline (via GMirror)
    ↓
SelectionEngine (select winner)
    ↓
PersistenceLayer (write to GBrain)
    ↓
Result
```

## Key Design Decisions

### Parallel Execution
- Bounded concurrency prevents resource exhaustion
- Sandboxes provide isolation between attempts
- Failures in one attempt don't affect others

### Learning from Losers
- All attempts are stored, not just winners
- Enables pattern learning across the distribution
- Supports replay and counterfactual analysis

### Mock Mode
- MOCK_SANDBOX environment variable enables testing without Docker
- All sandbox operations become no-ops with mock responses
- Critical for CI/CD and local development

### GBrain Integration
- Priors inform configuration sampling
- Full histories enable long-term learning
- Graceful degradation when GBrain unavailable

## Configuration Schema

```typescript
interface GOrchestratorConfig {
  endpoints: {
    gbrain: string;
    gstack: string;
    gmirror: string;
    gtom: string;
  };
  sandbox: {
    backend: 'docker' | 'local';
    maxConcurrency: number;
  };
  sampling: {
    defaultN: number;
    strategyDistribution: {
      exploit: number;
      perturb: number;
      explore: number;
    };
  };
  budget: {
    maxCostUSD: number;
    maxWallTimeMs: number;
    maxAttempts: number;
  };
}
```

## Error Handling Strategy

- **GBrain unavailable**: Proceed with empty priors, log warning
- **Sandbox failure**: Mark attempt as failed, continue with others
- **GMirror unavailable**: Use fallback scoring or skip scoring
- **Persistence failure**: Log warning, don't block result delivery
- **Timeout**: Kill sandbox, mark attempt as failed

## Extension Points

- **Custom samplers**: Implement alternative sampling strategies
- **Custom selectors**: Implement different selection/merge logic
- **Alternative backends**: Support Kubernetes or other container runtimes
- **Custom scoring**: Integrate alternative scoring systems

## Testing Strategy

- Unit tests for each core module
- Integration tests with mocked dependencies
- E2E tests with mock sandbox mode
- Configuration sampling tests with various priors
- Selection engine tests with different score distributions
