-- Migration 029: Pet Wellness / Grooming & Spa module — schema foundation (P0)
--
-- Platform-level grooming/spa marketplace. Strictly SEPARATE from network hospitals
-- (a network branch can never be a grooming provider) and from the consultation
-- `bookings` table (grooming uses its own `grooming_orders` lifecycle). Ships dark
-- behind the system setting `grooming.enabled` (default false).
--
-- Full design: docs/PET_WELLNESS_GROOMING_SPA_PLAN.md
-- Mirrors this block in docker/init.sql §48 (kept identical; schema-check compares them).
-- Tables are ordered so every REFERENCES points at an already-defined table (no forward FKs).

-- ── 48.1 Master data (admin-managed, per-locale labels; mirrors master_marketplace_categories) ──
CREATE TABLE IF NOT EXISTS master_grooming_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  label_key VARCHAR(150),
  label VARCHAR(100),
  icon VARCHAR(10),
  description TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_protected BOOLEAN DEFAULT false,
  label_hi VARCHAR(150),
  label_kn VARCHAR(150),
  label_ml VARCHAR(150),
  label_ta VARCHAR(150),
  label_te VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_grooming_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  label_key VARCHAR(150),
  label VARCHAR(100),
  icon VARCHAR(10),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_protected BOOLEAN DEFAULT false,
  label_hi VARCHAR(150),
  label_kn VARCHAR(150),
  label_ml VARCHAR(150),
  label_ta VARCHAR(150),
  label_te VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 48.2 Provider (the grooming business; owner is a users row; never a network branch) ──
