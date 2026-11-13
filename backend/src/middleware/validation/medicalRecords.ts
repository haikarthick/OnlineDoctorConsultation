import Joi from 'joi';
import { uuid, requiredUuid, shortText, longText, positiveInt, positiveNumber } from './core';

// ─── Animal ──────────────────────────────────────────────────
export const createAnimalSchema = Joi.object({
  name: shortText(100).required(),
  species: shortText(100).required(),
  breed: shortText(100).optional().allow('', null),
  dateOfBirth: Joi.string().optional().allow('', null),
  gender: Joi.string().valid('male', 'female', 'unknown').optional(),
  weight: positiveNumber.optional().allow(null),
  color: shortText(50).optional().allow('', null),
  microchipId: shortText(50).optional().allow('', null),
  earTagId: shortText(50).optional().allow('', null),
  registrationNumber: shortText(100).optional().allow('', null),
  isNeutered: Joi.boolean().optional(),
  insuranceProvider: shortText().optional().allow('', null),
  insurancePolicyNumber: shortText().optional().allow('', null),
  insuranceExpiry: Joi.string().optional().allow('', null),
  medicalNotes: longText(10000).optional().allow('', null),
  enterpriseId: uuid.optional().allow(null, ''),
  groupId: uuid.optional().allow(null, ''),
  animalClass: shortText(30).optional().allow('', null),
  sireId: uuid.optional().allow(null, ''),
  damId: uuid.optional().allow(null, ''),
  breedingStatus: Joi.string().valid('not_bred', 'pregnant', 'not_pregnant').optional().allow('', null),
  lastBreedingDate: Joi.string().optional().allow('', null),
  expectedDueDate: Joi.string().optional().allow('', null),
});

export const updateAnimalSchema = createAnimalSchema.fork(
  ['name', 'species'], (schema) => schema.optional()
).min(1);

// ─── Vet Profile ─────────────────────────────────────────────
export const createVetProfileSchema = Joi.object({
  licenseNumber: shortText(100).required(),
  specializations: Joi.array().items(Joi.string().max(100)).optional(),
  qualifications: Joi.array().items(Joi.string().max(200)).optional(),
  yearsOfExperience: positiveInt.max(80).optional(),
  bio: longText(2000).optional().allow('', null),
  clinicName: shortText().optional().allow('', null),
  clinicAddress: longText(500).optional().allow('', null),
  consultationFee: positiveNumber.max(100000).optional(),
  currency: Joi.string().max(3).optional(),
  isAvailable: Joi.boolean().optional(),
  acceptsEmergency: Joi.boolean().optional(),
  availableDays: shortText().optional().allow('', null),
  availableHoursStart: Joi.string().pattern(/^\d{2}:\d{2}/).optional().allow('', null),
  availableHoursEnd: Joi.string().pattern(/^\d{2}:\d{2}/).optional().allow('', null),
  languages: Joi.array().items(Joi.string().max(50)).optional(),
  profileImage: Joi.string().uri({ allowRelative: true }).max(500).optional().allow('', null),
  // Payment module (P3/P4): emergency fee, GST + payout details
  emergencyConsultationFee: positiveNumber.max(100000).optional().allow(null),
  gstin: Joi.string().max(20).optional().allow('', null),
  payoutAccountName: Joi.string().max(255).optional().allow('', null),
  payoutAccountNumber: Joi.string().max(50).optional().allow('', null),
  payoutIfsc: Joi.string().max(20).optional().allow('', null),
  payoutUpi: Joi.string().max(100).optional().allow('', null),
});

export const updateVetProfileSchema = createVetProfileSchema.fork(
  ['licenseNumber'], (schema) => schema.optional()
).min(1);

// ─── Medical Record ──────────────────────────────────────────
export const createMedicalRecordSchema = Joi.object({
  animalId: uuid.optional(),
  // A record has ONE subject: an animal or a group. `xor` enforces exactly one at the edge so a
  // bad request never reaches the database CHECK. Group records carry the batch facts.
  groupId: uuid.optional(),
  cycleId: uuid.optional(),
  eventDate: Joi.string().optional().allow('', null),
  headCountTreated: Joi.number().integer().min(0).optional(),
  affectedCount: Joi.number().integer().min(0).optional(),
  mortalityCount: Joi.number().integer().min(0).optional(),
  consultationId: uuid.optional(),
  veterinarianId: uuid.optional(),
  // MEDIUM FIX-7: Validate recordType against DB CHECK constraint
  recordType: Joi.string().valid('diagnosis', 'prescription', 'lab_report', 'vaccination', 'surgery', 'imaging', 'follow_up', 'other').required(),
  title: shortText().required(),
  content: longText(10000).required(),
  severity: Joi.string().valid('low', 'normal', 'high', 'critical').optional(),
  medications: Joi.array().items(Joi.object()).optional(),
  attachments: Joi.array().items(Joi.object()).optional(),
  isConfidential: Joi.boolean().optional(),
  followUpDate: Joi.string().optional().allow('', null),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  fileUrl: Joi.string().uri().optional().allow('', null),
  userId: uuid.optional(),
  _userName: shortText().optional().allow('', null),
// Exactly one subject, rejected at the edge so a bad request never reaches the DB CHECK.
}).xor('animalId', 'groupId');

