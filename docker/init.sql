-- ============================================================
-- VetCare - Complete Database Schema (PostgreSQL 18)
-- ============================================================
-- Fresh-install schema covering every table used by the application
-- services (see backend/migrations/*.sql for the same schema built up
-- incrementally on already-deployed environments — keep both in sync when
-- adding new tables/columns, since a migration alone is invisible to a
-- brand new database that runs only this file).
-- ============================================================

-- gen_random_uuid() is built into PostgreSQL 13+ — no extension required

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
  role VARCHAR(50) NOT NULL CHECK (role IN ('farmer', 'pet_owner', 'veterinarian', 'admin', 'corporate_admin', 'hospital_staff', 'pharmacist')),
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
-- 1b. HOSPITAL NETWORKS (defined early — referenced by many tables below)
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
  is_neutered BOOLEAN DEFAULT false,
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
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
-- by the "46.2 bookings: payment lifecycle statuses" block — with the
-- FULL, current status list ('missed' included). Do not add another
-- ALTER TABLE ... ADD CONSTRAINT bookings_status_check block here: this
-- file runs as one atomic statement, so an earlier block using a
-- narrower status list than what real rows already contain (e.g. it's
-- missing 'payment_pending'/'payment_expired'/'referred') aborts the
-- ENTIRE init.sql run on every existing DB that has such rows — which
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
  hospital_role VARCHAR(50) NOT NULL DEFAULT 'doctor'
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
  seasonal_window VARCHAR(100),            -- e.g. "Pre-monsoon (May–June)"
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

-- vaccination_records — add protocol / schedule FKs
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
-- ENTERPRISE TABLES — Triggers & Indexes
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
-- HOSPITAL NETWORK TABLES (Phase 1 — Clinical Domain)
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

-- 41. CLINICAL DATA ACCESS LOG (immutable audit trail — append only, never delete)
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
  -- NOTE: No updated_at — this table is append-only, never update or delete rows
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
  invitee_name VARCHAR(200) NOT NULL,
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
-- made init.sql fail on any truly fresh database — rolling back the ENTIRE
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

-- ─── Marketplace engagement (Phase 3) — mirrors backend/migrations/016_marketplace_engagement.sql ───
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
-- 46. USER ROLES (secondary roles — additive, does not replace users.role)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('pet_owner','farmer','veterinarian','admin','corporate_admin','hospital_staff','pharmacist')),
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

-- Seed auction_enabled feature flag (disabled by default — legal review pending)
INSERT INTO marketplace_monetization_settings (setting_key, is_enabled, description, category)
VALUES ('auction_enabled', false, 'Enable or disable the auction feature platform-wide', 'feature')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- 46. PAYMENT MODULE (docs/PAYMENT_MODULE_PLAN.md — Phase P0)
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
-- (idx_payments_status already created earlier in this file — see the
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
  (gen_random_uuid(), '300490', 'Pharmacy — dispensed veterinary medicaments (HSN 3004)', 12, true)
ON CONFLICT (sac_code) DO NOTHING;

-- 46.10 invoices: immutable snapshots
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  invoice_type VARCHAR(20) NOT NULL CHECK (invoice_type IN ('consultation', 'commission', 'pharmacy')),
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
-- encrypted at rest (backend/src/utils/secretCrypto.ts) — never readable in
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
-- 007_tier3_features.sql, 008_tier4_features.sql — these 31 tables existed
-- only as migrations (applied to every live environment already) but were
-- never mirrored into this fresh-install schema, so a brand new DB would
-- 500 the moment any of these features were touched. marketplace_listings/
-- bids/orders/monetization_settings/plans/subscriptions/listing_boosts/
-- inquiries/transactions (9 of migration 008's 19 tables) already exist
-- above (§ marketplace) — not repeated here — but marketplace_listings was
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
CREATE TABLE IF NOT EXISTS feed_consumption_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id),
  feed_id UUID NOT NULL REFERENCES feed_inventory(id),
  group_id UUID REFERENCES animal_groups(id),
  location_id UUID REFERENCES locations(id),
  animal_id UUID REFERENCES animals(id),
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  consumption_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by UUID NOT NULL REFERENCES users(id),
  cost DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

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
-- above in the main animals CREATE TABLE — only birth_weight/health_score
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
CREATE INDEX IF NOT EXISTS idx_feed_log_enterprise ON feed_consumption_logs(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_feed_log_date ON feed_consumption_logs(consumption_date);
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
-- entire block — active Marketplace.tsx/MarketplaceService.ts code reads
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
-- Not from 006/007/008, but discovered missing during this same audit —
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
-- Backported from backend/migrations/022_master_data_tables.sql — admin-editable
-- reference data that replaces the hardcoded TypeScript arrays previously in
-- frontend/src/constants/speciesBreeds.ts and Marketplace.tsx's CATEGORY_KEYS/
-- condition options. Identity is matched by the `code`/`value` string columns —
-- animals.species, marketplace_listings.species/category/condition/animal_class stay
-- plain VARCHAR (not FKs), matching existing behavior exactly.

CREATE TABLE IF NOT EXISTS master_species (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  icon VARCHAR(10),
  category VARCHAR(50),
  has_ear_tag BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_protected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_breeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species_id UUID NOT NULL REFERENCES master_species(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
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
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Cattle'), 'Mixed Breed', 200, true),
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
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Buffalo'), 'Mixed', 100, true),
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
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Sheep'), 'Mixed Breed', 160, true),
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
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Kanniadu', 100, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Boer', 110, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Alpine', 120, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Saanen', 130, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Nubian', 140, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Angora', 150, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Mixed Breed', 160, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Goat'), 'Other', 170, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'Desi (Indigenous)', 10, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'Ghungroo', 20, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'Niang Megha', 30, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'Yorkshire (Large White)', 40, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'Landrace', 50, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'Duroc', 60, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'Hampshire', 70, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'Berkshire', 80, true),
  (gen_random_uuid(), (SELECT id FROM master_species WHERE code = 'Pig'), 'Mixed Breed', 90, true),
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

-- Marketplace categories (generated from CATEGORY_KEYS, frontend/src/pages/Marketplace.tsx — skips the blank '' "all" filter entry)
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
