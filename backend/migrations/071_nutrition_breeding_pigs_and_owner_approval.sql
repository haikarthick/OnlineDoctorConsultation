-- 071: breeding-pig feeding figures, and every nutrition seed row set to go live (animal nutrition).
--
-- 1. Sows and boars. The pig guide had one flat figure for every pig over 220 days (2.8 kg), which under-feeds a nursing sow.
--    A group of group type 'sows' or 'boars' now picks its own curve (the feed query prefers a curve that names the group type).
--    Figures (kg of a corn-soybean diet at 3,300 kcal ME/kg, per head per day):
--      gestating sow  2.3 kg - NRC Nutrient Requirements of Swine (2012): 2.1-2.2 kg for the first 90 days of gestation, 2.5-2.6 kg
--                     for the last 25 days (MSD/Merck Veterinary Manual, "Feeding levels and practices in pigs"; PMC3113826 tables)
--      boar           2.7 kg - extension guidance: a mature boar on the sow gestation feed, about 6 lb/day
--    A nursing sow eats far more (NRC: 6.0-6.6 kg for a sow nursing 11-11.5 piglets over 21 days, more with a bigger litter), so the
--    sow band carries the caution 'sow_nursing_more' and the screen says so in the farmer's language. Editable by admin
--    (Nutrition data), like every other row.
--
-- 2. The owner decided (2026-11-25) that all seed data is approved to go live and is maintained from the Admin console.
--    Every row still 'unvalidated' becomes 'owner_approved' (NOT 'vet_validated'; the screens still say a vet has not signed it).
--    Doing it here, for every nutrition table with a status column, also stops migration 058 flipping later rows when migrations are replayed.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

INSERT INTO nutrition_feeding_curves
  (curve_key, title, nutrition_model, species_codes, group_types, basis, product, age_from_days, age_to_days, grams_per_head_day, feeds_per_day, feed_type, source, status, caution_key)
VALUES
  ('pig_sow', 'Sows', 'monogastric_spec', '{Pig}', '{sows}', 'per_head', 'meat', 0, 9000, 2300, 2, 'gestating sow',
   'NRC Nutrient Requirements of Swine 2012 (via MSD Veterinary Manual): gestating sow 2.1-2.6 kg/day', 'owner_approved', 'sow_nursing_more'),
  ('pig_boar', 'Boars', 'monogastric_spec', '{Pig}', '{boars}', 'per_head', 'meat', 0, 9000, 2700, 2, 'boar',
   'Extension guidance: mature boar fed the sow gestation diet, about 6 lb (2.7 kg) per day', 'owner_approved', NULL)
ON CONFLICT DO NOTHING;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
     WHERE c.table_schema = current_schema() AND c.column_name = 'status' AND c.table_name LIKE 'nutrition\_%'
  LOOP
    EXECUTE format('UPDATE %I SET status = ''owner_approved'' WHERE status = ''unvalidated''', t);
  END LOOP;
END $$;
