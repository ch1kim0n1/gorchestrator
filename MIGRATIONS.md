# GOrchestrator Migrations

GOrchestrator stores durable execution state in SQLite by default and PostgreSQL when `GORCHESTRATOR_DB_ENGINE=postgres` is configured. Schema changes are versioned and must be forward-only unless an explicit rollback is documented here.

## Current Schema

- `schema_version` records the active database schema.
- `migrations` records applied migration versions and timestamps.
- `task_runs` stores top-level orchestration runs.
- `attempt_results` stores sandbox attempts, including failed attempts.
- `scored_attempts` stores GMirror scoring output and selection metadata.
- `escalation_metrics`, `llm_calls`, and `cost_ledger` store operational metrics and cost history.

## Running Migrations

```bash
npm run build
gorchestrator migrate status
gorchestrator migrate up
```

For CI or local verification, run:

```bash
npm run verify
```

## Backup Before Migration

Create a backup before changing schema or database engine:

```bash
gorchestrator backup ./backups/gorchestrator-pre-migration.db
```

For PostgreSQL, use the platform backup tool as well:

```bash
pg_dump "$GORCHESTRATOR_DATABASE_URL" > backups/gorchestrator-pre-migration.sql
```

## Rollback Policy

Rollbacks are operational restores, not destructive schema rewrites. If a migration fails:

1. Stop the service.
2. Restore the SQLite backup or PostgreSQL dump.
3. Re-run `gorchestrator doctor`.
4. Re-run `npm run verify` before pushing a corrected migration.

## Adding A Migration

1. Add a numbered SQL file under `src/core/migrations`.
2. Make the migration idempotent with `IF NOT EXISTS` where possible.
3. Add or update persistence tests.
4. Document any operator action in this file.
5. Run `npm run verify` and `git diff --check`.
