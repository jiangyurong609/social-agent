-- Runs table (minimal MVP)
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  graph TEXT NOT NULL,
  input TEXT NOT NULL,
  outputs TEXT,
  trace TEXT,
  pending_approval TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS runs_status_idx ON runs(status);

-- Pending actions for extension / executors (MVP)
CREATE TABLE IF NOT EXISTS pending_actions (
  request_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS pending_actions_user_idx ON pending_actions(user_id);

-- Action results from executors/extension
CREATE TABLE IF NOT EXISTS action_results (
  request_id TEXT PRIMARY KEY,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
