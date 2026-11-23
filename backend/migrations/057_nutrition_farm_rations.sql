-- Migration 057: animal nutrition - farm rations (docs/NUTRITION_PLAN.md, Phase 2)
--
-- Least-cost rations for ruminants (cattle, buffalo, goats, sheep, camels) on the SAME tables as Phase 1:
--   * nutrition_requirements gains two bases the ruminant method needs: percent_bw (eating capacity as % of body
--     weight), fraction (e.g. the late-pregnancy energy allowance).
--   * starting requirement sets for lactating / dry animals - every value 'unvalidated' with its source, for the
--     owner's vet to confirm or change in Admin -> Nutrition data (owner decision 2026-11-22).
--   * a starter library of common Indian feeds with typical composition (dry matter, energy, protein, minerals,
--     fibre), also 'unvalidated'. A farm's own lab report or the bag label always wins: a farm can add its own feed.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

-- The list includes every basis used by LATER migrations too (per_kg_bw, 060): a fresh install runs init.sql (which
-- already holds 060's rows) and then every migration in order, so this re-add must accept them.
ALTER TABLE nutrition_requirements DROP CONSTRAINT IF EXISTS nutrition_requirements_basis_check;
DO $$ BEGIN
  ALTER TABLE nutrition_requirements ADD CONSTRAINT nutrition_requirements_basis_check
    CHECK (basis IN ('per_1000kcal', 'per_kg_dm', 'percent_dm', 'per_day', 'per_kg_bw075', 'percent_bw', 'fraction', 'percent_milk', 'per_kg_bw', 'per_kg_gain', 'age_months'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Requirement sets (starting values; method in engine/ruminantRation.ts) ───────────────────────────────
-- Energy: NEL maintenance 0.08 Mcal per kg^0.75 and the milk energy equation are NRC (2001) Nutrient Requirements
-- of Dairy Cattle. Protein / mineral / fibre / intake figures are common field targets for Indian dairy animals.
-- All of it awaits the owner's vet; it is data, so changing it needs no code.
INSERT INTO nutrition_requirement_sets (code, nutrition_model, species_code, life_stage, title, source, licence) VALUES
  ('ruminant_cattle_lactating', 'ruminant_dm', 'Cattle',  'lactating', 'Cattle - in milk (starting values)',  'NRC 2001 energy equations; common field targets for protein, minerals, fibre and intake', 'cited reference'),
  ('ruminant_cattle_dry',       'ruminant_dm', 'Cattle',  'dry',       'Cattle - dry / not in milk (starting values)', 'NRC 2001 energy equations; common field targets for protein, minerals, fibre and intake', 'cited reference'),
  ('ruminant_buffalo_lactating','ruminant_dm', 'Buffalo', 'lactating', 'Buffalo - in milk (starting values)', 'NRC 2001 energy equations applied with buffalo milk composition; common field targets', 'cited reference'),
  ('ruminant_buffalo_dry',      'ruminant_dm', 'Buffalo', 'dry',       'Buffalo - dry / not in milk (starting values)', 'NRC 2001 energy equations; common field targets', 'cited reference'),
  ('ruminant_small_lactating',  'ruminant_dm', NULL,      'lactating', 'Goats, sheep - in milk (starting values)', 'Common field targets for small ruminants', 'cited reference'),
  ('ruminant_small_dry',        'ruminant_dm', NULL,      'dry',       'Goats, sheep, camels - maintenance (starting values)', 'Common field targets for small ruminants', 'cited reference')
ON CONFLICT (code) DO NOTHING;

-- One row per parameter. nutrient names are the engine's RuminantRequirements keys.
INSERT INTO nutrition_requirements (set_id, nutrient, basis, min_value, max_value, unit, notes)
SELECT s.id, v.nutrient, v.basis, v.min_value, v.max_value, v.unit, v.notes
  FROM nutrition_requirement_sets s
  JOIN (VALUES
    -- code, nutrient, basis, min, max, unit, notes
    ('ruminant_cattle_lactating', 'nel_maintenance', 'per_kg_bw075', 0.08, NULL, 'Mcal', 'NRC 2001'),
    ('ruminant_cattle_lactating', 'late_pregnancy',  'fraction',     0.25, NULL, 'x maintenance', 'last 2 months'),
    ('ruminant_cattle_lactating', 'dmi',             'percent_bw',   2.0,  3.5,  '%', NULL),
    ('ruminant_cattle_lactating', 'cp',              'percent_dm',   14,   NULL, '%', NULL),
    ('ruminant_cattle_lactating', 'ca',              'percent_dm',   0.6,  NULL, '%', NULL),
    ('ruminant_cattle_lactating', 'p',               'percent_dm',   0.38, NULL, '%', NULL),
    ('ruminant_cattle_lactating', 'ndf',             'percent_dm',   28,   NULL, '%', 'rumen health'),
    ('ruminant_cattle_lactating', 'forage',          'percent_dm',   40,   NULL, '%', 'rumen health'),
    ('ruminant_cattle_lactating', 'milk_fat',        'percent_milk',   4.0,  NULL, '%', 'default milk fat when not recorded'),
    ('ruminant_cattle_lactating', 'milk_protein',    'percent_milk',   3.2,  NULL, '%', 'default'),
    ('ruminant_cattle_lactating', 'milk_lactose',    'percent_milk',   4.8,  NULL, '%', 'default'),
    ('ruminant_cattle_dry',       'nel_maintenance', 'per_kg_bw075', 0.08, NULL, 'Mcal', 'NRC 2001'),
    ('ruminant_cattle_dry',       'late_pregnancy',  'fraction',     0.25, NULL, 'x maintenance', 'last 2 months'),
    ('ruminant_cattle_dry',       'dmi',             'percent_bw',   1.8,  2.5,  '%', NULL),
    ('ruminant_cattle_dry',       'cp',              'percent_dm',   11,   NULL, '%', NULL),
    ('ruminant_cattle_dry',       'ca',              'percent_dm',   0.45, NULL, '%', NULL),
    ('ruminant_cattle_dry',       'p',               'percent_dm',   0.25, NULL, '%', NULL),
    ('ruminant_cattle_dry',       'ndf',             'percent_dm',   33,   NULL, '%', NULL),
    ('ruminant_cattle_dry',       'forage',          'percent_dm',   60,   NULL, '%', NULL),
    ('ruminant_buffalo_lactating','nel_maintenance', 'per_kg_bw075', 0.08, NULL, 'Mcal', 'NRC 2001'),
    ('ruminant_buffalo_lactating','late_pregnancy',  'fraction',     0.25, NULL, 'x maintenance', 'last 2 months'),
    ('ruminant_buffalo_lactating','dmi',             'percent_bw',   2.0,  3.2,  '%', NULL),
    ('ruminant_buffalo_lactating','cp',              'percent_dm',   14,   NULL, '%', NULL),
    ('ruminant_buffalo_lactating','ca',              'percent_dm',   0.6,  NULL, '%', NULL),
    ('ruminant_buffalo_lactating','p',               'percent_dm',   0.38, NULL, '%', NULL),
    ('ruminant_buffalo_lactating','ndf',             'percent_dm',   30,   NULL, '%', NULL),
    ('ruminant_buffalo_lactating','forage',          'percent_dm',   45,   NULL, '%', NULL),
    ('ruminant_buffalo_lactating','milk_fat',        'percent_milk',   7.0,  NULL, '%', 'default buffalo milk fat'),
    ('ruminant_buffalo_lactating','milk_protein',    'percent_milk',   4.2,  NULL, '%', 'default'),
    ('ruminant_buffalo_lactating','milk_lactose',    'percent_milk',   4.9,  NULL, '%', 'default'),
    ('ruminant_buffalo_dry',      'nel_maintenance', 'per_kg_bw075', 0.08, NULL, 'Mcal', 'NRC 2001'),
    ('ruminant_buffalo_dry',      'late_pregnancy',  'fraction',     0.25, NULL, 'x maintenance', 'last 2 months'),
    ('ruminant_buffalo_dry',      'dmi',             'percent_bw',   1.8,  2.5,  '%', NULL),
    ('ruminant_buffalo_dry',      'cp',              'percent_dm',   11,   NULL, '%', NULL),
    ('ruminant_buffalo_dry',      'ca',              'percent_dm',   0.45, NULL, '%', NULL),
    ('ruminant_buffalo_dry',      'p',               'percent_dm',   0.25, NULL, '%', NULL),
    ('ruminant_buffalo_dry',      'ndf',             'percent_dm',   33,   NULL, '%', NULL),
    ('ruminant_buffalo_dry',      'forage',          'percent_dm',   60,   NULL, '%', NULL),
    ('ruminant_small_lactating',  'nel_maintenance', 'per_kg_bw075', 0.10, NULL, 'Mcal', NULL),
    ('ruminant_small_lactating',  'late_pregnancy',  'fraction',     0.30, NULL, 'x maintenance', 'last 2 months'),
    ('ruminant_small_lactating',  'dmi',             'percent_bw',   3.0,  5.0,  '%', NULL),
    ('ruminant_small_lactating',  'cp',              'percent_dm',   14,   NULL, '%', NULL),
    ('ruminant_small_lactating',  'ca',              'percent_dm',   0.6,  NULL, '%', NULL),
    ('ruminant_small_lactating',  'p',               'percent_dm',   0.35, NULL, '%', NULL),
    ('ruminant_small_lactating',  'ndf',             'percent_dm',   30,   NULL, '%', NULL),
    ('ruminant_small_lactating',  'forage',          'percent_dm',   50,   NULL, '%', NULL),
    ('ruminant_small_lactating',  'milk_fat',        'percent_milk',   4.5,  NULL, '%', 'default goat milk fat'),
    ('ruminant_small_lactating',  'milk_protein',    'percent_milk',   3.4,  NULL, '%', 'default'),
    ('ruminant_small_lactating',  'milk_lactose',    'percent_milk',   4.4,  NULL, '%', 'default'),
    ('ruminant_small_dry',        'nel_maintenance', 'per_kg_bw075', 0.10, NULL, 'Mcal', NULL),
    ('ruminant_small_dry',        'late_pregnancy',  'fraction',     0.30, NULL, 'x maintenance', 'last 2 months'),
    ('ruminant_small_dry',        'dmi',             'percent_bw',   2.5,  4.0,  '%', NULL),
    ('ruminant_small_dry',        'cp',              'percent_dm',   10,   NULL, '%', NULL),
    ('ruminant_small_dry',        'ca',              'percent_dm',   0.4,  NULL, '%', NULL),
    ('ruminant_small_dry',        'p',               'percent_dm',   0.25, NULL, '%', NULL),
    ('ruminant_small_dry',        'ndf',             'percent_dm',   35,   NULL, '%', NULL),
    ('ruminant_small_dry',        'forage',          'percent_dm',   60,   NULL, '%', NULL)
  ) AS v(code, nutrient, basis, min_value, max_value, unit, notes) ON v.code = s.code
ON CONFLICT (set_id, nutrient, basis) DO NOTHING;

-- ─── Common Indian feeds (typical composition, per kg DRY MATTER; dm_pct as fed) ─────────────────────────────
-- composition keys: dm_pct, nel_mcal_kg_dm, cp_pct_dm, ca_pct_dm, p_pct_dm, ndf_pct_dm, is_forage (1/0)
INSERT INTO nutrition_ingredients (code, label, label_key, kind, models, dry_matter_pct, composition, source, licence) VALUES
  ('feed_green_maize',    'Green maize fodder',        'nutrition.foods.feed_green_maize',    'forage',      '{ruminant_dm}', 20, '{"dm_pct":20,"nel_mcal_kg_dm":1.30,"cp_pct_dm":8,"ca_pct_dm":0.35,"p_pct_dm":0.20,"ndf_pct_dm":55,"is_forage":1}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_berseem',        'Berseem (green)',           'nutrition.foods.feed_berseem',        'forage',      '{ruminant_dm}', 18, '{"dm_pct":18,"nel_mcal_kg_dm":1.35,"cp_pct_dm":18,"ca_pct_dm":1.5,"p_pct_dm":0.30,"ndf_pct_dm":42,"is_forage":1}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_napier',         'Napier / hybrid napier (green)', 'nutrition.foods.feed_napier',    'forage',      '{ruminant_dm}', 18, '{"dm_pct":18,"nel_mcal_kg_dm":1.15,"cp_pct_dm":9,"ca_pct_dm":0.40,"p_pct_dm":0.25,"ndf_pct_dm":65,"is_forage":1}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_sorghum_green',  'Green sorghum (jowar) fodder', 'nutrition.foods.feed_sorghum_green', 'forage',   '{ruminant_dm}', 25, '{"dm_pct":25,"nel_mcal_kg_dm":1.20,"cp_pct_dm":7,"ca_pct_dm":0.35,"p_pct_dm":0.20,"ndf_pct_dm":60,"is_forage":1}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_wheat_straw',    'Wheat straw (bhusa)',       'nutrition.foods.feed_wheat_straw',    'forage',      '{ruminant_dm}', 90, '{"dm_pct":90,"nel_mcal_kg_dm":0.90,"cp_pct_dm":3.5,"ca_pct_dm":0.20,"p_pct_dm":0.08,"ndf_pct_dm":75,"is_forage":1}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_paddy_straw',    'Paddy straw',               'nutrition.foods.feed_paddy_straw',    'forage',      '{ruminant_dm}', 90, '{"dm_pct":90,"nel_mcal_kg_dm":0.85,"cp_pct_dm":3.5,"ca_pct_dm":0.25,"p_pct_dm":0.08,"ndf_pct_dm":72,"is_forage":1}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_maize_grain',    'Maize grain (crushed)',     'nutrition.foods.feed_maize_grain',    'concentrate', '{ruminant_dm}', 89, '{"dm_pct":89,"nel_mcal_kg_dm":1.95,"cp_pct_dm":9,"ca_pct_dm":0.03,"p_pct_dm":0.30,"ndf_pct_dm":10,"is_forage":0}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_wheat_bran',     'Wheat bran (chokar)',       'nutrition.foods.feed_wheat_bran',     'concentrate', '{ruminant_dm}', 89, '{"dm_pct":89,"nel_mcal_kg_dm":1.55,"cp_pct_dm":16,"ca_pct_dm":0.13,"p_pct_dm":1.10,"ndf_pct_dm":45,"is_forage":0}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_cottonseed_cake','Cottonseed cake (binola khal)', 'nutrition.foods.feed_cottonseed_cake', 'concentrate', '{ruminant_dm}', 92, '{"dm_pct":92,"nel_mcal_kg_dm":1.65,"cp_pct_dm":24,"ca_pct_dm":0.20,"p_pct_dm":0.70,"ndf_pct_dm":35,"is_forage":0}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_groundnut_cake', 'Groundnut cake',            'nutrition.foods.feed_groundnut_cake', 'concentrate', '{ruminant_dm}', 92, '{"dm_pct":92,"nel_mcal_kg_dm":1.75,"cp_pct_dm":45,"ca_pct_dm":0.20,"p_pct_dm":0.60,"ndf_pct_dm":15,"is_forage":0}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_mustard_cake',   'Mustard cake',              'nutrition.foods.feed_mustard_cake',   'concentrate', '{ruminant_dm}', 92, '{"dm_pct":92,"nel_mcal_kg_dm":1.65,"cp_pct_dm":36,"ca_pct_dm":0.60,"p_pct_dm":1.00,"ndf_pct_dm":25,"is_forage":0}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_cattle_feed',    'Compound cattle feed (BIS type II)', 'nutrition.foods.feed_cattle_feed', 'compound_feed', '{ruminant_dm}', 90, '{"dm_pct":90,"nel_mcal_kg_dm":1.60,"cp_pct_dm":22,"ca_pct_dm":0.80,"p_pct_dm":0.55,"ndf_pct_dm":28,"is_forage":0}', 'Typical values; IS 2052 sets minimums - use the bag label when you have it', 'typical values'),
  ('feed_mineral_mixture','Mineral mixture',           'nutrition.foods.feed_mineral_mixture','mineral',     '{ruminant_dm}', 98, '{"dm_pct":98,"nel_mcal_kg_dm":0,"cp_pct_dm":0,"ca_pct_dm":20,"p_pct_dm":10,"ndf_pct_dm":0,"is_forage":0}', 'Typical values; use the bag label when you have it', 'typical values')
ON CONFLICT (code) DO NOTHING;
