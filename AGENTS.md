# Agent Guidance for GOrchestrator

GOrchestrator is the parallel execution manager for the G-Stack. Agents should keep orchestration logic deterministic, observable, and bounded by budget and safety gates.

## Rules

- Preserve MCP tool names and schemas unless intentionally changing public contracts.
- Update tests and docs for all public behavior changes.
- Keep sandbox mock mode deterministic and separate from real execution.
- Run `npm run verify` after edits.
- Run `npm run ci:local` before release-level changes.

## Contract Surfaces

- CLI: `src/cli.ts`
- MCP: `src/mcp/server.ts`
- Orchestration flow: `src/core/orchestrator.ts`
- Sandbox lifecycle: `src/core/sandbox.ts`
- Selection logic: `src/core/selector.ts`
