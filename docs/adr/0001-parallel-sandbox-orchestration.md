# ADR 0001: Parallel Sandbox Orchestration

## Status

Accepted

## Context

Single-agent execution hides variance. GOrchestrator needs to sample multiple execution strategies, isolate their side effects, and select a winner based on scored evidence.

## Decision

Use bounded parallel sandbox execution as the primary orchestration strategy. Each attempt gets an independent configuration and sandbox lifecycle. All attempts are persisted, not only the winner.

## Consequences

- Resource use is controlled by max concurrency and budget gates.
- Failed attempts become learning data.
- Operators need sandbox cleanup and cost monitoring.
- Selection quality depends on GMirror scoring and hard-gate enforcement.
