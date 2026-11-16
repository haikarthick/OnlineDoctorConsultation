-- A farm shares a GROUP (herd / flock) with a hospital network for ONE production cycle.
-- Kept apart from animal_care_contexts / patient_data_consent (change-protected, animal-keyed) on purpose.
--  - group_share_codes: the owner's explicit consent, as a single-use code handed to the hospital (networks cannot browse
--    farms; the farm decides who gets a code, what it covers and for how long).
--  - group_care_contexts: the sharing that exists once a network redeems a code. It is bound to the cycle and ends when
--    that cycle closes (BatchManagementService.closeCycle) or the owner stops it. A new cycle needs a new code.
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
