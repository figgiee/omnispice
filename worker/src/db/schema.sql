-- OmniSpice D1 schema
-- Run via: wrangler d1 migrations apply omnispice-db --local

CREATE TABLE IF NOT EXISTS circuits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Circuit',
  description TEXT,
  share_token TEXT UNIQUE,
  r2_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_circuits_user_id ON circuits(user_id);
CREATE INDEX IF NOT EXISTS idx_circuits_share_token ON circuits(share_token);
