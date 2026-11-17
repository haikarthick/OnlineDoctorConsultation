import Joi from 'joi';
import { requiredUuid, longText } from './core';

// ─── Payment ─────────────────────────────────────────────────
export const createPaymentSchema = Joi.object({
  consultationId: requiredUuid,
  bookingId: Joi.string().uuid().optional(),
  amount: Joi.number().positive().required(),
  currency: Joi.string().max(3).optional().default('USD'),
  paymentMethod: Joi.string().valid('credit_card', 'debit_card', 'bank_transfer', 'e_wallet', 'cash').optional(),
});

// ── Payment module (docs/PAYMENT_MODULE_PLAN.md §9) ──────────
// NOTE: no client-supplied amounts anywhere - prices are server-derived.
export const checkoutPaymentSchema = Joi.object({
  useWallet: Joi.boolean().optional().default(false),
});

export const verifyPaymentSchema = Joi.object({
  paymentId: requiredUuid,
  // Razorpay fields (P2) - optional in demo mode
  gatewayOrderId: Joi.string().max(255).optional().allow('', null),
  gatewayPaymentId: Joi.string().max(255).optional().allow('', null),
  gatewaySignature: Joi.string().max(512).optional().allow('', null),
});

// ── Platform referrals (§4.4) ────────────────────────────────
export const createPlatformReferralSchema = Joi.object({
  toVetId: Joi.string().uuid().optional().allow(null),
  reason: Joi.string().min(3).max(1000).required(),
  bookingId: Joi.string().uuid().optional(),
  consultationId: Joi.string().uuid().optional(),
}).or('bookingId', 'consultationId');

export const acceptReferralSchema = Joi.object({
  veterinarianId: Joi.string().uuid().optional().allow(null),
  scheduledDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  timeSlotStart: Joi.string().pattern(/^\d{2}:\d{2}/).required(),
  timeSlotEnd: Joi.string().pattern(/^\d{2}:\d{2}/).required(),
  bookingType: Joi.string().valid('video_call', 'in_person', 'phone', 'chat', 'farm_visit', 'herd_consultation').optional(),
  reasonForVisit: Joi.string().max(1000).optional().allow('', null),
});

export const declineReferralSchema = Joi.object({
  refundDestination: Joi.string().valid('wallet', 'gateway').optional().default('wallet'),
});

// ── Legal & consent (§17) ────────────────────────────────────
export const legalAcceptSchema = Joi.object({
  docTypes: Joi.array().items(
    Joi.string().valid('terms', 'privacy', 'refund_policy', 'wallet_terms', 'doctor_agreement', 'grievance_policy', 'disclaimer')
  ).min(1).max(7).required(),
  context: Joi.string().valid('login_reacceptance', 'payout_setup').optional().default('login_reacceptance'),
});

export const adminLegalDocSchema = Joi.object({
  docType: Joi.string().valid('terms', 'privacy', 'refund_policy', 'wallet_terms', 'doctor_agreement', 'grievance_policy', 'disclaimer').required(),
  title: Joi.string().min(3).max(255).required(),
  content: Joi.string().min(1).max(500000).required(),
  requiresReacceptance: Joi.boolean().optional().default(false),
});

export const razorpayCredentialsSchema = Joi.object({
  keyId: Joi.string().max(255).required(),
  // Blank/omitted = keep the existing stored secret unchanged
  keySecret: Joi.string().max(255).optional().allow('', null),
  webhookSecret: Joi.string().max(255).optional().allow('', null),
});

// ─── Review ──────────────────────────────────────────────────
export const createReviewSchema = Joi.object({
  consultationId: requiredUuid,
  veterinarianId: requiredUuid,
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: longText(2000).optional().allow('', null),
  isPublic: Joi.boolean().optional(),
});

