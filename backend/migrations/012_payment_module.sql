-- Migration: 012_payment_module.sql
-- Payment module foundations (Phase P0 of docs/PAYMENT_MODULE_PLAN.md):
--   payments/bookings/vet_profiles/referrals extensions, earnings ledger,
--   withdrawals, payment events, invoices, tax codes, legal documents,
--   policy acceptances, INR defaults, and payment/settlement settings seeds.
-- Fully idempotent - safe to re-run.

-- ── 1. payments: gateway + commission + fee-recovery columns ─
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_payment_id VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_fee_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS commission_percent DECIMAL(5,2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS commission_flat DECIMAL(10,2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS doctor_earning_amount DECIMAL(10,2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS wallet_amount_used DECIMAL(10,2) DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS processing_charge_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_destination VARCHAR(20)
  CHECK (refund_destination IN ('wallet', 'gateway'));
ALTER TABLE payments ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_status_check') THEN
    ALTER TABLE payments DROP CONSTRAINT payments_status_check;
  END IF;
  ALTER TABLE payments ADD CONSTRAINT payments_status_check
    CHECK (status IN ('pending', 'processing', 'created', 'completed', 'failed',
                      'refunded', 'partially_refunded', 'expired', 'transferred'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE payments ALTER COLUMN currency SET DEFAULT 'INR';
ALTER TABLE payments ALTER COLUMN gateway SET DEFAULT 'demo';

CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ── 2. bookings: payment lifecycle statuses + booking_type fix ─
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_status_check') THEN
    ALTER TABLE bookings DROP CONSTRAINT bookings_status_check;
  END IF;
  ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rescheduled', 'completed',
                      'missed', 'payment_pending', 'payment_expired', 'referred'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Latent bug fix: Joi allows farm_visit/herd_consultation but the DB CHECK did not
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_booking_type_check') THEN
    ALTER TABLE bookings DROP CONSTRAINT bookings_booking_type_check;
  END IF;
  ALTER TABLE bookings ADD CONSTRAINT bookings_booking_type_check
    CHECK (booking_type IN ('video_call', 'in_person', 'phone', 'chat',
                            'farm_visit', 'herd_consultation'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. vet_profiles: commission overrides, emergency fee, GST + payout details ─
ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS commission_percent_override DECIMAL(5,2);
ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS commission_flat_override DECIMAL(10,2);
ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS emergency_consultation_fee DECIMAL(10,2);
ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS gstin VARCHAR(20);
ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS payout_account_name VARCHAR(255);
ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS payout_account_number VARCHAR(50);
ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS payout_ifsc VARCHAR(20);
ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS payout_upi VARCHAR(100);
ALTER TABLE vet_profiles ALTER COLUMN currency SET DEFAULT 'INR';

-- ── 4. wallets: INR default ─────────────────────────────────
ALTER TABLE wallets ALTER COLUMN currency SET DEFAULT 'INR';

-- INR single-currency migration (D5) - dev/demo data only; prod is clean-start (D14)
UPDATE payments SET currency = 'INR' WHERE currency = 'USD';
UPDATE wallets SET currency = 'INR' WHERE currency = 'USD';
UPDATE vet_profiles SET currency = 'INR' WHERE currency = 'USD';

-- ── 5. referrals: platform referral + payment transfer support (D10) ─
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referral_type VARCHAR(20) NOT NULL DEFAULT 'hospital'
  CHECK (referral_type IN ('hospital', 'platform'));
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS transfer_status VARCHAR(20)
  CHECK (transfer_status IN ('offered', 'accepted', 'rechosen', 'refunded', 'expired', 'completed'));
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS action_deadline TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_referrals_booking ON referrals(booking_id);

-- ── 6. payment_events: append-only audit + webhook idempotency ─
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  gateway_event_id VARCHAR(255) UNIQUE,
  event_type VARCHAR(50) NOT NULL,
  from_status VARCHAR(30),
  to_status VARCHAR(30),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  payload JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment ON payment_events(payment_id);

-- ── 7. withdrawal_requests (created before doctor_earnings for the FK) ─
CREATE TABLE IF NOT EXISTS withdrawal_requests (
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
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_doctor ON withdrawal_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawal_requests(status);

-- ── 8. doctor_earnings ledger (D3/D9/D12) ───────────────────
CREATE TABLE IF NOT EXISTS doctor_earnings (
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
);
CREATE INDEX IF NOT EXISTS idx_doctor_earnings_doctor ON doctor_earnings(doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_doctor_earnings_clear ON doctor_earnings(status, clear_at);

-- ── 9. tax_codes: SAC master (D8/D13 - admin-editable rates) ─
CREATE TABLE IF NOT EXISTS tax_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sac_code VARCHAR(20) UNIQUE NOT NULL,
  label VARCHAR(255) NOT NULL,
  rate_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tax_codes (id, sac_code, label, rate_percent, is_active) VALUES
  (gen_random_uuid(), '998351', 'Veterinary services for pet animals (GST-exempt healthcare)', 0, true),
  (gen_random_uuid(), '998352', 'Veterinary services for livestock (GST-exempt healthcare)', 0, true),
  (gen_random_uuid(), '998599', 'Platform facilitation / commission services', 18, true)
ON CONFLICT (sac_code) DO NOTHING;

-- ── 10. invoices: immutable snapshots (§7) ──────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  invoice_type VARCHAR(20) NOT NULL CHECK (invoice_type IN ('consultation', 'commission')),
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
);
CREATE INDEX IF NOT EXISTS idx_invoices_payment ON invoices(payment_id);

-- ── 11. legal_documents: versioned policies (§17) ───────────
CREATE TABLE IF NOT EXISTS legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type VARCHAR(30) NOT NULL
    CHECK (doc_type IN ('terms', 'privacy', 'refund_policy', 'wallet_terms',
                        'doctor_agreement', 'grievance_policy', 'disclaimer')),
  version INTEGER NOT NULL DEFAULT 1,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  requires_reacceptance BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (doc_type, version)
);
CREATE INDEX IF NOT EXISTS idx_legal_docs_type ON legal_documents(doc_type, is_active);

-- ── 12. user_policy_acceptances: provable consent (§17) ─────
-- user_email is snapshotted so consent proof survives user deletion (FK SET NULL)
CREATE TABLE IF NOT EXISTS user_policy_acceptances (
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
);
CREATE INDEX IF NOT EXISTS idx_policy_accept_user ON user_policy_acceptances(user_id, doc_type);

-- ── 13. updated_at triggers for new tables ──────────────────
DROP TRIGGER IF EXISTS update_withdrawal_requests_updated_at ON withdrawal_requests;
CREATE TRIGGER update_withdrawal_requests_updated_at BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_doctor_earnings_updated_at ON doctor_earnings;
CREATE TRIGGER update_doctor_earnings_updated_at BEFORE UPDATE ON doctor_earnings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tax_codes_updated_at ON tax_codes;
CREATE TRIGGER update_tax_codes_updated_at BEFORE UPDATE ON tax_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 14. settings seeds (all admin-configurable; module ships dark) ─
INSERT INTO system_settings (id, key, value, category, description) VALUES
  (gen_random_uuid(), 'payment.enabled', 'false', 'payment',
   'Master feature flag for the payment module. false = platform behaves exactly as before'),
  (gen_random_uuid(), 'payment.holdMinutes', '15', 'payment',
   'Minutes a payment_pending booking holds its slot before auto-expiry'),
  (gen_random_uuid(), 'payment.emergencyHoldMinutes', '5', 'payment',
   'Slot-hold minutes for emergency booking checkout'),
  (gen_random_uuid(), 'payment.currency', 'INR', 'payment',
   'Platform currency (single-currency v1)'),
  (gen_random_uuid(), 'commission.defaultPercent', '15', 'commission',
   'Global platform commission percentage of consultation fee'),
  (gen_random_uuid(), 'commission.flatFee', '20', 'commission',
   'Global flat platform fee per paid booking (INR), added to percentage commission'),
  (gen_random_uuid(), 'cancellation.processingFlatFee', '25', 'cancellation',
   'Flat component of the cancellation processing charge deducted from patient-cancel refunds (INR)'),
  (gen_random_uuid(), 'settlement.clearanceDays', '2', 'settlement',
   'Days after consultation completion before doctor earnings become withdrawable'),
  (gen_random_uuid(), 'settlement.minWithdrawalAmount', '500', 'settlement',
   'Minimum available balance (INR) required for a doctor withdrawal request'),
  (gen_random_uuid(), 'settlement.tdsRatePercent', '0.1', 'settlement',
   'TDS percentage deducted on doctor payouts (Section 194-O; confirm with CA)'),
  (gen_random_uuid(), 'compensation.doctorShareOfRetainedPercent', '50', 'compensation',
   'Doctor share (%) of money retained on late patient cancellation'),
  (gen_random_uuid(), 'compensation.doctorShareOnPatientNoShowPercent', '100', 'compensation',
   'Doctor share (%) of his net earning when the patient no-shows'),
  (gen_random_uuid(), 'compensation.negativeBalanceAlertAmount', '2000', 'compensation',
   'Admin alert threshold for deep-negative doctor balances (INR, absolute value)'),
  (gen_random_uuid(), 'referral.actionWindowHours', '72', 'referral',
   'Hours a patient has to act on a pre-consultation referral before auto-refund'),
  (gen_random_uuid(), 'booking.emergencyConfirmMinutes', '10', 'booking',
   'Minutes a doctor has to confirm an emergency booking before alternatives are offered'),
  (gen_random_uuid(), 'tax.platformGstin', '', 'tax',
   'Platform GSTIN shown on invoices'),
  (gen_random_uuid(), 'tax.platformLegalName', '', 'tax',
   'Platform legal entity name shown on invoices'),
  (gen_random_uuid(), 'tax.invoicePrefix', 'VC', 'tax',
   'Invoice number prefix (e.g. VC/2026-27/00001)')
ON CONFLICT (key) DO NOTHING;
