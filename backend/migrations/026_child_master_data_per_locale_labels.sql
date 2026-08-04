-- Migration 026: per-locale label overrides on the remaining master-data tables
--
-- Follow-up to 025_species_per_locale_labels.sql, which added label_hi..label_te
-- to master_species only. That left an inconsistency: an admin editing a species
-- (parent) could translate it into all 6 languages, but its breeds and animal
-- classes (children), plus marketplace categories/conditions, could not be
-- translated at all - an admin-added breed/class/category/condition showed the
-- same single label in every language.
--
-- This adds the same 5 nullable per-locale columns to all four remaining tables so
-- the whole Master Data screen is consistent. As with species:
--   * Existing pre-seeded rows are untouched (columns stay NULL) and keep resolving
--     via their labelKey (animal classes / categories / conditions) or their `name`
--     (breeds) exactly as before.
--   * The frontend resolver checks these row-level columns first (for the current
--     locale) and only falls back to the labelKey/i18n path or the English label/name
--     when they're empty.
-- For master_breeds the per-locale columns translate `name` (breeds have no labelKey);
-- the canonical English `name` remains the stored/value column - only display is localized.

ALTER TABLE master_breeds
  ADD COLUMN IF NOT EXISTS label_hi VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_kn VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_ml VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_ta VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_te VARCHAR(150);

ALTER TABLE master_animal_classes
  ADD COLUMN IF NOT EXISTS label_hi VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_kn VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_ml VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_ta VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_te VARCHAR(150);

ALTER TABLE master_marketplace_categories
  ADD COLUMN IF NOT EXISTS label_hi VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_kn VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_ml VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_ta VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_te VARCHAR(150);

ALTER TABLE master_marketplace_conditions
  ADD COLUMN IF NOT EXISTS label_hi VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_kn VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_ml VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_ta VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_te VARCHAR(150);
