-- Migration: 003_cancellation_wallet_payment.sql
-- Adds cancellation tracking, wallet system, booking-payment link,
-- and payment gateway settings.

-- ── 1. Add cancelled_by and cancelled_at to bookings ─────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'cancelled_by'
  ) THEN
    ALTER TABLE bookings ADD COLUMN cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE bookings ADD COLUMN cancelled_at TIMESTAMP;
  END IF;
END $$;

-- ── 2. Add booking_id to payments ────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'booking_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 3. Create wallets table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance DECIMAL(10,2) DEFAULT 0.00,
  bonus_credits DECIMAL(10,2) DEFAULT 0.00,
  currency VARCHAR(10) DEFAULT 'USD',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 4. Create wallet_transactions table ─────────────────────
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL CHECK (type IN ('credit', 'debit', 'refund', 'bonus', 'withdrawal')),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  reference_id UUID,
  reference_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 5. Auto-update trigger for wallets ──────────────────────
DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 6. Seed cancellation & payment gateway settings ─────────
INSERT INTO system_settings (id, key, value, category, description)
VALUES
  (uuid_generate_v4(), 'payment.gatewayMode', 'demo', 'payment',
   'Payment gateway mode: demo (stub payments), test (sandbox), live (real gateway)'),
  (uuid_generate_v4(), 'payment.gatewayUrl', '', 'payment',
   'Payment gateway API base URL (leave empty for demo/stub mode)'),
  (uuid_generate_v4(), 'payment.gatewayApiKey', '', 'payment',
   'Payment gateway API key (encrypted in production)'),
  (uuid_generate_v4(), 'payment.gatewayProvider', 'stripe', 'payment',
   'Payment gateway provider: stripe, paypal, razorpay'),
  (uuid_generate_v4(), 'cancellation.autoRefundOnDoctorCancel', 'true', 'cancellation',
   'Automatically refund patient when doctor cancels a paid booking'),
  (uuid_generate_v4(), 'cancellation.patientFreeWindowHours', '24', 'cancellation',
   'Hours before appointment when patient can cancel for free (full refund)'),
  (uuid_generate_v4(), 'cancellation.partialRefundPercent', '50', 'cancellation',
   'Refund percentage for patient cancellation within partial window'),
  (uuid_generate_v4(), 'cancellation.partialRefundWindowHours', '2', 'cancellation',
   'Hours before appointment for partial refund (0 = no partial, directly no-refund)'),
  (uuid_generate_v4(), 'cancellation.goodwillBonusPercent', '10', 'cancellation',
   'Bonus wallet credit percentage on top of refund when doctor cancels'),
  (uuid_generate_v4(), 'cancellation.doctorMaxCancellationsPerMonth', '3', 'cancellation',
   'Max doctor cancellations per month before reliability penalty')
ON CONFLICT (key) DO NOTHING;
