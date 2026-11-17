import Joi from 'joi';

// ─── Master Data (admin CRUD: species/breeds/animal classes/marketplace categories/conditions) ───
// Per-locale label overrides shared by every master-data entity (migrations 025/026).
const localeLabelFields = {
  labelHi: Joi.string().max(150).allow('', null).optional(),
  labelKn: Joi.string().max(150).allow('', null).optional(),
  labelMl: Joi.string().max(150).allow('', null).optional(),
  labelTa: Joi.string().max(150).allow('', null).optional(),
  labelTe: Joi.string().max(150).allow('', null).optional(),
};

// Farm-profile capability flags on a species (migration 043). All optional: a species an admin
// adds without them keeps the column defaults (segment 'pet', every capability off).
const FARM_SEGMENTS = ['dairy', 'small_ruminant', 'pig', 'poultry', 'aquaculture', 'equine', 'other_livestock', 'pet'];
const speciesFarmFields = {
  defaultManagementMode: Joi.string().valid('individual', 'batch').optional(),
  farmSegment: Joi.string().valid(...FARM_SEGMENTS).optional(),
  producesMilk: Joi.boolean().optional(),
  producesEggs: Joi.boolean().optional(),
  producesWool: Joi.boolean().optional(),
  isAquatic: Joi.boolean().optional(),
  litterExpected: Joi.boolean().optional(),
  gestationDays: Joi.number().integer().min(1).max(1000).allow(null, '').optional(),
  incubationDays: Joi.number().integer().min(1).max(1000).allow(null, '').optional(),
  birthEventTerm: Joi.string().valid('birth', 'calving', 'kidding', 'lambing', 'farrowing', 'foaling', 'hatching', 'spawning').optional(),
  scientificName: Joi.string().max(150).allow('', null).optional(),
  waterType: Joi.string().valid('fresh', 'brackish', 'marine').allow('', null).optional(),
  waterQualityRanges: Joi.object().unknown(true).allow(null).optional(),
};
export const createMasterSpeciesSchema = Joi.object({
  code: Joi.string().min(1).max(50).required(),
  label: Joi.string().min(1).max(100).required(),
  labelKey: Joi.string().max(150).allow('', null).optional(),
  labelHi: Joi.string().max(150).allow('', null).optional(),
  labelKn: Joi.string().max(150).allow('', null).optional(),
  labelMl: Joi.string().max(150).allow('', null).optional(),
  labelTa: Joi.string().max(150).allow('', null).optional(),
  labelTe: Joi.string().max(150).allow('', null).optional(),
  icon: Joi.string().max(10).allow('', null).optional(),
  category: Joi.string().max(50).allow('', null).optional(),
  hasEarTag: Joi.boolean().optional(),
  sortOrder: Joi.number().integer().optional(),
  isMarketplaceEligible: Joi.boolean().optional(),
  ...speciesFarmFields,
});
export const updateMasterSpeciesSchema = Joi.object({
  label: Joi.string().min(1).max(100).optional(),
  labelKey: Joi.string().max(150).allow('', null).optional(),
  labelHi: Joi.string().max(150).allow('', null).optional(),
  labelKn: Joi.string().max(150).allow('', null).optional(),
  labelMl: Joi.string().max(150).allow('', null).optional(),
  labelTa: Joi.string().max(150).allow('', null).optional(),
  labelTe: Joi.string().max(150).allow('', null).optional(),
  icon: Joi.string().max(10).allow('', null).optional(),
  category: Joi.string().max(50).allow('', null).optional(),
  hasEarTag: Joi.boolean().optional(),
  sortOrder: Joi.number().integer().optional(),
  isMarketplaceEligible: Joi.boolean().optional(),
  ...speciesFarmFields,
});

export const createMasterBreedSchema = Joi.object({
  speciesId: Joi.string().uuid().required(),
  name: Joi.string().min(1).max(150).required(),
  sortOrder: Joi.number().integer().optional(),
  ...localeLabelFields,
});
export const updateMasterBreedSchema = Joi.object({
  name: Joi.string().min(1).max(150).optional(),
  sortOrder: Joi.number().integer().optional(),
  ...localeLabelFields,
});

