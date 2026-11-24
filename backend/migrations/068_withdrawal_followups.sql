-- 068: withdrawal follow-ups (ledger WDR-*): the vet's course start, a log of every "record anyway", and the dead columns removed.
--
--   * prescriptions.course_start_on  - the day the course starts when the vet says so ("start tomorrow", "started yesterday");
--                                      NULL = the prescription date, as before.
--   * withdrawal_overrides           - one row each time a person confirms a withdrawal warning ("record anyway"): who, when,
--                                      what was withheld, until when, because of which medicine, and what they were doing.
--                                      Kept when the animal or person is later removed (the links go NULL, the facts stay).
--   * DROPPED, nothing read or wrote them: medical_records.withdrawal_until_milk / _meat (+ their two indexes, migration 041)
--     and pharmacy_medications.withdrawal_days_milk / _meat (migration 041) and withdrawal_period_days (added by a seed script).
--     Migration 067 added the one pair in use, withdrawal_milk_days / withdrawal_meat_days; three copies of one fact is
--     exactly the duplicate this removes.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS course_start_on DATE;

CREATE TABLE IF NOT EXISTS withdrawal_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL,
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL,
  action VARCHAR(30) NOT NULL,
  withheld VARCHAR(10) NOT NULL CHECK (withheld IN ('milk', 'meat')),
  until_date DATE NOT NULL,
  medicine VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_withdrawal_overrides_animal ON withdrawal_overrides(animal_id, created_at DESC) WHERE animal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_withdrawal_overrides_group ON withdrawal_overrides(group_id, created_at DESC) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_withdrawal_overrides_farm ON withdrawal_overrides(enterprise_id, created_at DESC) WHERE enterprise_id IS NOT NULL;

DROP INDEX IF EXISTS idx_medical_records_withdrawal_group;
DROP INDEX IF EXISTS idx_medical_records_withdrawal_animal;
ALTER TABLE medical_records DROP COLUMN IF EXISTS withdrawal_until_milk;
ALTER TABLE medical_records DROP COLUMN IF EXISTS withdrawal_until_meat;
ALTER TABLE pharmacy_medications DROP COLUMN IF EXISTS withdrawal_days_milk;
ALTER TABLE pharmacy_medications DROP COLUMN IF EXISTS withdrawal_days_meat;
-- A third copy, added only by a seed script: the catalogue form showed it but no route ever saved it.
ALTER TABLE pharmacy_medications DROP COLUMN IF EXISTS withdrawal_period_days;
