import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createPersistenceEngine } from '../src/core/persistence-engine-factory';
import { OrchestratorPersistenceManager } from '../src/core/orchestrator-persistence';
import { PostgreSQLEngine } from '../src/core/postgres-engine';

describe('GOrchestrator persistence parity', () => {
  it('requires SQLite, runs migrations, exports JSON, and restores backups', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gorchestrator-persistence-'));
    const dbPath = path.join(dir, 'orchestrator.db');
    const manager = new OrchestratorPersistenceManager(dbPath);

    manager.addRunArtifacts({
      attempts: [
        {
          attempt_id: 'attempt-1',
          task_id: 'task-1',
          config_id: 'config-1',
          status: 'completed',
          deliverable: 'result',
          wall_time_ms: 120,
          cost_usd: 0.01,
        },
      ],
      scoredAttempts: [
        {
          attempt_id: 'attempt-1',
          task_id: 'task-1',
          overall_score: 0.91,
          correctness_score: 0.9,
          efficiency_score: 0.8,
          completeness_score: 1,
          hard_gates_passed: true,
        },
      ],
      taskRun: {
        task_id: 'task-1',
        description: 'test task',
        total_attempts: 1,
        successful_attempts: 1,
        total_cost_usd: 0.01,
        total_duration_ms: 120,
        winner_attempt_id: 'attempt-1',
      },
    });

    const backupPath = manager.backup(path.join(dir, 'backup.db'));
    const exported = manager.exportJson();
    expect(exported.schema_version).toBe(2);
    expect(exported.attempt_results).toHaveLength(1);
    expect(exported.scored_attempts).toHaveLength(1);
    expect(exported.task_runs).toHaveLength(1);
    manager.close();

    const restored = new OrchestratorPersistenceManager(path.join(dir, 'restored.db'));
    restored.restore(backupPath);
    expect(restored.getAttemptResults('task-1')[0].attempt_id).toBe('attempt-1');
    expect(restored.getScoredAttempts('task-1')[0].hard_gates_passed).toBe(true);
    expect(restored.getTaskRuns()[0].task_id).toBe('task-1');
    restored.close();

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('wires the Postgres adapter and read-replica configuration through the factory', () => {
    const engine = createPersistenceEngine({
      type: 'postgres',
      connectionString: 'postgresql://writer/gorchestrator',
      readConnectionString: 'postgresql://reader/gorchestrator',
    });
    expect(engine).toBeInstanceOf(PostgreSQLEngine);
  });
});
