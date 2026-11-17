import Joi from 'joi';

// ─── Reusable field patterns ─────────────────────────────────
export const uuid = Joi.string().uuid();
export const requiredUuid = uuid.required();
export const shortText = (max = 255) => Joi.string().max(max).trim();
export const longText = (max = 5000) => Joi.string().max(max).trim();
export const positiveInt = Joi.number().integer().min(0);
export const positiveNumber = Joi.number().min(0);
