import * as path from 'path';
import * as fs from 'fs';

/**
 * SQLite Persistence Manager for GOrchestrator
 *
 * Stores attempt results, scored attempts, and task runs.
 * Persistence is REQUIRED - fails if better-sqlite3 cannot be loaded.
 */
export class OrchestratorPersistenceManager {
  private db: any;
  private dbPath: string;
  private readonly SCHEMA_VERSION = 2;
  private backupDir: string;
  private backupRetentionCount: number;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || process.env.GORCHESTRATOR_DB_PATH || path.join(process.cwd(), '.gorchestrator', 'data', 'orchestrator.db');
    const dataDir = path.dirname(this.dbPath);
    this.backupDir = process.env.GORCHESTRATOR_BACKUP_DIR || path.join(dataDir, 'backups');
    this.backupRetentionCount = Math.max(1, Number(process.env.GORCHESTRATOR_BACKUP_RETENTION || '10'));
    try {
      const Database = require('better-sqlite3');
      fs.mkdirSync(dataDir, { recursive: true });
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      this.initializeSchema();
    } catch (error) {
      throw new Error(`Persistence initialization failed: ${error}. Persistence is REQUIRED for GOrchestrator.`);
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
    const backupPath = destinationPath || path.join(
      this.backupDir,
      `gorchestrator-${new Date().toISOString().replace(/[:.]/g, '-')}.db`
    );
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    this.db.pragma('wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(this.dbPath, backupPath);
    this.rotateBackups();
    return backupPath;
  }

  restore(sourcePath: string): void {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Backup does not exist: ${sourcePath}`);
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
      migrations: this.db.prepare('SELECT * FROM migrations ORDER BY version ASC').all(),
      metadata: this.db.prepare('SELECT * FROM persistence_metadata ORDER BY key ASC').all(),
    };
  }

  close(): void {
    this.db.close();
  }

  getDbPath(): string {
    return this.dbPath;
  }

  private runMigrations(fromVersion: number): void {
    const migrations = this.loadMigrations();
    for (const migration of migrations) {
      if (migration.version <= fromVersion || migration.version > this.SCHEMA_VERSION) {
        continue;
      }
      this.db.transaction(() => {
        this.executeStatements(migration.sql);
        this.db.prepare('INSERT OR REPLACE INTO migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
          migration.version,
          migration.name,
          new Date().toISOString()
        );
      })();
    }
  }

  private loadMigrations(): Array<{ version: number; name: string; sql: string }> {
    const migrationDirCandidates = [
      path.join(__dirname, '../migrations'),
      path.join(process.cwd(), 'migrations'),
      path.join(process.cwd(), '.gorchestrator', 'migrations'),
    ];
    const migrationDir = migrationDirCandidates.find(dir => fs.existsSync(dir));
    if (!migrationDir) {
      return [];
    }
    return fs.readdirSync(migrationDir)
      .filter(file => file.endsWith('.sql'))
      .sort()
      .map(file => ({
        version: Number(file.split('_')[0]),
        name: file.replace(/^\d+_/, '').replace(/\.sql$/, ''),
        sql: fs.readFileSync(path.join(migrationDir, file), 'utf8'),
      }));
  }

  private executeStatements(sql: string): void {
    for (const statement of sql.split(/;\s*(?:\r?\n|$)/)) {
      const trimmed = statement.trim();
      if (trimmed) {
        this.db.exec(trimmed);
      }
    }
  }

  private rotateBackups(): void {
    const backups = fs.readdirSync(this.backupDir)
      .filter(name => /^gorchestrator-.+\.db$/.test(name))
      .map(name => path.join(this.backupDir, name))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    for (const stale of backups.slice(this.backupRetentionCount)) {
      fs.unlinkSync(stale);
    }
  }
}
