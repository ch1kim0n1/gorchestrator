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

### Deployment Methods

#### Docker Compose
```bash
# Build and start with Docker Compose
docker-compose up -d gorchestrator

# View logs
docker-compose logs -f gorchestrator

# Stop
docker-compose down
```

#### Kubernetes with Helm
```bash
# Install chart
helm install gorchestrator ./helm/gorchestrator --namespace gstack --create-namespace

# Upgrade
helm upgrade gorchestrator ./helm/gorchestrator --namespace gstack

# Rollback
helm rollback gorchestrator --namespace gstack

# Uninstall
helm uninstall gorchestrator --namespace gstack
```

#### Systemd (Bare Metal)
```bash
# Create user and directories
sudo useradd -r -s /bin/false gorchestrator
sudo mkdir -p /opt/gorchestrator /var/lib/gorchestrator /var/log/gorchestrator /etc/gorchestrator
sudo chown -R gorchestrator:gorchestrator /opt/gorchestrator /var/lib/gorchestrator /var/log/gorchestrator

# Copy files
sudo cp -r dist/* /opt/gorchestrator/
sudo cp deploy/systemd/gorchestrator.service /etc/systemd/system/
sudo cp .env.example /etc/gorchestrator/gorchestrator.env
# Edit /etc/gorchestrator/gorchestrator.env with actual values

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable gorchestrator
sudo systemctl start gorchestrator

# Check status
sudo systemctl status gorchestrator
sudo journalctl -u gorchestrator -f
```

### Rollback Procedures

#### Kubernetes
```bash
# View revision history
helm history gorchestrator --namespace gstack

# Rollback to previous version
helm rollback gorchestrator --namespace gstack

# Rollback to specific revision
helm rollback gorchestrator <revision> --namespace gstack
```

#### Docker Compose
```bash
# Rebuild with previous image tag
docker-compose down
docker-compose up -d --build gorchestrator
```

#### Systemd
```bash
# Stop service
sudo systemctl stop gorchestrator

# Restore previous build
sudo cp -r /opt/gorchestrator.backup/* /opt/gorchestrator/

# Restart
sudo systemctl start gorchestrator
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

### Service Level Objectives (SLOs)

#### P95 Latency
- Task execution: 30s (depends on task complexity)
- Health check: 200ms

#### Error Rate
- Task execution: < 5%
- Sandbox startup: < 2%
- Health check: < 0.1%

#### Uptime
- Monthly: 99.5%
- Quarterly: 99.9%

#### Alert Thresholds
- Task failure rate > 10% for 10 minutes
- Sandbox pool exhaustion for 5 minutes
- Health check failure for 1 minute
- Budget exceeded for 1 hour

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
