-- Migration: 004_vet_certificates.sql
-- Ensures enterprises and vet_certificates tables exist for databases that
-- were initialized before these tables were added to init.sql.
-- These run inside a transaction; errors will roll back safely.

-- Step 1: enterprises must exist before vet_certificates (FK dependency)
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

-- Step 2: vet_certificates with full schema matching init.sql
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
  issued_at TIMESTAMP,
  valid_until DATE,
  notes TEXT,
  revocation_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vet_certs_vet    ON vet_certificates(veterinarian_id);
CREATE INDEX IF NOT EXISTS idx_vet_certs_owner  ON vet_certificates(pet_owner_id);
CREATE INDEX IF NOT EXISTS idx_vet_certs_animal ON vet_certificates(animal_id);
CREATE INDEX IF NOT EXISTS idx_vet_certs_type   ON vet_certificates(certificate_type);
CREATE INDEX IF NOT EXISTS idx_vet_certs_status ON vet_certificates(status);
