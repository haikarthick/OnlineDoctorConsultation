import Joi from 'joi';
import { uuid, requiredUuid, shortText, longText, positiveInt, positiveNumber } from './core';

// ─── Tier 4: Sustainability ──────────────────────────────────
export const createSustainabilityMetricSchema = Joi.object({
  metricType: shortText(100).required(),
  metricName: shortText().required(),
  value: Joi.number().required(),
  unit: shortText(50).optional(),
  periodStart: Joi.string().required(),
  periodEnd: Joi.string().required(),
  category: shortText(100).optional(),
  scope: shortText(100).optional(),
  dataSource: shortText().optional().allow('', null),
  notes: longText(2000).optional().allow('', null),
});

export const updateSustainabilityMetricSchema = Joi.object({
  metricName: shortText().optional(),
  value: Joi.number().optional(),
  unit: shortText(50).optional(),
  notes: longText(2000).optional().allow('', null),
  category: shortText(100).optional(),
  scope: shortText(100).optional(),
  dataSource: shortText().optional().allow('', null),
}).min(1);

export const createSustainabilityGoalSchema = Joi.object({
  goalName: shortText().required(),
  description: longText(2000).optional().allow('', null),
  metricType: shortText(100).required(),
  targetValue: Joi.number().required(),
  currentValue: Joi.number().optional(),
  unit: shortText(50).optional(),
  baselineValue: Joi.number().optional(),
  baselineDate: Joi.string().optional().allow('', null),
  targetDate: Joi.string().required(),
});

export const updateSustainabilityGoalSchema = Joi.object({
  currentValue: Joi.number().optional(),
  status: shortText(50).optional(),
  goalName: shortText().optional(),
  description: longText(2000).optional().allow('', null),
}).min(1);

// ─── Tier 4: Wellness ────────────────────────────────────────
export const createWellnessScorecardSchema = Joi.object({
  animalId: requiredUuid,
  enterpriseId: uuid.optional(),
  nutritionScore: Joi.number().min(0).max(100).optional(),
  activityScore: Joi.number().min(0).max(100).optional(),
  vaccinationScore: Joi.number().min(0).max(100).optional(),
  dentalScore: Joi.number().min(0).max(100).optional(),
  weightStatus: Joi.string().valid('underweight', 'normal', 'overweight', 'obese').optional(),
  nextCheckup: Joi.string().optional().allow('', null),
  recommendations: Joi.array().items(Joi.any()).optional(),
  riskFlags: Joi.array().items(Joi.any()).optional(),
});

export const updateWellnessScorecardSchema = Joi.object({
  nutritionScore: Joi.number().min(0).max(100).optional(),
  activityScore: Joi.number().min(0).max(100).optional(),
  vaccinationScore: Joi.number().min(0).max(100).optional(),
  dentalScore: Joi.number().min(0).max(100).optional(),
  weightStatus: Joi.string().valid('underweight', 'normal', 'overweight', 'obese').optional(),
  nextCheckup: Joi.string().optional().allow('', null),
  recommendations: Joi.array().items(Joi.any()).optional(),
  riskFlags: Joi.array().items(Joi.any()).optional(),
}).min(1);

export const createWellnessReminderSchema = Joi.object({
  animalId: requiredUuid,
  reminderType: shortText(50).required(),
  title: shortText().required(),
  description: longText(2000).optional().allow('', null),
  dueDate: Joi.string().required(),
  priority: Joi.string().valid('low', 'medium', 'high').optional(),
  recurrence: Joi.string().valid('none', 'daily', 'weekly', 'monthly', 'yearly').optional(),
  recurrenceInterval: positiveInt.max(365).optional(),
});

export const snoozeReminderSchema = Joi.object({
  until: Joi.string().required(),
});

// ─── Tier 4: Geospatial ──────────────────────────────────────
export const createGeofenceZoneSchema = Joi.object({
  name: shortText().required(),
  zoneType: shortText(50).optional(),
  centerLat: Joi.number().min(-90).max(90).optional().allow(null),
  centerLng: Joi.number().min(-180).max(180).optional().allow(null),
  radiusMeters: positiveNumber.max(1000000).optional(),
  polygonCoords: Joi.array().items(Joi.any()).optional(),
  color: Joi.string().max(20).optional().allow('', null),
  alertOnEntry: Joi.boolean().optional(),
  alertOnExit: Joi.boolean().optional(),
  isRestricted: Joi.boolean().optional(),
});

export const updateGeofenceZoneSchema = Joi.object({
  name: shortText().optional(),
  zoneType: shortText(50).optional(),
  centerLat: Joi.number().min(-90).max(90).optional().allow(null),
  centerLng: Joi.number().min(-180).max(180).optional().allow(null),
  radiusMeters: positiveNumber.max(1000000).optional(),
  color: Joi.string().max(20).optional().allow('', null),
  alertOnEntry: Joi.boolean().optional(),
  alertOnExit: Joi.boolean().optional(),
  isRestricted: Joi.boolean().optional(),
  status: shortText(50).optional(),
  polygonCoords: Joi.array().items(Joi.any()).optional(),
}).min(1);

export const createGeospatialEventSchema = Joi.object({
  animalId: uuid.optional(),
  sensorId: uuid.optional(),
  eventType: shortText(50).optional(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  altitude: Joi.number().optional().allow(null),
  accuracyMeters: positiveNumber.optional().allow(null),
  speedKmh: positiveNumber.optional().allow(null),
  heading: Joi.number().min(0).max(360).optional().allow(null),
  metadata: Joi.object().optional(),
  zoneId: uuid.optional(),
});

// ─── Pagination (reusable query schema) ──────────────────────
export const paginationSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(10),
  offset: Joi.number().integer().min(0).default(0),
});

