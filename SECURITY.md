# GOrchestrator Security

GOrchestrator coordinates parallel agent execution and sandboxed attempts, so it must treat task payloads, sandbox outputs, and cross-tool responses as untrusted until validated.

## Principles

- Do not hardcode credentials, tokens, private endpoints, or API keys.
- Keep sandbox execution bounded by explicit budgets and concurrency limits.
- Treat GBrain, GMirror, GToM, and GStack responses as external inputs.
- Fail closed on malformed task bundles, invalid MCP contracts, and unsafe config.
- Preserve clear separation between mock sandbox mode and real execution mode.

## Checks

Run:

```bash
npm run check:privacy
npm run check:mcp-contract
npm run verify
```

Before release, run `npm run ci:local` to include build and CLI smoke checks.
