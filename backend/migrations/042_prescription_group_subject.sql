-- Migration 042: batch (flock/herd) - group-subject prescriptions (Phase 5, non-network)
--
-- A veterinarian must be able to prescribe for a whole batch group, not only a single animal.
-- Batch treatment is how flocks and herds are actually medicated, and a prescription is the
-- clinical instrument that carries the withdrawal-time obligations. Before this migration the
-- prescriptions table is single-subject (animal_id only); the group fat-finger would have been
-- the same silent under-reporting gap documented throughout BATCH_ANIMAL_MANAGEMENT_PLAN.md:
-- a prescription written against a group simply could not exist.
--
-- This is DELIBERATELY ADDITIVE and mirrors the subject rule already on the health tables:
--   * group_id/cycle_id go beside animal_id, nullable;
--   * the CHECK enforces "exactly one subject" so nothing becomes orphaned;
--   * head_count_treated is STORED, never derived, so a 5,000-head flock prescription still says
--     5,000 after the flock drops to 4,200 (see the plan's count-drift risk).
--
-- Note: database.ts's startup self-heal already adds prescriptions.group_id (it was added as an
-- enterprise-scoping side effect). That column existing does not create the subject rule or the
-- cycle column, and it was never mirrored into a migration or init.sql - so existing and fresh
-- databases were drifting. This migration plus the init.sql mirror close that drift and add the
-- CHECK.

ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL;
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS head_count_treated INTEGER;

-- Exactly one subject: an animal OR a group, never both, never neither.
DO $$ BEGIN
  ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_subject_ck
    CHECK ((animal_id IS NOT NULL) <> (group_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_prescriptions_group
  ON prescriptions(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prescriptions_cycle
  ON prescriptions(cycle_id) WHERE cycle_id IS NOT NULL;
