/**
 * The nutrition models (docs/NUTRITION_PLAN.md §5.1a). Every species maps to ONE of these in master data
 * (master_species.nutrition_model, optionally overridden per class). Code branches on the model, never on a
 * species name, so a species an admin adds tomorrow is handled the day it exists (as guidance_only until
 * mapped).
 */
export const NUTRITION_MODELS = [
  'companion_energy', // dog, cat: kcal/day from resting energy x life-stage factor
  'ruminant_dm',      // cattle, buffalo, goat, sheep, camel: dry matter, energy, protein, minerals per day
  'monogastric_spec', // poultry, pig: % diet specification by stage, feed per head per day
  'aqua_biomass',     // fish, shrimp: % of biomass per day by size and water temperature
  'equine_dm',        // horse, donkey: forage-first dry matter
  'guidance_only',    // any species without vetted requirement data: safe foods, weight, condition, vet referral
] as const;

export type NutritionModel = typeof NUTRITION_MODELS[number];

export const isNutritionModel = (v: unknown): v is NutritionModel =>
  typeof v === 'string' && (NUTRITION_MODELS as readonly string[]).includes(v);

/** Models whose ration calculator exists in this build. The rest show guidance until their phase ships. */
export const CALCULATOR_MODELS: ReadonlySet<NutritionModel> = new Set<NutritionModel>(['companion_energy', 'ruminant_dm', 'equine_dm']);

/** Stored on every plan so an old plan can always be explained with the rules that made it. */
export const ENGINE_VERSION = '1.1.0';
/** Stored on every risk flag. Bump when a threshold in rules.ts changes. */
export const RULE_VERSION = '1.1.0';

export const PLAN_GOALS = ['maintain', 'lose', 'gain', 'growth', 'gestation', 'lactation', 'production'] as const;
export type PlanGoal = typeof PLAN_GOALS[number];

export const ACTIVITY_LEVELS = ['low', 'moderate', 'high', 'working'] as const;
export type ActivityLevel = typeof ACTIVITY_LEVELS[number];

export const HOUSING_TYPES = ['indoor', 'outdoor', 'indoor_outdoor', 'stall_fed', 'grazing', 'semi_grazing'] as const;
export type Housing = typeof HOUSING_TYPES[number];

export const MUSCLE_CONDITIONS = ['normal', 'mild', 'moderate', 'marked'] as const;
export type MuscleCondition = typeof MUSCLE_CONDITIONS[number];
