-- 018_marketplace_trust_discovery.sql
-- Phase 5: report/dispute workflow, full-text search index, and interlink config.

-- ── Listing reports (trust & safety) ──
CREATE TABLE IF NOT EXISTS marketplace_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(40) NOT NULL
    CHECK (reason IN ('scam', 'welfare_concern', 'prohibited', 'miscategorized', 'offensive', 'wrong_info', 'other')),
  details TEXT,
  status VARCHAR(20) DEFAULT 'open'
    CHECK (status IN ('open', 'reviewing', 'actioned', 'dismissed')),
  resolution TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mp_reports_listing ON marketplace_reports(listing_id);
CREATE INDEX IF NOT EXISTS idx_mp_reports_status ON marketplace_reports(status);
-- One open report per user per listing (re-reporting after resolution is allowed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_reports_unique_open
  ON marketplace_reports(listing_id, reporter_id) WHERE status IN ('open', 'reviewing');

-- ── Full-text search index (immutable expression → GIN) ──
CREATE INDEX IF NOT EXISTS idx_mp_listings_fts ON marketplace_listings
  USING GIN (to_tsvector('english',
    coalesce(title,'') || ' ' || coalesce(description,'') || ' ' ||
    coalesce(breed,'') || ' ' || coalesce(species,'')));

-- ── Interlink / referral config (marketplace stays free; these are just links) ──
INSERT INTO marketplace_monetization_settings (setting_key, setting_value, is_enabled, description, category)
VALUES
  ('treasure_mount', '{"url": "https://treasuremount.com"}', true,
   'Cross-link non-animal product listings to Treasure Mount e-commerce', 'interlink'),
  ('transport_referral', '{"url": ""}', false,
   'Show a transport-partner referral link on animal deals', 'referral')
ON CONFLICT (setting_key) DO NOTHING;
