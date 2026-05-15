# MCP Contract

GOrchestrator exposes a Model Context Protocol server for agents and IDE integrations.

## Server Identity

- Name: `gorchestrator`
- Version: `0.1.0`
- Transport: stdio by default

## Tools

| Tool | Scope | Purpose |
| --- | --- | --- |
| `gorch_run` | write | Run a task through the parallel orchestration pipeline. |
| `gorch_health` | read | Return service and dependency health checks. |
| `gorch_config_sample` | read | Generate candidate execution configurations. |
| `gorch_get_receipts` | read | Query execution receipts by date range or latest receipt. |
| `gorch_get_drift` | read | Return drift detector output for a metric or all metrics. |
| `gorch_get_cost_stats` | read | Return budget ledger spend and reservation stats. |
| `gorch_sandbox_stats` | read | Return sandbox pool usage statistics. |
| `gorch_get_sandbox_stats` | read | Alias for sandbox stats. |
| `gorch_attempts` | read | Return persisted attempt records. |

## Authentication

Set `GORCHESTRATOR_REQUIRE_AUTH=true` to require bearer tokens. Use `GORCHESTRATOR_MCP_TOKEN` for a bootstrap token in local deployments. Read-only anonymous access is controlled by `GORCHESTRATOR_ALLOW_ANONYMOUS_READ`.

## Rate Limits

`GORCHESTRATOR_RATE_LIMIT_RPM` and `GORCHESTRATOR_RATE_LIMIT_RPH` control per-token request limits. The default is intentionally conservative for local operation.

## Compatibility Rules

- Tool names are stable for the `0.x` line.
- Optional input fields may be added without a major bump.
- Required input fields or response shape removals require a changelog entry and migration note.
