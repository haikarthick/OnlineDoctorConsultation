-- Migration 064: animal nutrition - safety corrections from the domain review (docs/modules/nutrition-ledger.md SAFETY rows)
--
-- Owner decision 2026-11-23: do not wait for the vet - load corrected starting values now as 'owner_approved'; the vet
-- confirms later in Admin -> Nutrition data. Every value below is data with its source; the engine holds the method.
--   NUT-190  goat / sheep energy was an ME figure used as NEL (~50-60% too high) -> NEL; own goat, sheep, camel, yak sets;
--            deer, llama, alpaca have no checked data -> guidance only.
--   NUT-057  growing young stock get a GROWING set (maintenance + gain allowance, higher protein); the age a ration may
--            start (weaning) and adult age are data; first lactation needs +20% maintenance.
--   NUT-198  mineral mixture gets a fixed daily allowance.
--   NUT-191  sheep: cattle mineral mixture / cattle feed carry copper -> unsafe; a low-copper mineral for sheep & goats.
--   NUT-202  unsafe-food lists for farm species and every pet bird; local-language match words.
--   NUT-201  groundnut cake: aflatoxin caution.
--   NUT-192  shrimp rates corrected, freshwater prawn (scampi) its own table, expected survival per size band.
--   NUT-193  a batch's age at placement (pullets at 18 weeks are not day-old chicks).
--   NUT-204  horses: lactating mare and late-pregnancy allowances; rations start at 24 months.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

