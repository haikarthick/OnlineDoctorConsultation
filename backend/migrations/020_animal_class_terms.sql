-- 020_animal_class_terms.sql
-- Species-correct sex/reproductive class terms (Bull/Cow/Bullock, Ram/Ewe/
-- Wether, etc.) instead of generic Male/Female. Additive-only column on both
-- tables; the existing gender column/enum is untouched (animal_class values
-- are species-prefixed, e.g. 'cattle_bull', 'buffalo_cow' — see
-- frontend/src/constants/speciesBreeds.ts ANIMAL_CLASS_TERMS for the full
-- glossary and derivation rules).

ALTER TABLE animals ADD COLUMN IF NOT EXISTS animal_class VARCHAR(30);
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS animal_class VARCHAR(30);
