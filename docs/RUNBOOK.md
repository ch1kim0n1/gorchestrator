# GOrchestrator Runbook

## Daily Checks

```bash
gorchestrator health --json
gorchestrator metrics --format prometheus
gorchestrator cost --day --by-operation
```

Check for failed dependencies, rising sandbox startup latency, and budget pressure.

## Restart

### Systemd

```bash
sudo systemctl restart gorchestrator
sudo journalctl -u gorchestrator -n 200
```

### Kubernetes

```bash
kubectl rollout restart deployment/gorchestrator -n gstack
kubectl rollout status deployment/gorchestrator -n gstack
```

## Backup

```bash
gorchestrator backup ./backups/gorchestrator-$(date +%Y%m%d).db
```

For PostgreSQL, use `pg_dump` in addition to the application export.

## Restore

```bash
gorchestrator restore ./backups/gorchestrator-YYYYMMDD.db
gorchestrator health
```

## Incident Checklist

1. Confirm health output and dependency failures.
2. Check budget and cost ledger.
3. Check sandbox pool utilization.
4. Inspect recent receipts and drift output.
5. If GBrain is down, continue with empty priors and preserve local receipts.
6. If GMirror is down, disable verification only for low-risk internal tasks.
