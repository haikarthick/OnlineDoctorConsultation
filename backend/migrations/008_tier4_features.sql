-- Migration: 008_tier4_features.sql
-- Description: Next-generation innovative features: ai_chat_sessions, ai_chat_messages,
--              digital_twins, simulation_runs, marketplace_listings, marketplace_bids,
--              marketplace_orders, sustainability_metrics, sustainability_goals,
--              wellness_scorecards, wellness_reminders, geofence_zones, geospatial_events,
--              marketplace_monetization_settings, marketplace_plans, marketplace_subscriptions,
--              listing_boosts, marketplace_inquiries, marketplace_transactions.
--              Also extends marketplace_listings with livestock + compliance columns.
-- Depends on: 005_farm_enterprise_tables.sql, 007_tier3_features.sql (iot_sensors)

-- ============================================================
-- 1. AI VETERINARY COPILOT
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID REFERENCES enterprises(id),
  user_id UUID NOT NULL REFERENCES users(id),
  animal_id UUID REFERENCES animals(id),
  title VARCHAR(300) DEFAULT 'New Chat',
  context_type VARCHAR(50) DEFAULT 'general',
  status VARCHAR(30) DEFAULT 'active',
  message_count INT DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  content TEXT NOT NULL,
  content_type VARCHAR(30) DEFAULT 'text',
  tokens_used INT DEFAULT 0,
  confidence NUMERIC(5,2),
  sources JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. DIGITAL TWIN & SCENARIO SIMULATOR
-- ============================================================
CREATE TABLE IF NOT EXISTS digital_twins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  name VARCHAR(200) NOT NULL,
  twin_type VARCHAR(50) NOT NULL DEFAULT 'farm',
  description TEXT,
  model_data JSONB DEFAULT '{}',
  current_state JSONB DEFAULT '{}',
  sync_status VARCHAR(30) DEFAULT 'synced',
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS simulation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id UUID NOT NULL REFERENCES digital_twins(id) ON DELETE CASCADE,
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  name VARCHAR(200) NOT NULL,
  scenario_type VARCHAR(50) NOT NULL DEFAULT 'disease_spread',
  parameters JSONB DEFAULT '{}',
  input_state JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  outcome_summary TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. MARKETPLACE & AUCTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID REFERENCES enterprises(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(300) NOT NULL,
  description TEXT,
  category VARCHAR(60) NOT NULL DEFAULT 'animal',
  listing_type VARCHAR(30) DEFAULT 'fixed_price',
  price NUMERIC(12,2),
  currency VARCHAR(10) DEFAULT 'USD',
  quantity INT DEFAULT 1,
  unit VARCHAR(30),
  condition VARCHAR(30) DEFAULT 'new',
  images JSONB DEFAULT '[]',
  location VARCHAR(200),
  shipping_options JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  status VARCHAR(30) DEFAULT 'active',
  featured BOOLEAN DEFAULT false,
  views_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(12,2) NOT NULL,
  message TEXT,
  status VARCHAR(30) DEFAULT 'active',
  is_winning BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  quantity INT DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(12,2) NOT NULL,
  status VARCHAR(30) DEFAULT 'pending',
  payment_status VARCHAR(30) DEFAULT 'unpaid',
  shipping_address JSONB DEFAULT '{}',
  tracking_number VARCHAR(100),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. SUSTAINABILITY & CARBON TRACKER
-- ============================================================
CREATE TABLE IF NOT EXISTS sustainability_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  metric_type VARCHAR(60) NOT NULL,
  metric_name VARCHAR(200) NOT NULL,
  value NUMERIC(14,4) NOT NULL DEFAULT 0,
  unit VARCHAR(30),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  category VARCHAR(60) DEFAULT 'general',
  scope VARCHAR(30) DEFAULT 'scope_1',
  data_source VARCHAR(100),
  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sustainability_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  goal_name VARCHAR(200) NOT NULL,
  description TEXT,
  metric_type VARCHAR(60) NOT NULL,
  target_value NUMERIC(14,4) NOT NULL,
  current_value NUMERIC(14,4) DEFAULT 0,
  unit VARCHAR(30),
  baseline_value NUMERIC(14,4),
  baseline_date DATE,
  target_date DATE NOT NULL,
  status VARCHAR(30) DEFAULT 'active',
  progress_pct NUMERIC(5,2) DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. CLIENT PORTAL & WELLNESS SCORECARDS
-- ============================================================
CREATE TABLE IF NOT EXISTS wellness_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES animals(id),
  enterprise_id UUID REFERENCES enterprises(id),
  owner_id UUID NOT NULL REFERENCES users(id),
  overall_score NUMERIC(5,2) DEFAULT 0,
  nutrition_score NUMERIC(5,2) DEFAULT 0,
  activity_score NUMERIC(5,2) DEFAULT 0,
  vaccination_score NUMERIC(5,2) DEFAULT 0,
  dental_score NUMERIC(5,2) DEFAULT 0,
  weight_status VARCHAR(30) DEFAULT 'normal',
  next_checkup DATE,
  recommendations JSONB DEFAULT '[]',
  risk_flags JSONB DEFAULT '[]',
  assessed_by UUID REFERENCES users(id),
  assessed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wellness_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES animals(id),
  owner_id UUID NOT NULL REFERENCES users(id),
  reminder_type VARCHAR(60) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  status VARCHAR(30) DEFAULT 'pending',
  priority VARCHAR(20) DEFAULT 'medium',
  recurrence VARCHAR(30),
  recurrence_interval INT,
  snoozed_until DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. GEOSPATIAL ANALYTICS & GEOFENCING
-- ============================================================
CREATE TABLE IF NOT EXISTS geofence_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  name VARCHAR(200) NOT NULL,
  zone_type VARCHAR(50) DEFAULT 'boundary',
  center_lat NUMERIC(10,6),
  center_lng NUMERIC(10,6),
  radius_meters NUMERIC(12,2),
  polygon_coords JSONB DEFAULT '[]',
  color VARCHAR(20) DEFAULT '#3b82f6',
  alert_on_entry BOOLEAN DEFAULT false,
  alert_on_exit BOOLEAN DEFAULT true,
  is_restricted BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'active',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS geospatial_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  zone_id UUID REFERENCES geofence_zones(id),
  animal_id UUID REFERENCES animals(id),
  sensor_id UUID REFERENCES iot_sensors(id),
  event_type VARCHAR(50) NOT NULL,
  latitude NUMERIC(10,6) NOT NULL,
  longitude NUMERIC(10,6) NOT NULL,
  altitude NUMERIC(8,2),
  accuracy_meters NUMERIC(8,2),
  speed_kmh NUMERIC(8,2),
  heading NUMERIC(5,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EXTEND MARKETPLACE_LISTINGS: livestock + compliance columns
-- ============================================================
DO $$ BEGIN
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS species VARCHAR(60);
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS breed VARCHAR(100);
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS animal_age_months INT;
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS animal_weight_kg NUMERIC(8,2);
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS lactation_number INT;
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS daily_milk_yield NUMERIC(6,2);
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS pregnancy_status VARCHAR(30);
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS pregnancy_month INT;
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS vaccination_status VARCHAR(30) DEFAULT 'unknown';
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS health_certificate BOOLEAN DEFAULT false;
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS listing_tier VARCHAR(20) DEFAULT 'standard';
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS is_hot_deal BOOLEAN DEFAULT false;
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS linked_animal_id UUID;
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS auction_end_time TIMESTAMPTZ;
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS reserve_price NUMERIC(12,2);
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7);
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7);
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN DEFAULT true;
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS admin_notes TEXT;
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS seller_type VARCHAR(30) DEFAULT 'individual';
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100);
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS breeder_verified BOOLEAN DEFAULT false;
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS welfare_attestation BOOLEAN DEFAULT false;
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false;
  ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Some marketplace_listings columns may already exist: %', SQLERRM;
