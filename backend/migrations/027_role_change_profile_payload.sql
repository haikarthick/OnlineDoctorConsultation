-- Migration 027: capture role-specific profile details on a role-change request
--
-- Bug: a user who requested a role change to 'veterinarian' and was approved by an
-- admin ended up with users.role='veterinarian' but NO vet_profiles row. Find Doctor
-- (and availability search) INNER JOIN vet_profiles, so the approved vet was invisible
-- to patients, while User Management (LEFT JOIN) still listed them — the exact symptom
-- reported for drathiselvamphd@gmail.com (originally a farmer, role-changed to vet).
--
-- Root cause: PUT /admin/role-change-requests/:id/approve only ran `UPDATE users SET role`
-- and never provisioned the satellite vet_profiles row, and the request itself carried no
-- license/vet details for the admin to review — unlike normal vet registration, which
-- requires a license number and creates vet_profiles at signup.
--
-- Fix: role-change requests now carry a JSONB payload of the role-specific details
-- (license number, specializations, fee, experience, qualifications, clinic name for the
-- veterinarian role). On approval the API provisions vet_profiles from this payload in the
-- same transaction as the role update, so the admin verifies + approves in one shot and the
-- vet is immediately bookable. Column is nullable/defaulted so existing rows are unaffected.

ALTER TABLE role_change_requests
  ADD COLUMN IF NOT EXISTS profile_payload JSONB NOT NULL DEFAULT '{}'::jsonb;
