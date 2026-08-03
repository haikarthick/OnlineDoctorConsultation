-- Migration 032: repair the users.role / user_roles.role CHECK constraints.
--
-- Two independent defects left deployed environments unable to register a 'groomer', even
-- though migration 030 looked like it had applied cleanly:
--
--   1. database.ts's legacy startup self-heal DROPped and re-ADDed both constraints on EVERY
--      boot from its own inlined, pre-grooming 7-role list. It runs after the migration runner,
--      so 030's correct constraint was silently reverted on every restart. Registration then
--      failed with `users_role_check`. (Fixed in code: both blocks now build the list from the
--      single SYSTEM_ROLES constant.)
--
--   2. Migration 030 guarded its user_roles work with `to_regclass('public.user_roles')` - a
--      hardcoded schema. On the schema-scoped deployments (DB_SCHEMA=vetcare_dev / vetcare_demo)
--      that resolves to NULL, so user_roles.role was never widened at all. Nothing surfaced it
--      because nothing wrote 'groomer' to user_roles until GroomingProviderService.createProvider
--      started granting it.
--
-- This migration is the tracked, authoritative repair for both, and is schema-relative
-- throughout (bare identifiers resolve through the runner's search_path). Idempotent.

DO $$
DECLARE r record;
BEGIN
  -- users.role - drop by introspection so any name drift is handled
  FOR r IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'users'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) ILIKE '%(role)%' LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', r.conname);
  END LOOP;
  ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('farmer','pet_owner','veterinarian','admin','corporate_admin',
                    'hospital_staff','pharmacist','groomer','support'));

  -- user_roles.role - NOTE: schema-relative to_regclass, unlike 030's 'public.user_roles'
  IF to_regclass('user_roles') IS NOT NULL THEN
    FOR r IN SELECT conname FROM pg_constraint
             WHERE conrelid = 'user_roles'::regclass AND contype = 'c'
               AND pg_get_constraintdef(oid) ILIKE '%(role)%' LOOP
      EXECUTE format('ALTER TABLE user_roles DROP CONSTRAINT %I', r.conname);
    END LOOP;
    ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
      CHECK (role IN ('farmer','pet_owner','veterinarian','admin','corporate_admin',
                      'hospital_staff','pharmacist','groomer','support'));
  END IF;
END $$;
