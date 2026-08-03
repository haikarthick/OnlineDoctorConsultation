-- Migration: 009_hospital_networks.sql
-- Description: Enterprise Hospital Network feature - Phase 1 Foundation
--   Tables: hospital_networks, hospital_network_members, hospital_network_feature_flags,
--           animal_care_contexts, patient_data_consent, clinical_data_access_log
-- Architecture: Completely separate from farm enterprises table.
--   enterprises = farm domain only.  hospital_networks = clinical domain only.
-- Data isolation: Hospital records are private by default (opt-in).
-- Audit: clinical_data_access_log is append-only - never delete rows from it.

-- ── 36. HOSPITAL NETWORKS ──────────────────────────────────────
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

-- ── 37. HOSPITAL NETWORK MEMBERS ──────────────────────────────
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

-- ── 38. HOSPITAL NETWORK FEATURE FLAGS ────────────────────────
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

-- ── 39. ANIMAL CARE CONTEXTS ───────────────────────────────────
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
  UNIQUE(animal_id, network_id)
);

-- ── 40. PATIENT DATA CONSENT ───────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_data_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  granted_to_hospital_id UUID,
  granted_to_network_id UUID REFERENCES hospital_networks(id) ON DELETE CASCADE,
  consent_scope VARCHAR(50) NOT NULL DEFAULT 'basic_history'
    CHECK (consent_scope IN ('basic_history', 'full_history', 'emergency_only', 'custom')),
  allow_medical_records BOOLEAN DEFAULT true,
  allow_vaccination_records BOOLEAN DEFAULT true,
  allow_prescriptions BOOLEAN DEFAULT true,
  allow_lab_results BOOLEAN DEFAULT false,
  allow_genetic_data BOOLEAN DEFAULT false,
  include_hospital_records BOOLEAN DEFAULT false,
  allow_view BOOLEAN DEFAULT true,
  allow_create_notes BOOLEAN DEFAULT false,
  allow_prescribe BOOLEAN DEFAULT false,
  valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  revoked_at TIMESTAMP,
  revoked_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 41. CLINICAL DATA ACCESS LOG (append-only) ────────────────
CREATE TABLE IF NOT EXISTS clinical_data_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accessed_by UUID NOT NULL REFERENCES users(id),
  accessor_role VARCHAR(50) NOT NULL,
  accessor_network_id UUID REFERENCES hospital_networks(id),
  animal_id UUID REFERENCES animals(id),
  record_type VARCHAR(50) NOT NULL,
  record_id UUID,
  access_type VARCHAR(30) NOT NULL
    CHECK (access_type IN ('view', 'search', 'export', 'print', 'api_call', 'audit')),
  consent_id UUID REFERENCES patient_data_consent(id),
  ip_address INET,
  user_agent TEXT,
  access_granted BOOLEAN NOT NULL,
  denial_reason TEXT,
  accessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Extend users table for corporate roles ─────────────────────
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS network_id UUID REFERENCES hospital_networks(id) ON DELETE SET NULL;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS corporate_role VARCHAR(50);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'hospital network user columns: %', SQLERRM;
END $$;

-- ── Indexes ────────────────────────────────────────────────────
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

-- ── Triggers ──────────────────────────────────────────────────
DROP TRIGGER IF EXISTS update_hospital_networks_updated_at ON hospital_networks;
CREATE TRIGGER update_hospital_networks_updated_at BEFORE UPDATE ON hospital_networks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patient_consent_updated_at ON patient_data_consent;
CREATE TRIGGER update_patient_consent_updated_at BEFORE UPDATE ON patient_data_consent
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
