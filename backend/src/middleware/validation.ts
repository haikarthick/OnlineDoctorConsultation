import Joi from 'joi';

// ─── Reusable field patterns ─────────────────────────────────
const uuid = Joi.string().uuid();
const requiredUuid = uuid.required();
const shortText = (max = 255) => Joi.string().max(max).trim();
const longText = (max = 5000) => Joi.string().max(max).trim();
const positiveInt = Joi.number().integer().min(0);
const positiveNumber = Joi.number().min(0);

// ─── Auth ────────────────────────────────────────────────────
export const registerSchema = Joi.object({
  email: Joi.string().email().required().max(255).messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  firstName: Joi.string().min(2).max(100).required().pattern(/^[a-zA-Z\s'-]+$/).messages({
    'string.min': 'First name must be at least 2 characters',
    'string.pattern.base': 'First name can only contain letters, spaces, hyphens, and apostrophes',
    'any.required': 'First name is required',
  }),
  lastName: Joi.string().min(2).max(100).required().pattern(/^[a-zA-Z\s'-]+$/).messages({
    'string.min': 'Last name must be at least 2 characters',
    'any.required': 'Last name is required',
  }),
  phone: Joi.string().required().pattern(/^\+?[\d\s()-]{7,20}$/).messages({
    'string.pattern.base': 'Please provide a valid phone number',
    'any.required': 'Phone number is required',
  }),
  password: Joi.string().min(8).max(128).required().pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).messages({
    'string.min': 'Password must be at least 8 characters',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    'any.required': 'Password is required',
  }),
  role: Joi.string().valid('pet_owner', 'farmer', 'veterinarian').default('pet_owner').messages({
    'any.only': 'Role must be one of: pet_owner, farmer, veterinarian',
  }),
  confirmPassword: Joi.string().optional().strip(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().required().messages({ 'any.required': 'Password is required' }),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({ 'any.required': 'Refresh token is required' }),
});

export const logoutSchema = Joi.object({
  refreshToken: Joi.string().required().messages({ 'any.required': 'Refresh token is required' }),
});

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
  scheduledDate: Joi.string().required().pattern(/^\d{4}-\d{2}-\d{2}$/).messages({ 'string.pattern.base': 'Date must be YYYY-MM-DD' }),
  timeSlotStart: Joi.string().required().pattern(/^\d{2}:\d{2}/).messages({ 'string.pattern.base': 'Time must be HH:MM format' }),
  timeSlotEnd: Joi.string().required().pattern(/^\d{2}:\d{2}/).messages({ 'string.pattern.base': 'Time must be HH:MM format' }),
  bookingType: Joi.string().valid('video_call', 'in_person', 'phone', 'chat').required(),
  priority: Joi.string().valid('normal', 'urgent', 'emergency').default('normal'),
  reasonForVisit: Joi.string().min(5).max(1000).required(),
  symptoms: longText().optional().allow('', null),
  notes: longText().optional().allow('', null),
});

export const rescheduleBookingSchema = Joi.object({
  scheduledDate: Joi.string().required().pattern(/^\d{4}-\d{2}-\d{2}$/),
  timeSlotStart: Joi.string().required().pattern(/^\d{2}:\d{2}/),
  timeSlotEnd: Joi.string().required().pattern(/^\d{2}:\d{2}/),
});

export const cancelBookingSchema = Joi.object({
  reason: shortText(500).optional().allow('', null),
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
export const createScheduleSchema = Joi.object({
  veterinarianId: uuid.optional(),
  dayOfWeek: Joi.number().integer().min(0).max(6).required(),
  startTime: Joi.string().required().pattern(/^\d{2}:\d{2}/),
  endTime: Joi.string().required().pattern(/^\d{2}:\d{2}/),
  slotDuration: Joi.number().integer().min(5).max(240).optional(),
  maxAppointments: Joi.number().integer().min(1).max(100).optional(),
});

export const updateScheduleSchema = Joi.object({
  veterinarianId: uuid.optional(),
  dayOfWeek: Joi.number().integer().min(0).max(6).optional(),
  startTime: Joi.string().pattern(/^\d{2}:\d{2}/).optional(),
  endTime: Joi.string().pattern(/^\d{2}:\d{2}/).optional(),
  slotDuration: Joi.number().integer().min(5).max(240).optional(),
  maxAppointments: Joi.number().integer().min(1).max(100).optional(),
}).min(1);

// ─── Prescription ────────────────────────────────────────────
const medicationSchema = Joi.object({
  name: Joi.string().max(255).required(),
  dosage: Joi.string().max(255).required(),
  frequency: Joi.string().max(255).required(),
  duration: Joi.string().max(255).required(),
  instructions: shortText(500).optional().allow('', null),
});

export const createPrescriptionSchema = Joi.object({
  consultationId: requiredUuid,
  petOwnerId: uuid.optional(),
  animalId: uuid.optional(),
  medications: Joi.array().items(medicationSchema).min(1).required(),
  instructions: Joi.string().max(5000).required(),
  validUntil: Joi.string().optional().allow('', null),
  diagnosis: longText().optional().allow('', null),
  followUpDate: Joi.string().optional().allow('', null),
});

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
});