CREATE TABLE IF NOT EXISTS grooming_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_type VARCHAR(20) NOT NULL DEFAULT 'groomer'
    CHECK (provider_type IN ('veterinarian','groomer','business','clinic')),
  business_name VARCHAR(200) NOT NULL,
  slug VARCHAR(220) UNIQUE,
  description TEXT,
  logo_url VARCHAR(500),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),
  offers_at_premises BOOLEAN DEFAULT true,
  offers_mobile BOOLEAN DEFAULT false,
  operating_hours JSONB DEFAULT '{}',
  supported_species TEXT[] DEFAULT '{}',
  size_limits JSONB DEFAULT '{}',
  legal_name VARCHAR(255),
  pan VARCHAR(20),
  gstin VARCHAR(20),
  business_address TEXT,
  payout_account_name VARCHAR(255),
  payout_account_number VARCHAR(50),
  payout_ifsc VARCHAR(20),
  payout_upi VARCHAR(100),
  verification_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending','verified','rejected','suspended')),
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMP,
  rejection_reason TEXT,
  is_paused BOOLEAN DEFAULT false,
  rating DECIMAL(3,2) DEFAULT 0.00,
  total_reviews INT DEFAULT 0,
  total_orders INT DEFAULT 0,
  reliability_score DECIMAL(5,2) DEFAULT 100.00,
  commission_override_percent DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grooming_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES grooming_providers(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  location_type VARCHAR(20) NOT NULL DEFAULT 'premises'
    CHECK (location_type IN ('premises','mobile_zone')),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  gps_latitude DECIMAL(9,6),
  gps_longitude DECIMAL(9,6),
  service_radius_km DECIMAL(6,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grooming_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES grooming_providers(id) ON DELETE CASCADE,
  location_id UUID REFERENCES grooming_locations(id) ON DELETE SET NULL,
  name VARCHAR(150) NOT NULL,
  resource_type VARCHAR(30) NOT NULL DEFAULT 'grooming_table'
    CHECK (resource_type IN ('grooming_table','bath_station','drying_cage','spa_room','other')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grooming_provider_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES grooming_providers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_role VARCHAR(20) NOT NULL DEFAULT 'staff'
    CHECK (provider_role IN ('owner','manager','staff')),
  capabilities TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider_id, user_id)
);

-- ── 48.3 Catalog ──
CREATE TABLE IF NOT EXISTS grooming_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES grooming_providers(id) ON DELETE CASCADE,
  category_id UUID REFERENCES master_grooming_categories(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  service_kind VARCHAR(20) NOT NULL DEFAULT 'service'
    CHECK (service_kind IN ('service','package','membership')),
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) DEFAULT 'INR',
  duration_minutes INT DEFAULT 60,
  tax_percent DECIMAL(5,2) DEFAULT 0.00,
  payment_rule VARCHAR(20) NOT NULL DEFAULT 'full'
    CHECK (payment_rule IN ('full','deposit')),
  deposit_amount DECIMAL(10,2) DEFAULT 0.00,
  is_variable_price BOOLEAN DEFAULT false,
  cancellation_policy JSONB DEFAULT '{}',
  supported_species TEXT[] DEFAULT '{}',
  available_at_premises BOOLEAN DEFAULT true,
  available_mobile BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_paused BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grooming_service_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES grooming_services(id) ON DELETE CASCADE,
  addon_id UUID REFERENCES master_grooming_addons(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  duration_minutes INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 48.4 Grooming-specific pet attributes (extends animals without touching medical tables) ──
CREATE TABLE IF NOT EXISTS grooming_pet_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL UNIQUE REFERENCES animals(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  coat_type VARCHAR(50),
  coat_length VARCHAR(30),
  grooming_preference TEXT,
  allergies TEXT,
  temperament VARCHAR(50),
  handling_notes TEXT,
  medical_restrictions TEXT,
  photo_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 48.5 Orders (separate lifecycle from consultation bookings) ──
CREATE TABLE IF NOT EXISTS grooming_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(30) UNIQUE,
  pet_owner_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  provider_id UUID NOT NULL REFERENCES grooming_providers(id) ON DELETE RESTRICT,
  location_id UUID REFERENCES grooming_locations(id) ON DELETE SET NULL,
  primary_service_id UUID REFERENCES grooming_services(id) ON DELETE SET NULL,
  service_mode VARCHAR(20) NOT NULL DEFAULT 'premises'
    CHECK (service_mode IN ('premises','mobile')),
  scheduled_date DATE NOT NULL,
  time_slot_start VARCHAR(10) NOT NULL,
  time_slot_end VARCHAR(10),
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','payment_pending','payment_expired','confirmed','provider_assigned',
                      'checked_in','en_route','intake_done','in_progress','awaiting_approval',
                      'quality_check','ready_for_pickup','returning','completed',
                      'cancelled_by_customer','cancelled_by_provider','no_show','disputed','closed')),
  assigned_staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_resource_id UUID REFERENCES grooming_resources(id) ON DELETE SET NULL,
  subtotal DECIMAL(10,2) DEFAULT 0.00,
  addons_total DECIMAL(10,2) DEFAULT 0.00,
  variable_total DECIMAL(10,2) DEFAULT 0.00,
  discount_total DECIMAL(10,2) DEFAULT 0.00,
  tax_total DECIMAL(10,2) DEFAULT 0.00,
  grand_total DECIMAL(10,2) DEFAULT 0.00,
  deposit_due DECIMAL(10,2) DEFAULT 0.00,
  amount_paid DECIMAL(10,2) DEFAULT 0.00,
  currency VARCHAR(10) DEFAULT 'INR',
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  commission_percent DECIMAL(5,2),
  commission_amount DECIMAL(10,2) DEFAULT 0.00,
  handling_notes TEXT,
  owner_notes TEXT,
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMP,
  eta_minutes INT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grooming_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES grooming_orders(id) ON DELETE CASCADE,
  service_id UUID REFERENCES grooming_services(id) ON DELETE SET NULL,
  addon_id UUID REFERENCES master_grooming_addons(id) ON DELETE SET NULL,
  item_type VARCHAR(20) NOT NULL DEFAULT 'service'
    CHECK (item_type IN ('service','addon','variable')),
  name VARCHAR(200) NOT NULL,
  quantity INT DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  tax_percent DECIMAL(5,2) DEFAULT 0.00,
  line_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','started','completed','skipped','awaiting_approval','paused')),
  approval_status VARCHAR(20) DEFAULT 'not_required'
    CHECK (approval_status IN ('not_required','requested','approved','declined')),
  reason TEXT,
  photo_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grooming_order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES grooming_orders(id) ON DELETE CASCADE,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 48.6 Intake / S.C.E.N.T. wellness / report card / safety ──
CREATE TABLE IF NOT EXISTS grooming_intake (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES grooming_orders(id) ON DELETE CASCADE,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  arrival_condition TEXT,
  temperament VARCHAR(50),
  owner_instructions TEXT,
  allergies TEXT,
  handling_restrictions TEXT,
  scent_skin VARCHAR(20) CHECK (scent_skin IN ('good','watch','vet_advised')),
  scent_coat VARCHAR(20) CHECK (scent_coat IN ('good','watch','vet_advised')),
  scent_ears VARCHAR(20) CHECK (scent_ears IN ('good','watch','vet_advised')),
  scent_nails VARCHAR(20) CHECK (scent_nails IN ('good','watch','vet_advised')),
  scent_teeth VARCHAR(20) CHECK (scent_teeth IN ('good','watch','vet_advised')),
  scent_notes TEXT,
  before_photos TEXT[] DEFAULT '{}',
  consent_handling BOOLEAN DEFAULT false,
  consent_products BOOLEAN DEFAULT false,
  consent_photography BOOLEAN DEFAULT false,
  consent_emergency_contact BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grooming_report_card (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES grooming_orders(id) ON DELETE CASCADE,
  after_photos TEXT[] DEFAULT '{}',
  products_used TEXT,
  aftercare_notes TEXT,
  summary TEXT,
  next_recommended_date DATE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grooming_safety_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES grooming_orders(id) ON DELETE CASCADE,
  raised_by UUID REFERENCES users(id) ON DELETE SET NULL,
  issue_type VARCHAR(40) NOT NULL,
  description TEXT,
  photos TEXT[] DEFAULT '{}',
  consultation_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','owner_notified','consult_booked','resolved','dismissed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 48.7 Disputes ──
CREATE TABLE IF NOT EXISTS grooming_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES grooming_orders(id) ON DELETE CASCADE,
  raised_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reason VARCHAR(100) NOT NULL,
  comments TEXT,
  images TEXT[] DEFAULT '{}',
  requested_resolution VARCHAR(30),
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','under_review','resolved','partially_refunded','rejected')),
  resolution_note TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 48.8 Earnings & MANUAL settlement (dedicated — NOT doctor_earnings; no escrow) ──
CREATE TABLE IF NOT EXISTS grooming_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES grooming_providers(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  tds_amount DECIMAL(10,2) DEFAULT 0.00,
  net_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  method VARCHAR(20) DEFAULT 'bank_transfer'
    CHECK (method IN ('bank_transfer','upi','other')),
  reference VARCHAR(120),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed')),
  period_from DATE,
  period_to DATE,
  notes TEXT,
  settled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  settled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grooming_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES grooming_providers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES grooming_orders(id) ON DELETE SET NULL,
  gross_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(10,2) DEFAULT 0.00,
  gateway_fee DECIMAL(10,2) DEFAULT 0.00,
  net_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  entry_type VARCHAR(20) NOT NULL DEFAULT 'earning'
    CHECK (entry_type IN ('earning','penalty','compensation','refund_adjustment')),
  status VARCHAR(20) NOT NULL DEFAULT 'clearing'
    CHECK (status IN ('clearing','available','paid','reversed')),
  available_at TIMESTAMP,
  settlement_id UUID REFERENCES grooming_settlements(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 48.9 Indexes ──
CREATE INDEX IF NOT EXISTS idx_grooming_providers_owner ON grooming_providers(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_grooming_providers_status ON grooming_providers(verification_status);
CREATE INDEX IF NOT EXISTS idx_grooming_locations_provider ON grooming_locations(provider_id);
CREATE INDEX IF NOT EXISTS idx_grooming_resources_provider ON grooming_resources(provider_id);
CREATE INDEX IF NOT EXISTS idx_grooming_staff_provider ON grooming_provider_staff(provider_id);
CREATE INDEX IF NOT EXISTS idx_grooming_staff_user ON grooming_provider_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_grooming_services_provider ON grooming_services(provider_id);
CREATE INDEX IF NOT EXISTS idx_grooming_services_active ON grooming_services(is_active);
CREATE INDEX IF NOT EXISTS idx_grooming_service_addons_service ON grooming_service_addons(service_id);
CREATE INDEX IF NOT EXISTS idx_grooming_pet_profile_animal ON grooming_pet_profile(animal_id);
CREATE INDEX IF NOT EXISTS idx_grooming_orders_owner ON grooming_orders(pet_owner_id);
CREATE INDEX IF NOT EXISTS idx_grooming_orders_provider ON grooming_orders(provider_id);
CREATE INDEX IF NOT EXISTS idx_grooming_orders_status ON grooming_orders(status);
CREATE INDEX IF NOT EXISTS idx_grooming_orders_date ON grooming_orders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_grooming_order_items_order ON grooming_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_grooming_order_status_history_order ON grooming_order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_grooming_intake_order ON grooming_intake(order_id);
CREATE INDEX IF NOT EXISTS idx_grooming_report_card_order ON grooming_report_card(order_id);
CREATE INDEX IF NOT EXISTS idx_grooming_safety_order ON grooming_safety_escalations(order_id);
CREATE INDEX IF NOT EXISTS idx_grooming_disputes_order ON grooming_disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_grooming_earnings_provider ON grooming_earnings(provider_id);
CREATE INDEX IF NOT EXISTS idx_grooming_earnings_status ON grooming_earnings(status);
CREATE INDEX IF NOT EXISTS idx_grooming_settlements_provider ON grooming_settlements(provider_id);
CREATE INDEX IF NOT EXISTS idx_master_grooming_categories_active ON master_grooming_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_master_grooming_addons_active ON master_grooming_addons(is_active);

-- ── 48.10 Dark-launch feature flag ──
INSERT INTO system_settings (key, value, category, description)
VALUES ('grooming.enabled', 'false', 'grooming',
        'Master switch for the Pet Wellness/Grooming/Spa module (dark-launch flag, default off)')
ON CONFLICT (key) DO NOTHING;
