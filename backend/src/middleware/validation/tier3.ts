import Joi from 'joi';
import { uuid, requiredUuid, shortText, longText, positiveInt, positiveNumber } from './core';

// ─── Tier 3: Disease Prediction ──────────────────────────────
export const createPredictionSchema = Joi.object({
  enterpriseId: requiredUuid,
  animalId: uuid.optional(),
  groupId: uuid.optional(),
  diseaseName: shortText().required(),
  riskScore: Joi.number().min(0).max(100).optional(),
  confidence: Joi.number().min(0).max(1).optional(),
  predictedOnset: Joi.string().optional().allow('', null),
  riskFactors: Joi.array().items(Joi.any()).optional(),
  recommendedActions: Joi.array().items(Joi.any()).optional(),
  status: shortText(50).optional(),
});

export const resolvePredictionSchema = Joi.object({
  outcome: shortText(500).optional().allow('', null),
});

export const createOutbreakZoneSchema = Joi.object({
  enterpriseId: requiredUuid,
  locationId: uuid.optional(),
  diseaseName: shortText().required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  affectedCount: positiveInt.optional(),
  totalAtRisk: positiveInt.optional(),
  radiusKm: positiveNumber.optional(),
  centerLat: Joi.number().min(-90).max(90).optional().allow(null),
  centerLng: Joi.number().min(-180).max(180).optional().allow(null),
  containmentStatus: shortText(50).optional(),
  containmentActions: Joi.array().items(Joi.any()).optional(),
});

// ─── Tier 3: Genomic Lineage ─────────────────────────────────
export const createGeneticProfileSchema = Joi.object({
  animalId: requiredUuid,
  enterpriseId: requiredUuid,
  sireId: uuid.optional(),
  damId: uuid.optional(),
  generation: positiveInt.optional(),
  inbreedingCoefficient: Joi.number().min(0).max(1).optional(),
  geneticTraits: Joi.object().optional(),
  dnaTestDate: Joi.string().optional().allow('', null),
  dnaLab: shortText().optional().allow('', null),
  dnaSampleId: shortText(100).optional().allow('', null),
  knownMarkers: Joi.array().items(Joi.any()).optional(),
  breedPurityPct: Joi.number().min(0).max(100).optional(),
  notes: longText(2000).optional().allow('', null),
});

export const updateGeneticProfileSchema = Joi.object({
  sireId: uuid.optional(),
  damId: uuid.optional(),
  generation: positiveInt.optional(),
  inbreedingCoefficient: Joi.number().min(0).max(1).optional(),
  geneticTraits: Joi.object().optional(),
  dnaTestDate: Joi.string().optional().allow('', null),
  dnaLab: shortText().optional().allow('', null),
  dnaSampleId: shortText(100).optional().allow('', null),
  knownMarkers: Joi.array().items(Joi.any()).optional(),
  breedPurityPct: Joi.number().min(0).max(100).optional(),
  notes: longText(2000).optional().allow('', null),
}).min(1);

export const createPairRecommendationSchema = Joi.object({
  enterpriseId: requiredUuid,
  sireId: requiredUuid,
  damId: requiredUuid,
  compatibilityScore: Joi.number().min(0).max(100).optional(),
  predictedInbreeding: Joi.number().min(0).max(1).optional(),
  predictedTraits: Joi.object().optional(),
  recommendation: shortText(500).optional().allow('', null),
  reason: longText(2000).optional().allow('', null),
});

// ─── Tier 3: IoT Sensors ─────────────────────────────────────
export const createSensorSchema = Joi.object({
  enterpriseId: requiredUuid,
  locationId: uuid.optional(),
  animalId: uuid.optional(),
  sensorType: shortText(50).required(),
  sensorName: shortText().required(),
  serialNumber: shortText(100).optional().allow('', null),
  manufacturer: shortText().optional().allow('', null),
  unit: shortText(20).optional(),
  minThreshold: Joi.number().optional().allow(null),
  maxThreshold: Joi.number().optional().allow(null),
  readingIntervalSeconds: positiveInt.max(86400).optional(),
  status: Joi.string().valid('active', 'inactive', 'maintenance', 'offline').optional(),
  batteryLevel: Joi.number().min(0).max(100).optional().allow(null),
  firmwareVersion: shortText(50).optional().allow('', null),
  metadata: Joi.object().optional(),
});

export const updateSensorSchema = Joi.object({
  sensorName: shortText().optional(),
  sensorType: shortText(50).optional(),
  status: Joi.string().valid('active', 'inactive', 'maintenance', 'offline').optional(),
  locationId: uuid.optional().allow(null),
  animalId: uuid.optional().allow(null),
  minThreshold: Joi.number().optional().allow(null),
  maxThreshold: Joi.number().optional().allow(null),
  readingIntervalSeconds: positiveInt.max(86400).optional(),
  batteryLevel: Joi.number().min(0).max(100).optional().allow(null),
  firmwareVersion: shortText(50).optional().allow('', null),
}).min(1);

