-- Migration 025: per-locale label overrides on master_species
--
-- Follow-up to 024_species_label_key.sql. That migration solved translation for
-- the ~51 pre-seeded species via a static labelKey -> speciesNames.<code> i18n
-- lookup, but admin-added species have no way to get a labelKey (the admin form
-- never exposed one, and even if it did, a labelKey only resolves if a developer
-- has since added matching entries to all 6 locale JSON files and redeployed).
--
-- Adds one nullable label column per non-English locale so an admin can type all
-- 6 language labels directly when creating/editing a species — no code deploy
-- needed, ever, for species added after today. Existing pre-seeded species are
-- untouched (columns stay NULL) and keep resolving via their labelKey exactly as
-- before; the frontend speciesLabel() resolver checks these row-level columns
-- first and only falls back to the labelKey/i18n-key path when they're empty.

ALTER TABLE master_species
  ADD COLUMN IF NOT EXISTS label_hi VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_kn VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_ml VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_ta VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_te VARCHAR(150);
