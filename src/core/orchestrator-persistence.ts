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
  private readonly SCHEMA_VERSION = 1;

  constructor(dbPath?: string) {
    const dataDir = dbPath || path.join(process.cwd(), '.gorchestrator', 'data');
    this.dbPath = path.join(dataDir, 'orchestrator.db');
    try {
      const Database = require('better-sqlite3');
      fs.mkdirSync(dataDir, { recursive: true });
      this.db = new Database(this.dbPath);
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

    // Check current schema version
    const row = this.db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined;
    const currentVersion = row?.version || 0;

    if (currentVersion < this.SCHEMA_VERSION) {
      this.runMigrations(currentVersion);
    }

    this.db.exec(`
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
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scored_attempts (
        attempt_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        overall_score REAL NOT NULL,
        correctness_score REAL,
        efficiency_score REAL,
        completeness_score REAL,
        hard_gates_passed INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (attempt_id) REFERENCES attempt_results(attempt_id)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_runs (
        task_id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        total_attempts INTEGER NOT NULL,
        successful_attempts INTEGER NOT NULL,
        total_cost_usd REAL NOT NULL,
        total_duration_ms REAL NOT NULL,
        winner_attempt_id TEXT,
        timestamp TEXT NOT NULL
      )
    `);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_attempt_results_task ON attempt_results(task_id, timestamp)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_attempt_results_timestamp ON attempt_results(timestamp)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_scored_attempts_task ON scored_attempts(task_id, timestamp)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_task_runs_timestamp ON task_runs(timestamp)`);

    // Update schema version
    this.db.prepare('INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)').run(
      this.SCHEMA_VERSION,
      new Date().toISOString()
    );
  }

  private runMigrations(fromVersion: number): void {
    // Migration framework - add future migrations here
    for (let v = fromVersion + 1; v <= this.SCHEMA_VERSION; v++) {
      console.log(`[OrchestratorPersistenceManager] Running migration to version ${v}`);
      // Add migration logic here when needed
    }
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
    this.db.prepare(`DELETE FROM attempt_results WHERE attempt_id NOT IN (SELECT attempt_id FROM attempt_results ORDER BY timestamp DESC LIMIT 1000)`).run();
    this.db.prepare(`DELETE FROM scored_attempts WHERE attempt_id NOT IN (SELECT attempt_id FROM scored_attempts ORDER BY timestamp DESC LIMIT 1000)`).run();
    this.db.prepare(`DELETE FROM task_runs WHERE task_id NOT IN (SELECT task_id FROM task_runs ORDER BY timestamp DESC LIMIT 1000)`).run();
  }

  close(): void {
    this.db.close();
  }

  getDbPath(): string {
    return this.dbPath;
  }
}
