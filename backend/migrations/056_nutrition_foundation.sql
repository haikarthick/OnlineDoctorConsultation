-- Migration 056: animal nutrition module - foundation (docs/NUTRITION_PLAN.md, Phase 1)
--
-- One schema for EVERY species, so later phases add calculators, not tables:
--   * master_species / master_animal_classes get `nutrition_model` - which pattern a species is fed by
--     (companion_energy, ruminant_dm, monogastric_spec, aqua_biomass, equine_dm, guidance_only). Code
--     branches on the model, never on a species name. Unknown / admin-added species stay guidance_only.
--   * weight_history becomes the ONE body-measurement history (owner decision 2026-11-22): weight,
--     body condition score and muscle condition, from any screen (medical records, farm health
--     observations, nutrition). weight is now optional because a condition score can be taken alone.
--   * animals get two owned facts nutrition needs and the animal profile shows: activity_level, housing.
--   * reference data (energy factors, requirement sets, foods, unsafe foods) carries source, licence and
--     a validation status: everything starts 'unvalidated' until the owner's vet signs it off.
--   * plans, plan items, pet feeding logs, risk flags and usage events.
--   * dark-launched behind system setting nutrition.enabled (default false).
--
-- Idempotent, and never hardcodes a schema name. Mirrored at the end of docker/init.sql.

-- ─── 1. Which nutrition model a species / class uses ─────────────────────────
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS nutrition_model VARCHAR(30) NOT NULL DEFAULT 'guidance_only'
  CHECK (nutrition_model IN ('companion_energy', 'ruminant_dm', 'monogastric_spec', 'aqua_biomass', 'equine_dm', 'guidance_only'));
-- Optional per-class override (NULL = use the species model).
ALTER TABLE master_animal_classes ADD COLUMN IF NOT EXISTS nutrition_model VARCHAR(30)
  CHECK (nutrition_model IS NULL OR nutrition_model IN ('companion_energy', 'ruminant_dm', 'monogastric_spec', 'aqua_biomass', 'equine_dm', 'guidance_only'));

-- Only rows still on the default are mapped, so an admin's later choice is never overwritten.
UPDATE master_species SET nutrition_model = 'companion_energy'
 WHERE nutrition_model = 'guidance_only' AND code IN ('Dog', 'Cat');
UPDATE master_species SET nutrition_model = 'ruminant_dm'
 WHERE nutrition_model = 'guidance_only' AND code IN ('Cattle', 'Buffalo', 'Goat', 'Sheep', 'Camel', 'Yak', 'Deer', 'Llama', 'Alpaca');
UPDATE master_species SET nutrition_model = 'monogastric_spec'
 WHERE nutrition_model = 'guidance_only' AND code IN ('Chicken', 'Duck', 'Turkey', 'Quail', 'Emu', 'Ostrich', 'Pig');
UPDATE master_species SET nutrition_model = 'equine_dm'
 WHERE nutrition_model = 'guidance_only' AND code IN ('Horse', 'Donkey');
UPDATE master_species SET nutrition_model = 'aqua_biomass'
 WHERE nutrition_model = 'guidance_only' AND category = 'Aquaculture';

-- ─── 2. weight_history = the one body-measurement history ────────────────────
ALTER TABLE weight_history ALTER COLUMN weight DROP NOT NULL;
ALTER TABLE weight_history ADD COLUMN IF NOT EXISTS body_condition_score NUMERIC(3,1)
  CHECK (body_condition_score IS NULL OR (body_condition_score >= 1 AND body_condition_score <= 9));
ALTER TABLE weight_history ADD COLUMN IF NOT EXISTS bcs_scale SMALLINT
  CHECK (bcs_scale IS NULL OR bcs_scale IN (5, 9));
ALTER TABLE weight_history ADD COLUMN IF NOT EXISTS muscle_condition VARCHAR(10)
  CHECK (muscle_condition IS NULL OR muscle_condition IN ('normal', 'mild', 'moderate', 'marked'));
