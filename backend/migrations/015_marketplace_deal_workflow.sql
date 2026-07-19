-- 015_marketplace_deal_workflow.sql
-- Marketplace "free classifieds" deal workflow.
-- Payment aggregators in India prohibit live-animal transactions, so the
-- marketplace never processes money: a buyer RESERVES a listing, the parties
-- meet and settle directly (cash / their own UPI), and BOTH sides confirm
-- completion before the animal's ownership record transfers.
-- These columns extend marketplace_orders into that reservation/handshake model.

ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS buyer_confirmed_at TIMESTAMPTZ;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS seller_confirmed_at TIMESTAMPTZ;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMPTZ;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS cancelled_by UUID;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_mp_orders_listing ON marketplace_orders(listing_id);
CREATE INDEX IF NOT EXISTS idx_mp_orders_buyer ON marketplace_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_mp_orders_seller ON marketplace_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_mp_orders_status ON marketplace_orders(status);
