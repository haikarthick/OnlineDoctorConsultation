-- Migration 045: farm daily records (farm plan Phase 4)
--
-- docs/FARM_MANAGEMENT_PLAN.md section 9, Phase 4. One table for the things a farmer writes down
-- every day - milk, eggs, feed, sample weights, water readings - for ONE animal or for a WHOLE
-- GROUP (the farmer chooses, plan D5). Which record applies to which subject is decided by
-- master_record_types + rules (migration 043), not here.
--
-- Design points:
--   * subject is an animal XOR a group (CHECK), and always sits on a farm (enterprise_id) so every
--     read can be tenant-scoped with one join.
--   * one row per subject / record type / date / session (unique index). A double tap or a
--     retried request updates the row instead of adding a second one; the previous values are
--     kept in farm_daily_record_edits so a correction is never silent.
--   * quantity + unit carry the headline number (litres, eggs, kg); anything else the record type
--     asks for (egg breakage, water-quality readings) lives in detail JSONB, keyed as the
--     record type's `fields` say.
--   * deaths are NOT stored here: a death changes a group's head count, so it goes through the
--     population ledger (group_population_events) that already owns that number.
--   * dark-launched behind system setting farm.records.enabled (default false).
--
-- Idempotent, and never hardcodes a schema name.

CREATE TABLE IF NOT EXISTS farm_daily_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  animal_id UUID REFERENCES animals(id) ON DELETE CASCADE,
  group_id UUID REFERENCES animal_groups(id) ON DELETE CASCADE,
  cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL,
  record_type VARCHAR(40) NOT NULL REFERENCES master_record_types(code),
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  session VARCHAR(10) NOT NULL DEFAULT 'day',
  quantity NUMERIC(12,3),
  unit VARCHAR(20),
  detail JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT farm_daily_records_subject_ck CHECK ((animal_id IS NOT NULL) <> (group_id IS NOT NULL)),
  CONSTRAINT farm_daily_records_session_ck CHECK (session IN ('am', 'pm', 'day')),
  CONSTRAINT farm_daily_records_quantity_ck CHECK (quantity IS NULL OR quantity >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_farm_daily_records_slot
  ON farm_daily_records ((COALESCE(animal_id, group_id)), record_type, record_date, session);
CREATE INDEX IF NOT EXISTS idx_farm_daily_records_farm_date ON farm_daily_records(enterprise_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_farm_daily_records_animal ON farm_daily_records(animal_id, record_date DESC) WHERE animal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_farm_daily_records_group ON farm_daily_records(group_id, record_date DESC) WHERE group_id IS NOT NULL;

-- Who changed what. record_id is deliberately not a foreign key so the history of a deleted
-- record survives it.
CREATE TABLE IF NOT EXISTS farm_daily_record_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  action VARCHAR(10) NOT NULL,
  previous JSONB NOT NULL,
  edited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT farm_daily_record_edits_action_ck CHECK (action IN ('update', 'delete'))
);
CREATE INDEX IF NOT EXISTS idx_farm_daily_record_edits_record ON farm_daily_record_edits(record_id, edited_at DESC);

INSERT INTO system_settings (key, value, category, description)
VALUES ('farm.records.enabled', 'false', 'farm',
        'Master switch for farm daily records (milk, eggs, feed, sample weight, water quality). Dark-launch flag, default off.')
ON CONFLICT (key) DO NOTHING;
