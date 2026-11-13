import Joi from 'joi';
import { uuid, shortText, longText, positiveInt, positiveNumber } from './core';

// ─── Grooming & Spa module ───────────────────────────────────
export const createGroomingProviderSchema = Joi.object({
  businessName: shortText(200).required(),
  providerType: Joi.string().valid('veterinarian', 'groomer', 'business', 'clinic').optional(),
  description: longText(2000).optional().allow('', null),
  logoUrl: Joi.string().uri({ allowRelative: true }).max(500).optional().allow('', null),
  contactPhone: shortText(20).optional().allow('', null),
  contactEmail: Joi.string().email().max(255).optional().allow('', null),
  offersAtPremises: Joi.boolean().optional(),
  offersMobile: Joi.boolean().optional(),
  operatingHours: Joi.object().optional(),
  supportedSpecies: Joi.array().items(Joi.string().max(60)).optional(),
  sizeLimits: Joi.object().optional(),
  legalName: shortText(255).optional().allow('', null),
  pan: shortText(20).optional().allow('', null),
  gstin: shortText(20).optional().allow('', null),
  businessAddress: longText(500).optional().allow('', null),
  payoutAccountName: shortText(255).optional().allow('', null),
  payoutAccountNumber: shortText(50).optional().allow('', null),
  payoutIfsc: shortText(20).optional().allow('', null),
  payoutUpi: shortText(100).optional().allow('', null),
});

export const updateGroomingProviderSchema = createGroomingProviderSchema.fork(
  ['businessName'], (s) => s.optional()
).keys({ isPaused: Joi.boolean().optional() }).min(1);

export const groomingLocationSchema = Joi.object({
  name: shortText(200).required(),
  locationType: Joi.string().valid('premises', 'mobile_zone').optional(),
  address: longText(500).optional().allow('', null),
  city: shortText(100).optional().allow('', null),
  state: shortText(100).optional().allow('', null),
  postalCode: shortText(20).optional().allow('', null),
  gpsLatitude: Joi.number().min(-90).max(90).optional().allow(null),
  gpsLongitude: Joi.number().min(-180).max(180).optional().allow(null),
  serviceRadiusKm: positiveNumber.max(500).optional().allow(null),
});

export const groomingResourceSchema = Joi.object({
  name: shortText(150).required(),
  resourceType: Joi.string().valid('grooming_table', 'bath_station', 'drying_cage', 'spa_room', 'other').optional(),
  locationId: uuid.optional().allow(null),
});

export const groomingServiceSchema = Joi.object({
  name: shortText(200).required(),
  categoryId: uuid.optional().allow(null),
  description: longText(2000).optional().allow('', null),
  serviceKind: Joi.string().valid('service', 'package', 'membership').optional(),
  basePrice: positiveNumber.max(1000000).required(),
  currency: Joi.string().max(10).optional(),
  durationMinutes: positiveInt.max(1440).optional(),
  taxPercent: positiveNumber.max(100).optional(),
  paymentRule: Joi.string().valid('full', 'deposit').optional(),
  depositAmount: positiveNumber.max(1000000).optional(),
  isVariablePrice: Joi.boolean().optional(),
  cancellationPolicy: Joi.object().optional(),
  supportedSpecies: Joi.array().items(Joi.string().max(60)).optional(),
  availableAtPremises: Joi.boolean().optional(),
  availableMobile: Joi.boolean().optional(),
  sortOrder: Joi.number().integer().optional(),
});

export const updateGroomingServiceSchema = groomingServiceSchema.fork(
  ['name', 'basePrice'], (s) => s.optional()
).keys({ isActive: Joi.boolean().optional(), isPaused: Joi.boolean().optional() }).min(1);

export const groomingStaffSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid('manager', 'staff').required(),
});

export const groomingProviderRejectSchema = Joi.object({
  reason: Joi.string().min(5).max(500).required(),
});

