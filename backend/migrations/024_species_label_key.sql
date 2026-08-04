-- Migration 024: translatable species names
--
-- master_species had no label_key mechanism (unlike master_marketplace_categories/
-- conditions, which already support label_key + label with the same resolveLabel()
-- fallback pattern used on the frontend). Every place in the app that displays a
-- species name (Animals.tsx, Marketplace/PublicMarketplace filters and facets,
-- HospitalWorkflow walk-in, VaccinationPassport) rendered the raw English `code`/`label`
-- directly - species names never translated into any of the 6 locales, regardless of
-- the user's selected language. Reported via screenshot: PublicMarketplace's species
-- filter showing "Buffalo" untranslated while every other control around it was in Tamil.
--
-- Adds label_key, mirroring master_marketplace_categories exactly, then backfills a
-- deterministic key (speciesNames.<snake_case code>) for every existing species so the
-- new i18n block (added to all 6 locale files) resolves immediately with no admin action
-- needed. A future admin-added species with no matching translation key falls back to
-- its own `label` column, same as categories/conditions already do.

ALTER TABLE master_species ADD COLUMN IF NOT EXISTS label_key VARCHAR(150);

UPDATE master_species
SET label_key = 'speciesNames.' || lower(regexp_replace(code, '[^a-zA-Z0-9]+', '_', 'g'))
WHERE label_key IS NULL;
