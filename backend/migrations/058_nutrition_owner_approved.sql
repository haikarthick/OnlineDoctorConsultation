-- Migration 058: nutrition reference data - "approved by the platform owner, vet review pending"
--
-- Owner decision 2026-11-22: approve every nutrition reference record for use now; the vet review follows later.
-- A separate status keeps that honest: 'owner_approved' means approved for use, NOT checked by a vet. Screens stop
-- warning end users, and the vet can still find each row and move it to 'vet_validated'.
-- Applies to energy factors, requirement sets, foods/feeds and unsafe foods. Plan reviews (nutrition_plans.validation)
-- are per-animal vet decisions and are NOT changed here.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

ALTER TABLE nutrition_energy_factors DROP CONSTRAINT IF EXISTS nutrition_energy_factors_status_check;
ALTER TABLE nutrition_requirement_sets DROP CONSTRAINT IF EXISTS nutrition_requirement_sets_status_check;
ALTER TABLE nutrition_ingredients DROP CONSTRAINT IF EXISTS nutrition_ingredients_status_check;
ALTER TABLE nutrition_unsafe_foods DROP CONSTRAINT IF EXISTS nutrition_unsafe_foods_status_check;

DO $$ BEGIN
  ALTER TABLE nutrition_energy_factors ADD CONSTRAINT nutrition_energy_factors_status_check
    CHECK (status IN ('unvalidated', 'owner_approved', 'vet_validated', 'retired'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE nutrition_requirement_sets ADD CONSTRAINT nutrition_requirement_sets_status_check
    CHECK (status IN ('unvalidated', 'owner_approved', 'vet_validated', 'retired'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE nutrition_ingredients ADD CONSTRAINT nutrition_ingredients_status_check
    CHECK (status IN ('unvalidated', 'owner_approved', 'vet_validated', 'retired'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE nutrition_unsafe_foods ADD CONSTRAINT nutrition_unsafe_foods_status_check
    CHECK (status IN ('unvalidated', 'owner_approved', 'vet_validated', 'retired'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Every shared reference row still awaiting review -> approved by the owner (vet review pending).
-- Private foods a pet owner or farm typed from their own label are theirs and are left alone.
UPDATE nutrition_energy_factors   SET status = 'owner_approved', updated_at = NOW() WHERE status = 'unvalidated';
UPDATE nutrition_requirement_sets SET status = 'owner_approved', updated_at = NOW() WHERE status = 'unvalidated';
UPDATE nutrition_unsafe_foods     SET status = 'owner_approved', updated_at = NOW() WHERE status = 'unvalidated';
UPDATE nutrition_ingredients      SET status = 'owner_approved', updated_at = NOW()
 WHERE status = 'unvalidated' AND owner_id IS NULL AND enterprise_id IS NULL;