export const createGroomingOrderSchema = Joi.object({
  providerId: uuid.required(),
  serviceId: uuid.required(),
  animalId: uuid.optional().allow(null),
  locationId: uuid.optional().allow(null),
  serviceMode: Joi.string().valid('premises', 'mobile').optional(),
  scheduledDate: Joi.date().required(),
  timeSlotStart: Joi.string().pattern(/^\d{2}:\d{2}/).required(),
  addons: Joi.array().items(Joi.object({
    name: shortText(200).required(),
    price: positiveNumber.max(1000000).required(),
  })).optional(),
  handlingNotes: longText(1000).optional().allow('', null),
  ownerNotes: longText(1000).optional().allow('', null),
  consent: Joi.object({
    handling: Joi.boolean().valid(true).required(),
    products: Joi.boolean().optional(),
    photography: Joi.boolean().optional(),
    emergencyContact: Joi.boolean().optional(),
  }).required(),
});

export const groomingCancelSchema = Joi.object({
  reason: shortText(500).optional().allow('', null),
});

// ─── Wallet withdrawals (038) ────────────────────────────────
// Payout details are conditional on the method: a UPI payout needs a VPA, a bank transfer needs
// name + account + IFSC. The service re-checks and returns the readable error.
export const walletWithdrawalRequestSchema = Joi.object({
  amount: Joi.number().positive().precision(2).required(),
  method: Joi.string().valid('bank_transfer', 'upi').optional(),
  accountName: shortText(255).optional().allow('', null),
  // .message() must attach directly to the rule it overrides. Chaining it after .allow()
  // throws "Cannot apply rules to empty ruleset" at MODULE LOAD, which tsc cannot see and
  // which takes the whole server down on boot - caught by npm run verify:runtime.
  accountNumber: Joi.string().pattern(/^\d{6,20}$/).message('Account number must be 6-20 digits')
    .optional().allow('', null),
  ifsc: Joi.string().pattern(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/).message('Enter a valid IFSC code')
    .optional().allow('', null),
  upiId: Joi.string().pattern(/^[\w.\-_]{2,64}@[a-zA-Z]{2,64}$/).message('Enter a valid UPI ID (name@bank)')
    .optional().allow('', null),
});

// ─── Grooming availability / working hours (037) ─────────────
// HH:MM, 24-hour. Deliberately strict: a malformed time parses to 0 in the slot engine and
// would silently open the salon at midnight.
const hhmm = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).message('Time must be HH:MM (24-hour)');
const isoDate = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).message('Date must be YYYY-MM-DD');

export const groomingScheduleSchema = Joi.object({
  dayOfWeek: Joi.number().integer().min(0).max(6).required(),
  locationId: uuid.optional().allow(null),
  openTime: hhmm.required(),
  closeTime: hhmm.required(),
  slotIntervalMinutes: Joi.number().integer().min(5).max(480).optional(),
  capacity: Joi.number().integer().min(1).max(100).optional(),
  isActive: Joi.boolean().optional(),
});

export const groomingDateOverrideSchema = Joi.object({
  overrideDate: isoDate.required(),
  overrideType: Joi.string().valid('closed', 'custom_hours').required(),
  locationId: uuid.optional().allow(null),
  // Required together with custom_hours; the service re-checks and returns a readable error.
  openTime: hhmm.optional().allow(null, ''),
  closeTime: hhmm.optional().allow(null, ''),
  slotIntervalMinutes: Joi.number().integer().min(5).max(480).optional().allow(null),
  capacity: Joi.number().integer().min(1).max(100).optional().allow(null),
  reason: shortText(500).optional().allow('', null),
});

export const groomingBlockedSlotSchema = Joi.object({
  startTime: hhmm.required(),
  endTime: hhmm.required(),
  blockDate: isoDate.optional().allow(null, ''),
  isRecurring: Joi.boolean().optional(),
  recurringDay: Joi.number().integer().min(0).max(6).optional().allow(null),
  locationId: uuid.optional().allow(null),
  reason: shortText(500).optional().allow('', null),
});

// ─── Grooming provider acceptance gate (036) ─────────────────
export const groomingAcceptSchema = Joi.object({
  note: shortText(500).optional().allow('', null),
});

// A decline triggers a full refund and is shown to the customer, so - unlike cancel - the
// reason is required and may not be blank.
export const groomingDeclineSchema = Joi.object({
  reason: shortText(500).required(),
});

