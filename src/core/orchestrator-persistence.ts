import * as path from 'path';
import * as fs from 'fs';

/**
 * SQLite Persistence Manager for GOrchestrator
 *
 * Stores attempt results, scored attempts, and task runs.
 *
 * Backed by the native `better-sqlite3` engine when it is available (built for
 * the host). When the native binding cannot be loaded — for example in the
 * PyPI/pip distribution, which bundles the JS but cannot ship a compiled native
 * addon — the manager transparently falls back to a volatile in-memory store so
 * the CLI keeps working. Set GORCHESTRATOR_REQUIRE_SQLITE=1 to restore the
 * historical hard-fail behavior when durable persistence is mandatory.
 */
export class OrchestratorPersistenceManager {
  private db: any;
  private dbPath: string;
  private readonly SCHEMA_VERSION = 2;
  private backupDir: string;
  private backupRetentionCount: number;
  /** True when running on the volatile in-memory fallback (no better-sqlite3). */
  public readonly inMemory: boolean = false;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || process.env.GORCHESTRATOR_DB_PATH || path.join(process.cwd(), '.gorchestrator', 'data', 'orchestrator.db');
    const dataDir = path.dirname(this.dbPath);
    this.backupDir = process.env.GORCHESTRATOR_BACKUP_DIR || path.join(dataDir, 'backups');
    this.backupRetentionCount = Math.max(1, Number(process.env.GORCHESTRATOR_BACKUP_RETENTION || '10'));
    try {
      // Lazy require so esbuild can keep better-sqlite3 external and the module
      // is only resolved when this class is actually constructed.
      const Database = require('better-sqlite3');
      fs.mkdirSync(dataDir, { recursive: true });
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      this.initializeSchema();
    } catch (error) {
      if (process.env.GORCHESTRATOR_REQUIRE_SQLITE === '1') {
        throw new Error(`Persistence initialization failed: ${error}. Persistence is REQUIRED for GOrchestrator.`);
      }
      // Graceful degradation: better-sqlite3 is unavailable (e.g. no native
      // toolchain / pip-installed bundle). Use a volatile in-memory shim that
      // implements the same minimal SQL surface this class relies on.
      this.db = new InMemoryDatabase();
      (this as { inMemory: boolean }).inMemory = true;
      this.initializeSchema();
    }
  }

  private initializeSchema(): void {
    // Schema versioning table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);

    const row = this.db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined;
    const currentVersion = row?.version || 0;
    if (currentVersion < this.SCHEMA_VERSION) {
      this.runMigrations(currentVersion);
    }

    this.db.prepare('INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)').run(
      this.SCHEMA_VERSION,
      new Date().toISOString()
    );
  }

  addAttemptResult(result: {
    attempt_id: string;
    task_id: string;
    config_id: string;
    status: string;
    deliverable?: string;
    error_message?: string;
    wall_time_ms: number;
    cost_usd: number;
  }): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO attempt_results
      (attempt_id, task_id, agent_config_id, status, output, error, duration_ms, cost_usd, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      result.attempt_id, result.task_id, result.config_id, result.status,
      result.deliverable || null, result.error_message || null,
      result.wall_time_ms, result.cost_usd, new Date().toISOString()
    );
  }

  addScoredAttempt(scored: {
    attempt_id: string;
    task_id: string;
    overall_score: number;
    correctness_score?: number;
    efficiency_score?: number;
    completeness_score?: number;
    hard_gates_passed: boolean;
  }): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO scored_attempts
      (attempt_id, task_id, overall_score, correctness_score, efficiency_score, completeness_score, hard_gates_passed, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      scored.attempt_id, scored.task_id, scored.overall_score,
      scored.correctness_score || null, scored.efficiency_score || null,
      scored.completeness_score || null, scored.hard_gates_passed ? 1 : 0,
      new Date().toISOString()
    );
  }

  addTaskRun(run: {
    task_id: string;
    description: string;
    total_attempts: number;
    successful_attempts: number;
    total_cost_usd: number;
    total_duration_ms: number;
    winner_attempt_id?: string;
  }): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO task_runs
      (task_id, description, total_attempts, successful_attempts, total_cost_usd, total_duration_ms, winner_attempt_id, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      run.task_id, run.description, run.total_attempts, run.successful_attempts,
      run.total_cost_usd, run.total_duration_ms, run.winner_attempt_id || null,
      new Date().toISOString()
    );
  }

  addRunArtifacts(run: {
    attempts: Array<Parameters<OrchestratorPersistenceManager['addAttemptResult']>[0]>;
    scoredAttempts: Array<Parameters<OrchestratorPersistenceManager['addScoredAttempt']>[0]>;
    taskRun: Parameters<OrchestratorPersistenceManager['addTaskRun']>[0];
  }): void {
    this.transaction(() => {
      for (const attempt of run.attempts) this.addAttemptResult(attempt);
      for (const scoredAttempt of run.scoredAttempts) this.addScoredAttempt(scoredAttempt);
      this.addTaskRun(run.taskRun);
    });
  }

  getAttemptResults(taskId: string, limit: number = 100): Array<{
    attempt_id: string;
    status: string;
    duration_ms: number;
    cost_usd: number;
    timestamp: string;
  }> {
    return this.db.prepare(`
      SELECT attempt_id, status, duration_ms, cost_usd, timestamp FROM attempt_results
      WHERE task_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(taskId, limit) as Array<{
      attempt_id: string;
      status: string;
      duration_ms: number;
      cost_usd: number;
      timestamp: string;
    }>;
  }

  getScoredAttempts(taskId: string, limit: number = 100): Array<{
    attempt_id: string;
    overall_score: number;
    hard_gates_passed: boolean;
    timestamp: string;
  }> {
    const rows = this.db.prepare(`
      SELECT attempt_id, overall_score, hard_gates_passed, timestamp FROM scored_attempts
      WHERE task_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(taskId, limit) as Array<{
      attempt_id: string;
      overall_score: number;
      hard_gates_passed: number;
      timestamp: string;
    }>;
    return rows.map((r) => ({ ...r, hard_gates_passed: r.hard_gates_passed === 1 }));
  }

  getScoredAttemptsForRegression(limit: number): Array<{
    attempt_id: string;
    overall_score: number;
    correctness_score: number | null;
    efficiency_score: number | null;
    completeness_score: number | null;
    hard_gates_passed: number; // SQLite stores booleans as 0/1
    timestamp: string;
  }> {
    return this.db.prepare(`
      SELECT attempt_id, overall_score, correctness_score, efficiency_score,
             completeness_score, hard_gates_passed, timestamp
      FROM scored_attempts
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as any[];
  }

  getTaskRuns(limit: number = 100): Array<{
    task_id: string;
    description: string;
    total_attempts: number;
    successful_attempts: number;
    total_cost_usd: number;
    timestamp: string;
  }> {
    return this.db.prepare(`
      SELECT task_id, description, total_attempts, successful_attempts, total_cost_usd, timestamp FROM task_runs
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as Array<{
      task_id: string;
      description: string;
      total_attempts: number;
      successful_attempts: number;
      total_cost_usd: number;
      timestamp: string;
    }>;
  }

  cleanupOldData(): void {
    this.transaction(() => {
      this.db.prepare(`DELETE FROM attempt_results WHERE attempt_id NOT IN (SELECT attempt_id FROM attempt_results ORDER BY timestamp DESC LIMIT 1000)`).run();
      this.db.prepare(`DELETE FROM scored_attempts WHERE attempt_id NOT IN (SELECT attempt_id FROM scored_attempts ORDER BY timestamp DESC LIMIT 1000)`).run();
      this.db.prepare(`DELETE FROM task_runs WHERE task_id NOT IN (SELECT task_id FROM task_runs ORDER BY timestamp DESC LIMIT 1000)`).run();
    });
  }

  transaction<T>(operation: () => T): T {
    return this.db.transaction(operation)();
  }

  backup(destinationPath?: string): string {
    fs.mkdirSync(this.backupDir, { recursive: true });
    const isJsonBackup = this.inMemory;
    const ext = isJsonBackup ? 'json' : 'db';
    const backupPath = destinationPath || path.join(
      this.backupDir,
      `gorchestrator-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`
    );
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    if (isJsonBackup) {
      // No native DB file to copy; serialize the in-memory state to JSON so the
      // backup command still produces a usable artifact.
      fs.writeFileSync(backupPath, JSON.stringify(this.exportJson(), null, 2));
    } else {
      this.db.pragma('wal_checkpoint(TRUNCATE)');
      fs.copyFileSync(this.dbPath, backupPath);
    }
    this.rotateBackups();
    return backupPath;
  }

  restore(sourcePath: string): void {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Backup does not exist: ${sourcePath}`);
    }
    if (this.inMemory) {
      // Restore from a JSON backup into the in-memory store.
      this.importJson(JSON.parse(fs.readFileSync(sourcePath, 'utf8')));
      return;
    }
    this.db.close();
    fs.copyFileSync(sourcePath, this.dbPath);
    const Database = require('better-sqlite3');
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initializeSchema();
  }

  exportJson(): Record<string, any> {
    return {
      schema_version: this.SCHEMA_VERSION,
      db_path: this.dbPath,
      exported_at: new Date().toISOString(),
      attempt_results: this.db.prepare('SELECT * FROM attempt_results ORDER BY timestamp DESC').all(),
      scored_attempts: this.db.prepare('SELECT * FROM scored_attempts ORDER BY timestamp DESC').all(),
      task_runs: this.db.prepare('SELECT * FROM task_runs ORDER BY timestamp DESC').all(),
    };
  }

  importJson(data: Record<string, any>): void {
    this.transaction(() => {
      for (const row of data.attempt_results || []) {
        this.db.prepare(`
          INSERT OR REPLACE INTO attempt_results
          (attempt_id, task_id, agent_config_id, status, output, error, duration_ms, cost_usd, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(row.attempt_id, row.task_id, row.agent_config_id, row.status, row.output, row.error, row.duration_ms, row.cost_usd, row.timestamp);
      }
      for (const row of data.scored_attempts || []) {
        this.db.prepare(`
          INSERT OR REPLACE INTO scored_attempts
          (attempt_id, task_id, overall_score, correctness_score, efficiency_score, completeness_score, hard_gates_passed, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(row.attempt_id, row.task_id, row.overall_score, row.correctness_score, row.efficiency_score, row.completeness_score, row.hard_gates_passed, row.timestamp);
      }
      for (const row of data.task_runs || []) {
        this.db.prepare(`
          INSERT OR REPLACE INTO task_runs
          (task_id, description, total_attempts, successful_attempts, total_cost_usd, total_duration_ms, winner_attempt_id, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(row.task_id, row.description, row.total_attempts, row.successful_attempts, row.total_cost_usd, row.total_duration_ms, row.winner_attempt_id, row.timestamp);
      }
    });
  }

  query(sql: string, params: any[] = []): any[] {
    return this.db.prepare(sql).all(...params);
  }

  runMigrations(fromVersion: number): void {
    const migrations = [
      { version: 1, sql: `
        CREATE TABLE IF NOT EXISTS attempt_results (
          attempt_id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          agent_config_id TEXT NOT NULL,
          status TEXT NOT NULL,
          output TEXT,
          error TEXT,
          duration_ms INTEGER NOT NULL,
          cost_usd REAL NOT NULL,
          timestamp TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_attempt_results_task_id ON attempt_results(task_id);
        CREATE TABLE IF NOT EXISTS scored_attempts (
          attempt_id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          overall_score REAL NOT NULL,
          correctness_score REAL,
          efficiency_score REAL,
          completeness_score REAL,
          hard_gates_passed INTEGER NOT NULL,
          timestamp TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_scored_attempts_task_id ON scored_attempts(task_id);
        CREATE TABLE IF NOT EXISTS task_runs (
          task_id TEXT PRIMARY KEY,
          description TEXT NOT NULL,
          total_attempts INTEGER NOT NULL,
          successful_attempts INTEGER NOT NULL,
          total_cost_usd REAL NOT NULL,
          total_duration_ms INTEGER NOT NULL,
          winner_attempt_id TEXT,
          timestamp TEXT NOT NULL
        );
      `},
      { version: 2, sql: `
        -- Migration 002: Add composite indexes for common query patterns
        CREATE INDEX IF NOT EXISTS idx_attempt_results_timestamp ON attempt_results(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_scored_attempts_timestamp ON scored_attempts(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_scored_attempts_overall_score ON scored_attempts(overall_score DESC);
        CREATE INDEX IF NOT EXISTS idx_task_runs_timestamp ON task_runs(timestamp DESC);
      `},
    ];

    for (const migration of migrations) {
      if (migration.version > fromVersion) {
        this.db.exec(migration.sql);
        this.db.prepare('INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
          migration.version,
          `migration_${migration.version.toString().padStart(3, '0')}`,
          new Date().toISOString()
        );
      }
    }
  }

  rotateBackups(): void {
    try {
      if (!fs.existsSync(this.backupDir)) return;
      const backups = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith('gorchestrator-') && f.endsWith('.db'))
        .map(f => ({ name: f, path: path.join(this.backupDir, f), stat: fs.statSync(path.join(this.backupDir, f)) }))
        .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());
      while (backups.length > this.backupRetentionCount) {
        const toDelete = backups.pop();
        if (toDelete) {
          try {
            fs.unlinkSync(toDelete.path);
          } catch {}
        }
      }
    } catch {}
  }

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }

  healthCheck(): { healthy: boolean; error?: string; recordCount?: number } {
    try {
      const attemptCount = this.db.prepare('SELECT COUNT(*) as count FROM attempt_results').get() as { count: number };
      const scoredCount = this.db.prepare('SELECT COUNT(*) as count FROM scored_attempts').get() as { count: number };
      const runCount = this.db.prepare('SELECT COUNT(*) as count FROM task_runs').get() as { count: number };
      return {
        healthy: true,
        recordCount: attemptCount.count + scoredCount.count + runCount.count,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Volatile, dependency-free fallback used when better-sqlite3 cannot be loaded.
 *
 * It is NOT a general SQL engine. It implements only the fixed set of
 * statements OrchestratorPersistenceManager issues, matched by a stable
 * substring of each SQL string. Data lives only for the process lifetime, which
 * is acceptable for the pip-installed bundle where the native engine is absent.
 */
class InMemoryDatabase {
  private tables: {
    schema_version: Array<{ version: number; applied_at: string }>;
    migrations: Array<{ version: number; name: string; applied_at: string }>;
    attempt_results: any[];
    scored_attempts: any[];
    task_runs: any[];
  } = {
    schema_version: [],
    migrations: [],
    attempt_results: [],
    scored_attempts: [],
    task_runs: [],
  };

  pragma(_directive: string): void {
    // No-op: journaling / foreign-key pragmas are meaningless in memory.
  }

  exec(_sql: string): void {
    // DDL (CREATE TABLE/INDEX) is a no-op; tables already exist as arrays.
  }

  transaction<T>(operation: (...args: any[]) => T): (...args: any[]) => T {
    // No real atomicity guarantees, but preserves the call signature.
    return (...args: any[]) => operation(...args);
  }

  close(): void {
    // Nothing to release.
  }

  prepare(sql: string): {
    run: (...params: any[]) => void;
    get: (...params: any[]) => any;
    all: (...params: any[]) => any[];
  } {
    const norm = sql.replace(/\s+/g, ' ').trim();
    const tables = this.tables;

    const upsert = (table: any[], keyField: string, row: Record<string, any>) => {
      const idx = table.findIndex((r) => r[keyField] === row[keyField]);
      if (idx >= 0) table[idx] = row;
      else table.push(row);
    };
    const byTimestampDesc = (rows: any[]) =>
      [...rows].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

    return {
      run: (...params: any[]) => {
        if (norm.includes('INSERT OR REPLACE INTO schema_version')) {
          upsert(tables.schema_version, 'version', { version: params[0], applied_at: params[1] });
        } else if (norm.includes('INSERT INTO migrations')) {
          tables.migrations.push({ version: params[0], name: params[1], applied_at: params[2] });
        } else if (norm.includes('INSERT OR REPLACE INTO attempt_results')) {
          upsert(tables.attempt_results, 'attempt_id', {
            attempt_id: params[0], task_id: params[1], agent_config_id: params[2], status: params[3],
            output: params[4], error: params[5], duration_ms: params[6], cost_usd: params[7], timestamp: params[8],
          });
        } else if (norm.includes('INSERT OR REPLACE INTO scored_attempts')) {
          upsert(tables.scored_attempts, 'attempt_id', {
            attempt_id: params[0], task_id: params[1], overall_score: params[2], correctness_score: params[3],
            efficiency_score: params[4], completeness_score: params[5], hard_gates_passed: params[6], timestamp: params[7],
          });
        } else if (norm.includes('INSERT OR REPLACE INTO task_runs')) {
          upsert(tables.task_runs, 'task_id', {
            task_id: params[0], description: params[1], total_attempts: params[2], successful_attempts: params[3],
            total_cost_usd: params[4], total_duration_ms: params[5], winner_attempt_id: params[6], timestamp: params[7],
          });
        } else if (norm.startsWith('DELETE FROM attempt_results')) {
          tables.attempt_results = byTimestampDesc(tables.attempt_results).slice(0, 1000);
        } else if (norm.startsWith('DELETE FROM scored_attempts')) {
          tables.scored_attempts = byTimestampDesc(tables.scored_attempts).slice(0, 1000);
        } else if (norm.startsWith('DELETE FROM task_runs')) {
          tables.task_runs = byTimestampDesc(tables.task_runs).slice(0, 1000);
        }
      },
      get: (...params: any[]) => {
        if (norm.includes('SELECT version FROM schema_version')) {
          return tables.schema_version.length ? { version: Math.max(...tables.schema_version.map((r) => r.version)) } : undefined;
        }
        if (norm.includes('FROM attempt_results') && norm.includes('COUNT(*)')) return { count: tables.attempt_results.length };
        if (norm.includes('FROM scored_attempts') && norm.includes('COUNT(*)')) return { count: tables.scored_attempts.length };
        if (norm.includes('FROM task_runs') && norm.includes('COUNT(*)')) return { count: tables.task_runs.length };
        return undefined;
      },
      all: (...params: any[]) => {
        if (norm.includes('FROM attempt_results')) {
          let rows = byTimestampDesc(tables.attempt_results);
          if (norm.includes('WHERE task_id = ?')) {
            rows = rows.filter((r) => r.task_id === params[0]);
            const limit = params[1];
            return rows.slice(0, limit).map((r) => ({
              attempt_id: r.attempt_id, status: r.status, duration_ms: r.duration_ms, cost_usd: r.cost_usd, timestamp: r.timestamp,
            }));
          }
          return rows; // SELECT * for export
        }
        if (norm.includes('FROM scored_attempts')) {
          let rows = byTimestampDesc(tables.scored_attempts);
          if (norm.includes('WHERE task_id = ?')) {
            rows = rows.filter((r) => r.task_id === params[0]);
            return rows.slice(0, params[1]).map((r) => ({
              attempt_id: r.attempt_id, overall_score: r.overall_score, hard_gates_passed: r.hard_gates_passed, timestamp: r.timestamp,
            }));
          }
          if (norm.includes('correctness_score')) {
            // getScoredAttemptsForRegression
            return rows.slice(0, params[0]).map((r) => ({
              attempt_id: r.attempt_id, overall_score: r.overall_score, correctness_score: r.correctness_score,
              efficiency_score: r.efficiency_score, completeness_score: r.completeness_score,
              hard_gates_passed: r.hard_gates_passed, timestamp: r.timestamp,
            }));
          }
          return rows; // SELECT * for export
        }
        if (norm.includes('FROM task_runs')) {
          const rows = byTimestampDesc(tables.task_runs);
          if (norm.includes('LIMIT ?')) {
            return rows.slice(0, params[0]).map((r) => ({
              task_id: r.task_id, description: r.description, total_attempts: r.total_attempts,
              successful_attempts: r.successful_attempts, total_cost_usd: r.total_cost_usd, timestamp: r.timestamp,
            }));
          }
          return rows; // SELECT * for export
        }
        return [];
      },
    };
  }
}
