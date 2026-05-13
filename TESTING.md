# GOrchestrator Testing Guide

## Test Structure

```
test/
├── intake.test.ts          # IntakePrimer unit tests
├── sampler.test.ts         # ConfigurationSampler tests
├── sandbox.test.ts         # SandboxManager tests
├── runner.test.ts          # SyntheticUserRunner tests
├── selector.test.ts        # SelectionEngine tests
└── orchestrator.test.ts    # E2e integration tests
```

## Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test intake.test.ts
```

## Test Categories

### Unit Tests

**IntakePrimer** (`test/intake.test.ts`)
- Task bundle creation with required fields
- Signature hash consistency
- GBrain priming failure handling
- Empty priors fallback
- Budget defaults

**ConfigurationSampler** (`test/sampler.test.ts`)
- Sampling plan creation with N configs
- Required fields on generated configs
- Config diversity (unique IDs)
- Exploit strategy reuses winning configs
- Strategy distribution sums to ~1

**SandboxManager** (`test/sandbox.test.ts`)
- Pool statistics
- Provision lifecycle
- Command execution
- Snapshot/restore
- Cleanup

**Selector** (`test/selector.test.ts`)
- Winner selection logic
- Merge strategies
- Risk gate application

### Integration Tests

**Orchestrator** (`test/orchestrator.test.ts`)
- Full task execution flow
- Mock sandbox mode (MOCK_SANDBOX=1)
- GBrain unavailability handling
- GMirror scoring integration
- Persistence to GBrain

## Mock Mode

Set `MOCK_SANDBOX=1` to run tests without Docker:

```bash
MOCK_SANDBOX=1 npm test
```

Mock mode makes all sandbox operations no-ops with mock responses.

## Test Data Fixtures

Test helpers create minimal valid objects:

```typescript
function makeTaskBundle(): TaskBundle { ... }
function makeEmptyPriors(): GBrainPriorBundle { ... }
```

## Coverage Goals

- Core modules: > 90%
- Integration flows: > 80%
- Overall: > 85%

## Adding Tests

1. Create test file in `test/`
2. Import from `@jest/globals`
3. Use `describe`, `it`, `expect`, `beforeEach`
4. Follow existing test patterns
5. Add helpers for fixture creation

## CI Testing

```bash
npm run verify    # typecheck + test
npm run ci:local  # verify + build
```
