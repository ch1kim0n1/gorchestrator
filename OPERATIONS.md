# GOrchestrator Operations Guide

## Deployment

### Prerequisites
- Node.js >= 18
- Docker (for sandbox backend)
- GBrain, GStack, GMirror, GToM endpoints accessible

### Installation
```bash
npm install
npm run build
npm link
```

### Configuration
Create `~/.gorchestrator/config.json`:

```json
{
  "endpoints": {
    "gbrain": "http://localhost:3000",
    "gstack": "http://localhost:3001",
    "gmirror": "http://localhost:3002",
    "gtom": "http://localhost:3003"
  },
  "sandbox": {
    "backend": "docker",
    "maxConcurrency": 5
  }
}
```

## Running

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
gorchestrator run "task description" --attempts 5
```

### MCP Server Mode
```bash
gorchestrator mcp
```

## Monitoring

### Health Checks
```bash
gorchestrator health
```

Checks:
- Endpoint connectivity
- Sandbox pool status
- Recent run success rate

### Metrics to Track
- Task completion rate
- Average cost per task
- Average wall time
- Sandbox utilization
- Winner selection distribution

## Troubleshooting

### Sandbox Failures
- Check Docker daemon status
- Verify `maxConcurrency` not exceeded
- Check disk space for container images

### GBrain Unavailable
- GOrchestrator proceeds with empty priors
- Logs warning but doesn't fail
- Check GBrain endpoint and connectivity

### High Costs
- Review `defaultN` in configuration
- Check cost per attempt
- Consider budget limits

## Maintenance

### Cleanup
```bash
# Remove orphaned Docker containers
docker ps -a | grep gorch- | awk '{print $1}' | xargs docker rm

# Clean up old run records (via GBrain)
```

### Updates
```bash
npm install
npm run build
```

## Backup

Configuration and run records are stored in GBrain. Backup GBrain according to its operational guide.
