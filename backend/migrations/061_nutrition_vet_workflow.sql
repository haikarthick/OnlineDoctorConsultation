-- Migration 061: animal nutrition - vet workflow (docs/NUTRITION_PLAN.md, Phase 3)
--
--   * A vet can turn a food plan or ration into a PRESCRIPTION (a therapeutic / prescribed diet). The prescription is
--     an ordinary row in `prescriptions` - the owner, the vet, print and (for network prescriptions) the pharmacy see
--     it where they already see prescriptions. The plan remembers which prescription it became, so it is not
--     prescribed twice and the panel can say "prescribed".
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

ALTER TABLE nutrition_plans ADD COLUMN IF NOT EXISTS prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_prescription ON nutrition_plans(prescription_id) WHERE prescription_id IS NOT NULL;
-- The vet's review queue reads "active plans still suggested"; keep it an index scan for large farms.
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_to_review ON nutrition_plans(animal_id) WHERE status = 'active' AND validation = 'suggested';
