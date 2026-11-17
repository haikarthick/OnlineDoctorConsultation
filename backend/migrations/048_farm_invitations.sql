-- Migration 048: farm team invitations (owner decision 2026-11-16)
--
-- The farm owner (and managers) decide who works on a farm. Nobody asks to join; there is no farm
-- directory. A person is INVITED by mobile number and/or email with a role, and the invitation has a
-- lifecycle: pending -> accepted | declined | expired | revoked, valid for 7 days.
--
--   * The link carries a random token; only its SHA-256 is stored, so a database leak cannot be
--     turned into working links.
--   * One pending invitation per farm and per mobile number / email (a second one is a "resend").
--   * Accepting adds the person to enterprise_members with the invited role (enterprise_members is
--     still the one source of truth for who is on a farm).
--   * A person invited by mobile number only has no email: users.email is NOT NULL, so such accounts
--     get a placeholder address in the reserved domain phone.waytovet.invalid, which is never mailed.
--
-- Idempotent, and never hardcodes a schema name.

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
