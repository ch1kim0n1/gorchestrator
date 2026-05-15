# Security Model

GOrchestrator executes untrusted task attempts in bounded sandboxes and treats all cross-tool network responses as untrusted input.

## Trust Boundaries

- CLI and MCP callers provide task requests.
- GBrain provides prior context and persistence.
- GStack and sandbox workers execute task attempts.
- GMirror scores outputs.
- GToM performs pre-checks for risk and authenticity.

## Controls

- Sandbox isolation for attempt execution.
- Max concurrency and budget limits.
- MCP auth and rate limiting.
- PII redaction in structured logs and audit files.
- Receipt signatures when a signing key is configured.
- Circuit breakers for repeated GBrain failures.

## Secrets

Secrets are provided by environment variables or deployment secret stores. Do not write API keys into config files, receipts, or baseline fixtures.

## Audit

Decision logs are written to `~/.gorchestrator/audit/decisions-YYYY-Www.jsonl`. Shell-job logs are written to `shell-jobs-YYYY-Www.jsonl`. These files should be retained with the same policy as execution receipts.

## Reporting

Security issues should be disclosed privately through the repository owner. Do not include secrets, raw customer data, or unredacted message content in public issues.
