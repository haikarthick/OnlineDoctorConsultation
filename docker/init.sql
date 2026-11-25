-- ============================================================
-- VetCare - Complete Database Schema (PostgreSQL 18)
-- ============================================================
-- Fresh-install schema covering every table used by the application
-- services (see backend/migrations/*.sql for the same schema built up
-- incrementally on already-deployed environments - keep both in sync when
-- adding new tables/columns, since a migration alone is invisible to a
-- brand new database that runs only this file).
-- ============================================================

-- gen_random_uuid() is built into PostgreSQL 13+ - no extension required

-- Extensions for geospatial proximity search (earthdistance requires cube)
CREATE EXTENSION IF NOT EXISTS cube CASCADE;
CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE;

-- Utility: auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('farmer', 'pet_owner', 'veterinarian', 'admin', 'corporate_admin', 'hospital_staff', 'pharmacist', 'groomer', 'support')),
  phone VARCHAR(20) DEFAULT '',
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  account_status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'pending_approval', 'frozen', 'suspended')),
  freeze_reason TEXT,
  frozen_at TIMESTAMP,
  frozen_by UUID,
  avatar_url TEXT,
  unique_id VARCHAR(20) UNIQUE,
  default_enterprise_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 1b. HOSPITAL NETWORKS (defined early - referenced by many tables below)
-- ============================================================
CREATE TABLE IF NOT EXISTS hospital_networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  registration_number VARCHAR(100),
  tax_id VARCHAR(100),
  network_type VARCHAR(50) NOT NULL DEFAULT 'private'
    CHECK (network_type IN ('private', 'government', 'ngo', 'cooperative', 'franchise')),
  country VARCHAR(100) DEFAULT 'IN',
  headquarters_address TEXT,
  headquarters_city VARCHAR(100),
  headquarters_state VARCHAR(100),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  website TEXT,
  logo_url TEXT,
  website_url TEXT,
  id_prefix VARCHAR(10),
  dpo_name VARCHAR(200),
  dpo_email VARCHAR(255),
  data_residency_region VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  operating_hours JSONB,
  specializations TEXT[],
  emergency_services BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. VET PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS vet_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  license_number VARCHAR(100) NOT NULL,
  specializations TEXT[] DEFAULT '{}',
  qualifications TEXT[] DEFAULT '{}',
  years_of_experience INTEGER DEFAULT 0,
  bio TEXT,
  clinic_name VARCHAR(255),
  clinic_address TEXT,
  consultation_fee DECIMAL(10,2) DEFAULT 0.00,
  currency VARCHAR(10) DEFAULT 'USD',
  is_verified BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  accepts_emergency BOOLEAN DEFAULT false,
  available_days VARCHAR(100) DEFAULT 'Mon,Tue,Wed,Thu,Fri',
  available_hours_start TIME DEFAULT '09:00',
  available_hours_end TIME DEFAULT '17:00',
  languages TEXT[] DEFAULT '{English}',
  rating DECIMAL(3,2) DEFAULT 0.00,
  total_reviews INTEGER DEFAULT 0,
  total_consultations INTEGER DEFAULT 0,
  profile_image VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. ANIMALS / PETS
-- ============================================================
CREATE TABLE IF NOT EXISTS animals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  species VARCHAR(50) NOT NULL,
  breed VARCHAR(100),
  date_of_birth DATE,
  gender VARCHAR(10),
  weight DECIMAL(6,2),
  color VARCHAR(50),
  microchip_id VARCHAR(100),
  ear_tag_id VARCHAR(100),
  registration_number VARCHAR(100),
  is_neutered BOOLEAN,
  insurance_provider VARCHAR(200),
  insurance_policy_number VARCHAR(100),
  insurance_expiry DATE,
  medical_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  unique_id VARCHAR(20) UNIQUE,
  enterprise_id UUID,
  group_id UUID,
  breeding_status VARCHAR(50),
  last_breeding_date DATE,
  expected_due_date DATE,
  current_weight DECIMAL(8,2),
  weight_unit VARCHAR(10) DEFAULT 'kg',
  last_weighed_at TIMESTAMP,
  current_location_id UUID,
  status VARCHAR(30) DEFAULT 'active'
    CHECK (status IN ('active','sold','deceased','transferred','quarantined','retired','lost')),
  dam_id UUID,
  sire_id UUID,
  animal_class VARCHAR(30),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Platform-wide animal ID sequences (race-safe VC-SPE-YY-NNNNN generation)
CREATE TABLE IF NOT EXISTS animal_id_sequences (
  species  VARCHAR(20) NOT NULL,
  year     INTEGER     NOT NULL,
  last_seq INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (species, year)
);

-- Per-network animal ID sequences (race-safe PREFIX-SPE-YY-NNNNNN generation)
CREATE TABLE IF NOT EXISTS network_patient_id_sequences (
  network_id  UUID        NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
  species     VARCHAR(20) NOT NULL,
  year        INTEGER     NOT NULL,
  last_seq    INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (network_id, species, year)
);

-- ============================================================
-- 4. CONSULTATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  veterinarian_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- RESTRICT, not SET NULL: an animal with consultation history must not be deletable, and
  -- nulling the link would orphan the clinical record. database.ts's startup self-heal has
  -- always forced RESTRICT here, so every deployed DB is already RESTRICT - this line used to
  -- say SET NULL and lost the fight on every boot. Kept aligned so the two cannot disagree.
  animal_id UUID REFERENCES animals(id) ON DELETE RESTRICT,
  animal_type VARCHAR(100) NOT NULL DEFAULT '',
  symptom_description TEXT NOT NULL DEFAULT '',
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('pending', 'confirmed', 'scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
  priority VARCHAR(20) DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'emergency')),
  consultation_type VARCHAR(30) DEFAULT 'video'
    CHECK (consultation_type IN ('video', 'chat', 'phone', 'in_person')),
  scheduled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration INTEGER,
  diagnosis TEXT,
  prescription TEXT,
  follow_up_date DATE,
  notes TEXT,
  booking_id UUID,
  network_id UUID REFERENCES hospital_networks(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4b. ENTERPRISES & ANIMAL GROUPS(required before bookings FK)
-- ============================================================
CREATE TABLE IF NOT EXISTS enterprises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  enterprise_type VARCHAR(50),
  description TEXT,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'US',
  postal_code VARCHAR(20),
  gps_latitude DECIMAL(10,8),
  gps_longitude DECIMAL(11,8),
  total_area DECIMAL(12,2),
  area_unit VARCHAR(50),
  license_number VARCHAR(100),
  regulatory_id VARCHAR(100),
  tax_id VARCHAR(100),
  phone VARCHAR(30),
  email VARCHAR(255),
  website VARCHAR(500),
  owner_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS animal_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID REFERENCES enterprises(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  group_type VARCHAR(50),
  species VARCHAR(100),
  breed VARCHAR(100),
  purpose VARCHAR(255),
  target_count INTEGER DEFAULT 0,
  current_count INTEGER DEFAULT 0,
  color_code VARCHAR(20),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4c. ENTERPRISE MEMBERS (multi-user access to a farm/enterprise)
-- ============================================================
CREATE TABLE IF NOT EXISTS enterprise_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL DEFAULT 'worker'
    CHECK (role IN ('owner', 'manager', 'supervisor', 'worker', 'farm_vet', 'viewer')),
  title VARCHAR(100),
  permissions JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(enterprise_id, user_id)
);

-- ============================================================
-- 4d. LOCATIONS (barns, pens, paddocks, enclosures)
-- ============================================================
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  location_type VARCHAR(50) NOT NULL
    CHECK (location_type IN (
      'barn', 'stable', 'pen', 'paddock', 'field', 'pasture',
      'quarantine', 'isolation', 'aviary', 'tank', 'pond',
      'enclosure', 'kennel', 'cattery', 'warehouse', 'office',
      'treatment_area', 'milking_parlor', 'feed_storage', 'other'
    )),
  parent_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  capacity INTEGER DEFAULT 0,
  current_occupancy INTEGER DEFAULT 0,
  area DECIMAL(10,2),
  area_unit VARCHAR(10) DEFAULT 'sqft',
  gps_latitude DECIMAL(10,7),
  gps_longitude DECIMAL(10,7),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4e. MOVEMENT RECORDS (animal/group transfers between locations)
-- ============================================================
CREATE TABLE IF NOT EXISTS movement_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL,
  from_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  to_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  movement_type VARCHAR(30) NOT NULL DEFAULT 'transfer'
    CHECK (movement_type IN ('transfer', 'intake', 'discharge', 'quarantine', 'sale', 'death', 'birth', 'import', 'export')),
  reason TEXT,
  animal_count INTEGER DEFAULT 1,
  transport_method VARCHAR(50),
  transport_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  regulatory_permit VARCHAR(100),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  recorded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed'))
);

-- ============================================================
-- 4f. TREATMENT CAMPAIGNS (group-level vaccinations, treatments)
-- ============================================================
CREATE TABLE IF NOT EXISTS treatment_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL,
  campaign_type VARCHAR(50) NOT NULL
    CHECK (campaign_type IN (
      'vaccination', 'deworming', 'testing', 'treatment',
      'health_check', 'tagging', 'weighing', 'hoof_trimming',
      'shearing', 'dipping', 'other'
    )),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  product_used VARCHAR(200),
  dosage VARCHAR(100),
  target_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  scheduled_date DATE,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  administered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cost DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 5. BOOKINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_owner_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  veterinarian_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL,
  group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL,
  hospital_id UUID,
  scheduled_date DATE NOT NULL,
  time_slot_start VARCHAR(10) NOT NULL,
  time_slot_end VARCHAR(10) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rescheduled', 'completed', 'missed')),
  booking_type VARCHAR(30) NOT NULL DEFAULT 'video_call'
    CHECK (booking_type IN ('video_call', 'in_person', 'phone', 'chat')),
  priority VARCHAR(20) DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'emergency')),
  reason_for_visit TEXT,
  symptoms TEXT,
  notes TEXT,
  cancellation_reason TEXT,
  rescheduled_from UUID,
  reschedule_count INTEGER NOT NULL DEFAULT 0,
  missed_by VARCHAR(20) CHECK (missed_by IN ('doctor', 'patient', 'both')),
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMP,
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 6. VET SCHEDULES
-- ============================================================
CREATE TABLE IF NOT EXISTS vet_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veterinarian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week VARCHAR(10) NOT NULL
    CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  start_time VARCHAR(10) NOT NULL,
  end_time VARCHAR(10) NOT NULL,
  slot_duration INTEGER DEFAULT 30,
  max_appointments INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(veterinarian_id, day_of_week)
);

-- ============================================================
-- 7. VIDEO SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS video_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  room_id VARCHAR(100) NOT NULL,
  host_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'active', 'paused', 'ended', 'failed')),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration INTEGER,
  recording_url VARCHAR(500),
  quality VARCHAR(10) DEFAULT 'high'
    CHECK (quality IN ('low', 'medium', 'high', 'hd')),
  network_id UUID REFERENCES hospital_networks(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 8. CHAT MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES video_sessions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_name VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'file', 'system')),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 9. PRESCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  veterinarian_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  pet_owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  medications JSONB DEFAULT '[]',
  instructions TEXT,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  network_id UUID REFERENCES hospital_networks(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 10. MEDICAL RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  veterinarian_id UUID REFERENCES users(id) ON DELETE SET NULL,
  record_number VARCHAR(20) UNIQUE,
  record_type VARCHAR(50) NOT NULL
    CHECK (record_type IN ('diagnosis', 'prescription', 'lab_report', 'vaccination', 'surgery', 'imaging', 'follow_up', 'other')),
  title VARCHAR(255) NOT NULL DEFAULT 'Untitled Record',
  content TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'normal'
    CHECK (severity IN ('low', 'normal', 'high', 'critical')),
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'draft')),
  medications JSONB DEFAULT '[]',
  attachments JSONB DEFAULT '[]',
  is_confidential BOOLEAN DEFAULT false,
  follow_up_date DATE,
  tags TEXT[] DEFAULT '{}',
  file_url VARCHAR(500),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  network_id UUID REFERENCES hospital_networks(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 10b. VACCINATION RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS vaccination_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  vaccine_name VARCHAR(255) NOT NULL,
  vaccine_type VARCHAR(100),
  date_administered DATE NOT NULL,
  next_due_date DATE,
  dosage VARCHAR(100),
  batch_number VARCHAR(100),
  manufacturer VARCHAR(255),
  administered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  site_of_administration VARCHAR(255),
  certificate_number VARCHAR(100),
  reaction_notes TEXT,
  is_valid BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  network_id UUID REFERENCES hospital_networks(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 10c. WEIGHT HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS weight_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  weight DECIMAL(8,2) NOT NULL,
  unit VARCHAR(10) DEFAULT 'kg',
  notes TEXT,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 10d. ALLERGY RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS allergy_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  allergen VARCHAR(255) NOT NULL,
  reaction TEXT,
  severity VARCHAR(20) DEFAULT 'mild'
    CHECK (severity IN ('mild', 'moderate', 'severe')),
  identified_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 10e. MEDICAL RECORD AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS medical_record_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID,
  record_type VARCHAR(50),
  action VARCHAR(50) NOT NULL,
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_by_name VARCHAR(255),
  old_values JSONB,
  new_values JSONB,
  change_reason TEXT,
  ip_address VARCHAR(45),
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 10f. LAB RESULTS
-- ============================================================
CREATE TABLE IF NOT EXISTS lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  medical_record_id UUID REFERENCES medical_records(id) ON DELETE SET NULL,
  test_name VARCHAR(255) NOT NULL,
  test_category VARCHAR(100),
  test_date DATE NOT NULL,
  result_value TEXT,
  normal_range VARCHAR(100),
  unit VARCHAR(50),
  is_abnormal BOOLEAN DEFAULT false,
  interpretation TEXT,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed')),
  lab_name VARCHAR(255),
  ordered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  consultation_id UUID,
  attachments JSONB DEFAULT '[]',
  notes TEXT,
  network_id UUID REFERENCES hospital_networks(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 11. SESSIONS (refresh tokens)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token VARCHAR(500) NOT NULL,
  user_agent VARCHAR(500),
  ip_address VARCHAR(45),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 12. PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  payer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  payee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255),
  invoice_number VARCHAR(100),
  gateway VARCHAR(50) DEFAULT 'stripe',
  -- Which revenue stream this payment belongs to. The finance overview counts GMV by it and the
  -- Razorpay webhook routes completion by it, so it must exist from a fresh install - it used to
  -- be added only by the startup self-heal, which runs AFTER migrations.
  payment_source VARCHAR(30) DEFAULT 'consultation'
    CHECK (payment_source IN ('consultation', 'pharmacy', 'subscription', 'other', 'grooming')),
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  refund_amount DECIMAL(10,2) DEFAULT 0,
  refund_reason TEXT,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 13. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  channel VARCHAR(20) DEFAULT 'in_app',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 14. REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  veterinarian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  response_from_vet TEXT,
  is_public BOOLEAN DEFAULT true,
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active', 'hidden', 'flagged', 'removed')),
  helpful_count INTEGER DEFAULT 0,
  report_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 15. AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100),
  entity_type VARCHAR(100),
  entity_id UUID,
  resource_id VARCHAR(255),
  details JSONB,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 16. SYSTEM SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  category VARCHAR(50) DEFAULT 'general',
  description TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 17. WALLETS
-- ============================================================
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance DECIMAL(10,2) DEFAULT 0.00,
  bonus_credits DECIMAL(10,2) DEFAULT 0.00,
  currency VARCHAR(10) DEFAULT 'USD',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 18. WALLET TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL CHECK (type IN ('credit', 'debit', 'refund', 'bonus', 'withdrawal')),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  reference_id UUID,
  reference_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 18b. WALLET WITHDRAWALS (migration 038) - money OUT of the platform
-- ============================================================
-- Without this the wallet is a one-way door: refunds land in it and can only ever be spent
-- back on the platform. Separate from withdrawal_requests, which is keyed to doctor earnings
-- and carries TDS/commission-invoice semantics that do not apply to handing a customer back
-- their own money. Only `balance` is withdrawable - `bonus_credits` is promotional.
CREATE TABLE IF NOT EXISTS wallet_withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) DEFAULT 'INR',
  status VARCHAR(20) NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'rejected', 'settled', 'cancelled')),
  method VARCHAR(20) NOT NULL DEFAULT 'bank_transfer'
    CHECK (method IN ('bank_transfer', 'upi')),
  account_name VARCHAR(255),
  account_number VARCHAR(50),
  ifsc VARCHAR(20),
  upi_id VARCHAR(100),
  utr_reference VARCHAR(100),
  admin_note TEXT,
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  settled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  settled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wallet_withdrawals_user ON wallet_withdrawal_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_withdrawals_open
  ON wallet_withdrawal_requests (created_at ASC) WHERE status IN ('requested', 'approved');

-- ============================================================
-- AUTO-UPDATE TRIGGERS  (drop+create for idempotency)
-- ============================================================
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vet_profiles_updated_at ON vet_profiles;
CREATE TRIGGER update_vet_profiles_updated_at BEFORE UPDATE ON vet_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_animals_updated_at ON animals;
CREATE TRIGGER update_animals_updated_at BEFORE UPDATE ON animals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_consultations_updated_at ON consultations;
CREATE TRIGGER update_consultations_updated_at BEFORE UPDATE ON consultations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vet_schedules_updated_at ON vet_schedules;
CREATE TRIGGER update_vet_schedules_updated_at BEFORE UPDATE ON vet_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_video_sessions_updated_at ON video_sessions;
CREATE TRIGGER update_video_sessions_updated_at BEFORE UPDATE ON video_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prescriptions_updated_at ON prescriptions;
CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_medical_records_updated_at ON medical_records;
CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON medical_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vaccination_records_updated_at ON vaccination_records;
CREATE TRIGGER update_vaccination_records_updated_at BEFORE UPDATE ON vaccination_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_allergy_records_updated_at ON allergy_records;
CREATE TRIGGER update_allergy_records_updated_at BEFORE UPDATE ON allergy_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lab_results_updated_at ON lab_results;
CREATE TRIGGER update_lab_results_updated_at BEFORE UPDATE ON lab_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_vet_profiles_user_id ON vet_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_vet_profiles_specializations ON vet_profiles USING GIN(specializations);

CREATE INDEX IF NOT EXISTS idx_animals_owner_id ON animals(owner_id);
CREATE INDEX IF NOT EXISTS idx_animals_species ON animals(species);

CREATE INDEX IF NOT EXISTS idx_consultations_user_id ON consultations(user_id);
CREATE INDEX IF NOT EXISTS idx_consultations_veterinarian_id ON consultations(veterinarian_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
CREATE INDEX IF NOT EXISTS idx_consultations_scheduled_at ON consultations(scheduled_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_consultations_booking_id ON consultations(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consultations_vet_user ON consultations(veterinarian_id, user_id);
CREATE INDEX IF NOT EXISTS idx_consultations_network ON consultations(network_id);

CREATE INDEX IF NOT EXISTS idx_bookings_pet_owner_id ON bookings(pet_owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_veterinarian_id ON bookings(veterinarian_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_date ON bookings(scheduled_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_vet_slot_unique
  ON bookings(veterinarian_id, scheduled_date, time_slot_start)
  WHERE status NOT IN ('cancelled', 'missed');

CREATE INDEX IF NOT EXISTS idx_vet_schedules_vet_id ON vet_schedules(veterinarian_id);

CREATE INDEX IF NOT EXISTS idx_video_sessions_consultation ON video_sessions(consultation_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_room ON video_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_status ON video_sessions(status);
CREATE INDEX IF NOT EXISTS idx_video_sessions_network ON video_sessions(network_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_prescriptions_consultation ON prescriptions(consultation_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_vet ON prescriptions(veterinarian_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_owner ON prescriptions(pet_owner_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_network ON prescriptions(network_id);

CREATE INDEX IF NOT EXISTS idx_medical_records_user_id ON medical_records(user_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_animal_id ON medical_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_record_type ON medical_records(record_type);
CREATE INDEX IF NOT EXISTS idx_medical_records_record_number ON medical_records(record_number);
CREATE INDEX IF NOT EXISTS idx_medical_records_status ON medical_records(status);
CREATE INDEX IF NOT EXISTS idx_medical_records_veterinarian_id ON medical_records(veterinarian_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_network ON medical_records(network_id);
CREATE INDEX IF NOT EXISTS idx_vaccination_records_animal_id ON vaccination_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_vaccination_records_next_due ON vaccination_records(next_due_date);
CREATE INDEX IF NOT EXISTS idx_vaccination_records_network ON vaccination_records(network_id);
CREATE INDEX IF NOT EXISTS idx_weight_history_animal_id ON weight_history(animal_id);
CREATE INDEX IF NOT EXISTS idx_allergy_records_animal_id ON allergy_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_animal_id ON lab_results(animal_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_status ON lab_results(status);
CREATE INDEX IF NOT EXISTS idx_lab_results_network ON lab_results(network_id);
CREATE INDEX IF NOT EXISTS idx_medical_audit_log_record ON medical_record_audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_medical_audit_log_action ON medical_record_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_users_unique_id ON users(unique_id);
CREATE INDEX IF NOT EXISTS idx_animals_unique_id ON animals(unique_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_payments_consultation_id ON payments(consultation_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

CREATE INDEX IF NOT EXISTS idx_reviews_consultation_id ON reviews(consultation_id);
CREATE INDEX IF NOT EXISTS idx_reviews_veterinarian_id ON reviews(veterinarian_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- ============================================================
-- NOTE: bookings_status_check is (re)created once, later in this file,
-- by the "46.2 bookings: payment lifecycle statuses" block - with the
-- FULL, current status list ('missed' included). Do not add another
-- ALTER TABLE ... ADD CONSTRAINT bookings_status_check block here: this
-- file runs as one atomic statement, so an earlier block using a
-- narrower status list than what real rows already contain (e.g. it's
-- missing 'payment_pending'/'payment_expired'/'referred') aborts the
-- ENTIRE init.sql run on every existing DB that has such rows - which
-- is exactly what took down the 2026-07-20 vetcare-dev deploy. If the
-- status list ever needs to change, edit the single block at the
-- "46.2 bookings" section below, in place, rather than adding a new one.
-- ============================================================

-- ============================================================
-- FIX: Add missed_by column to bookings if not exists
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'missed_by'
  ) THEN
    ALTER TABLE bookings ADD COLUMN missed_by VARCHAR(20)
      CHECK (missed_by IN ('doctor', 'patient', 'both'));
  END IF;
END $$;

-- ============================================================
-- VET HOSPITALS (needed for booking LEFT JOIN)
-- ============================================================
CREATE TABLE IF NOT EXISTS vet_hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  hospital_type VARCHAR(50) NOT NULL DEFAULT 'multi_specialty',
  tagline VARCHAR(500),
  registration_number VARCHAR(100),
  accreditation_body VARCHAR(255),
  accreditation_number VARCHAR(100),
  accreditation_expiry DATE,
  description TEXT,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'US',
  postal_code VARCHAR(20),
  gps_latitude DECIMAL(10,8),
  gps_longitude DECIMAL(11,8),
  phone VARCHAR(30),
  emergency_phone VARCHAR(30),
  email VARCHAR(255),
  website VARCHAR(500),
  logo_url VARCHAR(500),
  cover_image_url VARCHAR(500),
  established_year INTEGER,
  total_beds INTEGER DEFAULT 0,
  icu_beds INTEGER DEFAULT 0,
  is_24_hours BOOLEAN DEFAULT false,
  has_emergency BOOLEAN DEFAULT false,
  has_ambulance BOOLEAN DEFAULT false,
  has_pharmacy BOOLEAN DEFAULT false,
  has_lab BOOLEAN DEFAULT false,
  has_imaging BOOLEAN DEFAULT false,
  has_surgery BOOLEAN DEFAULT false,
  has_icu BOOLEAN DEFAULT false,
  specializations TEXT[] DEFAULT '{}',
  facilities TEXT[] DEFAULT '{}',
  accepted_species TEXT[] DEFAULT '{}',
  operating_hours JSONB DEFAULT '{}',
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  verification_status VARCHAR(50) DEFAULT 'pending_documents',
  drug_license_expiry DATE,
  trade_license_expiry DATE,
  registration_renewal_date DATE,
  rating DECIMAL(3,2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_consultations INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  is_network_branch BOOLEAN DEFAULT false,
  branch_network_id UUID REFERENCES hospital_networks(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 19. STAFF POSITIONS (Hospital staff categories)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position VARCHAR(50) NOT NULL
    CHECK (position IN ('veterinarian','surgeon','nurse','technician','receptionist','intern','radiologist','lab_tech','anesthesiologist','pharmacist','admin_staff')),
  department VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  hired_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(hospital_id, user_id)
);

-- ============================================================
-- 20. APPOINTMENT QUEUE (Waiting room & triage)
-- ============================================================
CREATE TABLE IF NOT EXISTS appointment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_vet_id UUID REFERENCES users(id) ON DELETE SET NULL,
  queue_number INTEGER NOT NULL DEFAULT 0,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('emergency','urgent','high','normal','low')),
  triage_level INTEGER DEFAULT 3 CHECK (triage_level BETWEEN 1 AND 5),
  status VARCHAR(30) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','in_triage','in_examination','in_treatment','in_observation','referred','discharged','no_show')),
  reason TEXT,
  triage_notes TEXT,
  triaged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  called_at TIMESTAMP,
  completed_at TIMESTAMP,
  estimated_wait_minutes INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 21. WORKFLOW CASES (Clinical pipeline tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_entry_id UUID REFERENCES appointment_queue(id) ON DELETE SET NULL,
  hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  current_stage VARCHAR(30) NOT NULL DEFAULT 'triage'
    CHECK (current_stage IN ('triage','examination','treatment','observation','discharge')),
  assigned_vet_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
  priority VARCHAR(20) DEFAULT 'normal'
    CHECK (priority IN ('emergency','urgent','high','normal','low')),
  chief_complaint TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,
  discharge_summary TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','referred','cancelled')),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  network_id UUID REFERENCES hospital_networks(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 22. WORKFLOW TRANSITIONS(Stage change audit log)
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES workflow_cases(id) ON DELETE CASCADE,
  from_stage VARCHAR(30),
  to_stage VARCHAR(30) NOT NULL,
  transitioned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  staff_position VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 23. REFERRALS (Multi-doctor consultation handoffs)
-- ============================================================
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES workflow_cases(id) ON DELETE SET NULL,
  hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE CASCADE,
  from_vet_id UUID REFERENCES users(id) ON DELETE SET NULL,
  to_vet_id UUID REFERENCES users(id) ON DELETE SET NULL,
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  specialty_needed VARCHAR(100),
  priority VARCHAR(20) DEFAULT 'normal'
    CHECK (priority IN ('emergency','urgent','high','normal','low')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','completed','cancelled')),
  clinical_notes TEXT,
  response_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 24. INPATIENT ADMISSIONS (Boarding & overnight stays)
-- ============================================================
CREATE TABLE IF NOT EXISTS inpatient_admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE CASCADE,
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admitted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id UUID REFERENCES workflow_cases(id) ON DELETE SET NULL,
  admission_type VARCHAR(30) NOT NULL DEFAULT 'observation'
    CHECK (admission_type IN ('surgery_recovery','overnight_observation','boarding','icu','post_treatment','quarantine')),
  room_number VARCHAR(20),
  bed_number VARCHAR(20),
  status VARCHAR(30) NOT NULL DEFAULT 'admitted'
    CHECK (status IN ('admitted','in_treatment','recovering','ready_to_discharge','discharged','transferred','deceased')),
  admitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  estimated_discharge TIMESTAMP,
  discharged_at TIMESTAMP,
  discharged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  discharge_notes TEXT,
  care_instructions TEXT,
  medications JSONB DEFAULT '[]',
  vitals_log JSONB DEFAULT '[]',
  special_needs TEXT,
  daily_rate DECIMAL(10,2) DEFAULT 0,
  network_id UUID REFERENCES hospital_networks(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staff & Workflow Indexes
CREATE INDEX IF NOT EXISTS idx_staff_positions_hospital ON staff_positions(hospital_id);
CREATE INDEX IF NOT EXISTS idx_staff_positions_user ON staff_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_appointment_queue_hospital ON appointment_queue(hospital_id);
CREATE INDEX IF NOT EXISTS idx_appointment_queue_status ON appointment_queue(status);
CREATE INDEX IF NOT EXISTS idx_workflow_cases_hospital ON workflow_cases(hospital_id);
CREATE INDEX IF NOT EXISTS idx_workflow_cases_stage ON workflow_cases(current_stage);
CREATE INDEX IF NOT EXISTS idx_workflow_cases_status ON workflow_cases(status);
CREATE INDEX IF NOT EXISTS idx_workflow_cases_network ON workflow_cases(network_id);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_case ON workflow_transitions(case_id);
CREATE INDEX IF NOT EXISTS idx_referrals_hospital ON referrals(hospital_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_inpatient_hospital ON inpatient_admissions(hospital_id);
CREATE INDEX IF NOT EXISTS idx_inpatient_status ON inpatient_admissions(status);
CREATE INDEX IF NOT EXISTS idx_inpatient_animal ON inpatient_admissions(animal_id);
CREATE INDEX IF NOT EXISTS idx_inpatient_network ON inpatient_admissions(network_id);

-- Triggers for new tables
DROP TRIGGER IF EXISTS update_staff_positions_updated_at ON staff_positions;
CREATE TRIGGER update_staff_positions_updated_at BEFORE UPDATE ON staff_positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointment_queue_updated_at ON appointment_queue;
CREATE TRIGGER update_appointment_queue_updated_at BEFORE UPDATE ON appointment_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflow_cases_updated_at ON workflow_cases;
CREATE TRIGGER update_workflow_cases_updated_at BEFORE UPDATE ON workflow_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_referrals_updated_at ON referrals;
CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inpatient_admissions_updated_at ON inpatient_admissions;
CREATE TRIGGER update_inpatient_admissions_updated_at BEFORE UPDATE ON inpatient_admissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 25. VET DATE OVERRIDES (day off / custom hours for specific dates)
-- ============================================================
CREATE TABLE IF NOT EXISTS vet_date_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veterinarian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  override_type VARCHAR(20) NOT NULL CHECK (override_type IN ('unavailable', 'custom_hours')),
  start_time VARCHAR(10),
  end_time VARCHAR(10),
  slot_duration INTEGER,
  reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(veterinarian_id, override_date)
);

-- ============================================================
-- 26. VET BLOCKED SLOTS (block specific time ranges, one-time or recurring)
-- ============================================================
CREATE TABLE IF NOT EXISTS vet_blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veterinarian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  block_date DATE,
  start_time VARCHAR(10) NOT NULL,
  end_time VARCHAR(10) NOT NULL,
  reason TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurring_day VARCHAR(10) CHECK (recurring_day IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 27. HOSPITAL HOLIDAYS (system-wide or hospital-specific)
-- ============================================================
CREATE TABLE IF NOT EXISTS hospital_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  name VARCHAR(255) NOT NULL,
  holiday_type VARCHAR(30) NOT NULL DEFAULT 'general'
    CHECK (holiday_type IN ('general', 'hospital_specific', 'emergency_closure')),
  is_full_day BOOLEAN DEFAULT true,
  start_time VARCHAR(10),
  end_time VARCHAR(10),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Availability Indexes
CREATE INDEX IF NOT EXISTS idx_vet_date_overrides_vet ON vet_date_overrides(veterinarian_id);
CREATE INDEX IF NOT EXISTS idx_vet_date_overrides_date ON vet_date_overrides(override_date);
CREATE INDEX IF NOT EXISTS idx_vet_blocked_slots_vet ON vet_blocked_slots(veterinarian_id);
CREATE INDEX IF NOT EXISTS idx_vet_blocked_slots_date ON vet_blocked_slots(block_date);
CREATE INDEX IF NOT EXISTS idx_hospital_holidays_date ON hospital_holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_hospital_holidays_hospital ON hospital_holidays(hospital_id);

-- Availability Triggers
DROP TRIGGER IF EXISTS update_vet_date_overrides_updated_at ON vet_date_overrides;
CREATE TRIGGER update_vet_date_overrides_updated_at BEFORE UPDATE ON vet_date_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vet_blocked_slots_updated_at ON vet_blocked_slots;
CREATE TRIGGER update_vet_blocked_slots_updated_at BEFORE UPDATE ON vet_blocked_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hospital_holidays_updated_at ON hospital_holidays;
CREATE TRIGGER update_hospital_holidays_updated_at BEFORE UPDATE ON hospital_holidays
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════
-- Auth & Permission Tables
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(50) NOT NULL,
  permission VARCHAR(100) NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  updated_by UUID,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(role, permission)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  replaced_by_token_id UUID,
  user_agent TEXT,
  ip_address VARCHAR(45)
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- ═══════════════════════════════════════════════════════════════════
-- Hospital Sub-Tables (departments, doctors, services, invites, documents)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS hospital_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES vet_hospitals(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(20),
  description TEXT,
  specializations TEXT[] DEFAULT '{}',
  floor_number VARCHAR(20),
  room_numbers VARCHAR(100),
  head_doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(hospital_id, name)
);
CREATE INDEX IF NOT EXISTS idx_hospital_departments_hospital ON hospital_departments(hospital_id);

CREATE TABLE IF NOT EXISTS hospital_doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES vet_hospitals(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID REFERENCES hospital_departments(id) ON DELETE SET NULL,
  -- 'staff', not 'doctor': 'doctor' is NOT in the CHECK list below, so the old default made
  -- every INSERT that omitted this column fail on its own constraint. It stayed latent only
  -- because every caller happens to set the column explicitly. 'staff' is the value the
  -- application already treats as the default (VetHospitalManage.tsx form state, and the
  -- `|| 'staff'` display fallbacks). See migration 040 for already-deployed databases.
  hospital_role VARCHAR(50) NOT NULL DEFAULT 'staff'
    CHECK (hospital_role IN (
      'owner','medical_director','department_head',
      'consultant','resident','intern','staff','visiting'
    )),
  title VARCHAR(100),
  employment_type VARCHAR(30) DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time','part_time','contract','visiting','honorary')),
  is_primary_hospital BOOLEAN DEFAULT false,
  consultation_fee DECIMAL(10,2),
  is_accepting_patients BOOLEAN DEFAULT true,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ends_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(hospital_id, doctor_id)
);
CREATE INDEX IF NOT EXISTS idx_hospital_doctors_hospital ON hospital_doctors(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_doctors_doctor ON hospital_doctors(doctor_id);

CREATE TABLE IF NOT EXISTS hospital_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES vet_hospitals(id) ON DELETE CASCADE,
  service_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'consultation'
    CHECK (category IN (
      'consultation','diagnostics','surgery','vaccination',
      'dental','grooming','boarding','emergency',
      'rehabilitation','nutrition','reproduction','other'
    )),
  description TEXT,
  price_min DECIMAL(10,2),
  price_max DECIMAL(10,2),
  currency VARCHAR(10) DEFAULT 'USD',
  duration_minutes INTEGER,
  requires_appointment BOOLEAN DEFAULT true,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hospital_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES vet_hospitals(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  invite_token VARCHAR(128) NOT NULL UNIQUE,
  hospital_role VARCHAR(50) DEFAULT 'staff',
  department_id UUID REFERENCES hospital_departments(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hospital_invites_token ON hospital_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_hospital_invites_hospital ON hospital_invites(hospital_id);

-- 40b. HOSPITAL PATIENT INVITES moved after hospital_networks definition (line ~1534)

CREATE TABLE IF NOT EXISTS hospital_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES vet_hospitals(id) ON DELETE CASCADE,
  doc_type VARCHAR(30) NOT NULL
    CHECK (doc_type IN (
      'pan','gst','aadhaar','bank_account',
      'vet_council','trade_license','drug_license'
    )),
  file_name VARCHAR(500) NOT NULL,
  file_url TEXT NOT NULL,
  expiry_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','approved','rejected')),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (hospital_id, doc_type)
);
CREATE INDEX IF NOT EXISTS idx_hospital_docs_hospital ON hospital_documents(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_docs_status ON hospital_documents(status);
CREATE INDEX IF NOT EXISTS idx_hospital_docs_expiry ON hospital_documents(expiry_date)
  WHERE expiry_date IS NOT NULL;

-- ============================================================
-- VACCINATION PROTOCOL MASTER LIBRARY
-- ============================================================

-- ── 30. VACCINE PROTOCOLS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS vaccine_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  disease VARCHAR(255) NOT NULL,
  species TEXT[] NOT NULL DEFAULT '{}',
  -- Applicable gender: 'all', 'male', 'female'
  applicable_gender VARCHAR(10) NOT NULL DEFAULT 'all'
    CHECK (applicable_gender IN ('all','male','female')),
  -- Age range in weeks. NULL = no restriction
  min_age_weeks INTEGER,
  max_age_weeks INTEGER,
  -- Core vs non-core vs government-mandated
  vaccine_category VARCHAR(30) NOT NULL DEFAULT 'core'
    CHECK (vaccine_category IN ('core','non_core','mandatory_govt','legally_mandated')),
  is_zoonotic BOOLEAN DEFAULT false,
  -- Dosing schedule
  initial_dose_age_weeks INTEGER,          -- age (weeks) for first dose
  booster_interval_days INTEGER NOT NULL DEFAULT 365, -- days between boosters
  -- For puppy/kitten series: number of initial doses before annual boosters
  series_dose_count INTEGER DEFAULT 1,
  series_interval_days INTEGER DEFAULT 21, -- days between series doses
  -- Administration info
  route VARCHAR(30) DEFAULT 'intramuscular'
    CHECK (route IN ('intramuscular','subcutaneous','intranasal','oral','intravenous','topical')),
  dosage_ml VARCHAR(50),
  site VARCHAR(100),
  -- Regulatory & labelling
  regulatory_body VARCHAR(255),
  regulatory_standard VARCHAR(500),
  seasonal_window VARCHAR(100),            -- e.g. "Pre-monsoon (May-June)"
  country VARCHAR(50) DEFAULT 'ALL',
  -- Status
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 31. VACCINE PROTOCOL CHANGES (regulatory change history) ─
CREATE TABLE IF NOT EXISTS vaccine_protocol_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID NOT NULL REFERENCES vaccine_protocols(id) ON DELETE CASCADE,
  changed_field VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_reason TEXT,
  regulatory_standard VARCHAR(500),       -- e.g. "WSAVA 2022", "DAHD India 2023"
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 32. ANIMAL VACCINE ASSIGNMENTS (protocols assigned to an animal) ─
CREATE TABLE IF NOT EXISTS animal_vaccine_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  protocol_id UUID NOT NULL REFERENCES vaccine_protocols(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  waived BOOLEAN DEFAULT false,
  waiver_reason TEXT,
  notes TEXT,
  UNIQUE (animal_id, protocol_id)
);

-- ── 33. VACCINE SCHEDULE (generated per-dose rows) ──────────
CREATE TABLE IF NOT EXISTS vaccine_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  protocol_id UUID NOT NULL REFERENCES vaccine_protocols(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES animal_vaccine_assignments(id) ON DELETE SET NULL,
  dose_number INTEGER NOT NULL DEFAULT 1,
  due_date DATE NOT NULL,
  -- Populated when the dose is administered
  administered_at DATE,
  vaccination_record_id UUID REFERENCES vaccination_records(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','administered','overdue','skipped','waived')),
  reminder_sent BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 34. VACCINE CERTIFICATE LOG (track PDF certificate downloads) ─
CREATE TABLE IF NOT EXISTS vaccine_certificate_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  vaccination_record_id UUID REFERENCES vaccination_records(id) ON DELETE SET NULL,
  generated_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  certificate_type VARCHAR(30) NOT NULL DEFAULT 'single'
    CHECK (certificate_type IN ('single','passport','batch')),
  file_name VARCHAR(255),
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- vaccination_records - add protocol / schedule FKs
ALTER TABLE vaccination_records ADD COLUMN IF NOT EXISTS protocol_id UUID REFERENCES vaccine_protocols(id) ON DELETE SET NULL;
ALTER TABLE vaccination_records ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES vaccine_schedule(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vaccine_protocols_species ON vaccine_protocols USING GIN(species);
CREATE INDEX IF NOT EXISTS idx_vaccine_protocols_active ON vaccine_protocols(is_active);
CREATE INDEX IF NOT EXISTS idx_vaccine_protocol_changes_protocol ON vaccine_protocol_changes(protocol_id);
CREATE INDEX IF NOT EXISTS idx_animal_vaccine_assignments_animal ON animal_vaccine_assignments(animal_id);
CREATE INDEX IF NOT EXISTS idx_animal_vaccine_assignments_protocol ON animal_vaccine_assignments(protocol_id);
CREATE INDEX IF NOT EXISTS idx_vaccine_schedule_animal ON vaccine_schedule(animal_id);
CREATE INDEX IF NOT EXISTS idx_vaccine_schedule_due ON vaccine_schedule(due_date);
CREATE INDEX IF NOT EXISTS idx_vaccine_schedule_status ON vaccine_schedule(status);
CREATE INDEX IF NOT EXISTS idx_vaccine_cert_log_animal ON vaccine_certificate_log(animal_id);
CREATE INDEX IF NOT EXISTS idx_vaccine_cert_log_generated_by ON vaccine_certificate_log(generated_by);
CREATE INDEX IF NOT EXISTS idx_vaccination_records_protocol ON vaccination_records(protocol_id);

-- Triggers
DROP TRIGGER IF EXISTS update_vaccine_protocols_updated_at ON vaccine_protocols;
CREATE TRIGGER update_vaccine_protocols_updated_at BEFORE UPDATE ON vaccine_protocols
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vaccine_schedule_updated_at ON vaccine_schedule;
CREATE TRIGGER update_vaccine_schedule_updated_at BEFORE UPDATE ON vaccine_schedule
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ============================================================
-- 35. VETERINARY CERTIFICATES
-- ============================================================
CREATE TABLE IF NOT EXISTS vet_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number VARCHAR(100) NOT NULL UNIQUE,
  certificate_type VARCHAR(50) NOT NULL CHECK (certificate_type IN (
    'health_certificate','fitness_to_travel','rabies_vaccination','vaccination_record',
    'pre_travel','sterilization','treatment','animal_injury','post_mortem',
    'breeding_soundness','pregnancy_diagnosis','infertility_evaluation',
    'fitness_for_sale','animal_valuation',
    'movement_permit','herd_health_certificate','slaughter_fitness','export_health_certificate'
  )),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','revoked','expired')),
  veterinarian_id UUID NOT NULL REFERENCES users(id),
  pet_owner_id UUID REFERENCES users(id),
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL,
  examination_date DATE,
  clinical_findings TEXT,
  diagnosis TEXT,
  treatment_summary TEXT,
  recommendations TEXT,
  vaccination_details JSONB,
  travel_details JSONB,
  breeding_details JSONB,
  valuation_details JSONB,
  movement_details JSONB,
  herd_details JSONB,
  issued_at TIMESTAMP,
  valid_until DATE,
  notes TEXT,
  revocation_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vet_certs_vet ON vet_certificates(veterinarian_id);
CREATE INDEX IF NOT EXISTS idx_vet_certs_owner ON vet_certificates(pet_owner_id);
CREATE INDEX IF NOT EXISTS idx_vet_certs_animal ON vet_certificates(animal_id);
CREATE INDEX IF NOT EXISTS idx_vet_certs_type ON vet_certificates(certificate_type);
CREATE INDEX IF NOT EXISTS idx_vet_certs_status ON vet_certificates(status);

DROP TRIGGER IF EXISTS update_vet_certificates_updated_at ON vet_certificates;
CREATE TRIGGER update_vet_certificates_updated_at BEFORE UPDATE ON vet_certificates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ENTERPRISE TABLES - Triggers & Indexes
-- ============================================================
DROP TRIGGER IF EXISTS update_enterprises_updated_at ON enterprises;
CREATE TRIGGER update_enterprises_updated_at BEFORE UPDATE ON enterprises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_enterprise_members_updated_at ON enterprise_members;
CREATE TRIGGER update_enterprise_members_updated_at BEFORE UPDATE ON enterprise_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_animal_groups_updated_at ON animal_groups;
CREATE TRIGGER update_animal_groups_updated_at BEFORE UPDATE ON animal_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_locations_updated_at ON locations;
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_treatment_campaigns_updated_at ON treatment_campaigns;
CREATE TRIGGER update_treatment_campaigns_updated_at BEFORE UPDATE ON treatment_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_enterprises_owner_id ON enterprises(owner_id);
CREATE INDEX IF NOT EXISTS idx_enterprises_is_active ON enterprises(is_active);
CREATE INDEX IF NOT EXISTS idx_enterprise_members_enterprise_id ON enterprise_members(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_members_user_id ON enterprise_members(user_id);
CREATE INDEX IF NOT EXISTS idx_animal_groups_enterprise_id ON animal_groups(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_locations_enterprise_id ON locations(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_locations_parent ON locations(parent_location_id);
CREATE INDEX IF NOT EXISTS idx_movement_records_enterprise_id ON movement_records(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_movement_records_animal_id ON movement_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_treatment_campaigns_enterprise_id ON treatment_campaigns(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_treatment_campaigns_status ON treatment_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_animals_enterprise_id ON animals(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_animals_group_id ON animals(group_id);
CREATE INDEX IF NOT EXISTS idx_animals_status ON animals(status);

-- ============================================================
-- HOSPITAL NETWORK TABLES (Phase 1 - Clinical Domain)
-- NOTE: Completely separate from farm enterprises table.
--       enterprises = farm domain, hospital_networks = clinical domain.
-- ============================================================

-- 36. HOSPITAL NETWORKS (corporate umbrella entities)
-- 37. HOSPITAL NETWORK MEMBERS(corporate staff: corporate_admin, hospital_director, auditor)
CREATE TABLE IF NOT EXISTS hospital_network_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  network_role VARCHAR(50) NOT NULL DEFAULT 'hospital_staff'
    CHECK (network_role IN ('corporate_admin', 'hospital_director', 'auditor', 'compliance_officer', 'hospital_staff')),
  hospital_id UUID,
  is_active BOOLEAN DEFAULT true,
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP,
  UNIQUE(network_id, user_id)
);

-- 38b. HOSPITAL NETWORK HOSPITALS (many-to-many: networks ↔ branch hospitals)
CREATE TABLE IF NOT EXISTS hospital_network_hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
  hospital_id UUID NOT NULL REFERENCES vet_hospitals(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(network_id, hospital_id)
);

CREATE INDEX IF NOT EXISTS idx_hn_hospitals_network_id ON hospital_network_hospitals(network_id);
CREATE INDEX IF NOT EXISTS idx_hn_hospitals_hospital_id ON hospital_network_hospitals(hospital_id);

-- 38. HOSPITAL NETWORK FEATURE FLAGS (per-network feature toggles)
CREATE TABLE IF NOT EXISTS hospital_network_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(network_id, feature_key)
);

-- Network Security Audit Log
CREATE TABLE IF NOT EXISTS network_security_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(255),
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nsa_network ON network_security_audit(network_id);
CREATE INDEX IF NOT EXISTS idx_nsa_actor ON network_security_audit(actor_id);
CREATE INDEX IF NOT EXISTS idx_nsa_action ON network_security_audit(action);
CREATE INDEX IF NOT EXISTS idx_nsa_created ON network_security_audit(created_at DESC);

-- 39. ANIMAL CARE CONTEXTS(dual-ID patient linking: platform VC-ID + corporate patient ID)
-- Represents an animal being treated in the context of a specific hospital network.
-- An animal can have multiple contexts (different networks they've been treated at).
CREATE TABLE IF NOT EXISTS animal_care_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
  hospital_id UUID,
  platform_unique_id VARCHAR(20),
  corporate_patient_id VARCHAR(100),
  visibility VARCHAR(20) NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'network_only', 'treating_vet_only')),
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  enrolled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  enrollment_status VARCHAR(20) NOT NULL DEFAULT 'pending_consent'
    CHECK (enrollment_status IN ('pending_consent', 'active', 'declined', 'revoked')),
  enrollment_requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  enrollment_responded_at TIMESTAMP,
  UNIQUE(animal_id, network_id)
);

-- 40. PATIENT DATA CONSENT (granular 6-dimension consent record)
-- What data can be shared, with whom, for how long, what actions, whether hospital records included.
CREATE TABLE IF NOT EXISTS patient_data_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Who can access
  granted_to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  granted_to_hospital_id UUID,
  granted_to_network_id UUID REFERENCES hospital_networks(id) ON DELETE CASCADE,
  -- What data
  consent_scope VARCHAR(50) NOT NULL DEFAULT 'basic_history'
    CHECK (consent_scope IN ('basic_history', 'full_history', 'emergency_only', 'custom')),
  allow_medical_records BOOLEAN DEFAULT true,
  allow_vaccination_records BOOLEAN DEFAULT true,
  allow_prescriptions BOOLEAN DEFAULT true,
  allow_lab_results BOOLEAN DEFAULT false,
  allow_genetic_data BOOLEAN DEFAULT false,
  -- Whether hospital/network-scoped records are included (explicit opt-in, defaults false)
  include_hospital_records BOOLEAN DEFAULT false,
  -- Allowed actions
  allow_view BOOLEAN DEFAULT true,
  allow_create_notes BOOLEAN DEFAULT false,
  allow_prescribe BOOLEAN DEFAULT false,
  -- Duration
  valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  revoked_at TIMESTAMP,
  revoked_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 41. CLINICAL DATA ACCESS LOG (immutable audit trail - append only, never delete)
-- Every access to hospital-scoped clinical records is logged here.
-- Corporate admin, hospital director access is ALWAYS logged.
CREATE TABLE IF NOT EXISTS clinical_data_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who accessed
  accessed_by UUID NOT NULL REFERENCES users(id),
  accessor_role VARCHAR(50) NOT NULL,
  accessor_network_id UUID REFERENCES hospital_networks(id),
  -- What was accessed
  animal_id UUID REFERENCES animals(id),
  record_type VARCHAR(50) NOT NULL,
  record_id UUID,
  -- Context
  access_type VARCHAR(30) NOT NULL
    CHECK (access_type IN ('view', 'search', 'export', 'print', 'api_call', 'audit')),
  consent_id UUID REFERENCES patient_data_consent(id),
  ip_address INET,
  user_agent TEXT,
  -- Outcome
  access_granted BOOLEAN NOT NULL,
  denial_reason TEXT,
  accessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  -- NOTE: No updated_at - this table is append-only, never update or delete rows
);

-- 41b. NETWORK REFERRALS (inter-hospital referrals and patient transfers within a network)
CREATE TABLE IF NOT EXISTS network_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID REFERENCES hospital_networks(id) ON DELETE SET NULL,
  from_hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE SET NULL,
  to_hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE SET NULL,
  from_vet_id UUID REFERENCES users(id) ON DELETE SET NULL,
  to_vet_id UUID REFERENCES users(id) ON DELETE SET NULL,
  animal_id UUID REFERENCES animals(id) ON DELETE CASCADE,
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'emergency')),
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
  clinical_notes TEXT,
  response_notes TEXT,
  referral_type VARCHAR(20) DEFAULT 'referral' CHECK (referral_type IN ('referral', 'transfer')),
  transfer_reason TEXT,
  transferred_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_network_referrals_network_id ON network_referrals(network_id);
CREATE INDEX IF NOT EXISTS idx_network_referrals_to_hospital ON network_referrals(to_hospital_id, status);
CREATE INDEX IF NOT EXISTS idx_network_referrals_animal ON network_referrals(animal_id);
CREATE INDEX IF NOT EXISTS idx_network_referrals_consultation_id ON network_referrals(consultation_id);

-- Indexes for hospital network tables
CREATE INDEX IF NOT EXISTS idx_hospital_networks_is_active ON hospital_networks(is_active);
CREATE INDEX IF NOT EXISTS idx_hospital_networks_is_approved ON hospital_networks(is_approved);
CREATE INDEX IF NOT EXISTS idx_hospital_network_members_network ON hospital_network_members(network_id);
CREATE INDEX IF NOT EXISTS idx_hospital_network_members_user ON hospital_network_members(user_id);
CREATE INDEX IF NOT EXISTS idx_hospital_network_members_role ON hospital_network_members(network_role);
CREATE INDEX IF NOT EXISTS idx_animal_care_contexts_animal ON animal_care_contexts(animal_id);
CREATE INDEX IF NOT EXISTS idx_animal_care_contexts_network ON animal_care_contexts(network_id);
CREATE INDEX IF NOT EXISTS idx_patient_consent_animal ON patient_data_consent(animal_id);
CREATE INDEX IF NOT EXISTS idx_patient_consent_owner ON patient_data_consent(owner_id);
CREATE INDEX IF NOT EXISTS idx_patient_consent_active ON patient_data_consent(is_active);
CREATE INDEX IF NOT EXISTS idx_clinical_access_log_animal ON clinical_data_access_log(animal_id);
CREATE INDEX IF NOT EXISTS idx_clinical_access_log_accessor ON clinical_data_access_log(accessed_by);
CREATE INDEX IF NOT EXISTS idx_clinical_access_log_network ON clinical_data_access_log(accessor_network_id);
CREATE INDEX IF NOT EXISTS idx_clinical_access_log_time ON clinical_data_access_log(accessed_at);
-- P6-APPROVAL: Network approval workflow event log
CREATE TABLE IF NOT EXISTS network_approval_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'submitted','under_review','info_requested','info_provided','approved','rejected','suspended','reactivated'
  )),
  actor_id UUID NOT NULL REFERENCES users(id),
  actor_role VARCHAR(50) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_network_approval_network_id ON network_approval_events(network_id);

DROP TRIGGER IF EXISTS update_hospital_networks_updated_at ON hospital_networks;
CREATE TRIGGER update_hospital_networks_updated_at BEFORE UPDATE ON hospital_networks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patient_consent_updated_at ON patient_data_consent;
CREATE TRIGGER update_patient_consent_updated_at BEFORE UPDATE ON patient_data_consent
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 40b. HOSPITAL PATIENT INVITES (walk-in patients without platform accounts)
-- NOTE: Placed here (after hospital_networks) to resolve forward-reference dependency
CREATE TABLE IF NOT EXISTS hospital_patient_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE SET NULL,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_name VARCHAR(200) NOT NULL,
  patient_email VARCHAR(255) NOT NULL,
  patient_phone VARCHAR(30),
  animal_name VARCHAR(100),
  animal_species VARCHAR(50),
  invite_token VARCHAR(128) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  message TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '72 hours'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hosp_patient_invites_token ON hospital_patient_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_hosp_patient_invites_email ON hospital_patient_invites(patient_email);
CREATE INDEX IF NOT EXISTS idx_hosp_patient_invites_network ON hospital_patient_invites(network_id);

-- ============================================================
-- 42. ROLE CHANGE REQUESTS (user-initiated role upgrade/change with admin approval)
-- ============================================================
CREATE TABLE IF NOT EXISTS role_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "current_role" VARCHAR(50) NOT NULL,
    requested_role VARCHAR(50) NOT NULL,
    reason TEXT,
    -- Role-specific details captured at request time (e.g. vet license_number,
    -- specializations, fee) so an admin can review + provision the satellite profile
    -- (vet_profiles) in one approval step. See migration 027.
    profile_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rcr_user_id ON role_change_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_rcr_status ON role_change_requests(status);

DROP TRIGGER IF EXISTS update_role_change_requests_updated_at ON role_change_requests;
CREATE TRIGGER update_role_change_requests_updated_at BEFORE UPDATE ON role_change_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 43. NETWORK SUBSCRIPTION PLANS (platform admin defines tiers)
-- ============================================================
CREATE TABLE IF NOT EXISTS network_subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  max_seats INTEGER,
  max_hospitals INTEGER,
  price_monthly DECIMAL(10,2),
  price_annually DECIMAL(10,2),
  currency VARCHAR(10) DEFAULT 'INR',
  features JSONB DEFAULT '{}',
  is_published BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nsp_is_published ON network_subscription_plans(is_published);
CREATE INDEX IF NOT EXISTS idx_nsp_is_active ON network_subscription_plans(is_active);
DROP TRIGGER IF EXISTS update_nsp_updated_at ON network_subscription_plans;
CREATE TRIGGER update_nsp_updated_at BEFORE UPDATE ON network_subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 44. NETWORK SUBSCRIPTIONS (links a network to its plan + tracks seat usage)
-- ============================================================
CREATE TABLE IF NOT EXISTS network_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES network_subscription_plans(id) ON DELETE SET NULL,
  seat_limit INTEGER NOT NULL DEFAULT 5,
  status VARCHAR(20) NOT NULL DEFAULT 'trial'
    CHECK (status IN ('trial', 'active', 'suspended', 'expired', 'cancelled')),
  billing_cycle VARCHAR(20) DEFAULT 'none'
    CHECK (billing_cycle IN ('monthly', 'annually', 'custom', 'none')),
  starts_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMP,
  suspended_at TIMESTAMP,
  suspended_by UUID REFERENCES users(id) ON DELETE SET NULL,
  suspension_reason TEXT,
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(network_id)
);
CREATE INDEX IF NOT EXISTS idx_ns_network_id ON network_subscriptions(network_id);
CREATE INDEX IF NOT EXISTS idx_ns_status ON network_subscriptions(status);
DROP TRIGGER IF EXISTS update_ns_updated_at ON network_subscriptions;
CREATE TRIGGER update_ns_updated_at BEFORE UPDATE ON network_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 45. HOSPITAL STAFF INVITES (invite-only registration for non-vet staff)
-- ============================================================
CREATE TABLE IF NOT EXISTS hospital_staff_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE SET NULL,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_email VARCHAR(255) NOT NULL,
  -- Nullable by design - the invite form labels this field "(optional)". database.ts's startup
  -- self-heal has always run `ALTER COLUMN invitee_name DROP NOT NULL`, so deployed DBs are
  -- already nullable; this used to say NOT NULL and was silently undone on every boot.
  invitee_name VARCHAR(200),
  staff_position VARCHAR(50) NOT NULL
    CHECK (staff_position IN (
      'nurse','technician','receptionist','lab_tech',
      'radiologist','anesthesiologist','pharmacist','intern','admin_staff'
    )),
  invite_token VARCHAR(128) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '72 hours'),
  accepted_at TIMESTAMPTZ,
  accepted_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hsi_network_id ON hospital_staff_invites(network_id);
CREATE INDEX IF NOT EXISTS idx_hsi_token ON hospital_staff_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_hsi_email ON hospital_staff_invites(invitee_email);
CREATE INDEX IF NOT EXISTS idx_hsi_status ON hospital_staff_invites(status);
DROP TRIGGER IF EXISTS update_hsi_updated_at ON hospital_staff_invites;
CREATE TRIGGER update_hsi_updated_at BEFORE UPDATE ON hospital_staff_invites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- NETWORK CUSTOM ROLES (Dynamic per-network role definitions)
-- ============================================================
CREATE TABLE IF NOT EXISTS network_custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
  role_key VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  base_template VARCHAR(50) NOT NULL DEFAULT 'hospital_staff'
    CHECK (base_template IN ('corporate_admin','hospital_director','compliance_officer','auditor','hospital_staff')),
  icon VARCHAR(10) DEFAULT '👤',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(network_id, role_key)
);
CREATE INDEX IF NOT EXISTS idx_ncr_network ON network_custom_roles(network_id);
CREATE INDEX IF NOT EXISTS idx_ncr_role_key ON network_custom_roles(network_id, role_key);
DROP TRIGGER IF EXISTS update_ncr_updated_at ON network_custom_roles;
CREATE TRIGGER update_ncr_updated_at BEFORE UPDATE ON network_custom_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- STAFF LEAVE REQUESTS (Holiday/Leave Management)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID REFERENCES hospital_networks(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type VARCHAR(30) NOT NULL DEFAULT 'annual'
    CHECK (leave_type IN ('annual', 'sick', 'personal', 'maternity', 'paternity', 'unpaid', 'training', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leave_requests_network ON staff_leave_requests(network_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON staff_leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_hospital ON staff_leave_requests(hospital_id);

-- ─── Marketplace core tables ─────────────────────────────────────────────
-- FIX: these were only ever defined in backend/migrations/008_tier4_features.sql
-- and never backported here, so listing_boosts/marketplace_inquiries/
-- marketplace_transactions below (which FK-reference marketplace_listings)
-- made init.sql fail on any truly fresh database - rolling back the ENTIRE
-- script (incl. users/bookings/payments) since it runs as one implicit
-- transaction. Mirrors migration 008 lines 81-134 exactly (idempotent).
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
  -- Animal attributes (also added idempotently by migration 008); required here because the
  -- idx_mp_listings_fts full-text index below references breed/species, and init.sql runs
  -- atomically BEFORE migrations on a fresh DB - omitting them aborts the entire schema build.
  species VARCHAR(60),
  breed VARCHAR(100),
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
-- Deal-workflow columns (mirrors backend/migrations/015_marketplace_deal_workflow.sql).
-- Marketplace is a free classifieds board: money settles off-platform (PA rules
-- prohibit live-animal payments), so orders act as reservations completed by a
-- two-sided confirmation handshake.
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

-- ─── Marketplace engagement (Phase 3) - mirrors backend/migrations/016_marketplace_engagement.sql ───
-- Buyer<->seller messaging threads, favorites/watchlist, saved searches with alerts.
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
CREATE TABLE IF NOT EXISTS marketplace_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, listing_id)
);
CREATE INDEX IF NOT EXISTS idx_mp_favorites_user ON marketplace_favorites(user_id);
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
-- Phase 4: optional listing video (mirrors backend/migrations/017_marketplace_video.sql)
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS video_url VARCHAR(2000);
-- Species-correct animal class terms (mirrors backend/migrations/020_animal_class_terms.sql)
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS animal_class VARCHAR(30);
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS state VARCHAR(80);
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS district VARCHAR(80);
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);
CREATE INDEX IF NOT EXISTS idx_mp_listings_state_district ON marketplace_listings (state, district);
CREATE INDEX IF NOT EXISTS idx_mp_listings_pincode ON marketplace_listings (pincode);

-- Seller phone shown on tap; every tap logged (daily cap per viewer, "who viewed my number" for the seller)
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
-- Phase 5: reports + full-text index (mirrors backend/migrations/018_marketplace_trust_discovery.sql)
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_reports_unique_open
  ON marketplace_reports(listing_id, reporter_id) WHERE status IN ('open', 'reviewing');
CREATE INDEX IF NOT EXISTS idx_mp_listings_fts ON marketplace_listings
  USING GIN (to_tsvector('english',
    coalesce(title,'') || ' ' || coalesce(description,'') || ' ' ||
    coalesce(breed,'') || ' ' || coalesce(species,'')));

-- ─── Marketplace monetization tables (canonical schema) ─────────────────────
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
-- 46. USER ROLES (secondary roles - additive, does not replace users.role)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('pet_owner','farmer','veterinarian','admin','corporate_admin','hospital_staff','pharmacist','groomer','support')),
  is_primary BOOLEAN DEFAULT false,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE(user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- Missing FK indexes added by code scan
CREATE INDEX IF NOT EXISTS idx_animals_current_location_id ON animals(current_location_id);
CREATE INDEX IF NOT EXISTS idx_animals_dam_id ON animals(dam_id);
CREATE INDEX IF NOT EXISTS idx_animals_sire_id ON animals(sire_id);
CREATE INDEX IF NOT EXISTS idx_workflow_cases_queue_entry_id ON workflow_cases(queue_entry_id);
CREATE INDEX IF NOT EXISTS idx_inpatient_admissions_case_id ON inpatient_admissions(case_id);
CREATE INDEX IF NOT EXISTS idx_referrals_case_id ON referrals(case_id);
CREATE INDEX IF NOT EXISTS idx_referrals_from_vet_id ON referrals(from_vet_id);
CREATE INDEX IF NOT EXISTS idx_referrals_to_vet_id ON referrals(to_vet_id);
CREATE INDEX IF NOT EXISTS idx_referrals_animal_id ON referrals(animal_id);
CREATE INDEX IF NOT EXISTS idx_network_referrals_from_vet ON network_referrals(from_vet_id);
CREATE INDEX IF NOT EXISTS idx_network_referrals_to_vet ON network_referrals(to_vet_id);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_transitioned_by ON workflow_transitions(transitioned_by);

-- Link platform referrals ↔ network referrals (P4-MED2)
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS network_referral_id UUID REFERENCES network_referrals(id) ON DELETE SET NULL;
ALTER TABLE network_referrals ADD COLUMN IF NOT EXISTS platform_referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL;


-- 44. DISPUTES (user-submitted dispute resolution)
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  dispute_type VARCHAR(50) NOT NULL CHECK (dispute_type IN ('billing', 'service_quality', 'no_show', 'data_privacy', 'other')),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed', 'escalated')),
  resolution TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_disputes_reported_by ON disputes(reported_by);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

-- ============================================================
-- 45. PHARMACY MODULE
-- ============================================================

-- 45.1 Hospital Pharmacies (per-hospital pharmacy entity)
CREATE TABLE IF NOT EXISTS hospital_pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE SET NULL,
  pharmacy_name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  license_number VARCHAR(100),
  gstin VARCHAR(20),
  operating_hours JSONB DEFAULT '{}',
  is_primary_pharmacy BOOLEAN DEFAULT false,
  is_accepting_requests BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hospital_pharmacies_network ON hospital_pharmacies(network_id);
CREATE INDEX IF NOT EXISTS idx_hospital_pharmacies_hospital ON hospital_pharmacies(hospital_id);

-- 45.2 Pharmacy Suppliers
CREATE TABLE IF NOT EXISTS pharmacy_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(200),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  is_approved BOOLEAN DEFAULT true,
  payment_terms VARCHAR(100),
  lead_time_days INTEGER DEFAULT 7,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_suppliers_network ON pharmacy_suppliers(network_id);

-- 45.3 Pharmacy Medications (master catalog per network)
CREATE TABLE IF NOT EXISTS pharmacy_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  generic_name VARCHAR(255),
  form VARCHAR(50) DEFAULT 'tablet' CHECK (form IN ('tablet','capsule','syrup','injection','ointment','drops','powder','spray','other')),
  strength VARCHAR(100),
  unit VARCHAR(50) DEFAULT 'unit',
  supplier_id UUID REFERENCES pharmacy_suppliers(id) ON DELETE SET NULL,
  unit_cost DECIMAL(10,2) DEFAULT 0,
  selling_price DECIMAL(10,2) DEFAULT 0,
  min_stock_level INTEGER DEFAULT 10,
  max_stock_level INTEGER DEFAULT 500,
  reorder_point INTEGER DEFAULT 20,
  reorder_quantity INTEGER DEFAULT 100,
  contraindications TEXT[],
  side_effects TEXT[],
  common_interactions TEXT[],
  manufacturer VARCHAR(255),
  registration_number VARCHAR(100),
  is_controlled BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_medications_network ON pharmacy_medications(network_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_medications_supplier ON pharmacy_medications(supplier_id);

-- 45.4 Pharmacy Reorder Requests (before inventory due to FK)
CREATE TABLE IF NOT EXISTS pharmacy_reorder_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES hospital_pharmacies(id) ON DELETE CASCADE,
  med_id UUID NOT NULL REFERENCES pharmacy_medications(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES pharmacy_suppliers(id) ON DELETE SET NULL,
  requested_qty INTEGER NOT NULL DEFAULT 0,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  triggered_by VARCHAR(20) DEFAULT 'manual' CHECK (triggered_by IN ('manual','auto_threshold')),
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','sent_to_supplier','confirmed','shipped','received','cancelled')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  tracking_number VARCHAR(200),
  expected_delivery_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reorder_requests_pharmacy ON pharmacy_reorder_requests(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_reorder_requests_med ON pharmacy_reorder_requests(med_id);
CREATE INDEX IF NOT EXISTS idx_reorder_requests_status ON pharmacy_reorder_requests(status);

-- 45.5 Pharmacy Inventory (batch-level stock tracking)
CREATE TABLE IF NOT EXISTS pharmacy_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES hospital_pharmacies(id) ON DELETE CASCADE,
  med_id UUID NOT NULL REFERENCES pharmacy_medications(id) ON DELETE CASCADE,
  batch_number VARCHAR(100),
  quantity INTEGER NOT NULL DEFAULT 0,
  unit VARCHAR(50) DEFAULT 'unit',
  expiry_date DATE,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  received_from VARCHAR(255),
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  location_code VARCHAR(50),
  shipment_request_id UUID REFERENCES pharmacy_reorder_requests(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_pharmacy ON pharmacy_inventory(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_med ON pharmacy_inventory(med_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_expiry ON pharmacy_inventory(expiry_date);

-- 45.6 Stock Adjustments (audit trail)
CREATE TABLE IF NOT EXISTS pharmacy_stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES hospital_pharmacies(id) ON DELETE CASCADE,
  med_id UUID NOT NULL REFERENCES pharmacy_medications(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES pharmacy_inventory(id) ON DELETE SET NULL,
  batch_number VARCHAR(100),
  adjustment_qty INTEGER NOT NULL,
  adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('add','remove','dispense','correct','expire','damage','return')),
  reason TEXT,
  evidence_url TEXT,
  adjusted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  adjusted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_pharmacy ON pharmacy_stock_adjustments(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_med ON pharmacy_stock_adjustments(med_id);

-- 45.7 Prescription Reviews
CREATE TABLE IF NOT EXISTS prescription_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  pharmacist_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  review_status VARCHAR(30) NOT NULL CHECK (review_status IN ('approved','rejected','needs_clarification')),
  validation_checks JSONB DEFAULT '{"dosage_ok":false,"allergy_ok":false,"interaction_ok":false,"stock_ok":false}',
  findings TEXT[],
  suggested_modifications TEXT,
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prescription_reviews_prescription ON prescription_reviews(prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_reviews_pharmacist ON prescription_reviews(pharmacist_id);

-- 45.8 Dispensing Records
CREATE TABLE IF NOT EXISTS dispensing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  pharmacy_id UUID NOT NULL REFERENCES hospital_pharmacies(id) ON DELETE RESTRICT,
  pharmacist_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  dispensing_method VARCHAR(30) DEFAULT 'walk_in_pickup' CHECK (dispensing_method IN ('walk_in_pickup','home_delivery','courier','hospital_pickup')),
  dispensing_status VARCHAR(20) DEFAULT 'pending' CHECK (dispensing_status IN ('pending','prepared','handed_over','delivered','cancelled')),
  total_cost DECIMAL(10,2) DEFAULT 0,
  prepared_at TIMESTAMPTZ,
  handed_over_at TIMESTAMPTZ,
  received_by VARCHAR(200),
  signature_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dispensing_records_prescription ON dispensing_records(prescription_id);
CREATE INDEX IF NOT EXISTS idx_dispensing_records_pharmacy ON dispensing_records(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_dispensing_records_status ON dispensing_records(dispensing_status);

-- 45.9 Dispensing Line Items
CREATE TABLE IF NOT EXISTS dispensing_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispensing_record_id UUID NOT NULL REFERENCES dispensing_records(id) ON DELETE CASCADE,
  med_id UUID NOT NULL REFERENCES pharmacy_medications(id) ON DELETE RESTRICT,
  inventory_id UUID REFERENCES pharmacy_inventory(id) ON DELETE SET NULL,
  batch_number VARCHAR(100),
  quantity_dispensed INTEGER NOT NULL DEFAULT 0,
  unit VARCHAR(50) DEFAULT 'unit',
  unit_price DECIMAL(10,2) DEFAULT 0,
  line_total DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dispensing_line_items_record ON dispensing_line_items(dispensing_record_id);
CREATE INDEX IF NOT EXISTS idx_dispensing_line_items_med ON dispensing_line_items(med_id);

-- 45.10 Pharmacy Medication Requests (inter-hospital transfers)
CREATE TABLE IF NOT EXISTS pharmacy_medication_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
  source_hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE SET NULL,
  destination_hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE SET NULL,
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  requested_medications JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','accepted','preparing','shipped','received','fulfilled','declined')),
  tracking_number VARCHAR(200),
  fulfilled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decline_reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_med_requests_network ON pharmacy_medication_requests(source_network_id);
CREATE INDEX IF NOT EXISTS idx_med_requests_status ON pharmacy_medication_requests(status);

-- 45.11 ALTER prescriptions: add pharmacy workflow fields
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS review_status VARCHAR(30) DEFAULT 'pending_review' CHECK (review_status IN ('pending_review','reviewed','rejected','approved_for_dispensing','dispensed','needs_clarification'));
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS is_network_coordinated BOOLEAN DEFAULT false;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS target_pharmacy_id UUID REFERENCES hospital_pharmacies(id) ON DELETE SET NULL;

-- Seed auction_enabled feature flag (disabled by default - legal review pending)
INSERT INTO marketplace_monetization_settings (setting_key, is_enabled, description, category)
VALUES ('auction_enabled', false, 'Enable or disable the auction feature platform-wide', 'feature')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- 46. PAYMENT MODULE (docs/PAYMENT_MODULE_PLAN.md - Phase P0)
-- Mirrors backend/migrations/012_payment_module.sql. Idempotent.
-- ============================================================

-- 46.1 payments: gateway + commission + fee-recovery columns
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_payment_id VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_fee_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS commission_percent DECIMAL(5,2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS commission_flat DECIMAL(10,2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS doctor_earning_amount DECIMAL(10,2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS wallet_amount_used DECIMAL(10,2) DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS processing_charge_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_destination VARCHAR(20)
  CHECK (refund_destination IN ('wallet', 'gateway'));
ALTER TABLE payments ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_status_check') THEN
    ALTER TABLE payments DROP CONSTRAINT payments_status_check;
  END IF;
  ALTER TABLE payments ADD CONSTRAINT payments_status_check
    CHECK (status IN ('pending', 'processing', 'created', 'completed', 'failed',
                      'refunded', 'partially_refunded', 'expired', 'transferred'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE payments ALTER COLUMN currency SET DEFAULT 'INR';
ALTER TABLE payments ALTER COLUMN gateway SET DEFAULT 'demo';
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
-- (idx_payments_status already created earlier in this file - see the
-- "FIX: bookings status CHECK" era section above)

-- 46.2 bookings: payment lifecycle statuses + booking_type fix
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_status_check') THEN
    ALTER TABLE bookings DROP CONSTRAINT bookings_status_check;
  END IF;
  ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rescheduled', 'completed',
                      'missed', 'payment_pending', 'payment_expired', 'referred'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_booking_type_check') THEN
    ALTER TABLE bookings DROP CONSTRAINT bookings_booking_type_check;
  END IF;
  ALTER TABLE bookings ADD CONSTRAINT bookings_booking_type_check
    CHECK (booking_type IN ('video_call', 'in_person', 'phone', 'chat',
                            'farm_visit', 'herd_consultation'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 46.3 vet_profiles: commission overrides, emergency fee, GST + payout details
ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS commission_percent_override DECIMAL(5,2);
ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS commission_flat_override DECIMAL(10,2);
ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS emergency_consultation_fee DECIMAL(10,2);
ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS gstin VARCHAR(20);
ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS payout_account_name VARCHAR(255);
ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS payout_account_number VARCHAR(50);
ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS payout_ifsc VARCHAR(20);
ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS payout_upi VARCHAR(100);
ALTER TABLE vet_profiles ALTER COLUMN currency SET DEFAULT 'INR';

-- 46.4 wallets: INR default
ALTER TABLE wallets ALTER COLUMN currency SET DEFAULT 'INR';

-- 46.5 referrals: platform referral + payment transfer support
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referral_type VARCHAR(20) NOT NULL DEFAULT 'hospital'
  CHECK (referral_type IN ('hospital', 'platform'));
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS transfer_status VARCHAR(20)
  CHECK (transfer_status IN ('offered', 'accepted', 'rechosen', 'refunded', 'expired', 'completed'));
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS action_deadline TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_referrals_booking ON referrals(booking_id);

-- 46.6 payment_events: append-only audit + webhook idempotency
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  gateway_event_id VARCHAR(255) UNIQUE,
  event_type VARCHAR(50) NOT NULL,
  from_status VARCHAR(30),
  to_status VARCHAR(30),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  payload JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment ON payment_events(payment_id);

-- 46.7 withdrawal_requests
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount DECIMAL(10,2) NOT NULL,
  tds_rate DECIMAL(5,2) DEFAULT 0,
  tds_amount DECIMAL(10,2) DEFAULT 0,
  net_paid_amount DECIMAL(10,2),
  status VARCHAR(20) NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'rejected', 'settled', 'cancelled')),
  is_discretionary BOOLEAN NOT NULL DEFAULT false,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  settled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  settled_at TIMESTAMP,
  utr_reference VARCHAR(100),
  admin_note TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_doctor ON withdrawal_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawal_requests(status);

-- 46.8 doctor_earnings ledger
CREATE TABLE IF NOT EXISTS doctor_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  gross_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_amount DECIMAL(10,2) NOT NULL,
  type VARCHAR(30) NOT NULL
    CHECK (type IN ('consultation', 'cancel_compensation', 'no_show_compensation', 'penalty', 'adjustment')),
  status VARCHAR(20) NOT NULL DEFAULT 'clearing'
    CHECK (status IN ('clearing', 'available', 'locked', 'withdrawn', 'reversed')),
  reason TEXT,
  clear_at TIMESTAMP,
  withdrawal_id UUID REFERENCES withdrawal_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_doctor_earnings_doctor ON doctor_earnings(doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_doctor_earnings_clear ON doctor_earnings(status, clear_at);

-- 46.9 tax_codes: SAC master (admin-editable rates)
CREATE TABLE IF NOT EXISTS tax_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sac_code VARCHAR(20) UNIQUE NOT NULL,
  label VARCHAR(255) NOT NULL,
  rate_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tax_codes (id, sac_code, label, rate_percent, is_active) VALUES
  (gen_random_uuid(), '998351', 'Veterinary services for pet animals (GST-exempt healthcare)', 0, true),
  (gen_random_uuid(), '998352', 'Veterinary services for livestock (GST-exempt healthcare)', 0, true),
  (gen_random_uuid(), '998599', 'Platform facilitation / commission services', 18, true),
  (gen_random_uuid(), '300490', 'Pharmacy - dispensed veterinary medicaments (HSN 3004)', 12, true)
ON CONFLICT (sac_code) DO NOTHING;

-- 46.10 invoices: immutable snapshots
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  invoice_type VARCHAR(30) NOT NULL
    CHECK (invoice_type IN ('consultation', 'commission', 'pharmacy', 'grooming', 'grooming_credit_note')),
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  withdrawal_id UUID REFERENCES withdrawal_requests(id) ON DELETE SET NULL,
  issuer_details JSONB NOT NULL DEFAULT '{}',
  recipient_details JSONB NOT NULL DEFAULT '{}',
  line_items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  sac_code VARCHAR(20),
  tax_rate DECIMAL(5,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'INR',
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_invoices_payment ON invoices(payment_id);

-- 46.11 legal_documents: versioned policies
CREATE TABLE IF NOT EXISTS legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type VARCHAR(30) NOT NULL
    CHECK (doc_type IN ('terms', 'privacy', 'refund_policy', 'wallet_terms',
                        'doctor_agreement', 'grievance_policy', 'disclaimer')),
  version INTEGER NOT NULL DEFAULT 1,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  requires_reacceptance BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (doc_type, version)
);
CREATE INDEX IF NOT EXISTS idx_legal_docs_type ON legal_documents(doc_type, is_active);

-- 46.12 user_policy_acceptances: provable consent
CREATE TABLE IF NOT EXISTS user_policy_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  doc_type VARCHAR(30) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  context VARCHAR(30) NOT NULL DEFAULT 'registration'
    CHECK (context IN ('registration', 'invite', 'login_reacceptance', 'payout_setup')),
  ip_address VARCHAR(64),
  user_agent TEXT,
  accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_policy_accept_user ON user_policy_acceptances(user_id, doc_type);

-- 46.12b placeholder v1 policy documents (admin publishes real content later)
INSERT INTO legal_documents (id, doc_type, version, title, content, requires_reacceptance, is_active) VALUES
  (gen_random_uuid(), 'terms', 1, 'Terms of Service', 'Placeholder Terms of Service. The platform acts as merchant of record for consultation services; veterinarians provide services under a separate service-provider agreement. Replace this text with the lawyer-approved Terms of Service before production go-live.', false, true),
  (gen_random_uuid(), 'privacy', 1, 'Privacy Policy', 'Placeholder Privacy Policy aligned to the DPDP Act 2023. Replace this text with the lawyer-approved Privacy Policy before production go-live.', false, true),
  (gen_random_uuid(), 'refund_policy', 1, 'Refund & Cancellation Policy', 'Placeholder Refund & Cancellation Policy. Doctor cancellation: full refund plus goodwill bonus. Patient cancellation: full refund minus a cancellation processing charge when cancelled 24 hours or more before the appointment; 50 percent minus the processing charge between 2 and 24 hours; no refund within 2 hours. Replace with the final policy text before go-live.', false, true),
  (gen_random_uuid(), 'wallet_terms', 1, 'Wallet Terms', 'Placeholder Wallet Terms. The wallet is a closed credit usable only on this platform. Wallet balances cannot be withdrawn as cash. Refund-sourced balances never expire and are returned to the original payment method on account closure. Replace with lawyer-approved text before go-live.', false, true),
  (gen_random_uuid(), 'doctor_agreement', 1, 'Doctor Service-Provider Agreement', 'Placeholder Doctor Agreement covering platform commission, settlement clearance windows, cancellation penalties, referral rules and professional responsibility. Replace with the lawyer-approved agreement before production go-live.', false, true),
  (gen_random_uuid(), 'grievance_policy', 1, 'Grievance Redressal Policy', 'Placeholder Grievance Redressal Policy. A named grievance officer and escalation timelines are required under the Consumer Protection (E-Commerce) Rules 2020. Replace with the final policy and officer details before go-live.', false, true),
  (gen_random_uuid(), 'disclaimer', 1, 'Service Disclaimer', 'Placeholder Service Disclaimer. Online consultation is not a substitute for physical emergency veterinary care. In an emergency, visit the nearest veterinary clinic immediately. Replace with the final disclaimer before go-live.', false, true)
ON CONFLICT (doc_type, version) DO NOTHING;

-- 46.13 updated_at triggers
DROP TRIGGER IF EXISTS update_withdrawal_requests_updated_at ON withdrawal_requests;
CREATE TRIGGER update_withdrawal_requests_updated_at BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_doctor_earnings_updated_at ON doctor_earnings;
CREATE TRIGGER update_doctor_earnings_updated_at BEFORE UPDATE ON doctor_earnings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tax_codes_updated_at ON tax_codes;
CREATE TRIGGER update_tax_codes_updated_at BEFORE UPDATE ON tax_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 46.14 payment_gateway_credentials: Razorpay key_id/key_secret/webhook_secret
-- per environment (test/live), key_secret + webhook_secret AES-256-GCM
-- encrypted at rest (backend/src/utils/secretCrypto.ts) - never readable in
-- plaintext via any admin API response (§12 rule 6).
CREATE TABLE IF NOT EXISTS payment_gateway_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment VARCHAR(10) NOT NULL UNIQUE CHECK (environment IN ('test', 'live')),
  key_id VARCHAR(255),
  key_secret_encrypted TEXT,
  webhook_secret_encrypted TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO payment_gateway_credentials (id, environment) VALUES
  (gen_random_uuid(), 'test'),
  (gen_random_uuid(), 'live')
ON CONFLICT (environment) DO NOTHING;

DROP TRIGGER IF EXISTS update_payment_gateway_credentials_updated_at ON payment_gateway_credentials;
CREATE TRIGGER update_payment_gateway_credentials_updated_at BEFORE UPDATE ON payment_gateway_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 47. TIER 2/3/4 ADVANCED FEATURE TABLES
-- ============================================================
-- Backported from backend/migrations/006_tier2_features.sql,
-- 007_tier3_features.sql, 008_tier4_features.sql - these 31 tables existed
-- only as migrations (applied to every live environment already) but were
-- never mirrored into this fresh-install schema, so a brand new DB would
-- 500 the moment any of these features were touched. marketplace_listings/
-- bids/orders/monetization_settings/plans/subscriptions/listing_boosts/
-- inquiries/transactions (9 of migration 008's 19 tables) already exist
-- above (§ marketplace) - not repeated here - but marketplace_listings was
-- still missing the entire livestock/compliance column block from 008,
-- backported separately below since active Marketplace code depends on it.

-- ─── 47.1 Health Observations (006) ───────────────────────────
CREATE TABLE IF NOT EXISTS health_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  animal_id UUID REFERENCES animals(id),
  group_id UUID REFERENCES animal_groups(id),
  observer_id UUID NOT NULL REFERENCES users(id),
  observation_type VARCHAR(50) NOT NULL DEFAULT 'general',
  severity VARCHAR(20) NOT NULL DEFAULT 'normal',
  title VARCHAR(200) NOT NULL,
  description TEXT,
  body_temperature DECIMAL(5,2),
  weight DECIMAL(10,2),
  weight_unit VARCHAR(10) DEFAULT 'kg',
  heart_rate INT,
  respiratory_rate INT,
  body_condition_score INT,
  symptoms TEXT[],
  diagnosis TEXT,
  treatment_given TEXT,
  follow_up_date DATE,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── 47.2 Breeding Records (006) ───────────────────────────────
CREATE TABLE IF NOT EXISTS breeding_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  dam_id UUID REFERENCES animals(id),
  sire_id UUID REFERENCES animals(id),
  breeding_method VARCHAR(50) NOT NULL DEFAULT 'natural',
  breeding_date DATE NOT NULL,
  expected_due_date DATE,
  actual_birth_date DATE,
  gestation_days INT,
  offspring_count INT DEFAULT 0,
  live_births INT DEFAULT 0,
  stillbirths INT DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'bred',
  semen_batch VARCHAR(100),
  technician_id UUID REFERENCES users(id),
  pregnancy_confirmed BOOLEAN DEFAULT false,
  pregnancy_check_date DATE,
  notes TEXT,
  outcome TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── 47.3 Feed Inventory (006) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  location_id UUID REFERENCES locations(id),
  feed_name VARCHAR(200) NOT NULL,
  feed_type VARCHAR(50) NOT NULL DEFAULT 'grain',
  brand VARCHAR(100),
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  current_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
  minimum_stock DECIMAL(12,2) DEFAULT 0,
  cost_per_unit DECIMAL(10,2) DEFAULT 0,
  supplier VARCHAR(200),
  batch_number VARCHAR(100),
  expiry_date DATE,
  storage_location VARCHAR(200),
  nutritional_info JSONB,
  is_active BOOLEAN DEFAULT true,
  last_restocked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── 47.4 Feed Consumption Logs (006) ──────────────────────────
-- feed_consumption_logs: removed by migration 063 - feed given is recorded only in farm_daily_records.

-- ─── 47.5 Compliance Documents (006) ───────────────────────────
CREATE TABLE IF NOT EXISTS compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  document_type VARCHAR(50) NOT NULL,
  title VARCHAR(300) NOT NULL,
  description TEXT,
  reference_number VARCHAR(100),
  issued_date DATE,
  expiry_date DATE,
  issuing_authority VARCHAR(200),
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  related_campaign_id UUID REFERENCES treatment_campaigns(id),
  related_movement_id UUID REFERENCES movement_records(id),
  animal_ids UUID[],
  group_ids UUID[],
  document_data JSONB,
  file_url TEXT,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── 47.6 Financial Records (006) ──────────────────────────────
CREATE TABLE IF NOT EXISTS financial_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  record_type VARCHAR(30) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_id UUID,
  reference_type VARCHAR(50),
  animal_id UUID REFERENCES animals(id),
  group_id UUID REFERENCES animal_groups(id),
  recorded_by UUID NOT NULL REFERENCES users(id),
  payment_method VARCHAR(30),
  vendor VARCHAR(200),
  invoice_number VARCHAR(100),
  receipt_url TEXT,
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── 47.7 Alert Rules (006) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  alert_type VARCHAR(50) NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}',
  severity VARCHAR(20) NOT NULL DEFAULT 'info',
  is_enabled BOOLEAN DEFAULT true,
  check_interval_hours INT DEFAULT 24,
  notification_channels TEXT[] DEFAULT ARRAY['in_app'],
  target_roles TEXT[] DEFAULT ARRAY['owner', 'manager'],
  last_triggered_at TIMESTAMP,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── 47.8 Alert Events (006) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  rule_id UUID REFERENCES alert_rules(id),
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'info',
  title VARCHAR(300) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMP,
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── 47.9 animals: extend with health/breeding fields (006) ────
-- breeding_status/last_breeding_date/expected_due_date/current_weight/
-- weight_unit/last_weighed_at/dam_id/sire_id/animal_class already exist
-- above in the main animals CREATE TABLE - only birth_weight/health_score
-- were actually missing.
ALTER TABLE animals ADD COLUMN IF NOT EXISTS birth_weight DECIMAL(10,2);
ALTER TABLE animals ADD COLUMN IF NOT EXISTS health_score INT DEFAULT 100;

CREATE INDEX IF NOT EXISTS idx_health_obs_enterprise ON health_observations(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_health_obs_animal ON health_observations(animal_id);
CREATE INDEX IF NOT EXISTS idx_health_obs_type ON health_observations(observation_type);
CREATE INDEX IF NOT EXISTS idx_breeding_enterprise ON breeding_records(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_breeding_dam ON breeding_records(dam_id);
CREATE INDEX IF NOT EXISTS idx_breeding_status ON breeding_records(status);
CREATE INDEX IF NOT EXISTS idx_feed_inv_enterprise ON feed_inventory(enterprise_id);
-- CREATE INDEX IF NOT EXISTS idx_feed_log_enterprise ON feed_consumption_logs(enterprise_id); (table removed by migration 063)
-- CREATE INDEX IF NOT EXISTS idx_feed_log_date ON feed_consumption_logs(consumption_date); (table removed by migration 063)
CREATE INDEX IF NOT EXISTS idx_compliance_enterprise ON compliance_documents(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_compliance_type ON compliance_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_financial_enterprise ON financial_records(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_financial_date ON financial_records(transaction_date);
CREATE INDEX IF NOT EXISTS idx_financial_type ON financial_records(record_type);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enterprise ON alert_rules(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_enterprise ON alert_events(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_read ON alert_events(is_read);

-- ─── 47.10 Disease Prediction & Outbreak Mapping (007) ─────────
CREATE TABLE IF NOT EXISTS disease_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  animal_id UUID REFERENCES animals(id),
  group_id UUID REFERENCES animal_groups(id),
  disease_name VARCHAR(200) NOT NULL,
  risk_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  confidence NUMERIC(5,2) NOT NULL DEFAULT 0,
  predicted_onset DATE,
  risk_factors JSONB DEFAULT '[]',
  recommended_actions JSONB DEFAULT '[]',
  status VARCHAR(30) DEFAULT 'active',
  outcome VARCHAR(30),
  created_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outbreak_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  location_id UUID REFERENCES locations(id),
  disease_name VARCHAR(200) NOT NULL,
  severity VARCHAR(20) DEFAULT 'low',
  affected_count INTEGER DEFAULT 0,
  total_at_risk INTEGER DEFAULT 0,
  radius_km NUMERIC(8,2),
  center_lat NUMERIC(10,7),
  center_lng NUMERIC(10,7),
  containment_status VARCHAR(30) DEFAULT 'monitoring',
  containment_actions JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 47.11 Genomic Lineage & Genetic Diversity (007) ───────────
CREATE TABLE IF NOT EXISTS genetic_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES animals(id),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  sire_id UUID REFERENCES animals(id),
  dam_id UUID REFERENCES animals(id),
  generation INTEGER DEFAULT 0,
  inbreeding_coefficient NUMERIC(6,4) DEFAULT 0,
  genetic_traits JSONB DEFAULT '{}',
  dna_test_date DATE,
  dna_lab VARCHAR(200),
  dna_sample_id VARCHAR(100),
  known_markers JSONB DEFAULT '[]',
  breed_purity_pct NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lineage_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  sire_id UUID NOT NULL REFERENCES animals(id),
  dam_id UUID NOT NULL REFERENCES animals(id),
  compatibility_score NUMERIC(5,2) DEFAULT 0,
  predicted_inbreeding NUMERIC(6,4) DEFAULT 0,
  predicted_traits JSONB DEFAULT '{}',
  recommendation VARCHAR(30) DEFAULT 'neutral',
  reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 47.12 IoT Sensor Integration (007) ────────────────────────
CREATE TABLE IF NOT EXISTS iot_sensors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  location_id UUID REFERENCES locations(id),
  animal_id UUID REFERENCES animals(id),
  sensor_type VARCHAR(60) NOT NULL,
  sensor_name VARCHAR(200) NOT NULL,
  serial_number VARCHAR(100),
  manufacturer VARCHAR(200),
  unit VARCHAR(30),
  min_threshold NUMERIC(10,2),
  max_threshold NUMERIC(10,2),
  reading_interval_seconds INTEGER DEFAULT 300,
  status VARCHAR(20) DEFAULT 'active',
  battery_level NUMERIC(5,2),
  last_reading_at TIMESTAMPTZ,
  firmware_version VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID NOT NULL REFERENCES iot_sensors(id),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  value NUMERIC(12,4) NOT NULL,
  unit VARCHAR(30),
  is_anomaly BOOLEAN DEFAULT false,
  anomaly_type VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 47.13 Supply Chain & Traceability (007) ───────────────────
CREATE TABLE IF NOT EXISTS product_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  batch_number VARCHAR(100) NOT NULL,
  product_type VARCHAR(60) NOT NULL,
  description TEXT,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit VARCHAR(30) DEFAULT 'kg',
  source_animal_ids UUID[] DEFAULT '{}',
  source_group_id UUID REFERENCES animal_groups(id),
  production_date DATE,
  expiry_date DATE,
  quality_grade VARCHAR(30),
  certifications JSONB DEFAULT '[]',
  current_holder VARCHAR(200),
  status VARCHAR(30) DEFAULT 'in_production',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS traceability_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  batch_id UUID REFERENCES product_batches(id),
  animal_id UUID REFERENCES animals(id),
  event_type VARCHAR(60) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  location VARCHAR(200),
  gps_lat NUMERIC(10,7),
  gps_lng NUMERIC(10,7),
  recorded_by UUID REFERENCES users(id),
  verified_by UUID REFERENCES users(id),
  verification_hash VARCHAR(128),
  metadata JSONB DEFAULT '{}',
  event_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  entity_type VARCHAR(30) NOT NULL,
  entity_id UUID NOT NULL,
  code_data TEXT NOT NULL,
  short_url VARCHAR(200),
  scan_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 47.14 Workforce & Task Management (007) ───────────────────
CREATE TABLE IF NOT EXISTS workforce_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  title VARCHAR(300) NOT NULL,
  description TEXT,
  task_type VARCHAR(60) DEFAULT 'general',
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'pending',
  assigned_to UUID REFERENCES users(id),
  created_by UUID NOT NULL REFERENCES users(id),
  location_id UUID REFERENCES locations(id),
  animal_id UUID REFERENCES animals(id),
  group_id UUID REFERENCES animal_groups(id),
  checklist JSONB DEFAULT '[]',
  due_date TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_hours NUMERIC(6,2),
  actual_hours NUMERIC(6,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shift_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  user_id UUID NOT NULL REFERENCES users(id),
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  role_on_shift VARCHAR(100),
  location_id UUID REFERENCES locations(id),
  status VARCHAR(20) DEFAULT 'scheduled',
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 47.15 Advanced Report Builder & Export Center (007) ───────
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID REFERENCES enterprises(id),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  report_type VARCHAR(60) NOT NULL,
  config JSONB DEFAULT '{}',
  columns JSONB DEFAULT '[]',
  filters JSONB DEFAULT '{}',
  grouping JSONB DEFAULT '[]',
  is_system BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  template_id UUID REFERENCES report_templates(id),
  name VARCHAR(200) NOT NULL,
  report_type VARCHAR(60) NOT NULL,
  format VARCHAR(20) DEFAULT 'json',
  parameters JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  row_count INTEGER DEFAULT 0,
  file_url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'completed',
  generated_by UUID NOT NULL REFERENCES users(id),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_disease_pred_enterprise ON disease_predictions(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_disease_pred_status ON disease_predictions(status);
CREATE INDEX IF NOT EXISTS idx_outbreak_zones_enterprise ON outbreak_zones(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_genetic_profiles_animal ON genetic_profiles(animal_id);
CREATE INDEX IF NOT EXISTS idx_genetic_profiles_enterprise ON genetic_profiles(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_lineage_pairs_enterprise ON lineage_pairs(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_iot_sensors_enterprise ON iot_sensors(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor ON sensor_readings(sensor_id);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_recorded ON sensor_readings(recorded_at);
CREATE INDEX IF NOT EXISTS idx_product_batches_enterprise ON product_batches(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_traceability_events_batch ON traceability_events(batch_id);
CREATE INDEX IF NOT EXISTS idx_traceability_events_enterprise ON traceability_events(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_entity ON qr_codes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_workforce_tasks_enterprise ON workforce_tasks(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_workforce_tasks_assigned ON workforce_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_workforce_tasks_status ON workforce_tasks(status);
CREATE INDEX IF NOT EXISTS idx_shift_schedules_enterprise ON shift_schedules(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_shift_schedules_user ON shift_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_shift_schedules_date ON shift_schedules(shift_date);
CREATE INDEX IF NOT EXISTS idx_report_templates_enterprise ON report_templates(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_enterprise ON generated_reports(enterprise_id);

-- ─── 47.16 AI Veterinary Copilot (008) ─────────────────────────
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

-- ─── 47.17 Digital Twin & Scenario Simulator (008) ─────────────
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

-- ─── 47.18 Sustainability & Carbon Tracker (008) ───────────────
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

-- ─── 47.19 Client Portal & Wellness Scorecards (008) ───────────
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

-- ─── 47.20 Geospatial Analytics & Geofencing (008) ─────────────
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

-- ─── 47.21 marketplace_listings: livestock + compliance columns (008) ──
-- The base table already exists above (§ marketplace) but was missing this
-- entire block - active Marketplace.tsx/MarketplaceService.ts code reads
-- and writes every one of these columns, so a fresh-install DB would 500 on
-- the very first listing create/search.
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

-- ─── 47.22 users: network_id/corporate_role (009 hospital networks) ────
-- Not from 006/007/008, but discovered missing during this same audit -
-- hospital_networks (defined early in § 1b above) already existed as an FK
-- target, but these two columns on users referencing it were never
-- backported.
ALTER TABLE users ADD COLUMN IF NOT EXISTS network_id UUID REFERENCES hospital_networks(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS corporate_role VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_enterprise ON ai_chat_sessions(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session ON ai_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_digital_twins_enterprise ON digital_twins(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_twin ON simulation_runs(twin_id);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_enterprise ON simulation_runs(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_species ON marketplace_listings(species);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_breed ON marketplace_listings(breed);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_tier ON marketplace_listings(listing_tier);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_admin ON marketplace_listings(admin_approved);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller_type ON marketplace_listings(seller_type);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_animal_class ON marketplace_listings(animal_class);
CREATE INDEX IF NOT EXISTS idx_animals_animal_class ON animals(animal_class);
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

-- ============================================================
-- 48. MASTER DATA (species, breeds, animal classes, marketplace categories/conditions)
-- ============================================================
-- Backported from backend/migrations/022_master_data_tables.sql - admin-editable
-- reference data that replaces the hardcoded TypeScript arrays previously in
-- frontend/src/constants/speciesBreeds.ts and Marketplace.tsx's CATEGORY_KEYS/
-- condition options. Identity is matched by the `code`/`value` string columns -
-- animals.species, marketplace_listings.species/category/condition/animal_class stay
-- plain VARCHAR (not FKs), matching existing behavior exactly.

CREATE TABLE IF NOT EXISTS master_species (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  -- i18n key resolved via resolveLabel() (same fallback pattern as
  -- master_marketplace_categories/conditions) - see migration 024. NULL for a
  -- newly admin-added species with no matching translation falls back to `label`.
  label_key VARCHAR(150),
  icon VARCHAR(10),
  category VARCHAR(50),
  has_ear_tag BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_protected BOOLEAN DEFAULT false,
  -- Controls whether this species appears in the Marketplace "sell an animal" species
  -- picker (Marketplace.tsx/PublicMarketplace.tsx) - see migration 023. Defaults false so
  -- newly admin-added species don't silently become sellable; the seed data below
  -- explicitly enables it for the species that were already in the old hardcoded picker.
  is_marketplace_eligible BOOLEAN NOT NULL DEFAULT false,
  -- Per-locale label overrides (migration 025) - lets an admin type all 6 language
  -- labels directly when adding a species, no labelKey/i18n-file/deploy needed.
  -- Checked first by the frontend's speciesLabel() resolver; NULL falls back to
  -- the label_key/i18n-key path above, same as pre-seeded species always have.
  label_hi VARCHAR(150),
  label_kn VARCHAR(150),
  label_ml VARCHAR(150),
  label_ta VARCHAR(150),
  label_te VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_breeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species_id UUID NOT NULL REFERENCES master_species(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  -- Per-locale display overrides (migration 026) - translate `name`; NULL falls back to
  -- the canonical English name, which remains the stored/value column.
  label_hi VARCHAR(150),
  label_kn VARCHAR(150),
  label_ml VARCHAR(150),
  label_ta VARCHAR(150),
  label_te VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(species_id, name)
);

CREATE TABLE IF NOT EXISTS master_animal_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species_id UUID NOT NULL REFERENCES master_species(id) ON DELETE CASCADE,
  value VARCHAR(50) NOT NULL,
  label_key VARCHAR(150),
  label VARCHAR(100),
  implied_gender VARCHAR(10) NOT NULL DEFAULT 'unknown' CHECK (implied_gender IN ('male', 'female', 'unknown')),
  can_be_pregnant BOOLEAN DEFAULT false,
  can_produce_milk BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  -- Per-locale label overrides (migration 026) - NULL falls back to label_key/label.
  label_hi VARCHAR(150),
  label_kn VARCHAR(150),
  label_ml VARCHAR(150),
  label_ta VARCHAR(150),
  label_te VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(species_id, value)
);

CREATE TABLE IF NOT EXISTS master_marketplace_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  label_key VARCHAR(150),
  label VARCHAR(100),
  icon VARCHAR(10),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_protected BOOLEAN DEFAULT false,
  -- Per-locale label overrides (migration 026) - NULL falls back to label_key/label.
  label_hi VARCHAR(150),
  label_kn VARCHAR(150),
  label_ml VARCHAR(150),
  label_ta VARCHAR(150),
  label_te VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_marketplace_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) UNIQUE NOT NULL,
  label_key VARCHAR(150),
  label VARCHAR(100),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  -- Per-locale label overrides (migration 026) - NULL falls back to label_key/label.
  label_hi VARCHAR(150),
  label_kn VARCHAR(150),
  label_ml VARCHAR(150),
  label_ta VARCHAR(150),
  label_te VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_species_active ON master_species(is_active);
CREATE INDEX IF NOT EXISTS idx_master_breeds_species ON master_breeds(species_id);
CREATE INDEX IF NOT EXISTS idx_master_breeds_active ON master_breeds(is_active);
CREATE INDEX IF NOT EXISTS idx_master_animal_classes_species ON master_animal_classes(species_id);
CREATE INDEX IF NOT EXISTS idx_master_animal_classes_active ON master_animal_classes(is_active);
CREATE INDEX IF NOT EXISTS idx_master_mp_categories_active ON master_marketplace_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_master_mp_conditions_active ON master_marketplace_conditions(is_active);

-- ============================================================
-- 48. PET WELLNESS / GROOMING & SPA MODULE (platform-level marketplace)
--     Separate from network hospitals (never a provider) and from the
--     consultation `bookings` table. Ships dark behind system setting
--     grooming.enabled. See docs/PET_WELLNESS_GROOMING_SPA_PLAN.md and
--     migration 029 (kept identical to this block).
-- ============================================================
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
  -- Acceptance SLA counters: a provider that routinely declines or lets bookings lapse is a
  -- marketplace quality problem, and admin needs it visible rather than inferred from orders.
  total_accepted INT DEFAULT 0,
  total_declined INT DEFAULT 0,
  total_acceptance_timeouts INT DEFAULT 0,
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

-- ── Grooming availability (migration 037) ──
-- Mirrors the consultation scheduling tables, with two differences a salon needs and the
-- doctor model cannot express: CAPACITY (several tables/stations serve concurrently) and
-- per-service DURATION (occupancy is an interval, not one fixed slot length).
-- location_id is nullable: NULL = the whole business, set = that branch only.
CREATE TABLE IF NOT EXISTS grooming_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES grooming_providers(id) ON DELETE CASCADE,
  location_id UUID REFERENCES grooming_locations(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time VARCHAR(5) NOT NULL,
  close_time VARCHAR(5) NOT NULL,
  slot_interval_minutes INT NOT NULL DEFAULT 30 CHECK (slot_interval_minutes BETWEEN 5 AND 480),
  capacity INT NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Partial indexes, not a plain UNIQUE: Postgres treats NULLs as distinct, which would allow
-- unlimited duplicate business-wide rows for the same weekday.
CREATE UNIQUE INDEX IF NOT EXISTS idx_grooming_schedules_provider_day_loc
  ON grooming_schedules (provider_id, location_id, day_of_week) WHERE location_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_grooming_schedules_provider_day_nolo
  ON grooming_schedules (provider_id, day_of_week) WHERE location_id IS NULL;

CREATE TABLE IF NOT EXISTS grooming_date_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES grooming_providers(id) ON DELETE CASCADE,
  location_id UUID REFERENCES grooming_locations(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  override_type VARCHAR(20) NOT NULL CHECK (override_type IN ('closed', 'custom_hours')),
  open_time VARCHAR(5),
  close_time VARCHAR(5),
  slot_interval_minutes INT CHECK (slot_interval_minutes BETWEEN 5 AND 480),
  capacity INT CHECK (capacity BETWEEN 1 AND 100),
  reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_grooming_overrides_date_loc
  ON grooming_date_overrides (provider_id, location_id, override_date) WHERE location_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_grooming_overrides_date_nolo
  ON grooming_date_overrides (provider_id, override_date) WHERE location_id IS NULL;

CREATE TABLE IF NOT EXISTS grooming_blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES grooming_providers(id) ON DELETE CASCADE,
  location_id UUID REFERENCES grooming_locations(id) ON DELETE CASCADE,
  block_date DATE,
  start_time VARCHAR(5) NOT NULL,
  end_time VARCHAR(5) NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurring_day INT CHECK (recurring_day BETWEEN 0 AND 6),
  reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Either a one-off on a date or a weekly recurrence - never neither, which would be a row
  -- invisible to every lookup that silently blocks nothing.
  CONSTRAINT grooming_blocked_slots_when_check CHECK (
    (is_recurring = true AND recurring_day IS NOT NULL)
    OR (is_recurring = false AND block_date IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_grooming_blocked_provider_date
  ON grooming_blocked_slots (provider_id, block_date);
CREATE INDEX IF NOT EXISTS idx_grooming_blocked_provider_recurring
  ON grooming_blocked_slots (provider_id, recurring_day) WHERE is_recurring = true;

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
  -- pending_provider_acceptance sits between payment and confirmed: the provider must actively
  -- accept the booking. Declining, or letting acceptance_deadline lapse, triggers a full
  -- no-fault refund. Mirrors the doctor confirm/decline gate on bookings, kept module-separate.
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','payment_pending','payment_expired',
                      'pending_provider_acceptance','declined_by_provider',
                      'confirmed','provider_assigned',
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
  gateway_order_id VARCHAR(120),
  gateway_payment_id VARCHAR(120),
  gateway VARCHAR(30),
  invoice_number VARCHAR(100),
  -- Slot-hold window: an unpaid order past expires_at is released by the grooming expiry job.
  -- Grooming keeps its OWN hold/refund columns rather than leaning on the consultation
  -- payment-hold fields, so the two modules' lifecycles can change independently.
  expires_at TIMESTAMP,
  refund_amount DECIMAL(10,2) DEFAULT 0.00,
  refund_status VARCHAR(20) NOT NULL DEFAULT 'none'
    CHECK (refund_status IN ('none', 'partial', 'full', 'failed')),
  refund_destination VARCHAR(20) CHECK (refund_destination IN ('wallet', 'gateway')),
  refund_reason TEXT,
  refunded_at TIMESTAMP,
  -- Still owed on this order: set when only a deposit was taken, and grown when the customer
  -- approves extra work mid-service. A balance checkout collects it.
  balance_due DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  -- How long this booking occupies a station, copied from the service at booking time so a
  -- later price/duration edit cannot retroactively change what was already scheduled.
  duration_minutes INT,
  -- Provider acceptance gate (see the status CHECK above).
  acceptance_deadline TIMESTAMP,
  accepted_at TIMESTAMP,
  accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  declined_at TIMESTAMP,
  decline_reason TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_grooming_orders_acceptance_deadline
  ON grooming_orders (acceptance_deadline)
  WHERE status = 'pending_provider_acceptance';

-- Occupancy lookups are always "this provider, this date, statuses that hold a slot".
CREATE INDEX IF NOT EXISTS idx_grooming_orders_provider_date
  ON grooming_orders (provider_id, scheduled_date);

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
  -- Which invoice already billed this line, so a supplementary invoice covers only new work.
  invoice_number VARCHAR(100),
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
-- payments.grooming_order_id is added here, not in the payments CREATE TABLE, because payments is
-- defined long before grooming_orders and a forward FK reference would abort the whole file (this
-- script applies as ONE transaction). A grooming order can have several payments: the initial or
-- deposit collection, plus one per balance collection for approved extra work.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS grooming_order_id UUID REFERENCES grooming_orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payments_grooming_order ON payments(grooming_order_id);

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

INSERT INTO system_settings (key, value, category, description)
VALUES ('grooming.enabled', 'false', 'grooming',
        'Master switch for the Pet Wellness/Grooming/Spa module (dark-launch flag, default off)')
ON CONFLICT (key) DO NOTHING;

-- Species (generated from SPECIES_CATEGORIES + BREED_DATABASE keys, frontend/src/constants/speciesBreeds.ts)
INSERT INTO master_species (id, code, label, icon, category, has_ear_tag, sort_order, is_active) VALUES
  (gen_random_uuid(), 'Dog', 'Dog', '🐕', 'Common Pets', false, 10, true),
  (gen_random_uuid(), 'Cat', 'Cat', '🐈', 'Common Pets', false, 20, true),
  (gen_random_uuid(), 'Rabbit', 'Rabbit', '🐰', 'Small Pets', false, 30, true),
  (gen_random_uuid(), 'Hamster', 'Hamster', '🐹', 'Small Pets', false, 40, true),
  (gen_random_uuid(), 'Guinea Pig', 'Guinea Pig', '🐾', 'Small Pets', false, 50, true),
  (gen_random_uuid(), 'Gerbil', 'Gerbil', '🐀', 'Small Pets', false, 60, true),
  (gen_random_uuid(), 'Chinchilla', 'Chinchilla', '🐭', 'Small Pets', false, 70, true),
  (gen_random_uuid(), 'Ferret', 'Ferret', '🦡', 'Small Pets', false, 80, true),
  (gen_random_uuid(), 'Hedgehog', 'Hedgehog', '🦔', 'Small Pets', false, 90, true),
  (gen_random_uuid(), 'Sugar Glider', 'Sugar Glider', '🦘', 'Small Pets', false, 100, true),
  (gen_random_uuid(), 'Parrot', 'Parrot', '🦜', 'Birds', false, 110, true),
  (gen_random_uuid(), 'Budgerigar', 'Budgerigar', '🦜', 'Birds', false, 120, true),
  (gen_random_uuid(), 'Cockatiel', 'Cockatiel', '🦜', 'Birds', false, 130, true),
  (gen_random_uuid(), 'Lovebird', 'Lovebird', '💚', 'Birds', false, 140, true),
  (gen_random_uuid(), 'Finch', 'Finch', '🐦', 'Birds', false, 150, true),
  (gen_random_uuid(), 'Canary', 'Canary', '🐦', 'Birds', false, 160, true),
  (gen_random_uuid(), 'Mynah', 'Mynah', '🐦', 'Birds', false, 170, true),
  (gen_random_uuid(), 'Pigeon', 'Pigeon', '🕊️', 'Birds', false, 180, true),
  (gen_random_uuid(), 'Bird', 'Bird', '🐦', 'Birds', false, 190, true),
  (gen_random_uuid(), 'Tortoise', 'Tortoise', '🐢', 'Reptiles', false, 200, true),
  (gen_random_uuid(), 'Turtle', 'Turtle', '🐢', 'Reptiles', false, 210, true),
  (gen_random_uuid(), 'Gecko', 'Gecko', '🦎', 'Reptiles', false, 220, true),
  (gen_random_uuid(), 'Bearded Dragon', 'Bearded Dragon', '🦎', 'Reptiles', false, 230, true),
  (gen_random_uuid(), 'Chameleon', 'Chameleon', '🦎', 'Reptiles', false, 240, true),
  (gen_random_uuid(), 'Snake', 'Snake', '🐍', 'Reptiles', false, 250, true),
  (gen_random_uuid(), 'Frog', 'Frog', '🐸', 'Amphibians', false, 260, true),
  (gen_random_uuid(), 'Axolotl', 'Axolotl', '🦎', 'Amphibians', false, 270, true),
  (gen_random_uuid(), 'Ornamental Fish', 'Ornamental Fish', '🐠', 'Ornamental Fish', false, 280, true),
  (gen_random_uuid(), 'Koi', 'Koi', '🐟', 'Ornamental Fish', false, 290, true),
  (gen_random_uuid(), 'Arowana', 'Arowana', '🐟', 'Ornamental Fish', false, 300, true),
  (gen_random_uuid(), 'Goldfish', 'Goldfish', '🐡', 'Ornamental Fish', false, 310, true),
  (gen_random_uuid(), 'Cattle', 'Cattle', '🐄', 'Livestock / Farm', true, 320, true),
  (gen_random_uuid(), 'Buffalo', 'Buffalo', '🐃', 'Livestock / Farm', true, 330, true),
  (gen_random_uuid(), 'Horse', 'Horse', '🐴', 'Livestock / Farm', true, 340, true),
  (gen_random_uuid(), 'Donkey', 'Donkey', '🫏', 'Livestock / Farm', true, 350, true),
  (gen_random_uuid(), 'Sheep', 'Sheep', '🐑', 'Livestock / Farm', true, 360, true),
  (gen_random_uuid(), 'Goat', 'Goat', '🐐', 'Livestock / Farm', true, 370, true),
  (gen_random_uuid(), 'Pig', 'Pig', '🐷', 'Livestock / Farm', true, 380, true),
  (gen_random_uuid(), 'Camel', 'Camel', '🐪', 'Livestock / Farm', true, 390, true),
  (gen_random_uuid(), 'Yak', 'Yak', '🐂', 'Livestock / Farm', true, 400, true),
  (gen_random_uuid(), 'Deer', 'Deer', '🦌', 'Livestock / Farm', true, 410, true),
  (gen_random_uuid(), 'Chicken', 'Chicken', '🐔', 'Poultry', false, 420, true),
  (gen_random_uuid(), 'Duck', 'Duck', '🦆', 'Poultry', false, 430, true),
  (gen_random_uuid(), 'Turkey', 'Turkey', '🦃', 'Poultry', false, 440, true),
  (gen_random_uuid(), 'Quail', 'Quail', '🐦', 'Poultry', false, 450, true),
  (gen_random_uuid(), 'Emu', 'Emu', '🦤', 'Poultry', true, 460, true),
  (gen_random_uuid(), 'Ostrich', 'Ostrich', '🦢', 'Poultry', true, 470, true),
  (gen_random_uuid(), 'Peacock', 'Peacock', '🦚', 'Poultry', true, 480, true),
  (gen_random_uuid(), 'Llama', 'Llama', '🦙', 'Exotic Large', true, 490, true),
  (gen_random_uuid(), 'Alpaca', 'Alpaca', '🦙', 'Exotic Large', true, 500, true),
  (gen_random_uuid(), 'Other', 'Other', '🐾', 'Other', false, 510, true)
ON CONFLICT (code) DO NOTHING;

-- Marketplace eligibility backfill (migration 023): exactly the species that were already
-- in the old hardcoded MARKETPLACE_FARMER_SPECIES/MARKETPLACE_PET_OWNER_SPECIES arrays -
-- preserves today's marketplace species picker contents exactly, nothing more.
UPDATE master_species SET is_marketplace_eligible = true
WHERE code IN ('Cattle', 'Buffalo', 'Goat', 'Sheep', 'Horse', 'Camel', 'Pig', 'Chicken', 'Dog', 'Cat', 'Rabbit', 'Other');

-- Species label_key backfill (migration 024): deterministic key per species so every
-- species name resolves through i18n immediately, no admin action needed.
UPDATE master_species
SET label_key = 'speciesNames.' || lower(regexp_replace(code, '[^a-zA-Z0-9]+', '_', 'g'))
WHERE label_key IS NULL;

-- Breeds (generated from BREED_DATABASE, frontend/src/constants/speciesBreeds.ts)
INSERT INTO master_breeds (id, species_id, name, sort_order, is_active) VALUES
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Indian Pariah', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Mudhol Hound', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Rajapalayam', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Kanni', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Chippiparai', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Kombai', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Bakharwal', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Rampur Greyhound', 80, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Himalayan Sheepdog', 90, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Labrador Retriever', 100, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Golden Retriever', 110, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'German Shepherd', 120, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Beagle', 130, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Pug', 140, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Dachshund', 150, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Rottweiler', 160, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Doberman Pinscher', 170, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Great Dane', 180, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Saint Bernard', 190, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Siberian Husky', 200, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Shih Tzu', 210, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Pomeranian', 220, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Cocker Spaniel', 230, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Boxer', 240, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Dalmatian', 250, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Border Collie', 260, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Maltese', 270, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Poodle', 280, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Bichon Frise', 290, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'German Spitz', 300, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Lhasa Apso', 310, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Chow Chow', 320, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Bulldog', 330, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'French Bulldog', 340, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Yorkshire Terrier', 350, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Mixed Breed', 360, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'Other', 370, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'Persian', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'Siamese', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'Bengal', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'Maine Coon', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'Russian Blue', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'British Shorthair', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'Scottish Fold', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'Ragdoll', 80, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'Himalayan', 90, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'Turkish Angora', 100, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'Bombay', 110, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'American Shorthair', 120, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'Abyssinian', 130, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'Burmese', 140, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'Devon Rex', 150, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'Indian Domestic', 160, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'Mixed Breed', 170, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'Other', 180, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Rabbit'), 'New Zealand White', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Rabbit'), 'Dutch', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Rabbit'), 'Rex', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Rabbit'), 'Angora', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Rabbit'), 'Mini Lop', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Rabbit'), 'Holland Lop', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Rabbit'), 'Flemish Giant', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Rabbit'), 'Lionhead', 80, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Rabbit'), 'Himalayan', 90, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Rabbit'), 'Mixed Breed', 100, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Rabbit'), 'Other', 110, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Hamster'), 'Syrian (Golden)', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Hamster'), 'Dwarf Campbell', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Hamster'), 'Dwarf Winter White', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Hamster'), 'Roborovski', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Hamster'), 'Chinese', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Hamster'), 'Mixed', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Hamster'), 'Other', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Guinea Pig'), 'American', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Guinea Pig'), 'Abyssinian', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Guinea Pig'), 'Peruvian', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Guinea Pig'), 'Silkie', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Guinea Pig'), 'Teddy', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Guinea Pig'), 'Texel', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Guinea Pig'), 'Mixed', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Guinea Pig'), 'Other', 80, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Gerbil'), 'Mongolian', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Gerbil'), 'Fat-tailed', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Gerbil'), 'Mixed', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Gerbil'), 'Other', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chinchilla'), 'Standard Grey', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chinchilla'), 'White', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chinchilla'), 'Beige', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chinchilla'), 'Black Velvet', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chinchilla'), 'Violet', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chinchilla'), 'Mixed', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chinchilla'), 'Other', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ferret'), 'Sable', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ferret'), 'Albino', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ferret'), 'Dark-eyed White', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ferret'), 'Silver', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ferret'), 'Cinnamon', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ferret'), 'Mixed', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ferret'), 'Other', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Hedgehog'), 'African Pygmy', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Hedgehog'), 'European', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Hedgehog'), 'Long-eared', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Hedgehog'), 'Mixed', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Hedgehog'), 'Other', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sugar Glider'), 'Classic Grey', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sugar Glider'), 'Leucistic', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sugar Glider'), 'Albino', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sugar Glider'), 'Black Beauty', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sugar Glider'), 'Mixed', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sugar Glider'), 'Other', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Parrot'), 'African Grey', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Parrot'), 'Blue and Gold Macaw', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Parrot'), 'Green Wing Macaw', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Parrot'), 'Scarlet Macaw', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Parrot'), 'Cockatoo', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Parrot'), 'Yellow-naped Amazon', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Parrot'), 'Blue-fronted Amazon', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Parrot'), 'Eclectus', 80, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Parrot'), 'Sun Conure', 90, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Parrot'), 'Green Cheek Conure', 100, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Parrot'), 'Caique', 110, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Parrot'), 'Alexandrine Parakeet', 120, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Parrot'), 'Rose-ringed Parakeet', 130, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Parrot'), 'Mixed', 140, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Parrot'), 'Other', 150, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Budgerigar'), 'English Budgie', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Budgerigar'), 'American Budgie', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Budgerigar'), 'Australian Budgie', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Budgerigar'), 'Lutino', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Budgerigar'), 'Albino', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Budgerigar'), 'Pied', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Budgerigar'), 'Mixed', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Budgerigar'), 'Other', 80, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cockatiel'), 'Normal Grey', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cockatiel'), 'Lutino', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cockatiel'), 'Pearl', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cockatiel'), 'Cinnamon', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cockatiel'), 'Pied', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cockatiel'), 'Whiteface', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cockatiel'), 'Mixed', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cockatiel'), 'Other', 80, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Lovebird'), 'Peach-faced', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Lovebird'), 'Fischer''s', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Lovebird'), 'Black-masked', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Lovebird'), 'Nyasa', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Lovebird'), 'Black-cheeked', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Lovebird'), 'Mixed', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Lovebird'), 'Other', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Finch'), 'Zebra Finch', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Finch'), 'Society Finch', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Finch'), 'Gouldian Finch', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Finch'), 'Java Sparrow', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Finch'), 'Star Finch', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Finch'), 'Mixed', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Finch'), 'Other', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Canary'), 'Yorkshire', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Canary'), 'Border', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Canary'), 'Roller', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Canary'), 'Red Factor', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Canary'), 'Gloster', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Canary'), 'Mixed', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Canary'), 'Other', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Mynah'), 'Common Hill Mynah', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Mynah'), 'Bank Mynah', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Mynah'), 'Jungle Mynah', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Mynah'), 'Mixed', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Mynah'), 'Other', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pigeon'), 'Fantail', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pigeon'), 'Jacobin', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pigeon'), 'Tumbler', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pigeon'), 'King', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pigeon'), 'Racing Homer', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pigeon'), 'Indian Fantail', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pigeon'), 'Mixed', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pigeon'), 'Other', 80, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Bird'), 'Mixed / Unknown', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Bird'), 'Other', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Tortoise'), 'Indian Star Tortoise', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Tortoise'), 'Russian Tortoise', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Tortoise'), 'Hermann''s Tortoise', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Tortoise'), 'Sulcata', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Tortoise'), 'Red-footed', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Tortoise'), 'Mixed', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Tortoise'), 'Other', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Turtle'), 'Red-eared Slider', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Turtle'), 'Painted Turtle', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Turtle'), 'Map Turtle', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Turtle'), 'Box Turtle', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Turtle'), 'Mixed', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Turtle'), 'Other', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Gecko'), 'Leopard Gecko', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Gecko'), 'Crested Gecko', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Gecko'), 'African Fat-tailed', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Gecko'), 'Tokay', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Gecko'), 'Day Gecko', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Gecko'), 'Mixed', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Gecko'), 'Other', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Bearded Dragon'), 'Inland/Central', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Bearded Dragon'), 'Rankin''s Dragon', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Bearded Dragon'), 'Mixed', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Bearded Dragon'), 'Other', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chameleon'), 'Veiled', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chameleon'), 'Panther', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chameleon'), 'Jackson''s', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chameleon'), 'Fischer''s', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chameleon'), 'Mixed', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chameleon'), 'Other', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Snake'), 'Ball Python', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Snake'), 'Corn Snake', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Snake'), 'King Snake', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Snake'), 'Milk Snake', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Snake'), 'Boa Constrictor', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Snake'), 'Mixed', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Snake'), 'Other', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Frog'), 'African Dwarf', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Frog'), 'Pacman (Horned)', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Frog'), 'Tree Frog', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Frog'), 'White''s Tree Frog', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Frog'), 'Mixed', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Frog'), 'Other', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Axolotl'), 'Wild Type', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Axolotl'), 'Leucistic', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Axolotl'), 'Golden Albino', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Axolotl'), 'Melanoid', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Axolotl'), 'Axanthic', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Axolotl'), 'Mixed', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Axolotl'), 'Other', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ornamental Fish'), 'Betta', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ornamental Fish'), 'Guppy', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ornamental Fish'), 'Mollies', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ornamental Fish'), 'Platy', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ornamental Fish'), 'Swordtail', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ornamental Fish'), 'Tetra', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ornamental Fish'), 'Angelfish', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ornamental Fish'), 'Discus', 80, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ornamental Fish'), 'Cichlid', 90, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ornamental Fish'), 'Clownfish', 100, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ornamental Fish'), 'Mixed', 110, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ornamental Fish'), 'Other', 120, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Koi'), 'Kohaku', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Koi'), 'Sanke', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Koi'), 'Showa', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Koi'), 'Bekko', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Koi'), 'Asagi', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Koi'), 'Ogon', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Koi'), 'Butterfly Koi', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Koi'), 'Mixed', 80, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Koi'), 'Other', 90, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Arowana'), 'Silver', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Arowana'), 'Golden', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Arowana'), 'Red', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Arowana'), 'Black', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Arowana'), 'Pearl', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Arowana'), 'Mixed', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Arowana'), 'Other', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goldfish'), 'Common', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goldfish'), 'Comet', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goldfish'), 'Fantail', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goldfish'), 'Oranda', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goldfish'), 'Ryukin', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goldfish'), 'Black Moor', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goldfish'), 'Telescope', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goldfish'), 'Bubble Eye', 80, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goldfish'), 'Mixed', 90, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goldfish'), 'Other', 100, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Gir', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Sahiwal', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Red Sindhi', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Tharparkar', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Ongole', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Hallikar', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Khillari', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Deoni', 80, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Kangayam', 90, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Umblachery', 100, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Malnad Gidda', 110, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Punganur', 120, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Vechur', 130, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Hariana', 140, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Rathi', 150, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Holstein Friesian (HF)', 160, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Jersey', 170, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Brown Swiss', 180, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Simmental', 190, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Cross Breed', 200, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Other', 210, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Buffalo'), 'Murrah', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Buffalo'), 'Surti', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Buffalo'), 'Mehsana', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Buffalo'), 'Jaffarabadi', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Buffalo'), 'Nili-Ravi', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Buffalo'), 'Pandharpuri', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Buffalo'), 'Marathwadi', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Buffalo'), 'Nagpuri', 80, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Buffalo'), 'Toda (Nilgiri)', 90, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Buffalo'), 'Cross Breed', 100, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Buffalo'), 'Other', 110, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Horse'), 'Marwari', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Horse'), 'Kathiawari', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Horse'), 'Manipuri Pony', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Horse'), 'Bhutia', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Horse'), 'Spiti', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Horse'), 'Zanskari', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Horse'), 'Thoroughbred', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Horse'), 'Arabian', 80, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Horse'), 'Quarter Horse', 90, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Horse'), 'Warmblood', 100, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Horse'), 'Standardbred', 110, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Horse'), 'Mixed Breed', 120, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Horse'), 'Other', 130, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Donkey'), 'Indian Donkey', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Donkey'), 'Halari', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Donkey'), 'Spiti', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Donkey'), 'Mixed', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Donkey'), 'Other', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'Nellore', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'Deccani', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'Mandya', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'Bellary', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'Madras Red', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'Coimbatore', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'Mecheri', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'Ramnad White', 80, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'Vembur', 90, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'Nilgiri', 100, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'Korriedale', 110, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'Garole', 120, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'Merino', 130, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'Suffolk', 140, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'Rambouillet', 150, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'Cross Breed', 160, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'Other', 170, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Jamunapari', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Barbari', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Sirohi', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Black Bengal', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Osmanabadi', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Salem Black', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Malabari', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Sangamneri', 80, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Ganjam', 90, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Kanni Adu', 100, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Boer', 110, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Alpine', 120, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Saanen', 130, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Nubian', 140, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Angora', 150, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Cross Breed', 160, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Other', 170, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'Desi (Indigenous)', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'Ghoongroo', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'Niang Megha', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'Yorkshire (Large White)', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'Landrace', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'Duroc', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'Hampshire', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'Berkshire', 80, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'Cross Breed', 90, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'Other', 100, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Camel'), 'Dromedary (One-humped)', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Camel'), 'Bactrian (Two-humped)', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Camel'), 'Mixed', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Camel'), 'Other', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Yak'), 'Domestic Yak', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Yak'), 'Mixed', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Yak'), 'Other', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Deer'), 'Spotted Deer (Chital)', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Deer'), 'Sambhar', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Deer'), 'Barking Deer (Muntjac)', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Deer'), 'Mixed', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Deer'), 'Other', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chicken'), 'Aseel', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chicken'), 'Kadaknath', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chicken'), 'Ghagus', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chicken'), 'Naked Neck', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chicken'), 'Kalinga Brown', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chicken'), 'Vanaraja', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chicken'), 'Grampriya', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chicken'), 'Nicobari', 80, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chicken'), 'Broiler', 90, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chicken'), 'White Leghorn', 100, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chicken'), 'Rhode Island Red', 110, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chicken'), 'Plymouth Rock', 120, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chicken'), 'Sussex', 130, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chicken'), 'Australorp', 140, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chicken'), 'Mixed Breed', 150, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Chicken'), 'Other', 160, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Duck'), 'Indian Runner', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Duck'), 'Khaki Campbell', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Duck'), 'Pekin', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Duck'), 'Muscovy', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Duck'), 'Rouen', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Duck'), 'Mixed', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Duck'), 'Other', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Turkey'), 'Broad-breasted White', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Turkey'), 'Bronze', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Turkey'), 'Bourbon Red', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Turkey'), 'Narragansett', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Turkey'), 'Mixed', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Turkey'), 'Other', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Quail'), 'Japanese', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Quail'), 'Bobwhite', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Quail'), 'California', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Quail'), 'Coturnix', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Quail'), 'Mixed', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Quail'), 'Other', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Emu'), 'Australian Emu', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Emu'), 'Other', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ostrich'), 'Common Ostrich', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Ostrich'), 'Other', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Peacock'), 'Indian Peafowl (Blue)', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Peacock'), 'White Peafowl', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Peacock'), 'Green Peafowl', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Peacock'), 'Mixed', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Peacock'), 'Other', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Llama'), 'Suri', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Llama'), 'Huacaya', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Llama'), 'Mixed', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Llama'), 'Other', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Alpaca'), 'Suri', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Alpaca'), 'Huacaya', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Alpaca'), 'Mixed', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Alpaca'), 'Other', 40, true)
ON CONFLICT (species_id, name) DO NOTHING;

-- Animal classes (generated from ANIMAL_CLASS_TERMS, frontend/src/constants/speciesBreeds.ts)
INSERT INTO master_animal_classes (id, species_id, value, label_key, implied_gender, can_be_pregnant, can_produce_milk, sort_order, is_active) VALUES
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'cattle_bull', 'animalClass.cattle_bull', 'male', false, false, 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'cattle_cow', 'animalClass.cattle_cow', 'female', true, true, 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'cattle_calf', 'animalClass.cattle_calf', 'unknown', false, false, 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'cattle_bull_calf', 'animalClass.cattle_bull_calf', 'male', false, false, 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'cattle_heifer_calf', 'animalClass.cattle_heifer_calf', 'female', false, false, 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'cattle_heifer', 'animalClass.cattle_heifer', 'female', true, false, 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'cattle_bullock', 'animalClass.cattle_bullock', 'male', false, false, 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'cattle_steer', 'animalClass.cattle_steer', 'male', false, false, 80, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Buffalo'), 'buffalo_bull', 'animalClass.buffalo_bull', 'male', false, false, 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Buffalo'), 'buffalo_cow', 'animalClass.buffalo_cow', 'female', true, true, 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Buffalo'), 'buffalo_calf', 'animalClass.buffalo_calf', 'unknown', false, false, 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Buffalo'), 'buffalo_bull_calf', 'animalClass.buffalo_bull_calf', 'male', false, false, 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Buffalo'), 'buffalo_heifer_calf', 'animalClass.buffalo_heifer_calf', 'female', false, false, 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Buffalo'), 'buffalo_heifer', 'animalClass.buffalo_heifer', 'female', true, false, 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Buffalo'), 'buffalo_bullock', 'animalClass.buffalo_bullock', 'male', false, false, 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'sheep_ram', 'animalClass.sheep_ram', 'male', false, false, 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'sheep_ewe', 'animalClass.sheep_ewe', 'female', true, true, 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'sheep_lamb', 'animalClass.sheep_lamb', 'unknown', false, false, 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'sheep_ram_lamb', 'animalClass.sheep_ram_lamb', 'male', false, false, 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'sheep_ewe_lamb', 'animalClass.sheep_ewe_lamb', 'female', false, false, 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'sheep_wether', 'animalClass.sheep_wether', 'male', false, false, 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'goat_buck', 'animalClass.goat_buck', 'male', false, false, 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'goat_doe', 'animalClass.goat_doe', 'female', true, true, 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'goat_buckling', 'animalClass.goat_buckling', 'male', false, false, 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'goat_goatling', 'animalClass.goat_goatling', 'female', true, false, 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'goat_kid', 'animalClass.goat_kid', 'unknown', false, false, 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'pig_boar', 'animalClass.pig_boar', 'male', false, false, 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'pig_sow', 'animalClass.pig_sow', 'female', true, false, 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'pig_gilt', 'animalClass.pig_gilt', 'female', true, false, 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'pig_barrow', 'animalClass.pig_barrow', 'male', false, false, 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'dog_male', 'animalClass.dog_male', 'male', false, false, 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'dog_bitch', 'animalClass.dog_bitch', 'female', true, false, 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Dog'), 'dog_pup', 'animalClass.dog_pup', 'unknown', false, false, 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'cat_tom', 'animalClass.cat_tom', 'male', false, false, 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'cat_queen', 'animalClass.cat_queen', 'female', true, false, 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'cat_kitten', 'animalClass.cat_kitten', 'unknown', false, false, 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cat'), 'cat_neuter', 'animalClass.cat_neuter', 'unknown', false, false, 40, true)
ON CONFLICT (species_id, value) DO NOTHING;

-- Marketplace categories (generated from CATEGORY_KEYS, frontend/src/pages/Marketplace.tsx - skips the blank '' "all" filter entry)
INSERT INTO master_marketplace_categories (id, code, label_key, sort_order, is_active, is_protected) VALUES
  (gen_random_uuid(), 'animal', 'marketplace.categories.animals', 10, true, true),
  (gen_random_uuid(), 'feed', 'marketplace.categories.feed', 20, true, false),
  (gen_random_uuid(), 'equipment', 'marketplace.categories.equipment', 30, true, false),
  (gen_random_uuid(), 'medicine', 'marketplace.categories.medicine', 40, true, false),
  (gen_random_uuid(), 'semen_embryo', 'marketplace.categories.semenEmbryo', 50, true, false),
  (gen_random_uuid(), 'service', 'marketplace.categories.services', 60, true, false),
  (gen_random_uuid(), 'other', 'marketplace.categories.other', 70, true, false)
ON CONFLICT (code) DO NOTHING;

-- Marketplace conditions (3 fixed values from Marketplace.tsx sell-form <option>s)
INSERT INTO master_marketplace_conditions (id, code, label_key, sort_order, is_active) VALUES
  (gen_random_uuid(), 'new', 'marketplace.conditionLabel.healthy', 10, true),
  (gen_random_uuid(), 'used', 'marketplace.conditionLabel.fair', 20, true),
  (gen_random_uuid(), 'refurbished', 'marketplace.conditionLabel.underTreatment', 30, true)
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 60. BATCH (FLOCK/HERD) ANIMAL MANAGEMENT
-- ============================================================
-- Kept identical to backend/migrations/041_batch_animal_management.sql so a fresh install and an
-- upgraded database end up with the same schema. See docs/BATCH_ANIMAL_MANAGEMENT_PLAN.md.
--
-- A health event has ONE subject: an animal OR a group - never both, and never a fan-out into
-- one row per head. A 5,000-bird flock produces one record, not 5,000.
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. MANAGEMENT MODE
-- ─────────────────────────────────────────────────────────────────────────────

-- Species suggests; the group decides. Defaults to 'individual' so nothing silently becomes a
-- batch - same conservative-default reasoning as is_marketplace_eligible.
ALTER TABLE master_species
  ADD COLUMN IF NOT EXISTS default_management_mode VARCHAR(20) NOT NULL DEFAULT 'individual';

DO $$ BEGIN
  ALTER TABLE master_species ADD CONSTRAINT master_species_mgmt_mode_ck
    CHECK (default_management_mode IN ('individual', 'batch'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Poultry is batch by default. Note has_ear_tag is ALREADY false for exactly these four, which
-- is the same underlying fact (not individually identified) expressed for tagging.
UPDATE master_species SET default_management_mode = 'batch'
 WHERE code IN ('Chicken', 'Duck', 'Turkey', 'Quail');

ALTER TABLE animal_groups
  ADD COLUMN IF NOT EXISTS management_mode VARCHAR(20) NOT NULL DEFAULT 'individual';

DO $$ BEGIN
  ALTER TABLE animal_groups ADD CONSTRAINT animal_groups_mgmt_mode_ck
    CHECK (management_mode IN ('individual', 'batch'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PRODUCTION CYCLES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES animal_groups(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  name VARCHAR(150),
  species VARCHAR(100),
  breed VARCHAR(100),
  placed_count INTEGER NOT NULL DEFAULT 0,
  current_count INTEGER NOT NULL DEFAULT 0,
  started_at DATE NOT NULL DEFAULT CURRENT_DATE,
  ended_at DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed')),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (group_id, cycle_number),
  CHECK (current_count >= 0),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_group_cycles_group ON group_cycles(group_id);
-- One active cycle per group: a shed holds one population at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_cycles_one_active
  ON group_cycles(group_id) WHERE status = 'active';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. POPULATION LEDGER
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_population_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES animal_groups(id) ON DELETE CASCADE,
  cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL,
  event_type VARCHAR(20) NOT NULL
    CHECK (event_type IN ('placement', 'hatch', 'mortality', 'cull', 'sale',
                          'transfer_in', 'transfer_out', 'promotion', 'adjustment')),
  -- Signed: +ve adds to the population, -ve removes. 'adjustment' may be either, which is why
  -- this is not a magnitude plus a direction flag.
  quantity INTEGER NOT NULL,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  -- Free-form pointer to whatever caused this (a movement_record, a sale, an animal promoted
  -- out of the batch). Deliberately not an FK: the sources live in several tables.
  source_ref VARCHAR(100),
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (quantity <> 0)
);

CREATE INDEX IF NOT EXISTS idx_group_pop_events_group ON group_population_events(group_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_group_pop_events_cycle ON group_population_events(cycle_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. MEMBERSHIP - how a promoted animal keeps its batch history
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS animal_group_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES animal_groups(id) ON DELETE CASCADE,
  cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL,
  joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
  left_at DATE,
  -- Why the animal stopped being part of the batch population.
  exit_reason VARCHAR(30)
    CHECK (exit_reason IS NULL OR exit_reason IN ('promoted', 'sold', 'died', 'transferred', 'cycle_closed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (left_at IS NULL OR left_at >= joined_at)
);

CREATE INDEX IF NOT EXISTS idx_animal_group_memberships_animal ON animal_group_memberships(animal_id);
CREATE INDEX IF NOT EXISTS idx_animal_group_memberships_cycle ON animal_group_memberships(cycle_id);

-- Where an individually-tracked animal came from, when it was promoted out of a batch.
ALTER TABLE animals ADD COLUMN IF NOT EXISTS origin_group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS origin_cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. GROUP-SUBJECT HEALTH RECORDS
-- ─────────────────────────────────────────────────────────────────────────────

-- vaccination_records.animal_id and allergy_records.animal_id are NOT NULL today. They must be
-- relaxed to make room for a group subject; the CHECK added below keeps "neither set"
-- impossible, so nothing becomes orphaned.
ALTER TABLE vaccination_records ALTER COLUMN animal_id DROP NOT NULL;
ALTER TABLE allergy_records     ALTER COLUMN animal_id DROP NOT NULL;

ALTER TABLE medical_records     ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
ALTER TABLE medical_records     ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL;
ALTER TABLE vaccination_records ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
ALTER TABLE vaccination_records ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL;
ALTER TABLE allergy_records     ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
ALTER TABLE allergy_records     ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL;
ALTER TABLE lab_results         ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
ALTER TABLE lab_results         ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL;
ALTER TABLE vet_certificates    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
ALTER TABLE vet_certificates    ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL;

-- Exactly one subject. Without this, relaxing the NOT NULLs above would allow a record that
-- belongs to nothing at all.
DO $$ BEGIN
  ALTER TABLE medical_records ADD CONSTRAINT medical_records_subject_ck
    CHECK ((animal_id IS NOT NULL) <> (group_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE vaccination_records ADD CONSTRAINT vaccination_records_subject_ck
    CHECK ((animal_id IS NOT NULL) <> (group_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE allergy_records ADD CONSTRAINT allergy_records_subject_ck
    CHECK ((animal_id IS NOT NULL) <> (group_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- lab_results and vet_certificates allow a NULL animal_id today (a lab result may pre-date
-- identification; a certificate may cover a consignment), so they get the weaker rule: not
-- both, rather than exactly one.
DO $$ BEGIN
  ALTER TABLE lab_results ADD CONSTRAINT lab_results_subject_ck
    CHECK (NOT (animal_id IS NOT NULL AND group_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE vet_certificates ADD CONSTRAINT vet_certificates_subject_ck
    CHECK (NOT (animal_id IS NOT NULL AND group_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- When the event actually happened, as opposed to when the row was typed. medical_records has
-- only created_at today, which is not good enough here: a treatment is often recorded after the
-- fact, and lifetime history for an animal promoted out of a batch is resolved by asking which
-- group records fall inside its membership window. Matching on created_at would attribute a
-- back-dated treatment to the wrong window - or to no window at all.
-- vaccination_records already has date_administered; this gives medical_records the equivalent.
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS event_date DATE;
UPDATE medical_records SET event_date = created_at::date WHERE event_date IS NULL;
ALTER TABLE medical_records ALTER COLUMN event_date SET DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_medical_records_event_date ON medical_records(event_date);

-- Batch facts. An individual record answers "what happened to this animal"; a batch record must
-- also answer "how much of the group". head_count_treated is STORED, never derived, so a record
-- citing 5,000 head still says 5,000 after the flock drops to 4,200.
ALTER TABLE medical_records     ADD COLUMN IF NOT EXISTS head_count_treated INTEGER;
ALTER TABLE medical_records     ADD COLUMN IF NOT EXISTS affected_count INTEGER;
ALTER TABLE medical_records     ADD COLUMN IF NOT EXISTS mortality_count INTEGER;
ALTER TABLE vaccination_records ADD COLUMN IF NOT EXISTS head_count_treated INTEGER;

-- Traces a record back to the campaign that produced it (Phase 3 wires this up).
ALTER TABLE medical_records     ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES treatment_campaigns(id) ON DELETE SET NULL;
ALTER TABLE vaccination_records ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES treatment_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_medical_records_group ON medical_records(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vaccination_records_group ON vaccination_records(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lab_results_group ON lab_results(group_id) WHERE group_id IS NOT NULL;




-- ============================================================
-- 60.5 GROUP-SUBJECT PRESCRIPTIONS (Phase 5, non-network)
-- ============================================================
-- Mirrors backend/migrations/042_prescription_group_subject.sql so a fresh install and an
-- upgraded database end up with the same schema. A batch prescription covers a whole group
-- (herd/flock) in one row - never a fan-out into one prescription per head. Same exactly-one
-- subject rule as the health tables (section 60.5), plus a stored head_count_treated so the
-- obligation survives later flock shrinkage.
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL;
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS head_count_treated INTEGER;

DO $$ BEGIN
  ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_subject_ck
    CHECK ((animal_id IS NOT NULL) <> (group_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_prescriptions_group
  ON prescriptions(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prescriptions_cycle
  ON prescriptions(cycle_id) WHERE cycle_id IS NOT NULL;

-- ============================================================
-- 61. FARM PROFILE ENGINE + MASTER-DATA CORRECTIONS
-- ============================================================
-- Kept identical to backend/migrations/043_farm_profile_engine.sql (everything below its header)
-- so a fresh install and an upgraded database end up the same. See that file for the sources of
-- every value, and docs/FARM_MANAGEMENT_PLAN.md sections 5-6 for the design. Every statement is
-- idempotent because migration 043 runs again on top of this on a fresh install.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SPECIES CAPABILITY FLAGS
-- ─────────────────────────────────────────────────────────────────────────────

-- farm_segment defaults to 'pet' so a newly admin-added species never silently grows farm
-- sections - the same conservative-default reasoning as is_marketplace_eligible.
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS farm_segment VARCHAR(30) NOT NULL DEFAULT 'pet';
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS produces_milk BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS produces_eggs BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS produces_wool BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS is_aquatic BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS litter_expected BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS gestation_days INTEGER;
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS incubation_days INTEGER;
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS birth_event_term VARCHAR(20) NOT NULL DEFAULT 'birth';
-- Aquatic reference data. water_quality_ranges holds per-species guide ranges so they can be
-- filled in as official sources are confirmed; a species with no range simply shows no
-- "outside the guide range" hint. Ranges are never written in code.
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS scientific_name VARCHAR(150);
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS water_type VARCHAR(20);
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS water_quality_ranges JSONB;

DO $$ BEGIN
  ALTER TABLE master_species ADD CONSTRAINT master_species_farm_segment_ck
    CHECK (farm_segment IN ('dairy', 'small_ruminant', 'pig', 'poultry', 'aquaculture', 'equine', 'other_livestock', 'pet'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE master_species ADD CONSTRAINT master_species_birth_term_ck
    CHECK (birth_event_term IN ('birth', 'calving', 'kidding', 'lambing', 'farrowing', 'foaling', 'hatching', 'spawning'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE master_species ADD CONSTRAINT master_species_water_type_ck
    CHECK (water_type IS NULL OR water_type IN ('fresh', 'brackish', 'marine'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE master_species ADD CONSTRAINT master_species_repro_days_ck
    CHECK ((gestation_days IS NULL OR gestation_days > 0) AND (incubation_days IS NULL OR incubation_days > 0));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill for the species that already exist. Guarded by "still at the column default" so an
-- admin's later edit is never overwritten when this file runs a second time.
UPDATE master_species SET farm_segment = 'dairy'           WHERE code IN ('Cattle', 'Buffalo') AND farm_segment = 'pet';
UPDATE master_species SET farm_segment = 'small_ruminant'  WHERE code IN ('Sheep', 'Goat') AND farm_segment = 'pet';
UPDATE master_species SET farm_segment = 'pig'             WHERE code = 'Pig' AND farm_segment = 'pet';
UPDATE master_species SET farm_segment = 'poultry'         WHERE code IN ('Chicken', 'Duck', 'Turkey', 'Quail', 'Emu', 'Ostrich', 'Peacock') AND farm_segment = 'pet';
UPDATE master_species SET farm_segment = 'equine'          WHERE code IN ('Horse', 'Donkey') AND farm_segment = 'pet';
UPDATE master_species SET farm_segment = 'other_livestock' WHERE code IN ('Camel', 'Yak', 'Deer', 'Llama', 'Alpaca') AND farm_segment = 'pet';

-- Owner decision D11: milk applies to every animal that produces milk. The species flag says
-- "milk records can exist for this species"; the animal class decides which animals.
UPDATE master_species SET produces_milk = true WHERE code IN ('Cattle', 'Buffalo', 'Goat', 'Sheep', 'Camel', 'Yak', 'Horse', 'Donkey') AND produces_milk = false;
UPDATE master_species SET produces_eggs = true WHERE code IN ('Chicken', 'Duck', 'Turkey', 'Quail', 'Emu') AND produces_eggs = false;
UPDATE master_species SET produces_wool = true WHERE code = 'Sheep' AND produces_wool = false;
UPDATE master_species SET litter_expected = true WHERE code IN ('Pig', 'Goat', 'Sheep', 'Dog', 'Cat', 'Rabbit') AND litter_expected = false;

UPDATE master_species SET gestation_days = v.days
  FROM (VALUES ('Cattle', 283), ('Buffalo', 315), ('Horse', 340), ('Donkey', 365), ('Pig', 114), ('Sheep', 148),
               ('Goat', 150), ('Camel', 390), ('Dog', 63), ('Cat', 65), ('Rabbit', 31)) AS v(code, days)
 WHERE master_species.code = v.code AND master_species.gestation_days IS NULL;

UPDATE master_species SET incubation_days = 21 WHERE code = 'Chicken' AND incubation_days IS NULL;

UPDATE master_species SET birth_event_term = v.term
  FROM (VALUES ('Cattle', 'calving'), ('Buffalo', 'calving'), ('Yak', 'calving'), ('Camel', 'calving'),
               ('Goat', 'kidding'), ('Sheep', 'lambing'), ('Pig', 'farrowing'),
               ('Horse', 'foaling'), ('Donkey', 'foaling'),
               ('Chicken', 'hatching'), ('Duck', 'hatching'), ('Turkey', 'hatching'), ('Quail', 'hatching'),
               ('Emu', 'hatching'), ('Ostrich', 'hatching'), ('Peacock', 'hatching')) AS v(code, term)
 WHERE master_species.code = v.code AND master_species.birth_event_term = 'birth';

CREATE INDEX IF NOT EXISTS idx_master_species_farm_segment ON master_species(farm_segment);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ANIMAL CLASSES
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE master_animal_classes ADD COLUMN IF NOT EXISTS can_lay_eggs BOOLEAN NOT NULL DEFAULT false;
-- A juvenile is never asked about pregnancy, births or production, whatever its gender.
ALTER TABLE master_animal_classes ADD COLUMN IF NOT EXISTS is_juvenile BOOLEAN NOT NULL DEFAULT false;

UPDATE master_animal_classes SET is_juvenile = true
 WHERE is_juvenile = false
   AND value IN ('cattle_calf', 'cattle_bull_calf', 'cattle_heifer_calf',
                 'buffalo_calf', 'buffalo_bull_calf', 'buffalo_heifer_calf',
                 'sheep_lamb', 'sheep_ram_lamb', 'sheep_ewe_lamb',
                 'goat_kid', 'goat_buckling', 'dog_pup', 'cat_kitten');

-- Classes for the species that had none. Labels live on the row (label + per-locale columns)
-- rather than in the i18n files, so an admin can correct a word without a deploy.
INSERT INTO master_animal_classes
  (species_id, value, label, implied_gender, can_be_pregnant, can_produce_milk, can_lay_eggs, is_juvenile, sort_order,
   label_hi, label_kn, label_ml, label_ta, label_te)
SELECT s.id, v.value, v.label, v.gender, v.preg, v.milk, v.eggs, v.juv, v.sort_order, v.hi, v.kn, v.ml, v.ta, v.te
FROM (VALUES
  ('Pig',     'pig_piglet',      'Piglet',            'unknown', false, false, false, true,  50, 'सूअर का बच्चा', 'ಹಂದಿ ಮರಿ', 'പന്നിക്കുട്ടി', 'பன்றிக் குட்டி', 'పంది పిల్ల'),
  ('Horse',   'horse_stallion',  'Stallion',          'male',    false, false, false, false, 10, 'घोड़ा (नर)', 'ಗಂಡು ಕುದುರೆ', 'ആൺ കുതിര', 'ஆண் குதிரை', 'మగ గుర్రం'),
  ('Horse',   'horse_mare',      'Mare',              'female',  true,  true,  false, false, 20, 'घोड़ी', 'ಹೆಣ್ಣು ಕುದುರೆ', 'പെൺ കുതിര', 'பெண் குதிரை', 'ఆడ గుర్రం'),
  ('Horse',   'horse_gelding',   'Gelding',           'male',    false, false, false, false, 30, 'बधिया घोड़ा', 'ಬೀಜ ಒಡೆದ ಕುದುರೆ', 'വരിയുടച്ച കുതിര', 'காயடித்த குதிரை', 'విత్తులు కొట్టిన గుర్రం'),
  ('Horse',   'horse_colt',      'Colt',              'male',    false, false, false, true,  40, 'बछेड़ा', 'ಗಂಡು ಕುದುರೆ ಮರಿ', 'ആൺ കുതിരക്കുട്ടി', 'ஆண் குதிரைக் குட்டி', 'మగ గుర్రపు పిల్ల'),
  ('Horse',   'horse_filly',     'Filly',             'female',  false, false, false, true,  50, 'बछेड़ी', 'ಹೆಣ್ಣು ಕುದುರೆ ಮರಿ', 'പെൺ കുതിരക്കുട്ടി', 'பெண் குதிரைக் குட்டி', 'ఆడ గుర్రపు పిల్ల'),
  ('Horse',   'horse_foal',      'Foal',              'unknown', false, false, false, true,  60, 'घोड़े का बच्चा', 'ಕುದುರೆ ಮರಿ', 'കുതിരക്കുട്ടി', 'குதிரைக் குட்டி', 'గుర్రపు పిల్ల'),
  ('Donkey',  'donkey_jack',     'Jack',              'male',    false, false, false, false, 10, 'गधा (नर)', 'ಗಂಡು ಕತ್ತೆ', 'ആൺ കഴുത', 'ஆண் கழுதை', 'మగ గాడిద'),
  ('Donkey',  'donkey_jenny',    'Jenny',             'female',  true,  true,  false, false, 20, 'गधी', 'ಹೆಣ್ಣು ಕತ್ತೆ', 'പെൺ കഴുത', 'பெண் கழுதை', 'ఆడ గాడిద'),
  ('Donkey',  'donkey_foal',     'Donkey Foal',       'unknown', false, false, false, true,  30, 'गधे का बच्चा', 'ಕತ್ತೆ ಮರಿ', 'കഴുതക്കുട്ടി', 'கழுதைக் குட்டி', 'గాడిద పిల్ల'),
  ('Camel',   'camel_bull',      'Bull Camel',        'male',    false, false, false, false, 10, 'ऊँट (नर)', 'ಗಂಡು ಒಂಟೆ', 'ആൺ ഒട്ടകം', 'ஆண் ஒட்டகம்', 'మగ ఒంటె'),
  ('Camel',   'camel_cow',       'Cow Camel',         'female',  true,  true,  false, false, 20, 'ऊँटनी', 'ಹೆಣ್ಣು ಒಂಟೆ', 'പെൺ ഒട്ടകം', 'பெண் ஒட்டகம்', 'ఆడ ఒంటె'),
  ('Camel',   'camel_calf',      'Camel Calf',        'unknown', false, false, false, true,  30, 'ऊँट का बच्चा', 'ಒಂಟೆ ಮರಿ', 'ഒട്ടകക്കുട്ടി', 'ஒட்டகக் குட்டி', 'ఒంటె పిల్ల'),
  ('Yak',     'yak_bull',        'Yak Bull',          'male',    false, false, false, false, 10, 'याक (नर)', 'ಗಂಡು ಯಾಕ್', 'ആൺ യാക്ക്', 'ஆண் யாக்', 'మగ యాక్'),
  ('Yak',     'yak_cow',         'Yak Cow',           'female',  true,  true,  false, false, 20, 'मादा याक', 'ಹೆಣ್ಣು ಯಾಕ್', 'പെൺ യാക്ക്', 'பெண் யாக்', 'ఆడ యాక్'),
  ('Yak',     'yak_calf',        'Yak Calf',          'unknown', false, false, false, true,  30, 'याक का बछड़ा', 'ಯಾಕ್ ಕರು', 'യാക്ക് കിടാവ്', 'யாக் கன்று', 'యాక్ దూడ'),
  ('Chicken', 'chicken_cock',    'Cock',              'male',    false, false, false, false, 10, 'मुर्गा', 'ಹುಂಜ', 'പൂവൻകോഴി', 'சேவல்', 'కోడిపుంజు'),
  ('Chicken', 'chicken_hen',     'Hen',               'female',  false, false, true,  false, 20, 'मुर्गी', 'ಹೇಂಟೆ ಕೋಳಿ', 'പിടക്കോഴി', 'பெட்டைக் கோழி', 'కోడిపెట్ట'),
  ('Chicken', 'chicken_pullet',  'Pullet',            'female',  false, false, false, true,  30, 'युवा मुर्गी', 'ಎಳೆಯ ಹೇಂಟೆ', 'ഇളം പിടക്കോഴി', 'இளம் பெட்டைக் கோழி', 'పడుచు కోడిపెట్ట'),
  ('Chicken', 'chicken_cockerel','Cockerel',          'male',    false, false, false, true,  40, 'युवा मुर्गा', 'ಎಳೆಯ ಹುಂಜ', 'ഇളം പൂവൻകോഴി', 'இளம் சேவல்', 'పడుచు కోడిపుంజు'),
  ('Chicken', 'chicken_chick',   'Chick',             'unknown', false, false, false, true,  50, 'चूज़ा', 'ಕೋಳಿ ಮರಿ', 'കോഴിക്കുഞ്ഞ്', 'கோழிக்குஞ்சு', 'కోడిపిల్ల'),
  ('Duck',    'duck_drake',      'Drake',             'male',    false, false, false, false, 10, 'नर बत्तख', 'ಗಂಡು ಬಾತುಕೋಳಿ', 'ആൺ താറാവ്', 'ஆண் வாத்து', 'మగ బాతు'),
  ('Duck',    'duck_hen',        'Duck (female)',     'female',  false, false, true,  false, 20, 'मादा बत्तख', 'ಹೆಣ್ಣು ಬಾತುಕೋಳಿ', 'പെൺ താറാവ്', 'பெண் வாத்து', 'ఆడ బాతు'),
  ('Duck',    'duck_duckling',   'Duckling',          'unknown', false, false, false, true,  30, 'बत्तख का बच्चा', 'ಬಾತುಕೋಳಿ ಮರಿ', 'താറാവിൻകുഞ്ഞ്', 'வாத்துக் குஞ்சு', 'బాతు పిల్ల'),
  ('Turkey',  'turkey_tom',      'Tom',               'male',    false, false, false, false, 10, 'नर टर्की', 'ಗಂಡು ಟರ್ಕಿ ಕೋಳಿ', 'ആൺ ടർക്കി', 'ஆண் வான்கோழி', 'మగ టర్కీ కోడి'),
  ('Turkey',  'turkey_hen',      'Turkey Hen',        'female',  false, false, true,  false, 20, 'मादा टर्की', 'ಹೆಣ್ಣು ಟರ್ಕಿ ಕೋಳಿ', 'പെൺ ടർക്കി', 'பெண் வான்கோழி', 'ఆడ టర్కీ కోడి'),
  ('Turkey',  'turkey_poult',    'Poult',             'unknown', false, false, false, true,  30, 'टर्की का चूज़ा', 'ಟರ್ಕಿ ಕೋಳಿ ಮರಿ', 'ടർക്കിക്കുഞ്ഞ്', 'வான்கோழிக் குஞ்சு', 'టర్కీ కోడి పిల్ల'),
  ('Quail',   'quail_cock',      'Male Quail',        'male',    false, false, false, false, 10, 'नर बटेर', 'ಗಂಡು ಲಾವಕ್ಕಿ', 'ആൺ കാട', 'ஆண் காடை', 'మగ కౌజు పిట్ట'),
  ('Quail',   'quail_hen',       'Female Quail',      'female',  false, false, true,  false, 20, 'मादा बटेर', 'ಹೆಣ್ಣು ಲಾವಕ್ಕಿ', 'പെൺ കാട', 'பெண் காடை', 'ఆడ కౌజు పిట్ట'),
  ('Quail',   'quail_chick',     'Quail Chick',       'unknown', false, false, false, true,  30, 'बटेर का चूज़ा', 'ಲಾವಕ್ಕಿ ಮರಿ', 'കാടക്കുഞ്ഞ്', 'காடைக் குஞ்சு', 'కౌజు పిట్ట పిల్ల')
) AS v(species_code, value, label, gender, preg, milk, eggs, juv, sort_order, hi, kn, ml, ta, te)
JOIN master_species s ON s.code = v.species_code
ON CONFLICT (species_id, value) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. GROUP TYPES
-- ─────────────────────────────────────────────────────────────────────────────
-- A group type is a life stage or a purpose ("Lactating cows", "Layers", "Nursery pond"), not a
-- kind of housing. It belongs EITHER to one species (cattle and goat words differ) OR to a whole
-- farm segment (every pond-raised species shares the same culture stages) - never both.
-- animal_groups.group_type keeps storing the value as plain text, and the old generic values
-- (herd, flock, pen, ...) stay valid, so no existing group breaks.

CREATE TABLE IF NOT EXISTS master_group_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species_id UUID REFERENCES master_species(id) ON DELETE CASCADE,
  farm_segment VARCHAR(30),
  value VARCHAR(50) NOT NULL,
  label_key VARCHAR(150),
  label VARCHAR(100) NOT NULL,
  icon VARCHAR(10),
  -- Mode this group type implies (NULL = no opinion, the species default applies).
  management_mode VARCHAR(20),
  -- Animal class the group usually holds, used to pre-select the class when adding an animal.
  suggested_class VARCHAR(50),
  -- Isolation / quarantine: animals here are being held for health reasons.
  is_health_hold BOOLEAN NOT NULL DEFAULT false,
  -- Whether a group-level milk / egg total can be recorded for this group.
  yields_milk BOOLEAN NOT NULL DEFAULT false,
  yields_eggs BOOLEAN NOT NULL DEFAULT false,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  label_hi VARCHAR(150),
  label_kn VARCHAR(150),
  label_ml VARCHAR(150),
  label_ta VARCHAR(150),
  label_te VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT master_group_types_scope_ck CHECK ((species_id IS NOT NULL) <> (farm_segment IS NOT NULL)),
  CONSTRAINT master_group_types_segment_ck CHECK (farm_segment IS NULL OR farm_segment IN
    ('dairy', 'small_ruminant', 'pig', 'poultry', 'aquaculture', 'equine', 'other_livestock', 'pet')),
  CONSTRAINT master_group_types_mode_ck CHECK (management_mode IS NULL OR management_mode IN ('individual', 'batch'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_master_group_types_species_value
  ON master_group_types(species_id, value) WHERE species_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_master_group_types_segment_value
  ON master_group_types(farm_segment, value) WHERE farm_segment IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_master_group_types_active ON master_group_types(is_active);

-- Per-species group types (the farmer's own lists; buffalo is the same as cattle incl. bullocks, D14).
INSERT INTO master_group_types
  (species_id, value, label, icon, management_mode, suggested_class, is_health_hold, yields_milk, yields_eggs, sort_order,
   label_hi, label_kn, label_ml, label_ta, label_te)
SELECT s.id, v.value, v.label, v.icon, v.mode, v.suggested_class, v.hold, v.milk, false, v.sort_order, v.hi, v.kn, v.ml, v.ta, v.te
FROM (VALUES
  ('Cattle',  'calf_pen',   'Calf pen',                     '🍼', 'individual', 'cattle_calf',     false, false, 10, 'बछड़ा बाड़ा', 'ಕರುಗಳ ದೊಡ್ಡಿ', 'കിടാക്കളുടെ കൂട്', 'கன்று கொட்டகை', 'దూడల పాక'),
  ('Cattle',  'heifers',    'Heifers',                      '🐄', 'individual', 'cattle_heifer',   false, false, 20, 'बछिया (कलोर)', 'ಕಡಸುಗಳು', 'കിടാരികൾ', 'கிடேரிகள்', 'పెయ్యలు'),
  ('Cattle',  'lactating',  'Lactating cows',               '🥛', 'individual', 'cattle_cow',      false, true,  30, 'दूध देने वाली गायें', 'ಹಾಲು ಕೊಡುವ ಹಸುಗಳು', 'കറവപ്പശുക്കൾ', 'கறவை மாடுகள்', 'పాలిచ్చే ఆవులు'),
  ('Cattle',  'pregnant',   'Pregnant cows',                '🤰', 'individual', 'cattle_cow',      false, false, 40, 'गाभिन गायें', 'ಗಬ್ಬದ ಹಸುಗಳು', 'ചെനയുള്ള പശുക്കൾ', 'சினை மாடுகள்', 'చూడి ఆవులు'),
  ('Cattle',  'dry',        'Dry cows',                     '⏸️', 'individual', 'cattle_cow',      false, false, 50, 'सूखी गायें', 'ಬತ್ತಿದ ಹಸುಗಳು', 'കറവ വറ്റിയ പശുക്കൾ', 'பால் வற்றிய மாடுகள்', 'వట్టిపోయిన ఆవులు'),
  ('Cattle',  'bulls',      'Bulls',                        '🐂', 'individual', 'cattle_bull',     false, false, 60, 'साँड', 'ಹೋರಿಗಳು', 'വിത്തുകാളകൾ', 'பொலி காளைகள்', 'ఆంబోతులు'),
  ('Cattle',  'bullocks',   'Bullocks',                     '🐂', 'individual', 'cattle_bullock',  false, false, 70, 'बैल', 'ಎತ್ತುಗಳು', 'ഉഴവുകാളകൾ', 'எருதுகள்', 'ఎద్దులు'),
  ('Cattle',  'isolation',  'Isolation pen (sick animals)', '🩺', NULL,         NULL,              true,  false, 80, 'बीमार पशु बाड़ा', 'ರೋಗಿ ಪ್ರಾಣಿಗಳ ಪ್ರತ್ಯೇಕ ದೊಡ್ಡಿ', 'രോഗമുള്ളവയ്ക്കുള്ള പ്രത്യേക കൂട്', 'நோயுற்ற கால்நடை தனிக் கொட்டகை', 'జబ్బు పశువుల ప్రత్యేక పాక'),
  ('Cattle',  'quarantine', 'Quarantine shed',              '🚧', NULL,         NULL,              true,  false, 90, 'क्वारंटीन शेड (नए पशु)', 'ಕ್ವಾರಂಟೈನ್ ಶೆಡ್', 'ക്വാറന്റൈൻ ഷെഡ്', 'தனிமைப்படுத்தும் கொட்டகை', 'క్వారంటైన్ షెడ్'),
  ('Buffalo', 'calf_pen',   'Calf pen',                     '🍼', 'individual', 'buffalo_calf',    false, false, 10, 'कटड़ा बाड़ा', 'ಕರುಗಳ ದೊಡ್ಡಿ', 'കിടാക്കളുടെ കൂട്', 'கன்று கொட்டகை', 'దూడల పాక'),
  ('Buffalo', 'heifers',    'Heifers',                      '🐃', 'individual', 'buffalo_heifer',  false, false, 20, 'झोटी (पड़िया)', 'ಎಮ್ಮೆ ಕಡಸುಗಳು', 'എരുമക്കിടാരികൾ', 'எருமைக் கிடேரிகள்', 'పడ్డలు'),
  ('Buffalo', 'lactating',  'Lactating buffaloes',          '🥛', 'individual', 'buffalo_cow',     false, true,  30, 'दूध देने वाली भैंसें', 'ಹಾಲು ಕೊಡುವ ಎಮ್ಮೆಗಳು', 'കറവ എരുമകൾ', 'கறவை எருமைகள்', 'పాలిచ్చే గేదెలు'),
  ('Buffalo', 'pregnant',   'Pregnant buffaloes',           '🤰', 'individual', 'buffalo_cow',     false, false, 40, 'गाभिन भैंसें', 'ಗಬ್ಬದ ಎಮ್ಮೆಗಳು', 'ചെനയുള്ള എരുമകൾ', 'சினை எருமைகள்', 'చూడి గేదెలు'),
  ('Buffalo', 'dry',        'Dry buffaloes',                '⏸️', 'individual', 'buffalo_cow',     false, false, 50, 'सूखी भैंसें', 'ಬತ್ತಿದ ಎಮ್ಮೆಗಳು', 'കറവ വറ്റിയ എരുമകൾ', 'பால் வற்றிய எருமைகள்', 'వట్టిపోయిన గేదెలు'),
  ('Buffalo', 'bulls',      'Buffalo bulls',                '🐃', 'individual', 'buffalo_bull',    false, false, 60, 'भैंसा साँड', 'ಕೋಣಗಳು', 'വിത്തുപോത്തുകൾ', 'பொலி எருமைக் கடாக்கள்', 'దున్నపోతులు'),
  ('Buffalo', 'bullocks',   'Buffalo bullocks',             '🐃', 'individual', 'buffalo_bullock', false, false, 70, 'जोतने वाले भैंसे', 'ಉಳುವ ಕೋಣಗಳು', 'ഉഴവുപോത്തുകൾ', 'உழவு எருமைக் கடாக்கள்', 'పని దున్నలు'),
  ('Buffalo', 'isolation',  'Isolation pen (sick animals)', '🩺', NULL,         NULL,              true,  false, 80, 'बीमार पशु बाड़ा', 'ರೋಗಿ ಪ್ರಾಣಿಗಳ ಪ್ರತ್ಯೇಕ ದೊಡ್ಡಿ', 'രോഗമുള്ളവയ്ക്കുള്ള പ്രത്യേക കൂട്', 'நோயுற்ற கால்நடை தனிக் கொட்டகை', 'జబ్బు పశువుల ప్రత్యేక పాక'),
  ('Buffalo', 'quarantine', 'Quarantine shed',              '🚧', NULL,         NULL,              true,  false, 90, 'क्वारंटीन शेड (नए पशु)', 'ಕ್ವಾರಂಟೈನ್ ಶೆಡ್', 'ക്വാറന്റൈൻ ഷെഡ്', 'தனிமைப்படுத்தும் கொட்டகை', 'క్వారంటైన్ షెడ్'),
  ('Goat',    'kids',       'Kids',                         '🍼', NULL,         'goat_kid',        false, false, 10, 'मेमने', 'ಮೇಕೆ ಮರಿಗಳು', 'ആട്ടിൻകുട്ടികൾ', 'ஆட்டுக் குட்டிகள்', 'మేక పిల్లలు'),
  ('Goat',    'bucks',      'Bucks',                        '🐐', NULL,         'goat_buck',       false, false, 20, 'बकरे', 'ಹೋತಗಳು', 'മുട്ടനാടുകൾ', 'கிடாக்கள்', 'మేకపోతులు'),
  ('Goat',    'does',       'Does',                         '🐐', NULL,         'goat_doe',        false, true,  30, 'बकरियाँ', 'ಹೆಣ್ಣು ಮೇಕೆಗಳು', 'പെണ്ണാടുകൾ', 'பெட்டை ஆடுகள்', 'ఆడ మేకలు'),
  ('Goat',    'fatteners',  'Fatteners',                    '⚖️', NULL,         NULL,              false, false, 40, 'मांस के लिए पाले जा रहे', 'ಕೊಬ್ಬಿಸುವ ಮೇಕೆಗಳು', 'ഇറച്ചിക്കായി വളർത്തുന്നവ', 'இறைச்சிக்காக வளர்க்கும் ஆடுகள்', 'మాంసం కోసం పెంచే మేకలు'),
  ('Goat',    'isolation',  'Isolation pen (sick animals)', '🩺', NULL,         NULL,              true,  false, 80, 'बीमार पशु बाड़ा', 'ರೋಗಿ ಪ್ರಾಣಿಗಳ ಪ್ರತ್ಯೇಕ ದೊಡ್ಡಿ', 'രോഗമുള്ളവയ്ക്കുള്ള പ്രത്യേക കൂട്', 'நோயுற்ற கால்நடை தனிக் கொட்டகை', 'జబ్బు పశువుల ప్రత్యేక పాక'),
  ('Goat',    'quarantine', 'Quarantine shed',              '🚧', NULL,         NULL,              true,  false, 90, 'क्वारंटीन शेड (नए पशु)', 'ಕ್ವಾರಂಟೈನ್ ಶೆಡ್', 'ക്വാറന്റൈൻ ഷെഡ്', 'தனிமைப்படுத்தும் கொட்டகை', 'క్వారంటైన్ షెడ్'),
  ('Sheep',   'lambs',      'Lambs',                        '🍼', NULL,         'sheep_lamb',      false, false, 10, 'मेमने', 'ಕುರಿ ಮರಿಗಳು', 'ചെമ്മരിയാട്ടിൻകുട്ടികൾ', 'செம்மறிக் குட்டிகள்', 'గొర్రె పిల్లలు'),
  ('Sheep',   'rams',       'Rams',                         '🐏', NULL,         'sheep_ram',       false, false, 20, 'मेढ़े', 'ಟಗರುಗಳು', 'മുട്ടൻ ചെമ്മരിയാടുകൾ', 'செம்மறிக் கிடாக்கள்', 'పొట్టేళ్లు'),
  ('Sheep',   'ewes',       'Ewes',                         '🐑', NULL,         'sheep_ewe',       false, true,  30, 'भेड़ें', 'ಹೆಣ್ಣು ಕುರಿಗಳು', 'പെൺ ചെമ്മരിയാടുകൾ', 'பெட்டைச் செம்மறி ஆடுகள்', 'ఆడ గొర్రెలు'),
  ('Sheep',   'fatteners',  'Fatteners',                    '⚖️', NULL,         NULL,              false, false, 40, 'मांस के लिए पाले जा रहे', 'ಕೊಬ್ಬಿಸುವ ಕುರಿಗಳು', 'ഇറച്ചിക്കായി വളർത്തുന്നവ', 'இறைச்சிக்காக வளர்க்கும் செம்மறி ஆடுகள்', 'మాంసం కోసం పెంచే గొర్రెలు'),
  ('Sheep',   'isolation',  'Isolation pen (sick animals)', '🩺', NULL,         NULL,              true,  false, 80, 'बीमार पशु बाड़ा', 'ರೋಗಿ ಪ್ರಾಣಿಗಳ ಪ್ರತ್ಯೇಕ ದೊಡ್ಡಿ', 'രോഗമുള്ളവയ്ക്കുള്ള പ്രത്യേക കൂട്', 'நோயுற்ற கால்நடை தனிக் கொட்டகை', 'జబ్బు పశువుల ప్రత్యేక పాక'),
  ('Sheep',   'quarantine', 'Quarantine shed',              '🚧', NULL,         NULL,              true,  false, 90, 'क्वारंटीन शेड (नए पशु)', 'ಕ್ವಾರಂಟೈನ್ ಶೆಡ್', 'ക്വാറന്റൈൻ ഷെഡ്', 'தனிமைப்படுத்தும் கொட்டகை', 'క్వారంటైన్ షెడ్'),
  ('Pig',     'piglets',    'Piglets',                      '🍼', NULL,         'pig_piglet',      false, false, 10, 'सूअर के बच्चे', 'ಹಂದಿ ಮರಿಗಳು', 'പന്നിക്കുട്ടികൾ', 'பன்றிக் குட்டிகள்', 'పంది పిల్లలు'),
  ('Pig',     'boars',      'Boars',                        '🐗', 'individual', 'pig_boar',        false, false, 20, 'नर सूअर', 'ಗಂಡು ಹಂದಿಗಳು', 'ആൺപന്നികൾ', 'ஆண் பன்றிகள்', 'మగ పందులు'),
  ('Pig',     'sows',       'Sows',                         '🐖', 'individual', 'pig_sow',         false, false, 30, 'मादा सूअर', 'ತಾಯಿ ಹಂದಿಗಳು', 'തള്ളപ്പന്നികൾ', 'தாய்ப் பன்றிகள்', 'తల్లి పందులు'),
  ('Pig',     'gilts',      'Gilts',                        '🐖', 'individual', 'pig_gilt',        false, false, 40, 'युवा मादा सूअर', 'ಎಳೆಯ ಹೆಣ್ಣು ಹಂದಿಗಳು', 'ഇളം പെൺപന്നികൾ', 'இளம் பெண் பன்றிகள்', 'పడుచు ఆడ పందులు'),
  ('Pig',     'fatteners',  'Fatteners',                    '⚖️', 'batch',      NULL,              false, false, 50, 'मांस के लिए पाले जा रहे', 'ಕೊಬ್ಬಿಸುವ ಹಂದಿಗಳು', 'ഇറച്ചിക്കായി വളർത്തുന്നവ', 'இறைச்சிக்காக வளர்க்கும் பன்றிகள்', 'మాంసం కోసం పెంచే పందులు'),
  ('Pig',     'isolation',  'Isolation pen (sick animals)', '🩺', NULL,         NULL,              true,  false, 80, 'बीमार पशु बाड़ा', 'ರೋಗಿ ಪ್ರಾಣಿಗಳ ಪ್ರತ್ಯೇಕ ದೊಡ್ಡಿ', 'രോഗമുള്ളവയ്ക്കുള്ള പ്രത്യേക കൂട്', 'நோயுற்ற கால்நடை தனிக் கொட்டகை', 'జబ్బు పశువుల ప్రత్యేక పాక'),
  ('Pig',     'quarantine', 'Quarantine shed',              '🚧', NULL,         NULL,              true,  false, 90, 'क्वारंटीन शेड (नए पशु)', 'ಕ್ವಾರಂಟೈನ್ ಶೆಡ್', 'ക്വാറന്റൈൻ ഷെഡ്', 'தனிமைப்படுத்தும் கொட்டகை', 'క్వారంటైన్ షెడ్')
) AS v(species_code, value, label, icon, mode, suggested_class, hold, milk, sort_order, hi, kn, ml, ta, te)
JOIN master_species s ON s.code = v.species_code
ON CONFLICT (species_id, value) WHERE species_id IS NOT NULL DO NOTHING;

-- Per-segment group types (shared by every species of the segment).
-- Aquaculture stages are named as the sources name them: TNAU's three-tier carp system
-- (nursery -> rearing -> stocking/grow-out pond), brood stock pond, breeding and cement tanks
-- (TNAU murrel page); cage, hapa, recirculatory system (ICAR-CIBA).
INSERT INTO master_group_types
  (farm_segment, value, label, icon, management_mode, is_health_hold, yields_milk, yields_eggs, sort_order,
   label_hi, label_kn, label_ml, label_ta, label_te)
VALUES
  ('poultry', 'broilers',        'Broilers',                 '🍗', 'batch', false, false, false, 10, 'ब्रॉयलर (मांस की मुर्गी)', 'ಬ್ರಾಯ್ಲರ್ (ಮಾಂಸದ ಕೋಳಿ)', 'ബ്രോയിലർ (ഇറച്ചിക്കോഴി)', 'கறிக்கோழி (பிராய்லர்)', 'బ్రాయిలర్ (మాంసం కోళ్లు)'),
  ('poultry', 'layers',          'Layers',                   '🥚', 'batch', false, false, true,  20, 'लेयर (अंडे देने वाली)', 'ಲೇಯರ್ (ಮೊಟ್ಟೆ ಕೋಳಿ)', 'ലെയർ (മുട്ടക്കോഴി)', 'முட்டைக்கோழி (லேயர்)', 'లేయర్ (గుడ్ల కోళ్లు)'),
  ('poultry', 'breeders',        'Breeders',                 '🐓', 'batch', false, false, true,  30, 'ब्रीडर (प्रजनन झुंड)', 'ಬ್ರೀಡರ್ (ತಳಿ ಕೋಳಿ)', 'ബ്രീഡർ (പ്രജനന കൂട്ടം)', 'இனப்பெருக்கக் கோழிகள்', 'బ్రీడర్ (సంతానోత్పత్తి కోళ్లు)'),
  ('poultry', 'chicks_brooding', 'Chicks (brooding)',        '🐥', 'batch', false, false, false, 40, 'चूज़े (ब्रूडिंग)', 'ಮರಿಗಳು (ಬ್ರೂಡಿಂಗ್)', 'കുഞ്ഞുങ്ങൾ (ബ്രൂഡിംഗ്)', 'குஞ்சுகள் (அடைகாப்பு)', 'పిల్లలు (బ్రూడింగ్)'),
  ('poultry', 'growers',         'Growers',                  '🐔', 'batch', false, false, false, 50, 'ग्रोअर (बढ़ते पक्षी)', 'ಗ್ರೋವರ್ (ಬೆಳೆಯುವ ಕೋಳಿ)', 'ഗ്രോവർ (വളരുന്നവ)', 'வளரும் கோழிகள்', 'గ్రోవర్ (పెరుగుతున్న కోళ్లు)'),
  ('poultry', 'backyard_flock',  'Backyard flock',           '🏡', NULL,    false, false, true,  60, 'घर-आँगन का झुंड', 'ಹಿತ್ತಲ ಕೋಳಿಗಳು', 'വീട്ടുവളപ്പിലെ കോഴികൾ', 'புறக்கடைக் கோழிகள்', 'పెరటి కోళ్లు'),
  ('poultry', 'isolation',       'Isolation pen (sick birds)', '🩺', NULL,  true,  false, false, 80, 'बीमार पक्षी बाड़ा', 'ರೋಗಿ ಪಕ್ಷಿಗಳ ಪ್ರತ್ಯೇಕ ಗೂಡು', 'രോഗമുള്ളവയ്ക്കുള്ള പ്രത്യേക കൂട്', 'நோயுற்ற பறவைகள் தனிக் கூண்டு', 'జబ్బు పక్షుల ప్రత్యేక గూడు'),
  ('poultry', 'quarantine',      'Quarantine shed',          '🚧', NULL,    true,  false, false, 90, 'क्वारंटीन शेड (नए पक्षी)', 'ಕ್ವಾರಂಟೈನ್ ಶೆಡ್', 'ക്വാറന്റൈൻ ഷെഡ്', 'தனிமைப்படுத்தும் கொட்டகை', 'క్వారంటైన్ షెడ్'),
  ('aquaculture', 'nursery_pond',         'Nursery pond',              '🌱', 'batch', false, false, false, 10, 'नर्सरी तालाब', 'ನರ್ಸರಿ ಕೊಳ', 'നഴ്സറി കുളം', 'நாற்றங்கால் குளம்', 'నర్సరీ చెరువు'),
  ('aquaculture', 'rearing_pond',         'Rearing pond',              '🐟', 'batch', false, false, false, 20, 'पालन तालाब', 'ಪಾಲನಾ ಕೊಳ', 'വളർത്തു കുളം', 'வளர்ப்புக் குளம்', 'పెంపకం చెరువు'),
  ('aquaculture', 'grow_out_pond',        'Grow-out (stocking) pond',  '🌊', 'batch', false, false, false, 30, 'संचयन (ग्रो-आउट) तालाब', 'ಬೆಳವಣಿಗೆ (ಗ್ರೋ-ಔಟ್) ಕೊಳ', 'ഗ്രോ-ഔട്ട് കുളം', 'இருப்புக் குளம் (வளர்ச்சிக் குளம்)', 'గ్రో-అవుట్ చెరువు'),
  ('aquaculture', 'broodstock_pond',      'Brood stock pond',          '🐠', 'batch', false, false, false, 40, 'प्रजनक मछली तालाब', 'ತಾಯಿ ಮೀನು ಕೊಳ', 'തള്ളമത്സ്യ കുളം', 'தாய் மீன் குளம்', 'తల్లి చేపల చెరువు'),
  ('aquaculture', 'breeding_tank',        'Breeding tank',             '🫧', 'batch', false, false, false, 50, 'प्रजनन टैंक', 'ಸಂತಾನೋತ್ಪತ್ತಿ ತೊಟ್ಟಿ', 'പ്രജനന ടാങ്ക്', 'இனப்பெருக்கத் தொட்டி', 'సంతానోత్పత్తి ట్యాంక్'),
  ('aquaculture', 'cement_tank',          'Cement tank',               '🧱', 'batch', false, false, false, 60, 'सीमेंट टैंक', 'ಸಿಮೆಂಟ್ ತೊಟ್ಟಿ', 'സിമന്റ് ടാങ്ക്', 'சிமெண்ட் தொட்டி', 'సిమెంట్ ట్యాంక్'),
  ('aquaculture', 'cage',                 'Cage',                      '🔲', 'batch', false, false, false, 70, 'पिंजरा (केज)', 'ಪಂಜರ (ಕೇಜ್)', 'കൂട് (കേജ്)', 'கூண்டு', 'పంజరం (కేజ్)'),
  ('aquaculture', 'hapa',                 'Hapa',                      '🕸️', 'batch', false, false, false, 80, 'हापा', 'ಹಾಪಾ', 'ഹാപ്പ', 'ஹாப்பா', 'హాపా'),
  ('aquaculture', 'recirculatory_system', 'Recirculatory system (RAS)', '🔄', 'batch', false, false, false, 90, 'पुनर्चक्रण प्रणाली (RAS)', 'ಮರುಪರಿಚಲನೆ ವ್ಯವಸ್ಥೆ (RAS)', 'പുനഃചംക്രമണ സംവിധാനം (RAS)', 'மறுசுழற்சி நீர் அமைப்பு (RAS)', 'పునఃప్రసరణ వ్యవస్థ (RAS)'),
  ('aquaculture', 'quarantine_tank',      'Quarantine tank',           '🚧', 'batch', true,  false, false, 100, 'क्वारंटीन टैंक', 'ಕ್ವಾರಂಟೈನ್ ತೊಟ್ಟಿ', 'ക്വാറന്റൈൻ ടാങ്ക്', 'தனிமைப்படுத்தும் தொட்டி', 'క్వారంటైన్ ట్యాంక్'),
  ('equine', 'breeding_males',   'Breeding males',            '🐴', 'individual', false, false, false, 10, 'प्रजनन नर', 'ತಳಿ ಗಂಡುಗಳು', 'പ്രജനന ആൺമൃഗങ്ങൾ', 'இனப்பெருக்க ஆண்கள்', 'సంతానోత్పత్తి మగవి'),
  ('equine', 'breeding_females', 'Breeding females',          '🐴', 'individual', false, true,  false, 20, 'प्रजनन मादा', 'ತಳಿ ಹೆಣ್ಣುಗಳು', 'പ്രജനന പെൺമൃഗങ്ങൾ', 'இனப்பெருக்கப் பெண்கள்', 'సంతానోత్పత్తి ఆడవి'),
  ('equine', 'young_stock',      'Young stock',               '🍼', 'individual', false, false, false, 30, 'छोटे पशु', 'ಎಳೆಯ ಪ್ರಾಣಿಗಳು', 'ഇളം മൃഗങ്ങൾ', 'இளம் கால்நடைகள்', 'పిల్ల పశువులు'),
  ('equine', 'working_animals',  'Working animals',           '🛒', 'individual', false, false, false, 40, 'काम करने वाले पशु', 'ದುಡಿಯುವ ಪ್ರಾಣಿಗಳು', 'പണിമൃഗങ്ങൾ', 'வேலை கால்நடைகள்', 'పని పశువులు'),
  ('equine', 'isolation',        'Isolation pen (sick animals)', '🩺', NULL,      true,  false, false, 80, 'बीमार पशु बाड़ा', 'ರೋಗಿ ಪ್ರಾಣಿಗಳ ಪ್ರತ್ಯೇಕ ದೊಡ್ಡಿ', 'രോഗമുള്ളവയ്ക്കുള്ള പ്രത്യേക കൂട്', 'நோயுற்ற கால்நடை தனிக் கொட்டகை', 'జబ్బు పశువుల ప్రత్యేక పాక'),
  ('equine', 'quarantine',       'Quarantine shed',           '🚧', NULL,         true,  false, false, 90, 'क्वारंटीन शेड (नए पशु)', 'ಕ್ವಾರಂಟೈನ್ ಶೆಡ್', 'ക്വാറന്റൈൻ ഷെഡ്', 'தனிமைப்படுத்தும் கொட்டகை', 'క్వారంటైన్ షెడ్'),
  ('other_livestock', 'breeding_males',   'Breeding males',   '🐪', 'individual', false, false, false, 10, 'प्रजनन नर', 'ತಳಿ ಗಂಡುಗಳು', 'പ്രജനന ആൺമൃഗങ്ങൾ', 'இனப்பெருக்க ஆண்கள்', 'సంతానోత్పత్తి మగవి'),
  ('other_livestock', 'breeding_females', 'Breeding females', '🐪', 'individual', false, true,  false, 20, 'प्रजनन मादा', 'ತಳಿ ಹೆಣ್ಣುಗಳು', 'പ്രജനന പെൺമൃഗങ്ങൾ', 'இனப்பெருக்கப் பெண்கள்', 'సంతానోత్పత్తి ఆడవి'),
  ('other_livestock', 'young_stock',      'Young stock',      '🍼', 'individual', false, false, false, 30, 'छोटे पशु', 'ಎಳೆಯ ಪ್ರಾಣಿಗಳು', 'ഇളം മൃഗങ്ങൾ', 'இளம் கால்நடைகள்', 'పిల్ల పశువులు'),
  ('other_livestock', 'working_animals',  'Working animals',  '🛒', 'individual', false, false, false, 40, 'काम करने वाले पशु', 'ದುಡಿಯುವ ಪ್ರಾಣಿಗಳು', 'പണിമൃഗങ്ങൾ', 'வேலை கால்நடைகள்', 'పని పశువులు'),
  ('other_livestock', 'isolation',        'Isolation pen (sick animals)', '🩺', NULL, true, false, false, 80, 'बीमार पशु बाड़ा', 'ರೋಗಿ ಪ್ರಾಣಿಗಳ ಪ್ರತ್ಯೇಕ ದೊಡ್ಡಿ', 'രോഗമുള്ളവയ്ക്കുള്ള പ്രത്യേക കൂട്', 'நோயுற்ற கால்நடை தனிக் கொட்டகை', 'జబ్బు పశువుల ప్రత్యేక పాక'),
  ('other_livestock', 'quarantine',       'Quarantine shed',  '🚧', NULL,         true,  false, false, 90, 'क्वारंटीन शेड (नए पशु)', 'ಕ್ವಾರಂಟೈನ್ ಶೆಡ್', 'ക്വാറന്റൈൻ ഷെഡ്', 'தனிமைப்படுத்தும் கொட்டகை', 'క్వారంటైన్ షెడ్')
ON CONFLICT (farm_segment, value) WHERE farm_segment IS NOT NULL DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RECORD TYPES AND THEIR RULES
-- ─────────────────────────────────────────────────────────────────────────────
-- A record type is something the farmer writes down: a DAILY record (milk, eggs, feed, deaths,
-- water quality) or an EVENT (heat, mating, birth, stocking, harvest, sale ...). The rules say
-- when it applies. A record type applies when ANY of its rules matches; a rule matches when
-- every condition it states holds (NULL = "any"). The 'pet' segment gets no farm record types
-- unless a rule names it. The application code that captures a record keys off `code`, so codes
-- are protected - labels, icons, order and rules are what an admin tunes.

CREATE TABLE IF NOT EXISTS master_record_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) UNIQUE NOT NULL,
  kind VARCHAR(10) NOT NULL,
  subject VARCHAR(10) NOT NULL DEFAULT 'either',
  label_key VARCHAR(150),
  label VARCHAR(100) NOT NULL,
  icon VARCHAR(10),
  unit VARCHAR(20),
  -- The fields the entry form captures, e.g. [{"key":"quantity","type":"number","required":true}].
  fields JSONB NOT NULL DEFAULT '[]',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_protected BOOLEAN NOT NULL DEFAULT true,
  label_hi VARCHAR(150),
  label_kn VARCHAR(150),
  label_ml VARCHAR(150),
  label_ta VARCHAR(150),
  label_te VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT master_record_types_kind_ck CHECK (kind IN ('daily', 'event')),
  CONSTRAINT master_record_types_subject_ck CHECK (subject IN ('animal', 'group', 'either'))
);

CREATE TABLE IF NOT EXISTS master_record_type_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type_id UUID NOT NULL REFERENCES master_record_types(id) ON DELETE CASCADE,
  -- Stable name for the rule so the seed below is idempotent and a rule can be found again.
  rule_key VARCHAR(60) NOT NULL,
  farm_segment VARCHAR(30),
  management_mode VARCHAR(20),
  -- Species capability the record needs (produces_milk / produces_eggs / produces_wool).
  requires_species_flag VARCHAR(30),
  -- NULL = any; true = aquatic species only; false = non-aquatic only.
  aquatic BOOLEAN,
  -- Class capability the ANIMAL needs when the subject is one animal.
  requires_class_flag VARCHAR(30),
  -- Group-type capability the GROUP needs when the subject is a whole group.
  requires_group_flag VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (record_type_id, rule_key),
  CONSTRAINT master_record_rules_segment_ck CHECK (farm_segment IS NULL OR farm_segment IN
    ('dairy', 'small_ruminant', 'pig', 'poultry', 'aquaculture', 'equine', 'other_livestock', 'pet')),
  CONSTRAINT master_record_rules_mode_ck CHECK (management_mode IS NULL OR management_mode IN ('individual', 'batch')),
  CONSTRAINT master_record_rules_species_flag_ck CHECK (requires_species_flag IS NULL OR requires_species_flag IN
    ('produces_milk', 'produces_eggs', 'produces_wool')),
  CONSTRAINT master_record_rules_class_flag_ck CHECK (requires_class_flag IS NULL OR requires_class_flag IN
    ('can_produce_milk', 'can_be_pregnant', 'can_lay_eggs')),
  CONSTRAINT master_record_rules_group_flag_ck CHECK (requires_group_flag IS NULL OR requires_group_flag IN
    ('yields_milk', 'yields_eggs'))
);

CREATE INDEX IF NOT EXISTS idx_master_record_type_rules_type ON master_record_type_rules(record_type_id);
CREATE INDEX IF NOT EXISTS idx_master_record_types_active ON master_record_types(is_active);

INSERT INTO master_record_types
  (code, kind, subject, label, icon, unit, fields, sort_order, label_hi, label_kn, label_ml, label_ta, label_te)
VALUES
  ('milk',            'daily', 'either', 'Milk',                    '🥛', 'L',  '[{"key":"session","type":"choice","options":["am","pm"],"required":true},{"key":"quantity","type":"number","required":true}]', 10, 'दूध', 'ಹಾಲು', 'പാൽ', 'பால்', 'పాలు'),
  ('eggs',            'daily', 'either', 'Eggs',                    '🥚', 'eggs', '[{"key":"quantity","type":"number","required":true},{"key":"broken","type":"number"}]', 20, 'अंडे', 'ಮೊಟ್ಟೆ', 'മുട്ട', 'முட்டை', 'గుడ్లు'),
  ('feed',            'daily', 'either', 'Feed',                    '🌾', 'kg', '[{"key":"quantity","type":"number","required":true},{"key":"feedItem","type":"picker"}]', 30, 'चारा / दाना', 'ಮೇವು', 'തീറ്റ', 'தீவனம்', 'మేత'),
  ('mortality',       'daily', 'group',  'Deaths',                  '📉', 'head', '[{"key":"quantity","type":"number","required":true},{"key":"cause","type":"text"}]', 40, 'मृत्यु', 'ಸಾವು', 'ചത്തവ', 'இறப்பு', 'మరణాలు'),
  ('sample_weight',   'daily', 'group',  'Sample weight',           '⚖️', 'g',  '[{"key":"sampleCount","type":"number"},{"key":"averageWeight","type":"number","required":true}]', 50, 'नमूना वज़न', 'ಮಾದರಿ ತೂಕ', 'സാമ്പിൾ തൂക്കം', 'மாதிரி எடை', 'నమూనా బరువు'),
  ('water_quality',   'daily', 'group',  'Water quality',           '💧', NULL, '[{"key":"temperatureC","type":"number"},{"key":"ph","type":"number"},{"key":"dissolvedOxygenPpm","type":"number"},{"key":"salinityPpt","type":"number"},{"key":"transparencyCm","type":"number"},{"key":"ammoniaPpm","type":"number"}]', 60, 'पानी की गुणवत्ता', 'ನೀರಿನ ಗುಣಮಟ್ಟ', 'ജലഗുണനിലവാരം', 'நீரின் தரம்', 'నీటి నాణ్యత'),
  ('weight',          'event', 'animal', 'Weight',                  '⚖️', 'kg', '[{"key":"weight","type":"number","required":true}]', 100, 'वज़न', 'ತೂಕ', 'തൂക്കം', 'எடை', 'బరువు'),
  ('heat',            'event', 'animal', 'Heat seen',               '🔥', NULL, '[]', 110, 'गर्मी (हीट) में', 'ಬೆದೆ', 'മദി', 'சினைப் பருவம்', 'ఎద'),
  ('insemination',    'event', 'animal', 'Mating / AI',             '🧬', NULL, '[{"key":"method","type":"choice","options":["natural","artificial_insemination"],"required":true},{"key":"sire","type":"picker"}]', 120, 'गर्भाधान (प्राकृतिक / कृत्रिम)', 'ಗರ್ಭಧಾರಣೆ (ಸಹಜ / ಕೃತಕ)', 'ബീജാധാനം (സ്വാഭാവികം / കൃത്രിമം)', 'இனச்சேர்க்கை / செயற்கை கருவூட்டல்', 'సంపర్కం / కృత్రిమ గర్భధారణ'),
  ('pregnancy_check', 'event', 'animal', 'Pregnancy check',         '🩺', NULL, '[{"key":"result","type":"choice","options":["pregnant","not_pregnant"],"required":true}]', 130, 'गर्भ जाँच', 'ಗರ್ಭ ಪರೀಕ್ಷೆ', 'ഗർഭ പരിശോധന', 'சினைப் பரிசோதனை', 'చూడి పరీక్ష'),
  ('dry_off',         'event', 'animal', 'Dry-off',                 '⏸️', NULL, '[]', 140, 'दूध सुखाना', 'ಹಾಲು ಬತ್ತಿಸುವುದು', 'കറവ വറ്റിക്കൽ', 'பால் வற்ற வைத்தல்', 'పాలు ఆపడం'),
  ('birth',           'event', 'animal', 'Birth',                   '🍼', NULL, '[{"key":"liveBirths","type":"number","required":true},{"key":"stillbirths","type":"number"}]', 150, 'जन्म (ब्याना)', 'ಜನನ (ಈಯುವಿಕೆ)', 'പ്രസവം', 'ஈனுதல் (பிறப்பு)', 'ఈనడం (జననం)'),
  ('weaning',         'event', 'either', 'Weaning',                 '🌱', NULL, '[{"key":"count","type":"number"}]', 160, 'दूध छुड़ाना', 'ಹಾಲು ಬಿಡಿಸುವುದು', 'പാൽകുടി മാറ്റൽ', 'பால் மறக்கடித்தல்', 'పాలు మాన్పించడం'),
  ('shearing',        'event', 'either', 'Shearing',                '✂️', 'kg', '[{"key":"quantity","type":"number"}]', 170, 'ऊन कतरना', 'ಉಣ್ಣೆ ಕತ್ತರಿಸುವುದು', 'രോമം വെട്ടൽ', 'உரோமம் கத்தரித்தல்', 'ఉన్ని కత్తిరింపు'),
  ('placement',       'event', 'group',  'Place new batch',         '📥', 'head', '[{"key":"quantity","type":"number","required":true},{"key":"source","type":"text"}]', 200, 'नया बैच डालना', 'ಹೊಸ ಬ್ಯಾಚ್ ಬಿಡುವುದು', 'പുതിയ ബാച്ച് ഇറക്കൽ', 'புதிய தொகுதி விடுதல்', 'కొత్త బ్యాచ్ వేయడం'),
  ('stocking',        'event', 'group',  'Stocking',                '📥', 'head', '[{"key":"quantity","type":"number","required":true},{"key":"seedSource","type":"text"}]', 210, 'बीज संचयन', 'ಮರಿ ಬಿತ್ತನೆ', 'കുഞ്ഞുങ്ങളെ നിക്ഷേപിക്കൽ', 'குஞ்சு இருப்பு செய்தல்', 'పిల్లల స్టాకింగ్'),
  ('cull',            'event', 'group',  'Cull',                    '➖', 'head', '[{"key":"quantity","type":"number","required":true},{"key":"reason","type":"text"}]', 220, 'छँटनी', 'ಆಯ್ದು ತೆಗೆಯುವುದು', 'ഒഴിവാക്കൽ', 'கழித்தல்', 'ఏరివేత'),
  ('partial_sale',    'event', 'group',  'Partial sale',            '🛒', 'head', '[{"key":"quantity","type":"number","required":true},{"key":"amount","type":"number"},{"key":"buyer","type":"text"}]', 230, 'आंशिक बिक्री', 'ಭಾಗಶಃ ಮಾರಾಟ', 'ഭാഗിക വിൽപ്പന', 'பகுதி விற்பனை', 'పాక్షిక అమ్మకం'),
  ('clear_out',       'event', 'group',  'Clear-out (close cycle)', '🏁', 'head', '[{"key":"quantity","type":"number","required":true},{"key":"amount","type":"number"},{"key":"buyer","type":"text"}]', 240, 'पूरा बैच निकालना', 'ಬ್ಯಾಚ್ ಖಾಲಿ ಮಾಡುವುದು', 'ബാച്ച് ഒഴിപ്പിക്കൽ', 'தொகுதி முழு விற்பனை (சுழற்சி முடிவு)', 'బ్యాచ్ ఖాళీ చేయడం'),
  ('water_exchange',  'event', 'group',  'Water exchange',          '🔄', '%',  '[{"key":"percent","type":"number"}]', 250, 'पानी बदलना', 'ನೀರು ಬದಲಾವಣೆ', 'വെള്ളം മാറ്റൽ', 'நீர் மாற்றம்', 'నీటి మార్పిడి'),
  ('partial_harvest', 'event', 'group',  'Partial harvest',         '🎣', 'kg', '[{"key":"quantity","type":"number","required":true},{"key":"count","type":"number"},{"key":"amount","type":"number"},{"key":"buyer","type":"text"}]', 260, 'आंशिक निकासी', 'ಭಾಗಶಃ ಕೊಯ್ಲು', 'ഭാഗിക വിളവെടുപ്പ്', 'பகுதி அறுவடை', 'పాక్షిక పట్టుబడి'),
  ('harvest',         'event', 'group',  'Harvest (close crop)',    '🎣', 'kg', '[{"key":"quantity","type":"number","required":true},{"key":"count","type":"number"},{"key":"amount","type":"number"},{"key":"buyer","type":"text"}]', 270, 'निकासी (फसल समाप्त)', 'ಕೊಯ್ಲು', 'വിളവെടുപ്പ്', 'அறுவடை', 'పట్టుబడి'),
  ('treatment',       'event', 'either', 'Treatment',               '💊', NULL, '[]', 300, 'इलाज', 'ಚಿಕಿತ್ಸೆ', 'ചികിത്സ', 'சிகிச்சை', 'చికిత్స'),
  ('vaccination',     'event', 'either', 'Vaccination',             '💉', NULL, '[]', 310, 'टीकाकरण', 'ಲಸಿಕೆ', 'വാക്സിനേഷൻ', 'தடுப்பூசி', 'టీకా'),
  ('purchase',        'event', 'either', 'Purchase',                '🧾', NULL, '[{"key":"quantity","type":"number"},{"key":"amount","type":"number"},{"key":"seller","type":"text"}]', 320, 'खरीद', 'ಖರೀದಿ', 'വാങ്ങൽ', 'கொள்முதல்', 'కొనుగోలు'),
  ('sale',            'event', 'animal', 'Sale',                    '💰', NULL, '[{"key":"amount","type":"number"},{"key":"buyer","type":"text"}]', 330, 'बिक्री', 'ಮಾರಾಟ', 'വിൽപ്പന', 'விற்பனை', 'అమ్మకం'),
  ('death',           'event', 'animal', 'Death',                   '⚠️', NULL, '[{"key":"cause","type":"text"}]', 340, 'मृत्यु', 'ಸಾವು', 'മരണം', 'இறப்பு', 'మరణం')
ON CONFLICT (code) DO NOTHING;

INSERT INTO master_record_type_rules
  (record_type_id, rule_key, farm_segment, management_mode, requires_species_flag, aquatic, requires_class_flag, requires_group_flag)
SELECT rt.id, v.rule_key, v.segment, v.mode, v.species_flag, v.aquatic, v.class_flag, v.group_flag
FROM (VALUES
  -- Milk and eggs: any species that produces them; the animal's class or the group type decides.
  ('milk',            'milk_producers',     NULL::text,     NULL::text,   'produces_milk'::text, NULL::boolean, 'can_produce_milk'::text, 'yields_milk'::text),
  ('eggs',            'egg_producers',      NULL,           NULL,         'produces_eggs',       NULL,          'can_lay_eggs',           'yields_eggs'),
  ('feed',            'all_farm_stock',     NULL,           NULL,         NULL,                  NULL,          NULL,                     NULL),
  ('mortality',       'batch_stock',        NULL,           'batch',      NULL,                  NULL,          NULL,                     NULL),
  ('sample_weight',   'batch_stock',        NULL,           'batch',      NULL,                  NULL,          NULL,                     NULL),
  ('water_quality',   'aquatic',            NULL,           NULL,         NULL,                  true,          NULL,                     NULL),
  ('weight',          'individual_stock',   NULL,           'individual', NULL,                  false,         NULL,                     NULL),
  ('heat',            'breeding_females',   NULL,           'individual', NULL,                  false,         'can_be_pregnant',        NULL),
  ('insemination',    'breeding_females',   NULL,           'individual', NULL,                  false,         'can_be_pregnant',        NULL),
  ('pregnancy_check', 'breeding_females',   NULL,           'individual', NULL,                  false,         'can_be_pregnant',        NULL),
  ('birth',           'breeding_females',   NULL,           'individual', NULL,                  false,         'can_be_pregnant',        NULL),
  ('dry_off',         'milking_females',    NULL,           'individual', 'produces_milk',       false,         'can_produce_milk',       NULL),
  ('weaning',         'dairy',              'dairy',        NULL,         NULL,                  NULL,          NULL,                     NULL),
  ('weaning',         'small_ruminant',     'small_ruminant', NULL,       NULL,                  NULL,          NULL,                     NULL),
  ('weaning',         'pig',                'pig',          NULL,         NULL,                  NULL,          NULL,                     NULL),
  ('weaning',         'equine',             'equine',       NULL,         NULL,                  NULL,          NULL,                     NULL),
  ('weaning',         'other_livestock',    'other_livestock', NULL,      NULL,                  NULL,          NULL,                     NULL),
  ('shearing',        'wool_producers',     NULL,           NULL,         'produces_wool',       NULL,          NULL,                     NULL),
  ('placement',       'land_batch',         NULL,           'batch',      NULL,                  false,         NULL,                     NULL),
  ('cull',            'land_batch',         NULL,           'batch',      NULL,                  false,         NULL,                     NULL),
  ('partial_sale',    'land_batch',         NULL,           'batch',      NULL,                  false,         NULL,                     NULL),
  ('clear_out',       'land_batch',         NULL,           'batch',      NULL,                  false,         NULL,                     NULL),
  ('stocking',        'aquatic',            NULL,           NULL,         NULL,                  true,          NULL,                     NULL),
  ('water_exchange',  'aquatic',            NULL,           NULL,         NULL,                  true,          NULL,                     NULL),
  ('partial_harvest', 'aquatic',            NULL,           NULL,         NULL,                  true,          NULL,                     NULL),
  ('harvest',         'aquatic',            NULL,           NULL,         NULL,                  true,          NULL,                     NULL),
  ('treatment',       'all_farm_stock',     NULL,           NULL,         NULL,                  NULL,          NULL,                     NULL),
  ('vaccination',     'all_farm_stock',     NULL,           NULL,         NULL,                  NULL,          NULL,                     NULL),
  ('purchase',        'all_farm_stock',     NULL,           NULL,         NULL,                  NULL,          NULL,                     NULL),
  ('sale',            'individual_stock',   NULL,           'individual', NULL,                  false,         NULL,                     NULL),
  ('death',           'individual_stock',   NULL,           'individual', NULL,                  false,         NULL,                     NULL)
) AS v(code, rule_key, segment, mode, species_flag, aquatic, class_flag, group_flag)
JOIN master_record_types rt ON rt.code = v.code
ON CONFLICT (record_type_id, rule_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. BREED CORRECTIONS (NBAGR)
-- ─────────────────────────────────────────────────────────────────────────────
-- animals.breed, animal_groups.breed, group_cycles.breed and marketplace_listings.breed are
-- plain text, not foreign keys. A rename that only touched master_breeds would leave every
-- existing row holding the old word, silently orphaned from the picker - so a rename moves the
-- text on every referencing table in the same transaction.

CREATE OR REPLACE FUNCTION pg_temp.farm043_rename_breed(p_species TEXT, p_old TEXT, p_new TEXT) RETURNS void AS $fn$
DECLARE
  v_species_id UUID;
BEGIN
  SELECT id INTO v_species_id FROM master_species WHERE code = p_species;
  IF v_species_id IS NULL THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM master_breeds WHERE species_id = v_species_id AND name = p_new) THEN
    -- The new name is already there (fresh install, or this file ran before): drop the old row.
    DELETE FROM master_breeds WHERE species_id = v_species_id AND name = p_old;
  ELSE
    UPDATE master_breeds SET name = p_new, updated_at = NOW() WHERE species_id = v_species_id AND name = p_old;
  END IF;

  UPDATE animals              SET breed = p_new WHERE species = p_species AND breed = p_old;
  UPDATE animal_groups        SET breed = p_new WHERE species = p_species AND breed = p_old;
  UPDATE group_cycles         SET breed = p_new WHERE species = p_species AND breed = p_old;
  UPDATE marketplace_listings SET breed = p_new WHERE species = p_species AND breed = p_old;
END;
$fn$ LANGUAGE plpgsql;

-- "Cross Breed" replaces "Mixed Breed" / "Mixed" for livestock only (pets keep "Mixed Breed").
SELECT pg_temp.farm043_rename_breed('Cattle',  'Mixed Breed', 'Cross Breed');
SELECT pg_temp.farm043_rename_breed('Buffalo', 'Mixed',       'Cross Breed');
SELECT pg_temp.farm043_rename_breed('Goat',    'Mixed Breed', 'Cross Breed');
SELECT pg_temp.farm043_rename_breed('Sheep',   'Mixed Breed', 'Cross Breed');
SELECT pg_temp.farm043_rename_breed('Pig',     'Mixed Breed', 'Cross Breed');
-- NBAGR spellings.
SELECT pg_temp.farm043_rename_breed('Goat',    'Kanniadu',    'Kanni Adu');
SELECT pg_temp.farm043_rename_breed('Pig',     'Ghungroo',    'Ghoongroo');

DROP FUNCTION pg_temp.farm043_rename_breed(TEXT, TEXT, TEXT);

-- Simmental is on no NBAGR page and the farmer confirmed it is not kept in India. Retired, not
-- deleted: an existing animal may still carry the name.
UPDATE master_breeds SET is_active = false, updated_at = NOW()
 WHERE name = 'Simmental' AND is_active = true
   AND species_id = (SELECT id FROM master_species WHERE code = 'Cattle');

INSERT INTO master_breeds (species_id, name, sort_order, is_active)
SELECT s.id, v.name, v.sort_order, true
FROM (VALUES
  -- Cattle: the two Tamil Nadu breeds that were missing, and the named crosses farmers keep.
  ('Cattle',  'Bargur',             92),
  ('Cattle',  'Pulikulam',          102),
  ('Cattle',  'HF Cross',           162),
  ('Cattle',  'Jersey Cross',       172),
  ('Cattle',  'Cross Breed',        200),
  ('Buffalo', 'Bargur',             92),
  ('Buffalo', 'Cross Breed',        100),
  ('Goat',    'Kanni Adu',          100),
  ('Goat',    'Kodi Adu',           102),
  ('Goat',    'Cross Breed',        160),
  ('Sheep',   'Kilakarsal',         62),
  ('Sheep',   'Tiruchi Black',      82),
  ('Sheep',   'Katchaikatty Black', 92),
  ('Sheep',   'Chevaadu',           94),
  ('Sheep',   'Cross Breed',        160),
  -- Pig: the full NBAGR registered list (nbagr.res.in/pig, 16 breeds).
  ('Pig',     'Ghoongroo',          20),
  ('Pig',     'Agonda Goan',        31),
  ('Pig',     'Tenyi Vo',           32),
  ('Pig',     'Nicobari',           33),
  ('Pig',     'Doom',               34),
  ('Pig',     'Zovawk',             35),
  ('Pig',     'Ghurrah',            36),
  ('Pig',     'Mali',               37),
  ('Pig',     'Purnea',             38),
  ('Pig',     'Banda',              39),
  ('Pig',     'Manipuri Black',     40),
  ('Pig',     'Wak Chambil',        41),
  ('Pig',     'Andamani',           42),
  ('Pig',     'Karkambi',           43),
  ('Pig',     'Nagal',              44),
  ('Pig',     'Cross Breed',        90)
) AS v(species_code, name, sort_order)
JOIN master_species s ON s.code = v.species_code
ON CONFLICT (species_id, name) DO NOTHING;

-- Local-language words for the cross-breed entries (a renamed row would otherwise keep whatever
-- "Mixed Breed" translation it had). Only fills a blank, never overwrites an admin's wording.
UPDATE master_breeds b SET
    label_hi = COALESCE(NULLIF(b.label_hi, ''), v.hi), label_kn = COALESCE(NULLIF(b.label_kn, ''), v.kn),
    label_ml = COALESCE(NULLIF(b.label_ml, ''), v.ml), label_ta = COALESCE(NULLIF(b.label_ta, ''), v.ta),
    label_te = COALESCE(NULLIF(b.label_te, ''), v.te)
  FROM (VALUES
    ('Cross Breed',  'संकर नस्ल',  'ಮಿಶ್ರ ತಳಿ',        'സങ്കരയിനം',      'கலப்பினம்',          'సంకర జాతి'),
    ('Jersey Cross', 'जर्सी संकर', 'ಜರ್ಸಿ ಮಿಶ್ರ ತಳಿ',   'ജേഴ്സി സങ്കരം',   'ஜெர்சி கலப்பினம்',    'జెర్సీ సంకరం'),
    ('HF Cross',     'एचएफ संकर',  'ಎಚ್‌ಎಫ್ ಮಿಶ್ರ ತಳಿ', 'എച്ച്.എഫ് സങ്കരം', 'எச்.எஃப். கலப்பினம்', 'హెచ్‌ఎఫ్ సంకరం')
  ) AS v(name, hi, kn, ml, ta, te)
 WHERE b.name = v.name
   AND b.species_id IN (SELECT id FROM master_species WHERE code IN ('Cattle', 'Buffalo', 'Goat', 'Sheep', 'Pig'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. AQUACULTURE SPECIES
-- ─────────────────────────────────────────────────────────────────────────────
-- Fish, shrimp, prawn and crab that are actually cultured (owner decisions D6 and D10). Batch by
-- default: a pond is a group and the crop inside it is a cycle. No ear tag, no gender, no class.
-- Scientific names are as printed by the source. Not marketplace-eligible by default.

INSERT INTO master_species
  (code, label, icon, category, has_ear_tag, sort_order, is_active, default_management_mode,
   farm_segment, is_aquatic, birth_event_term, scientific_name, water_type,
   label_hi, label_kn, label_ml, label_ta, label_te)
VALUES
  ('Catla',                 'Catla',                        '🐟', 'Aquaculture', false, 600, true, 'batch', 'aquaculture', true, 'spawning', 'Catla catla',                  'fresh',    'कतला', 'ಕಾಟ್ಲಾ', 'കട്ല', 'கட்லா', 'బొచ్చె (కట్ల)'),
  ('Rohu',                  'Rohu',                         '🐟', 'Aquaculture', false, 610, true, 'batch', 'aquaculture', true, 'spawning', 'Labeo rohita',                 'fresh',    'रोहू', 'ರೋಹು', 'രോഹു', 'ரோகு', 'రోహు'),
  ('Mrigal',                'Mrigal',                       '🐟', 'Aquaculture', false, 620, true, 'batch', 'aquaculture', true, 'spawning', 'Cirrhinus mrigala',            'fresh',    'मृगल', 'ಮೃಗಾಲ್', 'മൃഗാൽ', 'மிரிகால்', 'మ్రిగాల'),
  ('Bata',                  'Bata',                         '🐟', 'Aquaculture', false, 630, true, 'batch', 'aquaculture', true, 'spawning', 'Labeo bata',                   'fresh',    'बाटा', 'ಬಾಟಾ', 'ബാറ്റ', 'பாட்டா', 'బాటా'),
  ('Calbasu',               'Calbasu',                      '🐟', 'Aquaculture', false, 640, true, 'batch', 'aquaculture', true, 'spawning', 'Labeo calbasu',                'fresh',    'कालबासु', 'ಕಲ್ಬಾಸು', 'കൽബാസു', 'கல்பாசு', 'కల్బాసు'),
  ('Silver Carp',           'Silver Carp',                  '🐟', 'Aquaculture', false, 650, true, 'batch', 'aquaculture', true, 'spawning', 'Hypophthalmichthys molitrix',  'fresh',    'सिल्वर कार्प', 'ಸಿಲ್ವರ್ ಕಾರ್ಪ್', 'സിൽവർ കാർപ്പ്', 'வெள்ளிக் கெண்டை', 'సిల్వర్ కార్ప్'),
  ('Grass Carp',            'Grass Carp',                   '🐟', 'Aquaculture', false, 660, true, 'batch', 'aquaculture', true, 'spawning', 'Ctenopharyngodon idella',      'fresh',    'ग्रास कार्प', 'ಗ್ರಾಸ್ ಕಾರ್ಪ್', 'ഗ്രാസ് കാർപ്പ്', 'புல் கெண்டை', 'గ్రాస్ కార్ప్'),
  ('Common Carp',           'Common Carp',                  '🐟', 'Aquaculture', false, 670, true, 'batch', 'aquaculture', true, 'spawning', 'Cyprinus carpio',              'fresh',    'कॉमन कार्प', 'ಕಾಮನ್ ಕಾರ್ಪ್', 'കോമൺ കാർപ്പ്', 'சாதா கெண்டை', 'కామన్ కార్ప్'),
  ('Tilapia',               'Tilapia',                      '🐟', 'Aquaculture', false, 680, true, 'batch', 'aquaculture', true, 'spawning', 'Oreochromis spp.',             'fresh',    'तिलापिया', 'ತಿಲಾಪಿಯಾ', 'തിലാപ്പിയ', 'திலேப்பியா', 'తిలాపియా'),
  ('Magur',                 'Magur',                        '🐟', 'Aquaculture', false, 690, true, 'batch', 'aquaculture', true, 'spawning', 'Clarias batrachus',            'fresh',    'मांगुर', 'ಮಾಗುರ್', 'മാഗൂർ', 'மாகூர்', 'మాగుర్'),
  ('Singhi',                'Singhi',                       '🐟', 'Aquaculture', false, 700, true, 'batch', 'aquaculture', true, 'spawning', 'Heteropneustes fossilis',      'fresh',    'सिंघी', 'ಸಿಂಘಿ', 'സിംഘി', 'சிங்கி', 'సింఘి'),
  ('Murrel',                'Murrel',                       '🐟', 'Aquaculture', false, 710, true, 'batch', 'aquaculture', true, 'spawning', 'Channa spp.',                  'fresh',    'मरल (सौल)', 'ಮುರ್ರೆಲ್', 'വരാൽ', 'விரால்', 'కొర్రమీను'),
  ('Climbing Perch',        'Climbing Perch (Koi)',         '🐟', 'Aquaculture', false, 720, true, 'batch', 'aquaculture', true, 'spawning', 'Anabas testudineus',           'fresh',    'कवई', 'ಕ್ಲೈಂಬಿಂಗ್ ಪರ್ಚ್', 'ക്ലൈംബിംഗ് പെർച്ച്', 'பனையேறி கெண்டை', 'క్లైంబింగ్ పెర్చ్'),
  ('Pangasius',             'Pangasius',                    '🐟', 'Aquaculture', false, 730, true, 'batch', 'aquaculture', true, 'spawning', 'Pangasius pangasius',          'fresh',    'पंगास', 'ಪಂಗಾಸಿಯಸ್', 'പംഗാസിയസ്', 'பங்காசியஸ்', 'పంగాసియస్'),
  ('Giant Gourami',         'Giant Gourami',                '🐟', 'Aquaculture', false, 740, true, 'batch', 'aquaculture', true, 'spawning', 'Osphronemus goramy',           'fresh',    'जायंट गौरामी', 'ಜೈಂಟ್ ಗೌರಾಮಿ', 'ജയന്റ് ഗൗരാമി', 'ஜெயண்ட் கௌராமி', 'జెయింట్ గౌరామి'),
  ('Freshwater Prawn',      'Freshwater Prawn (Scampi)',    '🦐', 'Aquaculture', false, 750, true, 'batch', 'aquaculture', true, 'spawning', 'Macrobrachium rosenbergii',    'fresh',    'मीठे पानी का झींगा (स्कैम्पी)', 'ಸಿಹಿನೀರು ಸೀಗಡಿ (ಸ್ಕ್ಯಾಂಪಿ)', 'ആറ്റുകൊഞ്ച്', 'நன்னீர் இறால் (ஸ்கேம்பி)', 'మంచినీటి రొయ్య (స్కాంపి)'),
  ('Asian Seabass',         'Asian Seabass',                '🐟', 'Aquaculture', false, 760, true, 'batch', 'aquaculture', true, 'spawning', 'Lates calcarifer',             'brackish', 'एशियन सीबास (भेटकी)', 'ಏಷ್ಯನ್ ಸೀಬಾಸ್', 'കാളാഞ്ചി', 'கொடுவா', 'పండుగప్ప'),
  ('Milkfish',              'Milkfish',                     '🐟', 'Aquaculture', false, 770, true, 'batch', 'aquaculture', true, 'spawning', 'Chanos chanos',                'brackish', 'मिल्कफिश', 'ಮಿಲ್ಕ್‌ಫಿಶ್', 'പൂമീൻ', 'பால் மீன்', 'మిల్క్‌ఫిష్'),
  ('Grey Mullet',           'Grey Mullet',                  '🐟', 'Aquaculture', false, 780, true, 'batch', 'aquaculture', true, 'spawning', 'Mugil cephalus',               'brackish', 'ग्रे मुलेट', 'ಗ್ರೇ ಮಲೆಟ್', 'തിരുത', 'மடவை', 'గ్రే ముల్లెట్'),
  ('Pearlspot',             'Pearlspot',                    '🐟', 'Aquaculture', false, 790, true, 'batch', 'aquaculture', true, 'spawning', 'Etroplus suratensis',          'brackish', 'पर्लस्पॉट', 'ಪರ್ಲ್‌ಸ್ಪಾಟ್', 'കരിമീൻ', 'கரிமீன் (பேர்ல்ஸ்பாட்)', 'పెర్ల్‌స్పాట్'),
  ('Long Whiskers Catfish', 'Long Whiskers Catfish',        '🐟', 'Aquaculture', false, 800, true, 'batch', 'aquaculture', true, 'spawning', 'Mystus gulio',                 'brackish', 'लॉन्ग व्हिस्कर्स कैटफ़िश', 'ಲಾಂಗ್ ವಿಸ್ಕರ್ಸ್ ಕ್ಯಾಟ್‌ಫಿಶ್', 'ലോങ് വിസ്കേഴ്സ് ക്യാറ്റ്ഫിഷ്', 'நீள மீசைக் கெளுத்தி', 'లాంగ్ విస్కర్స్ క్యాట్‌ఫిష్'),
  ('Red Snapper',           'Red Snapper',                  '🐟', 'Aquaculture', false, 810, true, 'batch', 'aquaculture', true, 'spawning', 'Lutjanus argentimaculatus',    'brackish', 'रेड स्नैपर', 'ರೆಡ್ ಸ್ನ್ಯಾಪರ್', 'ചെമ്പല്ലി', 'ரெட் ஸ்னாப்பர்', 'రెడ్ స్నాపర్'),
  ('Vannamei Shrimp',       'Pacific White Shrimp (Vannamei)', '🦐', 'Aquaculture', false, 820, true, 'batch', 'aquaculture', true, 'spawning', 'Penaeus (Litopenaeus) vannamei', 'brackish', 'वन्नामेई झींगा', 'ವನ್ನಾಮೇ ಸೀಗಡಿ', 'വനാമി ചെമ്മീൻ', 'வனாமி இறால்', 'వెనామీ రొయ్య'),
  ('Black Tiger Shrimp',    'Black Tiger Shrimp',           '🦐', 'Aquaculture', false, 830, true, 'batch', 'aquaculture', true, 'spawning', 'Penaeus monodon',              'brackish', 'टाइगर झींगा', 'ಟೈಗರ್ ಸೀಗಡಿ', 'ടൈഗർ ചെമ്മീൻ', 'புலி இறால்', 'టైగర్ రొయ్య'),
  ('Indian White Shrimp',   'Indian White Shrimp',          '🦐', 'Aquaculture', false, 840, true, 'batch', 'aquaculture', true, 'spawning', 'Penaeus indicus',              'brackish', 'भारतीय सफ़ेद झींगा', 'ಭಾರತೀಯ ಬಿಳಿ ಸೀಗಡಿ', 'നാരൻ ചെമ്മീൻ', 'வெள்ளை இறால்', 'తెల్ల రొయ్య'),
  ('Mud Crab',              'Mud Crab',                     '🦀', 'Aquaculture', false, 850, true, 'batch', 'aquaculture', true, 'spawning', 'Scylla serrata',               'brackish', 'कीचड़ केकड़ा', 'ಕೆಸರು ಏಡಿ', 'ചെളിഞണ്ട്', 'சேற்று நண்டு', 'మండ పీత')
ON CONFLICT (code) DO NOTHING;

-- Every species picker ends in "Other"; varieties the sources name are offered as breeds.
INSERT INTO master_breeds (species_id, name, sort_order, is_active)
SELECT s.id, 'Other', 900, true FROM master_species s WHERE s.farm_segment = 'aquaculture'
ON CONFLICT (species_id, name) DO NOTHING;

INSERT INTO master_breeds (species_id, name, sort_order, is_active)
SELECT s.id, v.name, v.sort_order, true
FROM (VALUES
  ('Common Carp', 'Mirror Carp',          10),
  ('Common Carp', 'Scale Carp',           20),
  ('Murrel',      'Striped Murrel',       10),
  ('Murrel',      'Giant Murrel',         20),
  ('Murrel',      'Spotted Murrel',       30),
  ('Tilapia',     'Mozambique Tilapia',   10),
  ('Tilapia',     'Nile Tilapia (GIFT)',  20)
) AS v(species_code, name, sort_order)
JOIN master_species s ON s.code = v.species_code
ON CONFLICT (species_id, name) DO NOTHING;

-- Guide ranges, only where an official table was found. Shrimp: MPEDA better-management-practice
-- table (covers L. vannamei and P. monodon). Freshwater prawn: TNAU nursery/grow-out table
-- (cites FAO 2002 and ICAR-CIFA). No official table was found for carp, brackish finfish or crab,
-- so those species carry no range and the app shows no "outside the guide range" hint for them.
UPDATE master_species SET water_quality_ranges =
  '{"temperatureC":{"min":28,"max":32},"ph":{"min":7.5,"max":8.3},"dissolvedOxygenPpm":{"min":4,"max":6},"salinityPpt":{"min":10,"max":25},"transparencyCm":{"min":30,"max":40},"ammoniaPpm":{"max":0.5},"source":"MPEDA shrimp BMP water quality parameters (mpeda.gov.in/?page_id=728)"}'::jsonb
 WHERE code IN ('Vannamei Shrimp', 'Black Tiger Shrimp') AND water_quality_ranges IS NULL;

UPDATE master_species SET water_quality_ranges =
  '{"temperatureC":{"min":28,"max":31},"ph":{"min":7.0,"max":8.5},"dissolvedOxygenPpm":{"min":3,"max":7},"salinityPpt":{"max":10},"transparencyCm":{"min":25,"max":40},"ammoniaPpm":{"max":0.3},"source":"TNAU Agritech Portal, freshwater prawn culture (cites FAO 2002, ICAR-CIFA)"}'::jsonb
 WHERE code = 'Freshwater Prawn' AND water_quality_ranges IS NULL;

-- ============================================================
-- 62. ANIMAL PRODUCTION FIELDS + ONE BREEDING-STATUS VOCABULARY
-- ============================================================
-- Kept identical to backend/migrations/044_animal_production_fields.sql (everything below its
-- header) so a fresh install and an upgraded database end up the same. See that file for why.

-- 1. production fields
ALTER TABLE animals ADD COLUMN IF NOT EXISTS avg_daily_milk_litres DECIMAL(5,2);
ALTER TABLE animals ADD COLUMN IF NOT EXISTS parity INTEGER;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS last_birth_date DATE;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS dry_off_date DATE;

DO $$ BEGIN
  ALTER TABLE animals ADD CONSTRAINT animals_avg_milk_ck
    CHECK (avg_daily_milk_litres IS NULL OR (avg_daily_milk_litres >= 0 AND avg_daily_milk_litres <= 200));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE animals ADD CONSTRAINT animals_parity_ck
    CHECK (parity IS NULL OR (parity >= 0 AND parity <= 40));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. one breeding-status vocabulary
UPDATE animals SET breeding_status = CASE breeding_status
    WHEN 'confirmed_pregnant' THEN 'pregnant'
    WHEN 'confirmed'          THEN 'pregnant'
    WHEN 'open'               THEN 'not_bred'
    WHEN 'delivered'          THEN 'not_bred'
    WHEN 'aborted'            THEN 'not_bred'
    WHEN 'reabsorbed'         THEN 'not_bred'
    WHEN 'lactating'          THEN 'not_bred'
    ELSE breeding_status END
 WHERE breeding_status IN ('confirmed_pregnant', 'confirmed', 'open', 'delivered', 'aborted', 'reabsorbed', 'lactating');

-- Anything still outside the vocabulary (free text from an old client) carries no usable meaning.
UPDATE animals SET breeding_status = NULL
 WHERE breeding_status IS NOT NULL
   AND breeding_status NOT IN ('not_bred', 'bred', 'pregnant', 'not_pregnant');

DO $$ BEGIN
  ALTER TABLE animals ADD CONSTRAINT animals_breeding_status_ck
    CHECK (breeding_status IS NULL OR breeding_status IN ('not_bred', 'bred', 'pregnant', 'not_pregnant'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. backfill births from the breeding records that already say a delivery happened, so animals
--    that have calved before this migration do not show "0 births". Only fills a blank.
UPDATE animals a SET parity = b.births
  FROM (SELECT dam_id, COUNT(*) AS births FROM breeding_records
         WHERE status = 'delivered' AND dam_id IS NOT NULL GROUP BY dam_id) b
 WHERE a.id = b.dam_id AND a.parity IS NULL;

UPDATE animals a SET last_birth_date = b.last_birth
  FROM (SELECT dam_id, MAX(actual_birth_date) AS last_birth FROM breeding_records
         WHERE status = 'delivered' AND dam_id IS NOT NULL AND actual_birth_date IS NOT NULL GROUP BY dam_id) b
 WHERE a.id = b.dam_id AND a.last_birth_date IS NULL;

-- ============================================================
-- 63. FARM DAILY RECORDS
-- ============================================================
-- Kept identical to backend/migrations/045_farm_daily_records.sql (everything below its
-- header) so a fresh install and an upgraded database end up the same. See that file for why.

CREATE TABLE IF NOT EXISTS farm_daily_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  animal_id UUID REFERENCES animals(id) ON DELETE CASCADE,
  group_id UUID REFERENCES animal_groups(id) ON DELETE CASCADE,
  cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL,
  record_type VARCHAR(40) NOT NULL REFERENCES master_record_types(code),
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  session VARCHAR(10) NOT NULL DEFAULT 'day',
  quantity NUMERIC(12,3),
  unit VARCHAR(20),
  detail JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT farm_daily_records_subject_ck CHECK ((animal_id IS NOT NULL) <> (group_id IS NOT NULL)),
  CONSTRAINT farm_daily_records_session_ck CHECK (session IN ('am', 'pm', 'day')),
  CONSTRAINT farm_daily_records_quantity_ck CHECK (quantity IS NULL OR quantity >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_farm_daily_records_slot
  ON farm_daily_records ((COALESCE(animal_id, group_id)), record_type, record_date, session);
CREATE INDEX IF NOT EXISTS idx_farm_daily_records_farm_date ON farm_daily_records(enterprise_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_farm_daily_records_animal ON farm_daily_records(animal_id, record_date DESC) WHERE animal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_farm_daily_records_group ON farm_daily_records(group_id, record_date DESC) WHERE group_id IS NOT NULL;

-- Who changed what. record_id is deliberately not a foreign key so the history of a deleted
-- record survives it.
CREATE TABLE IF NOT EXISTS farm_daily_record_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  action VARCHAR(10) NOT NULL,
  previous JSONB NOT NULL,
  edited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT farm_daily_record_edits_action_ck CHECK (action IN ('update', 'delete'))
);
CREATE INDEX IF NOT EXISTS idx_farm_daily_record_edits_record ON farm_daily_record_edits(record_id, edited_at DESC);

INSERT INTO system_settings (key, value, category, description)
VALUES ('farm.records.enabled', 'false', 'farm',
        'Master switch for farm daily records (milk, eggs, feed, sample weight, water quality). Dark-launch flag, default off.')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 64. SMS INTEGRATION
-- ============================================================
-- Kept identical to backend/migrations/046_sms_integration.sql (everything below its
-- header) so a fresh install and an upgraded database end up the same. See that file for why.

INSERT INTO system_settings (key, value, category, description) VALUES
  ('sms.enabled',                    'false',  'sms', 'Master switch for sending SMS. Off until DLT registration is done and a provider is configured.'),
  ('sms.provider',                   'msg91',  'sms', 'Which provider sends SMS: msg91, twilio, or log (writes to the server log only - for testing).'),
  ('sms.defaultCountryCode',         '91',     'sms', 'Country code added to a mobile number typed without one (91 = India).'),
  ('sms.msg91.authKey',              '',       'sms', 'MSG91 auth key (secret).'),
  ('sms.msg91.senderId',             '',       'sms', 'MSG91 / DLT registered sender id (6 letters), for reference and the admin test.'),
  ('sms.msg91.dltEntityId',          '',       'sms', 'DLT principal entity id (PE id), for reference.'),
  ('sms.twilio.accountSid',          '',       'sms', 'Twilio account SID.'),
  ('sms.twilio.authToken',           '',       'sms', 'Twilio auth token (secret).'),
  ('sms.twilio.from',                '',       'sms', 'Twilio sender number or sender id.'),
  ('sms.template.farm_invite.id',    '',       'sms', 'DLT-approved template / MSG91 flow id for the farm invitation SMS.'),
  ('sms.template.farm_invite.text',  '{inviter} invited you to join {farm} on WayToVet as {role}. Open: {link}', 'sms', 'Message text (Twilio) - must match the DLT-approved template. Variables: {inviter} {farm} {role} {link}.')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS sms_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_masked VARCHAR(30) NOT NULL,
  template VARCHAR(60) NOT NULL,
  provider VARCHAR(20),
  status VARCHAR(12) NOT NULL,
  provider_message_id VARCHAR(120),
  error TEXT,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sms_log_status_ck CHECK (status IN ('sent', 'failed', 'skipped', 'logged'))
);
CREATE INDEX IF NOT EXISTS idx_sms_log_created ON sms_log(created_at DESC);


-- ============================================================
-- 65. USER PHONE IDENTIFIER
-- ============================================================
-- Kept identical to backend/migrations/047_user_phone_identifier.sql (everything below its
-- header) so a fresh install and an upgraded database end up the same. See that file for why.

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_e164 VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

WITH raw AS (
  SELECT id, created_at,
         regexp_replace(COALESCE(phone, ''), '\D', '', 'g') AS d,
         COALESCE(phone, '') ~ '^\s*(\+|00)' AS intl
    FROM users
   WHERE phone_e164 IS NULL AND COALESCE(phone, '') <> ''
), norm AS (
  SELECT id, created_at,
         CASE
           WHEN intl THEN
             CASE WHEN regexp_replace(d, '^00', '') ~ '^91' AND regexp_replace(d, '^00', '') !~ '^91[6-9][0-9]{9}$' THEN NULL
                  WHEN length(regexp_replace(d, '^00', '')) BETWEEN 8 AND 15 THEN '+' || regexp_replace(d, '^00', '')
                  ELSE NULL END
           WHEN d ~ '^91[6-9][0-9]{9}$' THEN '+' || d
           WHEN d ~ '^0[6-9][0-9]{9}$'  THEN '+91' || substr(d, 2)
           WHEN d ~ '^[6-9][0-9]{9}$'   THEN '+91' || d
           ELSE NULL
         END AS e164
    FROM raw
), ranked AS (
  SELECT id, e164, row_number() OVER (PARTITION BY e164 ORDER BY created_at, id) AS rn
    FROM norm WHERE e164 IS NOT NULL
)
UPDATE users u SET phone_e164 = r.e164
  FROM ranked r
 WHERE u.id = r.id AND r.rn = 1
   AND NOT EXISTS (SELECT 1 FROM users o WHERE o.phone_e164 = r.e164 AND o.id <> u.id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_phone_e164 ON users(phone_e164) WHERE phone_e164 IS NOT NULL;

-- Safety net: whatever writes a user (the app, the demo seed, an admin tool) leaves phone_e164 in step
-- with phone when the writer did not set it. Same rules as the backfill above and as normalizePhone().
CREATE OR REPLACE FUNCTION users_set_phone_e164() RETURNS trigger AS $$
DECLARE
  d TEXT;
  intl BOOLEAN;
  v TEXT;
BEGIN
  IF NEW.phone_e164 IS NOT NULL OR COALESCE(NEW.phone, '') = '' THEN
    RETURN NEW;
  END IF;
  d := regexp_replace(NEW.phone, '\D', '', 'g');
  intl := NEW.phone ~ '^\s*(\+|00)';
  v := CASE
    WHEN intl THEN
      CASE WHEN regexp_replace(d, '^00', '') ~ '^91' AND regexp_replace(d, '^00', '') !~ '^91[6-9][0-9]{9}$' THEN NULL
           WHEN length(regexp_replace(d, '^00', '')) BETWEEN 8 AND 15 THEN '+' || regexp_replace(d, '^00', '')
           ELSE NULL END
    WHEN d ~ '^91[6-9][0-9]{9}$' THEN '+' || d
    WHEN d ~ '^0[6-9][0-9]{9}$'  THEN '+91' || substr(d, 2)
    WHEN d ~ '^[6-9][0-9]{9}$'   THEN '+91' || d
    ELSE NULL
  END;
  IF v IS NOT NULL AND EXISTS (SELECT 1 FROM users o WHERE o.phone_e164 = v AND o.id <> NEW.id) THEN
    v := NULL;
  END IF;
  NEW.phone_e164 := v;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_set_phone_e164 ON users;
CREATE TRIGGER trg_users_set_phone_e164 BEFORE INSERT OR UPDATE OF phone ON users
  FOR EACH ROW EXECUTE FUNCTION users_set_phone_e164();

-- Rows that already exist (and the demo seed, if it ran before this migration): fill the blanks now.
UPDATE users SET phone = phone WHERE phone_e164 IS NULL AND COALESCE(phone, '') <> '';

-- ============================================================
-- 66. FARM INVITATIONS
-- ============================================================
-- Kept identical to backend/migrations/048_farm_invitations.sql (everything below its
-- header) so a fresh install and an upgraded database end up the same. See that file for why.

CREATE TABLE IF NOT EXISTS farm_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL,
  invitee_phone VARCHAR(20),
  invitee_email VARCHAR(255),
  invitee_name VARCHAR(150),
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(12) NOT NULL DEFAULT 'pending',
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  decided_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  send_count INTEGER NOT NULL DEFAULT 0,
  sms_status VARCHAR(12),
  email_status VARCHAR(12),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT farm_invitations_role_ck CHECK (role IN ('manager', 'supervisor', 'worker', 'farm_vet', 'viewer')),
  CONSTRAINT farm_invitations_status_ck CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')),
  CONSTRAINT farm_invitations_target_ck CHECK (invitee_phone IS NOT NULL OR invitee_email IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_farm_invitations_pending_phone
  ON farm_invitations(enterprise_id, invitee_phone) WHERE status = 'pending' AND invitee_phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_farm_invitations_pending_email
  ON farm_invitations(enterprise_id, invitee_email) WHERE status = 'pending' AND invitee_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_farm_invitations_farm ON farm_invitations(enterprise_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_farm_invitations_phone ON farm_invitations(invitee_phone) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_farm_invitations_email ON farm_invitations(invitee_email) WHERE status = 'pending';

-- ============================================================
-- 67. FARM EVENT RECEIPTS
-- ============================================================
-- Kept identical to backend/migrations/049_farm_event_receipts.sql (everything below its
-- header) so a fresh install and an upgraded database end up the same. See that file for why.

CREATE TABLE IF NOT EXISTS farm_event_receipts (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(80) NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_farm_event_receipts_created ON farm_event_receipts(created_at);

-- ============================================================
-- 68. GROUP CONSULTATIONS (migration 051)
-- ============================================================
ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_consultations_group ON consultations(group_id) WHERE group_id IS NOT NULL;

-- ============================================================
-- 69. GROUP SHARING WITH A HOSPITAL NETWORK (migration 052)
-- ============================================================
CREATE TABLE IF NOT EXISTS group_share_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES animal_groups(id) ON DELETE CASCADE,
  cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash VARCHAR(64) NOT NULL UNIQUE,
  allow_medical_records BOOLEAN NOT NULL DEFAULT true,
  allow_vaccination_records BOOLEAN NOT NULL DEFAULT true,
  allow_prescriptions BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP NOT NULL,
  redeemed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_group_share_codes_group ON group_share_codes(group_id);

CREATE TABLE IF NOT EXISTS group_care_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES animal_groups(id) ON DELETE CASCADE,
  network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
  hospital_id UUID,
  cycle_id UUID REFERENCES group_cycles(id) ON DELETE SET NULL,
  share_code_id UUID REFERENCES group_share_codes(id) ON DELETE SET NULL,
  shared_by UUID REFERENCES users(id) ON DELETE SET NULL,
  redeemed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  allow_medical_records BOOLEAN NOT NULL DEFAULT true,
  allow_vaccination_records BOOLEAN NOT NULL DEFAULT true,
  allow_prescriptions BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'ended', 'revoked')),
  valid_until TIMESTAMP,
  ended_at TIMESTAMP,
  ended_reason VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- One live sharing per group and network; a later cycle gets a new row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_care_contexts_live
  ON group_care_contexts(group_id, network_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_group_care_contexts_network ON group_care_contexts(network_id) WHERE status = 'active';

-- Hidden technical errors, counted per distinct problem (daily email digest reads this).
CREATE TABLE IF NOT EXISTS system_error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature VARCHAR(64) NOT NULL UNIQUE,
  reference VARCHAR(16) NOT NULL,
  status INTEGER NOT NULL DEFAULT 500,
  method VARCHAR(10),
  path VARCHAR(300),
  message TEXT NOT NULL,
  occurrences INTEGER NOT NULL DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  emailed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_system_error_log_last_seen ON system_error_log (last_seen DESC);

-- ============================================================
-- ANIMAL NUTRITION MODULE (mirrors backend/migrations/056_nutrition_foundation.sql - keep in sync)
-- ============================================================
-- Migration 056: animal nutrition module - foundation (docs/NUTRITION_PLAN.md, Phase 1)
--
-- One schema for EVERY species, so later phases add calculators, not tables:
--   * master_species / master_animal_classes get `nutrition_model` - which pattern a species is fed by
--     (companion_energy, ruminant_dm, monogastric_spec, aqua_biomass, equine_dm, guidance_only). Code
--     branches on the model, never on a species name. Unknown / admin-added species stay guidance_only.
--   * weight_history becomes the ONE body-measurement history (owner decision 2026-11-22): weight,
--     body condition score and muscle condition, from any screen (medical records, farm health
--     observations, nutrition). weight is now optional because a condition score can be taken alone.
--   * animals get two owned facts nutrition needs and the animal profile shows: activity_level, housing.
--   * reference data (energy factors, requirement sets, foods, unsafe foods) carries source, licence and
--     a validation status: everything starts 'unvalidated' until the owner's vet signs it off.
--   * plans, plan items, pet feeding logs, risk flags and usage events.
--   * dark-launched behind system setting nutrition.enabled (default false).
--
-- Idempotent, and never hardcodes a schema name. Mirrored at the end of docker/init.sql.

-- ─── 1. Which nutrition model a species / class uses ─────────────────────────
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS nutrition_model VARCHAR(30) NOT NULL DEFAULT 'guidance_only'
  CHECK (nutrition_model IN ('companion_energy', 'ruminant_dm', 'monogastric_spec', 'aqua_biomass', 'equine_dm', 'guidance_only'));
-- Optional per-class override (NULL = use the species model).
ALTER TABLE master_animal_classes ADD COLUMN IF NOT EXISTS nutrition_model VARCHAR(30)
  CHECK (nutrition_model IS NULL OR nutrition_model IN ('companion_energy', 'ruminant_dm', 'monogastric_spec', 'aqua_biomass', 'equine_dm', 'guidance_only'));

-- Only rows still on the default are mapped, so an admin's later choice is never overwritten.
UPDATE master_species SET nutrition_model = 'companion_energy'
 WHERE nutrition_model = 'guidance_only' AND code IN ('Dog', 'Cat');
UPDATE master_species SET nutrition_model = 'ruminant_dm'
 WHERE nutrition_model = 'guidance_only' AND code IN ('Cattle', 'Buffalo', 'Goat', 'Sheep', 'Camel', 'Yak', 'Deer', 'Llama', 'Alpaca');
UPDATE master_species SET nutrition_model = 'monogastric_spec'
 WHERE nutrition_model = 'guidance_only' AND code IN ('Chicken', 'Duck', 'Turkey', 'Quail', 'Emu', 'Ostrich', 'Pig');
UPDATE master_species SET nutrition_model = 'equine_dm'
 WHERE nutrition_model = 'guidance_only' AND code IN ('Horse', 'Donkey');
UPDATE master_species SET nutrition_model = 'aqua_biomass'
 WHERE nutrition_model = 'guidance_only' AND category = 'Aquaculture';

-- ─── 2. weight_history = the one body-measurement history ────────────────────
ALTER TABLE weight_history ALTER COLUMN weight DROP NOT NULL;
ALTER TABLE weight_history ADD COLUMN IF NOT EXISTS body_condition_score NUMERIC(3,1)
  CHECK (body_condition_score IS NULL OR (body_condition_score >= 1 AND body_condition_score <= 9));
ALTER TABLE weight_history ADD COLUMN IF NOT EXISTS bcs_scale SMALLINT
  CHECK (bcs_scale IS NULL OR bcs_scale IN (5, 9));
ALTER TABLE weight_history ADD COLUMN IF NOT EXISTS muscle_condition VARCHAR(10)
  CHECK (muscle_condition IS NULL OR muscle_condition IN ('normal', 'mild', 'moderate', 'marked'));
ALTER TABLE weight_history ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'medical_record'
  CHECK (source IN ('medical_record', 'health_observation', 'nutrition', 'farm_event', 'import'));
ALTER TABLE weight_history ADD COLUMN IF NOT EXISTS source_id UUID;
DO $$ BEGIN
  ALTER TABLE weight_history ADD CONSTRAINT weight_history_has_measure_ck
    CHECK (weight IS NOT NULL OR body_condition_score IS NOT NULL OR muscle_condition IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_weight_history_animal_time ON weight_history(animal_id, recorded_at DESC);

-- ─── 3. Facts the animal profile owns (shown there and asked by nutrition) ────
ALTER TABLE animals ADD COLUMN IF NOT EXISTS activity_level VARCHAR(20)
  CHECK (activity_level IS NULL OR activity_level IN ('low', 'moderate', 'high', 'working'));
ALTER TABLE animals ADD COLUMN IF NOT EXISTS housing VARCHAR(20)
  CHECK (housing IS NULL OR housing IN ('indoor', 'outdoor', 'indoor_outdoor', 'stall_fed', 'grazing', 'semi_grazing'));

-- ─── 4. Energy factors (multiples of resting energy) ─────────────────────────
CREATE TABLE IF NOT EXISTS nutrition_energy_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species_code VARCHAR(50) NOT NULL,
  factor_key VARCHAR(40) NOT NULL,
  factor NUMERIC(5,2) NOT NULL CHECK (factor > 0 AND factor <= 10),
  source TEXT NOT NULL,
  licence VARCHAR(80),
  status VARCHAR(20) NOT NULL DEFAULT 'unvalidated' CHECK (status IN ('unvalidated', 'vet_validated', 'retired')),
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT nutrition_energy_factors_uq UNIQUE (species_code, factor_key)
);

-- MSD Veterinary Manual, "Daily maintenance energy requirements for dogs and cats" (multiples of RER),
-- and AAHA 2021 Nutrition & Weight Management Guidelines (weight-loss factor). See docs/NUTRITION_PLAN.md §2.1.
INSERT INTO nutrition_energy_factors (species_code, factor_key, factor, source, licence) VALUES
  ('Dog', 'adult_intact',        1.8, 'MSD Veterinary Manual - daily maintenance energy requirements table', 'cited reference'),
  ('Dog', 'adult_neutered',      1.6, 'MSD Veterinary Manual - daily maintenance energy requirements table', 'cited reference'),
  ('Dog', 'obesity_prone',       1.4, 'MSD Veterinary Manual - daily maintenance energy requirements table', 'cited reference'),
  ('Dog', 'growth_under_4m',     3.0, 'MSD Veterinary Manual - daily maintenance energy requirements table', 'cited reference'),
  ('Dog', 'growth_4m_to_adult',  2.0, 'MSD Veterinary Manual - daily maintenance energy requirements table', 'cited reference'),
  ('Dog', 'weight_loss',         1.0, 'AAHA 2021 Nutrition and Weight Management Guidelines (factor x RER of ideal weight)', 'cited reference'),
  ('Cat', 'adult_intact',        1.4, 'MSD Veterinary Manual - daily maintenance energy requirements table', 'cited reference'),
  ('Cat', 'adult_neutered',      1.2, 'MSD Veterinary Manual - daily maintenance energy requirements table', 'cited reference'),
  ('Cat', 'obesity_prone',       1.0, 'MSD Veterinary Manual - daily maintenance energy requirements table', 'cited reference'),
  ('Cat', 'growth_under_4m',     2.5, 'MSD Veterinary Manual - daily maintenance energy requirements table (kitten)', 'cited reference'),
  ('Cat', 'growth_4m_to_adult',  2.5, 'MSD Veterinary Manual - daily maintenance energy requirements table (kitten)', 'cited reference'),
  ('Cat', 'weight_loss',         0.8, 'AAHA 2021 Nutrition and Weight Management Guidelines (factor x RER of ideal weight)', 'cited reference')
ON CONFLICT (species_code, factor_key) DO NOTHING;

-- ─── 5. Requirement sets (nutrient minimums / maximums) ──────────────────────
-- Phase 1 ships the structure and the admin screen; the values are loaded per source once the owner
-- holds the right to use them (FEDIAF / AAFCO / NRC / NASEM / ICAR - docs/NUTRITION_PLAN.md §12.1 row 4).
CREATE TABLE IF NOT EXISTS nutrition_requirement_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(60) NOT NULL UNIQUE,
  nutrition_model VARCHAR(30) NOT NULL,
  species_code VARCHAR(50),
  life_stage VARCHAR(40),
  title VARCHAR(200) NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  licence VARCHAR(80),
  version INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'unvalidated' CHECK (status IN ('unvalidated', 'vet_validated', 'retired')),
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS nutrition_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL REFERENCES nutrition_requirement_sets(id) ON DELETE CASCADE,
  nutrient VARCHAR(40) NOT NULL,
  basis VARCHAR(20) NOT NULL CHECK (basis IN ('per_1000kcal', 'per_kg_dm', 'percent_dm', 'per_day', 'per_kg_bw075')),
  min_value NUMERIC(12,4),
  max_value NUMERIC(12,4),
  unit VARCHAR(20) NOT NULL,
  notes TEXT,
  CONSTRAINT nutrition_requirements_uq UNIQUE (set_id, nutrient, basis),
  CONSTRAINT nutrition_requirements_range_ck CHECK (min_value IS NOT NULL OR max_value IS NOT NULL)
);

-- ─── 6. Foods / feeds library ────────────────────────────────────────────────
-- Shared rows (owner_id and enterprise_id NULL) are master data an admin manages. A pet owner's own
-- food (owner_id) and a farm's own feed (enterprise_id) are private to them.
CREATE TABLE IF NOT EXISTS nutrition_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(60) UNIQUE,
  label VARCHAR(200) NOT NULL,
  label_key VARCHAR(150),
  label_hi VARCHAR(200),
  label_kn VARCHAR(200),
  label_ml VARCHAR(200),
  label_ta VARCHAR(200),
  label_te VARCHAR(200),
  kind VARCHAR(30) NOT NULL CHECK (kind IN ('commercial_food', 'home_food', 'treat', 'forage', 'concentrate',
                                            'mineral', 'supplement', 'compound_feed', 'aqua_feed')),
  models TEXT[] NOT NULL DEFAULT '{}',
  energy_kcal_per_100g NUMERIC(8,2) CHECK (energy_kcal_per_100g IS NULL OR (energy_kcal_per_100g >= 0 AND energy_kcal_per_100g <= 1000)),
  dry_matter_pct NUMERIC(5,2) CHECK (dry_matter_pct IS NULL OR (dry_matter_pct > 0 AND dry_matter_pct <= 100)),
  composition JSONB NOT NULL DEFAULT '{}',
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  enterprise_id UUID REFERENCES enterprises(id) ON DELETE CASCADE,
  source TEXT,
  licence VARCHAR(80),
  status VARCHAR(20) NOT NULL DEFAULT 'unvalidated' CHECK (status IN ('unvalidated', 'vet_validated', 'retired')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nutrition_ingredients_owner ON nutrition_ingredients(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nutrition_ingredients_farm ON nutrition_ingredients(enterprise_id) WHERE enterprise_id IS NOT NULL;
-- A farm feed in stock can name the library row it is (Phase 2 least-cost ration reads composition from it).
ALTER TABLE feed_inventory ADD COLUMN IF NOT EXISTS ingredient_id UUID REFERENCES nutrition_ingredients(id) ON DELETE SET NULL;

-- Common home foods (energy as cooked / as eaten). Approximate values from USDA FoodData Central; unvalidated
-- until the owner's vet signs them off. A packaged food's own label is always preferred over these.
INSERT INTO nutrition_ingredients (code, label, label_key, kind, models, energy_kcal_per_100g, source, licence) VALUES
  ('home_rice_cooked',     'Rice, cooked',              'nutrition.foods.home_rice_cooked',     'home_food', '{companion_energy}', 130, 'USDA FoodData Central (approximate)', 'public domain'),
  ('home_chicken_boiled',  'Chicken, boiled, no bones', 'nutrition.foods.home_chicken_boiled',  'home_food', '{companion_energy}', 165, 'USDA FoodData Central (approximate)', 'public domain'),
  ('home_egg_boiled',      'Egg, boiled',               'nutrition.foods.home_egg_boiled',      'home_food', '{companion_energy}', 155, 'USDA FoodData Central (approximate)', 'public domain'),
  ('home_curd',            'Curd (plain yoghurt)',      'nutrition.foods.home_curd',            'home_food', '{companion_energy}',  61, 'USDA FoodData Central (approximate)', 'public domain'),
  ('home_chapati',         'Chapati (plain)',           'nutrition.foods.home_chapati',         'home_food', '{companion_energy}', 297, 'USDA FoodData Central (approximate)', 'public domain'),
  ('home_fish_boiled',     'Fish, boiled, no bones',    'nutrition.foods.home_fish_boiled',     'home_food', '{companion_energy}', 128, 'USDA FoodData Central (approximate)', 'public domain'),
  ('home_pumpkin_boiled',  'Pumpkin, boiled',           'nutrition.foods.home_pumpkin_boiled',  'home_food', '{companion_energy}',  20, 'USDA FoodData Central (approximate)', 'public domain'),
  ('home_paneer',          'Paneer',                    'nutrition.foods.home_paneer',          'home_food', '{companion_energy}', 296, 'USDA FoodData Central (approximate)', 'public domain')
ON CONFLICT (code) DO NOTHING;

-- ─── 7. Foods that are unsafe for a species ──────────────────────────────────
CREATE TABLE IF NOT EXISTS nutrition_unsafe_foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(60) NOT NULL,
  species_code VARCHAR(50) NOT NULL,
  label VARCHAR(200) NOT NULL,
  label_key VARCHAR(150),
  label_hi VARCHAR(200),
  label_kn VARCHAR(200),
  label_ml VARCHAR(200),
  label_ta VARCHAR(200),
  label_te VARCHAR(200),
  match_terms TEXT[] NOT NULL DEFAULT '{}',
  severity VARCHAR(10) NOT NULL DEFAULT 'danger' CHECK (severity IN ('caution', 'danger')),
  source TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unvalidated' CHECK (status IN ('unvalidated', 'vet_validated', 'retired')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT nutrition_unsafe_foods_uq UNIQUE (species_code, code)
);

INSERT INTO nutrition_unsafe_foods (code, species_code, label, label_key, match_terms, severity, source) VALUES
  ('chocolate',  'Dog', 'Chocolate and cocoa',     'nutrition.unsafe.chocolate',  '{chocolate,cocoa}',                 'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('xylitol',    'Dog', 'Xylitol (sugar-free sweets, gum)', 'nutrition.unsafe.xylitol', '{xylitol,sugar-free,sugar free}', 'danger', 'ASPCA Animal Poison Control - people foods to avoid'),
  ('grapes',     'Dog', 'Grapes and raisins',      'nutrition.unsafe.grapes',     '{grape,raisin,kishmish}',           'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('onion',      'Dog', 'Onion and garlic',        'nutrition.unsafe.onion',      '{onion,garlic,pyaz,lahsun}',        'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('macadamia',  'Dog', 'Macadamia nuts',          'nutrition.unsafe.macadamia',  '{macadamia}',                       'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('alcohol',    'Dog', 'Alcohol',                 'nutrition.unsafe.alcohol',    '{alcohol,beer,wine,whisky,rum}',    'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('caffeine',   'Dog', 'Coffee, tea and caffeine','nutrition.unsafe.caffeine',   '{coffee,caffeine,tea}',             'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('cooked_bones','Dog','Cooked bones',            'nutrition.unsafe.cooked_bones','{cooked bone,cooked bones}',        'caution', 'ASPCA Animal Poison Control - people foods to avoid'),
  ('chocolate',  'Cat', 'Chocolate and cocoa',     'nutrition.unsafe.chocolate',  '{chocolate,cocoa}',                 'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('onion',      'Cat', 'Onion and garlic',        'nutrition.unsafe.onion',      '{onion,garlic,pyaz,lahsun}',        'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('grapes',     'Cat', 'Grapes and raisins',      'nutrition.unsafe.grapes',     '{grape,raisin,kishmish}',           'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('alcohol',    'Cat', 'Alcohol',                 'nutrition.unsafe.alcohol',    '{alcohol,beer,wine,whisky,rum}',    'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('caffeine',   'Cat', 'Coffee, tea and caffeine','nutrition.unsafe.caffeine',   '{coffee,caffeine,tea}',             'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('chocolate',  'Parrot', 'Chocolate and cocoa',  'nutrition.unsafe.chocolate',  '{chocolate,cocoa}',                 'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('avocado',    'Parrot', 'Avocado',              'nutrition.unsafe.avocado',    '{avocado,butter fruit}',            'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('caffeine',   'Parrot', 'Coffee, tea and caffeine','nutrition.unsafe.caffeine','{coffee,caffeine,tea}',             'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('salt',       'Parrot', 'Salty snacks',         'nutrition.unsafe.salt',       '{salt,chips,namkeen}',              'caution', 'ASPCA Animal Poison Control - people foods to avoid'),
  ('chocolate',  'Rabbit', 'Chocolate and cocoa',  'nutrition.unsafe.chocolate',  '{chocolate,cocoa}',                 'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('avocado',    'Rabbit', 'Avocado',              'nutrition.unsafe.avocado',    '{avocado,butter fruit}',            'danger',  'ASPCA Animal Poison Control - people foods to avoid'),
  ('onion',      'Rabbit', 'Onion and garlic',     'nutrition.unsafe.onion',      '{onion,garlic,pyaz,lahsun}',        'danger',  'ASPCA Animal Poison Control - people foods to avoid')
ON CONFLICT (species_code, code) DO NOTHING;

-- ─── 8. Plans ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nutrition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID REFERENCES animals(id) ON DELETE CASCADE,
  group_id UUID REFERENCES animal_groups(id) ON DELETE CASCADE,
  enterprise_id UUID REFERENCES enterprises(id) ON DELETE CASCADE,
  nutrition_model VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'superseded', 'archived')),
  validation VARCHAR(20) NOT NULL DEFAULT 'suggested' CHECK (validation IN ('suggested', 'vet_reviewed')),
  goal VARCHAR(20) NOT NULL DEFAULT 'maintain'
    CHECK (goal IN ('maintain', 'lose', 'gain', 'growth', 'gestation', 'lactation', 'production')),
  target_weight_kg NUMERIC(8,2) CHECK (target_weight_kg IS NULL OR target_weight_kg > 0),
  daily_energy_kcal NUMERIC(9,1) CHECK (daily_energy_kcal IS NULL OR daily_energy_kcal >= 0),
  daily_dm_kg NUMERIC(8,3) CHECK (daily_dm_kg IS NULL OR daily_dm_kg >= 0),
  meals_per_day SMALLINT NOT NULL DEFAULT 2 CHECK (meals_per_day BETWEEN 1 AND 12),
  energy_factor_key VARCHAR(40),
  requirement_set_id UUID REFERENCES nutrition_requirement_sets(id) ON DELETE SET NULL,
  engine_version VARCHAR(20) NOT NULL,
  inputs JSONB NOT NULL DEFAULT '{}',
  result JSONB NOT NULL DEFAULT '{}',
  vet_override_kcal NUMERIC(9,1),
  review_note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT nutrition_plans_subject_ck CHECK ((animal_id IS NOT NULL) <> (group_id IS NOT NULL))
);
-- At most one active plan per animal / group.
CREATE UNIQUE INDEX IF NOT EXISTS uq_nutrition_plans_active
  ON nutrition_plans ((COALESCE(animal_id, group_id))) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_animal ON nutrition_plans(animal_id, created_at DESC) WHERE animal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_group ON nutrition_plans(group_id, created_at DESC) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_farm ON nutrition_plans(enterprise_id) WHERE enterprise_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS nutrition_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES nutrition_plans(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES nutrition_ingredients(id) ON DELETE SET NULL,
  label VARCHAR(200) NOT NULL,
  share_pct NUMERIC(5,2) CHECK (share_pct IS NULL OR (share_pct > 0 AND share_pct <= 100)),
  amount_per_day NUMERIC(10,3) CHECK (amount_per_day IS NULL OR amount_per_day >= 0),
  unit VARCHAR(10) NOT NULL DEFAULT 'g' CHECK (unit IN ('g', 'kg')),
  energy_kcal_per_100g NUMERIC(8,2),
  kcal_per_day NUMERIC(9,1),
  cost_per_day NUMERIC(10,2),
  sort_order SMALLINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_nutrition_plan_items_plan ON nutrition_plan_items(plan_id);

-- ─── 9. What a pet actually ate (farm feed stays in farm_daily_records) ─────
CREATE TABLE IF NOT EXISTS nutrition_feeding_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES nutrition_plans(id) ON DELETE SET NULL,
  plan_item_id UUID REFERENCES nutrition_plan_items(id) ON DELETE SET NULL,
  ingredient_id UUID REFERENCES nutrition_ingredients(id) ON DELETE SET NULL,
  label VARCHAR(200) NOT NULL,
  kind VARCHAR(10) NOT NULL DEFAULT 'meal' CHECK (kind IN ('meal', 'treat')),
  amount_g NUMERIC(10,2) CHECK (amount_g IS NULL OR amount_g >= 0),
  kcal NUMERIC(9,1) CHECK (kcal IS NULL OR kcal >= 0),
  fed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  fed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nutrition_feeding_logs_animal_day ON nutrition_feeding_logs(animal_id, fed_on DESC);

-- ─── 10. Risk flags (rules now, models later - every flag is auditable) ───────
CREATE TABLE IF NOT EXISTS nutrition_risk_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID REFERENCES animals(id) ON DELETE CASCADE,
  group_id UUID REFERENCES animal_groups(id) ON DELETE CASCADE,
  flag_type VARCHAR(40) NOT NULL,
  severity VARCHAR(10) NOT NULL DEFAULT 'watch' CHECK (severity IN ('info', 'watch', 'act')),
  params JSONB NOT NULL DEFAULT '{}',
  rule_version VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed', 'resolved')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT nutrition_risk_flags_subject_ck CHECK ((animal_id IS NOT NULL) <> (group_id IS NOT NULL))
);
-- One open flag of a kind per subject; re-evaluating refreshes it instead of piling up duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS uq_nutrition_risk_flags_open
  ON nutrition_risk_flags ((COALESCE(animal_id, group_id)), flag_type) WHERE status = 'open';

-- ─── 11. Usage (so the later pricing decision rests on real use) ─────────────
CREATE TABLE IF NOT EXISTS nutrition_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_role VARCHAR(30),
  event VARCHAR(40) NOT NULL,
  nutrition_model VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nutrition_usage_events_time ON nutrition_usage_events(created_at DESC);

-- ─── 12. Switch ──────────────────────────────────────────────────────────────
INSERT INTO system_settings (key, value, category, description)
VALUES ('nutrition.enabled', 'false', 'nutrition',
        'Master switch for the animal nutrition module (plans, feeding, condition scores). Dark-launch flag, default off.')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ANIMAL NUTRITION - FARM RATIONS (mirrors backend/migrations/057_nutrition_farm_rations.sql - keep in sync)
-- ============================================================
-- Migration 057: animal nutrition - farm rations (docs/NUTRITION_PLAN.md, Phase 2)
--
-- Least-cost rations for ruminants (cattle, buffalo, goats, sheep, camels) on the SAME tables as Phase 1:
--   * nutrition_requirements gains two bases the ruminant method needs: percent_bw (eating capacity as % of body
--     weight), fraction (e.g. the late-pregnancy energy allowance).
--   * starting requirement sets for lactating / dry animals - every value 'unvalidated' with its source, for the
--     owner's vet to confirm or change in Admin -> Nutrition data (owner decision 2026-11-22).
--   * a starter library of common Indian feeds with typical composition (dry matter, energy, protein, minerals,
--     fibre), also 'unvalidated'. A farm's own lab report or the bag label always wins: a farm can add its own feed.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

ALTER TABLE nutrition_requirements DROP CONSTRAINT IF EXISTS nutrition_requirements_basis_check;
DO $$ BEGIN
  ALTER TABLE nutrition_requirements ADD CONSTRAINT nutrition_requirements_basis_check
    CHECK (basis IN ('per_1000kcal', 'per_kg_dm', 'percent_dm', 'per_day', 'per_kg_bw075', 'percent_bw', 'fraction', 'percent_milk', 'per_kg_bw', 'per_kg_gain', 'age_months'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Requirement sets (starting values; method in engine/ruminantRation.ts) ───────────────────────────────
-- Energy: NEL maintenance 0.08 Mcal per kg^0.75 and the milk energy equation are NRC (2001) Nutrient Requirements
-- of Dairy Cattle. Protein / mineral / fibre / intake figures are common field targets for Indian dairy animals.
-- All of it awaits the owner's vet; it is data, so changing it needs no code.
INSERT INTO nutrition_requirement_sets (code, nutrition_model, species_code, life_stage, title, source, licence) VALUES
  ('ruminant_cattle_lactating', 'ruminant_dm', 'Cattle',  'lactating', 'Cattle - in milk (starting values)',  'NRC 2001 energy equations; common field targets for protein, minerals, fibre and intake', 'cited reference'),
  ('ruminant_cattle_dry',       'ruminant_dm', 'Cattle',  'dry',       'Cattle - dry / not in milk (starting values)', 'NRC 2001 energy equations; common field targets for protein, minerals, fibre and intake', 'cited reference'),
  ('ruminant_buffalo_lactating','ruminant_dm', 'Buffalo', 'lactating', 'Buffalo - in milk (starting values)', 'NRC 2001 energy equations applied with buffalo milk composition; common field targets', 'cited reference'),
  ('ruminant_buffalo_dry',      'ruminant_dm', 'Buffalo', 'dry',       'Buffalo - dry / not in milk (starting values)', 'NRC 2001 energy equations; common field targets', 'cited reference'),
  ('ruminant_small_lactating',  'ruminant_dm', NULL,      'lactating', 'Goats, sheep - in milk (starting values)', 'Common field targets for small ruminants', 'cited reference'),
  ('ruminant_small_dry',        'ruminant_dm', NULL,      'dry',       'Goats, sheep, camels - maintenance (starting values)', 'Common field targets for small ruminants', 'cited reference')
ON CONFLICT (code) DO NOTHING;

-- One row per parameter. nutrient names are the engine's RuminantRequirements keys.
INSERT INTO nutrition_requirements (set_id, nutrient, basis, min_value, max_value, unit, notes)
SELECT s.id, v.nutrient, v.basis, v.min_value, v.max_value, v.unit, v.notes
  FROM nutrition_requirement_sets s
  JOIN (VALUES
    -- code, nutrient, basis, min, max, unit, notes
    ('ruminant_cattle_lactating', 'nel_maintenance', 'per_kg_bw075', 0.08, NULL, 'Mcal', 'NRC 2001'),
    ('ruminant_cattle_lactating', 'late_pregnancy',  'fraction',     0.25, NULL, 'x maintenance', 'last 2 months'),
    ('ruminant_cattle_lactating', 'dmi',             'percent_bw',   2.0,  3.5,  '%', NULL),
    ('ruminant_cattle_lactating', 'cp',              'percent_dm',   14,   NULL, '%', NULL),
    ('ruminant_cattle_lactating', 'ca',              'percent_dm',   0.6,  NULL, '%', NULL),
    ('ruminant_cattle_lactating', 'p',               'percent_dm',   0.38, NULL, '%', NULL),
    ('ruminant_cattle_lactating', 'ndf',             'percent_dm',   28,   NULL, '%', 'rumen health'),
    ('ruminant_cattle_lactating', 'forage',          'percent_dm',   40,   NULL, '%', 'rumen health'),
    ('ruminant_cattle_lactating', 'milk_fat',        'percent_milk',   4.0,  NULL, '%', 'default milk fat when not recorded'),
    ('ruminant_cattle_lactating', 'milk_protein',    'percent_milk',   3.2,  NULL, '%', 'default'),
    ('ruminant_cattle_lactating', 'milk_lactose',    'percent_milk',   4.8,  NULL, '%', 'default'),
    ('ruminant_cattle_dry',       'nel_maintenance', 'per_kg_bw075', 0.08, NULL, 'Mcal', 'NRC 2001'),
    ('ruminant_cattle_dry',       'late_pregnancy',  'fraction',     0.25, NULL, 'x maintenance', 'last 2 months'),
    ('ruminant_cattle_dry',       'dmi',             'percent_bw',   1.8,  2.5,  '%', NULL),
    ('ruminant_cattle_dry',       'cp',              'percent_dm',   11,   NULL, '%', NULL),
    ('ruminant_cattle_dry',       'ca',              'percent_dm',   0.45, NULL, '%', NULL),
    ('ruminant_cattle_dry',       'p',               'percent_dm',   0.25, NULL, '%', NULL),
    ('ruminant_cattle_dry',       'ndf',             'percent_dm',   33,   NULL, '%', NULL),
    ('ruminant_cattle_dry',       'forage',          'percent_dm',   60,   NULL, '%', NULL),
    ('ruminant_buffalo_lactating','nel_maintenance', 'per_kg_bw075', 0.08, NULL, 'Mcal', 'NRC 2001'),
    ('ruminant_buffalo_lactating','late_pregnancy',  'fraction',     0.25, NULL, 'x maintenance', 'last 2 months'),
    ('ruminant_buffalo_lactating','dmi',             'percent_bw',   2.0,  3.2,  '%', NULL),
    ('ruminant_buffalo_lactating','cp',              'percent_dm',   14,   NULL, '%', NULL),
    ('ruminant_buffalo_lactating','ca',              'percent_dm',   0.6,  NULL, '%', NULL),
    ('ruminant_buffalo_lactating','p',               'percent_dm',   0.38, NULL, '%', NULL),
    ('ruminant_buffalo_lactating','ndf',             'percent_dm',   30,   NULL, '%', NULL),
    ('ruminant_buffalo_lactating','forage',          'percent_dm',   45,   NULL, '%', NULL),
    ('ruminant_buffalo_lactating','milk_fat',        'percent_milk',   7.0,  NULL, '%', 'default buffalo milk fat'),
    ('ruminant_buffalo_lactating','milk_protein',    'percent_milk',   4.2,  NULL, '%', 'default'),
    ('ruminant_buffalo_lactating','milk_lactose',    'percent_milk',   4.9,  NULL, '%', 'default'),
    ('ruminant_buffalo_dry',      'nel_maintenance', 'per_kg_bw075', 0.08, NULL, 'Mcal', 'NRC 2001'),
    ('ruminant_buffalo_dry',      'late_pregnancy',  'fraction',     0.25, NULL, 'x maintenance', 'last 2 months'),
    ('ruminant_buffalo_dry',      'dmi',             'percent_bw',   1.8,  2.5,  '%', NULL),
    ('ruminant_buffalo_dry',      'cp',              'percent_dm',   11,   NULL, '%', NULL),
    ('ruminant_buffalo_dry',      'ca',              'percent_dm',   0.45, NULL, '%', NULL),
    ('ruminant_buffalo_dry',      'p',               'percent_dm',   0.25, NULL, '%', NULL),
    ('ruminant_buffalo_dry',      'ndf',             'percent_dm',   33,   NULL, '%', NULL),
    ('ruminant_buffalo_dry',      'forage',          'percent_dm',   60,   NULL, '%', NULL),
    ('ruminant_small_lactating',  'nel_maintenance', 'per_kg_bw075', 0.10, NULL, 'Mcal', NULL),
    ('ruminant_small_lactating',  'late_pregnancy',  'fraction',     0.30, NULL, 'x maintenance', 'last 2 months'),
    ('ruminant_small_lactating',  'dmi',             'percent_bw',   3.0,  5.0,  '%', NULL),
    ('ruminant_small_lactating',  'cp',              'percent_dm',   14,   NULL, '%', NULL),
    ('ruminant_small_lactating',  'ca',              'percent_dm',   0.6,  NULL, '%', NULL),
    ('ruminant_small_lactating',  'p',               'percent_dm',   0.35, NULL, '%', NULL),
    ('ruminant_small_lactating',  'ndf',             'percent_dm',   30,   NULL, '%', NULL),
    ('ruminant_small_lactating',  'forage',          'percent_dm',   50,   NULL, '%', NULL),
    ('ruminant_small_lactating',  'milk_fat',        'percent_milk',   4.5,  NULL, '%', 'default goat milk fat'),
    ('ruminant_small_lactating',  'milk_protein',    'percent_milk',   3.4,  NULL, '%', 'default'),
    ('ruminant_small_lactating',  'milk_lactose',    'percent_milk',   4.4,  NULL, '%', 'default'),
    ('ruminant_small_dry',        'nel_maintenance', 'per_kg_bw075', 0.10, NULL, 'Mcal', NULL),
    ('ruminant_small_dry',        'late_pregnancy',  'fraction',     0.30, NULL, 'x maintenance', 'last 2 months'),
    ('ruminant_small_dry',        'dmi',             'percent_bw',   2.5,  4.0,  '%', NULL),
    ('ruminant_small_dry',        'cp',              'percent_dm',   10,   NULL, '%', NULL),
    ('ruminant_small_dry',        'ca',              'percent_dm',   0.4,  NULL, '%', NULL),
    ('ruminant_small_dry',        'p',               'percent_dm',   0.25, NULL, '%', NULL),
    ('ruminant_small_dry',        'ndf',             'percent_dm',   35,   NULL, '%', NULL),
    ('ruminant_small_dry',        'forage',          'percent_dm',   60,   NULL, '%', NULL)
  ) AS v(code, nutrient, basis, min_value, max_value, unit, notes) ON v.code = s.code
ON CONFLICT (set_id, nutrient, basis) DO NOTHING;

-- ─── Common Indian feeds (typical composition, per kg DRY MATTER; dm_pct as fed) ─────────────────────────────
-- composition keys: dm_pct, nel_mcal_kg_dm, cp_pct_dm, ca_pct_dm, p_pct_dm, ndf_pct_dm, is_forage (1/0)
INSERT INTO nutrition_ingredients (code, label, label_key, kind, models, dry_matter_pct, composition, source, licence) VALUES
  ('feed_green_maize',    'Green maize fodder',        'nutrition.foods.feed_green_maize',    'forage',      '{ruminant_dm}', 20, '{"dm_pct":20,"nel_mcal_kg_dm":1.30,"cp_pct_dm":8,"ca_pct_dm":0.35,"p_pct_dm":0.20,"ndf_pct_dm":55,"is_forage":1}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_berseem',        'Berseem (green)',           'nutrition.foods.feed_berseem',        'forage',      '{ruminant_dm}', 18, '{"dm_pct":18,"nel_mcal_kg_dm":1.35,"cp_pct_dm":18,"ca_pct_dm":1.5,"p_pct_dm":0.30,"ndf_pct_dm":42,"is_forage":1}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_napier',         'Napier / hybrid napier (green)', 'nutrition.foods.feed_napier',    'forage',      '{ruminant_dm}', 18, '{"dm_pct":18,"nel_mcal_kg_dm":1.15,"cp_pct_dm":9,"ca_pct_dm":0.40,"p_pct_dm":0.25,"ndf_pct_dm":65,"is_forage":1}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_sorghum_green',  'Green sorghum (jowar) fodder', 'nutrition.foods.feed_sorghum_green', 'forage',   '{ruminant_dm}', 25, '{"dm_pct":25,"nel_mcal_kg_dm":1.20,"cp_pct_dm":7,"ca_pct_dm":0.35,"p_pct_dm":0.20,"ndf_pct_dm":60,"is_forage":1}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_wheat_straw',    'Wheat straw (bhusa)',       'nutrition.foods.feed_wheat_straw',    'forage',      '{ruminant_dm}', 90, '{"dm_pct":90,"nel_mcal_kg_dm":0.90,"cp_pct_dm":3.5,"ca_pct_dm":0.20,"p_pct_dm":0.08,"ndf_pct_dm":75,"is_forage":1}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_paddy_straw',    'Paddy straw',               'nutrition.foods.feed_paddy_straw',    'forage',      '{ruminant_dm}', 90, '{"dm_pct":90,"nel_mcal_kg_dm":0.85,"cp_pct_dm":3.5,"ca_pct_dm":0.25,"p_pct_dm":0.08,"ndf_pct_dm":72,"is_forage":1}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_maize_grain',    'Maize grain (crushed)',     'nutrition.foods.feed_maize_grain',    'concentrate', '{ruminant_dm}', 89, '{"dm_pct":89,"nel_mcal_kg_dm":1.95,"cp_pct_dm":9,"ca_pct_dm":0.03,"p_pct_dm":0.30,"ndf_pct_dm":10,"is_forage":0}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_wheat_bran',     'Wheat bran (chokar)',       'nutrition.foods.feed_wheat_bran',     'concentrate', '{ruminant_dm}', 89, '{"dm_pct":89,"nel_mcal_kg_dm":1.55,"cp_pct_dm":16,"ca_pct_dm":0.13,"p_pct_dm":1.10,"ndf_pct_dm":45,"is_forage":0}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_cottonseed_cake','Cottonseed cake (binola khal)', 'nutrition.foods.feed_cottonseed_cake', 'concentrate', '{ruminant_dm}', 92, '{"dm_pct":92,"nel_mcal_kg_dm":1.65,"cp_pct_dm":24,"ca_pct_dm":0.20,"p_pct_dm":0.70,"ndf_pct_dm":35,"is_forage":0}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_groundnut_cake', 'Groundnut cake',            'nutrition.foods.feed_groundnut_cake', 'concentrate', '{ruminant_dm}', 92, '{"dm_pct":92,"nel_mcal_kg_dm":1.75,"cp_pct_dm":45,"ca_pct_dm":0.20,"p_pct_dm":0.60,"ndf_pct_dm":15,"is_forage":0}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_mustard_cake',   'Mustard cake',              'nutrition.foods.feed_mustard_cake',   'concentrate', '{ruminant_dm}', 92, '{"dm_pct":92,"nel_mcal_kg_dm":1.65,"cp_pct_dm":36,"ca_pct_dm":0.60,"p_pct_dm":1.00,"ndf_pct_dm":25,"is_forage":0}', 'Typical values, Indian feed composition literature', 'typical values'),
  ('feed_cattle_feed',    'Compound cattle feed (BIS type II)', 'nutrition.foods.feed_cattle_feed', 'compound_feed', '{ruminant_dm}', 90, '{"dm_pct":90,"nel_mcal_kg_dm":1.60,"cp_pct_dm":22,"ca_pct_dm":0.80,"p_pct_dm":0.55,"ndf_pct_dm":28,"is_forage":0}', 'Typical values; IS 2052 sets minimums - use the bag label when you have it', 'typical values'),
  ('feed_mineral_mixture','Mineral mixture',           'nutrition.foods.feed_mineral_mixture','mineral',     '{ruminant_dm}', 98, '{"dm_pct":98,"nel_mcal_kg_dm":0,"cp_pct_dm":0,"ca_pct_dm":20,"p_pct_dm":10,"ndf_pct_dm":0,"is_forage":0}', 'Typical values; use the bag label when you have it', 'typical values')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- NUTRITION OWNER-APPROVED STATUS (mirrors backend/migrations/058_nutrition_owner_approved.sql - keep in sync)
-- ============================================================
-- Migration 058: nutrition reference data - "approved by the platform owner, vet review pending"
--
-- Owner decision 2026-11-22: approve every nutrition reference record for use now; the vet review follows later.
-- A separate status keeps that honest: 'owner_approved' means approved for use, NOT checked by a vet. Screens stop
-- warning end users, and the vet can still find each row and move it to 'vet_validated'.
-- Applies to energy factors, requirement sets, foods/feeds and unsafe foods. Plan reviews (nutrition_plans.validation)
-- are per-animal vet decisions and are NOT changed here.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

ALTER TABLE nutrition_energy_factors DROP CONSTRAINT IF EXISTS nutrition_energy_factors_status_check;
ALTER TABLE nutrition_requirement_sets DROP CONSTRAINT IF EXISTS nutrition_requirement_sets_status_check;
ALTER TABLE nutrition_ingredients DROP CONSTRAINT IF EXISTS nutrition_ingredients_status_check;
ALTER TABLE nutrition_unsafe_foods DROP CONSTRAINT IF EXISTS nutrition_unsafe_foods_status_check;

DO $$ BEGIN
  ALTER TABLE nutrition_energy_factors ADD CONSTRAINT nutrition_energy_factors_status_check
    CHECK (status IN ('unvalidated', 'owner_approved', 'vet_validated', 'retired'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE nutrition_requirement_sets ADD CONSTRAINT nutrition_requirement_sets_status_check
    CHECK (status IN ('unvalidated', 'owner_approved', 'vet_validated', 'retired'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE nutrition_ingredients ADD CONSTRAINT nutrition_ingredients_status_check
    CHECK (status IN ('unvalidated', 'owner_approved', 'vet_validated', 'retired'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE nutrition_unsafe_foods ADD CONSTRAINT nutrition_unsafe_foods_status_check
    CHECK (status IN ('unvalidated', 'owner_approved', 'vet_validated', 'retired'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Every shared reference row still awaiting review -> approved by the owner (vet review pending).
-- Private foods a pet owner or farm typed from their own label are theirs and are left alone.
UPDATE nutrition_energy_factors   SET status = 'owner_approved', updated_at = NOW() WHERE status = 'unvalidated';
UPDATE nutrition_requirement_sets SET status = 'owner_approved', updated_at = NOW() WHERE status = 'unvalidated';
UPDATE nutrition_unsafe_foods     SET status = 'owner_approved', updated_at = NOW() WHERE status = 'unvalidated';
UPDATE nutrition_ingredients      SET status = 'owner_approved', updated_at = NOW()
 WHERE status = 'unvalidated' AND owner_id IS NULL AND enterprise_id IS NULL;

-- ============================================================
-- NUTRITION GROUP FEEDING (mirrors backend/migrations/059_nutrition_group_feeding.sql - keep in sync)
-- ============================================================
-- Migration 059: animal nutrition - group feeding for flocks, pig batches and ponds (docs/NUTRITION_PLAN.md, Phase 2)
--
-- Feeding curves are master data: per head per day by age (poultry, pigs) or % of biomass per day by average
-- body weight (fish, shrimp), plus a water-temperature factor for ponds. The method is engine/groupFeeding.ts.
-- Rows match a group by species and, optionally, its group type (broilers vs layers). Seeded values are TYPICAL
-- figures from breed management guides and common aquaculture feeding tables - 'unvalidated' until the owner
-- approves them (Admin -> Nutrition data, "Approve all pending") and the vet reviews them. A farm's own feed bag
-- table always wins: an admin can edit any row.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

CREATE TABLE IF NOT EXISTS nutrition_feeding_curves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curve_key VARCHAR(60) NOT NULL,
  title VARCHAR(200) NOT NULL,
  nutrition_model VARCHAR(30) NOT NULL CHECK (nutrition_model IN ('monogastric_spec', 'aqua_biomass')),
  species_codes TEXT[] NOT NULL DEFAULT '{}',
  group_types TEXT[] NOT NULL DEFAULT '{}',
  basis VARCHAR(20) NOT NULL CHECK (basis IN ('per_head', 'percent_biomass')),
  product VARCHAR(10) NOT NULL DEFAULT 'meat' CHECK (product IN ('meat', 'eggs')),
  egg_mass_g NUMERIC(6,2),
  age_from_days INTEGER,
  age_to_days INTEGER,
  weight_from_g NUMERIC(10,2),
  weight_to_g NUMERIC(10,2),
  grams_per_head_day NUMERIC(10,2) CHECK (grams_per_head_day IS NULL OR grams_per_head_day >= 0),
  rate_pct_biomass NUMERIC(6,3) CHECK (rate_pct_biomass IS NULL OR (rate_pct_biomass >= 0 AND rate_pct_biomass <= 30)),
  feeds_per_day SMALLINT,
  feed_type VARCHAR(40),
  source TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unvalidated' CHECK (status IN ('unvalidated', 'owner_approved', 'vet_validated', 'retired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT nutrition_feeding_curves_band_ck CHECK (
    (basis = 'per_head' AND grams_per_head_day IS NOT NULL) OR (basis = 'percent_biomass' AND rate_pct_biomass IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_nutrition_feeding_curves_band
  ON nutrition_feeding_curves (curve_key, COALESCE(age_from_days, -1), COALESCE(weight_from_g, -1));

CREATE TABLE IF NOT EXISTS nutrition_temperature_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curve_key VARCHAR(60) NOT NULL,
  from_c NUMERIC(5,2) NOT NULL,
  to_c NUMERIC(5,2) NOT NULL,
  factor NUMERIC(4,2) NOT NULL CHECK (factor >= 0 AND factor <= 2),
  source TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unvalidated' CHECK (status IN ('unvalidated', 'owner_approved', 'vet_validated', 'retired')),
  CONSTRAINT nutrition_temperature_factors_uq UNIQUE (curve_key, from_c)
);

-- ─── Seeds (typical values) ───────────────────────────────────────────────
INSERT INTO nutrition_feeding_curves
  (curve_key, title, nutrition_model, species_codes, group_types, basis, product, egg_mass_g, age_from_days, age_to_days, grams_per_head_day, feeds_per_day, feed_type, source)
VALUES
  ('chicken_broiler', 'Broiler chicken', 'monogastric_spec', '{Chicken}', '{broilers,chicks_brooding,growers}', 'per_head', 'meat', NULL, 0,   7,  20, 6, 'starter',  'Typical broiler management-guide intake'),
  ('chicken_broiler', 'Broiler chicken', 'monogastric_spec', '{Chicken}', '{broilers,chicks_brooding,growers}', 'per_head', 'meat', NULL, 8,   14, 45, 4, 'starter',  'Typical broiler management-guide intake'),
  ('chicken_broiler', 'Broiler chicken', 'monogastric_spec', '{Chicken}', '{broilers,chicks_brooding,growers}', 'per_head', 'meat', NULL, 15,  21, 85, 3, 'grower',   'Typical broiler management-guide intake'),
  ('chicken_broiler', 'Broiler chicken', 'monogastric_spec', '{Chicken}', '{broilers,chicks_brooding,growers}', 'per_head', 'meat', NULL, 22,  28, 125, 3, 'grower',  'Typical broiler management-guide intake'),
  ('chicken_broiler', 'Broiler chicken', 'monogastric_spec', '{Chicken}', '{broilers,chicks_brooding,growers}', 'per_head', 'meat', NULL, 29,  35, 160, 3, 'finisher', 'Typical broiler management-guide intake'),
  ('chicken_broiler', 'Broiler chicken', 'monogastric_spec', '{Chicken}', '{broilers,chicks_brooding,growers}', 'per_head', 'meat', NULL, 36,  60, 185, 3, 'finisher', 'Typical broiler management-guide intake'),
  ('chicken_layer',   'Laying hens',     'monogastric_spec', '{Chicken}', '{layers,breeders,backyard_flock}', 'per_head', 'eggs', 60, 0,   42, 30, 4, 'chick',    'Typical layer management-guide intake'),
  ('chicken_layer',   'Laying hens',     'monogastric_spec', '{Chicken}', '{layers,breeders,backyard_flock}', 'per_head', 'eggs', 60, 43,  126, 70, 2, 'grower',  'Typical layer management-guide intake'),
  ('chicken_layer',   'Laying hens',     'monogastric_spec', '{Chicken}', '{layers,breeders,backyard_flock}', 'per_head', 'eggs', 60, 127, 900, 115, 2, 'layer',  'Typical layer management-guide intake'),
  ('quail_layer',     'Japanese quail',  'monogastric_spec', '{Quail}',   '{}', 'per_head', 'eggs', 11, 0,   35, 15, 3, 'starter',  'Typical quail feeding guide'),
  ('quail_layer',     'Japanese quail',  'monogastric_spec', '{Quail}',   '{}', 'per_head', 'eggs', 11, 36,  900, 25, 2, 'layer',   'Typical quail feeding guide'),
  ('duck_general',    'Ducks',           'monogastric_spec', '{Duck}',    '{}', 'per_head', 'meat', NULL, 0,  21, 60, 4, 'starter',  'Typical duck feeding guide'),
  ('duck_general',    'Ducks',           'monogastric_spec', '{Duck}',    '{}', 'per_head', 'meat', NULL, 22, 900, 160, 2, 'grower', 'Typical duck feeding guide'),
  ('pig_general',     'Pigs',            'monogastric_spec', '{Pig}',     '{}', 'per_head', 'meat', NULL, 0,   60, 400, 4, 'creep / weaner', 'Typical pig feeding guide'),
  ('pig_general',     'Pigs',            'monogastric_spec', '{Pig}',     '{}', 'per_head', 'meat', NULL, 61,  120, 1500, 2, 'grower', 'Typical pig feeding guide'),
  ('pig_general',     'Pigs',            'monogastric_spec', '{Pig}',     '{}', 'per_head', 'meat', NULL, 121, 220, 2500, 2, 'finisher', 'Typical pig feeding guide'),
  ('pig_general',     'Pigs',            'monogastric_spec', '{Pig}',     '{}', 'per_head', 'meat', NULL, 221, 9000, 2800, 2, 'adult / sow', 'Typical pig feeding guide')
ON CONFLICT DO NOTHING;

INSERT INTO nutrition_feeding_curves
  (curve_key, title, nutrition_model, species_codes, group_types, basis, product, weight_from_g, weight_to_g, rate_pct_biomass, feeds_per_day, feed_type, source)
VALUES
  ('shrimp_general', 'Shrimp (vannamei, tiger, Indian white)', 'aqua_biomass', '{Vannamei Shrimp,Black Tiger Shrimp,Indian White Shrimp,Freshwater Prawn}', '{}', 'percent_biomass', 'meat', 0,  1,   10,  4, 'starter crumble', 'Typical shrimp feeding table'),
  ('shrimp_general', 'Shrimp (vannamei, tiger, Indian white)', 'aqua_biomass', '{Vannamei Shrimp,Black Tiger Shrimp,Indian White Shrimp,Freshwater Prawn}', '{}', 'percent_biomass', 'meat', 1,  5,   6,   4, 'starter',  'Typical shrimp feeding table'),
  ('shrimp_general', 'Shrimp (vannamei, tiger, Indian white)', 'aqua_biomass', '{Vannamei Shrimp,Black Tiger Shrimp,Indian White Shrimp,Freshwater Prawn}', '{}', 'percent_biomass', 'meat', 5,  10,  4,   4, 'grower',   'Typical shrimp feeding table'),
  ('shrimp_general', 'Shrimp (vannamei, tiger, Indian white)', 'aqua_biomass', '{Vannamei Shrimp,Black Tiger Shrimp,Indian White Shrimp,Freshwater Prawn}', '{}', 'percent_biomass', 'meat', 10, 15,  3.2, 4, 'grower',   'Typical shrimp feeding table'),
  ('shrimp_general', 'Shrimp (vannamei, tiger, Indian white)', 'aqua_biomass', '{Vannamei Shrimp,Black Tiger Shrimp,Indian White Shrimp,Freshwater Prawn}', '{}', 'percent_biomass', 'meat', 15, 20,  2.8, 4, 'finisher', 'Typical shrimp feeding table'),
  ('shrimp_general', 'Shrimp (vannamei, tiger, Indian white)', 'aqua_biomass', '{Vannamei Shrimp,Black Tiger Shrimp,Indian White Shrimp,Freshwater Prawn}', '{}', 'percent_biomass', 'meat', 20, 100, 2.4, 4, 'finisher', 'Typical shrimp feeding table'),
  ('fish_general', 'Fish (carps, tilapia, catfish, others)', 'aqua_biomass',
   '{Catla,Rohu,Mrigal,Bata,Calbasu,Silver Carp,Grass Carp,Common Carp,Tilapia,Magur,Singhi,Murrel,Climbing Perch,Pangasius,Giant Gourami,Asian Seabass,Milkfish,Grey Mullet,Pearlspot,Long Whiskers Catfish,Red Snapper}', '{}',
   'percent_biomass', 'meat', 0, 10, 5, 3, 'nursery', 'Typical fish feeding table'),
  ('fish_general', 'Fish (carps, tilapia, catfish, others)', 'aqua_biomass',
   '{Catla,Rohu,Mrigal,Bata,Calbasu,Silver Carp,Grass Carp,Common Carp,Tilapia,Magur,Singhi,Murrel,Climbing Perch,Pangasius,Giant Gourami,Asian Seabass,Milkfish,Grey Mullet,Pearlspot,Long Whiskers Catfish,Red Snapper}', '{}',
   'percent_biomass', 'meat', 10, 50, 3.5, 2, 'grower', 'Typical fish feeding table'),
  ('fish_general', 'Fish (carps, tilapia, catfish, others)', 'aqua_biomass',
   '{Catla,Rohu,Mrigal,Bata,Calbasu,Silver Carp,Grass Carp,Common Carp,Tilapia,Magur,Singhi,Murrel,Climbing Perch,Pangasius,Giant Gourami,Asian Seabass,Milkfish,Grey Mullet,Pearlspot,Long Whiskers Catfish,Red Snapper}', '{}',
   'percent_biomass', 'meat', 50, 200, 2.5, 2, 'grower', 'Typical fish feeding table'),
  ('fish_general', 'Fish (carps, tilapia, catfish, others)', 'aqua_biomass',
   '{Catla,Rohu,Mrigal,Bata,Calbasu,Silver Carp,Grass Carp,Common Carp,Tilapia,Magur,Singhi,Murrel,Climbing Perch,Pangasius,Giant Gourami,Asian Seabass,Milkfish,Grey Mullet,Pearlspot,Long Whiskers Catfish,Red Snapper}', '{}',
   'percent_biomass', 'meat', 200, 500, 2, 2, 'finisher', 'Typical fish feeding table'),
  ('fish_general', 'Fish (carps, tilapia, catfish, others)', 'aqua_biomass',
   '{Catla,Rohu,Mrigal,Bata,Calbasu,Silver Carp,Grass Carp,Common Carp,Tilapia,Magur,Singhi,Murrel,Climbing Perch,Pangasius,Giant Gourami,Asian Seabass,Milkfish,Grey Mullet,Pearlspot,Long Whiskers Catfish,Red Snapper}', '{}',
   'percent_biomass', 'meat', 500, 100000, 1.5, 2, 'finisher', 'Typical fish feeding table')
ON CONFLICT DO NOTHING;

INSERT INTO nutrition_temperature_factors (curve_key, from_c, to_c, factor, source) VALUES
  ('shrimp_general', 0,  22, 0.5, 'Typical aquaculture practice: feed less in cold water'),
  ('shrimp_general', 22, 26, 0.8, 'Typical aquaculture practice'),
  ('shrimp_general', 26, 32, 1.0, 'Typical aquaculture practice'),
  ('shrimp_general', 32, 45, 0.7, 'Typical aquaculture practice: feed less in hot water'),
  ('fish_general',   0,  18, 0.4, 'Typical aquaculture practice: feed less in cold water'),
  ('fish_general',   18, 24, 0.8, 'Typical aquaculture practice'),
  ('fish_general',   24, 32, 1.0, 'Typical aquaculture practice'),
  ('fish_general',   32, 45, 0.7, 'Typical aquaculture practice: feed less in hot water')
ON CONFLICT DO NOTHING;

-- Migration 060: animal nutrition - horses, ponies, donkeys, mules (docs/NUTRITION_PLAN.md, Phase 2, model equine_dm)
--
-- Same tables as every other model (no new table):
--   * nutrition_requirements gains basis 'per_kg_bw' (horse energy and minerals scale with body weight, not BW^0.75).
--   * starting requirement sets: horse (also used for ponies and mules) and donkey (donkeys need about three
--     quarters of a horse's energy for their weight and eat less). Method: engine/equineRation.ts.
--   * equine feeds: grass hay, green grass, lucerne hay, oats, horse gram (kulthi), Bengal gram (chana); and the
--     existing berseem, wheat bran, maize grain and mineral mixture gain horse energy (DE) values.
--   * unsafe for horses / donkeys: cattle or poultry feed with ionophores (monensin, lasalocid) and urea.
-- Every row starts 'owner_approved' (owner decision 2026-11-22: approved for use now, the vet confirms later).
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

ALTER TABLE nutrition_requirements DROP CONSTRAINT IF EXISTS nutrition_requirements_basis_check;
DO $$ BEGIN
  ALTER TABLE nutrition_requirements ADD CONSTRAINT nutrition_requirements_basis_check
    CHECK (basis IN ('per_1000kcal', 'per_kg_dm', 'percent_dm', 'per_day', 'per_kg_bw075', 'percent_bw', 'fraction', 'percent_milk', 'per_kg_bw', 'per_kg_gain', 'age_months'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Mules and ponies (when an admin adds them as species) follow the horse; donkeys are mapped by 056.
UPDATE master_species SET nutrition_model = 'equine_dm'
 WHERE nutrition_model = 'guidance_only' AND code IN ('Horse', 'Donkey', 'Mule', 'Pony');

INSERT INTO nutrition_requirement_sets (code, nutrition_model, species_code, life_stage, title, source, licence, status) VALUES
  ('equine_horse_maintenance',  'equine_dm', NULL,     'maintenance', 'Horses, ponies, mules (starting values)',
   'NRC 2007 Nutrient Requirements of Horses - method (DE per kg body weight, work as a multiple of maintenance); common field targets', 'cited reference', 'owner_approved'),
  ('equine_donkey_maintenance', 'equine_dm', 'Donkey', 'maintenance', 'Donkeys (starting values)',
   'Donkey energy about 75% of a horse of the same weight (The Donkey Sanctuary feeding guidance); common field targets', 'cited reference', 'owner_approved')
ON CONFLICT (code) DO NOTHING;

INSERT INTO nutrition_requirements (set_id, nutrient, basis, min_value, max_value, unit, notes)
SELECT s.id, v.nutrient, v.basis, v.min_value, v.max_value, v.unit, v.notes
  FROM nutrition_requirement_sets s
  JOIN (VALUES
    ('equine_horse_maintenance',  'de_maintenance', 'per_kg_bw',    0.0333, NULL, 'Mcal', 'NRC 2007 average maintenance'),
    ('equine_horse_maintenance',  'work_low',       'fraction',     1.0,    NULL, 'x maintenance', 'light use / resting'),
    ('equine_horse_maintenance',  'work_moderate',  'fraction',     1.2,    NULL, 'x maintenance', 'light work'),
    ('equine_horse_maintenance',  'work_high',      'fraction',     1.4,    NULL, 'x maintenance', 'moderate work'),
    ('equine_horse_maintenance',  'work_working',   'fraction',     1.6,    NULL, 'x maintenance', 'heavy work (cart, plough, long rides)'),
    ('equine_horse_maintenance',  'cp',             'per_1000kcal', 38,     NULL, 'g', 'g crude protein per Mcal DE'),
    ('equine_horse_maintenance',  'ca',             'per_kg_bw',    0.04,   NULL, 'g', NULL),
    ('equine_horse_maintenance',  'p',              'per_kg_bw',    0.028,  NULL, 'g', NULL),
    ('equine_horse_maintenance',  'dmi',            'percent_bw',   1.5,    2.5,  '%', NULL),
    ('equine_horse_maintenance',  'forage',         'percent_bw',   1.0,    NULL, '%', 'gut health - forage first'),
    ('equine_horse_maintenance',  'concentrate',    'percent_dm',   NULL,   50,   '%', 'colic / laminitis limit'),
    ('equine_donkey_maintenance', 'de_maintenance', 'per_kg_bw',    0.025,  NULL, 'Mcal', 'about 75% of a horse'),
    ('equine_donkey_maintenance', 'work_low',       'fraction',     1.0,    NULL, 'x maintenance', NULL),
    ('equine_donkey_maintenance', 'work_moderate',  'fraction',     1.2,    NULL, 'x maintenance', NULL),
    ('equine_donkey_maintenance', 'work_high',      'fraction',     1.4,    NULL, 'x maintenance', NULL),
    ('equine_donkey_maintenance', 'work_working',   'fraction',     1.6,    NULL, 'x maintenance', 'pack / cart work'),
    ('equine_donkey_maintenance', 'cp',             'per_1000kcal', 38,     NULL, 'g', 'g crude protein per Mcal DE'),
    ('equine_donkey_maintenance', 'ca',             'per_kg_bw',    0.04,   NULL, 'g', NULL),
    ('equine_donkey_maintenance', 'p',              'per_kg_bw',    0.028,  NULL, 'g', NULL),
    ('equine_donkey_maintenance', 'dmi',            'percent_bw',   1.3,    1.8,  '%', 'donkeys eat less than horses'),
    ('equine_donkey_maintenance', 'forage',         'percent_bw',   1.0,    NULL, '%', 'mostly straw / hay'),
    ('equine_donkey_maintenance', 'concentrate',    'percent_dm',   NULL,   25,   '%', 'donkeys rarely need grain')
  ) AS v(code, nutrient, basis, min_value, max_value, unit, notes) ON v.code = s.code
ON CONFLICT (set_id, nutrient, basis) DO NOTHING;

-- composition keys used by the horse ration: dm_pct, de_mcal_kg_dm, cp_pct_dm, ca_pct_dm, p_pct_dm, is_forage
INSERT INTO nutrition_ingredients (code, label, label_key, kind, models, dry_matter_pct, composition, source, licence, status) VALUES
  ('feed_grass_hay',   'Grass hay (dry grass)',    'nutrition.foods.feed_grass_hay',   'forage',      '{equine_dm,ruminant_dm}', 88, '{"dm_pct":88,"de_mcal_kg_dm":2.0,"nel_mcal_kg_dm":1.05,"cp_pct_dm":8,"ca_pct_dm":0.45,"p_pct_dm":0.22,"ndf_pct_dm":65,"is_forage":1}', 'Typical values, feed composition literature', 'typical values', 'owner_approved'),
  ('feed_green_grass', 'Green grass (doob / hariyali)', 'nutrition.foods.feed_green_grass', 'forage', '{equine_dm,ruminant_dm}', 25, '{"dm_pct":25,"de_mcal_kg_dm":2.2,"nel_mcal_kg_dm":1.20,"cp_pct_dm":10,"ca_pct_dm":0.50,"p_pct_dm":0.28,"ndf_pct_dm":60,"is_forage":1}', 'Typical values, feed composition literature', 'typical values', 'owner_approved'),
  ('feed_lucerne_hay', 'Lucerne (alfalfa) hay',    'nutrition.foods.feed_lucerne_hay', 'forage',      '{equine_dm,ruminant_dm}', 90, '{"dm_pct":90,"de_mcal_kg_dm":2.3,"nel_mcal_kg_dm":1.30,"cp_pct_dm":18,"ca_pct_dm":1.40,"p_pct_dm":0.25,"ndf_pct_dm":45,"is_forage":1}', 'Typical values, feed composition literature', 'typical values', 'owner_approved'),
  ('feed_oats',        'Oats (whole or crushed)',  'nutrition.foods.feed_oats',        'concentrate', '{equine_dm,ruminant_dm}', 89, '{"dm_pct":89,"de_mcal_kg_dm":3.2,"nel_mcal_kg_dm":1.75,"cp_pct_dm":12.5,"ca_pct_dm":0.09,"p_pct_dm":0.38,"ndf_pct_dm":30,"is_forage":0}', 'Typical values, feed composition literature', 'typical values', 'owner_approved'),
  ('feed_horse_gram',  'Horse gram (kulthi), soaked or boiled', 'nutrition.foods.feed_horse_gram', 'concentrate', '{equine_dm}', 90, '{"dm_pct":90,"de_mcal_kg_dm":3.3,"cp_pct_dm":24,"ca_pct_dm":0.30,"p_pct_dm":0.40,"is_forage":0}', 'Typical values, Indian feed composition literature', 'typical values', 'owner_approved'),
  ('feed_bengal_gram', 'Bengal gram (chana), crushed', 'nutrition.foods.feed_bengal_gram', 'concentrate', '{equine_dm}', 90, '{"dm_pct":90,"de_mcal_kg_dm":3.5,"cp_pct_dm":21,"ca_pct_dm":0.20,"p_pct_dm":0.35,"is_forage":0}', 'Typical values, Indian feed composition literature', 'typical values', 'owner_approved')
ON CONFLICT (code) DO NOTHING;

-- Feeds a horse can share with cattle: add the horse energy value and list them for horses too.
UPDATE nutrition_ingredients i
   SET composition = i.composition || jsonb_build_object('de_mcal_kg_dm', v.de),
       models = CASE WHEN 'equine_dm' = ANY(i.models) THEN i.models ELSE i.models || ARRAY['equine_dm'] END,
       updated_at = NOW()
  FROM (VALUES ('feed_berseem', 2.4), ('feed_wheat_bran', 3.0), ('feed_maize_grain', 3.85), ('feed_mineral_mixture', 0.0))
       AS v(code, de)
 WHERE i.code = v.code AND NOT (i.composition ? 'de_mcal_kg_dm');

INSERT INTO nutrition_unsafe_foods (code, species_code, label, label_key, match_terms, severity, source, status) VALUES
  ('ionophore', 'Horse',  'Cattle or poultry feed with monensin / lasalocid', 'nutrition.unsafe.ionophore', '{monensin,lasalocid,salinomycin,ionophore,rumensin,poultry feed,cattle feed}', 'danger', 'Merck Veterinary Manual - ionophore toxicosis in horses', 'owner_approved'),
  ('urea',      'Horse',  'Urea or feed with urea',  'nutrition.unsafe.urea',      '{urea,umms,urea molasses}', 'danger', 'Merck Veterinary Manual - non-protein nitrogen', 'owner_approved'),
  ('ionophore', 'Donkey', 'Cattle or poultry feed with monensin / lasalocid', 'nutrition.unsafe.ionophore', '{monensin,lasalocid,salinomycin,ionophore,rumensin,poultry feed,cattle feed}', 'danger', 'Merck Veterinary Manual - ionophore toxicosis in horses', 'owner_approved'),
  ('urea',      'Donkey', 'Urea or feed with urea',  'nutrition.unsafe.urea',      '{urea,umms,urea molasses}', 'danger', 'Merck Veterinary Manual - non-protein nitrogen', 'owner_approved')
ON CONFLICT (species_code, code) DO NOTHING;

-- Migration 061: animal nutrition - vet workflow (docs/NUTRITION_PLAN.md, Phase 3)
--
--   * A vet can turn a food plan or ration into a PRESCRIPTION (a therapeutic / prescribed diet). The prescription is
--     an ordinary row in `prescriptions` - the owner, the vet, print and (for network prescriptions) the pharmacy see
--     it where they already see prescriptions. The plan remembers which prescription it became, so it is not
--     prescribed twice and the panel can say "prescribed".
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

ALTER TABLE nutrition_plans ADD COLUMN IF NOT EXISTS prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_prescription ON nutrition_plans(prescription_id) WHERE prescription_id IS NOT NULL;
-- The vet's review queue reads "active plans still suggested"; keep it an index scan for large farms.
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_to_review ON nutrition_plans(animal_id) WHERE status = 'active' AND validation = 'suggested';

-- Migration 062: animal nutrition - alert outcomes (Phase 4) and the AI explanation switch
--
--   * nutrition_outcomes: what happened to every alert - the owner / vet said it was right ("seen"), said it was
--     NOT right (false alarm), or the rules closed it because the cause went away. These are the labels a later
--     prediction model would be trained and checked on (docs/NUTRITION_PLAN.md §5.2, "collected from day one"), and
--     today they give the admin each rule's hit rate. One row per alert closure; the alert's own params and the rule
--     version are copied so a row stays explainable after the alert changes.
--   * nutrition.ai_assist.enabled: plain-language "explain this plan" through the platform's AI provider (owner
--     decision 2026-11-22: allowed, animal facts only, numbers never from AI). Default on; it does nothing until an
--     AI key is configured, and an admin can switch it off.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

CREATE TABLE IF NOT EXISTS nutrition_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id UUID REFERENCES nutrition_risk_flags(id) ON DELETE SET NULL,
  animal_id UUID REFERENCES animals(id) ON DELETE CASCADE,
  group_id UUID REFERENCES animal_groups(id) ON DELETE CASCADE,
  flag_type VARCHAR(40) NOT NULL,
  severity VARCHAR(10),
  rule_version VARCHAR(20),
  outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('confirmed', 'false_alarm', 'resolved')),
  features JSONB NOT NULL DEFAULT '{}',
  labelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  labelled_role VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nutrition_outcomes_type ON nutrition_outcomes(flag_type, outcome);
CREATE INDEX IF NOT EXISTS idx_nutrition_outcomes_time ON nutrition_outcomes(created_at DESC);

INSERT INTO system_settings (key, value, category, description)
VALUES ('nutrition.ai_assist.enabled', 'true', 'nutrition',
        'Plain-language "explain this plan" in the user''s language through the AI provider (animal facts only; numbers come from the engine, never from AI). Needs GROQ_API_KEY or OPENAI_API_KEY.')
ON CONFLICT (key) DO NOTHING;

-- Migration 063: farm feed - ONE place to record it (owner rule 2026-11-23: no duplicate screens or double entry)
--
-- Before: feed given was recorded in Daily records (farm_daily_records, kg only, no stock or cost) AND in Feed
-- Inventory's "Log use" (feed_consumption_logs, stock and cost). Two screens, two tables, different numbers.
-- After:
--   * Daily records is the only place feed given is recorded. A feed entry names WHICH feed (the farm's stock item,
--     or none for home-grown fodder), is for one animal, one group or ALL the farm's animals, and on save takes the
--     feed out of stock and stores its cost at that day's price (FarmRecordService).
--   * Feed Inventory keeps what is in store and its price; "how many kg is one bag / bale / litre" lets a farmer
--     record in kg while stock is kept in bags.
--   * Every feed_consumption_logs row is MOVED into farm_daily_records (converted to kg where the unit allows, stock
--     not deducted again - those logs already deducted it), the counts are checked, and the old table is removed.
--   * The low-stock alert, feed reports, group FCR and rations all read the one table.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

-- ─── 1. The feed entry names its feed, its cost, and whether stock was taken out ───
ALTER TABLE farm_daily_records ADD COLUMN IF NOT EXISTS feed_id UUID REFERENCES feed_inventory(id) ON DELETE SET NULL;
ALTER TABLE farm_daily_records ADD COLUMN IF NOT EXISTS cost NUMERIC(12,2) CHECK (cost IS NULL OR cost >= 0);
-- Stock units taken out by this entry (in the feed's own unit), so an edit or delete puts back exactly that.
ALTER TABLE farm_daily_records ADD COLUMN IF NOT EXISTS stock_deducted NUMERIC(14,4) CHECK (stock_deducted IS NULL OR stock_deducted >= 0);
CREATE INDEX IF NOT EXISTS idx_farm_daily_records_feed ON farm_daily_records(feed_id, record_date DESC) WHERE feed_id IS NOT NULL;

-- ─── 2. "All my animals": a feed entry may be for the whole farm (no animal, no group) ───
ALTER TABLE farm_daily_records DROP CONSTRAINT IF EXISTS farm_daily_records_subject_ck;
DO $$ BEGIN
  ALTER TABLE farm_daily_records ADD CONSTRAINT farm_daily_records_subject_ck CHECK (
    ((animal_id IS NOT NULL) <> (group_id IS NOT NULL))
    OR (animal_id IS NULL AND group_id IS NULL AND record_type = 'feed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One entry per subject / type / day / session - and, for feed, per feed (green fodder AND concentrate the same day).
DROP INDEX IF EXISTS uq_farm_daily_records_slot;
CREATE UNIQUE INDEX IF NOT EXISTS uq_farm_daily_records_slot
  ON farm_daily_records ((COALESCE(animal_id, group_id, enterprise_id)), record_type, record_date, session,
                         (COALESCE(feed_id, '00000000-0000-0000-0000-000000000000'::uuid)));

-- ─── 3. Stock kept in bags / bales / litres: how many kg one of them is ───
ALTER TABLE feed_inventory ADD COLUMN IF NOT EXISTS kg_per_unit NUMERIC(10,3) CHECK (kg_per_unit IS NULL OR kg_per_unit > 0);
UPDATE feed_inventory SET kg_per_unit = CASE lower(unit) WHEN 'kg' THEN 1 WHEN 'g' THEN 0.001 WHEN 'ton' THEN 1000 WHEN 'lb' THEN 0.45359237 END
 WHERE kg_per_unit IS NULL AND lower(unit) IN ('kg', 'g', 'ton', 'lb');

-- ─── 4. Move every "Log use" row into Daily records, then remove the second table ───
DO $$
DECLARE
  moved_qty NUMERIC; source_qty NUMERIC;
BEGIN
  IF to_regclass('feed_consumption_logs') IS NULL THEN RETURN; END IF;

  -- Same subject / day / feed logged twice -> one entry with the sum (the one-entry-per-slot rule).
  INSERT INTO farm_daily_records (enterprise_id, animal_id, group_id, record_type, record_date, session, quantity, unit,
                                  feed_id, cost, stock_deducted, detail, notes, recorded_by, updated_by, created_at)
  SELECT l.enterprise_id,
         -- a log naming both an animal and a group belongs to the animal
         l.animal_id,
         CASE WHEN l.animal_id IS NULL THEN l.group_id END,
         'feed', l.consumption_date, 'day',
         SUM(CASE lower(COALESCE(l.unit, 'kg')) WHEN 'g' THEN l.quantity * 0.001 WHEN 'ton' THEN l.quantity * 1000
                  WHEN 'lb' THEN l.quantity * 0.45359237 WHEN 'kg' THEN l.quantity
                  ELSE l.quantity * COALESCE(fi.kg_per_unit, 1) END),
         CASE WHEN lower(COALESCE(MIN(l.unit), 'kg')) IN ('kg', 'g', 'ton', 'lb') OR MIN(fi.kg_per_unit) IS NOT NULL THEN 'kg' ELSE MIN(l.unit) END,
         l.feed_id, SUM(COALESCE(l.cost, 0)), SUM(l.quantity),
         jsonb_build_object('migratedFrom', 'feed_consumption_logs', 'logIds', jsonb_agg(l.id)),
         NULLIF(string_agg(NULLIF(l.notes, ''), ' / '), ''),
         MIN(l.recorded_by::text)::uuid, MIN(l.recorded_by::text)::uuid, MIN(l.created_at)
    FROM feed_consumption_logs l
    LEFT JOIN feed_inventory fi ON fi.id = l.feed_id
   GROUP BY l.enterprise_id, l.animal_id, CASE WHEN l.animal_id IS NULL THEN l.group_id END, l.consumption_date, l.feed_id
  ON CONFLICT ((COALESCE(animal_id, group_id, enterprise_id)), record_type, record_date, session,
               (COALESCE(feed_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  DO UPDATE SET quantity = COALESCE(farm_daily_records.quantity, 0) + EXCLUDED.quantity,
                cost = COALESCE(farm_daily_records.cost, 0) + EXCLUDED.cost,
                stock_deducted = COALESCE(farm_daily_records.stock_deducted, 0) + EXCLUDED.stock_deducted,
                detail = farm_daily_records.detail || EXCLUDED.detail,
                updated_at = NOW();

  -- Nothing may be lost: the stock units moved must equal the stock units logged.
  SELECT COALESCE(SUM(quantity), 0) INTO source_qty FROM feed_consumption_logs;
  SELECT COALESCE(SUM(stock_deducted), 0) INTO moved_qty FROM farm_daily_records WHERE detail ? 'logIds';
  IF moved_qty < source_qty THEN
    RAISE EXCEPTION 'feed_consumption_logs move incomplete: % of % stock units moved', moved_qty, source_qty;
  END IF;

  DROP TABLE feed_consumption_logs;
END $$;

-- ─── 5. The feed record asks WHICH feed: a "stock" field (the farm's stock items), instead of the unused picker ───
UPDATE master_record_types
   SET fields = '[{"key":"quantity","type":"number","required":true},{"key":"feedId","type":"stock"}]'::jsonb
 WHERE code = 'feed' AND fields::text NOT LIKE '%"stock"%';

-- Migration 064: animal nutrition - safety corrections from the domain review (docs/modules/nutrition-ledger.md SAFETY rows)
--
-- Owner decision 2026-11-23: do not wait for the vet - load corrected starting values now as 'owner_approved'; the vet
-- confirms later in Admin -> Nutrition data. Every value below is data with its source; the engine holds the method.
--   NUT-190  goat / sheep energy was an ME figure used as NEL (~50-60% too high) -> NEL; own goat, sheep, camel, yak sets;
--            deer, llama, alpaca have no checked data -> guidance only.
--   NUT-057  growing young stock get a GROWING set (maintenance + gain allowance, higher protein); the age a ration may
--            start (weaning) and adult age are data; first lactation needs +20% maintenance.
--   NUT-198  mineral mixture gets a fixed daily allowance.
--   NUT-191  sheep: cattle mineral mixture / cattle feed carry copper -> unsafe; a low-copper mineral for sheep & goats.
--   NUT-202  unsafe-food lists for farm species and every pet bird; local-language match words.
--   NUT-201  groundnut cake: aflatoxin caution.
--   NUT-192  shrimp rates corrected, freshwater prawn (scampi) its own table, expected survival per size band.
--   NUT-193  a batch's age at placement (pullets at 18 weeks are not day-old chicks).
--   NUT-204  horses: lactating mare and late-pregnancy allowances; rations start at 24 months.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

-- ─── Bases the new rows need (057 and 060 re-add this CHECK with the same full list: a fresh install runs init.sql
--     and then every migration) ───
ALTER TABLE nutrition_requirements DROP CONSTRAINT IF EXISTS nutrition_requirements_basis_check;
DO $$ BEGIN
  ALTER TABLE nutrition_requirements ADD CONSTRAINT nutrition_requirements_basis_check
    CHECK (basis IN ('per_1000kcal', 'per_kg_dm', 'percent_dm', 'per_day', 'per_kg_bw075', 'percent_bw', 'fraction', 'percent_milk', 'per_kg_bw',
                     'per_kg_gain', 'age_months'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── NUT-190: NEL, not ME, for the general small-ruminant sets ───
UPDATE nutrition_requirements q SET min_value = 0.063, notes = 'NEL (NRC 2007 small ruminants: ME ~0.101 x 0.62); was an ME figure'
  FROM nutrition_requirement_sets s
 WHERE q.set_id = s.id AND s.code IN ('ruminant_small_lactating', 'ruminant_small_dry') AND q.nutrient = 'nel_maintenance' AND q.min_value = 0.10;

-- Exotic ruminants with no checked data: safe foods, weight and condition only (until a vet loads data for them).
UPDATE master_species SET nutrition_model = 'guidance_only' WHERE code IN ('Deer', 'Llama', 'Alpaca') AND nutrition_model = 'ruminant_dm';

INSERT INTO nutrition_requirement_sets (code, nutrition_model, species_code, life_stage, title, source, licence, status) VALUES
  ('ruminant_goat_lactating',   'ruminant_dm', 'Goat',    'lactating', 'Goats - in milk (starting values)',    'NRC 2007 small ruminants (energy as NEL); common field targets', 'cited reference', 'owner_approved'),
  ('ruminant_goat_dry',         'ruminant_dm', 'Goat',    'dry',       'Goats - dry / not in milk (starting values)', 'NRC 2007 small ruminants (energy as NEL); common field targets', 'cited reference', 'owner_approved'),
  ('ruminant_goat_growing',     'ruminant_dm', 'Goat',    'growing',   'Goats - growing kids (starting values)', 'NRC 2007 small ruminants; growth allowance per kg gain', 'cited reference', 'owner_approved'),
  ('ruminant_sheep_lactating',  'ruminant_dm', 'Sheep',   'lactating', 'Sheep - in milk (starting values)',   'NRC 2007 small ruminants (energy as NEL); sheep milk composition', 'cited reference', 'owner_approved'),
  ('ruminant_sheep_dry',        'ruminant_dm', 'Sheep',   'dry',       'Sheep - dry / not in milk (starting values)', 'NRC 2007 small ruminants (energy as NEL)', 'cited reference', 'owner_approved'),
  ('ruminant_sheep_growing',    'ruminant_dm', 'Sheep',   'growing',   'Sheep - growing lambs (starting values)', 'NRC 2007 small ruminants; growth allowance per kg gain', 'cited reference', 'owner_approved'),
  ('ruminant_camel_lactating',  'ruminant_dm', 'Camel',   'lactating', 'Camels - in milk (starting values)',  'Camel feeding literature (NRCC Bikaner field targets); energy as NEL', 'cited reference', 'owner_approved'),
  ('ruminant_camel_dry',        'ruminant_dm', 'Camel',   'dry',       'Camels - dry / working (starting values)', 'Camel feeding literature (NRCC Bikaner field targets); energy as NEL', 'cited reference', 'owner_approved'),
  ('ruminant_camel_growing',    'ruminant_dm', 'Camel',   'growing',   'Camels - growing calves (starting values)', 'Camel feeding literature; growth allowance per kg gain', 'cited reference', 'owner_approved'),
  ('ruminant_cattle_growing',   'ruminant_dm', 'Cattle',  'growing',   'Cattle - growing calves and heifers (starting values)', 'NRC 2001 heifer targets; growth allowance per kg gain', 'cited reference', 'owner_approved'),
  ('ruminant_buffalo_growing',  'ruminant_dm', 'Buffalo', 'growing',   'Buffalo - growing calves and heifers (starting values)', 'NRC 2001 heifer targets applied to buffalo; growth allowance per kg gain', 'cited reference', 'owner_approved'),
  ('ruminant_small_growing',    'ruminant_dm', NULL,      'growing',   'Small ruminants - growing (starting values)', 'NRC 2007 small ruminants; growth allowance per kg gain', 'cited reference', 'owner_approved'),
  ('ruminant_yak_lactating',    'ruminant_dm', 'Yak',     'lactating', 'Yak - in milk (cattle starting values)', 'Cattle values (NRC 2001) applied to yak until yak data are loaded', 'cited reference', 'owner_approved'),
  ('ruminant_yak_dry',          'ruminant_dm', 'Yak',     'dry',       'Yak - dry (cattle starting values)', 'Cattle values (NRC 2001) applied to yak until yak data are loaded', 'cited reference', 'owner_approved'),
  ('ruminant_yak_growing',      'ruminant_dm', 'Yak',     'growing',   'Yak - growing (cattle starting values)', 'Cattle values applied to yak until yak data are loaded', 'cited reference', 'owner_approved')
ON CONFLICT (code) DO NOTHING;

INSERT INTO nutrition_requirements (set_id, nutrient, basis, min_value, max_value, unit, notes)
SELECT s.id, v.nutrient, v.basis, v.min_value, v.max_value, v.unit, v.notes
  FROM nutrition_requirement_sets s
  JOIN (VALUES
    -- goats
    ('ruminant_goat_lactating', 'nel_maintenance', 'per_kg_bw075', 0.063, NULL, 'Mcal', 'NEL'),
    ('ruminant_goat_lactating', 'late_pregnancy',  'fraction',     0.30, NULL, 'x maintenance', NULL),
    ('ruminant_goat_lactating', 'dmi',             'percent_bw',   3.0,  5.0,  '%', NULL),
    ('ruminant_goat_lactating', 'cp',              'percent_dm',   14,   NULL, '%', NULL),
    ('ruminant_goat_lactating', 'ca',              'percent_dm',   0.6,  NULL, '%', NULL),
    ('ruminant_goat_lactating', 'p',               'percent_dm',   0.35, NULL, '%', NULL),
    ('ruminant_goat_lactating', 'ndf',             'percent_dm',   30,   NULL, '%', NULL),
    ('ruminant_goat_lactating', 'forage',          'percent_dm',   50,   NULL, '%', NULL),
    ('ruminant_goat_lactating', 'milk_fat',        'percent_milk', 4.5,  NULL, '%', NULL),
    ('ruminant_goat_lactating', 'milk_protein',    'percent_milk', 3.4,  NULL, '%', NULL),
    ('ruminant_goat_lactating', 'milk_lactose',    'percent_milk', 4.4,  NULL, '%', NULL),
    ('ruminant_goat_dry',       'nel_maintenance', 'per_kg_bw075', 0.063, NULL, 'Mcal', 'NEL'),
    ('ruminant_goat_dry',       'late_pregnancy',  'fraction',     0.30, NULL, 'x maintenance', NULL),
    ('ruminant_goat_dry',       'dmi',             'percent_bw',   2.5,  3.5,  '%', NULL),
    ('ruminant_goat_dry',       'cp',              'percent_dm',   10,   NULL, '%', NULL),
    ('ruminant_goat_dry',       'ca',              'percent_dm',   0.4,  NULL, '%', NULL),
    ('ruminant_goat_dry',       'p',               'percent_dm',   0.25, NULL, '%', NULL),
    ('ruminant_goat_dry',       'ndf',             'percent_dm',   35,   NULL, '%', NULL),
    ('ruminant_goat_dry',       'forage',          'percent_dm',   60,   NULL, '%', NULL),
    ('ruminant_goat_growing',   'nel_maintenance', 'per_kg_bw075', 0.063, NULL, 'Mcal', 'NEL'),
    ('ruminant_goat_growing',   'dmi',             'percent_bw',   3.0,  4.5,  '%', NULL),
    ('ruminant_goat_growing',   'cp',              'percent_dm',   15,   NULL, '%', NULL),
    ('ruminant_goat_growing',   'ca',              'percent_dm',   0.6,  NULL, '%', NULL),
    ('ruminant_goat_growing',   'p',               'percent_dm',   0.35, NULL, '%', NULL),
    ('ruminant_goat_growing',   'ndf',             'percent_dm',   30,   NULL, '%', NULL),
    ('ruminant_goat_growing',   'forage',          'percent_dm',   50,   NULL, '%', NULL),
    ('ruminant_goat_growing',   'target_adg',      'per_day',      0.08, NULL, 'kg', 'target daily gain'),
    ('ruminant_goat_growing',   'nel_per_kg_gain', 'per_kg_gain',  2.5,  NULL, 'Mcal', 'energy per kg gained'),
    ('ruminant_goat_growing',   'wean_months',     'age_months',   3,    NULL, 'months', 'no ration before weaning'),
    ('ruminant_goat_growing',   'adult_months',    'age_months',   12,   NULL, 'months', 'growing until this age'),
    -- sheep
    ('ruminant_sheep_lactating','nel_maintenance', 'per_kg_bw075', 0.056, NULL, 'Mcal', 'NEL'),
    ('ruminant_sheep_lactating','late_pregnancy',  'fraction',     0.30, NULL, 'x maintenance', NULL),
    ('ruminant_sheep_lactating','dmi',             'percent_bw',   2.5,  4.0,  '%', NULL),
    ('ruminant_sheep_lactating','cp',              'percent_dm',   14,   NULL, '%', NULL),
    ('ruminant_sheep_lactating','ca',              'percent_dm',   0.5,  NULL, '%', NULL),
    ('ruminant_sheep_lactating','p',               'percent_dm',   0.3,  NULL, '%', NULL),
    ('ruminant_sheep_lactating','ndf',             'percent_dm',   30,   NULL, '%', NULL),
    ('ruminant_sheep_lactating','forage',          'percent_dm',   50,   NULL, '%', NULL),
    ('ruminant_sheep_lactating','milk_fat',        'percent_milk', 6.5,  NULL, '%', 'sheep milk'),
    ('ruminant_sheep_lactating','milk_protein',    'percent_milk', 5.5,  NULL, '%', NULL),
    ('ruminant_sheep_lactating','milk_lactose',    'percent_milk', 4.8,  NULL, '%', NULL),
    ('ruminant_sheep_dry',      'nel_maintenance', 'per_kg_bw075', 0.056, NULL, 'Mcal', 'NEL'),
    ('ruminant_sheep_dry',      'late_pregnancy',  'fraction',     0.30, NULL, 'x maintenance', NULL),
    ('ruminant_sheep_dry',      'dmi',             'percent_bw',   1.8,  3.0,  '%', NULL),
    ('ruminant_sheep_dry',      'cp',              'percent_dm',   9,    NULL, '%', NULL),
    ('ruminant_sheep_dry',      'ca',              'percent_dm',   0.35, NULL, '%', NULL),
    ('ruminant_sheep_dry',      'p',               'percent_dm',   0.22, NULL, '%', NULL),
    ('ruminant_sheep_dry',      'ndf',             'percent_dm',   35,   NULL, '%', NULL),
    ('ruminant_sheep_dry',      'forage',          'percent_dm',   60,   NULL, '%', NULL),
    ('ruminant_sheep_growing',  'nel_maintenance', 'per_kg_bw075', 0.056, NULL, 'Mcal', 'NEL'),
    ('ruminant_sheep_growing',  'dmi',             'percent_bw',   3.0,  4.5,  '%', NULL),
    ('ruminant_sheep_growing',  'cp',              'percent_dm',   15,   NULL, '%', NULL),
    ('ruminant_sheep_growing',  'ca',              'percent_dm',   0.5,  NULL, '%', NULL),
    ('ruminant_sheep_growing',  'p',               'percent_dm',   0.3,  NULL, '%', NULL),
    ('ruminant_sheep_growing',  'ndf',             'percent_dm',   30,   NULL, '%', NULL),
    ('ruminant_sheep_growing',  'forage',          'percent_dm',   50,   NULL, '%', NULL),
    ('ruminant_sheep_growing',  'target_adg',      'per_day',      0.10, NULL, 'kg', 'target daily gain'),
    ('ruminant_sheep_growing',  'nel_per_kg_gain', 'per_kg_gain',  2.5,  NULL, 'Mcal', NULL),
    ('ruminant_sheep_growing',  'wean_months',     'age_months',   3,    NULL, 'months', NULL),
    ('ruminant_sheep_growing',  'adult_months',    'age_months',   12,   NULL, 'months', NULL),
    -- camels
    ('ruminant_camel_lactating','nel_maintenance', 'per_kg_bw075', 0.047, NULL, 'Mcal', 'NEL'),
    ('ruminant_camel_lactating','late_pregnancy',  'fraction',     0.25, NULL, 'x maintenance', NULL),
    ('ruminant_camel_lactating','dmi',             'percent_bw',   1.8,  2.8,  '%', 'camels eat less per kg than cattle'),
    ('ruminant_camel_lactating','cp',              'percent_dm',   12,   NULL, '%', NULL),
    ('ruminant_camel_lactating','ca',              'percent_dm',   0.5,  NULL, '%', NULL),
    ('ruminant_camel_lactating','p',               'percent_dm',   0.3,  NULL, '%', NULL),
    ('ruminant_camel_lactating','ndf',             'percent_dm',   35,   NULL, '%', NULL),
    ('ruminant_camel_lactating','forage',          'percent_dm',   60,   NULL, '%', NULL),
    ('ruminant_camel_lactating','milk_fat',        'percent_milk', 3.5,  NULL, '%', 'camel milk'),
    ('ruminant_camel_lactating','milk_protein',    'percent_milk', 3.0,  NULL, '%', NULL),
    ('ruminant_camel_lactating','milk_lactose',    'percent_milk', 4.5,  NULL, '%', NULL),
    ('ruminant_camel_dry',      'nel_maintenance', 'per_kg_bw075', 0.047, NULL, 'Mcal', 'NEL'),
    ('ruminant_camel_dry',      'late_pregnancy',  'fraction',     0.25, NULL, 'x maintenance', NULL),
    ('ruminant_camel_dry',      'dmi',             'percent_bw',   1.5,  2.5,  '%', NULL),
    ('ruminant_camel_dry',      'cp',              'percent_dm',   9,    NULL, '%', NULL),
    ('ruminant_camel_dry',      'ca',              'percent_dm',   0.35, NULL, '%', NULL),
    ('ruminant_camel_dry',      'p',               'percent_dm',   0.22, NULL, '%', NULL),
    ('ruminant_camel_dry',      'ndf',             'percent_dm',   40,   NULL, '%', NULL),
    ('ruminant_camel_dry',      'forage',          'percent_dm',   70,   NULL, '%', NULL),
    ('ruminant_camel_growing',  'nel_maintenance', 'per_kg_bw075', 0.047, NULL, 'Mcal', 'NEL'),
    ('ruminant_camel_growing',  'dmi',             'percent_bw',   1.8,  2.8,  '%', NULL),
    ('ruminant_camel_growing',  'cp',              'percent_dm',   13,   NULL, '%', NULL),
    ('ruminant_camel_growing',  'ca',              'percent_dm',   0.5,  NULL, '%', NULL),
    ('ruminant_camel_growing',  'p',               'percent_dm',   0.3,  NULL, '%', NULL),
    ('ruminant_camel_growing',  'ndf',             'percent_dm',   35,   NULL, '%', NULL),
    ('ruminant_camel_growing',  'forage',          'percent_dm',   60,   NULL, '%', NULL),
    ('ruminant_camel_growing',  'target_adg',      'per_day',      0.3,  NULL, 'kg', NULL),
    ('ruminant_camel_growing',  'nel_per_kg_gain', 'per_kg_gain',  3.0,  NULL, 'Mcal', NULL),
    ('ruminant_camel_growing',  'wean_months',     'age_months',   9,    NULL, 'months', NULL),
    ('ruminant_camel_growing',  'adult_months',    'age_months',   48,   NULL, 'months', NULL),
    -- cattle, buffalo, general small - growing
    ('ruminant_cattle_growing', 'nel_maintenance', 'per_kg_bw075', 0.08, NULL, 'Mcal', 'NRC 2001'),
    ('ruminant_cattle_growing', 'dmi',             'percent_bw',   2.2,  2.8,  '%', NULL),
    ('ruminant_cattle_growing', 'cp',              'percent_dm',   15,   NULL, '%', NULL),
    ('ruminant_cattle_growing', 'ca',              'percent_dm',   0.55, NULL, '%', NULL),
    ('ruminant_cattle_growing', 'p',               'percent_dm',   0.35, NULL, '%', NULL),
    ('ruminant_cattle_growing', 'ndf',             'percent_dm',   30,   NULL, '%', NULL),
    ('ruminant_cattle_growing', 'forage',          'percent_dm',   50,   NULL, '%', NULL),
    ('ruminant_cattle_growing', 'target_adg',      'per_day',      0.6,  NULL, 'kg', 'heifer target'),
    ('ruminant_cattle_growing', 'nel_per_kg_gain', 'per_kg_gain',  3.0,  NULL, 'Mcal', NULL),
    ('ruminant_cattle_growing', 'wean_months',     'age_months',   3,    NULL, 'months', 'calves on milk + starter before this'),
    ('ruminant_cattle_growing', 'adult_months',    'age_months',   24,   NULL, 'months', 'first calving age'),
    ('ruminant_buffalo_growing','nel_maintenance', 'per_kg_bw075', 0.08, NULL, 'Mcal', 'NRC 2001'),
    ('ruminant_buffalo_growing','dmi',             'percent_bw',   2.2,  2.8,  '%', NULL),
    ('ruminant_buffalo_growing','cp',              'percent_dm',   15,   NULL, '%', NULL),
    ('ruminant_buffalo_growing','ca',              'percent_dm',   0.55, NULL, '%', NULL),
    ('ruminant_buffalo_growing','p',               'percent_dm',   0.35, NULL, '%', NULL),
    ('ruminant_buffalo_growing','ndf',             'percent_dm',   30,   NULL, '%', NULL),
    ('ruminant_buffalo_growing','forage',          'percent_dm',   50,   NULL, '%', NULL),
    ('ruminant_buffalo_growing','target_adg',      'per_day',      0.5,  NULL, 'kg', NULL),
    ('ruminant_buffalo_growing','nel_per_kg_gain', 'per_kg_gain',  3.0,  NULL, 'Mcal', NULL),
    ('ruminant_buffalo_growing','wean_months',     'age_months',   3,    NULL, 'months', NULL),
    ('ruminant_buffalo_growing','adult_months',    'age_months',   30,   NULL, 'months', NULL),
    ('ruminant_small_growing',  'nel_maintenance', 'per_kg_bw075', 0.063, NULL, 'Mcal', 'NEL'),
    ('ruminant_small_growing',  'dmi',             'percent_bw',   3.0,  4.5,  '%', NULL),
    ('ruminant_small_growing',  'cp',              'percent_dm',   15,   NULL, '%', NULL),
    ('ruminant_small_growing',  'ca',              'percent_dm',   0.55, NULL, '%', NULL),
    ('ruminant_small_growing',  'p',               'percent_dm',   0.32, NULL, '%', NULL),
    ('ruminant_small_growing',  'ndf',             'percent_dm',   30,   NULL, '%', NULL),
    ('ruminant_small_growing',  'forage',          'percent_dm',   50,   NULL, '%', NULL),
    ('ruminant_small_growing',  'target_adg',      'per_day',      0.08, NULL, 'kg', NULL),
    ('ruminant_small_growing',  'nel_per_kg_gain', 'per_kg_gain',  2.5,  NULL, 'Mcal', NULL),
    ('ruminant_small_growing',  'wean_months',     'age_months',   3,    NULL, 'months', NULL),
    ('ruminant_small_growing',  'adult_months',    'age_months',   12,   NULL, 'months', NULL)
  ) AS v(code, nutrient, basis, min_value, max_value, unit, notes) ON v.code = s.code
ON CONFLICT (set_id, nutrient, basis) DO NOTHING;

-- Yak: the cattle rows, per stage (copied, so the vet can change yak alone later).
INSERT INTO nutrition_requirements (set_id, nutrient, basis, min_value, max_value, unit, notes)
SELECT y.id, q.nutrient, q.basis, q.min_value, q.max_value, q.unit, 'copied from cattle'
  FROM nutrition_requirement_sets y
  JOIN nutrition_requirement_sets c ON c.code = replace(y.code, 'ruminant_yak_', 'ruminant_cattle_')
  JOIN nutrition_requirements q ON q.set_id = c.id
 WHERE y.code IN ('ruminant_yak_lactating', 'ruminant_yak_dry', 'ruminant_yak_growing')
ON CONFLICT (set_id, nutrient, basis) DO NOTHING;

-- Every ruminant set: mineral mixture fixed allowance (g/day); every in-milk set: first lactation +20% maintenance.
INSERT INTO nutrition_requirements (set_id, nutrient, basis, min_value, max_value, unit, notes)
SELECT s.id, 'mineral_allowance', 'per_day',
       CASE WHEN s.species_code IN ('Cattle', 'Buffalo', 'Yak', 'Camel') THEN 50 ELSE 10 END, NULL, 'g', 'mineral mixture fed every day'
  FROM nutrition_requirement_sets s WHERE s.nutrition_model = 'ruminant_dm'
ON CONFLICT (set_id, nutrient, basis) DO NOTHING;
INSERT INTO nutrition_requirements (set_id, nutrient, basis, min_value, max_value, unit, notes)
SELECT s.id, 'first_lactation', 'fraction', 0.20, NULL, 'x maintenance', 'still growing in the first lactation'
  FROM nutrition_requirement_sets s WHERE s.nutrition_model = 'ruminant_dm' AND s.life_stage = 'lactating'
ON CONFLICT (set_id, nutrient, basis) DO NOTHING;

-- ─── NUT-204: horses - mares in milk, late pregnancy; no adult ration before 24 months ───
INSERT INTO nutrition_requirements (set_id, nutrient, basis, min_value, max_value, unit, notes)
SELECT s.id, v.nutrient, v.basis, v.min_value, NULL, v.unit, v.notes
  FROM nutrition_requirement_sets s
  JOIN (VALUES
    ('work_lactating', 'fraction',   1.8, 'x maintenance', 'NRC 2007: mare in early lactation'),
    ('late_pregnancy', 'fraction',   0.25, 'x maintenance', 'last 3 months of pregnancy'),
    ('adult_months',   'age_months', 24,  'months', 'growing horses need a vet-made ration')
  ) AS v(nutrient, basis, min_value, unit, notes) ON true
 WHERE s.nutrition_model = 'equine_dm'
ON CONFLICT (set_id, nutrient, basis) DO NOTHING;

-- ─── NUT-191 / NUT-198: mineral for sheep and goats (low copper); the cattle mineral says so in its name ───
UPDATE nutrition_ingredients SET label = 'Mineral mixture (cattle, buffalo)', updated_at = NOW()
 WHERE code = 'feed_mineral_mixture' AND label = 'Mineral mixture';
INSERT INTO nutrition_ingredients (code, label, label_key, kind, models, dry_matter_pct, composition, source, licence, status) VALUES
  ('feed_mineral_mixture_small', 'Mineral mixture (sheep and goats, low copper)', 'nutrition.foods.feed_mineral_mixture_small', 'mineral', '{ruminant_dm}', 98,
   '{"dm_pct":98,"nel_mcal_kg_dm":0,"cp_pct_dm":0,"ca_pct_dm":18,"p_pct_dm":9,"ndf_pct_dm":0,"is_forage":0}', 'Typical values; sheep need a copper-free or low-copper mixture - use the bag label', 'typical values', 'owner_approved')
ON CONFLICT (code) DO NOTHING;

-- ─── NUT-191 / NUT-201 / NUT-202: what must not be fed, per species ───
INSERT INTO nutrition_unsafe_foods (code, species_code, label, label_key, match_terms, severity, source, status)
SELECT v.code, ms.code, v.label, 'nutrition.unsafe.' || regexp_replace(v.code, '_(bird|cat)$', ''), v.terms::text[], v.severity, v.source, 'owner_approved'
  FROM master_species ms
  JOIN (VALUES
    -- sheep: copper
    ('copper_cattle_mix', '{Sheep}', 'Cattle mineral mixture or cattle feed (copper)', '{cattle,"copper sulphate","poultry litter","buffalo mineral"}', 'danger', 'Merck Veterinary Manual - chronic copper poisoning in sheep'),
    -- grazing ruminants
    ('lantana',      '{Cattle,Buffalo,Goat,Sheep,Camel,Yak}', 'Lantana leaves', '{lantana,"raimuniya","ghaneri"}', 'danger', 'Plant toxicity - lantana hepatotoxicity in ruminants'),
    ('parthenium',   '{Cattle,Buffalo,Goat,Sheep,Yak}', 'Parthenium (congress grass)', '{parthenium,"congress grass","gajar ghas"}', 'danger', 'Plant toxicity - parthenium'),
    ('young_sorghum','{Cattle,Buffalo,Goat,Sheep,Yak}', 'Young or drought-stressed sorghum shoots (cyanide)', '{"young sorghum","sorghum shoots","jowar shoots","immature jowar"}', 'danger', 'Merck Veterinary Manual - cyanide poisoning'),
    ('plastic',      '{Cattle,Buffalo,Goat,Sheep,Camel,Yak}', 'Plastic bags, waste', '{plastic,polythene,"garbage"}', 'danger', 'Foreign-body disease in cattle'),
    ('mouldy_feed',  '{Cattle,Buffalo,Goat,Sheep,Camel,Yak,Horse,Donkey,Pig,Chicken,Duck,Turkey,Quail}', 'Mouldy or spoiled feed (aflatoxin)', '{mouldy,moldy,fungus,spoiled,rotten}', 'danger', 'Aflatoxicosis - mouldy feed'),
    ('groundnut_aflatoxin', '{Cattle,Buffalo,Goat,Sheep,Camel,Yak,Pig,Chicken,Duck,Turkey,Quail}', 'Groundnut cake - check it is dry and not mouldy (aflatoxin)', '{"groundnut cake","peanut cake","moongphali khal"}', 'caution', 'Aflatoxin risk in stored groundnut cake'),
    ('urea_free',    '{Cattle,Buffalo,Goat,Sheep}', 'Urea fed loose or in excess', '{urea}', 'caution', 'Non-protein nitrogen - urea toxicity'),
    -- pigs
    ('salt_pig',     '{Pig}', 'Salty food waste (salt poisoning without water)', '{salt,namkeen,"salted"}', 'danger', 'Merck Veterinary Manual - salt poisoning in pigs'),
    ('swill_raw',    '{Pig}', 'Uncooked kitchen or meat waste (swill)', '{swill,"raw meat","meat waste","hotel waste"}', 'danger', 'African swine fever / FMD spread through uncooked swill'),
    -- poultry
    ('avocado_bird', '{Chicken,Duck,Turkey,Quail,Parrot,Budgerigar,Cockatiel,Lovebird,Finch,Canary,Mynah,Pigeon,Bird}', 'Avocado', '{avocado,"butter fruit"}', 'danger', 'ASPCA - avocado (persin) toxicity in birds'),
    ('chocolate_bird','{Budgerigar,Cockatiel,Lovebird,Finch,Canary,Mynah,Pigeon,Bird}', 'Chocolate and cocoa', '{chocolate,cocoa}', 'danger', 'ASPCA Animal Poison Control'),
    ('caffeine_bird','{Budgerigar,Cockatiel,Lovebird,Finch,Canary,Mynah,Pigeon,Bird}', 'Coffee, tea and caffeine', '{coffee,caffeine,tea}', 'danger', 'ASPCA Animal Poison Control'),
    ('alcohol_bird', '{Parrot,Budgerigar,Cockatiel,Lovebird,Finch,Canary,Mynah,Pigeon,Bird}', 'Alcohol', '{alcohol,beer,wine,whisky,rum}', 'danger', 'ASPCA Animal Poison Control'),
    ('onion_bird',   '{Parrot,Budgerigar,Cockatiel,Lovebird,Finch,Canary,Mynah,Pigeon,Bird}', 'Onion and garlic', '{onion,garlic,pyaz,lahsun}', 'danger', 'ASPCA Animal Poison Control'),
    ('salt_bird',    '{Budgerigar,Cockatiel,Lovebird,Finch,Canary,Mynah,Pigeon,Bird}', 'Salty snacks', '{salt,chips,namkeen}', 'caution', 'ASPCA Animal Poison Control'),
    -- cats
    ('cooked_bones_cat', '{Cat}', 'Cooked bones', '{"cooked bone","cooked bones"}', 'caution', 'ASPCA Animal Poison Control - people foods to avoid')
  ) AS v(code, species, label, terms, severity, source) ON ms.code = ANY(v.species::text[])
ON CONFLICT (species_code, code) DO NOTHING;

-- Local-language words for the commonest dangers, so a food typed in Hindi / Kannada / Malayalam / Tamil / Telugu is caught.
UPDATE nutrition_unsafe_foods SET match_terms = match_terms || v.extra::text[], updated_at = NOW()
  FROM (VALUES
    ('chocolate', '{चॉकलेट,ಚಾಕೊಲೇಟ್,ചോക്ലേറ്റ്,சாக்லேட்,చాక్లెట్}'),
    ('onion',     '{प्याज,लहसुन,ಈರುಳ್ಳಿ,ಬೆಳ್ಳುಳ್ಳಿ,ഉള്ളി,വെളുത്തുള്ളി,வெங்காயம்,பூண்டு,ఉల్లిపాయ,వెల్లుల్లి}'),
    ('grapes',    '{अंगूर,किशमिश,ದ್ರಾಕ್ಷಿ,മുന്തിരി,திராட்சை,ద్రాక్ష}')
  ) AS v(code, extra)
 WHERE nutrition_unsafe_foods.code = v.code AND NOT (nutrition_unsafe_foods.match_terms && v.extra::text[]);

-- ─── NUT-192: shrimp rates, scampi its own table, expected survival per size band ───
ALTER TABLE nutrition_feeding_curves ADD COLUMN IF NOT EXISTS survival_pct NUMERIC(5,2)
  CHECK (survival_pct IS NULL OR (survival_pct > 0 AND survival_pct <= 100));
UPDATE nutrition_feeding_curves SET rate_pct_biomass = v.rate, survival_pct = v.surv, updated_at = NOW()
  FROM (VALUES (0, 10.0, 95), (1, 5.0, 90), (5, 3.5, 85), (10, 2.8, 80), (15, 2.4, 75), (20, 2.0, 70)) AS v(wfrom, rate, surv)
 WHERE curve_key = 'shrimp_general' AND weight_from_g = v.wfrom;
UPDATE nutrition_feeding_curves SET species_codes = array_remove(species_codes, 'Freshwater Prawn'), updated_at = NOW()
 WHERE curve_key = 'shrimp_general';
UPDATE nutrition_feeding_curves SET survival_pct = v.surv, updated_at = NOW()
  FROM (VALUES (0, 90), (10, 85), (50, 85), (200, 80), (500, 80)) AS v(wfrom, surv)
 WHERE curve_key = 'fish_general' AND weight_from_g = v.wfrom AND survival_pct IS NULL;
INSERT INTO nutrition_feeding_curves
  (curve_key, title, nutrition_model, species_codes, group_types, basis, product, weight_from_g, weight_to_g, rate_pct_biomass, survival_pct, feeds_per_day, feed_type, source, status)
VALUES
  ('prawn_freshwater', 'Freshwater prawn (scampi)', 'aqua_biomass', '{Freshwater Prawn}', '{}', 'percent_biomass', 'meat', 0,  5,   6.0, 85, 3, 'starter',  'Typical Macrobrachium feeding table', 'owner_approved'),
  ('prawn_freshwater', 'Freshwater prawn (scampi)', 'aqua_biomass', '{Freshwater Prawn}', '{}', 'percent_biomass', 'meat', 5,  15,  4.0, 75, 2, 'grower',   'Typical Macrobrachium feeding table', 'owner_approved'),
  ('prawn_freshwater', 'Freshwater prawn (scampi)', 'aqua_biomass', '{Freshwater Prawn}', '{}', 'percent_biomass', 'meat', 15, 30,  3.0, 65, 2, 'grower',   'Typical Macrobrachium feeding table', 'owner_approved'),
  ('prawn_freshwater', 'Freshwater prawn (scampi)', 'aqua_biomass', '{Freshwater Prawn}', '{}', 'percent_biomass', 'meat', 30, 200, 2.5, 60, 2, 'finisher', 'Typical Macrobrachium feeding table', 'owner_approved')
ON CONFLICT DO NOTHING;
INSERT INTO nutrition_temperature_factors (curve_key, from_c, to_c, factor, source, status) VALUES
  ('prawn_freshwater', 0,  24, 0.6, 'Typical aquaculture practice: feed less in cold water', 'owner_approved'),
  ('prawn_freshwater', 24, 32, 1.0, 'Typical aquaculture practice', 'owner_approved'),
  ('prawn_freshwater', 32, 45, 0.7, 'Typical aquaculture practice: feed less in hot water', 'owner_approved')
ON CONFLICT DO NOTHING;

-- ─── NUT-193: a batch can arrive older than day 0 ───
ALTER TABLE group_cycles ADD COLUMN IF NOT EXISTS age_at_placement_days INTEGER
  CHECK (age_at_placement_days IS NULL OR (age_at_placement_days >= 0 AND age_at_placement_days <= 3650));
UPDATE master_record_types
   SET fields = '[{"key":"quantity","type":"number","required":true},{"key":"ageAtPlacementDays","type":"number"},{"key":"source","type":"text"}]'::jsonb
 WHERE code = 'placement' AND fields::text NOT LIKE '%ageAtPlacementDays%';

-- ─── NUT-195: a bitch or queen feeding a litter, or carrying one, is not fed maintenance ───
INSERT INTO nutrition_energy_factors (species_code, factor_key, factor, source, licence, status) VALUES
  ('Dog', 'gestation', 2.0, 'MSD Veterinary Manual / NRC: late pregnancy about 2x resting energy', 'cited reference', 'owner_approved'),
  ('Dog', 'lactation', 4.0, 'MSD Veterinary Manual / NRC: lactation 3-6x resting energy by litter size (typical litter)', 'cited reference', 'owner_approved'),
  ('Cat', 'gestation', 1.6, 'MSD Veterinary Manual / NRC: queen in pregnancy about 1.6x resting energy', 'cited reference', 'owner_approved'),
  ('Cat', 'lactation', 3.0, 'MSD Veterinary Manual / NRC: queen in lactation 2-6x resting energy (typical litter)', 'cited reference', 'owner_approved')
ON CONFLICT DO NOTHING;

-- ─── NUT-194: the sample weight is in GRAMS - the unit travels with the field so the entry shows it (kg typed as g is 1000x off) ───
UPDATE master_record_types
   SET fields = '[{"key":"sampleCount","type":"number"},{"key":"averageWeight","type":"number","required":true,"unit":"g"}]'::jsonb
 WHERE code = 'sample_weight' AND fields::text NOT LIKE '%"unit"%';

-- Migration 065: "neutered" can be UNANSWERED (docs/modules/nutrition-ledger.md NUT-195)
--
-- animals.is_neutered defaulted to false, so a pet whose owner never answered looked exactly like one that is NOT neutered,
-- and a dog's food was worked out as if intact (+12.5% energy) with nobody ever asked. NULL now means "not answered":
--   * the column has no default; the animal form asks yes / no and leaves it empty until answered;
--   * existing pets (dogs, cats and other companion species) with "no" are set back to unanswered ONCE, so the Nutrition
--     panel asks the owner a single question the next time it is opened. Their answer is then kept.
-- Farm animals keep what they have: nothing about their feeding depends on it.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

ALTER TABLE animals ALTER COLUMN is_neutered DROP DEFAULT;
UPDATE animals a SET is_neutered = NULL, updated_at = NOW()
  FROM master_species ms
 WHERE ms.code = a.species AND ms.nutrition_model IN ('companion_energy', 'guidance_only') AND a.is_neutered = false;

-- 066: the "whole farm" subject rule no longer names a record type (ledger NUT-220).
--
-- Migration 063 allowed an entry with no animal and no group ("All my animals") only when record_type = 'feed'. Which
-- record types may be for the whole farm is a master-data fact (a type with a `stock` field), decided by
-- FarmRecordService from master_record_types - the database only has to refuse the one thing that is always wrong:
-- an entry for BOTH an animal and a group.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

ALTER TABLE farm_daily_records DROP CONSTRAINT IF EXISTS farm_daily_records_subject_ck;
DO $$ BEGIN
  ALTER TABLE farm_daily_records ADD CONSTRAINT farm_daily_records_subject_ck CHECK (
    ((animal_id IS NOT NULL) <> (group_id IS NOT NULL))
    OR (animal_id IS NULL AND group_id IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 067: treatment and withdrawal - the prescription is the one place a treatment is written (ledger WDR-*).
--
-- The platform is a NEUTRAL tool: it owns and recommends no medicine and ships no medicine list. A vet types the label's
-- treatment days and milk / meat withdrawal days on each prescription line (stored in prescriptions.medications, JSON);
-- the platform only does the date arithmetic. "Under withdrawal" is COMPUTED from prescriptions (and the farmer's own
-- treatments below) - never copied into a second table. The old medical_records.withdrawal_until_* columns had no writer
-- and are left alone, unread.
--
--   * prescriptions.last_dose_on     - the farmer's correction ("stopped early" / "last dose on"); NULL = as prescribed.
--   * self_treatments                - a farmer who treated without a vet: same facts, entered once, same history.
--   * pharmacy_medications           - product kind (medicine / diet / supplement) and OPTIONAL label withdrawal days, for the
--                                      pharmacy's OWN stock items.
--   * pharmacy_line_matches          - a pharmacist links a prescription line's name to their own stock item once; the link
--                                      is remembered for that pharmacy.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS last_dose_on DATE;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS course_corrected_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS self_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  animal_id UUID REFERENCES animals(id) ON DELETE CASCADE,
  group_id UUID REFERENCES animal_groups(id) ON DELETE CASCADE,
  medicine_name VARCHAR(255) NOT NULL,
  treatment_days INT NOT NULL DEFAULT 1 CHECK (treatment_days >= 1 AND treatment_days <= 365),
  withdrawal_milk_days INT NOT NULL DEFAULT 0 CHECK (withdrawal_milk_days >= 0 AND withdrawal_milk_days <= 365),
  withdrawal_meat_days INT NOT NULL DEFAULT 0 CHECK (withdrawal_meat_days >= 0 AND withdrawal_meat_days <= 365),
  started_on DATE NOT NULL DEFAULT CURRENT_DATE,
  last_dose_on DATE,
  note TEXT,
  entered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT self_treatments_subject_ck CHECK ((animal_id IS NOT NULL) <> (group_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_self_treatments_farm ON self_treatments(enterprise_id, started_on DESC);
CREATE INDEX IF NOT EXISTS idx_self_treatments_animal ON self_treatments(animal_id) WHERE animal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_self_treatments_group ON self_treatments(group_id) WHERE group_id IS NOT NULL;

ALTER TABLE pharmacy_medications ADD COLUMN IF NOT EXISTS product_kind VARCHAR(20) NOT NULL DEFAULT 'medicine';
ALTER TABLE pharmacy_medications ADD COLUMN IF NOT EXISTS withdrawal_milk_days INT;
ALTER TABLE pharmacy_medications ADD COLUMN IF NOT EXISTS withdrawal_meat_days INT;
DO $$ BEGIN
  ALTER TABLE pharmacy_medications ADD CONSTRAINT pharmacy_medications_kind_ck CHECK (product_kind IN ('medicine', 'diet', 'supplement'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE pharmacy_medications ADD CONSTRAINT pharmacy_medications_withdrawal_ck CHECK (
    (withdrawal_milk_days IS NULL OR (withdrawal_milk_days >= 0 AND withdrawal_milk_days <= 365))
    AND (withdrawal_meat_days IS NULL OR (withdrawal_meat_days >= 0 AND withdrawal_meat_days <= 365)));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS pharmacy_line_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES hospital_pharmacies(id) ON DELETE CASCADE,
  line_key VARCHAR(255) NOT NULL,
  med_id UUID NOT NULL REFERENCES pharmacy_medications(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pharmacy_id, line_key)
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_line_matches_med ON pharmacy_line_matches(med_id);

-- 068: withdrawal follow-ups (ledger WDR-*): the vet's course start, a log of every "record anyway", and the dead columns removed.
--
--   * prescriptions.course_start_on  - the day the course starts when the vet says so ("start tomorrow", "started yesterday");
--                                      NULL = the prescription date, as before.
--   * withdrawal_overrides           - one row each time a person confirms a withdrawal warning ("record anyway"): who, when,
--                                      what was withheld, until when, because of which medicine, and what they were doing.
--                                      Kept when the animal or person is later removed (the links go NULL, the facts stay).
--   * DROPPED, nothing read or wrote them: medical_records.withdrawal_until_milk / _meat (+ their two indexes, migration 041)
--     and pharmacy_medications.withdrawal_days_milk / _meat (migration 041; migration 067 added the one pair in use,
--     withdrawal_milk_days / withdrawal_meat_days - two pairs for one fact is exactly the duplicate this removes).
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS course_start_on DATE;

CREATE TABLE IF NOT EXISTS withdrawal_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL,
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL,
  action VARCHAR(30) NOT NULL,
  withheld VARCHAR(10) NOT NULL CHECK (withheld IN ('milk', 'meat')),
  until_date DATE NOT NULL,
  medicine VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_withdrawal_overrides_animal ON withdrawal_overrides(animal_id, created_at DESC) WHERE animal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_withdrawal_overrides_group ON withdrawal_overrides(group_id, created_at DESC) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_withdrawal_overrides_farm ON withdrawal_overrides(enterprise_id, created_at DESC) WHERE enterprise_id IS NOT NULL;

DROP INDEX IF EXISTS idx_medical_records_withdrawal_group;
DROP INDEX IF EXISTS idx_medical_records_withdrawal_animal;
ALTER TABLE medical_records DROP COLUMN IF EXISTS withdrawal_until_milk;
ALTER TABLE medical_records DROP COLUMN IF EXISTS withdrawal_until_meat;
ALTER TABLE pharmacy_medications DROP COLUMN IF EXISTS withdrawal_days_milk;
ALTER TABLE pharmacy_medications DROP COLUMN IF EXISTS withdrawal_days_meat;
-- A third copy, added only by a seed script: the catalogue form showed it but no route ever saved it.
ALTER TABLE pharmacy_medications DROP COLUMN IF EXISTS withdrawal_period_days;

-- 069: a feeding-guide band can carry a caution (animal nutrition).
--
-- The pig guide's last band ("adult / sow", one flat figure for every pig over 220 days) is a maintenance figure for a dry adult.
-- A sow in pregnancy or nursing piglets, and a breeding boar, need much more and a different diet - shown as the normal table
-- value it would underfeed them. The band now carries a caution key the feed card shows in the farmer's language ("ask your vet
-- for a breeding-pig plan"). Data-driven: any other band can carry a caution the same way; no species is named in code.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

ALTER TABLE nutrition_feeding_curves ADD COLUMN IF NOT EXISTS caution_key VARCHAR(40);
UPDATE nutrition_feeding_curves SET caution_key = 'breeders_need_vet'
 WHERE curve_key = 'pig_general' AND feed_type = 'adult / sow' AND caution_key IS NULL;

-- 070: more feeding dangers in the safe-food guide (animal nutrition, domain review 2026-11-25).
--
-- Gaps found by the domain review: poultry had no chocolate or onion, pigs and poultry no urea (a non-ruminant cannot use it), horses
-- and ruminants no oleander (kaner), horses no lawn clippings, ruminants no cottonseed / mustard cake caution, dogs no raw dough and
-- dogs and cats no wild mushrooms. These rows are added as 'unvalidated' on purpose: they come from standard references (ASPCA, Merck
-- Veterinary Manual) but are NOT yet signed off by a vet, and the guide says so on screen (it already shows "unvalidated").
--
-- Idempotent (ON CONFLICT DO NOTHING), never hardcodes a schema name. Mirrored at the end of docker/init.sql.

INSERT INTO nutrition_unsafe_foods (code, species_code, label, label_key, match_terms, severity, source, status)
SELECT v.code, ms.code, v.label, 'nutrition.unsafe.' || regexp_replace(v.code, '_(bird|cat)$', ''), v.terms::text[], v.severity, v.source, 'unvalidated'
  FROM master_species ms
  JOIN (VALUES
    ('chocolate_bird', '{Chicken,Duck,Turkey,Quail}', 'Chocolate and cocoa', '{chocolate,cocoa}', 'danger', 'Merck Veterinary Manual - methylxanthine (theobromine) toxicosis in birds'),
    ('onion_bird', '{Chicken,Duck,Turkey,Quail}', 'Onion and garlic in large amounts', '{onion,garlic,pyaz,lahsun}', 'caution', 'Merck Veterinary Manual - Allium (onion) toxicosis'),
    ('urea_nonruminant', '{Pig,Chicken,Duck,Turkey,Quail}', 'Urea (pigs and poultry cannot use it)', '{urea}', 'danger', 'Non-protein nitrogen is not used by non-ruminants - urea toxicity'),
    ('oleander', '{Horse,Donkey,Cattle,Buffalo,Goat,Sheep,Camel}', 'Oleander (kaner) leaves or clippings', '{oleander,kaner,nerium}', 'danger', 'Merck Veterinary Manual - cardiac glycoside plant poisoning'),
    ('lawn_clippings', '{Horse,Donkey}', 'Lawn clippings and garden waste', '{"lawn clippings","grass clippings","garden waste"}', 'caution', 'Fermented clippings are linked to colic and laminitis in horses'),
    ('cottonseed_cake', '{Cattle,Buffalo,Goat,Sheep}', 'Cottonseed cake - not for young calves or breeding bulls (gossypol)', '{cottonseed,"cotton seed","kapas khal",binola}', 'caution', 'Merck Veterinary Manual - gossypol toxicity'),
    ('mustard_cake', '{Cattle,Buffalo,Goat,Sheep}', 'Mustard cake in large amounts (glucosinolates)', '{"mustard cake","sarson khal","mustard oil cake"}', 'caution', 'Glucosinolate-rich meals - limit the share in the ration'),
    ('dough_raw', '{Dog}', 'Raw bread or yeast dough', '{"raw dough","bread dough","yeast dough"}', 'danger', 'ASPCA Animal Poison Control - yeast dough expands in the stomach'),
    ('mushrooms_wild', '{Dog,Cat}', 'Wild mushrooms', '{"wild mushroom","wild mushrooms",toadstool}', 'danger', 'ASPCA Animal Poison Control - wild mushrooms')
  ) AS v(code, species, label, terms, severity, source) ON ms.code = ANY(v.species::text[])
ON CONFLICT (species_code, code) DO NOTHING;

-- 071: breeding-pig feeding figures, and every nutrition seed row set to go live (animal nutrition).
--
-- 1. Sows and boars. The pig guide had one flat figure for every pig over 220 days (2.8 kg), which under-feeds a nursing sow.
--    A group of group type 'sows' or 'boars' now picks its own curve (the feed query prefers a curve that names the group type).
--    Figures (kg of a corn-soybean diet at 3,300 kcal ME/kg, per head per day):
--      gestating sow  2.3 kg - NRC Nutrient Requirements of Swine (2012): 2.1-2.2 kg for the first 90 days of gestation, 2.5-2.6 kg
--                     for the last 25 days (MSD/Merck Veterinary Manual, "Feeding levels and practices in pigs"; PMC3113826 tables)
--      boar           2.7 kg - extension guidance: a mature boar on the sow gestation feed, about 6 lb/day
--    A nursing sow eats far more (NRC: 6.0-6.6 kg for a sow nursing 11-11.5 piglets over 21 days, more with a bigger litter), so the
--    sow band carries the caution 'sow_nursing_more' and the screen says so in the farmer's language. Editable by admin
--    (Nutrition data), like every other row.
--
-- 2. The owner decided (2026-11-25) that all seed data is approved to go live and is maintained from the Admin console.
--    Every row still 'unvalidated' becomes 'owner_approved' (NOT 'vet_validated'; the screens still say a vet has not signed it).
--    Doing it here, for every nutrition table with a status column, also stops migration 058 flipping later rows when migrations are replayed.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

INSERT INTO nutrition_feeding_curves
  (curve_key, title, nutrition_model, species_codes, group_types, basis, product, age_from_days, age_to_days, grams_per_head_day, feeds_per_day, feed_type, source, status, caution_key)
VALUES
  ('pig_sow', 'Sows', 'monogastric_spec', '{Pig}', '{sows}', 'per_head', 'meat', 0, 9000, 2300, 2, 'gestating sow',
   'NRC Nutrient Requirements of Swine 2012 (via MSD Veterinary Manual): gestating sow 2.1-2.6 kg/day', 'owner_approved', 'sow_nursing_more'),
  ('pig_boar', 'Boars', 'monogastric_spec', '{Pig}', '{boars}', 'per_head', 'meat', 0, 9000, 2700, 2, 'boar',
   'Extension guidance: mature boar fed the sow gestation diet, about 6 lb (2.7 kg) per day', 'owner_approved', NULL)
ON CONFLICT DO NOTHING;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
     WHERE c.table_schema = current_schema() AND c.column_name = 'status' AND c.table_name LIKE 'nutrition\_%'
  LOOP
    EXECUTE format('UPDATE %I SET status = ''owner_approved'' WHERE status = ''unvalidated''', t);
  END LOOP;
END $$;
