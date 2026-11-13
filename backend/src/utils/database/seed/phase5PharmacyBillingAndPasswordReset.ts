import { Pool } from 'pg';
import logger from '../../logger';
import { PAYMENT_SOURCES_SQL, INVOICE_TYPES_SQL } from '../constants';

export async function phase5PharmacyBillingAndPasswordReset(pool: Pool): Promise<void> {
    // ── Phase 4: Pharmacy billing integration ─────────────────
    // Add dispensing_id and payment_source to payments (link dispensing to payment system)
    await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS dispensing_id UUID REFERENCES dispensing_records(id) ON DELETE SET NULL`).catch(() => {});
    await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_source VARCHAR(30) DEFAULT 'consultation'`).catch(() => {});
    // payment_source CHECK - derive from PAYMENT_SOURCES and REBUILD it, never inline the list
    // behind an IF NOT EXISTS. The old guarded form could only ever create the constraint, so a
    // migration that widened it was invisible here and a widened value stayed rejected forever.
    await pool.query(`ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_source_check`).catch(() => {});
    await pool.query(`
      ALTER TABLE payments ADD CONSTRAINT payments_payment_source_check
        CHECK (payment_source IN (${PAYMENT_SOURCES_SQL}))
    `).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_dispensing_id ON payments(dispensing_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_payment_source ON payments(payment_source)`).catch(() => {});

    // Add reviewed_by / reviewed_at / review_notes to prescriptions (safety net)
    await pool.query(`ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL`).catch(() => {});
    await pool.query(`ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`).catch(() => {});
    await pool.query(`ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS review_notes TEXT`).catch(() => {});

    // GSTIN on the pharmacy entity itself (issuer of the pharmacy invoice, distinct from the network's own GSTIN)
    await pool.query(`ALTER TABLE hospital_pharmacies ADD COLUMN IF NOT EXISTS gstin VARCHAR(20)`).catch(() => {});

    // invoice_type CHECK - derive from INVOICE_TYPES, never inline the list (this block used to
    // hardcode 3 values and silently dropped 'grooming' back off on every boot)
    await pool.query(`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_type_check`).catch(() => {});
    await pool.query(`
      ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_type_check
        CHECK (invoice_type IN (${INVOICE_TYPES_SQL}))
    `).catch(() => {});

    // Add withdrawal_period_days to pharmacy_medications (for livestock)
    await pool.query(`ALTER TABLE pharmacy_medications ADD COLUMN IF NOT EXISTS withdrawal_period_days INTEGER DEFAULT 0`).catch(() => {});
    await pool.query(`ALTER TABLE pharmacy_medications ADD COLUMN IF NOT EXISTS is_refrigerated BOOLEAN DEFAULT false`).catch(() => {});

    // review_status CHECK was missing 'needs_clarification', so the pharmacist-review route
    // silently collapsed that outcome to 'pending_review' and the status could never be
    // distinguished again once the one-time notification was read.
    await pool.query(`ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_review_status_check`).catch(() => {});
    await pool.query(`
      ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_review_status_check
        CHECK (review_status IN ('pending_review','reviewed','rejected','approved_for_dispensing','dispensed','needs_clarification'))
    `).catch(() => {});

    // ── Password Reset Tokens (self-service forgot-password flow) ──────────
    // token_hash: SHA-256 of the raw token sent in the email link.
    // Storing only the hash means a DB leak cannot be used to reset accounts.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash   VARCHAR(64) NOT NULL UNIQUE,
        expires_at   TIMESTAMPTZ NOT NULL,
        used_at      TIMESTAMPTZ,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens(token_hash)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_prt_user_id   ON password_reset_tokens(user_id)`).catch(() => {});

    logger.info('Default system settings seeded');
}
