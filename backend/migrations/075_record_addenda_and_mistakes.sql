-- 075: a saved medical record is never silently edited (owner decision, delegated 2026-11-25; ledger ORPH-049..052).
--
--   * medical_record_addenda   - a correction is a NEW dated note attached to the record: who wrote it, their role, when.
--                                The record itself is never overwritten; everyone who can see the record sees its notes.
--   * vaccination_records / allergy_records .entered_by_mistake_* - an entry that was wrong is marked "entered by mistake"
--                                (reason required; who and when kept). It stays in the history but is left out of the passport,
--                                compliance counts, due reminders and certificates. Never hard-deleted.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

CREATE TABLE IF NOT EXISTS medical_record_addenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name VARCHAR(255),
  author_role VARCHAR(40),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_medical_record_addenda_record ON medical_record_addenda(record_id, created_at);

ALTER TABLE vaccination_records ADD COLUMN IF NOT EXISTS entered_by_mistake_at TIMESTAMPTZ;
ALTER TABLE vaccination_records ADD COLUMN IF NOT EXISTS entered_by_mistake_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE vaccination_records ADD COLUMN IF NOT EXISTS entered_by_mistake_by_name VARCHAR(255);
ALTER TABLE vaccination_records ADD COLUMN IF NOT EXISTS entered_by_mistake_reason TEXT;

ALTER TABLE allergy_records ADD COLUMN IF NOT EXISTS entered_by_mistake_at TIMESTAMPTZ;
ALTER TABLE allergy_records ADD COLUMN IF NOT EXISTS entered_by_mistake_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE allergy_records ADD COLUMN IF NOT EXISTS entered_by_mistake_by_name VARCHAR(255);
ALTER TABLE allergy_records ADD COLUMN IF NOT EXISTS entered_by_mistake_reason TEXT;
