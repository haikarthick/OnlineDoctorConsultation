-- Every time a buyer taps Call / WhatsApp on a listing, the seller's phone number is shown to them and
-- the tap is logged here: it caps how many numbers one account can collect in a day, and lets the
-- seller see who looked at their number.
CREATE TABLE IF NOT EXISTS marketplace_contact_reveals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  channel VARCHAR(10) NOT NULL DEFAULT 'call',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mp_contact_reveals_listing ON marketplace_contact_reveals (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_contact_reveals_viewer ON marketplace_contact_reveals (viewer_id, created_at DESC);
