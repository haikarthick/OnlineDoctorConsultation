-- Marketplace listings: structured place (state / district / pincode) so buyers can find
-- "listings in my district" without GPS. Free-text `location` stays as the village/area line.
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS state VARCHAR(80);
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS district VARCHAR(80);
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);
CREATE INDEX IF NOT EXISTS idx_mp_listings_state_district ON marketplace_listings (state, district);
CREATE INDEX IF NOT EXISTS idx_mp_listings_pincode ON marketplace_listings (pincode);
