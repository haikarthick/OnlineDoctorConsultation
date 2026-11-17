import Joi from 'joi';
import { uuid, requiredUuid, shortText, longText, positiveInt, positiveNumber } from './core';

// ─── Vet Hospital ─────────────────────────────────────────────
const hospitalTypeValues = ['multi_specialty','specialty','clinic','emergency_center','mobile_vet','research','teaching','other'];
const hospitalRoleValues = ['owner','medical_director','department_head','consultant','resident','intern','staff','visiting'];
const employmentTypeValues = ['full_time','part_time','contract','visiting','honorary'];
const serviceCategoryValues = ['consultation','diagnostics','surgery','vaccination','dental','grooming','boarding','emergency','rehabilitation','nutrition','reproduction','other'];

export const createHospitalSchema = Joi.object({
  name: Joi.string().min(2).max(255).required().messages({ 'any.required': 'Hospital name is required' }),
  tagline: Joi.string().max(500).optional().allow('', null),
  hospitalType: Joi.string().valid(...hospitalTypeValues).required().messages({ 'any.required': 'Hospital type is required' }),
  registrationNumber: shortText(100).optional().allow('', null),
  accreditationBody: shortText(100).optional().allow('', null),
  accreditationNumber: shortText(100).optional().allow('', null),
  accreditationExpiry: Joi.date().iso().optional().allow(null),
  description: longText().optional().allow('', null),
  address: longText(500).optional().allow('', null),
  city: shortText(100).optional().allow('', null),
  state: shortText(100).optional().allow('', null),
  country: shortText(100).default('US'),
  postalCode: shortText(20).optional().allow('', null),
  gpsLatitude: Joi.number().min(-90).max(90).optional().allow(null),
  gpsLongitude: Joi.number().min(-180).max(180).optional().allow(null),
  phone: Joi.string().max(30).optional().allow('', null),
  emergencyPhone: Joi.string().max(30).optional().allow('', null),
  email: Joi.string().email().optional().allow('', null),
  website: Joi.string().uri().optional().allow('', null),
  logoUrl: Joi.string().uri().optional().allow('', null),
  coverImageUrl: Joi.string().uri().optional().allow('', null),
  establishedYear: Joi.number().integer().min(1800).max(new Date().getFullYear()).optional().allow(null),
  totalBeds: positiveInt.optional().default(0),
  icuBeds: positiveInt.optional().default(0),
  is24Hours: Joi.boolean().default(false),
  hasEmergency: Joi.boolean().default(false),
  hasAmbulance: Joi.boolean().default(false),
  hasPharmacy: Joi.boolean().default(false),
  hasLab: Joi.boolean().default(false),
  hasImaging: Joi.boolean().default(false),
  hasSurgery: Joi.boolean().default(false),
  hasIcu: Joi.boolean().default(false),
  specializations: Joi.array().items(Joi.string().max(100)).max(20).optional(),
  facilities: Joi.array().items(Joi.string().max(100)).max(30).optional(),
  acceptedSpecies: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  operatingHours: Joi.object().optional(),
});

export const updateHospitalSchema = createHospitalSchema.fork(
  ['name', 'hospitalType'], (schema) => schema.optional()
).min(1);

export const addHospitalDoctorSchema = Joi.object({
  doctorId: requiredUuid,
  departmentId: uuid.optional().allow(null),
  hospitalRole: Joi.string().valid(...hospitalRoleValues).default('doctor'),
  title: shortText(100).optional().allow('', null),
  employmentType: Joi.string().valid(...employmentTypeValues).default('full_time'),
  isPrimaryHospital: Joi.boolean().default(false),
  consultationFee: positiveNumber.optional().allow(null),
});

export const updateHospitalDoctorSchema = Joi.object({
  hospitalRole: Joi.string().valid(...hospitalRoleValues).optional(),
  title: shortText(100).optional().allow('', null),
  departmentId: uuid.optional().allow(null),
  employmentType: Joi.string().valid(...employmentTypeValues).optional(),
  isPrimaryHospital: Joi.boolean().optional(),
  consultationFee: positiveNumber.optional().allow(null),
  isAcceptingPatients: Joi.boolean().optional(),
}).min(1);

export const createDepartmentSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  code: shortText(20).optional().allow('', null),
  description: longText().optional().allow('', null),
  specializations: Joi.array().items(Joi.string().max(100)).max(10).optional(),
  floorNumber: shortText(20).optional().allow('', null),
  roomNumbers: shortText(100).optional().allow('', null),
  headDoctorId: uuid.optional().allow(null),
});

export const updateDepartmentSchema = createDepartmentSchema
  .fork(['name'], (s) => s.optional()).min(1);

export const createHospitalServiceSchema = Joi.object({
  serviceName: Joi.string().min(2).max(255).required(),
  category: Joi.string().valid(...serviceCategoryValues).required(),
  description: longText().optional().allow('', null),
  priceMin: positiveNumber.optional().allow(null),
  priceMax: positiveNumber.optional().allow(null),
  currency: shortText(10).default('USD'),
  durationMinutes: positiveInt.optional().allow(null),
  requiresAppointment: Joi.boolean().default(true),
});

export const updateHospitalServiceSchema = createHospitalServiceSchema
  .fork(['serviceName', 'category'], (s) => s.optional())
  .keys({ isAvailable: Joi.boolean().optional() })
  .min(1);

export const verifyHospitalSchema = Joi.object({
  verified: Joi.boolean().required(),
});

// ─── Hospital Documents ───────────────────────────────────────
const docTypeValues = ['pan','gst','aadhaar','bank_account','vet_council','trade_license','drug_license'];

export const uploadHospitalDocSchema = Joi.object({
  docType:     Joi.string().valid(...docTypeValues).required().messages({ 'any.required': 'docType is required' }),
  fileUrl:     Joi.string().uri().optional().allow('', null),
  fileName:    shortText(500).optional().allow('', null),
  expiryDate:  Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().allow('', null).messages({
    'string.pattern.base': 'expiryDate must be YYYY-MM-DD',
  }),
});

export const reviewHospitalDocSchema = Joi.object({
  status:          Joi.string().valid('approved', 'rejected').required(),
  rejectionReason: shortText(1000).optional().allow('', null),
});

