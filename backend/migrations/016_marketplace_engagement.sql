-- 016_marketplace_engagement.sql
-- Phase 3 marketplace engagement: buyer<->seller messaging threads,
-- favorites/watchlist, and saved searches with alerts.

-- One conversation per (listing, buyer). Seller is denormalized for cheap listing.
CREATE TABLE IF NOT EXISTS marketplace_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  buyer_unread INT DEFAULT 0,
  seller_unread INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (listing_id, buyer_id)
);
CREATE INDEX IF NOT EXISTS idx_mp_threads_buyer ON marketplace_threads(buyer_id);
CREATE INDEX IF NOT EXISTS idx_mp_threads_seller ON marketplace_threads(seller_id);
CREATE INDEX IF NOT EXISTS idx_mp_threads_listing ON marketplace_threads(listing_id);

CREATE TABLE IF NOT EXISTS marketplace_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES marketplace_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mp_messages_thread ON marketplace_messages(thread_id, created_at);

-- Favorites / watchlist
CREATE TABLE IF NOT EXISTS marketplace_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, listing_id)
);
CREATE INDEX IF NOT EXISTS idx_mp_favorites_user ON marketplace_favorites(user_id);

-- Saved searches with optional new-listing alerts
CREATE TABLE IF NOT EXISTS marketplace_saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  alerts_enabled BOOLEAN DEFAULT true,
  last_alerted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mp_saved_searches_user ON marketplace_saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_saved_searches_alerts ON marketplace_saved_searches(alerts_enabled) WHERE alerts_enabled = true;
