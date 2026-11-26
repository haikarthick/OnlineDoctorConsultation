-- 073: users.sessions_revoked_at - when an admin signs a person out everywhere, every access token issued before this moment stops working
-- (the access token is valid for 24h and nothing else can end it). Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.
ALTER TABLE users ADD COLUMN IF NOT EXISTS sessions_revoked_at TIMESTAMPTZ;
