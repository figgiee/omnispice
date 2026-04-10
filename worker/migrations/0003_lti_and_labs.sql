-- OmniSpice Phase 4 schema: LTI 1.3 + guided labs
-- Run via: pnpm --filter worker exec wrangler d1 migrations apply omnispice-db --local

-- LTI platform registry (one row per (iss, client_id) tuple)
CREATE TABLE IF NOT EXISTS lti_platforms (
  iss TEXT NOT NULL,
  client_id TEXT NOT NULL,
  deployment_id TEXT,
  name TEXT NOT NULL,
  auth_login_url TEXT NOT NULL,
  auth_token_url TEXT NOT NULL,
  jwks_uri TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (iss, client_id)
);
CREATE INDEX IF NOT EXISTS idx_lti_platforms_iss ON lti_platforms(iss);

-- Deployment IDs per platform (a platform may have many)
CREATE TABLE IF NOT EXISTS lti_deployments (
  iss TEXT NOT NULL,
  client_id TEXT NOT NULL,
  deployment_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (iss, client_id, deployment_id),
  FOREIGN KEY (iss, client_id) REFERENCES lti_platforms(iss, client_id) ON DELETE CASCADE
);

-- Single-use nonce store with TTL (prevents replay).
-- Also used to stash OIDC state between /lti/oidc/login and /lti/launch via a 'state:' key prefix
-- (documented interim shortcut — flagged for a dedicated lti_oidc_states table in Phase 5).
CREATE TABLE IF NOT EXISTS lti_nonces (
  nonce TEXT PRIMARY KEY,
  iss TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lti_nonces_expires ON lti_nonces(expires_at);

-- Launch audit log + foreign key target for downstream tables
CREATE TABLE IF NOT EXISTS lti_launches (
  id TEXT PRIMARY KEY,
  iss TEXT NOT NULL,
  client_id TEXT NOT NULL,
  deployment_id TEXT,
  sub TEXT NOT NULL,
  clerk_user_id TEXT NOT NULL,
  message_type TEXT NOT NULL,
  resource_link_id TEXT,
  context_id TEXT,
  raw_claims TEXT NOT NULL,
  ags_lineitem_url TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lti_launches_clerk_user ON lti_launches(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_lti_launches_sub_iss ON lti_launches(sub, iss);

-- Line items per OmniSpice assignment (created at deep-link time)
CREATE TABLE IF NOT EXISTS lti_line_items (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  iss TEXT NOT NULL,
  client_id TEXT NOT NULL,
  lineitem_url TEXT NOT NULL,
  score_maximum REAL NOT NULL,
  label TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_lti_line_items_assignment ON lti_line_items(assignment_id);

-- Cached AGS bearer tokens (client_credentials grant results)
CREATE TABLE IF NOT EXISTS lti_platform_tokens (
  iss TEXT NOT NULL,
  client_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (iss, client_id, scope)
);

-- Score passback retry log (drained by the Cron trigger declared in wrangler.toml)
CREATE TABLE IF NOT EXISTS lti_score_log (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  lineitem_url TEXT NOT NULL,
  iss TEXT NOT NULL,
  client_id TEXT NOT NULL,
  user_sub TEXT NOT NULL,
  score_given REAL NOT NULL,
  score_maximum REAL NOT NULL,
  status TEXT NOT NULL,                 -- 'pending' | 'ok' | 'failed'
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lti_score_log_pending ON lti_score_log(status, next_attempt_at);

-- Guided labs
CREATE TABLE IF NOT EXISTS labs (
  id TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL,
  course_id TEXT,
  title TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  lab_json_r2_key TEXT NOT NULL,
  reference_circuit_r2_key TEXT,
  reference_waveform_keys TEXT NOT NULL DEFAULT '{}',   -- JSON map probe->r2 key
  total_weight REAL NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_labs_instructor ON labs(instructor_id);

CREATE TABLE IF NOT EXISTS lab_attempts (
  id TEXT PRIMARY KEY,
  lab_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  submitted_at INTEGER,
  score REAL,
  lti_launch_id TEXT,
  FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE,
  FOREIGN KEY (lti_launch_id) REFERENCES lti_launches(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_lab_attempts_lab ON lab_attempts(lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_attempts_student ON lab_attempts(student_id);

CREATE TABLE IF NOT EXISTS lab_checkpoint_results (
  attempt_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  status TEXT NOT NULL,                 -- 'pass' | 'partial' | 'fail'
  weight REAL NOT NULL,
  evaluated_at INTEGER NOT NULL,
  PRIMARY KEY (attempt_id, step_id, checkpoint_id),
  FOREIGN KEY (attempt_id) REFERENCES lab_attempts(id) ON DELETE CASCADE
);

-- Phase 3 submissions table gains an optional LTI launch pointer for grade passback
ALTER TABLE submissions ADD COLUMN lti_launch_id TEXT REFERENCES lti_launches(id);
CREATE INDEX IF NOT EXISTS idx_submissions_lti_launch ON submissions(lti_launch_id);
