-- Migration 031: real gateway payments + GST invoices for grooming orders
--
-- Adds gateway checkout tracking to grooming_orders (order/payment ids + which gateway),
-- allows a 'grooming' invoice type on the shared invoices table (separate GRM/FY series), and
-- seeds the grooming invoice prefix + SAC/tax settings. Grooming payments reuse the shared
-- gateway adapters (demo/Razorpay) but stay on the dedicated grooming earnings/settlement ledger.

ALTER TABLE grooming_orders ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR(120);
ALTER TABLE grooming_orders ADD COLUMN IF NOT EXISTS gateway_payment_id VARCHAR(120);
ALTER TABLE grooming_orders ADD COLUMN IF NOT EXISTS gateway VARCHAR(30);
ALTER TABLE grooming_orders ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100);

-- Allow 'grooming' invoice_type (drop the existing check by introspection, re-add expanded).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'invoices'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) ILIKE '%invoice_type%' LOOP
    EXECUTE format('ALTER TABLE invoices DROP CONSTRAINT %I', r.conname);
  END LOOP;
  ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_type_check
    CHECK (invoice_type IN ('consultation', 'commission', 'pharmacy', 'grooming'));
END $$;

INSERT INTO system_settings (key, value, category, description) VALUES
  ('grooming.invoicePrefix', 'GRM', 'grooming', 'Prefix for the grooming GST invoice series (e.g. GRM/2026-27/00001)'),
  ('grooming.sacCode', '999721', 'grooming', 'SAC code for grooming/spa services (CA to confirm)')
ON CONFLICT (key) DO NOTHING;
