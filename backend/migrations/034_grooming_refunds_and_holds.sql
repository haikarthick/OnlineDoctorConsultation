-- Migration 034: grooming cancellation refunds + slot-hold expiry
--
-- Grooming had no customer refund path at all: cancelling a paid order left the payment
-- 'completed' with refund_amount 0 and never returned money, and a dispute "refund" only booked a
-- negative provider-ledger entry. It also had no hold expiry — grooming.holdMinutes was read by
-- nothing, so unpaid orders held their slot forever.
--
-- These columns are grooming's OWN. The consultation module keeps its refund/hold state on
-- payments/bookings; deliberately not shared, so either module's policy can change without
-- touching the other.

ALTER TABLE grooming_orders ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
ALTER TABLE grooming_orders ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE grooming_orders ADD COLUMN IF NOT EXISTS refund_status VARCHAR(20) NOT NULL DEFAULT 'none';
ALTER TABLE grooming_orders ADD COLUMN IF NOT EXISTS refund_destination VARCHAR(20);
ALTER TABLE grooming_orders ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE grooming_orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grooming_orders_refund_status_check') THEN
    ALTER TABLE grooming_orders ADD CONSTRAINT grooming_orders_refund_status_check
      CHECK (refund_status IN ('none', 'partial', 'full', 'failed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grooming_orders_refund_destination_check') THEN
    ALTER TABLE grooming_orders ADD CONSTRAINT grooming_orders_refund_destination_check
      CHECK (refund_destination IN ('wallet', 'gateway'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_grooming_orders_expires ON grooming_orders(status, expires_at);

-- Grooming cancellation / compensation policy. Own 'grooming.*' namespace on purpose: changing a
-- consultation cancellation window must never move a grooming one.
INSERT INTO system_settings (key, value, category, description) VALUES
  ('grooming.cancellation.freeWindowHours', '24', 'grooming',
   'Hours before the appointment a customer may cancel and get the full amount back, less the processing charge'),
  ('grooming.cancellation.partialRefundWindowHours', '4', 'grooming',
   'Inside the free window but at least this many hours out, the customer gets the partial refund percentage'),
  ('grooming.cancellation.partialRefundPercent', '50', 'grooming',
   'Percentage of the paid amount refunded when a customer cancels inside the free window'),
  ('grooming.cancellation.processingFlatFee', '25', 'grooming',
   'Flat processing charge (INR) deducted from customer-cancelled grooming refunds'),
  ('grooming.cancellation.goodwillBonusPercent', '10', 'grooming',
   'Wallet bonus (% of amount paid) credited to the customer when the PROVIDER cancels'),
  ('grooming.compensation.providerShareOfRetainedPercent', '50', 'grooming',
   'Provider share (%) of money retained when a customer cancels late'),
  ('grooming.compensation.providerShareOnNoShowPercent', '100', 'grooming',
   'Provider share (%) of their net earning when the customer no-shows'),
  ('grooming.refund.defaultDestination', 'wallet', 'grooming',
   'Where grooming refunds go by default: wallet (instant) or gateway (back to source)')
ON CONFLICT (key) DO NOTHING;
