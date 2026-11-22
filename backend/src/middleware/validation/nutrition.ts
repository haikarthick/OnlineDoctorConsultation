import Joi from 'joi';

// ─── Animal nutrition (migration 056, docs/NUTRITION_PLAN.md) ───
// Ranges and meaning are re-checked in NutritionService with plain-language messages; these schemas keep
// malformed requests out at the edge.

const isoDate = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
const kcalPer100g = Joi.number().min(0).max(1000).allow(null, '');

export const nutritionFactsSchema = Joi.object({
  dateOfBirth: isoDate.allow(null, '').optional(),
  gender: Joi.string().valid('male', 'female', 'unknown').optional(),
  isNeutered: Joi.boolean().optional(),
  activityLevel: Joi.string().valid('low', 'moderate', 'high', 'working').allow(null, '').optional(),
  housing: Joi.string().valid('indoor', 'outdoor', 'indoor_outdoor', 'stall_fed', 'grazing', 'semi_grazing').allow(null, '').optional(),
}).min(1);

export const nutritionMeasurementSchema = Joi.object({
  weight: Joi.number().positive().max(20000).allow(null, '').optional(),
  unit: Joi.string().valid('kg', 'g', 'lbs').optional(),
  bodyConditionScore: Joi.number().min(1).max(9).allow(null, '').optional(),
  bcsScale: Joi.number().valid(5, 9).allow(null).optional(),
  muscleCondition: Joi.string().valid('normal', 'mild', 'moderate', 'marked').allow(null, '').optional(),
  notes: Joi.string().max(500).allow('', null).optional(),
  recordedAt: Joi.string().max(40).allow(null, '').optional(),
});

const foodChoice = Joi.object({
  ingredientId: Joi.string().uuid().allow(null, '').optional(),
  label: Joi.string().max(200).allow(null, '').optional(),
  kcalPer100g,
  sharePct: Joi.number().greater(0).max(100).required(),
});

export const nutritionPlanSchema = Joi.object({
  goal: Joi.string().valid('maintain', 'lose', 'gain', 'growth', 'gestation', 'lactation', 'production').allow(null).optional(),
  targetWeightKg: Joi.number().positive().max(20000).allow(null, '').optional(),
  mealsPerDay: Joi.number().integer().min(1).max(12).optional(),
  foods: Joi.array().items(foodChoice).min(1).max(12).required(),
  markReviewed: Joi.boolean().optional(),
  reviewNote: Joi.string().max(2000).allow('', null).optional(),
});

export const nutritionPlanReviewSchema = Joi.object({
  overrideKcal: Joi.number().positive().max(50000).allow(null, '').optional(),
  note: Joi.string().max(2000).allow('', null).optional(),
});

export const nutritionFeedingSchema = Joi.object({
  planItemId: Joi.string().uuid().allow(null, '').optional(),
  ingredientId: Joi.string().uuid().allow(null, '').optional(),
  label: Joi.string().max(200).allow(null, '').optional(),
  kind: Joi.string().valid('meal', 'treat').optional(),
  amountG: Joi.number().min(0).max(100000).allow(null, '').optional(),
  kcal: Joi.number().min(0).max(50000).allow(null, '').optional(),
  fedOn: isoDate.allow(null, '').optional(),
});

export const nutritionFoodSchema = Joi.object({
  animalId: Joi.string().uuid().allow(null, '').optional(),
  label: Joi.string().trim().min(1).max(200).required(),
  kcalPer100g,
  kind: Joi.string().valid('commercial_food', 'home_food', 'treat').optional(),
});

// Farm ration (ruminant_dm): the feeds the farmer has, their prices and limits (migration 057).
export const nutritionRationSchema = Joi.object({
  milkLitresPerDay: Joi.number().min(0).max(200).allow(null, '').optional(),
  milkFatPct: Joi.number().greater(0).max(15).allow(null, '').optional(),
  feeds: Joi.array().items(Joi.object({
    ingredientId: Joi.string().uuid().required(),
    pricePerKg: Joi.number().min(0).max(100000).allow(null, '').optional(),
    minKg: Joi.number().min(0).max(500).allow(null, '').optional(),
    maxKg: Joi.number().min(0).max(500).allow(null, '').optional(),
  })).min(1).max(25).required(),
});

