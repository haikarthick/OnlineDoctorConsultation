-- Migration 011: Privacy-first patient enrollment consent flow
-- Adds enrollment_status to animal_care_contexts and hospital_patient_invites table

ALTER TABLE animal_care_contexts
  ADD COLUMN IF NOT EXISTS enrollment_status VARCHAR(20) NOT NULL DEFAULT 'pending_consent',
  ADD COLUMN IF NOT EXISTS enrollment_requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS enrollment_responded_at TIMESTAMP;

-- Backfill: existing active enrollments stay active
UPDATE animal_care_contexts SET enrollment_status = 'active' WHERE is_active = true;

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
