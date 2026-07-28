-- Cached, queryable snapshots for the property discussion discovery service.
CREATE TABLE IF NOT EXISTS property_discussion_snapshots (
  id TEXT PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  request_json TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_property_discussion_snapshots_expiry
  ON property_discussion_snapshots(expires_at);
