export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
  affectedRows: number;
}

export interface QueryOptions {
  transaction?: boolean;
}

export interface PersistenceEngineConfig {
  type: 'sqlite' | 'postgres';
  connectionString?: string;
  readConnectionString?: string;
  maxConnections?: number;
}

export interface DatabaseStats {
  totalSize: number;
  tableSizes: Record<string, number>;
  connectionCount: number;
  uptime: number;
}

export interface PersistenceEngine {
  initialize(): Promise<void>;
  close(): Promise<void>;
  query<T = unknown>(sql: string, params?: unknown[], options?: QueryOptions): Promise<QueryResult<T>>;
  execute(sql: string, params?: unknown[], options?: QueryOptions): Promise<number>;
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
  healthCheck(): Promise<boolean>;
  getStats(): Promise<DatabaseStats>;
  migrate(): Promise<void>;
}
