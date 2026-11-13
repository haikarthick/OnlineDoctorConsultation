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
  sortOrder: Joi.number().integer().optional(),
  ...localeLabelFields,
});
export const updateMasterAnimalClassSchema = Joi.object({
  labelKey: Joi.string().max(150).allow('', null).optional(),
  label: Joi.string().max(100).allow('', null).optional(),
  impliedGender: Joi.string().valid('male', 'female', 'unknown').optional(),
  canBePregnant: Joi.boolean().optional(),
  canProduceMilk: Joi.boolean().optional(),
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