export const nutritionFlagStatusSchema = Joi.object({
  status: Joi.string().valid('reviewed', 'dismissed').required(),
});

// ─── Admin master data ───
const localeLabels = {
  labelHi: Joi.string().max(200).allow('', null).optional(),
  labelKn: Joi.string().max(200).allow('', null).optional(),
  labelMl: Joi.string().max(200).allow('', null).optional(),
  labelTa: Joi.string().max(200).allow('', null).optional(),
  labelTe: Joi.string().max(200).allow('', null).optional(),
};
const status = Joi.string().valid('unvalidated', 'owner_approved', 'vet_validated', 'retired');
const model = Joi.string().valid('companion_energy', 'ruminant_dm', 'monogastric_spec', 'aqua_biomass', 'equine_dm', 'guidance_only');

export const nutritionSpeciesModelSchema = Joi.object({ nutritionModel: model.required() });

export const nutritionEnergyFactorSchema = Joi.object({
  speciesCode: Joi.string().max(50).optional(),
  factorKey: Joi.string().max(40).pattern(/^[a-z0-9_]+$/).optional(),
  factor: Joi.number().greater(0).max(10).optional(),
  source: Joi.string().max(500).optional(),
  licence: Joi.string().max(80).allow('', null).optional(),
  status: status.optional(),
}).min(1);

export const nutritionAdminFoodSchema = Joi.object({
  code: Joi.string().max(60).pattern(/^[a-z0-9_]+$/).allow(null, '').optional(),
  label: Joi.string().trim().max(200).optional(),
  ...localeLabels,
  kind: Joi.string().valid('commercial_food', 'home_food', 'treat', 'forage', 'concentrate', 'mineral', 'supplement', 'compound_feed', 'aqua_feed').optional(),
  models: Joi.array().items(model).max(6).optional(),
  kcalPer100g,
  dryMatterPct: Joi.number().greater(0).max(100).allow(null, '').optional(),
  composition: Joi.object().pattern(Joi.string().max(40), Joi.number()).optional(),
  source: Joi.string().max(500).allow('', null).optional(),
  licence: Joi.string().max(80).allow('', null).optional(),
  status: status.optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

export const nutritionUnsafeFoodSchema = Joi.object({
  code: Joi.string().max(60).pattern(/^[a-z0-9_]+$/).optional(),
  speciesCode: Joi.string().max(50).optional(),
  label: Joi.string().trim().max(200).optional(),
  ...localeLabels,
  matchTerms: Joi.array().items(Joi.string().max(60)).max(30).optional(),
  severity: Joi.string().valid('caution', 'danger').optional(),
  source: Joi.string().max(500).optional(),
  status: status.optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

export const nutritionRequirementSetSchema = Joi.object({
  code: Joi.string().max(60).pattern(/^[a-z0-9_]+$/).optional(),
  nutritionModel: model.optional(),
  speciesCode: Joi.string().max(50).allow(null, '').optional(),
  lifeStage: Joi.string().max(40).allow(null, '').optional(),
  title: Joi.string().max(200).optional(),
  source: Joi.string().max(500).optional(),
  sourceUrl: Joi.string().max(500).allow(null, '').optional(),
  licence: Joi.string().max(80).allow(null, '').optional(),
  status: status.optional(),
  requirements: Joi.array().items(Joi.object({
    nutrient: Joi.string().max(40).required(),
    basis: Joi.string().valid('per_1000kcal', 'per_kg_dm', 'percent_dm', 'per_day', 'per_kg_bw075', 'percent_bw', 'fraction', 'percent_milk').required(),
    minValue: Joi.number().allow(null).optional(),
    maxValue: Joi.number().allow(null).optional(),
    unit: Joi.string().max(20).required(),
    notes: Joi.string().max(500).allow('', null).optional(),
  })).max(200).optional(),
}).min(1);