END $$;

-- ============================================================
-- 7. MARKETPLACE MONETIZATION
-- ============================================================
CREATE TABLE IF NOT EXISTS marketplace_monetization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT false,
  description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'INR',
  duration_days INTEGER NOT NULL DEFAULT 30,
  features JSONB NOT NULL DEFAULT '{}',
  max_listings INTEGER,
  max_boosts_per_month INTEGER DEFAULT 0,
  priority_support BOOLEAN DEFAULT false,
  analytics_access BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  plan_id UUID NOT NULL REFERENCES marketplace_plans(id),
  status VARCHAR(20) DEFAULT 'active',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listing_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  boost_type VARCHAR(30) DEFAULT 'standard',
  price_paid NUMERIC(10,2) DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  message TEXT,
  contact_revealed BOOLEAN DEFAULT false,
  fee_charged NUMERIC(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  transaction_type VARCHAR(30) NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'INR',
  status VARCHAR(20) DEFAULT 'completed',
  reference_id UUID,
  reference_type VARCHAR(30),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED DEFAULT MONETIZATION SETTINGS (all disabled)
-- ============================================================
INSERT INTO marketplace_monetization_settings (id, setting_key, setting_value, is_enabled, description, category)
VALUES
  (gen_random_uuid(), 'listing_fee',         '{"price": 0, "free_limit": 10}'::jsonb,                          false, 'Charge per listing after free limit',                     'fees'),
  (gen_random_uuid(), 'listing_boost',       '{"standard": 99, "premium": 199, "spotlight": 499, "duration_days": 7}'::jsonb, false, 'Boost listing visibility with paid promotion', 'boost'),
  (gen_random_uuid(), 'subscription_plans',  '{"enabled_plan_ids": []}'::jsonb,                                false, 'Premium subscription plans for sellers',                   'subscription'),
  (gen_random_uuid(), 'inquiry_fee',         '{"per_inquiry": 0, "free_daily_limit": 50}'::jsonb,              false, 'Charge per inquiry/contact reveal',                        'fees'),
  (gen_random_uuid(), 'featured_seller',     '{"monthly_price": 0}'::jsonb,                                   false, 'Featured/verified seller badge',                           'premium'),
  (gen_random_uuid(), 'transaction_fee',     '{"percentage": 0, "flat_fee": 0}'::jsonb,                        false, 'Commission on successful transactions',                    'fees'),
  (gen_random_uuid(), 'premium_analytics',   '{"price": 0}'::jsonb,                                           false, 'Advanced marketplace analytics for sellers',               'premium'),
  (gen_random_uuid(), 'priority_placement',  '{"price": 0, "duration_days": 30}'::jsonb,                      false, 'Priority placement in search results',                     'boost')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- SEED DEFAULT MARKETPLACE PLANS (inactive by default)
-- ============================================================
INSERT INTO marketplace_plans (id, name, description, price, duration_days, features, max_listings, max_boosts_per_month, is_active, sort_order)
VALUES
  (gen_random_uuid(), 'Free',         'Basic free plan for all users',          0,    0,  '{"listings": 10,  "boosts": 0,  "analytics": false, "support": "community"}'::jsonb, 10,   0,  false, 0),
  (gen_random_uuid(), 'Starter',      'For small sellers getting started',       299,  30, '{"listings": 25,  "boosts": 2,  "analytics": false, "support": "email"}'::jsonb,     25,   2,  false, 1),
  (gen_random_uuid(), 'Professional', 'For active sellers and breeders',         799,  30, '{"listings": 100, "boosts": 5,  "analytics": true,  "support": "priority"}'::jsonb,  100,  5,  false, 2),
  (gen_random_uuid(), 'Enterprise',   'Unlimited access for large farms',        1999, 30, '{"listings": -1,  "boosts": 20, "analytics": true,  "support": "dedicated"}'::jsonb, -1,   20, false, 3)
ON CONFLICT DO NOTHING;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_enterprise ON ai_chat_sessions(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session ON ai_chat_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_digital_twins_enterprise ON digital_twins(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_twin ON simulation_runs(twin_id);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_enterprise ON simulation_runs(enterprise_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller ON marketplace_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_category ON marketplace_listings(category, status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_species ON marketplace_listings(species);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_breed ON marketplace_listings(breed);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_tier ON marketplace_listings(listing_tier);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_admin ON marketplace_listings(admin_approved);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller_type ON marketplace_listings(seller_type);

CREATE INDEX IF NOT EXISTS idx_marketplace_bids_listing ON marketplace_bids(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer ON marketplace_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller ON marketplace_orders(seller_id);

CREATE INDEX IF NOT EXISTS idx_sustainability_metrics_ent ON sustainability_metrics(enterprise_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_sustainability_goals_ent ON sustainability_goals(enterprise_id);

CREATE INDEX IF NOT EXISTS idx_wellness_scorecards_animal ON wellness_scorecards(animal_id);
CREATE INDEX IF NOT EXISTS idx_wellness_scorecards_owner ON wellness_scorecards(owner_id);
CREATE INDEX IF NOT EXISTS idx_wellness_reminders_owner ON wellness_reminders(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_wellness_reminders_due ON wellness_reminders(due_date, status);

CREATE INDEX IF NOT EXISTS idx_geofence_zones_enterprise ON geofence_zones(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_geospatial_events_ent ON geospatial_events(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_geospatial_events_zone ON geospatial_events(zone_id);
CREATE INDEX IF NOT EXISTS idx_geospatial_events_animal ON geospatial_events(animal_id);
CREATE INDEX IF NOT EXISTS idx_geospatial_events_time ON geospatial_events(created_at);

CREATE INDEX IF NOT EXISTS idx_mp_subscriptions_user ON marketplace_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_subscriptions_status ON marketplace_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_listing_boosts_listing ON listing_boosts(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_boosts_active ON listing_boosts(is_active);
CREATE INDEX IF NOT EXISTS idx_mp_inquiries_listing ON marketplace_inquiries(listing_id);
CREATE INDEX IF NOT EXISTS idx_mp_inquiries_buyer ON marketplace_inquiries(buyer_id);
CREATE INDEX IF NOT EXISTS idx_mp_transactions_user ON marketplace_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_transactions_type ON marketplace_transactions(transaction_type);