-- ─── Bases the new rows need (057 and 060 re-add this CHECK with the same full list: a fresh install runs init.sql
--     and then every migration) ───
ALTER TABLE nutrition_requirements DROP CONSTRAINT IF EXISTS nutrition_requirements_basis_check;
DO $$ BEGIN
  ALTER TABLE nutrition_requirements ADD CONSTRAINT nutrition_requirements_basis_check
    CHECK (basis IN ('per_1000kcal', 'per_kg_dm', 'percent_dm', 'per_day', 'per_kg_bw075', 'percent_bw', 'fraction', 'percent_milk', 'per_kg_bw',
                     'per_kg_gain', 'age_months'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── NUT-190: NEL, not ME, for the general small-ruminant sets ───
UPDATE nutrition_requirements q SET min_value = 0.063, notes = 'NEL (NRC 2007 small ruminants: ME ~0.101 x 0.62); was an ME figure'
  FROM nutrition_requirement_sets s
 WHERE q.set_id = s.id AND s.code IN ('ruminant_small_lactating', 'ruminant_small_dry') AND q.nutrient = 'nel_maintenance' AND q.min_value = 0.10;

-- Exotic ruminants with no checked data: safe foods, weight and condition only (until a vet loads data for them).
UPDATE master_species SET nutrition_model = 'guidance_only' WHERE code IN ('Deer', 'Llama', 'Alpaca') AND nutrition_model = 'ruminant_dm';

INSERT INTO nutrition_requirement_sets (code, nutrition_model, species_code, life_stage, title, source, licence, status) VALUES
  ('ruminant_goat_lactating',   'ruminant_dm', 'Goat',    'lactating', 'Goats - in milk (starting values)',    'NRC 2007 small ruminants (energy as NEL); common field targets', 'cited reference', 'owner_approved'),
  ('ruminant_goat_dry',         'ruminant_dm', 'Goat',    'dry',       'Goats - dry / not in milk (starting values)', 'NRC 2007 small ruminants (energy as NEL); common field targets', 'cited reference', 'owner_approved'),
  ('ruminant_goat_growing',     'ruminant_dm', 'Goat',    'growing',   'Goats - growing kids (starting values)', 'NRC 2007 small ruminants; growth allowance per kg gain', 'cited reference', 'owner_approved'),
  ('ruminant_sheep_lactating',  'ruminant_dm', 'Sheep',   'lactating', 'Sheep - in milk (starting values)',   'NRC 2007 small ruminants (energy as NEL); sheep milk composition', 'cited reference', 'owner_approved'),
  ('ruminant_sheep_dry',        'ruminant_dm', 'Sheep',   'dry',       'Sheep - dry / not in milk (starting values)', 'NRC 2007 small ruminants (energy as NEL)', 'cited reference', 'owner_approved'),
  ('ruminant_sheep_growing',    'ruminant_dm', 'Sheep',   'growing',   'Sheep - growing lambs (starting values)', 'NRC 2007 small ruminants; growth allowance per kg gain', 'cited reference', 'owner_approved'),
  ('ruminant_camel_lactating',  'ruminant_dm', 'Camel',   'lactating', 'Camels - in milk (starting values)',  'Camel feeding literature (NRCC Bikaner field targets); energy as NEL', 'cited reference', 'owner_approved'),
  ('ruminant_camel_dry',        'ruminant_dm', 'Camel',   'dry',       'Camels - dry / working (starting values)', 'Camel feeding literature (NRCC Bikaner field targets); energy as NEL', 'cited reference', 'owner_approved'),
  ('ruminant_camel_growing',    'ruminant_dm', 'Camel',   'growing',   'Camels - growing calves (starting values)', 'Camel feeding literature; growth allowance per kg gain', 'cited reference', 'owner_approved'),
  ('ruminant_cattle_growing',   'ruminant_dm', 'Cattle',  'growing',   'Cattle - growing calves and heifers (starting values)', 'NRC 2001 heifer targets; growth allowance per kg gain', 'cited reference', 'owner_approved'),
  ('ruminant_buffalo_growing',  'ruminant_dm', 'Buffalo', 'growing',   'Buffalo - growing calves and heifers (starting values)', 'NRC 2001 heifer targets applied to buffalo; growth allowance per kg gain', 'cited reference', 'owner_approved'),
  ('ruminant_small_growing',    'ruminant_dm', NULL,      'growing',   'Small ruminants - growing (starting values)', 'NRC 2007 small ruminants; growth allowance per kg gain', 'cited reference', 'owner_approved'),
  ('ruminant_yak_lactating',    'ruminant_dm', 'Yak',     'lactating', 'Yak - in milk (cattle starting values)', 'Cattle values (NRC 2001) applied to yak until yak data are loaded', 'cited reference', 'owner_approved'),
  ('ruminant_yak_dry',          'ruminant_dm', 'Yak',     'dry',       'Yak - dry (cattle starting values)', 'Cattle values (NRC 2001) applied to yak until yak data are loaded', 'cited reference', 'owner_approved'),
  ('ruminant_yak_growing',      'ruminant_dm', 'Yak',     'growing',   'Yak - growing (cattle starting values)', 'Cattle values applied to yak until yak data are loaded', 'cited reference', 'owner_approved')
ON CONFLICT (code) DO NOTHING;

INSERT INTO nutrition_requirements (set_id, nutrient, basis, min_value, max_value, unit, notes)
SELECT s.id, v.nutrient, v.basis, v.min_value, v.max_value, v.unit, v.notes
  FROM nutrition_requirement_sets s
  JOIN (VALUES
    -- goats
    ('ruminant_goat_lactating', 'nel_maintenance', 'per_kg_bw075', 0.063, NULL, 'Mcal', 'NEL'),
    ('ruminant_goat_lactating', 'late_pregnancy',  'fraction',     0.30, NULL, 'x maintenance', NULL),
    ('ruminant_goat_lactating', 'dmi',             'percent_bw',   3.0,  5.0,  '%', NULL),
    ('ruminant_goat_lactating', 'cp',              'percent_dm',   14,   NULL, '%', NULL),
    ('ruminant_goat_lactating', 'ca',              'percent_dm',   0.6,  NULL, '%', NULL),
    ('ruminant_goat_lactating', 'p',               'percent_dm',   0.35, NULL, '%', NULL),
    ('ruminant_goat_lactating', 'ndf',             'percent_dm',   30,   NULL, '%', NULL),
    ('ruminant_goat_lactating', 'forage',          'percent_dm',   50,   NULL, '%', NULL),
    ('ruminant_goat_lactating', 'milk_fat',        'percent_milk', 4.5,  NULL, '%', NULL),
    ('ruminant_goat_lactating', 'milk_protein',    'percent_milk', 3.4,  NULL, '%', NULL),
    ('ruminant_goat_lactating', 'milk_lactose',    'percent_milk', 4.4,  NULL, '%', NULL),
    ('ruminant_goat_dry',       'nel_maintenance', 'per_kg_bw075', 0.063, NULL, 'Mcal', 'NEL'),
    ('ruminant_goat_dry',       'late_pregnancy',  'fraction',     0.30, NULL, 'x maintenance', NULL),
    ('ruminant_goat_dry',       'dmi',             'percent_bw',   2.5,  3.5,  '%', NULL),
    ('ruminant_goat_dry',       'cp',              'percent_dm',   10,   NULL, '%', NULL),
    ('ruminant_goat_dry',       'ca',              'percent_dm',   0.4,  NULL, '%', NULL),
    ('ruminant_goat_dry',       'p',               'percent_dm',   0.25, NULL, '%', NULL),
    ('ruminant_goat_dry',       'ndf',             'percent_dm',   35,   NULL, '%', NULL),
    ('ruminant_goat_dry',       'forage',          'percent_dm',   60,   NULL, '%', NULL),
    ('ruminant_goat_growing',   'nel_maintenance', 'per_kg_bw075', 0.063, NULL, 'Mcal', 'NEL'),
    ('ruminant_goat_growing',   'dmi',             'percent_bw',   3.0,  4.5,  '%', NULL),
    ('ruminant_goat_growing',   'cp',              'percent_dm',   15,   NULL, '%', NULL),
    ('ruminant_goat_growing',   'ca',              'percent_dm',   0.6,  NULL, '%', NULL),
    ('ruminant_goat_growing',   'p',               'percent_dm',   0.35, NULL, '%', NULL),
    ('ruminant_goat_growing',   'ndf',             'percent_dm',   30,   NULL, '%', NULL),
    ('ruminant_goat_growing',   'forage',          'percent_dm',   50,   NULL, '%', NULL),
    ('ruminant_goat_growing',   'target_adg',      'per_day',      0.08, NULL, 'kg', 'target daily gain'),
    ('ruminant_goat_growing',   'nel_per_kg_gain', 'per_kg_gain',  2.5,  NULL, 'Mcal', 'energy per kg gained'),
    ('ruminant_goat_growing',   'wean_months',     'age_months',   3,    NULL, 'months', 'no ration before weaning'),
    ('ruminant_goat_growing',   'adult_months',    'age_months',   12,   NULL, 'months', 'growing until this age'),
    -- sheep
    ('ruminant_sheep_lactating','nel_maintenance', 'per_kg_bw075', 0.056, NULL, 'Mcal', 'NEL'),
    ('ruminant_sheep_lactating','late_pregnancy',  'fraction',     0.30, NULL, 'x maintenance', NULL),
    ('ruminant_sheep_lactating','dmi',             'percent_bw',   2.5,  4.0,  '%', NULL),
    ('ruminant_sheep_lactating','cp',              'percent_dm',   14,   NULL, '%', NULL),
    ('ruminant_sheep_lactating','ca',              'percent_dm',   0.5,  NULL, '%', NULL),
    ('ruminant_sheep_lactating','p',               'percent_dm',   0.3,  NULL, '%', NULL),
    ('ruminant_sheep_lactating','ndf',             'percent_dm',   30,   NULL, '%', NULL),
    ('ruminant_sheep_lactating','forage',          'percent_dm',   50,   NULL, '%', NULL),
    ('ruminant_sheep_lactating','milk_fat',        'percent_milk', 6.5,  NULL, '%', 'sheep milk'),
    ('ruminant_sheep_lactating','milk_protein',    'percent_milk', 5.5,  NULL, '%', NULL),
    ('ruminant_sheep_lactating','milk_lactose',    'percent_milk', 4.8,  NULL, '%', NULL),
    ('ruminant_sheep_dry',      'nel_maintenance', 'per_kg_bw075', 0.056, NULL, 'Mcal', 'NEL'),
    ('ruminant_sheep_dry',      'late_pregnancy',  'fraction',     0.30, NULL, 'x maintenance', NULL),
    ('ruminant_sheep_dry',      'dmi',             'percent_bw',   1.8,  3.0,  '%', NULL),
    ('ruminant_sheep_dry',      'cp',              'percent_dm',   9,    NULL, '%', NULL),
    ('ruminant_sheep_dry',      'ca',              'percent_dm',   0.35, NULL, '%', NULL),
    ('ruminant_sheep_dry',      'p',               'percent_dm',   0.22, NULL, '%', NULL),
    ('ruminant_sheep_dry',      'ndf',             'percent_dm',   35,   NULL, '%', NULL),
    ('ruminant_sheep_dry',      'forage',          'percent_dm',   60,   NULL, '%', NULL),
    ('ruminant_sheep_growing',  'nel_maintenance', 'per_kg_bw075', 0.056, NULL, 'Mcal', 'NEL'),
    ('ruminant_sheep_growing',  'dmi',             'percent_bw',   3.0,  4.5,  '%', NULL),
    ('ruminant_sheep_growing',  'cp',              'percent_dm',   15,   NULL, '%', NULL),
    ('ruminant_sheep_growing',  'ca',              'percent_dm',   0.5,  NULL, '%', NULL),
    ('ruminant_sheep_growing',  'p',               'percent_dm',   0.3,  NULL, '%', NULL),
    ('ruminant_sheep_growing',  'ndf',             'percent_dm',   30,   NULL, '%', NULL),
    ('ruminant_sheep_growing',  'forage',          'percent_dm',   50,   NULL, '%', NULL),
    ('ruminant_sheep_growing',  'target_adg',      'per_day',      0.10, NULL, 'kg', 'target daily gain'),
    ('ruminant_sheep_growing',  'nel_per_kg_gain', 'per_kg_gain',  2.5,  NULL, 'Mcal', NULL),
    ('ruminant_sheep_growing',  'wean_months',     'age_months',   3,    NULL, 'months', NULL),
    ('ruminant_sheep_growing',  'adult_months',    'age_months',   12,   NULL, 'months', NULL),
    -- camels
    ('ruminant_camel_lactating','nel_maintenance', 'per_kg_bw075', 0.047, NULL, 'Mcal', 'NEL'),
    ('ruminant_camel_lactating','late_pregnancy',  'fraction',     0.25, NULL, 'x maintenance', NULL),
    ('ruminant_camel_lactating','dmi',             'percent_bw',   1.8,  2.8,  '%', 'camels eat less per kg than cattle'),
    ('ruminant_camel_lactating','cp',              'percent_dm',   12,   NULL, '%', NULL),
    ('ruminant_camel_lactating','ca',              'percent_dm',   0.5,  NULL, '%', NULL),
    ('ruminant_camel_lactating','p',               'percent_dm',   0.3,  NULL, '%', NULL),
    ('ruminant_camel_lactating','ndf',             'percent_dm',   35,   NULL, '%', NULL),
    ('ruminant_camel_lactating','forage',          'percent_dm',   60,   NULL, '%', NULL),
    ('ruminant_camel_lactating','milk_fat',        'percent_milk', 3.5,  NULL, '%', 'camel milk'),
    ('ruminant_camel_lactating','milk_protein',    'percent_milk', 3.0,  NULL, '%', NULL),
    ('ruminant_camel_lactating','milk_lactose',    'percent_milk', 4.5,  NULL, '%', NULL),
    ('ruminant_camel_dry',      'nel_maintenance', 'per_kg_bw075', 0.047, NULL, 'Mcal', 'NEL'),
    ('ruminant_camel_dry',      'late_pregnancy',  'fraction',     0.25, NULL, 'x maintenance', NULL),
    ('ruminant_camel_dry',      'dmi',             'percent_bw',   1.5,  2.5,  '%', NULL),
    ('ruminant_camel_dry',      'cp',              'percent_dm',   9,    NULL, '%', NULL),
    ('ruminant_camel_dry',      'ca',              'percent_dm',   0.35, NULL, '%', NULL),
    ('ruminant_camel_dry',      'p',               'percent_dm',   0.22, NULL, '%', NULL),
    ('ruminant_camel_dry',      'ndf',             'percent_dm',   40,   NULL, '%', NULL),
    ('ruminant_camel_dry',      'forage',          'percent_dm',   70,   NULL, '%', NULL),
    ('ruminant_camel_growing',  'nel_maintenance', 'per_kg_bw075', 0.047, NULL, 'Mcal', 'NEL'),
    ('ruminant_camel_growing',  'dmi',             'percent_bw',   1.8,  2.8,  '%', NULL),
    ('ruminant_camel_growing',  'cp',              'percent_dm',   13,   NULL, '%', NULL),
    ('ruminant_camel_growing',  'ca',              'percent_dm',   0.5,  NULL, '%', NULL),
    ('ruminant_camel_growing',  'p',               'percent_dm',   0.3,  NULL, '%', NULL),
    ('ruminant_camel_growing',  'ndf',             'percent_dm',   35,   NULL, '%', NULL),
    ('ruminant_camel_growing',  'forage',          'percent_dm',   60,   NULL, '%', NULL),
    ('ruminant_camel_growing',  'target_adg',      'per_day',      0.3,  NULL, 'kg', NULL),
    ('ruminant_camel_growing',  'nel_per_kg_gain', 'per_kg_gain',  3.0,  NULL, 'Mcal', NULL),
    ('ruminant_camel_growing',  'wean_months',     'age_months',   9,    NULL, 'months', NULL),
    ('ruminant_camel_growing',  'adult_months',    'age_months',   48,   NULL, 'months', NULL),
    -- cattle, buffalo, general small - growing
    ('ruminant_cattle_growing', 'nel_maintenance', 'per_kg_bw075', 0.08, NULL, 'Mcal', 'NRC 2001'),
    ('ruminant_cattle_growing', 'dmi',             'percent_bw',   2.2,  2.8,  '%', NULL),
    ('ruminant_cattle_growing', 'cp',              'percent_dm',   15,   NULL, '%', NULL),
    ('ruminant_cattle_growing', 'ca',              'percent_dm',   0.55, NULL, '%', NULL),
    ('ruminant_cattle_growing', 'p',               'percent_dm',   0.35, NULL, '%', NULL),
    ('ruminant_cattle_growing', 'ndf',             'percent_dm',   30,   NULL, '%', NULL),
    ('ruminant_cattle_growing', 'forage',          'percent_dm',   50,   NULL, '%', NULL),
    ('ruminant_cattle_growing', 'target_adg',      'per_day',      0.6,  NULL, 'kg', 'heifer target'),
    ('ruminant_cattle_growing', 'nel_per_kg_gain', 'per_kg_gain',  3.0,  NULL, 'Mcal', NULL),
    ('ruminant_cattle_growing', 'wean_months',     'age_months',   3,    NULL, 'months', 'calves on milk + starter before this'),
    ('ruminant_cattle_growing', 'adult_months',    'age_months',   24,   NULL, 'months', 'first calving age'),
    ('ruminant_buffalo_growing','nel_maintenance', 'per_kg_bw075', 0.08, NULL, 'Mcal', 'NRC 2001'),
    ('ruminant_buffalo_growing','dmi',             'percent_bw',   2.2,  2.8,  '%', NULL),
    ('ruminant_buffalo_growing','cp',              'percent_dm',   15,   NULL, '%', NULL),
    ('ruminant_buffalo_growing','ca',              'percent_dm',   0.55, NULL, '%', NULL),
    ('ruminant_buffalo_growing','p',               'percent_dm',   0.35, NULL, '%', NULL),
    ('ruminant_buffalo_growing','ndf',             'percent_dm',   30,   NULL, '%', NULL),
    ('ruminant_buffalo_growing','forage',          'percent_dm',   50,   NULL, '%', NULL),
    ('ruminant_buffalo_growing','target_adg',      'per_day',      0.5,  NULL, 'kg', NULL),
    ('ruminant_buffalo_growing','nel_per_kg_gain', 'per_kg_gain',  3.0,  NULL, 'Mcal', NULL),
    ('ruminant_buffalo_growing','wean_months',     'age_months',   3,    NULL, 'months', NULL),
    ('ruminant_buffalo_growing','adult_months',    'age_months',   30,   NULL, 'months', NULL),
    ('ruminant_small_growing',  'nel_maintenance', 'per_kg_bw075', 0.063, NULL, 'Mcal', 'NEL'),
    ('ruminant_small_growing',  'dmi',             'percent_bw',   3.0,  4.5,  '%', NULL),
    ('ruminant_small_growing',  'cp',              'percent_dm',   15,   NULL, '%', NULL),
    ('ruminant_small_growing',  'ca',              'percent_dm',   0.55, NULL, '%', NULL),
    ('ruminant_small_growing',  'p',               'percent_dm',   0.32, NULL, '%', NULL),
    ('ruminant_small_growing',  'ndf',             'percent_dm',   30,   NULL, '%', NULL),
    ('ruminant_small_growing',  'forage',          'percent_dm',   50,   NULL, '%', NULL),
    ('ruminant_small_growing',  'target_adg',      'per_day',      0.08, NULL, 'kg', NULL),
    ('ruminant_small_growing',  'nel_per_kg_gain', 'per_kg_gain',  2.5,  NULL, 'Mcal', NULL),
    ('ruminant_small_growing',  'wean_months',     'age_months',   3,    NULL, 'months', NULL),
    ('ruminant_small_growing',  'adult_months',    'age_months',   12,   NULL, 'months', NULL)
  ) AS v(code, nutrient, basis, min_value, max_value, unit, notes) ON v.code = s.code
ON CONFLICT (set_id, nutrient, basis) DO NOTHING;

-- Yak: the cattle rows, per stage (copied, so the vet can change yak alone later).
INSERT INTO nutrition_requirements (set_id, nutrient, basis, min_value, max_value, unit, notes)
SELECT y.id, q.nutrient, q.basis, q.min_value, q.max_value, q.unit, 'copied from cattle'
  FROM nutrition_requirement_sets y
  JOIN nutrition_requirement_sets c ON c.code = replace(y.code, 'ruminant_yak_', 'ruminant_cattle_')
  JOIN nutrition_requirements q ON q.set_id = c.id
 WHERE y.code IN ('ruminant_yak_lactating', 'ruminant_yak_dry', 'ruminant_yak_growing')
ON CONFLICT (set_id, nutrient, basis) DO NOTHING;

-- Every ruminant set: mineral mixture fixed allowance (g/day); every in-milk set: first lactation +20% maintenance.
INSERT INTO nutrition_requirements (set_id, nutrient, basis, min_value, max_value, unit, notes)
SELECT s.id, 'mineral_allowance', 'per_day',
       CASE WHEN s.species_code IN ('Cattle', 'Buffalo', 'Yak', 'Camel') THEN 50 ELSE 10 END, NULL, 'g', 'mineral mixture fed every day'
  FROM nutrition_requirement_sets s WHERE s.nutrition_model = 'ruminant_dm'
ON CONFLICT (set_id, nutrient, basis) DO NOTHING;
INSERT INTO nutrition_requirements (set_id, nutrient, basis, min_value, max_value, unit, notes)
SELECT s.id, 'first_lactation', 'fraction', 0.20, NULL, 'x maintenance', 'still growing in the first lactation'
  FROM nutrition_requirement_sets s WHERE s.nutrition_model = 'ruminant_dm' AND s.life_stage = 'lactating'
ON CONFLICT (set_id, nutrient, basis) DO NOTHING;

-- ─── NUT-204: horses - mares in milk, late pregnancy; no adult ration before 24 months ───
INSERT INTO nutrition_requirements (set_id, nutrient, basis, min_value, max_value, unit, notes)
SELECT s.id, v.nutrient, v.basis, v.min_value, NULL, v.unit, v.notes
  FROM nutrition_requirement_sets s
  JOIN (VALUES
    ('work_lactating', 'fraction',   1.8, 'x maintenance', 'NRC 2007: mare in early lactation'),
    ('late_pregnancy', 'fraction',   0.25, 'x maintenance', 'last 3 months of pregnancy'),
    ('adult_months',   'age_months', 24,  'months', 'growing horses need a vet-made ration')
  ) AS v(nutrient, basis, min_value, unit, notes) ON true
 WHERE s.nutrition_model = 'equine_dm'
ON CONFLICT (set_id, nutrient, basis) DO NOTHING;

-- ─── NUT-191 / NUT-198: mineral for sheep and goats (low copper); the cattle mineral says so in its name ───
UPDATE nutrition_ingredients SET label = 'Mineral mixture (cattle, buffalo)', updated_at = NOW()
 WHERE code = 'feed_mineral_mixture' AND label = 'Mineral mixture';
INSERT INTO nutrition_ingredients (code, label, label_key, kind, models, dry_matter_pct, composition, source, licence, status) VALUES
  ('feed_mineral_mixture_small', 'Mineral mixture (sheep and goats, low copper)', 'nutrition.foods.feed_mineral_mixture_small', 'mineral', '{ruminant_dm}', 98,
   '{"dm_pct":98,"nel_mcal_kg_dm":0,"cp_pct_dm":0,"ca_pct_dm":18,"p_pct_dm":9,"ndf_pct_dm":0,"is_forage":0}', 'Typical values; sheep need a copper-free or low-copper mixture - use the bag label', 'typical values', 'owner_approved')
ON CONFLICT (code) DO NOTHING;

-- ─── NUT-191 / NUT-201 / NUT-202: what must not be fed, per species ───
INSERT INTO nutrition_unsafe_foods (code, species_code, label, label_key, match_terms, severity, source, status)
SELECT v.code, ms.code, v.label, 'nutrition.unsafe.' || regexp_replace(v.code, '_(bird|cat)$', ''), v.terms::text[], v.severity, v.source, 'owner_approved'
  FROM master_species ms
  JOIN (VALUES
    -- sheep: copper
    ('copper_cattle_mix', '{Sheep}', 'Cattle mineral mixture or cattle feed (copper)', '{cattle,"copper sulphate","poultry litter","buffalo mineral"}', 'danger', 'Merck Veterinary Manual - chronic copper poisoning in sheep'),
    -- grazing ruminants
    ('lantana',      '{Cattle,Buffalo,Goat,Sheep,Camel,Yak}', 'Lantana leaves', '{lantana,"raimuniya","ghaneri"}', 'danger', 'Plant toxicity - lantana hepatotoxicity in ruminants'),
    ('parthenium',   '{Cattle,Buffalo,Goat,Sheep,Yak}', 'Parthenium (congress grass)', '{parthenium,"congress grass","gajar ghas"}', 'danger', 'Plant toxicity - parthenium'),
    ('young_sorghum','{Cattle,Buffalo,Goat,Sheep,Yak}', 'Young or drought-stressed sorghum shoots (cyanide)', '{"young sorghum","sorghum shoots","jowar shoots","immature jowar"}', 'danger', 'Merck Veterinary Manual - cyanide poisoning'),
    ('plastic',      '{Cattle,Buffalo,Goat,Sheep,Camel,Yak}', 'Plastic bags, waste', '{plastic,polythene,"garbage"}', 'danger', 'Foreign-body disease in cattle'),
    ('mouldy_feed',  '{Cattle,Buffalo,Goat,Sheep,Camel,Yak,Horse,Donkey,Pig,Chicken,Duck,Turkey,Quail}', 'Mouldy or spoiled feed (aflatoxin)', '{mouldy,moldy,fungus,spoiled,rotten}', 'danger', 'Aflatoxicosis - mouldy feed'),
    ('groundnut_aflatoxin', '{Cattle,Buffalo,Goat,Sheep,Camel,Yak,Pig,Chicken,Duck,Turkey,Quail}', 'Groundnut cake - check it is dry and not mouldy (aflatoxin)', '{"groundnut cake","peanut cake","moongphali khal"}', 'caution', 'Aflatoxin risk in stored groundnut cake'),
    ('urea_free',    '{Cattle,Buffalo,Goat,Sheep}', 'Urea fed loose or in excess', '{urea}', 'caution', 'Non-protein nitrogen - urea toxicity'),
    -- pigs
    ('salt_pig',     '{Pig}', 'Salty food waste (salt poisoning without water)', '{salt,namkeen,"salted"}', 'danger', 'Merck Veterinary Manual - salt poisoning in pigs'),
    ('swill_raw',    '{Pig}', 'Uncooked kitchen or meat waste (swill)', '{swill,"raw meat","meat waste","hotel waste"}', 'danger', 'African swine fever / FMD spread through uncooked swill'),
    -- poultry
    ('avocado_bird', '{Chicken,Duck,Turkey,Quail,Parrot,Budgerigar,Cockatiel,Lovebird,Finch,Canary,Mynah,Pigeon,Bird}', 'Avocado', '{avocado,"butter fruit"}', 'danger', 'ASPCA - avocado (persin) toxicity in birds'),
    ('chocolate_bird','{Budgerigar,Cockatiel,Lovebird,Finch,Canary,Mynah,Pigeon,Bird}', 'Chocolate and cocoa', '{chocolate,cocoa}', 'danger', 'ASPCA Animal Poison Control'),
    ('caffeine_bird','{Budgerigar,Cockatiel,Lovebird,Finch,Canary,Mynah,Pigeon,Bird}', 'Coffee, tea and caffeine', '{coffee,caffeine,tea}', 'danger', 'ASPCA Animal Poison Control'),
    ('alcohol_bird', '{Parrot,Budgerigar,Cockatiel,Lovebird,Finch,Canary,Mynah,Pigeon,Bird}', 'Alcohol', '{alcohol,beer,wine,whisky,rum}', 'danger', 'ASPCA Animal Poison Control'),
    ('onion_bird',   '{Parrot,Budgerigar,Cockatiel,Lovebird,Finch,Canary,Mynah,Pigeon,Bird}', 'Onion and garlic', '{onion,garlic,pyaz,lahsun}', 'danger', 'ASPCA Animal Poison Control'),
    ('salt_bird',    '{Budgerigar,Cockatiel,Lovebird,Finch,Canary,Mynah,Pigeon,Bird}', 'Salty snacks', '{salt,chips,namkeen}', 'caution', 'ASPCA Animal Poison Control'),
    -- cats
    ('cooked_bones_cat', '{Cat}', 'Cooked bones', '{"cooked bone","cooked bones"}', 'caution', 'ASPCA Animal Poison Control - people foods to avoid')
  ) AS v(code, species, label, terms, severity, source) ON ms.code = ANY(v.species::text[])
ON CONFLICT (species_code, code) DO NOTHING;

-- Local-language words for the commonest dangers, so a food typed in Hindi / Kannada / Malayalam / Tamil / Telugu is caught.
UPDATE nutrition_unsafe_foods SET match_terms = match_terms || v.extra::text[], updated_at = NOW()
  FROM (VALUES
    ('chocolate', '{चॉकलेट,ಚಾಕೊಲೇಟ್,ചോക്ലേറ്റ്,சாக்லேட்,చాక్లెట్}'),
    ('onion',     '{प्याज,लहसुन,ಈರುಳ್ಳಿ,ಬೆಳ್ಳುಳ್ಳಿ,ഉള്ളി,വെളുത്തുള്ളി,வெங்காயம்,பூண்டு,ఉల్లిపాయ,వెల్లుల్లి}'),
    ('grapes',    '{अंगूर,किशमिश,ದ್ರಾಕ್ಷಿ,മുന്തിരി,திராட்சை,ద్రాక్ష}')
  ) AS v(code, extra)
 WHERE nutrition_unsafe_foods.code = v.code AND NOT (nutrition_unsafe_foods.match_terms && v.extra::text[]);

-- ─── NUT-192: shrimp rates, scampi its own table, expected survival per size band ───
ALTER TABLE nutrition_feeding_curves ADD COLUMN IF NOT EXISTS survival_pct NUMERIC(5,2)
  CHECK (survival_pct IS NULL OR (survival_pct > 0 AND survival_pct <= 100));
UPDATE nutrition_feeding_curves SET rate_pct_biomass = v.rate, survival_pct = v.surv, updated_at = NOW()
  FROM (VALUES (0, 10.0, 95), (1, 5.0, 90), (5, 3.5, 85), (10, 2.8, 80), (15, 2.4, 75), (20, 2.0, 70)) AS v(wfrom, rate, surv)
 WHERE curve_key = 'shrimp_general' AND weight_from_g = v.wfrom;
UPDATE nutrition_feeding_curves SET species_codes = array_remove(species_codes, 'Freshwater Prawn'), updated_at = NOW()
 WHERE curve_key = 'shrimp_general';
UPDATE nutrition_feeding_curves SET survival_pct = v.surv, updated_at = NOW()
  FROM (VALUES (0, 90), (10, 85), (50, 85), (200, 80), (500, 80)) AS v(wfrom, surv)
 WHERE curve_key = 'fish_general' AND weight_from_g = v.wfrom AND survival_pct IS NULL;
INSERT INTO nutrition_feeding_curves
  (curve_key, title, nutrition_model, species_codes, group_types, basis, product, weight_from_g, weight_to_g, rate_pct_biomass, survival_pct, feeds_per_day, feed_type, source, status)
VALUES
  ('prawn_freshwater', 'Freshwater prawn (scampi)', 'aqua_biomass', '{Freshwater Prawn}', '{}', 'percent_biomass', 'meat', 0,  5,   6.0, 85, 3, 'starter',  'Typical Macrobrachium feeding table', 'owner_approved'),
  ('prawn_freshwater', 'Freshwater prawn (scampi)', 'aqua_biomass', '{Freshwater Prawn}', '{}', 'percent_biomass', 'meat', 5,  15,  4.0, 75, 2, 'grower',   'Typical Macrobrachium feeding table', 'owner_approved'),
  ('prawn_freshwater', 'Freshwater prawn (scampi)', 'aqua_biomass', '{Freshwater Prawn}', '{}', 'percent_biomass', 'meat', 15, 30,  3.0, 65, 2, 'grower',   'Typical Macrobrachium feeding table', 'owner_approved'),
  ('prawn_freshwater', 'Freshwater prawn (scampi)', 'aqua_biomass', '{Freshwater Prawn}', '{}', 'percent_biomass', 'meat', 30, 200, 2.5, 60, 2, 'finisher', 'Typical Macrobrachium feeding table', 'owner_approved')
ON CONFLICT DO NOTHING;
INSERT INTO nutrition_temperature_factors (curve_key, from_c, to_c, factor, source, status) VALUES
  ('prawn_freshwater', 0,  24, 0.6, 'Typical aquaculture practice: feed less in cold water', 'owner_approved'),
  ('prawn_freshwater', 24, 32, 1.0, 'Typical aquaculture practice', 'owner_approved'),
  ('prawn_freshwater', 32, 45, 0.7, 'Typical aquaculture practice: feed less in hot water', 'owner_approved')
ON CONFLICT DO NOTHING;

-- ─── NUT-193: a batch can arrive older than day 0 ───
ALTER TABLE group_cycles ADD COLUMN IF NOT EXISTS age_at_placement_days INTEGER
  CHECK (age_at_placement_days IS NULL OR (age_at_placement_days >= 0 AND age_at_placement_days <= 3650));
UPDATE master_record_types
   SET fields = '[{"key":"quantity","type":"number","required":true},{"key":"ageAtPlacementDays","type":"number"},{"key":"source","type":"text"}]'::jsonb
 WHERE code = 'placement' AND fields::text NOT LIKE '%ageAtPlacementDays%';

-- ─── NUT-195: a bitch or queen feeding a litter, or carrying one, is not fed maintenance ───
INSERT INTO nutrition_energy_factors (species_code, factor_key, factor, source, licence, status) VALUES
  ('Dog', 'gestation', 2.0, 'MSD Veterinary Manual / NRC: late pregnancy about 2x resting energy', 'cited reference', 'owner_approved'),
  ('Dog', 'lactation', 4.0, 'MSD Veterinary Manual / NRC: lactation 3-6x resting energy by litter size (typical litter)', 'cited reference', 'owner_approved'),
  ('Cat', 'gestation', 1.6, 'MSD Veterinary Manual / NRC: queen in pregnancy about 1.6x resting energy', 'cited reference', 'owner_approved'),
  ('Cat', 'lactation', 3.0, 'MSD Veterinary Manual / NRC: queen in lactation 2-6x resting energy (typical litter)', 'cited reference', 'owner_approved')
ON CONFLICT DO NOTHING;

-- ─── NUT-194: the sample weight is in GRAMS - the unit travels with the field so the entry shows it (kg typed as g is 1000x off) ───
UPDATE master_record_types
   SET fields = '[{"key":"sampleCount","type":"number"},{"key":"averageWeight","type":"number","required":true,"unit":"g"}]'::jsonb
 WHERE code = 'sample_weight' AND fields::text NOT LIKE '%"unit"%';
