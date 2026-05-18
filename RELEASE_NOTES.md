# GOrchestrator v0.5.0 — Production Hardening

**Date:** 2026-05-18
**Migration:** 0.1.0 → 0.5.0

## What's New

### Container hardening
- `Dockerfile` drops privileges via `chown -R node:node /app` + `USER node`.
- `HEALTHCHECK` directive calls `http://localhost:3001/health/live` via `node -e`
  with explicit `.on('error', ...)` handling.
- `docker-compose.yml` services declare resource limits:
  - `gorchestrator`: `mem_limit: 768m`, `mem_reservation: 384m`, `cpus: 1.5`
  - `gbrain`, `gmirror`, `gtom`: `mem_limit: 512m`, `mem_reservation: 256m`, `cpus: 1.0`

### HTTP security headers
- `src/core/public-health-server.ts` sets a helmet-equivalent header set on every
  response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, `Strict-Transport-Security: max-age=31536000;
  includeSubDomains`, `Content-Security-Policy: default-src 'none';
  frame-ancestors 'none'`, `Cache-Control: no-store`.

### Test-coverage enforcement
- `jest.config.js` declares `coverageThreshold`:
  - `src/core/**/*.ts`: 85% lines/statements/functions, 75% branches
  - global: 70% lines/statements/functions, 60% branches

### Static security analysis
- `eslint-plugin-security@^3.0.1` added as a dev dependency.

### Version
- `package.json` `version` field bumped from `0.1.0` → `0.5.0`.

## Migration from 0.1.0

No breaking API changes. MCP contract, `TaskRequest`/`TaskResult`,
`HealthCheckResult`, and SQLite schema (`attempt_results`, `scored_attempts`,
`task_runs`, `schema_version`) are all unchanged.

Operational notes:
1. **Re-build the image** (`USER node` requires chown at build time).
2. **`/var/run/docker.sock` bind-mount.** If you use `SANDBOX_BACKEND=docker`
   on a host with Docker, the `node` user inside the container may not be in
   the docker group. Either keep `SANDBOX_BACKEND=inprocess` (the default in
   the compose file) or chown the socket on the host before bringing the
   container up.
3. **Mounted volumes** must be writable by uid 1000 (`node`).
4. **HSTS** is sent on all responses.

## Verification

```bash
docker compose build
docker compose up -d
docker inspect gorchestrator --format '{{.Config.User}}'         # → node
docker inspect gorchestrator --format '{{.State.Health.Status}}' # → healthy
curl -sI http://localhost:3001/health/live | \
  grep -iE 'x-content-type|x-frame|referrer|strict-transport|content-security'
npm run test:coverage   # threshold gate active
```

## Known Limitations
- `npm audit` not recorded for this release — run before external publish.
- `eslint-plugin-security` installed but not yet enabled in ESLint config.
- `regress` and `trend` CLI commands remain stubs (per `CLAUDE.md` DYAD plan).
