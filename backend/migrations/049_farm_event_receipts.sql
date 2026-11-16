-- Migration 049: idempotency receipts for farm events (farm plan Phase 6, offline)
--
-- A farmer in a shed saves an entry with no signal; the phone keeps it and sends it later. If the first
-- attempt actually reached the server (and only the answer was lost), the retry must not count a death,
-- a sale or a birth twice. The phone attaches a random key to each entry; the server remembers the answer
-- it gave for (user, key) and returns that same answer for a repeat. Daily records need no receipt: saving
-- the same subject / type / day / session again already corrects the one row.
--
-- Idempotent, and never hardcodes a schema name.

CREATE TABLE IF NOT EXISTS farm_event_receipts (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(80) NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_farm_event_receipts_created ON farm_event_receipts(created_at);
