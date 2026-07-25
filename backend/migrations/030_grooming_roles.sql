-- Migration 030: add 'groomer' and 'support' system roles for the grooming module.
--
-- Expands the role CHECK on both users.role and user_roles.role (the additive multi-role
-- table). A user can hold 'groomer' additively alongside vet/farmer/etc. (union model).
-- 'groomer' self-registers ACTIVE (verification happens at the provider level, not the
-- account level); 'support' is admin-created. See docs/PET_WELLNESS_GROOMING_SPA_PLAN.md §5.2.
--
-- Drops the existing role check by introspection (robust to any constraint-name drift), so
-- it can never silently leave a second, stricter constraint that still rejects the new roles.

DO $$
DECLARE r record;
BEGIN
  -- users.role
  FOR r IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'users'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) ILIKE '%(role)%' LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', r.conname);
  END LOOP;
  ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('farmer','pet_owner','veterinarian','admin','corporate_admin',
                    'hospital_staff','pharmacist','groomer','support'));

  -- user_roles.role (additive multi-role table)
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    FOR r IN SELECT conname FROM pg_constraint
             WHERE conrelid = 'user_roles'::regclass AND contype = 'c'
               AND pg_get_constraintdef(oid) ILIKE '%(role)%' LOOP
      EXECUTE format('ALTER TABLE user_roles DROP CONSTRAINT %I', r.conname);
    END LOOP;
    ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
      CHECK (role IN ('pet_owner','farmer','veterinarian','admin','corporate_admin',
                      'hospital_staff','pharmacist','groomer','support'));
  END IF;
END $$;
