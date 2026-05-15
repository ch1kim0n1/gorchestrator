# Evaluation Baseline

The evaluation baseline defines how GOrchestrator checks orchestration quality over time.

## Baseline Artifacts

- `test/baselines/regression-baselines.jsonl` stores locked regression values.
- Weekly receipt JSONL files store execution outcomes.
- `scripts/eval-tools.js` records, lists, summarizes, compares, and selects evaluation receipts.

## Commands

```bash
npm run eval:record
npm run eval:list
npm run eval:summary
npm run eval:compare
npm run eval:select
```

## Regression Policy

The `regress` command compares current receipts against a selected baseline. A regression is any meaningful drop in pass rate, hard-gate compliance, cost envelope, or latency envelope.

## Metrics

Track these dimensions in every baseline:

- Pass rate
- Hard-gate pass rate
- Average cost per task
- P95 execution latency
- Sandbox failure rate
- Winner selection confidence

## Updating A Baseline

Only update baselines when behavior is intentionally improved or the scoring rubric changes. Include the reason in `CHANGELOG.md`, keep the old receipt available for audit, and run `npm run verify`.
