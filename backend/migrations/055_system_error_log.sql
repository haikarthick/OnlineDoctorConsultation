-- Technical errors that were hidden from a user (SQL/stack/library text) or crashed a request.
-- One row per distinct problem (signature), counted, so a daily email digest can say what is new.
CREATE TABLE IF NOT EXISTS system_error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature VARCHAR(64) NOT NULL UNIQUE,
  reference VARCHAR(16) NOT NULL,
  status INTEGER NOT NULL DEFAULT 500,
  method VARCHAR(10),
  path VARCHAR(300),
  message TEXT NOT NULL,
  occurrences INTEGER NOT NULL DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  emailed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_system_error_log_last_seen ON system_error_log (last_seen DESC);
