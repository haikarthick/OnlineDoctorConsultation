import Joi from 'joi';
import { uuid, requiredUuid, shortText, longText, positiveInt, positiveNumber } from './core';

// ─── Tier 4: Marketplace ─────────────────────────────────────
const livestockFields = {
  species: Joi.string().max(50).optional().allow('', null),
  breed: Joi.string().max(100).optional().allow('', null),
  animalAgeMonths: Joi.number().integer().min(0).max(600).optional().allow(null),
  animalWeightKg: Joi.number().min(0).max(5000).optional().allow(null),
  gender: Joi.string().valid('male', 'female', 'unknown').optional().allow('', null),
  animalClass: Joi.string().max(30).optional().allow('', null),
  lactationNumber: Joi.number().integer().min(0).max(20).optional().allow(null),
  dailyMilkYield: Joi.number().min(0).max(100).optional().allow(null),
  pregnancyStatus: Joi.string().valid('not_pregnant', 'pregnant', 'unknown').optional().allow('', null),
  pregnancyMonth: Joi.number().integer().min(0).max(12).optional().allow(null),
  vaccinationStatus: Joi.string().valid('fully_vaccinated', 'partially_vaccinated', 'not_vaccinated', 'unknown').optional(),
  healthCertificate: Joi.boolean().optional(),
  // listingTier / isHotDeal are admin-granted promotion flags - sellers cannot
  // set them, so they are intentionally absent (stripUnknown drops them)
  linkedAnimalId: Joi.string().uuid().optional().allow('', null),
  auctionEndTime: Joi.string().optional().allow('', null),
  reservePrice: Joi.number().min(0).optional().allow(null),
  contactPhone: Joi.string().max(20).optional().allow('', null),
  latitude: Joi.number().min(-90).max(90).optional().allow(null),
  longitude: Joi.number().min(-180).max(180).optional().allow(null),
  sellerType: Joi.string().valid('individual', 'registered_breeder', 'shelter', 'rescue').optional(),
  registrationNumber: Joi.string().max(100).optional().allow('', null),
  welfareAttestation: Joi.boolean().optional(),
  termsAccepted: Joi.boolean().optional(),
};

export const createMarketplaceListingSchema = Joi.object({
  enterpriseId: uuid.optional(),
  title: shortText().required(),
  description: longText(5000).optional().allow('', null),
  category: shortText(100).optional(),
  listingType: Joi.string().valid('fixed_price', 'sale', 'auction', 'wanted').optional(),
  price: positiveNumber.optional().allow(null),
  currency: Joi.string().max(3).optional(),
  quantity: positiveInt.optional(),
  unit: shortText(20).optional(),
  condition: shortText(50).optional(),
  images: Joi.array().items(Joi.alternatives().try(Joi.string().uri().max(2000), Joi.string().pattern(/^\/uploads\//).max(2000))).max(4).optional(),
  videoUrl: Joi.alternatives().try(Joi.string().uri().max(2000), Joi.string().pattern(/^\/uploads\//).max(2000)).optional().allow('', null),
  location: shortText(500).optional().allow('', null),
  shippingOptions: Joi.array().items(Joi.any()).optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  expiresAt: Joi.string().optional().allow('', null),
  ...livestockFields,
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
  images: Joi.array().items(Joi.alternatives().try(Joi.string().uri().max(2000), Joi.string().pattern(/^\/uploads\//).max(2000))).max(4).optional(),
  videoUrl: Joi.alternatives().try(Joi.string().uri().max(2000), Joi.string().pattern(/^\/uploads\//).max(2000)).optional().allow('', null),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  listingType: Joi.string().valid('sale', 'auction', 'wanted').optional(),
  featured: Joi.boolean().optional(),
  ...livestockFields,
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

// Deal handshake (free classifieds - money settles off-platform between the parties)
export const confirmDealSchema = Joi.object({
  paymentMethod: Joi.string().valid('cash', 'upi', 'bank_transfer', 'other').optional().allow('', null),
});

export const cancelDealSchema = Joi.object({
  reason: shortText(500).optional().allow('', null),
});

// ─── Marketplace engagement (Phase 3): messaging, saved searches ───
export const startThreadSchema = Joi.object({
  message: longText(2000).optional().allow('', null),
});

export const sendMessageSchema = Joi.object({
  message: longText(2000).required(),
});

const savedSearchFilters = Joi.object({
  category: shortText(60).optional().allow('', null),
  species: shortText(60).optional().allow('', null),
  breed: shortText(100).optional().allow('', null),
  gender: Joi.string().valid('male', 'female', 'unknown').optional().allow('', null),
  listingType: Joi.string().valid('fixed_price', 'sale', 'auction', 'wanted').optional().allow('', null),
  vaccinationStatus: Joi.string().valid('fully_vaccinated', 'partially_vaccinated', 'not_vaccinated', 'unknown').optional().allow('', null),
  minPrice: Joi.number().min(0).optional().allow(null),
  maxPrice: Joi.number().min(0).optional().allow(null),
  search: shortText(200).optional().allow('', null),
}).unknown(true); // extra keys are ignored server-side by the sanitizer

export const createSavedSearchSchema = Joi.object({
  name: shortText(120).required(),
  filters: savedSearchFilters.optional(),
  alertsEnabled: Joi.boolean().optional(),
});

export const updateSavedSearchSchema = Joi.object({
  name: shortText(120).optional(),
  filters: savedSearchFilters.optional(),
  alertsEnabled: Joi.boolean().optional(),
}).min(1);

export const reportListingSchema = Joi.object({
  reason: Joi.string().valid('scam', 'welfare_concern', 'prohibited', 'miscategorized', 'offensive', 'wrong_info', 'other').required(),
  details: longText(1000).optional().allow('', null),
});

export const resolveReportSchema = Joi.object({
  status: Joi.string().valid('reviewing', 'actioned', 'dismissed').required(),
  resolution: longText(1000).optional().allow('', null),
});

// ─── Tier 4: Marketplace Monetization ────────────────────────
export const updateMonetizationSettingSchema = Joi.object({
  settingValue: Joi.object().optional(),
  isEnabled: Joi.boolean().optional(),
}).min(1);

export const createMarketplacePlanSchema = Joi.object({
  name: shortText(100).required(),
  description: longText(1000).optional().allow('', null),
  price: Joi.number().min(0).required(),
  currency: shortText(10).optional(),
  durationDays: Joi.number().integer().min(0).optional(),
  features: Joi.object().optional(),
  maxListings: Joi.number().integer().allow(null).optional(),
  maxBoostsPerMonth: Joi.number().integer().min(0).optional(),
  prioritySupport: Joi.boolean().optional(),
  analyticsAccess: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
});

export const updateMarketplacePlanSchema = Joi.object({
  name: shortText(100).optional(),
  description: longText(1000).optional().allow('', null),
  price: Joi.number().min(0).optional(),
  durationDays: Joi.number().integer().min(0).optional(),
  features: Joi.object().optional(),
  maxListings: Joi.number().integer().allow(null).optional(),
  maxBoostsPerMonth: Joi.number().integer().min(0).optional(),
  prioritySupport: Joi.boolean().optional(),
  analyticsAccess: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
}).min(1);

export const boostListingSchema = Joi.object({
  boostType: Joi.string().valid('standard', 'premium', 'spotlight').optional(),
});

export const createInquirySchema = Joi.object({
  message: longText(2000).optional().allow('', null),
});

export const respondInquirySchema = Joi.object({
  revealContact: Joi.boolean().optional(),
});

export const createSubscriptionSchema = Joi.object({
  planId: requiredUuid,
});

