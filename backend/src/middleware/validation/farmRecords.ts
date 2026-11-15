import Joi from 'joi';

// ─── Farm daily records (migration 045) ───
// The shape of `detail` is decided by the record type's own `fields` in master data and checked
// by FarmRecordService, so it is accepted here as a plain object.
export const saveFarmRecordSchema = Joi.object({
  enterpriseId: Joi.string().uuid().optional(),
  animalId: Joi.string().uuid().allow(null, '').optional(),
  groupId: Joi.string().uuid().allow(null, '').optional(),
  recordType: Joi.string().max(40).required(),
  recordDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  session: Joi.string().valid('am', 'pm', 'day').optional(),
  quantity: Joi.alternatives(Joi.number(), Joi.string().allow('')).allow(null).optional(),
  detail: Joi.object().unknown(true).allow(null).optional(),
  notes: Joi.string().max(1000).allow('', null).optional(),
});

// A batch-group event (placement, cull, sale, harvest, clear-out) - see FarmEventService.
export const groupEventSchema = Joi.object({
  groupId: Joi.string().uuid().required(),
  eventType: Joi.string().max(40).required(),
  eventDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  quantity: Joi.alternatives(Joi.number(), Joi.string().allow('')).allow(null).optional(),
  detail: Joi.object().unknown(true).allow(null).optional(),
  notes: Joi.string().max(1000).allow('', null).optional(),
});
