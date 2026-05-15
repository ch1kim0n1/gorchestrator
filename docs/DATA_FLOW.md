# Data Flow

```mermaid
flowchart LR
  User["CLI or MCP caller"] --> Intake["IntakePrimer"]
  Intake --> Priors["GBrain priors"]
  Intake --> Sampler["ConfigurationSampler"]
  Sampler --> Sandbox["SandboxPoolManager"]
  Sandbox --> Attempts["Attempt results"]
  Attempts --> GMirror["GMirror scoring"]
  Attempts --> GToM["GToM checks"]
  GMirror --> Selector["SelectorEngine"]
  GToM --> Selector
  Selector --> Receipt["ReceiptRegistry"]
  Selector --> Persistence["SQLite or PostgreSQL"]
  Receipt --> GBrain["GBrain persistence"]
  Persistence --> Metrics["Metrics and audit logs"]
```

## Sensitive Data

Task text, attempt output, and scoring evidence may contain sensitive data. Logs and audit entries pass through PII redaction before writing. Receipts should contain evidence summaries rather than raw secrets.

## Persistence Paths

- SQLite: `~/.gorchestrator/gorchestrator.db`
- Audit: `~/.gorchestrator/audit/*.jsonl`
- Receipts: weekly JSONL receipt files
- PostgreSQL: `GORCHESTRATOR_DATABASE_URL`
