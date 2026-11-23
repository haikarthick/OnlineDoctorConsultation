-- Migration 065: "neutered" can be UNANSWERED (docs/modules/nutrition-ledger.md NUT-195)
--
-- animals.is_neutered defaulted to false, so a pet whose owner never answered looked exactly like one that is NOT neutered,
-- and a dog's food was worked out as if intact (+12.5% energy) with nobody ever asked. NULL now means "not answered":
--   * the column has no default; the animal form asks yes / no and leaves it empty until answered;
--   * existing pets (dogs, cats and other companion species) with "no" are set back to unanswered ONCE, so the Nutrition
--     panel asks the owner a single question the next time it is opened. Their answer is then kept.
-- Farm animals keep what they have: nothing about their feeding depends on it.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

ALTER TABLE animals ALTER COLUMN is_neutered DROP DEFAULT;
UPDATE animals a SET is_neutered = NULL, updated_at = NOW()
  FROM master_species ms
 WHERE ms.code = a.species AND ms.nutrition_model IN ('companion_energy', 'guidance_only') AND a.is_neutered = false;
