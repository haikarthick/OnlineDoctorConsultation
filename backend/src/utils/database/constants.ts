/**
 * Canonical system-role list - the ONLY place the legacy self-heal below may get roles from.
 *
 * The self-heal blocks unconditionally DROP and re-ADD users.role / user_roles.role CHECK
 * constraints on every startup. They used to carry their own inlined copies of this list, which
 * silently fell behind: migration 030 correctly widened the constraints to include
 * 'groomer'/'support', then the next boot clobbered it back to the pre-grooming 7 - so groomer
 * registration failed with `users_role_check` on every already-deployed environment while a
 * freshly-seeded local DB looked fine.
 *
 * MUST stay in sync with: docker/init.sql (users + user_roles CHECKs),
 * backend/migrations/030_grooming_roles.sql, PermissionService.DEFAULT_ROLE_PERMISSIONS,
 * and the role enums in middleware/validation.ts.
 */
export const SYSTEM_ROLES = [
  'farmer', 'pet_owner', 'veterinarian', 'admin',
  'corporate_admin', 'hospital_staff', 'pharmacist', 'groomer', 'support',
] as const;
export const SYSTEM_ROLES_SQL = SYSTEM_ROLES.map(r => `'${r}'`).join(', ');

/**
 * Canonical invoice types - same anti-drift rule as SYSTEM_ROLES above.
 * The self-heal was still rebuilding invoices_invoice_type_check without 'grooming', so every
 * grooming GST invoice (GRM series) would have been rejected in production the same way
 * groomer registration was. Caught by scripts/runtime-verify.js.
 * MUST stay in sync with docker/init.sql and migrations/031_grooming_payments.sql.
 */
export const INVOICE_TYPES = ['consultation', 'commission', 'pharmacy', 'grooming', 'grooming_credit_note'] as const;
export const INVOICE_TYPES_SQL = INVOICE_TYPES.map(t => `'${t}'`).join(', ');

/**
 * Canonical payment sources - same anti-drift rule as SYSTEM_ROLES / INVOICE_TYPES above.
 * `payment_source` is what separates the revenue streams: the finance overview counts GMV
 * WHERE payment_source = 'consultation', and the Razorpay webhook routes completion by it.
 * A grooming payment left labelled 'consultation' is both wrong money and wrong routing.
 * MUST stay in sync with migrations/033_grooming_payment_integration.sql.
 */
export const PAYMENT_SOURCES = ['consultation', 'pharmacy', 'subscription', 'other', 'grooming'] as const;
export const PAYMENT_SOURCES_SQL = PAYMENT_SOURCES.map(s => `'${s}'`).join(', ');

/**
 * The last three enumerated CHECK lists the self-heal still rebuilt from its own inline copies.
 * Extracted 2026-07-28 after verifying each was byte-identical to docker/init.sql §46.1/§46.2 -
 * a hazard removal, not a behaviour change. With these, NO constraint value list remains inlined
 * in the self-heal, so it can no longer fall behind a migration the way the role list did.
 *   payments.status       → docker/init.sql §46.1
 *   bookings.status       → docker/init.sql §46.2
 *   bookings.booking_type → docker/init.sql §46.2
 */
export const PAYMENT_STATUSES = [
  'pending', 'processing', 'created', 'completed', 'failed',
  'refunded', 'partially_refunded', 'expired', 'transferred',
] as const;
export const PAYMENT_STATUSES_SQL = PAYMENT_STATUSES.map(s => `'${s}'`).join(', ');

export const BOOKING_STATUSES = [
  'pending', 'confirmed', 'cancelled', 'rescheduled', 'completed',
  'missed', 'payment_pending', 'payment_expired', 'referred',
] as const;
export const BOOKING_STATUSES_SQL = BOOKING_STATUSES.map(s => `'${s}'`).join(', ');

export const BOOKING_TYPES = [
  'video_call', 'in_person', 'phone', 'chat', 'farm_visit', 'herd_consultation',
] as const;
export const BOOKING_TYPES_SQL = BOOKING_TYPES.map(s => `'${s}'`).join(', ');