export const createMasterAnimalClassSchema = Joi.object({
  speciesId: Joi.string().uuid().required(),
  value: Joi.string().min(1).max(50).required(),
  labelKey: Joi.string().max(150).allow('', null).optional(),
  label: Joi.string().max(100).allow('', null).optional(),
  impliedGender: Joi.string().valid('male', 'female', 'unknown').required(),
  canBePregnant: Joi.boolean().optional(),
  canProduceMilk: Joi.boolean().optional(),
  canLayEggs: Joi.boolean().optional(),
  isJuvenile: Joi.boolean().optional(),
  sortOrder: Joi.number().integer().optional(),
  ...localeLabelFields,
});
export const updateMasterAnimalClassSchema = Joi.object({
  labelKey: Joi.string().max(150).allow('', null).optional(),
  label: Joi.string().max(100).allow('', null).optional(),
  impliedGender: Joi.string().valid('male', 'female', 'unknown').optional(),
  canBePregnant: Joi.boolean().optional(),
  canProduceMilk: Joi.boolean().optional(),
  canLayEggs: Joi.boolean().optional(),
  isJuvenile: Joi.boolean().optional(),
  sortOrder: Joi.number().integer().optional(),
  ...localeLabelFields,
});

export const createMasterMarketplaceCategorySchema = Joi.object({
  code: Joi.string().min(1).max(50).required(),
  labelKey: Joi.string().max(150).allow('', null).optional(),
  label: Joi.string().max(100).allow('', null).optional(),
  icon: Joi.string().max(10).allow('', null).optional(),
  sortOrder: Joi.number().integer().optional(),
  ...localeLabelFields,
});
export const updateMasterMarketplaceCategorySchema = Joi.object({
  labelKey: Joi.string().max(150).allow('', null).optional(),
  label: Joi.string().max(100).allow('', null).optional(),
  icon: Joi.string().max(10).allow('', null).optional(),
  sortOrder: Joi.number().integer().optional(),
  ...localeLabelFields,
});

export const createMasterMarketplaceConditionSchema = Joi.object({
  code: Joi.string().min(1).max(30).required(),
  labelKey: Joi.string().max(150).allow('', null).optional(),
  label: Joi.string().max(100).allow('', null).optional(),
  sortOrder: Joi.number().integer().optional(),
  ...localeLabelFields,
});
export const updateMasterMarketplaceConditionSchema = Joi.object({
  labelKey: Joi.string().max(150).allow('', null).optional(),
  label: Joi.string().max(100).allow('', null).optional(),
  sortOrder: Joi.number().integer().optional(),
  ...localeLabelFields,
});


// ─── Farm profile: group types and record types (migration 043) ───
const groupTypeFields = {
  label: Joi.string().min(1).max(100),
  icon: Joi.string().max(10).allow('', null).optional(),
  managementMode: Joi.string().valid('individual', 'batch').allow('', null).optional(),
  suggestedClass: Joi.string().max(50).allow('', null).optional(),
  isHealthHold: Joi.boolean().optional(),
  yieldsMilk: Joi.boolean().optional(),
  yieldsEggs: Joi.boolean().optional(),
  sortOrder: Joi.number().integer().optional(),
  ...localeLabelFields,
};
// Exactly one of speciesId / farmSegment - the service enforces "exactly one" with a clear message.
export const createMasterGroupTypeSchema = Joi.object({
  speciesId: Joi.string().uuid().allow('', null).optional(),
  farmSegment: Joi.string().valid(...FARM_SEGMENTS).allow('', null).optional(),
  // Stored as text on animal_groups.group_type, so keep it a plain lower-case code.
  value: Joi.string().pattern(/^[a-z0-9_]+$/).min(1).max(50).required()
    .messages({ 'string.pattern.base': 'Code may contain only lower-case letters, digits and underscores (for example "lactating").' }),
  ...groupTypeFields,
  label: groupTypeFields.label.required(),
});
export const updateMasterGroupTypeSchema = Joi.object({
  ...groupTypeFields,
  label: groupTypeFields.label.optional(),
});

// Record types are keyed by `code` in application logic: only wording, icon, unit and order are editable.
export const updateMasterRecordTypeSchema = Joi.object({
  label: Joi.string().min(1).max(100).optional(),
  icon: Joi.string().max(10).allow('', null).optional(),
  unit: Joi.string().max(20).allow('', null).optional(),
  sortOrder: Joi.number().integer().optional(),
  ...localeLabelFields,
});

export const resolveFarmProfileQuerySchema = Joi.object({
  species: Joi.string().max(50).required(),
  animalClass: Joi.string().max(50).allow('').optional(),
  gender: Joi.string().max(20).allow('').optional(),
  managementMode: Joi.string().valid('individual', 'batch').allow('').optional(),
  groupType: Joi.string().max(50).allow('').optional(),
});