// ─── Grooming ops (P3) ───────────────────────────────────────
const scentValue = Joi.string().valid('good', 'watch', 'vet_advised').optional().allow(null, '');

export const groomingTransitionSchema = Joi.object({
  toStatus: Joi.string().valid('provider_assigned', 'checked_in', 'en_route', 'intake_done',
    'in_progress', 'quality_check', 'ready_for_pickup', 'returning', 'completed', 'no_show').required(),
  note: shortText(500).optional().allow('', null),
});

export const groomingAssignSchema = Joi.object({
  staffId: uuid.optional().allow(null),
  resourceId: uuid.optional().allow(null),
  etaMinutes: positiveInt.max(600).optional().allow(null),
}).min(1);

export const groomingIntakeSchema = Joi.object({
  arrivalCondition: longText(1000).optional().allow('', null),
  temperament: shortText(50).optional().allow('', null),
  ownerInstructions: longText(1000).optional().allow('', null),
  allergies: longText(1000).optional().allow('', null),
  handlingRestrictions: longText(1000).optional().allow('', null),
  scentSkin: scentValue, scentCoat: scentValue, scentEars: scentValue, scentNails: scentValue, scentTeeth: scentValue,
  scentNotes: longText(1000).optional().allow('', null),
  beforePhotos: Joi.array().items(Joi.string().max(500)).optional(),
  consentHandling: Joi.boolean().optional(),
  consentProducts: Joi.boolean().optional(),
  consentPhotography: Joi.boolean().optional(),
  consentEmergencyContact: Joi.boolean().optional(),
});

export const groomingItemStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'started', 'completed', 'skipped', 'awaiting_approval', 'paused').required(),
  reason: shortText(500).optional().allow('', null),
  photoUrl: Joi.string().max(500).optional().allow('', null),
});

export const groomingReportCardSchema = Joi.object({
  afterPhotos: Joi.array().items(Joi.string().max(500)).optional(),
  productsUsed: longText(1000).optional().allow('', null),
  aftercareNotes: longText(2000).optional().allow('', null),
  summary: longText(2000).optional().allow('', null),
  nextRecommendedDate: Joi.date().optional().allow(null),
});

export const groomingSettleSchema = Joi.object({
  method: Joi.string().valid('bank_transfer', 'upi', 'other').optional(),
  // Required, not optional. Settlement is manual - the money moves outside this system, so the
  // reference is the ONLY evidence it happened, and it is what the provider is told.
  reference: shortText(120).required(),
  tdsAmount: positiveNumber.max(1000000).optional(),
  notes: longText(500).optional().allow('', null),
});

export const groomingVariableRequestSchema = Joi.object({
  name: shortText(200).required(),
  price: positiveNumber.max(1000000).required(),
  taxPercent: positiveNumber.max(100).optional().allow(null),
  reason: longText(1000).optional().allow('', null),
  photoUrl: Joi.string().max(500).optional().allow('', null),
});

export const groomingVariableRespondSchema = Joi.object({
  approve: Joi.boolean().required(),
});

export const groomingEscalationSchema = Joi.object({
  issueType: shortText(40).required(),
  description: longText(2000).optional().allow('', null),
  photos: Joi.array().items(Joi.string().max(500)).optional(),
});

export const groomingEscalationRespondSchema = Joi.object({
  status: Joi.string().valid('owner_notified', 'consult_booked', 'resolved', 'dismissed').required(),
  consultationBookingId: uuid.optional().allow(null),
});

export const groomingDisputeSchema = Joi.object({
  reason: shortText(100).required(),
  comments: longText(2000).optional().allow('', null),
  images: Joi.array().items(Joi.string().max(500)).optional(),
  requestedResolution: shortText(30).optional().allow('', null),
});

export const groomingDisputeRespondSchema = Joi.object({
  status: Joi.string().valid('under_review', 'resolved', 'partially_refunded', 'rejected').required(),
  resolutionNote: longText(2000).optional().allow('', null),
  refundAmount: positiveNumber.max(1000000).optional(),
});

