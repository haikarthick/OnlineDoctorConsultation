-- Migration 060: animal nutrition - horses, ponies, donkeys, mules (docs/NUTRITION_PLAN.md, Phase 2, model equine_dm)
--
-- Same tables as every other model (no new table):
--   * nutrition_requirements gains basis 'per_kg_bw' (horse energy and minerals scale with body weight, not BW^0.75).
--   * starting requirement sets: horse (also used for ponies and mules) and donkey (donkeys need about three
--     quarters of a horse's energy for their weight and eat less). Method: engine/equineRation.ts.
--   * equine feeds: grass hay, green grass, lucerne hay, oats, horse gram (kulthi), Bengal gram (chana); and the
--     existing berseem, wheat bran, maize grain and mineral mixture gain horse energy (DE) values.
--   * unsafe for horses / donkeys: cattle or poultry feed with ionophores (monensin, lasalocid) and urea.
-- Every row starts 'owner_approved' (owner decision 2026-11-22: approved for use now, the vet confirms later).
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

ALTER TABLE nutrition_requirements DROP CONSTRAINT IF EXISTS nutrition_requirements_basis_check;
DO $$ BEGIN
  ALTER TABLE nutrition_requirements ADD CONSTRAINT nutrition_requirements_basis_check
    CHECK (basis IN ('per_1000kcal', 'per_kg_dm', 'percent_dm', 'per_day', 'per_kg_bw075', 'percent_bw', 'fraction', 'percent_milk', 'per_kg_bw', 'per_kg_gain', 'age_months'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Mules and ponies (when an admin adds them as species) follow the horse; donkeys are mapped by 056.
UPDATE master_species SET nutrition_model = 'equine_dm'
 WHERE nutrition_model = 'guidance_only' AND code IN ('Horse', 'Donkey', 'Mule', 'Pony');

INSERT INTO nutrition_requirement_sets (code, nutrition_model, species_code, life_stage, title, source, licence, status) VALUES
  ('equine_horse_maintenance',  'equine_dm', NULL,     'maintenance', 'Horses, ponies, mules (starting values)',
   'NRC 2007 Nutrient Requirements of Horses - method (DE per kg body weight, work as a multiple of maintenance); common field targets', 'cited reference', 'owner_approved'),
  ('equine_donkey_maintenance', 'equine_dm', 'Donkey', 'maintenance', 'Donkeys (starting values)',
   'Donkey energy about 75% of a horse of the same weight (The Donkey Sanctuary feeding guidance); common field targets', 'cited reference', 'owner_approved')
ON CONFLICT (code) DO NOTHING;

INSERT INTO nutrition_requirements (set_id, nutrient, basis, min_value, max_value, unit, notes)
SELECT s.id, v.nutrient, v.basis, v.min_value, v.max_value, v.unit, v.notes
  FROM nutrition_requirement_sets s
  JOIN (VALUES
    ('equine_horse_maintenance',  'de_maintenance', 'per_kg_bw',    0.0333, NULL, 'Mcal', 'NRC 2007 average maintenance'),
    ('equine_horse_maintenance',  'work_low',       'fraction',     1.0,    NULL, 'x maintenance', 'light use / resting'),
    ('equine_horse_maintenance',  'work_moderate',  'fraction',     1.2,    NULL, 'x maintenance', 'light work'),
    ('equine_horse_maintenance',  'work_high',      'fraction',     1.4,    NULL, 'x maintenance', 'moderate work'),
    ('equine_horse_maintenance',  'work_working',   'fraction',     1.6,    NULL, 'x maintenance', 'heavy work (cart, plough, long rides)'),
    ('equine_horse_maintenance',  'cp',             'per_1000kcal', 38,     NULL, 'g', 'g crude protein per Mcal DE'),
    ('equine_horse_maintenance',  'ca',             'per_kg_bw',    0.04,   NULL, 'g', NULL),
    ('equine_horse_maintenance',  'p',              'per_kg_bw',    0.028,  NULL, 'g', NULL),
    ('equine_horse_maintenance',  'dmi',            'percent_bw',   1.5,    2.5,  '%', NULL),
    ('equine_horse_maintenance',  'forage',         'percent_bw',   1.0,    NULL, '%', 'gut health - forage first'),
    ('equine_horse_maintenance',  'concentrate',    'percent_dm',   NULL,   50,   '%', 'colic / laminitis limit'),
    ('equine_donkey_maintenance', 'de_maintenance', 'per_kg_bw',    0.025,  NULL, 'Mcal', 'about 75% of a horse'),
    ('equine_donkey_maintenance', 'work_low',       'fraction',     1.0,    NULL, 'x maintenance', NULL),
    ('equine_donkey_maintenance', 'work_moderate',  'fraction',     1.2,    NULL, 'x maintenance', NULL),
    ('equine_donkey_maintenance', 'work_high',      'fraction',     1.4,    NULL, 'x maintenance', NULL),
    ('equine_donkey_maintenance', 'work_working',   'fraction',     1.6,    NULL, 'x maintenance', 'pack / cart work'),
    ('equine_donkey_maintenance', 'cp',             'per_1000kcal', 38,     NULL, 'g', 'g crude protein per Mcal DE'),
    ('equine_donkey_maintenance', 'ca',             'per_kg_bw',    0.04,   NULL, 'g', NULL),
    ('equine_donkey_maintenance', 'p',              'per_kg_bw',    0.028,  NULL, 'g', NULL),
    ('equine_donkey_maintenance', 'dmi',            'percent_bw',   1.3,    1.8,  '%', 'donkeys eat less than horses'),
    ('equine_donkey_maintenance', 'forage',         'percent_bw',   1.0,    NULL, '%', 'mostly straw / hay'),
    ('equine_donkey_maintenance', 'concentrate',    'percent_dm',   NULL,   25,   '%', 'donkeys rarely need grain')
  ) AS v(code, nutrient, basis, min_value, max_value, unit, notes) ON v.code = s.code
ON CONFLICT (set_id, nutrient, basis) DO NOTHING;

-- composition keys used by the horse ration: dm_pct, de_mcal_kg_dm, cp_pct_dm, ca_pct_dm, p_pct_dm, is_forage
INSERT INTO nutrition_ingredients (code, label, label_key, kind, models, dry_matter_pct, composition, source, licence, status) VALUES
  ('feed_grass_hay',   'Grass hay (dry grass)',    'nutrition.foods.feed_grass_hay',   'forage',      '{equine_dm,ruminant_dm}', 88, '{"dm_pct":88,"de_mcal_kg_dm":2.0,"nel_mcal_kg_dm":1.05,"cp_pct_dm":8,"ca_pct_dm":0.45,"p_pct_dm":0.22,"ndf_pct_dm":65,"is_forage":1}', 'Typical values, feed composition literature', 'typical values', 'owner_approved'),
  ('feed_green_grass', 'Green grass (doob / hariyali)', 'nutrition.foods.feed_green_grass', 'forage', '{equine_dm,ruminant_dm}', 25, '{"dm_pct":25,"de_mcal_kg_dm":2.2,"nel_mcal_kg_dm":1.20,"cp_pct_dm":10,"ca_pct_dm":0.50,"p_pct_dm":0.28,"ndf_pct_dm":60,"is_forage":1}', 'Typical values, feed composition literature', 'typical values', 'owner_approved'),
  ('feed_lucerne_hay', 'Lucerne (alfalfa) hay',    'nutrition.foods.feed_lucerne_hay', 'forage',      '{equine_dm,ruminant_dm}', 90, '{"dm_pct":90,"de_mcal_kg_dm":2.3,"nel_mcal_kg_dm":1.30,"cp_pct_dm":18,"ca_pct_dm":1.40,"p_pct_dm":0.25,"ndf_pct_dm":45,"is_forage":1}', 'Typical values, feed composition literature', 'typical values', 'owner_approved'),
  ('feed_oats',        'Oats (whole or crushed)',  'nutrition.foods.feed_oats',        'concentrate', '{equine_dm,ruminant_dm}', 89, '{"dm_pct":89,"de_mcal_kg_dm":3.2,"nel_mcal_kg_dm":1.75,"cp_pct_dm":12.5,"ca_pct_dm":0.09,"p_pct_dm":0.38,"ndf_pct_dm":30,"is_forage":0}', 'Typical values, feed composition literature', 'typical values', 'owner_approved'),
  ('feed_horse_gram',  'Horse gram (kulthi), soaked or boiled', 'nutrition.foods.feed_horse_gram', 'concentrate', '{equine_dm}', 90, '{"dm_pct":90,"de_mcal_kg_dm":3.3,"cp_pct_dm":24,"ca_pct_dm":0.30,"p_pct_dm":0.40,"is_forage":0}', 'Typical values, Indian feed composition literature', 'typical values', 'owner_approved'),
  ('feed_bengal_gram', 'Bengal gram (chana), crushed', 'nutrition.foods.feed_bengal_gram', 'concentrate', '{equine_dm}', 90, '{"dm_pct":90,"de_mcal_kg_dm":3.5,"cp_pct_dm":21,"ca_pct_dm":0.20,"p_pct_dm":0.35,"is_forage":0}', 'Typical values, Indian feed composition literature', 'typical values', 'owner_approved')
ON CONFLICT (code) DO NOTHING;

-- Feeds a horse can share with cattle: add the horse energy value and list them for horses too.
UPDATE nutrition_ingredients i
   SET composition = i.composition || jsonb_build_object('de_mcal_kg_dm', v.de),
       models = CASE WHEN 'equine_dm' = ANY(i.models) THEN i.models ELSE i.models || ARRAY['equine_dm'] END,
       updated_at = NOW()
  FROM (VALUES ('feed_berseem', 2.4), ('feed_wheat_bran', 3.0), ('feed_maize_grain', 3.85), ('feed_mineral_mixture', 0.0))
       AS v(code, de)
 WHERE i.code = v.code AND NOT (i.composition ? 'de_mcal_kg_dm');

INSERT INTO nutrition_unsafe_foods (code, species_code, label, label_key, match_terms, severity, source, status) VALUES
  ('ionophore', 'Horse',  'Cattle or poultry feed with monensin / lasalocid', 'nutrition.unsafe.ionophore', '{monensin,lasalocid,salinomycin,ionophore,rumensin,poultry feed,cattle feed}', 'danger', 'Merck Veterinary Manual - ionophore toxicosis in horses', 'owner_approved'),
  ('urea',      'Horse',  'Urea or feed with urea',  'nutrition.unsafe.urea',      '{urea,umms,urea molasses}', 'danger', 'Merck Veterinary Manual - non-protein nitrogen', 'owner_approved'),
  ('ionophore', 'Donkey', 'Cattle or poultry feed with monensin / lasalocid', 'nutrition.unsafe.ionophore', '{monensin,lasalocid,salinomycin,ionophore,rumensin,poultry feed,cattle feed}', 'danger', 'Merck Veterinary Manual - ionophore toxicosis in horses', 'owner_approved'),
  ('urea',      'Donkey', 'Urea or feed with urea',  'nutrition.unsafe.urea',      '{urea,umms,urea molasses}', 'danger', 'Merck Veterinary Manual - non-protein nitrogen', 'owner_approved')
ON CONFLICT (species_code, code) DO NOTHING;
