import Joi from 'joi';
import { uuid, requiredUuid, shortText, longText } from './core';

// ─── Tier 3: Report Builder ──────────────────────────────────
export const createReportTemplateSchema = Joi.object({
  enterpriseId: uuid.optional(),
  name: shortText().required(),
  description: longText(2000).optional().allow('', null),
  reportType: shortText(50).required(),
  config: Joi.object().optional(),
  columns: Joi.array().items(Joi.any()).optional(),
  filters: Joi.object().optional(),
  grouping: Joi.array().items(Joi.any()).optional(),
  isSystem: Joi.boolean().optional(),
});

export const updateReportTemplateSchema = Joi.object({
  name: shortText().optional(),
  description: longText(2000).optional().allow('', null),
  reportType: shortText(50).optional(),
  config: Joi.object().optional(),
  columns: Joi.array().items(Joi.any()).optional(),
  filters: Joi.object().optional(),
  grouping: Joi.array().items(Joi.any()).optional(),
}).min(1);

export const generateReportSchema = Joi.object({
  enterpriseId: requiredUuid,
  reportType: shortText(50).required(),
  parameters: Joi.object().optional(),
  templateId: uuid.optional(),
  name: shortText().optional(),
});

// ─── Tier 4: AI Copilot ──────────────────────────────────────
export const createChatSessionSchema = Joi.object({
  enterpriseId: uuid.optional(),
  animalId: uuid.optional(),
  title: shortText().optional().allow('', null),
  contextType: shortText(50).optional(),
});

export const sendChatMessageSchema = Joi.object({
  content: Joi.string().min(1).max(10000).required(),
});

export const checkDrugInteractionsSchema = Joi.object({
  drugs: Joi.array().items(Joi.string().max(200)).min(1).required(),
});

export const analyzeSymptomsSchema = Joi.object({
  symptoms: Joi.array().items(Joi.string().max(200)).min(1).required(),
  species: shortText(100).optional(),
});

// ─── Tier 4: Digital Twin ────────────────────────────────────
export const createDigitalTwinSchema = Joi.object({
  name: shortText().required(),
  twinType: shortText(50).optional(),
  description: longText(2000).optional().allow('', null),
  modelData: Joi.object().optional(),
});

export const updateDigitalTwinSchema = Joi.object({
  name: shortText().optional(),
  description: longText(2000).optional().allow('', null),
  modelData: Joi.object().optional(),
  currentState: Joi.object().optional(),
}).min(1);

export const runSimulationSchema = Joi.object({
  twinId: requiredUuid,
  name: shortText().required(),
  scenarioType: shortText(50).required(),
  parameters: Joi.object().optional(),
});

