-- Migration 041: batch (flock/herd) animal management - Phase 1 foundation
--
-- A poultry group could not be given a medical record or a vaccination: every health table is
-- keyed to a single animal_id, and all four Herd Medical forms require one. The owner's
-- requirement is explicit - a 5,000-bird flock must NOT produce 5,000 individual rows.
--
-- See docs/BATCH_ANIMAL_MANAGEMENT_PLAN.md for the full analysis. This migration lays the
-- foundation and is deliberately ADDITIVE: every existing row and query keeps working, because
-- animal-subject records are untouched and the new columns are nullable.
--
-- Five things land here:
--   1. Management mode - a GROUP is individual or batch. Species only supplies the default,
--      because a smallholder with 5 goats and an enterprise with 5,000 broilers are the same
--      species managed differently.
--   2. Production cycles - a batch group is a SHED; the population inside it is a CYCLE.
--      Poultry places 5,000 day-olds, clears at ~42 days and places a new flock under the same
--      group name. Without a cycle the previous flock's health history silently becomes the new
--      flock's history, which is wrong for traceability and for network patient identity.
--   3. One population ledger - mortality is not the only thing that moves a headcount.
--      Placement, hatch, cull, sale and transfers do too. Everything goes through one table so
--      current_count is always explainable, and it is never edited directly.
--   4. Group-subject health records - group_id/cycle_id beside animal_id, with a CHECK that
--      exactly one subject is set. One row per event, never a fan-out.
--   5. Withdrawal periods - antibiotics are in scope, so milk/meat withdrawal ships WITH batch
--      treatment. Treating a flock without tracking withdrawal would be a food-safety
--      regression even though it is a usability improvement.
--
-- Lifetime history: an animal promoted out of a batch must carry that history. This does NOT
-- copy rows down (that is the fan-out we are avoiding). animal_group_memberships records which
-- cycle an animal belonged to and when, so its full history is composed at read time from its
-- own records PLUS the group records that applied during its membership window.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. MANAGEMENT MODE
-- ─────────────────────────────────────────────────────────────────────────────

-- Species suggests; the group decides. Defaults to 'individual' so nothing silently becomes a
-- batch - same conservative-default reasoning as is_marketplace_eligible.
ALTER TABLE master_species
  ADD COLUMN IF NOT EXISTS default_management_mode VARCHAR(20) NOT NULL DEFAULT 'individual';

