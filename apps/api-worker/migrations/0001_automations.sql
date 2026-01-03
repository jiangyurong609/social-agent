-- Automations table for scheduled tasks
CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('scheduled_post', 'auto_engage', 'content_discovery')),
  config TEXT NOT NULL,  -- JSON config
  cron_expression TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled')),
  last_run_at TEXT,
  next_run_at TEXT,
  run_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_automations_next_run ON automations(next_run_at, status);
CREATE INDEX IF NOT EXISTS idx_automations_user ON automations(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_automations_status ON automations(status);

-- Automation run history
CREATE TABLE IF NOT EXISTS automation_runs (
  id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  actions_count INTEGER DEFAULT 0,
  error TEXT,
  result TEXT,  -- JSON result summary
  FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_automation ON automation_runs(automation_id, started_at DESC);

-- Daily usage tracking for rate limiting
CREATE TABLE IF NOT EXISTS automation_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,  -- YYYY-MM-DD
  comments_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_automation_usage_user_date ON automation_usage(user_id, date);