export const updateVetProfileSchema = createVetProfileSchema.fork(
  ['licenseNumber'], (schema) => schema.optional()
).min(1);

// ─── Medical Record ──────────────────────────────────────────
export const createMedicalRecordSchema = Joi.object({
  animalId: uuid.optional(),
  consultationId: uuid.optional(),
  veterinarianId: uuid.optional(),
  recordType: shortText(50).required(),
  title: shortText().required(),
  content: longText(10000).required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  medications: Joi.array().items(Joi.object()).optional(),
  attachments: Joi.array().items(Joi.object()).optional(),
  isConfidential: Joi.boolean().optional(),
  followUpDate: Joi.string().optional().allow('', null),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  fileUrl: Joi.string().uri().optional().allow('', null),
  userId: uuid.optional(),
  _userName: shortText().optional().allow('', null),
});

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
  animalId: requiredUuid,
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
});

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
  severity: Joi.string().valid('mild', 'moderate', 'severe', 'life-threatening').optional(),
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
  status: Joi.string().valid('pending', 'completed', 'cancelled').optional(),
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

// ─── Payment ─────────────────────────────────────────────────
export const createPaymentSchema = Joi.object({
  consultationId: requiredUuid,
  amount: Joi.number().positive().required(),
  currency: Joi.string().max(3).optional().default('USD'),
  paymentMethod: Joi.string().valid('credit_card', 'debit_card', 'bank_transfer', 'e_wallet', 'cash').optional(),
});

// ─── Review ──────────────────────────────────────────────────
export const createReviewSchema = Joi.object({
  consultationId: requiredUuid,
  veterinarianId: requiredUuid,
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: longText(2000).optional().allow('', null),
});

// ─── Admin ───────────────────────────────────────────────────
export const toggleUserStatusSchema = Joi.object({
  isActive: Joi.boolean().required(),
});

export const changeUserRoleSchema = Joi.object({
  role: Joi.string().valid('pet_owner', 'farmer', 'veterinarian', 'admin').required(),
});

export const processRefundSchema = Joi.object({
  amount: Joi.number().positive().required(),
  reason: shortText(500).required(),
});

export const moderateReviewSchema = Joi.object({
  action: Joi.string().valid('approve', 'hide', 'remove').required(),
});

export const updateSystemSettingSchema = Joi.object({
  key: Joi.string().max(100).required(),
  value: Joi.any().required(),
});

export const updatePermissionSchema = Joi.object({
  role: Joi.string().required(),
  permission: Joi.string().required(),
  isEnabled: Joi.boolean().required(),
});

export const bulkUpdatePermissionsSchema = Joi.object({
  role: Joi.string().required(),
  permissions: Joi.object().required(),
});

export const resetPermissionsSchema = Joi.object({
  role: Joi.string().required(),
});

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

// ─── Tier 4: Marketplace ─────────────────────────────────────
export const createMarketplaceListingSchema = Joi.object({
  enterpriseId: uuid.optional(),
  title: shortText().required(),
  description: longText(5000).optional().allow('', null),
  category: shortText(100).optional(),
  listingType: Joi.string().valid('sale', 'auction', 'wanted').optional(),
  price: positiveNumber.optional().allow(null),
  currency: Joi.string().max(3).optional(),
  quantity: positiveInt.optional(),
  unit: shortText(20).optional(),
  condition: shortText(50).optional(),
  images: Joi.array().items(Joi.string().uri().max(2000)).optional(),
  location: shortText(500).optional().allow('', null),
  shippingOptions: Joi.array().items(Joi.any()).optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  featured: Joi.boolean().optional(),
  expiresAt: Joi.string().optional().allow('', null),
});

export const updateMarketplaceListingSchema = Joi.object({
  title: shortText().optional(),
  description: longText(5000).optional().allow('', null),
  price: positiveNumber.optional().allow(null),
  quantity: positiveInt.optional(),
  status: shortText(50).optional(),
  category: shortText(100).optional(),
  condition: shortText(50).optional(),
  location: shortText(500).optional().allow('', null),
  images: Joi.array().items(Joi.string().uri().max(2000)).optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
}).min(1);

export const placeBidSchema = Joi.object({
  amount: Joi.number().positive().required(),
  message: shortText(500).optional().allow('', null),
});

export const createMarketplaceOrderSchema = Joi.object({
  listingId: requiredUuid,
  unitPrice: positiveNumber.optional(),
  quantity: Joi.number().integer().min(1).optional(),
  shippingAddress: Joi.object().optional(),
  notes: shortText(500).optional().allow('', null),
});

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded').required(),
});

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