ALTER TABLE weight_history ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'medical_record'
  CHECK (source IN ('medical_record', 'health_observation', 'nutrition', 'farm_event', 'import'));
ALTER TABLE weight_history ADD COLUMN IF NOT EXISTS source_id UUID;
DO $$ BEGIN
  ALTER TABLE weight_history ADD CONSTRAINT weight_history_has_measure_ck
    CHECK (weight IS NOT NULL OR body_condition_score IS NOT NULL OR muscle_condition IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_weight_history_animal_time ON weight_history(animal_id, recorded_at DESC);

-- ─── 3. Facts the animal profile owns (shown there and asked by nutrition) ────
ALTER TABLE animals ADD COLUMN IF NOT EXISTS activity_level VARCHAR(20)
  CHECK (activity_level IS NULL OR activity_level IN ('low', 'moderate', 'high', 'working'));
ALTER TABLE animals ADD COLUMN IF NOT EXISTS housing VARCHAR(20)
  CHECK (housing IS NULL OR housing IN ('indoor', 'outdoor', 'indoor_outdoor', 'stall_fed', 'grazing', 'semi_grazing'));

-- ─── 4. Energy factors (multiples of resting energy) ─────────────────────────
CREATE TABLE IF NOT EXISTS nutrition_energy_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species_code VARCHAR(50) NOT NULL,
  factor_key VARCHAR(40) NOT NULL,
  factor NUMERIC(5,2) NOT NULL CHECK (factor > 0 AND factor <= 10),
  source TEXT NOT NULL,
  licence VARCHAR(80),
  status VARCHAR(20) NOT NULL DEFAULT 'unvalidated' CHECK (status IN ('unvalidated', 'vet_validated', 'retired')),
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT nutrition_energy_factors_uq UNIQUE (species_code, factor_key)
);

-- MSD Veterinary Manual, "Daily maintenance energy requirements for dogs and cats" (multiples of RER),
-- and AAHA 2021 Nutrition & Weight Management Guidelines (weight-loss factor). See docs/NUTRITION_PLAN.md §2.1.
INSERT INTO nutrition_energy_factors (species_code, factor_key, factor, source, licence) VALUES
  ('Dog', 'adult_intact',        1.8, 'MSD Veterinary Manual - daily maintenance energy requirements table', 'cited reference'),
  ('Dog', 'adult_neutered',      1.6, 'MSD Veterinary Manual - daily maintenance energy requirements table', 'cited reference'),
  ('Dog', 'obesity_prone',       1.4, 'MSD Veterinary Manual - daily maintenance energy requirements table', 'cited reference'),
  ('Dog', 'growth_under_4m',     3.0, 'MSD Veterinary Manual - daily maintenance energy requirements table', 'cited reference'),
  ('Dog', 'growth_4m_to_adult',  2.0, 'MSD Veterinary Manual - daily maintenance energy requirements table', 'cited reference'),
  ('Dog', 'weight_loss',         1.0, 'AAHA 2021 Nutrition and Weight Management Guidelines (factor x RER of ideal weight)', 'cited reference'),
  ('Cat', 'adult_intact',        1.4, 'MSD Veterinary Manual - daily maintenance energy requirements table', 'cited reference'),
  ('Cat', 'adult_neutered',      1.2, 'MSD Veterinary Manual - daily maintenance energy requirements table', 'cited reference'),
  ('Cat', 'obesity_prone',       1.0, 'MSD Veterinary Manual - daily maintenance energy requirements table', 'cited reference'),
  ('Cat', 'growth_under_4m',     2.5, 'MSD Veterinary Manual - daily maintenance energy requirements table (kitten)', 'cited reference'),
  ('Cat', 'growth_4m_to_adult',  2.5, 'MSD Veterinary Manual - daily maintenance energy requirements table (kitten)', 'cited reference'),
  ('Cat', 'weight_loss',         0.8, 'AAHA 2021 Nutrition and Weight Management Guidelines (factor x RER of ideal weight)', 'cited reference')
