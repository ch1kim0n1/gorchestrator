# Changelog

All notable changes to GOrchestrator will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2026-05-18

### Added
- Production hardening pass: non-root `node` user in Docker image; HEALTHCHECK directive
  hitting `/health/live`; HTTP security headers (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Strict-Transport-Security`, `Content-Security-Policy`, `Cache-Control`)
  on the public health server.
- Jest `coverageThreshold` enforcement: 85% lines/statements/functions for `src/core/**`,
  70% global floor.
- `eslint-plugin-security` dev dependency for static security analysis.

### Changed
- `package.json` version bumped from `0.1.0` → `0.5.0`.

### Added (carried over from Unreleased)
- Documentation set covering migrations, TypeDoc API generation, MCP contract, evaluation baselines, runbook operations, troubleshooting, security model, data flow, integration guidance, and ADRs.
- `docs:api` script and `typedoc.json` entrypoint configuration for generated API documentation.
- Typed GBrain integration client with HTTP/MCP transports, auth tokens, timeouts, retry backoff, circuit breaker behavior, and Zod response validation for priors, run persistence, and receipt storage.

### Changed
- Improved sandbox lifecycle management
- Enhanced scoring and selection algorithms

## [0.1.0] - 2026-05-13

### Added
- Parallel task orchestration, configuration sampling, sandbox lifecycle, scoring, and selection foundations
- Jest-based unit, integration, CLI, MCP, and orchestration tests
- Quality gates for package contracts, documentation, privacy scanning, test isolation, MCP contracts, and CLI smoke checks
- Eval scripts for local audit history, summary, comparison, and test-tier selection
- MCP server with run and health operations
- CLI commands: run, health, replay
- Integration with GBrain for receipt storage
