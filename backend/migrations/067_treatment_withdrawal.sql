-- 067: treatment and withdrawal - the prescription is the one place a treatment is written (ledger WDR-*).
--
-- The platform is a NEUTRAL tool: it owns and recommends no medicine and ships no medicine list. A vet types the label's
-- treatment days and milk / meat withdrawal days on each prescription line (stored in prescriptions.medications, JSON);
-- the platform only does the date arithmetic. "Under withdrawal" is COMPUTED from prescriptions (and the farmer's own
-- treatments below) - never copied into a second table. The old medical_records.withdrawal_until_* columns had no writer
-- and are left alone, unread.
--
--   * prescriptions.last_dose_on     - the farmer's correction ("stopped early" / "last dose on"); NULL = as prescribed.
--   * self_treatments                - a farmer who treated without a vet: same facts, entered once, same history.
--   * pharmacy_medications           - product kind (medicine / diet / supplement) and OPTIONAL label withdrawal days, for the
--                                      pharmacy's OWN stock items.
--   * pharmacy_line_matches          - a pharmacist links a prescription line's name to their own stock item once; the link
--                                      is remembered for that pharmacy.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS last_dose_on DATE;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS course_corrected_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS self_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  animal_id UUID REFERENCES animals(id) ON DELETE CASCADE,
  group_id UUID REFERENCES animal_groups(id) ON DELETE CASCADE,
  medicine_name VARCHAR(255) NOT NULL,
  treatment_days INT NOT NULL DEFAULT 1 CHECK (treatment_days >= 1 AND treatment_days <= 365),
  withdrawal_milk_days INT NOT NULL DEFAULT 0 CHECK (withdrawal_milk_days >= 0 AND withdrawal_milk_days <= 365),
  withdrawal_meat_days INT NOT NULL DEFAULT 0 CHECK (withdrawal_meat_days >= 0 AND withdrawal_meat_days <= 365),
  started_on DATE NOT NULL DEFAULT CURRENT_DATE,
  last_dose_on DATE,
  note TEXT,
  entered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT self_treatments_subject_ck CHECK ((animal_id IS NOT NULL) <> (group_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_self_treatments_farm ON self_treatments(enterprise_id, started_on DESC);
CREATE INDEX IF NOT EXISTS idx_self_treatments_animal ON self_treatments(animal_id) WHERE animal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_self_treatments_group ON self_treatments(group_id) WHERE group_id IS NOT NULL;

ALTER TABLE pharmacy_medications ADD COLUMN IF NOT EXISTS product_kind VARCHAR(20) NOT NULL DEFAULT 'medicine';
ALTER TABLE pharmacy_medications ADD COLUMN IF NOT EXISTS withdrawal_milk_days INT;
ALTER TABLE pharmacy_medications ADD COLUMN IF NOT EXISTS withdrawal_meat_days INT;
DO $$ BEGIN
  ALTER TABLE pharmacy_medications ADD CONSTRAINT pharmacy_medications_kind_ck CHECK (product_kind IN ('medicine', 'diet', 'supplement'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE pharmacy_medications ADD CONSTRAINT pharmacy_medications_withdrawal_ck CHECK (
    (withdrawal_milk_days IS NULL OR (withdrawal_milk_days >= 0 AND withdrawal_milk_days <= 365))
    AND (withdrawal_meat_days IS NULL OR (withdrawal_meat_days >= 0 AND withdrawal_meat_days <= 365)));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS pharmacy_line_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES hospital_pharmacies(id) ON DELETE CASCADE,
  line_key VARCHAR(255) NOT NULL,
  med_id UUID NOT NULL REFERENCES pharmacy_medications(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pharmacy_id, line_key)
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_line_matches_med ON pharmacy_line_matches(med_id);
