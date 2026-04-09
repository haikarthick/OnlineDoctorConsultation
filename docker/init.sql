-- ============================================================
-- VetCare - Complete Database Schema (PostgreSQL 18)
-- ============================================================
-- Covers ALL 22 tables used by the application services.
-- ============================================================

-- gen_random_uuid() is built into PostgreSQL 13+ — no extension required

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
  role VARCHAR(50) NOT NULL CHECK (role IN ('farmer', 'pet_owner', 'veterinarian', 'admin', 'corporate_admin')),
  phone VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  avatar_url VARCHAR(500),
  unique_id VARCHAR(20) UNIQUE,
  default_enterprise_id UUID,
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
  acquisition_date DATE,
  acquisition_source VARCHAR(200),
  production_type VARCHAR(50),
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
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  veterinarian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4b. ENTERPRISES & ANIMAL GROUPS (required before bookings FK)
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
  pet_owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  veterinarian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  veterinarian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pet_owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  medications JSONB DEFAULT '[]',
  instructions TEXT,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 10. MEDICAL RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_bookings_pet_owner_id ON bookings(pet_owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_veterinarian_id ON bookings(veterinarian_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_date ON bookings(scheduled_date);

CREATE INDEX IF NOT EXISTS idx_vet_schedules_vet_id ON vet_schedules(veterinarian_id);

CREATE INDEX IF NOT EXISTS idx_video_sessions_consultation ON video_sessions(consultation_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_room ON video_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_status ON video_sessions(status);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_prescriptions_consultation ON prescriptions(consultation_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_vet ON prescriptions(veterinarian_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_owner ON prescriptions(pet_owner_id);

CREATE INDEX IF NOT EXISTS idx_medical_records_user_id ON medical_records(user_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_animal_id ON medical_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_record_type ON medical_records(record_type);
CREATE INDEX IF NOT EXISTS idx_medical_records_record_number ON medical_records(record_number);
CREATE INDEX IF NOT EXISTS idx_medical_records_status ON medical_records(status);
CREATE INDEX IF NOT EXISTS idx_medical_records_veterinarian_id ON medical_records(veterinarian_id);
CREATE INDEX IF NOT EXISTS idx_vaccination_records_animal_id ON vaccination_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_vaccination_records_next_due ON vaccination_records(next_due_date);
CREATE INDEX IF NOT EXISTS idx_weight_history_animal_id ON weight_history(animal_id);
CREATE INDEX IF NOT EXISTS idx_allergy_records_animal_id ON allergy_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_animal_id ON lab_results(animal_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_status ON lab_results(status);
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
-- FIX: Update bookings status CHECK to include 'missed'
-- ============================================================
DO $$
BEGIN
  -- Drop old constraint and re-create with 'missed' status included
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_status_check'
  ) THEN
    ALTER TABLE bookings DROP CONSTRAINT bookings_status_check;
  END IF;
  ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rescheduled', 'completed', 'missed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
    CHECK (position IN ('veterinarian','surgeon','nurse','technician','receptionist','intern','radiologist','lab_tech','anesthesiologist','pharmacist')),
  department VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  hired_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 22. WORKFLOW TRANSITIONS (Stage change audit log)
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES workflow_cases(id) ON DELETE CASCADE,
  from_stage VARCHAR(30),
  to_stage VARCHAR(30) NOT NULL,
  transitioned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  from_vet_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_vet_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_case ON workflow_transitions(case_id);
CREATE INDEX IF NOT EXISTS idx_referrals_hospital ON referrals(hospital_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_inpatient_hospital ON inpatient_admissions(hospital_id);
CREATE INDEX IF NOT EXISTS idx_inpatient_status ON inpatient_admissions(status);
CREATE INDEX IF NOT EXISTS idx_inpatient_animal ON inpatient_admissions(animal_id);

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

-- 40b. HOSPITAL PATIENT INVITES (walk-in patients without platform accounts)
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
    'fitness_for_sale','animal_valuation'
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
  contact_phone VARCHAR(30),
  website VARCHAR(500),
  logo_url VARCHAR(500),
  id_prefix VARCHAR(10),
  dpo_name VARCHAR(200),
  dpo_email VARCHAR(255),
  data_residency_region VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 37. HOSPITAL NETWORK MEMBERS (corporate staff: corporate_admin, hospital_director, auditor)
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
  UNIQUE(network_id, user_id)
);

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

-- 39. ANIMAL CARE CONTEXTS (dual-ID patient linking: platform VC-ID + corporate patient ID)
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

DROP TRIGGER IF EXISTS update_hospital_networks_updated_at ON hospital_networks;
CREATE TRIGGER update_hospital_networks_updated_at BEFORE UPDATE ON hospital_networks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patient_consent_updated_at ON patient_data_consent;
CREATE TRIGGER update_patient_consent_updated_at BEFORE UPDATE ON patient_data_consent
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ============================================================
-- 42. ROLE CHANGE REQUESTS (user-initiated role upgrade/change with admin approval)
-- ============================================================
CREATE TABLE IF NOT EXISTS role_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_role VARCHAR(50) NOT NULL,
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
