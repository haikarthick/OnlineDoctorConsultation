import Joi from 'joi';
import { roleChangeVetProfileSchema } from './admin';
import { uuid, requiredUuid, shortText } from './core';

// ─── Hospital Network ────────────────────────────────────────
export const createHospitalNetworkSchema = Joi.object({
  name: shortText().required(),
  legalName: shortText().optional().allow('', null),
  registrationNumber: shortText(100).optional().allow('', null),
  taxId: shortText(100).optional().allow('', null),
  networkType: Joi.string().valid('private', 'government', 'ngo', 'cooperative', 'franchise').default('private'),
  country: shortText(100).optional().allow('', null),
  headquartersAddress: shortText(500).optional().allow('', null),
  headquartersCity: shortText(100).optional().allow('', null),
  headquartersState: shortText(100).optional().allow('', null),
  contactEmail: Joi.string().email().optional().allow('', null),
  contactPhone: shortText(20).optional().allow('', null),
  website: Joi.string().uri().optional().allow('', null),
  logoUrl: Joi.string().uri().optional().allow('', null),
  dpoName: shortText(200).optional().allow('', null),
  dpoEmail: Joi.string().email().optional().allow('', null),
  dataResidencyRegion: shortText(100).optional().allow('', null),
  metadata: Joi.object().optional().allow(null),
});

export const addNetworkMemberSchema = Joi.object({
  userId: requiredUuid,
  networkRole: Joi.string()
    .valid('corporate_admin', 'hospital_director', 'auditor', 'compliance_officer', 'hospital_staff')
    .required(),
  hospitalId: uuid.optional().allow(null),
  notes: shortText(500).optional().allow('', null),
  validUntil: Joi.string().isoDate().optional().allow(null),
});

export const createPatientConsentSchema = Joi.object({
  animalId: requiredUuid,
  grantedToUserId: uuid.optional().allow(null),
  grantedToHospitalId: uuid.optional().allow(null),
  grantedToNetworkId: uuid.optional().allow(null),
  consentScope: shortText(100).required(),
  allowMedicalRecords: Joi.boolean().default(true),
  allowVaccinationRecords: Joi.boolean().default(true),
  allowPrescriptions: Joi.boolean().default(true),
  allowLabResults: Joi.boolean().default(false),
  allowGeneticData: Joi.boolean().default(false),
  includeHospitalRecords: Joi.boolean().default(false),
  allowView: Joi.boolean().default(true),
  allowCreateNotes: Joi.boolean().default(false),
  allowPrescribe: Joi.boolean().default(false),
  validFrom: Joi.date().optional(),
  validUntil: Joi.date().min(Joi.ref('validFrom')).optional().allow(null),
});

export const roleChangeRequestSchema = Joi.object({
  requested_role: Joi.string().valid('pet_owner', 'farmer', 'veterinarian', 'corporate_admin', 'groomer').required(),
  reason: Joi.string().min(10).max(1000).required(),
  // Required only when requesting the veterinarian role; ignored/forbidden otherwise.
  profile: Joi.when('requested_role', {
    is: 'veterinarian',
    then: roleChangeVetProfileSchema.required(),
    otherwise: Joi.object().strip(),
  }),
});

export const rejectRoleChangeSchema = Joi.object({
  rejection_reason: Joi.string().min(5).max(500).required(),
});

// ─── Network Subscription Plans ──────────────────────────────
export const createNetworkPlanSchema = Joi.object({
  name: Joi.string().max(100).required(),
  description: Joi.string().max(1000).optional().allow('', null),
  max_seats: Joi.number().integer().min(1).optional().allow(null),
  max_hospitals: Joi.number().integer().min(1).optional().allow(null),
  price_monthly: Joi.number().min(0).optional().allow(null),
  price_annually: Joi.number().min(0).optional().allow(null),
  currency: Joi.string().max(10).default('INR'),
  features: Joi.object().optional().allow(null),
  is_published: Joi.boolean().default(false),
  sort_order: Joi.number().integer().min(0).default(0),
});

export const updateNetworkPlanSchema = createNetworkPlanSchema.fork(
  ['name'],
  (field) => field.optional()
).min(1);

