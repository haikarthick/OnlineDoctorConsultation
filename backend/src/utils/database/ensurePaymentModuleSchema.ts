import { Pool } from 'pg';
import logger from '../logger';

import { PAYMENT_STATUSES_SQL, BOOKING_STATUSES_SQL, BOOKING_TYPES_SQL, INVOICE_TYPES_SQL } from './constants';

export async function ensurePaymentModuleSchema(pool: Pool): Promise<void> {
    const ddl: string[] = [
      // payments columns
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR(255)`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_payment_id VARCHAR(255)`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_fee_amount DECIMAL(10,2) DEFAULT 0`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS commission_percent DECIMAL(5,2)`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS commission_flat DECIMAL(10,2)`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2)`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS doctor_earning_amount DECIMAL(10,2)`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS wallet_amount_used DECIMAL(10,2) DEFAULT 0`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS processing_charge_amount DECIMAL(10,2) DEFAULT 0`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_destination VARCHAR(20) CHECK (refund_destination IN ('wallet', 'gateway'))`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`,
      `ALTER TABLE payments ALTER COLUMN currency SET DEFAULT 'INR'`,
      `ALTER TABLE payments ALTER COLUMN gateway SET DEFAULT 'demo'`,
      `CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id)`,
      `CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`,
      // status CHECK extensions
      `ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check`,
      `ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN (${PAYMENT_STATUSES_SQL}))`,
      `ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check`,
      `ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN (${BOOKING_STATUSES_SQL}))`,
      `ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_booking_type_check`,
      `ALTER TABLE bookings ADD CONSTRAINT bookings_booking_type_check CHECK (booking_type IN (${BOOKING_TYPES_SQL}))`,
      // vet_profiles
      `ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS commission_percent_override DECIMAL(5,2)`,
      `ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS commission_flat_override DECIMAL(10,2)`,
      `ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS emergency_consultation_fee DECIMAL(10,2)`,
      `ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS gstin VARCHAR(20)`,
      `ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS payout_account_name VARCHAR(255)`,
      `ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS payout_account_number VARCHAR(50)`,
      `ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS payout_ifsc VARCHAR(20)`,
      `ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS payout_upi VARCHAR(100)`,
      `ALTER TABLE vet_profiles ALTER COLUMN currency SET DEFAULT 'INR'`,
      `ALTER TABLE wallets ALTER COLUMN currency SET DEFAULT 'INR'`,
      // referrals
      `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referral_type VARCHAR(20) NOT NULL DEFAULT 'hospital' CHECK (referral_type IN ('hospital', 'platform'))`,
      `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL`,
      `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL`,
      `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS transfer_status VARCHAR(20) CHECK (transfer_status IN ('offered', 'accepted', 'rechosen', 'refunded', 'expired', 'completed'))`,
      `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS action_deadline TIMESTAMP`,
      `CREATE INDEX IF NOT EXISTS idx_referrals_booking ON referrals(booking_id)`,
      // new tables
      `CREATE TABLE IF NOT EXISTS payment_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
        gateway_event_id VARCHAR(255) UNIQUE,
        event_type VARCHAR(50) NOT NULL,
        from_status VARCHAR(30),
        to_status VARCHAR(30),
        actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        payload JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_payment_events_payment ON payment_events(payment_id)`,
      `CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        amount DECIMAL(10,2) NOT NULL,
        tds_rate DECIMAL(5,2) DEFAULT 0,
        tds_amount DECIMAL(10,2) DEFAULT 0,
        net_paid_amount DECIMAL(10,2),
        status VARCHAR(20) NOT NULL DEFAULT 'requested'
          CHECK (status IN ('requested', 'approved', 'rejected', 'settled', 'cancelled')),
        is_discretionary BOOLEAN NOT NULL DEFAULT false,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMP,
        settled_by UUID REFERENCES users(id) ON DELETE SET NULL,
        settled_at TIMESTAMP,
        utr_reference VARCHAR(100),
        admin_note TEXT,
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_withdrawals_doctor ON withdrawal_requests(doctor_id)`,
      `CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawal_requests(status)`,
      `CREATE TABLE IF NOT EXISTS doctor_earnings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
        booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
        consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
        gross_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        net_amount DECIMAL(10,2) NOT NULL,
        type VARCHAR(30) NOT NULL
          CHECK (type IN ('consultation', 'cancel_compensation', 'no_show_compensation', 'penalty', 'adjustment')),
        status VARCHAR(20) NOT NULL DEFAULT 'clearing'
          CHECK (status IN ('clearing', 'available', 'locked', 'withdrawn', 'reversed')),
        reason TEXT,
        clear_at TIMESTAMP,
        withdrawal_id UUID REFERENCES withdrawal_requests(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_doctor_earnings_doctor ON doctor_earnings(doctor_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_doctor_earnings_clear ON doctor_earnings(status, clear_at)`,
      `CREATE TABLE IF NOT EXISTS tax_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sac_code VARCHAR(20) UNIQUE NOT NULL,
        label VARCHAR(255) NOT NULL,
        rate_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_number VARCHAR(100) UNIQUE NOT NULL,
        invoice_type VARCHAR(20) NOT NULL CHECK (invoice_type IN (${INVOICE_TYPES_SQL})),
        payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
        withdrawal_id UUID REFERENCES withdrawal_requests(id) ON DELETE SET NULL,
        issuer_details JSONB NOT NULL DEFAULT '{}',
        recipient_details JSONB NOT NULL DEFAULT '{}',
        line_items JSONB NOT NULL DEFAULT '[]',
        subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
        tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        total DECIMAL(10,2) NOT NULL DEFAULT 0,
        sac_code VARCHAR(20),
        tax_rate DECIMAL(5,2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'INR',
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_invoices_payment ON invoices(payment_id)`,
      `CREATE TABLE IF NOT EXISTS legal_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doc_type VARCHAR(30) NOT NULL
          CHECK (doc_type IN ('terms', 'privacy', 'refund_policy', 'wallet_terms', 'doctor_agreement', 'grievance_policy', 'disclaimer')),
        version INTEGER NOT NULL DEFAULT 1,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        requires_reacceptance BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (doc_type, version)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_legal_docs_type ON legal_documents(doc_type, is_active)`,
      `CREATE TABLE IF NOT EXISTS user_policy_acceptances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        user_email VARCHAR(255),
        doc_type VARCHAR(30) NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        context VARCHAR(30) NOT NULL DEFAULT 'registration'
          CHECK (context IN ('registration', 'invite', 'login_reacceptance', 'payout_setup')),
        ip_address VARCHAR(64),
        user_agent TEXT,
        accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_policy_accept_user ON user_policy_acceptances(user_id, doc_type)`,
      `CREATE TABLE IF NOT EXISTS payment_gateway_credentials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        environment VARCHAR(10) NOT NULL UNIQUE CHECK (environment IN ('test', 'live')),
        key_id VARCHAR(255),
        key_secret_encrypted TEXT,
        webhook_secret_encrypted TEXT,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    ];
    for (const stmt of ddl) {
      await pool.query(stmt).catch((e: any) =>
        logger.warn('Payment module schema safety-net statement failed', { error: e.message })
      );
    }

    // Seed SAC master + payment/settlement settings (same keys as migration 012)
    await pool.query(`
      INSERT INTO tax_codes (id, sac_code, label, rate_percent, is_active) VALUES
        (gen_random_uuid(), '998351', 'Veterinary services for pet animals (GST-exempt healthcare)', 0, true),
        (gen_random_uuid(), '998352', 'Veterinary services for livestock (GST-exempt healthcare)', 0, true),
        (gen_random_uuid(), '998599', 'Platform facilitation / commission services', 18, true),
        (gen_random_uuid(), '300490', 'Pharmacy - dispensed veterinary medicaments (HSN 3004)', 12, true)
      ON CONFLICT (sac_code) DO NOTHING
    `).catch((e: any) => logger.warn('tax_codes seed failed', { error: e.message }));

    await pool.query(`
      INSERT INTO system_settings (id, key, value, category, description) VALUES
        (gen_random_uuid(), 'payment.enabled', 'false', 'payment', 'Master feature flag for the payment module. false = platform behaves exactly as before'),
        (gen_random_uuid(), 'payment.holdMinutes', '15', 'payment', 'Minutes a payment_pending booking holds its slot before auto-expiry'),
        (gen_random_uuid(), 'payment.emergencyHoldMinutes', '5', 'payment', 'Slot-hold minutes for emergency booking checkout'),
        (gen_random_uuid(), 'commission.defaultPercent', '15', 'commission', 'Global platform commission percentage of consultation fee'),
        (gen_random_uuid(), 'commission.flatFee', '20', 'commission', 'Global flat platform fee per paid booking (INR), added to percentage commission'),
        (gen_random_uuid(), 'cancellation.processingFlatFee', '25', 'cancellation', 'Flat component of the cancellation processing charge deducted from patient-cancel refunds (INR)'),
        (gen_random_uuid(), 'settlement.clearanceDays', '2', 'settlement', 'Days after consultation completion before doctor earnings become withdrawable'),
        (gen_random_uuid(), 'settlement.minWithdrawalAmount', '500', 'settlement', 'Minimum available balance (INR) required for a doctor withdrawal request'),
        (gen_random_uuid(), 'settlement.tdsRatePercent', '0.1', 'settlement', 'TDS percentage deducted on doctor payouts (Section 194-O; confirm with CA)'),
        (gen_random_uuid(), 'compensation.doctorShareOfRetainedPercent', '50', 'compensation', 'Doctor share (%) of money retained on late patient cancellation'),
        (gen_random_uuid(), 'compensation.doctorShareOnPatientNoShowPercent', '100', 'compensation', 'Doctor share (%) of his net earning when the patient no-shows'),
        (gen_random_uuid(), 'compensation.negativeBalanceAlertAmount', '2000', 'compensation', 'Admin alert threshold for deep-negative doctor balances (INR, absolute value)'),
        (gen_random_uuid(), 'referral.actionWindowHours', '72', 'referral', 'Hours a patient has to act on a pre-consultation referral before auto-refund'),
        (gen_random_uuid(), 'booking.emergencyConfirmMinutes', '10', 'booking', 'Minutes a doctor has to confirm an emergency booking before alternatives are offered'),
        (gen_random_uuid(), 'tax.platformGstin', '', 'tax', 'Platform GSTIN shown on invoices'),
        (gen_random_uuid(), 'tax.platformLegalName', '', 'tax', 'Platform legal entity name shown on invoices'),
        (gen_random_uuid(), 'tax.invoicePrefix', 'VC', 'tax', 'Invoice number prefix (e.g. VC/2026-27/00001)')
      ON CONFLICT (key) DO NOTHING
    `).catch((e: any) => logger.warn('payment module system_settings seed failed', { error: e.message }));

    // §17.1: placeholder v1 policy documents (admin replaces content with
    // lawyer-drafted text via Admin → Legal & Policies; publishing creates v2+)
    await pool.query(`
      INSERT INTO legal_documents (id, doc_type, version, title, content, requires_reacceptance, is_active) VALUES
        (gen_random_uuid(), 'terms', 1, 'Terms of Service', 'Placeholder Terms of Service. The platform acts as merchant of record for consultation services; veterinarians provide services under a separate service-provider agreement. Replace this text with the lawyer-approved Terms of Service before production go-live.', false, true),
        (gen_random_uuid(), 'privacy', 1, 'Privacy Policy', 'Placeholder Privacy Policy aligned to the DPDP Act 2023. Replace this text with the lawyer-approved Privacy Policy before production go-live.', false, true),
        (gen_random_uuid(), 'refund_policy', 1, 'Refund & Cancellation Policy', 'Placeholder Refund & Cancellation Policy. Doctor cancellation: full refund plus goodwill bonus. Patient cancellation: full refund minus a cancellation processing charge when cancelled 24 hours or more before the appointment; 50 percent minus the processing charge between 2 and 24 hours; no refund within 2 hours. Replace with the final policy text before go-live.', false, true),
        (gen_random_uuid(), 'wallet_terms', 1, 'Wallet Terms', 'Placeholder Wallet Terms. The wallet is a closed credit usable only on this platform. Wallet balances cannot be withdrawn as cash. Refund-sourced balances never expire and are returned to the original payment method on account closure. Replace with lawyer-approved text before go-live.', false, true),
        (gen_random_uuid(), 'doctor_agreement', 1, 'Doctor Service-Provider Agreement', 'Placeholder Doctor Agreement covering platform commission, settlement clearance windows, cancellation penalties, referral rules and professional responsibility. Replace with the lawyer-approved agreement before production go-live.', false, true),
        (gen_random_uuid(), 'grievance_policy', 1, 'Grievance Redressal Policy', 'Placeholder Grievance Redressal Policy. A named grievance officer and escalation timelines are required under the Consumer Protection (E-Commerce) Rules 2020. Replace with the final policy and officer details before go-live.', false, true),
        (gen_random_uuid(), 'disclaimer', 1, 'Service Disclaimer', 'Placeholder Service Disclaimer. Online consultation is not a substitute for physical emergency veterinary care. In an emergency, visit the nearest veterinary clinic immediately. Replace with the final disclaimer before go-live.', false, true)
      ON CONFLICT (doc_type, version) DO NOTHING
    `).catch((e: any) => logger.warn('legal_documents seed failed', { error: e.message }));

    await pool.query(`
      INSERT INTO payment_gateway_credentials (id, environment) VALUES
        (gen_random_uuid(), 'test'),
        (gen_random_uuid(), 'live')
      ON CONFLICT (environment) DO NOTHING
    `).catch((e: any) => logger.warn('payment_gateway_credentials seed failed', { error: e.message }));
}