ON CONFLICT (species_code, factor_key) DO NOTHING;

-- ─── 5. Requirement sets (nutrient minimums / maximums) ──────────────────────
-- Phase 1 ships the structure and the admin screen; the values are loaded per source once the owner
-- holds the right to use them (FEDIAF / AAFCO / NRC / NASEM / ICAR - docs/NUTRITION_PLAN.md §12.1 row 4).
CREATE TABLE IF NOT EXISTS nutrition_requirement_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(60) NOT NULL UNIQUE,
  nutrition_model VARCHAR(30) NOT NULL,
  species_code VARCHAR(50),
  life_stage VARCHAR(40),
  title VARCHAR(200) NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  licence VARCHAR(80),
  version INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'unvalidated' CHECK (status IN ('unvalidated', 'vet_validated', 'retired')),
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS nutrition_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL REFERENCES nutrition_requirement_sets(id) ON DELETE CASCADE,
  nutrient VARCHAR(40) NOT NULL,
  basis VARCHAR(20) NOT NULL CHECK (basis IN ('per_1000kcal', 'per_kg_dm', 'percent_dm', 'per_day', 'per_kg_bw075')),
  min_value NUMERIC(12,4),
  max_value NUMERIC(12,4),
  unit VARCHAR(20) NOT NULL,
  notes TEXT,
  CONSTRAINT nutrition_requirements_uq UNIQUE (set_id, nutrient, basis),
  CONSTRAINT nutrition_requirements_range_ck CHECK (min_value IS NOT NULL OR max_value IS NOT NULL)
);