export const recordSensorReadingSchema = Joi.object({
  sensorId: requiredUuid,
  enterpriseId: requiredUuid,
  value: Joi.number().required(),
  unit: shortText(20).optional(),
  metadata: Joi.object().optional(),
  recordedAt: Joi.string().optional().allow('', null),
});

// ─── Tier 3: Supply Chain ────────────────────────────────────
export const createBatchSchema = Joi.object({
  enterpriseId: requiredUuid,
  batchNumber: shortText(100).required(),
  productType: shortText(100).required(),
  description: longText(2000).optional().allow('', null),
  quantity: positiveNumber.optional(),
  unit: shortText(20).optional(),
  sourceAnimalIds: Joi.array().items(uuid).optional(),
  sourceGroupId: uuid.optional(),
  productionDate: Joi.string().optional().allow('', null),
  expiryDate: Joi.string().optional().allow('', null),
  qualityGrade: shortText(50).optional().allow('', null),
  certifications: Joi.array().items(Joi.any()).optional(),
  currentHolder: shortText().optional().allow('', null),
  status: shortText(50).optional(),
});

export const updateBatchSchema = Joi.object({
  status: shortText(50).optional(),
  quantity: positiveNumber.optional(),
  qualityGrade: shortText(50).optional().allow('', null),
  currentHolder: shortText().optional().allow('', null),
  expiryDate: Joi.string().optional().allow('', null),
  description: longText(2000).optional().allow('', null),
  certifications: Joi.array().items(Joi.any()).optional(),
}).min(1);

export const createTraceabilityEventSchema = Joi.object({
  enterpriseId: requiredUuid,
  batchId: uuid.optional(),
  animalId: uuid.optional(),
  eventType: shortText(50).required(),
  title: shortText().required(),
  description: longText(2000).optional().allow('', null),
  location: shortText(500).optional().allow('', null),
  gpsLat: Joi.number().min(-90).max(90).optional().allow(null),
  gpsLng: Joi.number().min(-180).max(180).optional().allow(null),
  metadata: Joi.object().optional(),
  eventDate: Joi.string().optional().allow('', null),
});

export const generateQRCodeSchema = Joi.object({
  enterpriseId: requiredUuid,
  entityType: shortText(50).required(),
  entityId: requiredUuid,
  shortUrl: Joi.string().uri().optional().allow('', null),
});

// ─── Tier 3: Workforce ───────────────────────────────────────
export const createTaskSchema = Joi.object({
  enterpriseId: requiredUuid,
  title: shortText().required(),
  description: longText(5000).optional().allow('', null),
  taskType: shortText(50).optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  status: Joi.string().valid('pending', 'assigned', 'in_progress', 'completed', 'cancelled').optional(),
  assignedTo: uuid.optional(),
  locationId: uuid.optional(),
  animalId: uuid.optional(),
  groupId: uuid.optional(),
  checklist: Joi.array().items(Joi.any()).optional(),
  dueDate: Joi.string().optional().allow('', null),
  estimatedHours: positiveNumber.max(999).optional(),
});

export const updateTaskSchema = Joi.object({
  title: shortText().optional(),
  description: longText(5000).optional().allow('', null),
  taskType: shortText(50).optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  status: Joi.string().valid('pending', 'assigned', 'in_progress', 'completed', 'cancelled').optional(),
  assignedTo: uuid.optional(),
  dueDate: Joi.string().optional().allow('', null),
  estimatedHours: positiveNumber.max(999).optional(),
  actualHours: positiveNumber.max(999).optional(),
  notes: longText(2000).optional().allow('', null),
  checklist: Joi.array().items(Joi.any()).optional(),
}).min(1);

export const createShiftSchema = Joi.object({
  enterpriseId: requiredUuid,
  userId: requiredUuid,
  shiftDate: Joi.string().required().pattern(/^\d{4}-\d{2}-\d{2}$/),
  startTime: Joi.string().required().pattern(/^\d{2}:\d{2}/),
  endTime: Joi.string().required().pattern(/^\d{2}:\d{2}/),
  roleOnShift: shortText(100).optional().allow('', null),
  locationId: uuid.optional(),
  status: shortText(50).optional(),
  notes: longText(2000).optional().allow('', null),
});

export const updateShiftSchema = Joi.object({
  shiftDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: Joi.string().pattern(/^\d{2}:\d{2}/).optional(),
  endTime: Joi.string().pattern(/^\d{2}:\d{2}/).optional(),
  roleOnShift: shortText(100).optional().allow('', null),
  locationId: uuid.optional(),
  status: shortText(50).optional(),
  notes: longText(2000).optional().allow('', null),
}).min(1);

