-- Migration 044: animal production fields + one breeding-status vocabulary (farm plan Phase 3)
--
-- docs/FARM_MANAGEMENT_PLAN.md section 9, Phase 3. Two things land here.
--
-- 1. The production facts a vet needs to dose and advise (plan section 4.2 "cross-module"):
--    average daily milk, number of births (parity), last birth date, dry-off date. Pregnancy
--    stays in the EXISTING breeding_status column rather than a second column - two sources of
--    truth for "is she pregnant" is exactly what this migration removes (see 2).
--    lactation_number is deliberately NOT added: for a milking animal it equals parity, and a
--    stored copy would drift. Screens that need a lactation number show parity.
--    birth_weight already exists (init.sql, migration 003); only the app now reads and writes it.
--
-- 2. breeding_status had THREE vocabularies writing to one column:
--      animal form / detail screen : not_bred, pregnant, not_pregnant
--      BreedingService (breeding records) wrote the record's status straight onto the animal:
--                                    bred, confirmed_pregnant, delivered->open, aborted, reabsorbed
--      marketplace sell prefill    : pregnant, bred, lactating, open
--    so logging a breeding record left an animal whose status the animal screens had no
--    translation for (a raw "animalClass.bred" key on screen). The single vocabulary is now
--      not_bred | bred | pregnant | not_pregnant
--    with the record->animal mapping in backend/src/utils/breedingStatus.ts. This migration
--    converts existing rows and adds a CHECK so a new writer cannot reintroduce a fourth.
--
-- Idempotent and additive; mirrored into docker/init.sql (section 62).

-- 1. production fields
ALTER TABLE animals ADD COLUMN IF NOT EXISTS avg_daily_milk_litres DECIMAL(5,2);
ALTER TABLE animals ADD COLUMN IF NOT EXISTS parity INTEGER;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS last_birth_date DATE;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS dry_off_date DATE;

DO $$ BEGIN
  ALTER TABLE animals ADD CONSTRAINT animals_avg_milk_ck
    CHECK (avg_daily_milk_litres IS NULL OR (avg_daily_milk_litres >= 0 AND avg_daily_milk_litres <= 200));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE animals ADD CONSTRAINT animals_parity_ck
    CHECK (parity IS NULL OR (parity >= 0 AND parity <= 40));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. one breeding-status vocabulary
UPDATE animals SET breeding_status = CASE breeding_status
    WHEN 'confirmed_pregnant' THEN 'pregnant'
    WHEN 'confirmed'          THEN 'pregnant'
    WHEN 'open'               THEN 'not_bred'
    WHEN 'delivered'          THEN 'not_bred'
    WHEN 'aborted'            THEN 'not_bred'
    WHEN 'reabsorbed'         THEN 'not_bred'
    WHEN 'lactating'          THEN 'not_bred'
    ELSE breeding_status END
 WHERE breeding_status IN ('confirmed_pregnant', 'confirmed', 'open', 'delivered', 'aborted', 'reabsorbed', 'lactating');

-- Anything still outside the vocabulary (free text from an old client) carries no usable meaning.
UPDATE animals SET breeding_status = NULL
 WHERE breeding_status IS NOT NULL
   AND breeding_status NOT IN ('not_bred', 'bred', 'pregnant', 'not_pregnant');

DO $$ BEGIN
  ALTER TABLE animals ADD CONSTRAINT animals_breeding_status_ck
    CHECK (breeding_status IS NULL OR breeding_status IN ('not_bred', 'bred', 'pregnant', 'not_pregnant'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. backfill births from the breeding records that already say a delivery happened, so animals
--    that have calved before this migration do not show "0 births". Only fills a blank.
UPDATE animals a SET parity = b.births
  FROM (SELECT dam_id, COUNT(*) AS births FROM breeding_records
         WHERE status = 'delivered' AND dam_id IS NOT NULL GROUP BY dam_id) b
 WHERE a.id = b.dam_id AND a.parity IS NULL;

UPDATE animals a SET last_birth_date = b.last_birth
  FROM (SELECT dam_id, MAX(actual_birth_date) AS last_birth FROM breeding_records
         WHERE status = 'delivered' AND dam_id IS NOT NULL AND actual_birth_date IS NOT NULL GROUP BY dam_id) b
 WHERE a.id = b.dam_id AND a.last_birth_date IS NULL;
