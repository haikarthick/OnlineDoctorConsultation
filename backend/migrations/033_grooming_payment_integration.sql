-- Migration 033: put grooming payments on the shared payment rails properly
--
-- Grooming wrote its payments row with payment_source left at the 'consultation' default and
-- gateway_order_id never set. Three things followed from that:
--   1. the Razorpay webhook (WHERE gateway_order_id = ...) could never find a grooming payment,
--      so a checkout whose browser callback was lost stayed unpaid forever with the money taken;
--   2. reconcilePendingPayments (WHERE gateway_order_id IS NOT NULL) skipped them for the same
--      reason, so nothing ever repaired it;
--   3. the finance overview counts GMV WHERE payment_source = 'consultation', so grooming
--      revenue was silently reported as consultation revenue.
--
-- Allowing 'grooming' as a payment_source is what lets the service label those rows correctly.
-- The CHECK is dropped by introspection and re-added expanded, the same way 031 handled
-- invoices.invoice_type.

-- payment_source historically existed only because the startup self-heal added it, and that runs
-- AFTER migrations — so on a fresh install this migration would otherwise reference a column that
-- does not exist yet. init.sql now declares it; this keeps the upgrade path self-sufficient.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_source VARCHAR(30) DEFAULT 'consultation';

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'payments'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) ILIKE '%payment_source%' LOOP
    EXECUTE format('ALTER TABLE payments DROP CONSTRAINT %I', r.conname);
  END LOOP;
  ALTER TABLE payments ADD CONSTRAINT payments_payment_source_check
    CHECK (payment_source IN ('consultation', 'pharmacy', 'subscription', 'other', 'grooming'));
END $$;

-- Backfill: any payment already linked from a grooming order is grooming revenue, not
-- consultation revenue. Without this the finance overview keeps double-counting historic rows.
UPDATE payments p
   SET payment_source = 'grooming'
  FROM grooming_orders o
 WHERE o.payment_id = p.id
   AND p.payment_source IS DISTINCT FROM 'grooming';
