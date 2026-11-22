-- Migration 059: animal nutrition - group feeding for flocks, pig batches and ponds (docs/NUTRITION_PLAN.md, Phase 2)
--
-- Feeding curves are master data: per head per day by age (poultry, pigs) or % of biomass per day by average
-- body weight (fish, shrimp), plus a water-temperature factor for ponds. The method is engine/groupFeeding.ts.
-- Rows match a group by species and, optionally, its group type (broilers vs layers). Seeded values are TYPICAL
-- figures from breed management guides and common aquaculture feeding tables - 'unvalidated' until the owner
-- approves them (Admin -> Nutrition data, "Approve all pending") and the vet reviews them. A farm's own feed bag
-- table always wins: an admin can edit any row.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

CREATE TABLE IF NOT EXISTS nutrition_feeding_curves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curve_key VARCHAR(60) NOT NULL,
  title VARCHAR(200) NOT NULL,
  nutrition_model VARCHAR(30) NOT NULL CHECK (nutrition_model IN ('monogastric_spec', 'aqua_biomass')),
  species_codes TEXT[] NOT NULL DEFAULT '{}',
  group_types TEXT[] NOT NULL DEFAULT '{}',
  basis VARCHAR(20) NOT NULL CHECK (basis IN ('per_head', 'percent_biomass')),
  product VARCHAR(10) NOT NULL DEFAULT 'meat' CHECK (product IN ('meat', 'eggs')),
  egg_mass_g NUMERIC(6,2),
  age_from_days INTEGER,
  age_to_days INTEGER,
  weight_from_g NUMERIC(10,2),
  weight_to_g NUMERIC(10,2),
  grams_per_head_day NUMERIC(10,2) CHECK (grams_per_head_day IS NULL OR grams_per_head_day >= 0),
  rate_pct_biomass NUMERIC(6,3) CHECK (rate_pct_biomass IS NULL OR (rate_pct_biomass >= 0 AND rate_pct_biomass <= 30)),
  feeds_per_day SMALLINT,
  feed_type VARCHAR(40),
  source TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unvalidated' CHECK (status IN ('unvalidated', 'owner_approved', 'vet_validated', 'retired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT nutrition_feeding_curves_band_ck CHECK (
    (basis = 'per_head' AND grams_per_head_day IS NOT NULL) OR (basis = 'percent_biomass' AND rate_pct_biomass IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_nutrition_feeding_curves_band
  ON nutrition_feeding_curves (curve_key, COALESCE(age_from_days, -1), COALESCE(weight_from_g, -1));

CREATE TABLE IF NOT EXISTS nutrition_temperature_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curve_key VARCHAR(60) NOT NULL,
  from_c NUMERIC(5,2) NOT NULL,
  to_c NUMERIC(5,2) NOT NULL,
  factor NUMERIC(4,2) NOT NULL CHECK (factor >= 0 AND factor <= 2),
  source TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unvalidated' CHECK (status IN ('unvalidated', 'owner_approved', 'vet_validated', 'retired')),
  CONSTRAINT nutrition_temperature_factors_uq UNIQUE (curve_key, from_c)
);

-- ─── Seeds (typical values) ───────────────────────────────────────────────
INSERT INTO nutrition_feeding_curves
  (curve_key, title, nutrition_model, species_codes, group_types, basis, product, egg_mass_g, age_from_days, age_to_days, grams_per_head_day, feeds_per_day, feed_type, source)
VALUES
  ('chicken_broiler', 'Broiler chicken', 'monogastric_spec', '{Chicken}', '{broilers,chicks_brooding,growers}', 'per_head', 'meat', NULL, 0,   7,  20, 6, 'starter',  'Typical broiler management-guide intake'),
  ('chicken_broiler', 'Broiler chicken', 'monogastric_spec', '{Chicken}', '{broilers,chicks_brooding,growers}', 'per_head', 'meat', NULL, 8,   14, 45, 4, 'starter',  'Typical broiler management-guide intake'),
  ('chicken_broiler', 'Broiler chicken', 'monogastric_spec', '{Chicken}', '{broilers,chicks_brooding,growers}', 'per_head', 'meat', NULL, 15,  21, 85, 3, 'grower',   'Typical broiler management-guide intake'),
  ('chicken_broiler', 'Broiler chicken', 'monogastric_spec', '{Chicken}', '{broilers,chicks_brooding,growers}', 'per_head', 'meat', NULL, 22,  28, 125, 3, 'grower',  'Typical broiler management-guide intake'),
  ('chicken_broiler', 'Broiler chicken', 'monogastric_spec', '{Chicken}', '{broilers,chicks_brooding,growers}', 'per_head', 'meat', NULL, 29,  35, 160, 3, 'finisher', 'Typical broiler management-guide intake'),
  ('chicken_broiler', 'Broiler chicken', 'monogastric_spec', '{Chicken}', '{broilers,chicks_brooding,growers}', 'per_head', 'meat', NULL, 36,  60, 185, 3, 'finisher', 'Typical broiler management-guide intake'),
  ('chicken_layer',   'Laying hens',     'monogastric_spec', '{Chicken}', '{layers,breeders,backyard_flock}', 'per_head', 'eggs', 60, 0,   42, 30, 4, 'chick',    'Typical layer management-guide intake'),
  ('chicken_layer',   'Laying hens',     'monogastric_spec', '{Chicken}', '{layers,breeders,backyard_flock}', 'per_head', 'eggs', 60, 43,  126, 70, 2, 'grower',  'Typical layer management-guide intake'),
  ('chicken_layer',   'Laying hens',     'monogastric_spec', '{Chicken}', '{layers,breeders,backyard_flock}', 'per_head', 'eggs', 60, 127, 900, 115, 2, 'layer',  'Typical layer management-guide intake'),
  ('quail_layer',     'Japanese quail',  'monogastric_spec', '{Quail}',   '{}', 'per_head', 'eggs', 11, 0,   35, 15, 3, 'starter',  'Typical quail feeding guide'),
  ('quail_layer',     'Japanese quail',  'monogastric_spec', '{Quail}',   '{}', 'per_head', 'eggs', 11, 36,  900, 25, 2, 'layer',   'Typical quail feeding guide'),
  ('duck_general',    'Ducks',           'monogastric_spec', '{Duck}',    '{}', 'per_head', 'meat', NULL, 0,  21, 60, 4, 'starter',  'Typical duck feeding guide'),
  ('duck_general',    'Ducks',           'monogastric_spec', '{Duck}',    '{}', 'per_head', 'meat', NULL, 22, 900, 160, 2, 'grower', 'Typical duck feeding guide'),
  ('pig_general',     'Pigs',            'monogastric_spec', '{Pig}',     '{}', 'per_head', 'meat', NULL, 0,   60, 400, 4, 'creep / weaner', 'Typical pig feeding guide'),
  ('pig_general',     'Pigs',            'monogastric_spec', '{Pig}',     '{}', 'per_head', 'meat', NULL, 61,  120, 1500, 2, 'grower', 'Typical pig feeding guide'),
  ('pig_general',     'Pigs',            'monogastric_spec', '{Pig}',     '{}', 'per_head', 'meat', NULL, 121, 220, 2500, 2, 'finisher', 'Typical pig feeding guide'),
  ('pig_general',     'Pigs',            'monogastric_spec', '{Pig}',     '{}', 'per_head', 'meat', NULL, 221, 9000, 2800, 2, 'adult / sow', 'Typical pig feeding guide')
ON CONFLICT DO NOTHING;

INSERT INTO nutrition_feeding_curves
  (curve_key, title, nutrition_model, species_codes, group_types, basis, product, weight_from_g, weight_to_g, rate_pct_biomass, feeds_per_day, feed_type, source)
VALUES
  ('shrimp_general', 'Shrimp (vannamei, tiger, Indian white)', 'aqua_biomass', '{Vannamei Shrimp,Black Tiger Shrimp,Indian White Shrimp,Freshwater Prawn}', '{}', 'percent_biomass', 'meat', 0,  1,   10,  4, 'starter crumble', 'Typical shrimp feeding table'),
  ('shrimp_general', 'Shrimp (vannamei, tiger, Indian white)', 'aqua_biomass', '{Vannamei Shrimp,Black Tiger Shrimp,Indian White Shrimp,Freshwater Prawn}', '{}', 'percent_biomass', 'meat', 1,  5,   6,   4, 'starter',  'Typical shrimp feeding table'),
  ('shrimp_general', 'Shrimp (vannamei, tiger, Indian white)', 'aqua_biomass', '{Vannamei Shrimp,Black Tiger Shrimp,Indian White Shrimp,Freshwater Prawn}', '{}', 'percent_biomass', 'meat', 5,  10,  4,   4, 'grower',   'Typical shrimp feeding table'),
  ('shrimp_general', 'Shrimp (vannamei, tiger, Indian white)', 'aqua_biomass', '{Vannamei Shrimp,Black Tiger Shrimp,Indian White Shrimp,Freshwater Prawn}', '{}', 'percent_biomass', 'meat', 10, 15,  3.2, 4, 'grower',   'Typical shrimp feeding table'),
  ('shrimp_general', 'Shrimp (vannamei, tiger, Indian white)', 'aqua_biomass', '{Vannamei Shrimp,Black Tiger Shrimp,Indian White Shrimp,Freshwater Prawn}', '{}', 'percent_biomass', 'meat', 15, 20,  2.8, 4, 'finisher', 'Typical shrimp feeding table'),
  ('shrimp_general', 'Shrimp (vannamei, tiger, Indian white)', 'aqua_biomass', '{Vannamei Shrimp,Black Tiger Shrimp,Indian White Shrimp,Freshwater Prawn}', '{}', 'percent_biomass', 'meat', 20, 100, 2.4, 4, 'finisher', 'Typical shrimp feeding table'),
  ('fish_general', 'Fish (carps, tilapia, catfish, others)', 'aqua_biomass',
   '{Catla,Rohu,Mrigal,Bata,Calbasu,Silver Carp,Grass Carp,Common Carp,Tilapia,Magur,Singhi,Murrel,Climbing Perch,Pangasius,Giant Gourami,Asian Seabass,Milkfish,Grey Mullet,Pearlspot,Long Whiskers Catfish,Red Snapper}', '{}',
   'percent_biomass', 'meat', 0, 10, 5, 3, 'nursery', 'Typical fish feeding table'),
  ('fish_general', 'Fish (carps, tilapia, catfish, others)', 'aqua_biomass',
   '{Catla,Rohu,Mrigal,Bata,Calbasu,Silver Carp,Grass Carp,Common Carp,Tilapia,Magur,Singhi,Murrel,Climbing Perch,Pangasius,Giant Gourami,Asian Seabass,Milkfish,Grey Mullet,Pearlspot,Long Whiskers Catfish,Red Snapper}', '{}',
   'percent_biomass', 'meat', 10, 50, 3.5, 2, 'grower', 'Typical fish feeding table'),
  ('fish_general', 'Fish (carps, tilapia, catfish, others)', 'aqua_biomass',
   '{Catla,Rohu,Mrigal,Bata,Calbasu,Silver Carp,Grass Carp,Common Carp,Tilapia,Magur,Singhi,Murrel,Climbing Perch,Pangasius,Giant Gourami,Asian Seabass,Milkfish,Grey Mullet,Pearlspot,Long Whiskers Catfish,Red Snapper}', '{}',
   'percent_biomass', 'meat', 50, 200, 2.5, 2, 'grower', 'Typical fish feeding table'),
  ('fish_general', 'Fish (carps, tilapia, catfish, others)', 'aqua_biomass',
   '{Catla,Rohu,Mrigal,Bata,Calbasu,Silver Carp,Grass Carp,Common Carp,Tilapia,Magur,Singhi,Murrel,Climbing Perch,Pangasius,Giant Gourami,Asian Seabass,Milkfish,Grey Mullet,Pearlspot,Long Whiskers Catfish,Red Snapper}', '{}',
   'percent_biomass', 'meat', 200, 500, 2, 2, 'finisher', 'Typical fish feeding table'),
  ('fish_general', 'Fish (carps, tilapia, catfish, others)', 'aqua_biomass',
   '{Catla,Rohu,Mrigal,Bata,Calbasu,Silver Carp,Grass Carp,Common Carp,Tilapia,Magur,Singhi,Murrel,Climbing Perch,Pangasius,Giant Gourami,Asian Seabass,Milkfish,Grey Mullet,Pearlspot,Long Whiskers Catfish,Red Snapper}', '{}',
   'percent_biomass', 'meat', 500, 100000, 1.5, 2, 'finisher', 'Typical fish feeding table')
ON CONFLICT DO NOTHING;

INSERT INTO nutrition_temperature_factors (curve_key, from_c, to_c, factor, source) VALUES
  ('shrimp_general', 0,  22, 0.5, 'Typical aquaculture practice: feed less in cold water'),
  ('shrimp_general', 22, 26, 0.8, 'Typical aquaculture practice'),
  ('shrimp_general', 26, 32, 1.0, 'Typical aquaculture practice'),
  ('shrimp_general', 32, 45, 0.7, 'Typical aquaculture practice: feed less in hot water'),
  ('fish_general',   0,  18, 0.4, 'Typical aquaculture practice: feed less in cold water'),
  ('fish_general',   18, 24, 0.8, 'Typical aquaculture practice'),
  ('fish_general',   24, 32, 1.0, 'Typical aquaculture practice'),
  ('fish_general',   32, 45, 0.7, 'Typical aquaculture practice: feed less in hot water')
ON CONFLICT DO NOTHING;
