-- Migration 028: backfill vet_profiles for users who are veterinarians but have no profile row
--
-- Before migration 027, an approved role-change into 'veterinarian' set users.role but never
-- created the satellite vet_profiles row. Those users are active vets yet invisible in Find
-- Doctor (which INNER JOINs vet_profiles). This backfills a minimal profile so they become
-- visible/bookable again. Reported case: drathiselvamphd@gmail.com (farmer -> vet via approved
-- role change).
--
-- Stance (fact-honest): we have NO license number for these historical rows, so we CANNOT
-- claim them verified. is_verified=false (no license on file yet), is_available=true (visible
-- and bookable). The vet can fill in their real license via their profile, after which an admin
-- can mark them verified. license_number is '' (column is NOT NULL but permits empty string).
--
-- Idempotent: only inserts where a row is genuinely missing; ON CONFLICT guards concurrent runs.

INSERT INTO vet_profiles (user_id, license_number, is_verified, is_available)
SELECT u.id, '', false, true
FROM users u
LEFT JOIN vet_profiles vp ON vp.user_id = u.id
WHERE u.role = 'veterinarian'
  AND vp.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