DO $$ BEGIN
  ALTER TABLE master_species ADD CONSTRAINT master_species_mgmt_mode_ck
    CHECK (default_management_mode IN ('individual', 'batch'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Poultry is batch by default. Note has_ear_tag is ALREADY false for exactly these four, which
-- is the same underlying fact (not individually identified) expressed for tagging.
UPDATE master_species SET default_management_mode = 'batch'
 WHERE code IN ('Chicken', 'Duck', 'Turkey', 'Quail');

ALTER TABLE animal_groups
  ADD COLUMN IF NOT EXISTS management_mode VARCHAR(20) NOT NULL DEFAULT 'individual';

DO $$ BEGIN
  ALTER TABLE animal_groups ADD CONSTRAINT animal_groups_mgmt_mode_ck
    CHECK (management_mode IN ('individual', 'batch'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PRODUCTION CYCLES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES animal_groups(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  name VARCHAR(150),
  species VARCHAR(100),
  breed VARCHAR(100),
  placed_count INTEGER NOT NULL DEFAULT 0,
  current_count INTEGER NOT NULL DEFAULT 0,
  started_at DATE NOT NULL DEFAULT CURRENT_DATE,
  ended_at DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed')),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (group_id, cycle_number),
  CHECK (current_count >= 0),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_group_cycles_group ON group_cycles(group_id);
-- One active cycle per group: a shed holds one population at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_cycles_one_active
  ON group_cycles(group_id) WHERE status = 'active';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. POPULATION LEDGER
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_population_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES animal_groups(id) ON DELETE CASCADE,
  cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL,
  event_type VARCHAR(20) NOT NULL
    CHECK (event_type IN ('placement', 'hatch', 'mortality', 'cull', 'sale',
                          'transfer_in', 'transfer_out', 'promotion', 'adjustment')),
  -- Signed: +ve adds to the population, -ve removes. 'adjustment' may be either, which is why
  -- this is not a magnitude plus a direction flag.
  quantity INTEGER NOT NULL,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  -- Free-form pointer to whatever caused this (a movement_record, a sale, an animal promoted
  -- out of the batch). Deliberately not an FK: the sources live in several tables.
  source_ref VARCHAR(100),
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (quantity <> 0)
);

CREATE INDEX IF NOT EXISTS idx_group_pop_events_group ON group_population_events(group_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_group_pop_events_cycle ON group_population_events(cycle_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. MEMBERSHIP - how a promoted animal keeps its batch history
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS animal_group_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES animal_groups(id) ON DELETE CASCADE,
  cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL,
  joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
  left_at DATE,
  -- Why the animal stopped being part of the batch population.
  exit_reason VARCHAR(30)
    CHECK (exit_reason IS NULL OR exit_reason IN ('promoted', 'sold', 'died', 'transferred', 'cycle_closed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (left_at IS NULL OR left_at >= joined_at)
);

CREATE INDEX IF NOT EXISTS idx_animal_group_memberships_animal ON animal_group_memberships(animal_id);
CREATE INDEX IF NOT EXISTS idx_animal_group_memberships_cycle ON animal_group_memberships(cycle_id);

-- Where an individually-tracked animal came from, when it was promoted out of a batch.
ALTER TABLE animals ADD COLUMN IF NOT EXISTS origin_group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS origin_cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. GROUP-SUBJECT HEALTH RECORDS
-- ─────────────────────────────────────────────────────────────────────────────

-- vaccination_records.animal_id and allergy_records.animal_id are NOT NULL today. They must be
-- relaxed to make room for a group subject; the CHECK added below keeps "neither set"
-- impossible, so nothing becomes orphaned.
ALTER TABLE vaccination_records ALTER COLUMN animal_id DROP NOT NULL;
ALTER TABLE allergy_records     ALTER COLUMN animal_id DROP NOT NULL;

ALTER TABLE medical_records     ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
ALTER TABLE medical_records     ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL;
ALTER TABLE vaccination_records ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
ALTER TABLE vaccination_records ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL;
ALTER TABLE allergy_records     ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
ALTER TABLE allergy_records     ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL;
ALTER TABLE lab_results         ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
ALTER TABLE lab_results         ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL;
ALTER TABLE vet_certificates    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
ALTER TABLE vet_certificates    ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL;

-- Exactly one subject. Without this, relaxing the NOT NULLs above would allow a record that
-- belongs to nothing at all.
DO $$ BEGIN
  ALTER TABLE medical_records ADD CONSTRAINT medical_records_subject_ck
    CHECK ((animal_id IS NOT NULL) <> (group_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE vaccination_records ADD CONSTRAINT vaccination_records_subject_ck
    CHECK ((animal_id IS NOT NULL) <> (group_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE allergy_records ADD CONSTRAINT allergy_records_subject_ck
    CHECK ((animal_id IS NOT NULL) <> (group_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- lab_results and vet_certificates allow a NULL animal_id today (a lab result may pre-date
-- identification; a certificate may cover a consignment), so they get the weaker rule: not
-- both, rather than exactly one.
DO $$ BEGIN
  ALTER TABLE lab_results ADD CONSTRAINT lab_results_subject_ck
    CHECK (NOT (animal_id IS NOT NULL AND group_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE vet_certificates ADD CONSTRAINT vet_certificates_subject_ck
    CHECK (NOT (animal_id IS NOT NULL AND group_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- When the event actually happened, as opposed to when the row was typed. medical_records has
-- only created_at today, which is not good enough here: a treatment is often recorded after the
-- fact, and lifetime history for an animal promoted out of a batch is resolved by asking which
-- group records fall inside its membership window. Matching on created_at would attribute a
-- back-dated treatment to the wrong window - or to no window at all.
-- vaccination_records already has date_administered; this gives medical_records the equivalent.
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS event_date DATE;
UPDATE medical_records SET event_date = created_at::date WHERE event_date IS NULL;
ALTER TABLE medical_records ALTER COLUMN event_date SET DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_medical_records_event_date ON medical_records(event_date);

-- Batch facts. An individual record answers "what happened to this animal"; a batch record must
-- also answer "how much of the group". head_count_treated is STORED, never derived, so a record
-- citing 5,000 head still says 5,000 after the flock drops to 4,200.
ALTER TABLE medical_records     ADD COLUMN IF NOT EXISTS head_count_treated INTEGER;
ALTER TABLE medical_records     ADD COLUMN IF NOT EXISTS affected_count INTEGER;
ALTER TABLE medical_records     ADD COLUMN IF NOT EXISTS mortality_count INTEGER;
ALTER TABLE vaccination_records ADD COLUMN IF NOT EXISTS head_count_treated INTEGER;

-- Traces a record back to the campaign that produced it (Phase 3 wires this up).
ALTER TABLE medical_records     ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES treatment_campaigns(id) ON DELETE SET NULL;
ALTER TABLE vaccination_records ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES treatment_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_medical_records_group ON medical_records(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vaccination_records_group ON vaccination_records(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lab_results_group ON lab_results(group_id) WHERE group_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. WITHDRAWAL PERIODS (food safety - milk and meat)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE pharmacy_medications ADD COLUMN IF NOT EXISTS withdrawal_days_milk INTEGER;
ALTER TABLE pharmacy_medications ADD COLUMN IF NOT EXISTS withdrawal_days_meat INTEGER;

-- Computed on save as treatment_date + withdrawal_days and stored, so the obligation survives
-- the medication master later being edited.
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS withdrawal_until_milk DATE;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS withdrawal_until_meat DATE;

-- Answers "is this subject under withdrawal right now" without scanning every record.
CREATE INDEX IF NOT EXISTS idx_medical_records_withdrawal_group
  ON medical_records(group_id, withdrawal_until_meat, withdrawal_until_milk)
  WHERE group_id IS NOT NULL AND (withdrawal_until_meat IS NOT NULL OR withdrawal_until_milk IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_medical_records_withdrawal_animal
  ON medical_records(animal_id, withdrawal_until_meat, withdrawal_until_milk)
  WHERE animal_id IS NOT NULL AND (withdrawal_until_meat IS NOT NULL OR withdrawal_until_milk IS NOT NULL);
