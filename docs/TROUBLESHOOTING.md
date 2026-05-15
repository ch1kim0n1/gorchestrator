# Troubleshooting

## Sandbox Startup Fails

Symptoms: `sandbox_start_failed`, no attempt output, or Docker connection errors.

Actions:

```bash
docker info
docker ps -a
gorchestrator health --json
```

Reduce `MAX_CONCURRENCY`, clear stopped containers, and verify workspace mount permissions.

## GBrain Is Unavailable

Symptoms: empty priors, GBrain circuit breaker warnings, receipt persistence warnings.

Actions:

- Confirm `GBRAIN_ENDPOINT`.
- Verify GBrain `/health`.
- Continue low-risk runs with empty priors.
- Reconcile receipts once GBrain returns.

## GMirror Scoring Fails

Symptoms: unscored attempts, missing hard-gate details, or selection errors.

Actions:

- Confirm `GMIRROR_ENDPOINT`.
- Run `gorchestrator health`.
- For development only, set task verification to false and record the exception in the receipt.

## Costs Rise Unexpectedly

Actions:

```bash
gorchestrator cost --week --by-model --by-operation
gorchestrator attempts --limit 20
```

Lower default attempts, tighten budgets, and review Tier 2/Tier 3 escalation triggers.

## Metrics Are Empty

The in-memory metrics registry starts empty after process restart. Run a health check or task, then scrape `gorchestrator metrics --format prometheus`.
