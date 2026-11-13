import Joi from 'joi';
import { uuid, requiredUuid, shortText, longText, positiveInt, positiveNumber } from './core';

// ─── Enterprise ──────────────────────────────────────────────
export const createEnterpriseSchema = Joi.object({
  name: shortText().required(),
  enterpriseType: shortText(50).required(),
  description: longText(2000).optional().allow('', null),
  address: shortText(500).optional().allow('', null),
  city: shortText(100).optional().allow('', null),
  state: shortText(100).optional().allow('', null),
  country: shortText(100).optional().allow('', null),
  postalCode: shortText(20).optional().allow('', null),
  gpsLatitude: Joi.number().min(-90).max(90).optional().allow(null),
  gpsLongitude: Joi.number().min(-180).max(180).optional().allow(null),
  totalArea: positiveNumber.optional().allow(null),
  areaUnit: shortText(20).optional().allow('', null),
  licenseNumber: shortText(100).optional().allow('', null),
  regulatoryId: shortText(100).optional().allow('', null),
  taxId: shortText(100).optional().allow('', null),
  phone: shortText(20).optional().allow('', null),
  email: Joi.string().email().optional().allow('', null),
  website: Joi.string().uri().optional().allow('', null),
});

export const updateEnterpriseSchema = createEnterpriseSchema.fork(
  ['name', 'enterpriseType'], (schema) => schema.optional()
).min(1);

export const addMemberSchema = Joi.object({
  userId: requiredUuid,
  role: Joi.string().max(50).required(),
  title: shortText(100).optional().allow('', null),
});

export const updateMemberSchema = Joi.object({
  role: Joi.string().max(50).required(),
  title: shortText(100).optional().allow('', null),
});

export const createAnimalGroupSchema = Joi.object({
  enterpriseId: requiredUuid,
  name: shortText().required(),
  groupType: shortText(50).required(),
  species: shortText(100).optional().allow('', null),
  breed: shortText(100).optional().allow('', null),
  purpose: shortText().optional().allow('', null),
  targetCount: positiveInt.optional(),
  description: longText(2000).optional().allow('', null),
  colorCode: Joi.string().max(20).optional().allow('', null),
  // 'batch' means the group is tracked as a population with a headcount rather than as
  // individual animals - a 5,000-bird flock, not 5,000 rows. Omitted on create, it is derived
  // from the species default. See docs/BATCH_ANIMAL_MANAGEMENT_PLAN.md.
  managementMode: Joi.string().valid('individual', 'batch').optional(),
});

export const updateAnimalGroupSchema = createAnimalGroupSchema.fork(
  ['enterpriseId', 'name', 'groupType'], (schema) => schema.optional()
).min(1);

export const assignAnimalToGroupSchema = Joi.object({
  animalId: requiredUuid,
});

export const createLocationSchema = Joi.object({
  enterpriseId: requiredUuid,
  name: shortText().required(),
  locationType: shortText(50).required(),
  parentLocationId: uuid.optional().allow(null),
  capacity: positiveInt.optional().allow(null),
  area: positiveNumber.optional().allow(null),
  areaUnit: shortText(20).optional().allow('', null),
  gpsLatitude: Joi.number().min(-90).max(90).optional().allow(null),
  gpsLongitude: Joi.number().min(-180).max(180).optional().allow(null),
  description: longText(2000).optional().allow('', null),
});

export const updateLocationSchema = createLocationSchema.fork(
  ['enterpriseId', 'name', 'locationType'], (schema) => schema.optional()
).min(1);

export const createMovementSchema = Joi.object({
  enterpriseId: requiredUuid,
  animalId: uuid.optional(),
  groupId: uuid.optional(),
  fromLocationId: uuid.optional(),
  toLocationId: uuid.optional(),
  movementType: shortText(50).required(),
  reason: shortText(500).optional().allow('', null),
  animalCount: positiveInt.optional(),
  transportMethod: shortText(100).optional().allow('', null),
  transportDate: Joi.string().optional().allow('', null),
  regulatoryPermit: shortText().optional().allow('', null),
  notes: longText(2000).optional().allow('', null),
});

