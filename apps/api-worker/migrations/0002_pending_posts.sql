-- Pending posts queue for approval workflow
CREATE TABLE IF NOT EXISTS pending_posts (
  id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,

  -- Generated content
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  images TEXT,  -- JSON array of image URLs
  tags TEXT,    -- JSON array of tags

  -- Generation metadata
  generation_mode TEXT NOT NULL CHECK (generation_mode IN ('static', 'ai_topic', 'ai_prompt')),
  generation_prompt TEXT,
  generation_model TEXT,

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'published', 'failed')),
  rejection_reason TEXT,

  -- Timestamps
  generated_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT,
  published_at TEXT,
  publish_result TEXT,  -- JSON with postId or error

  FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pending_posts_status ON pending_posts(status, user_id);
CREATE INDEX IF NOT EXISTS idx_pending_posts_automation ON pending_posts(automation_id);
