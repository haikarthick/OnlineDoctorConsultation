-- Migration 036: grooming provider acceptance gate
--
-- Grooming had no provider accept/reject step at all. An order went
-- payment_pending -> (payment) -> confirmed, and the provider's first possible action was
-- 'provider_assigned'. Nobody at the business ever actively committed to the booking, so a
-- customer could pay in full for a slot the groomer had never agreed to serve. Consultations
-- have had this gate since day one (bookings.status 'pending' -> doctor confirms/declines).
--
-- Owner decision: money is collected FIRST (unchanged funnel), and the order then parks in
-- pending_provider_acceptance. A decline or an expired acceptance window triggers a FULL
-- no-fault refund through the grooming refund engine — the customer is never penalised for a
-- provider's choice.
--
-- These columns are grooming's OWN (module-separation rule): consultations track the same idea
-- on bookings.confirmed_at and must not be reached into from here.

ALTER TABLE grooming_orders ADD COLUMN IF NOT EXISTS acceptance_deadline TIMESTAMP;
ALTER TABLE grooming_orders ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;
ALTER TABLE grooming_orders ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE grooming_orders ADD COLUMN IF NOT EXISTS declined_at TIMESTAMP;
ALTER TABLE grooming_orders ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- Extend the order status CHECK with the two new states. Rebuilt by name rather than
-- ADD-if-missing because the constraint already exists with the old, shorter list.
--
-- Safe against the legacy startup self-heal in utils/database.ts: that block rebuilds only the
-- users.role / user_roles.role / payments / bookings / invoices CHECKs from its own inline
-- copies. It never touches grooming_orders, so this list cannot be silently reverted on boot
-- the way the role CHECK was (see migration 032).
ALTER TABLE grooming_orders DROP CONSTRAINT IF EXISTS grooming_orders_status_check;
ALTER TABLE grooming_orders ADD CONSTRAINT grooming_orders_status_check
  CHECK (status IN ('draft','payment_pending','payment_expired',
                    'pending_provider_acceptance','declined_by_provider',
                    'confirmed','provider_assigned',
                    'checked_in','en_route','intake_done','in_progress','awaiting_approval',
                    'quality_check','ready_for_pickup','returning','completed',
                    'cancelled_by_customer','cancelled_by_provider','no_show','disputed','closed'));

-- The acceptance sweep polls for orders whose window has lapsed; without this it is a
-- sequential scan of every grooming order on every tick.
CREATE INDEX IF NOT EXISTS idx_grooming_orders_acceptance_deadline
  ON grooming_orders (acceptance_deadline)
  WHERE status = 'pending_provider_acceptance';

-- Provider-side SLA counters. A business that routinely declines or lets bookings lapse is a
-- marketplace quality problem, and admin needs it visible rather than inferred from orders.
ALTER TABLE grooming_providers ADD COLUMN IF NOT EXISTS total_accepted INT DEFAULT 0;
ALTER TABLE grooming_providers ADD COLUMN IF NOT EXISTS total_declined INT DEFAULT 0;
ALTER TABLE grooming_providers ADD COLUMN IF NOT EXISTS total_acceptance_timeouts INT DEFAULT 0;

-- Existing paid orders keep their meaning: they were confirmed under the old rules, so they are
-- left in 'confirmed' and are treated as already-accepted. Only NEW payments enter the gate.
UPDATE grooming_orders
   SET accepted_at = COALESCE(accepted_at, updated_at)
 WHERE status NOT IN ('draft','payment_pending','payment_expired','pending_provider_acceptance')
   AND accepted_at IS NULL;