export const setNetworkSubscriptionSchema = Joi.object({
  plan_id: Joi.string().uuid().optional().allow(null),
  seat_limit: Joi.number().integer().min(1).required(),
  status: Joi.string().valid('trial', 'active', 'suspended', 'expired', 'cancelled').default('trial'),
  billing_cycle: Joi.string().valid('monthly', 'annually', 'custom', 'none').default('none'),
  ends_at: Joi.date().optional().allow(null),
  admin_notes: Joi.string().max(2000).optional().allow('', null),
});

export const overrideSeatLimitSchema = Joi.object({
  seat_limit: Joi.number().integer().min(1).required(),
  admin_notes: Joi.string().max(2000).optional().allow('', null),
});

export const suspendNetworkSchema = Joi.object({
  suspension_reason: Joi.string().min(5).max(1000).required(),
});

// ─── Pricing Visibility Settings ─────────────────────────────
export const updatePricingSettingsSchema = Joi.object({
  'pricing.visibility.global': Joi.boolean().optional(),
  'pricing.visibility.landing_page': Joi.boolean().optional(),
  'pricing.visibility.registration': Joi.boolean().optional(),
  'pricing.visibility.corp_dashboard': Joi.boolean().optional(),
  'pricing.visibility.upgrade_prompts': Joi.boolean().optional(),
  'pricing.cta_text': Joi.string().max(200).optional().allow(''),
  'pricing.cta_email': Joi.string().email().max(255).optional().allow(''),
  'pricing.cta_phone': Joi.string().max(30).optional().allow(''),
}).min(1);

// ─── Hospital Staff Invites ───────────────────────────────────
export const inviteHospitalStaffSchema = Joi.object({
  invitee_email: Joi.string().email().required(),
  invitee_name: Joi.string().max(200).optional().allow('', null),
  staff_position: Joi.string().valid(
    'nurse','technician','receptionist','lab_tech',
    'radiologist','anesthesiologist','pharmacist','intern','admin_staff'
  ).required(),
  hospital_id: Joi.string().uuid().optional().allow(null),
});

export const acceptStaffInviteSchema = Joi.object({
  token: Joi.string().min(20).required(),
  first_name: Joi.string().max(100).required(),
  last_name: Joi.string().max(100).required(),
  phone: Joi.string().max(20).allow('', null).optional(),
  password: Joi.string().min(8).required(),
  // §17.2: invited users must consent personally
  acceptTerms: Joi.boolean().valid(true).required().messages({
    'any.only': 'You must accept the Terms of Service and Privacy Policy to create your account',
    'any.required': 'You must accept the Terms of Service and Privacy Policy to create your account',
  }),
});

// ─── Network Referrals ───────────────────────────────────────
export const createNetworkReferralSchema = Joi.object({
  networkId: Joi.string().uuid().required(),
  fromHospitalId: Joi.string().uuid().required(),
  toHospitalId: Joi.string().uuid().required(),
  toVetId: Joi.string().uuid().optional(),
  animalId: Joi.string().uuid().required(),
  consultationId: Joi.string().uuid().optional(),
  reason: Joi.string().min(5).max(500).required(),
  priority: Joi.string().valid('low', 'normal', 'high', 'emergency').default('normal'),
  clinicalNotes: Joi.string().max(2000).optional().allow(''),
});

export const createBranchHospitalSchema = Joi.object({
  name: Joi.string().required().min(2).max(255),
  hospitalType: Joi.string().valid('multi_specialty', 'specialty', 'clinic', 'emergency', 'referral', 'teaching').default('multi_specialty'),
  address: Joi.string().allow('', null).optional(),
  city: Joi.string().allow('', null).optional(),
  state: Joi.string().allow('', null).optional(),
  country: Joi.string().allow('', null).default('IN'),
  postalCode: Joi.string().allow('', null).optional(),
  phone: Joi.string().allow('', null).optional(),
  email: Joi.string().email().allow('', null).optional(),
  description: Joi.string().allow('', null).optional(),
  specializations: Joi.array().items(Joi.string()).optional(),
});

