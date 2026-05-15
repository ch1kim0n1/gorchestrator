# Integration Guide

## CLI Integration

Use the CLI when the caller can spawn a local process:

```bash
gorchestrator run "refactor payment retry handling" --attempts 4 --json
```

Parse JSON output for automation. Use `--quiet` where supported to suppress human-readable progress.

## MCP Integration

Add the server to an MCP client:

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

Use `gorch_run` for task execution and `gorch_health` before dispatching high-cost work.

## Library Integration

Import TypeScript classes directly in a Node project:

```typescript
import { GOrchestrator } from 'gorchestrator';

const orchestrator = new GOrchestrator({
  gbrainEndpoint: 'http://localhost:3000',
  gmirrorEndpoint: 'http://localhost:3002',
});

const result = await orchestrator.runTask({ task: 'implement retry policy' });
```

## Observability Integration

Scrape Prometheus text with:

```bash
gorchestrator metrics --format prometheus
```

OpenTelemetry-shaped JSON is available with:

```bash
gorchestrator metrics --format otel
```

## Deployment Integration

Set endpoints through environment variables in container, systemd, or Kubernetes deployments. Keep database and API secrets in the platform secret store.