export const createCampaignSchema = Joi.object({
  enterpriseId: requiredUuid,
  groupId: uuid.optional(),
  campaignType: shortText(50).required(),
  name: shortText().required(),
  description: longText(2000).optional().allow('', null),
  productUsed: shortText().optional().allow('', null),
  dosage: shortText(100).optional().allow('', null),
  targetCount: positiveInt.optional(),
  scheduledDate: Joi.string().optional().allow('', null),
  cost: positiveNumber.optional().allow(null),
  notes: longText(2000).optional().allow('', null),
});

export const updateCampaignSchema = createCampaignSchema.fork(
  ['enterpriseId', 'campaignType', 'name'], (schema) => schema.optional()
).keys({
  status: shortText(50).optional(),
  completedCount: positiveInt.optional(),
  administeredBy: shortText().optional().allow('', null),
}).min(1);

// ─── Tier 2: Health Analytics ────────────────────────────────
export const createObservationSchema = Joi.object({
  enterpriseId: requiredUuid,
  animalId: uuid.optional(),
  groupId: uuid.optional(),
  observationType: shortText(50).optional(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  title: shortText().required(),
  description: longText(5000).optional().allow('', null),
  bodyTemperature: Joi.number().min(30).max(50).optional().allow(null),
  weight: positiveNumber.optional().allow(null),
  weightUnit: Joi.string().valid('kg', 'lbs', 'g').optional(),
  heartRate: positiveInt.max(500).optional().allow(null),
  respiratoryRate: positiveInt.max(200).optional().allow(null),
  bodyConditionScore: Joi.number().min(1).max(9).optional().allow(null),
  symptoms: longText(5000).optional().allow('', null),
  diagnosis: longText(5000).optional().allow('', null),
  treatmentGiven: longText(5000).optional().allow('', null),
  followUpDate: Joi.string().optional().allow('', null),
});

export const resolveObservationSchema = Joi.object({
  outcome: shortText(500).optional().allow('', null),
});

// ─── Tier 2: Breeding ────────────────────────────────────────
export const createBreedingRecordSchema = Joi.object({
  enterpriseId: requiredUuid,
  damId: uuid.optional(),
  sireId: uuid.optional(),
  breedingMethod: shortText(50).optional(),
  breedingDate: Joi.string().required(),
  expectedDueDate: Joi.string().optional().allow('', null),
  gestationDays: positiveInt.max(500).optional().allow(null),
  species: shortText(100).optional().allow('', null),
  status: shortText(50).optional(),
  semenBatch: shortText(100).optional().allow('', null),
  technicianId: uuid.optional(),
  notes: longText(2000).optional().allow('', null),
});

export const updateBreedingRecordSchema = Joi.object({
  breedingMethod: shortText(50).optional(),
  expectedDueDate: Joi.string().optional().allow('', null),
  actualBirthDate: Joi.string().optional().allow('', null),
  offspringCount: positiveInt.optional().allow(null),
  liveBirths: positiveInt.optional().allow(null),
  stillbirths: positiveInt.optional().allow(null),
  status: shortText(50).optional(),
  pregnancyConfirmed: Joi.boolean().optional(),
  pregnancyCheckDate: Joi.string().optional().allow('', null),
  notes: longText(2000).optional().allow('', null),
  outcome: shortText(500).optional().allow('', null),
}).min(1);

// ─── Tier 2: Feed & Inventory ────────────────────────────────
export const createFeedSchema = Joi.object({
  enterpriseId: requiredUuid,
  locationId: uuid.optional(),
  feedName: shortText().required(),
  feedType: shortText(100).optional().allow('', null),
  brand: shortText().optional().allow('', null),
  unit: shortText(20).optional(),
  currentStock: positiveNumber.optional(),
  minimumStock: positiveNumber.optional(),
  costPerUnit: positiveNumber.optional().allow(null),
  supplier: shortText().optional().allow('', null),
  batchNumber: shortText(100).optional().allow('', null),
  expiryDate: Joi.string().optional().allow('', null),
  storageLocation: shortText().optional().allow('', null),
  nutritionalInfo: Joi.object().optional(),
});

export const updateFeedSchema = createFeedSchema.fork(
  ['enterpriseId', 'feedName'], (schema) => schema.optional()
).min(1);

export const restockFeedSchema = Joi.object({
  quantity: Joi.number().positive().required(),
});

export const logFeedConsumptionSchema = Joi.object({
  enterpriseId: requiredUuid,
  feedId: requiredUuid,
  groupId: uuid.optional(),
  locationId: uuid.optional(),
  animalId: uuid.optional(),
  quantity: Joi.number().positive().required(),
  unit: shortText(20).optional(),
  consumptionDate: Joi.string().optional().allow('', null),
  notes: shortText(500).optional().allow('', null),
});

// ─── Tier 2: Compliance ──────────────────────────────────────
export const createComplianceDocSchema = Joi.object({
  enterpriseId: requiredUuid,
  documentType: shortText(100).required(),
  title: shortText().required(),
  description: longText(2000).optional().allow('', null),
  referenceNumber: shortText(100).optional().allow('', null),
  issuedDate: Joi.string().optional().allow('', null),
  expiryDate: Joi.string().optional().allow('', null),
  issuingAuthority: shortText().optional().allow('', null),
  status: shortText(50).optional(),
  relatedCampaignId: uuid.optional(),
  relatedMovementId: uuid.optional(),
  animalIds: Joi.array().items(uuid).optional(),
  groupIds: Joi.array().items(uuid).optional(),
  documentData: Joi.object().optional(),
  notes: longText(2000).optional().allow('', null),
});

export const updateComplianceDocSchema = Joi.object({
  title: shortText().optional(),
  description: longText(2000).optional().allow('', null),
  referenceNumber: shortText(100).optional().allow('', null),
  issuedDate: Joi.string().optional().allow('', null),
  expiryDate: Joi.string().optional().allow('', null),
  issuingAuthority: shortText().optional().allow('', null),
  status: shortText(50).optional(),
  notes: longText(2000).optional().allow('', null),
}).min(1);

// ─── Tier 2: Financial ───────────────────────────────────────
export const createFinancialRecordSchema = Joi.object({
  enterpriseId: requiredUuid,
  recordType: Joi.string().valid('income', 'expense').required(),
  category: shortText(100).required(),
  description: longText(2000).optional().allow('', null),
  amount: Joi.number().required(),
  currency: Joi.string().max(3).optional(),
  transactionDate: Joi.string().optional().allow('', null),
  referenceId: uuid.optional(),
  referenceType: shortText(50).optional().allow('', null),
  animalId: uuid.optional(),
  groupId: uuid.optional(),
  paymentMethod: shortText(50).optional().allow('', null),
  vendor: shortText().optional().allow('', null),
  invoiceNumber: shortText(100).optional().allow('', null),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  notes: longText(2000).optional().allow('', null),
});

export const updateFinancialRecordSchema = Joi.object({
  category: shortText(100).optional(),
  description: longText(2000).optional().allow('', null),
  amount: Joi.number().optional(),
  transactionDate: Joi.string().optional().allow('', null),
  paymentMethod: shortText(50).optional().allow('', null),
  vendor: shortText().optional().allow('', null),
  invoiceNumber: shortText(100).optional().allow('', null),
  notes: longText(2000).optional().allow('', null),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
}).min(1);

// ─── Tier 2: Alerts ──────────────────────────────────────────
export const createAlertRuleSchema = Joi.object({
  enterpriseId: requiredUuid,
  name: shortText().required(),
  description: longText(2000).optional().allow('', null),
  alertType: shortText(50).required(),
  conditions: Joi.object().optional(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  isEnabled: Joi.boolean().optional().default(true),
  checkIntervalHours: Joi.number().integer().min(1).max(720).optional(),
  notificationChannels: Joi.array().items(Joi.string().max(50)).optional(),
  targetRoles: Joi.array().items(Joi.string().max(50)).optional(),
});

export const updateAlertRuleSchema = Joi.object({
  name: shortText().optional(),
  description: longText(2000).optional().allow('', null),
  conditions: Joi.object().optional(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  isEnabled: Joi.boolean().optional(),
  checkIntervalHours: Joi.number().integer().min(1).max(720).optional(),
  notificationChannels: Joi.array().items(Joi.string().max(50)).optional(),
  targetRoles: Joi.array().items(Joi.string().max(50)).optional(),
}).min(1);

export const toggleAlertRuleSchema = Joi.object({
  isEnabled: Joi.boolean().required(),
});

