import { Pool, PoolClient } from 'pg';
import { DatabaseStats, PersistenceEngine, PersistenceEngineConfig, QueryOptions, QueryResult } from './persistence-engine.js';

/**
 * PostgreSQL adapter for concurrent-writer GOrchestrator deployments.
 *
 * SQLite remains the local default. Use this adapter when multiple workers need
 * a shared durable store, optionally with a read replica for SELECT traffic.
 */
export class PostgreSQLEngine implements PersistenceEngine {
  private pool: Pool | null = null;
  private readPool: Pool | null = null;
  private client: PoolClient | null = null;
  private connectionCount = 0;
  private startTime = Date.now();
  private inTransaction = false;

  constructor(private config: PersistenceEngineConfig) {}

  async initialize(): Promise<void> {
    const connectionString =
      this.config.connectionString ||
      process.env.GORCHESTRATOR_POSTGRES_URL ||
      process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('PostgreSQL connection string is required');
    }

    this.pool = new Pool({
      connectionString,
      max: this.config.maxConnections ?? 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    this.connectionCount++;

    const readConnectionString =
      this.config.readConnectionString ||
      process.env.GORCHESTRATOR_POSTGRES_READ_REPLICA_URL;
    if (readConnectionString && readConnectionString !== connectionString) {
      this.readPool = new Pool({
        connectionString: readConnectionString,
        max: this.config.maxConnections ?? 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      this.connectionCount++;
    }

    await this.migrate();
  }

  async close(): Promise<void> {
    if (this.client) {
      this.client.release();
      this.client = null;
    }
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.connectionCount--;
    }
    if (this.readPool) {
      await this.readPool.end();
      this.readPool = null;
      this.connectionCount--;
    }
  }

  async query<T = unknown>(sql: string, params: unknown[] = [], options?: QueryOptions): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }
    if (options?.transaction && !this.inTransaction) {
      return this.runInTransaction((client) => this.queryWithClient<T>(client, sql, params));
    }
    const pool = this.shouldUseReadPool(sql) ? this.readPool! : this.pool;
    const client = this.client || await pool.connect();
    try {
      return await this.queryWithClient<T>(client, sql, params);
    } finally {
      if (!this.client) client.release();
    }
  }

  async execute(sql: string, params: unknown[] = [], options?: QueryOptions): Promise<number> {
    const result = await this.query(sql, params, options);
    return result.affectedRows;
  }

  async beginTransaction(): Promise<void> {
    if (!this.pool || this.inTransaction) {
      throw new Error('Transaction already in progress or database not initialized');
    }
    this.client = await this.pool.connect();
    await this.client.query('BEGIN');
    this.inTransaction = true;
  }

  async commitTransaction(): Promise<void> {
    if (!this.client || !this.inTransaction) {
      throw new Error('No transaction in progress');
    }
    await this.client.query('COMMIT');
    this.client.release();
    this.client = null;
    this.inTransaction = false;
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.client || !this.inTransaction) {
      throw new Error('No transaction in progress');
    }
    await this.client.query('ROLLBACK');
    this.client.release();
    this.client = null;
    this.inTransaction = false;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async getStats(): Promise<DatabaseStats> {
    const tables = await this.query<{ tablename: string }>(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `);
    const tableSizes: Record<string, number> = {};
    for (const table of tables.rows) {
      const count = await this.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM "${table.tablename}"`);
      tableSizes[table.tablename] = Number(count.rows[0]?.count || 0);
    }
    return {
      totalSize: 0,
      tableSizes,
      connectionCount: this.connectionCount,
      uptime: Date.now() - this.startTime,
    };
  }

  async migrate(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL
      )
    `);
    await this.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL
      )
    `);
    await this.execute(`
      CREATE TABLE IF NOT EXISTS attempt_results (
        attempt_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        agent_config_id TEXT NOT NULL,
        status TEXT NOT NULL,
        output TEXT,
        error TEXT,
        duration_ms INTEGER NOT NULL,
        cost_usd DOUBLE PRECISION NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL
      )
    `);
    await this.execute(`
      CREATE TABLE IF NOT EXISTS scored_attempts (
        attempt_id TEXT PRIMARY KEY REFERENCES attempt_results(attempt_id),
        task_id TEXT NOT NULL,
        overall_score DOUBLE PRECISION NOT NULL,
        correctness_score DOUBLE PRECISION,
        efficiency_score DOUBLE PRECISION,
        completeness_score DOUBLE PRECISION,
        hard_gates_passed BOOLEAN NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL
      )
    `);
    await this.execute(`
      CREATE TABLE IF NOT EXISTS task_runs (
        task_id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        total_attempts INTEGER NOT NULL,
        successful_attempts INTEGER NOT NULL,
        total_cost_usd DOUBLE PRECISION NOT NULL,
        total_duration_ms DOUBLE PRECISION NOT NULL,
        winner_attempt_id TEXT,
        timestamp TIMESTAMPTZ NOT NULL
      )
    `);
    await this.execute(`
      CREATE TABLE IF NOT EXISTS persistence_metadata (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);
    await this.execute('CREATE INDEX IF NOT EXISTS idx_attempt_results_task ON attempt_results(task_id, timestamp)');
    await this.execute('CREATE INDEX IF NOT EXISTS idx_attempt_results_timestamp ON attempt_results(timestamp)');
    await this.execute('CREATE INDEX IF NOT EXISTS idx_scored_attempts_task ON scored_attempts(task_id, timestamp)');
    await this.execute('CREATE INDEX IF NOT EXISTS idx_task_runs_timestamp ON task_runs(timestamp)');
    await this.execute(
      'INSERT INTO migrations (version, name, applied_at) VALUES ($1, $2, NOW()) ON CONFLICT (version) DO NOTHING',
      [1, 'orchestrator_persistence']
    );
    await this.execute(
      'INSERT INTO migrations (version, name, applied_at) VALUES ($1, $2, NOW()) ON CONFLICT (version) DO NOTHING',
      [2, 'persistence_operations']
    );
    await this.execute(
      'INSERT INTO schema_version (version, applied_at) VALUES ($1, NOW()) ON CONFLICT (version) DO UPDATE SET applied_at = EXCLUDED.applied_at',
      [2]
    );
  }

  private shouldUseReadPool(sql: string): boolean {
    return Boolean(this.readPool && !this.inTransaction && /^\s*select\b/i.test(sql));
  }

  private async queryWithClient<T>(client: PoolClient, sql: string, params: unknown[]): Promise<QueryResult<T>> {
    const result = await client.query(sql, params);
    return { rows: result.rows as T[], rowCount: result.rowCount || 0, affectedRows: result.rowCount || 0 };
  }

  private async runInTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) throw new Error('Database not initialized');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
