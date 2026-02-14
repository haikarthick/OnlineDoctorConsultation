-- ============================================================
-- VetCare - Complete Database Schema
-- ============================================================
-- Run this once on a fresh PostgreSQL database.
-- All optional tables are always created (feature flags
-- control the application layer, not the database).
-- ============================================================

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
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('farmer', 'pet_owner', 'veterinarian', 'admin')),
  phone VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  avatar_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. VET PROFILES (extended info for veterinarians)
-- ============================================================
CREATE TABLE IF NOT EXISTS vet_profiles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  license_number VARCHAR(100) NOT NULL,
  specialization VARCHAR(255),
  years_of_experience INTEGER DEFAULT 0,
  bio TEXT,
  clinic_name VARCHAR(255),
  clinic_address TEXT,
  consultation_fee DECIMAL(10,2) DEFAULT 0.00,
  is_verified BOOLEAN DEFAULT false,
  available_days VARCHAR(100) DEFAULT 'Mon,Tue,Wed,Thu,Fri',
  available_hours_start TIME DEFAULT '09:00',
  available_hours_end TIME DEFAULT '17:00',
  rating DECIMAL(3,2) DEFAULT 0.00,
  total_consultations INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. ANIMALS / PETS
-- ============================================================
CREATE TABLE IF NOT EXISTS animals (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  species VARCHAR(50) NOT NULL,
  breed VARCHAR(100),
  date_of_birth DATE,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'unknown')),
  weight DECIMAL(6,2),
  color VARCHAR(50),
  microchip_id VARCHAR(100),
  medical_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4. CONSULTATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS consultations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  veterinarian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  animal_type VARCHAR(100) NOT NULL,
  symptom_description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  consultation_type VARCHAR(30) DEFAULT 'video' CHECK (consultation_type IN ('video', 'chat', 'phone', 'in_person')),
  scheduled_at TIMESTAMP NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  diagnosis TEXT,
  prescription TEXT,
  follow_up_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 5. MEDICAL RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS medical_records (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  record_type VARCHAR(50) NOT NULL CHECK (record_type IN ('diagnosis', 'prescription', 'lab_report', 'vaccination', 'surgery', 'imaging', 'other')),
  title VARCHAR(255) NOT NULL DEFAULT 'Untitled Record',
  content TEXT NOT NULL,
  file_url VARCHAR(500),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 6. SESSIONS (refresh tokens)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token VARCHAR(500) NOT NULL,
  user_agent VARCHAR(500),
  ip_address VARCHAR(45),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 7. PAYMENTS (optional – gated by FEATURE_PAYMENTS)
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY,
  consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(30) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255),
  gateway VARCHAR(50) DEFAULT 'stripe',
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 8. NOTIFICATIONS (optional – gated by FEATURE_EMAIL_NOTIFICATIONS)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('appointment_reminder', 'consultation_update', 'payment_receipt', 'system', 'message')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  channel VARCHAR(20) DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'sms', 'push')),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 9. REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY,
  consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  veterinarian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 10. AUDIT LOG (optional – gated by FEATURE_AUDIT_LOGGING)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON medical_records
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
CREATE INDEX IF NOT EXISTS idx_vet_profiles_specialization ON vet_profiles(specialization);
CREATE INDEX IF NOT EXISTS idx_vet_profiles_is_verified ON vet_profiles(is_verified);

CREATE INDEX IF NOT EXISTS idx_animals_owner_id ON animals(owner_id);
CREATE INDEX IF NOT EXISTS idx_animals_species ON animals(species);

CREATE INDEX IF NOT EXISTS idx_consultations_user_id ON consultations(user_id);
CREATE INDEX IF NOT EXISTS idx_consultations_veterinarian_id ON consultations(veterinarian_id);
CREATE INDEX IF NOT EXISTS idx_consultations_animal_id ON consultations(animal_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
CREATE INDEX IF NOT EXISTS idx_consultations_scheduled_at ON consultations(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_medical_records_user_id ON medical_records(user_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_animal_id ON medical_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_consultation_id ON medical_records(consultation_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);

CREATE INDEX IF NOT EXISTS idx_payments_consultation_id ON payments(consultation_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

CREATE INDEX IF NOT EXISTS idx_reviews_consultation_id ON reviews(consultation_id);
CREATE INDEX IF NOT EXISTS idx_reviews_veterinarian_id ON reviews(veterinarian_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
