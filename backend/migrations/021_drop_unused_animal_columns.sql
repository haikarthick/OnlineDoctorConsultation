-- 021_drop_unused_animal_columns.sql
-- Pre-production cleanup: acquisition_date, acquisition_source, and
-- production_type on `animals` have zero reads/writes anywhere in the
-- codebase (confirmed via repo-wide grep) — dead weight from an earlier,
-- unimplemented design. No production data exists yet, so dropping is
-- safe. A future feature needing "how/when an animal was acquired" or a
-- dairy/beef/draft production-type designation should define fresh,
-- precisely-named columns for its actual requirements rather than
-- resurrecting these — see [[animal-class-terminology-2026-07-22]] memory
-- for why `production_type` was deliberately NOT reused for the recently
-- added `animal_class` column (different concept, would've been a naming
-- trap either way).

ALTER TABLE animals DROP COLUMN IF EXISTS acquisition_date;
ALTER TABLE animals DROP COLUMN IF EXISTS acquisition_source;
ALTER TABLE animals DROP COLUMN IF EXISTS production_type;
