-- ============================================================
-- VetCare - Complete Database Schema (PostgreSQL 18)
-- ============================================================
-- Covers ALL 22 tables used by the application services.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('farmer', 'pet_owner', 'veterinarian', 'admin')),
  phone VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  avatar_url VARCHAR(500),
  unique_id VARCHAR(20) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. VET PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS vet_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4. CONSULTATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS consultations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 5. BOOKINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  veterinarian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  time_slot_start VARCHAR(10) NOT NULL,
  time_slot_end VARCHAR(10) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rescheduled', 'completed')),
  booking_type VARCHAR(30) NOT NULL DEFAULT 'video_call'
    CHECK (booking_type IN ('video_call', 'in_person', 'phone', 'chat')),
  priority VARCHAR(20) DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'emergency')),
  reason_for_visit TEXT,
  symptoms TEXT,
  notes TEXT,
  cancellation_reason TEXT,
  rescheduled_from UUID,
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 6. VET SCHEDULES
-- ============================================================
CREATE TABLE IF NOT EXISTS vet_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  vaccine_name VARCHAR(255) NOT NULL,
  vaccine_type VARCHAR(100),
  date_administered DATE NOT NULL,
  next_due_date DATE,
  dosage VARCHAR(100),
  batch_number VARCHAR(100),
  manufacturer VARCHAR(255),
  administered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  certificate_number VARCHAR(100),
  reaction_notes TEXT,
  is_valid BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 10c. WEIGHT HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS weight_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  weight DECIMAL(8,2) NOT NULL,
  unit VARCHAR(10) DEFAULT 'kg',
  notes TEXT,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 10d. ALLERGY RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS allergy_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id UUID,
  record_type VARCHAR(50),
  action VARCHAR(50) NOT NULL,
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 10f. LAB RESULTS
-- ============================================================
CREATE TABLE IF NOT EXISTS lab_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 11. SESSIONS (refresh tokens)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  category VARCHAR(50) DEFAULT 'general',
  description TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- AUTO-UPDATE TRIGGERS
-- ============================================================
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vet_profiles_updated_at BEFORE UPDATE ON vet_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_animals_updated_at BEFORE UPDATE ON animals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consultations_updated_at BEFORE UPDATE ON consultations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vet_schedules_updated_at BEFORE UPDATE ON vet_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_video_sessions_updated_at BEFORE UPDATE ON video_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON medical_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vaccination_records_updated_at BEFORE UPDATE ON vaccination_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_allergy_records_updated_at BEFORE UPDATE ON allergy_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lab_results_updated_at BEFORE UPDATE ON lab_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
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
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

CREATE INDEX IF NOT EXISTS idx_reviews_consultation_id ON reviews(consultation_id);
CREATE INDEX IF NOT EXISTS idx_reviews_veterinarian_id ON reviews(veterinarian_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
