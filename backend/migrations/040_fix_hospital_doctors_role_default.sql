-- Migration 040: hospital_doctors.hospital_role had a DEFAULT its own CHECK rejects.
--
-- The column was declared:
--     hospital_role VARCHAR(50) NOT NULL DEFAULT 'doctor'
--       CHECK (hospital_role IN ('owner','medical_director','department_head',
--                                'consultant','resident','intern','staff','visiting'))
--
-- 'doctor' is not in that list. Any INSERT that omitted the column therefore failed with
-- hospital_doctors_hospital_role_check - the row was rejected by the very default the table
-- supplied for it.
--
-- Nothing is broken today only because every caller happens to name the column explicitly
-- (VetHospitalService.ts inserts 'owner' when creating a hospital, passes a parameter when
-- adding a doctor, and seed-demo-data.sql lists it). The first caller that relies on the
-- default would fail at runtime, in front of a user - and no static check could catch it,
-- because it takes an actual INSERT against a real database to see it. Found exactly that
-- way while validating an unrelated query (2026-08-04).
--
-- 'staff' is the corrected default: it is already what the application treats as the neutral
-- value (the add-doctor and invite-doctor forms in VetHospitalManage.tsx initialise
-- hospitalRole to 'staff', and the display paths fall back to `|| 'staff'`).
--
-- No data backfill is needed or possible: the CHECK has been in force since the table was
-- created, so no row can hold 'doctor'. The UPDATE below is therefore a no-op on every real
-- database and exists only so this migration is still correct if some environment acquired
-- the column before the constraint.

UPDATE hospital_doctors SET hospital_role = 'staff' WHERE hospital_role = 'doctor';

ALTER TABLE hospital_doctors ALTER COLUMN hospital_role SET DEFAULT 'staff';
