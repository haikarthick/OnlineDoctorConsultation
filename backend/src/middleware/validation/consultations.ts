import Joi from 'joi';
import { uuid, requiredUuid, shortText, longText, positiveInt } from './core';

// ─── Consultation ────────────────────────────────────────────
export const createConsultationSchema = Joi.object({
  veterinarianId: requiredUuid.messages({ 'string.guid': 'Veterinarian ID must be a valid UUID', 'any.required': 'Veterinarian ID is required' }),
  animalType: Joi.string().min(2).max(100).required().messages({ 'any.required': 'Animal type is required' }),
  symptomDescription: Joi.string().min(10).max(2000).required().messages({
    'string.min': 'Symptom description must be at least 10 characters',
    'any.required': 'Symptom description is required',
  }),
  scheduledAt: Joi.date().iso().min('now').optional().messages({ 'date.min': 'Scheduled date must be in the future' }),
  animalId: uuid.optional().allow(null),
  bookingId: uuid.optional().allow(null),
  petOwnerId: uuid.optional().allow(null),
});

export const updateConsultationSchema = Joi.object({
  status: Joi.string().valid('scheduled', 'in_progress', 'completed', 'cancelled').optional(),
  diagnosis: longText().allow('', null).optional(),
  prescription: longText().optional(),
  notes: Joi.string().max(10000).allow('', null).optional(),
  duration: positiveInt.optional(),
  animalId: uuid.allow(null).optional(),
  startedAt: Joi.date().iso().optional().allow(null),
  completedAt: Joi.date().iso().optional().allow(null),
}).min(1).messages({ 'object.min': 'At least one field must be provided for update' });

// ─── Booking ─────────────────────────────────────────────────
export const createBookingSchema = Joi.object({
  veterinarianId: requiredUuid,
  animalId: uuid.optional(),
  enterpriseId: uuid.optional(),
  groupId: uuid.optional(),
  hospitalId: uuid.optional(),
  scheduledDate: Joi.string().required().pattern(/^\d{4}-\d{2}-\d{2}$/).messages({ 'string.pattern.base': 'Date must be YYYY-MM-DD' }),
  timeSlotStart: Joi.string().required().pattern(/^\d{2}:\d{2}/).messages({ 'string.pattern.base': 'Time must be HH:MM format' }),
  timeSlotEnd: Joi.string().required().pattern(/^\d{2}:\d{2}/).messages({ 'string.pattern.base': 'Time must be HH:MM format' }),
  bookingType: Joi.string().valid('video_call', 'in_person', 'phone', 'chat', 'farm_visit', 'herd_consultation').required(),
  priority: Joi.string().valid('low', 'normal', 'high', 'emergency').default('normal'),
  reasonForVisit: Joi.string().min(3).max(1000).required(),
  symptoms: longText().optional().allow('', null),
  notes: longText().optional().allow('', null),
});

export const rescheduleBookingSchema = Joi.object({
  scheduledDate: Joi.string().required().pattern(/^\d{4}-\d{2}-\d{2}$/),
  timeSlotStart: Joi.string().required().pattern(/^\d{2}:\d{2}/),
  timeSlotEnd: Joi.string().required().pattern(/^\d{2}:\d{2}/),
  veterinarianId: Joi.string().uuid().optional(),
});

export const cancelBookingSchema = Joi.object({
  reason: shortText(500).optional().allow('', null),
  // D7: patient's refund destination choice (wallet = instant, gateway = 5-7 days)
  refundDestination: Joi.string().valid('wallet', 'gateway').optional().default('wallet'),
});

// ─── Video Session ───────────────────────────────────────────
export const createVideoSessionSchema = Joi.object({
  consultationId: requiredUuid,
  participantUserId: requiredUuid,
});

export const endVideoSessionSchema = Joi.object({
  recordingUrl: Joi.string().uri().optional().allow('', null),
});

export const sendVideoMessageSchema = Joi.object({
  message: Joi.string().min(1).max(5000).required(),
  messageType: Joi.string().valid('text', 'image', 'file', 'system').default('text'),
});

// ─── Schedule ────────────────────────────────────────────────
const dayOfWeekValidator = Joi.string().valid('monday','tuesday','wednesday','thursday','friday','saturday','sunday');

export const createScheduleSchema = Joi.object({
  veterinarianId: uuid.optional(),
  dayOfWeek: dayOfWeekValidator.required(),
  startTime: Joi.string().required().pattern(/^\d{2}:\d{2}/),
  endTime: Joi.string().required().pattern(/^\d{2}:\d{2}/),
  slotDuration: Joi.number().integer().min(5).max(240).optional(),
  slotDurationMinutes: Joi.number().integer().min(5).max(240).optional(),
  maxAppointments: Joi.number().integer().min(1).max(100).optional(),
  isAvailable: Joi.boolean().optional(),
});

export const updateScheduleSchema = Joi.object({
  veterinarianId: uuid.optional(),
  dayOfWeek: dayOfWeekValidator.optional(),
  startTime: Joi.string().pattern(/^\d{2}:\d{2}/).optional(),
  endTime: Joi.string().pattern(/^\d{2}:\d{2}/).optional(),
  slotDuration: Joi.number().integer().min(5).max(240).optional(),
  slotDurationMinutes: Joi.number().integer().min(5).max(240).optional(),
  maxAppointments: Joi.number().integer().min(1).max(100).optional(),
  isAvailable: Joi.boolean().optional(),
}).min(1);

// ─── Prescription ────────────────────────────────────────────
const medicationSchema = Joi.object({
  name: Joi.string().max(255).required(),
  dosage: Joi.string().max(255).required(),
  frequency: Joi.string().max(255).required(),
  duration: Joi.string().max(255).optional().allow('', null),
  instructions: shortText(500).optional().allow('', null),
});

export const createPrescriptionSchema = Joi.object({
  consultationId: uuid.optional().allow('', null),
  petOwnerId: uuid.optional(),
  // A prescription has ONE subject: an animal OR a group - never both. `xor` enforces exactly
  // one at the edge so a bad request never reaches the database CHECK. Group records carry the
  // batch facts (head count + production cycle). See docs/BATCH_ANIMAL_MANAGEMENT_PLAN.md.
  animalId: uuid.optional(),
  groupId: uuid.optional(),
  cycleId: uuid.optional(),
  headCountTreated: Joi.number().integer().min(0).optional(),
  medications: Joi.array().items(medicationSchema).min(1).required(),
  instructions: Joi.string().max(5000).optional().allow('', null),
  validUntil: Joi.string().optional().allow('', null),
  diagnosis: longText().optional().allow('', null),
  followUpDate: Joi.string().optional().allow('', null),
}).xor('animalId', 'groupId');

