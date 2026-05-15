import { PersistenceEngine, PersistenceEngineConfig } from './persistence-engine.js';
import { PostgreSQLEngine } from './postgres-engine.js';

export function createPersistenceEngine(config: PersistenceEngineConfig): PersistenceEngine {
  switch (config.type) {
    case 'postgres':
      return new PostgreSQLEngine(config);
    case 'sqlite':
      throw new Error('SQLite is provided by OrchestratorPersistenceManager');
    default: {
      const exhaustive: never = config.type;
      throw new Error(`Unsupported persistence engine: ${exhaustive}`);
    }
  }
}
