# GOrchestrator Threat Model

## Assets

- MCP tool execution, especially `gorch_run` and `gorch_config_sample`.
- GBrain, GStack, GMirror, and GToM integration tokens.
- LLM provider API keys.
- Execution receipts, audit logs, cost ledgers, and sandbox outputs.
- Docker containers and mounted sandbox workspaces.

## Trust Boundaries

- MCP clients are external callers and must authenticate before write operations.
- Health endpoints are public HTTP endpoints and are rate-limited.
- Docker sandboxes are untrusted execution environments.
- Secret-manager files under `GORCHESTRATOR_SECRET_DIR` are privileged local state.
- Receipt stores and GBrain persistence endpoints are remote sinks.

## Controls

- MCP calls use bearer-token authentication, read/write scopes, per-token rate limits, and optional token-hash permissions from `GORCHESTRATOR_PERMISSIONS_FILE`.
- Local secrets are read through the file-backed secret manager before legacy environment fallback. Rotate with `gorchestrator secrets rotate <name>`.
- Logs, traces, audit events, and receipts redact common PII and credential shapes.
- Security events are written to `security-YYYY-Www.jsonl` audit logs.
- Docker provisioning and restore paths apply `--network none` when sandbox network isolation is enabled.
- Docker command execution uses array-form `spawn` arguments and `docker exec -w` so working directories are not shell-interpolated.
- Public health endpoints are rate-limited, and shutdown requires a bearer token from `health_shutdown_token`.

## Secret Rotation

Rotate secrets regularly using the CLI:

```bash
# Rotate auth secret used for JWT token signing
gorchestrator secrets rotate orchestrator_auth_secret

# Rotate MCP bootstrap token
gorchestrator secrets rotate orchestrator_mcp_token

# Rotate health shutdown token
gorchestrator secrets rotate health_shutdown_token

# List all secrets
gorchestrator secrets list
```

Secrets are stored in `GORCHESTRATOR_SECRET_DIR` (default: `~/.gorchestrator/secrets/`). Each rotation increments the version and records the timestamp. Rotate auth secrets:
- Immediately if compromised or suspected compromise
- On a regular schedule (e.g., quarterly) for production deployments
- Before deploying to new environments

After rotating `orchestrator_auth_secret`, restart the MCP server to use the new signing key. After rotating `orchestrator_mcp_token`, update any clients using the bootstrap token.

## Residual Risks

- A sandbox command string is still intentionally executed by a shell inside the isolated container. Callers must treat the sandbox as hostile and avoid mounting sensitive host paths.
- Legacy environment variables remain as a compatibility fallback until deployments migrate secrets into `GORCHESTRATOR_SECRET_DIR`.
- The default local auth secret is for development only. Production deployments must rotate `orchestrator_auth_secret` and `orchestrator_mcp_token`.
