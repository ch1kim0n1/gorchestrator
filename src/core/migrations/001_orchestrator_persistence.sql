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
);

CREATE TABLE IF NOT EXISTS task_runs (
  task_id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  total_attempts INTEGER NOT NULL,
  successful_attempts INTEGER NOT NULL,
  total_cost_usd REAL NOT NULL,
  total_duration_ms REAL NOT NULL,
  winner_attempt_id TEXT,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attempt_results_task ON attempt_results(task_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_attempt_results_timestamp ON attempt_results(timestamp);
CREATE INDEX IF NOT EXISTS idx_scored_attempts_task ON scored_attempts(task_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_task_runs_timestamp ON task_runs(timestamp);
