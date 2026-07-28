-- Migration 035: collect what grooming actually bills, and credit-note what it returns
--
-- Three gaps this closes:
--  1. Mid-service extras (variable items) were approved, added to grand_total, credited to the
--     provider and marked "paid" — while collecting nothing. There was no balance leg at all.
--  2. Deposit-rule services could not be part-paid safely for the same reason.
--  3. A refunded grooming order kept its full-value GRM invoice; GST needs a credit note.
--
-- balance_due is the amount still owed on an order. It is set when a deposit is taken and grows
-- when the customer approves extra work; a balance checkout collects it and books the incremental
-- earning plus a supplementary invoice.

ALTER TABLE grooming_orders ADD COLUMN IF NOT EXISTS balance_due DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- Which invoice already covered a line item, so a supplementary invoice bills only the new work.
ALTER TABLE grooming_order_items ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100);

-- A grooming order can now have several payments (initial/deposit + one per balance collection).
-- payments already carries module-specific links this way (booking_id, consultation_id,
-- dispensing_id); grooming_order_id follows that existing pattern rather than inventing a new one.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS grooming_order_id UUID REFERENCES grooming_orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payments_grooming_order ON payments(grooming_order_id);

-- Backfill the link for payments that predate the column.
UPDATE payments p SET grooming_order_id = o.id
  FROM grooming_orders o
 WHERE o.payment_id = p.id AND p.grooming_order_id IS NULL;

-- Credit notes live on the shared invoices table with their own type + series.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'invoices'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) ILIKE '%invoice_type%' LOOP
    EXECUTE format('ALTER TABLE invoices DROP CONSTRAINT %I', r.conname);
  END LOOP;
  ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_type_check
    CHECK (invoice_type IN ('consultation', 'commission', 'pharmacy', 'grooming', 'grooming_credit_note'));
END $$;

INSERT INTO system_settings (key, value, category, description) VALUES
  ('grooming.creditNotePrefix', 'GRMCN', 'grooming',
   'Prefix for the grooming GST credit-note series issued on refunds (e.g. GRMCN/2026-27/00001)'),
  ('grooming.settlement.tdsRatePercent', '0', 'grooming',
   'TDS percentage withheld on grooming provider payouts (confirm the rate with your CA)')
ON CONFLICT (key) DO NOTHING;