-- ─── 6. Foods / feeds library ────────────────────────────────────────────────
-- Shared rows (owner_id and enterprise_id NULL) are master data an admin manages. A pet owner's own
-- food (owner_id) and a farm's own feed (enterprise_id) are private to them.
CREATE TABLE IF NOT EXISTS nutrition_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(60) UNIQUE,
  label VARCHAR(200) NOT NULL,
  label_key VARCHAR(150),
  label_hi VARCHAR(200),
  label_kn VARCHAR(200),
  label_ml VARCHAR(200),
  label_ta VARCHAR(200),
  label_te VARCHAR(200),
  kind VARCHAR(30) NOT NULL CHECK (kind IN ('commercial_food', 'home_food', 'treat', 'forage', 'concentrate',
                                            'mineral', 'supplement', 'compound_feed', 'aqua_feed')),
  models TEXT[] NOT NULL DEFAULT '{}',
  energy_kcal_per_100g NUMERIC(8,2) CHECK (energy_kcal_per_100g IS NULL OR (energy_kcal_per_100g >= 0 AND energy_kcal_per_100g <= 1000)),
  dry_matter_pct NUMERIC(5,2) CHECK (dry_matter_pct IS NULL OR (dry_matter_pct > 0 AND dry_matter_pct <= 100)),
  composition JSONB NOT NULL DEFAULT '{}',
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  enterprise_id UUID REFERENCES enterprises(id) ON DELETE CASCADE,
  source TEXT,
  licence VARCHAR(80),
  status VARCHAR(20) NOT NULL DEFAULT 'unvalidated' CHECK (status IN ('unvalidated', 'vet_validated', 'retired')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nutrition_ingredients_owner ON nutrition_ingredients(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nutrition_ingredients_farm ON nutrition_ingredients(enterprise_id) WHERE enterprise_id IS NOT NULL;
-- A farm feed in stock can name the library row it is (Phase 2 least-cost ration reads composition from it).
ALTER TABLE feed_inventory ADD COLUMN IF NOT EXISTS ingredient_id UUID REFERENCES nutrition_ingredients(id) ON DELETE SET NULL;

-- Common home foods (energy as cooked / as eaten). Approximate values from USDA FoodData Central; unvalidated
-- until the owner's vet signs them off. A packaged food's own label is always preferred over these.
INSERT INTO nutrition_ingredients (code, label, label_key, kind, models, energy_kcal_per_100g, source, licence) VALUES
  ('home_rice_cooked',     'Rice, cooked',              'nutrition.foods.home_rice_cooked',     'home_food', '{companion_energy}', 130, 'USDA FoodData Central (approximate)', 'public domain'),
  ('home_chicken_boiled',  'Chicken, boiled, no bones', 'nutrition.foods.home_chicken_boiled',  'home_food', '{companion_energy}', 165, 'USDA FoodData Central (approximate)', 'public domain'),
  ('home_egg_boiled',      'Egg, boiled',               'nutrition.foods.home_egg_boiled',      'home_food', '{companion_energy}', 155, 'USDA FoodData Central (approximate)', 'public domain'),
  ('home_curd',            'Curd (plain yoghurt)',      'nutrition.foods.home_curd',            'home_food', '{companion_energy}',  61, 'USDA FoodData Central (approximate)', 'public domain'),
  ('home_chapati',         'Chapati (plain)',           'nutrition.foods.home_chapati',         'home_food', '{companion_energy}', 297, 'USDA FoodData Central (approximate)', 'public domain'),
  ('home_fish_boiled',     'Fish, boiled, no bones',    'nutrition.foods.home_fish_boiled',     'home_food', '{companion_energy}', 128, 'USDA FoodData Central (approximate)', 'public domain'),
  ('home_pumpkin_boiled',  'Pumpkin, boiled',           'nutrition.foods.home_pumpkin_boiled',  'home_food', '{companion_energy}',  20, 'USDA FoodData Central (approximate)', 'public domain'),
  ('home_paneer',          'Paneer',                    'nutrition.foods.home_paneer',          'home_food', '{companion_energy}', 296, 'USDA FoodData Central (approximate)', 'public domain')
ON CONFLICT (code) DO NOTHING;

-- ─── 7. Foods that are unsafe for a species ──────────────────────────────────
CREATE TABLE IF NOT EXISTS nutrition_unsafe_foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(60) NOT NULL,
  species_code VARCHAR(50) NOT NULL,
  label VARCHAR(200) NOT NULL,
  label_key VARCHAR(150),
  label_hi VARCHAR(200),
  label_kn VARCHAR(200),
  label_ml VARCHAR(200),
  label_ta VARCHAR(200),
  label_te VARCHAR(200),
  match_terms TEXT[] NOT NULL DEFAULT '{}',
  severity VARCHAR(10) NOT NULL DEFAULT 'danger' CHECK (severity IN ('caution', 'danger')),
  source TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unvalidated' CHECK (status IN ('unvalidated', 'vet_validated', 'retired')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT nutrition_unsafe_foods_uq UNIQUE (species_code, code)
);

INSERT INTO nutrition_unsafe_foods (code, species_code, label, label_key, match_terms, severity, source) VALUES
  ('chocolate',  'Dog', 'Chocolate and cocoa',     'nutrition.unsafe.chocolate',  '{chocolate,cocoa}',                 'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('xylitol',    'Dog', 'Xylitol (sugar-free sweets, gum)', 'nutrition.unsafe.xylitol', '{xylitol,sugar-free,sugar free}', 'danger', 'ASPCA Animal Poison Control - people foods to avoid'),
  ('grapes',     'Dog', 'Grapes and raisins',      'nutrition.unsafe.grapes',     '{grape,raisin,kishmish}',           'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('onion',      'Dog', 'Onion and garlic',        'nutrition.unsafe.onion',      '{onion,garlic,pyaz,lahsun}',        'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('macadamia',  'Dog', 'Macadamia nuts',          'nutrition.unsafe.macadamia',  '{macadamia}',                       'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('alcohol',    'Dog', 'Alcohol',                 'nutrition.unsafe.alcohol',    '{alcohol,beer,wine,whisky,rum}',    'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('caffeine',   'Dog', 'Coffee, tea and caffeine','nutrition.unsafe.caffeine',   '{coffee,caffeine,tea}',             'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('cooked_bones','Dog','Cooked bones',            'nutrition.unsafe.cooked_bones','{cooked bone,cooked bones}',        'caution', 'ASPCA Animal Poison Control - people foods to avoid'),
  ('chocolate',  'Cat', 'Chocolate and cocoa',     'nutrition.unsafe.chocolate',  '{chocolate,cocoa}',                 'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('onion',      'Cat', 'Onion and garlic',        'nutrition.unsafe.onion',      '{onion,garlic,pyaz,lahsun}',        'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('grapes',     'Cat', 'Grapes and raisins',      'nutrition.unsafe.grapes',     '{grape,raisin,kishmish}',           'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('alcohol',    'Cat', 'Alcohol',                 'nutrition.unsafe.alcohol',    '{alcohol,beer,wine,whisky,rum}',    'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('caffeine',   'Cat', 'Coffee, tea and caffeine','nutrition.unsafe.caffeine',   '{coffee,caffeine,tea}',             'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('chocolate',  'Parrot', 'Chocolate and cocoa',  'nutrition.unsafe.chocolate',  '{chocolate,cocoa}',                 'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('avocado',    'Parrot', 'Avocado',              'nutrition.unsafe.avocado',    '{avocado,butter fruit}',            'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('caffeine',   'Parrot', 'Coffee, tea and caffeine','nutrition.unsafe.caffeine','{coffee,caffeine,tea}',             'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('salt',       'Parrot', 'Salty snacks',         'nutrition.unsafe.salt',       '{salt,chips,namkeen}',              'caution', 'ASPCA Animal Poison Control - people foods to avoid'),
  ('chocolate',  'Rabbit', 'Chocolate and cocoa',  'nutrition.unsafe.chocolate',  '{chocolate,cocoa}',                 'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('avocado',    'Rabbit', 'Avocado',              'nutrition.unsafe.avocado',    '{avocado,butter fruit}',            'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('onion',      'Rabbit', 'Onion and garlic',     'nutrition.unsafe.onion',      '{onion,garlic,pyaz,lahsun}',        'danger',  'ASPCA Animal Poison Control - people foods to avoid')
ON CONFLICT (species_code, code) DO NOTHING;

-- ─── 8. Plans ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nutrition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID REFERENCES animals(id) ON DELETE CASCADE,
  group_id UUID REFERENCES animal_groups(id) ON DELETE CASCADE,
  enterprise_id UUID REFERENCES enterprises(id) ON DELETE CASCADE,
  nutrition_model VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'superseded', 'archived')),
  validation VARCHAR(20) NOT NULL DEFAULT 'suggested' CHECK (validation IN ('suggested', 'vet_reviewed')),
  goal VARCHAR(20) NOT NULL DEFAULT 'maintain'
    CHECK (goal IN ('maintain', 'lose', 'gain', 'growth', 'gestation', 'lactation', 'production')),
  target_weight_kg NUMERIC(8,2) CHECK (target_weight_kg IS NULL OR target_weight_kg > 0),
  daily_energy_kcal NUMERIC(9,1) CHECK (daily_energy_kcal IS NULL OR daily_energy_kcal >= 0),
  daily_dm_kg NUMERIC(8,3) CHECK (daily_dm_kg IS NULL OR daily_dm_kg >= 0),
  meals_per_day SMALLINT NOT NULL DEFAULT 2 CHECK (meals_per_day BETWEEN 1 AND 12),
  energy_factor_key VARCHAR(40),
  requirement_set_id UUID REFERENCES nutrition_requirement_sets(id) ON DELETE SET NULL,
  engine_version VARCHAR(20) NOT NULL,
  inputs JSONB NOT NULL DEFAULT '{}',
  result JSONB NOT NULL DEFAULT '{}',
  vet_override_kcal NUMERIC(9,1),
  review_note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT nutrition_plans_subject_ck CHECK ((animal_id IS NOT NULL) <> (group_id IS NOT NULL))
);
-- At most one active plan per animal / group.
CREATE UNIQUE INDEX IF NOT EXISTS uq_nutrition_plans_active
  ON nutrition_plans ((COALESCE(animal_id, group_id))) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_animal ON nutrition_plans(animal_id, created_at DESC) WHERE animal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_group ON nutrition_plans(group_id, created_at DESC) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_farm ON nutrition_plans(enterprise_id) WHERE enterprise_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS nutrition_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES nutrition_plans(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES nutrition_ingredients(id) ON DELETE SET NULL,
  label VARCHAR(200) NOT NULL,
  share_pct NUMERIC(5,2) CHECK (share_pct IS NULL OR (share_pct > 0 AND share_pct <= 100)),
  amount_per_day NUMERIC(10,3) CHECK (amount_per_day IS NULL OR amount_per_day >= 0),
  unit VARCHAR(10) NOT NULL DEFAULT 'g' CHECK (unit IN ('g', 'kg')),
  energy_kcal_per_100g NUMERIC(8,2),
  kcal_per_day NUMERIC(9,1),
  cost_per_day NUMERIC(10,2),
  sort_order SMALLINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_nutrition_plan_items_plan ON nutrition_plan_items(plan_id);

-- ─── 9. What a pet actually ate (farm feed stays in farm_daily_records) ─────
CREATE TABLE IF NOT EXISTS nutrition_feeding_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES nutrition_plans(id) ON DELETE SET NULL,
  plan_item_id UUID REFERENCES nutrition_plan_items(id) ON DELETE SET NULL,
  ingredient_id UUID REFERENCES nutrition_ingredients(id) ON DELETE SET NULL,
  label VARCHAR(200) NOT NULL,
  kind VARCHAR(10) NOT NULL DEFAULT 'meal' CHECK (kind IN ('meal', 'treat')),
  amount_g NUMERIC(10,2) CHECK (amount_g IS NULL OR amount_g >= 0),
  kcal NUMERIC(9,1) CHECK (kcal IS NULL OR kcal >= 0),
  fed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  fed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nutrition_feeding_logs_animal_day ON nutrition_feeding_logs(animal_id, fed_on DESC);

-- ─── 10. Risk flags (rules now, models later - every flag is auditable) ───────
CREATE TABLE IF NOT EXISTS nutrition_risk_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID REFERENCES animals(id) ON DELETE CASCADE,
  group_id UUID REFERENCES animal_groups(id) ON DELETE CASCADE,
  flag_type VARCHAR(40) NOT NULL,
  severity VARCHAR(10) NOT NULL DEFAULT 'watch' CHECK (severity IN ('info', 'watch', 'act')),
  params JSONB NOT NULL DEFAULT '{}',
  rule_version VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed', 'resolved')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT nutrition_risk_flags_subject_ck CHECK ((animal_id IS NOT NULL) <> (group_id IS NOT NULL))
);
-- One open flag of a kind per subject; re-evaluating refreshes it instead of piling up duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS uq_nutrition_risk_flags_open
  ON nutrition_risk_flags ((COALESCE(animal_id, group_id)), flag_type) WHERE status = 'open';

-- ─── 11. Usage (so the later pricing decision rests on real use) ─────────────
CREATE TABLE IF NOT EXISTS nutrition_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_role VARCHAR(30),
  event VARCHAR(40) NOT NULL,
  nutrition_model VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nutrition_usage_events_time ON nutrition_usage_events(created_at DESC);

-- ─── 12. Switch ──────────────────────────────────────────────────────────────
INSERT INTO system_settings (key, value, category, description)
VALUES ('nutrition.enabled', 'false', 'nutrition',
        'Master switch for the animal nutrition module (plans, feeding, condition scores). Dark-launch flag, default off.')
ON CONFLICT (key) DO NOTHING;