export const updateMedicalRecordSchema = createMedicalRecordSchema.fork(
  ['recordType', 'title', 'content'], (schema) => schema.optional()
).keys({
  changeReason: shortText(500).optional().allow('', null),
}).min(1);

export const deleteMedicalRecordSchema = Joi.object({
  reason: shortText(500).optional().allow('', null),
});

// ─── Vaccination ─────────────────────────────────────────────
export const createVaccinationSchema = Joi.object({
  // animalId OR groupId - see createMedicalRecordSchema.
  animalId: uuid.optional(),
  groupId: uuid.optional(),
  cycleId: uuid.optional(),
  headCountTreated: Joi.number().integer().min(0).optional(),
  vaccineName: shortText().required(),
  vaccineType: shortText(100).optional().allow('', null),
  batchNumber: shortText(100).optional().allow('', null),
  manufacturer: shortText().optional().allow('', null),
  dateAdministered: Joi.string().required(),
  nextDueDate: Joi.string().optional().allow('', null),
  administeredBy: shortText().optional().allow('', null),
  siteOfAdministration: shortText().optional().allow('', null),
  dosage: shortText(100).optional().allow('', null),
  reactionNotes: longText(2000).optional().allow('', null),
  certificateNumber: shortText(100).optional().allow('', null),
  // Protocol linkage - when vet selects a protocol from the master list,
  // this ID triggers auto-assignment in animal_vaccine_assignments so the
  // vaccination shows on the Vaccination Passport page.
  protocolId: uuid.optional(),
// Exactly one subject - see createMedicalRecordSchema.
}).xor('animalId', 'groupId');

export const updateVaccinationSchema = createVaccinationSchema.fork(
  ['animalId', 'vaccineName', 'dateAdministered'], (schema) => schema.optional()
).min(1);

// ─── Weight History ──────────────────────────────────────────
export const addWeightSchema = Joi.object({
  animalId: requiredUuid,
  weight: Joi.number().positive().required(),
  unit: Joi.string().valid('kg', 'lbs', 'g').optional().default('kg'),
  notes: shortText(500).optional().allow('', null),
});

// ─── Allergy ─────────────────────────────────────────────────
export const createAllergySchema = Joi.object({
  animalId: requiredUuid,
  allergen: shortText().required(),
  reaction: shortText(500).optional().allow('', null),
  // MEDIUM FIX-7: Sync allergy severity with DB CHECK constraint (removed 'life-threatening')
  severity: Joi.string().valid('mild', 'moderate', 'severe').optional(),
  identifiedDate: Joi.string().optional().allow('', null),
  isActive: Joi.boolean().optional().default(true),
  notes: longText(2000).optional().allow('', null),
});

export const updateAllergySchema = createAllergySchema.fork(
  ['animalId', 'allergen'], (schema) => schema.optional()
).min(1);

// ─── Lab Result ──────────────────────────────────────────────
export const createLabResultSchema = Joi.object({
  animalId: requiredUuid,
  testName: shortText().required(),
  testCategory: shortText(100).optional().allow('', null),
  testDate: Joi.string().required(),
  resultValue: shortText(500).optional().allow('', null),
  normalRange: shortText(100).optional().allow('', null),
  unit: shortText(50).optional().allow('', null),
  // MEDIUM FIX-7: Sync lab status with DB CHECK constraint (removed 'cancelled', added 'in_progress')
  status: Joi.string().valid('pending', 'in_progress', 'completed').optional(),
  interpretation: longText(2000).optional().allow('', null),
  labName: shortText().optional().allow('', null),
  orderedBy: shortText().optional().allow('', null),
  verifiedBy: shortText().optional().allow('', null),
  isAbnormal: Joi.boolean().optional(),
  attachments: Joi.array().items(Joi.object()).optional(),
  notes: longText(2000).optional().allow('', null),
  consultationId: uuid.optional(),
  medicalRecordId: uuid.optional(),
});

export const updateLabResultSchema = createLabResultSchema.fork(
  ['animalId', 'testName', 'testDate'], (schema) => schema.optional()
).min(1);

