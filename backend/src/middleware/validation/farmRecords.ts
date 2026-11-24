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
  // Feed (migration 063): the stock item used; empty = home-grown. With no animal and no group, the entry is for
  // all the farm's animals (only record types that use stock allow that - FarmRecordService decides).
  feedId: Joi.string().uuid().allow(null, '').optional(),
  // Sent again after the person confirmed the withdrawal warning (milk / eggs from a treated animal).
  confirmWithdrawal: Joi.boolean().optional(),
});

// A batch-group event (placement, cull, sale, harvest, clear-out) - see FarmEventService.
export const groupEventSchema = Joi.object({
  groupId: Joi.string().uuid().optional(),
  animalId: Joi.string().uuid().optional(),
  eventType: Joi.string().max(40).required(),
  confirmWithdrawal: Joi.boolean().optional(),
  eventDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  quantity: Joi.alternatives(Joi.number(), Joi.string().allow('')).allow(null).optional(),
  detail: Joi.object().unknown(true).allow(null).optional(),
  notes: Joi.string().max(1000).allow('', null).optional(),
  // Birth only: newborns to add to the herd as animals.
  offspring: Joi.array().items(Joi.object({
    name: Joi.string().trim().max(100).allow('', null),
    gender: Joi.string().valid('male', 'female', 'unknown').allow('', null),
  })).max(10).allow(null).optional(),
});
