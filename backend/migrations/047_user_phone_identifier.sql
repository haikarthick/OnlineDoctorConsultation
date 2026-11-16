-- Migration 047: the mobile number as a login identifier (owner decision 2026-11-16)
--
-- Phone is the primary identifier and email the second: a person signs in with either. Many farm
-- workers have no email. users.phone is free text typed by people ("98765 43210", "+91-98765-43210"),
-- so a normalised copy (E.164, "+919876543210") is kept in phone_e164 and that is what is matched and
-- made unique. The application keeps it in step (UserService); the same rules as
-- backend/src/services/sms/phone.ts normalizePhone().
--
--   * phone_e164      normalised number, unique when present (two accounts cannot share a number)
--   * phone_verified_at  set when the number was proven (a link sent to it was opened)
--
-- Existing rows are backfilled. Where two existing accounts share a number, the OLDEST keeps the
-- normalised form and the others are left without one (their typed phone is untouched), so nothing
-- is lost and the unique index can be created. Idempotent; never hardcodes a schema name.

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_e164 VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

WITH raw AS (
  SELECT id, created_at,
         regexp_replace(COALESCE(phone, ''), '\D', '', 'g') AS d,
         COALESCE(phone, '') ~ '^\s*(\+|00)' AS intl
    FROM users
   WHERE phone_e164 IS NULL AND COALESCE(phone, '') <> ''
), norm AS (
  SELECT id, created_at,
         CASE
           WHEN intl THEN
             CASE WHEN regexp_replace(d, '^00', '') ~ '^91' AND regexp_replace(d, '^00', '') !~ '^91[6-9][0-9]{9}$' THEN NULL
                  WHEN length(regexp_replace(d, '^00', '')) BETWEEN 8 AND 15 THEN '+' || regexp_replace(d, '^00', '')
                  ELSE NULL END
           WHEN d ~ '^91[6-9][0-9]{9}$' THEN '+' || d
           WHEN d ~ '^0[6-9][0-9]{9}$'  THEN '+91' || substr(d, 2)
           WHEN d ~ '^[6-9][0-9]{9}$'   THEN '+91' || d
           ELSE NULL
         END AS e164
    FROM raw
), ranked AS (
  SELECT id, e164, row_number() OVER (PARTITION BY e164 ORDER BY created_at, id) AS rn
    FROM norm WHERE e164 IS NOT NULL
)
UPDATE users u SET phone_e164 = r.e164
  FROM ranked r
 WHERE u.id = r.id AND r.rn = 1
   AND NOT EXISTS (SELECT 1 FROM users o WHERE o.phone_e164 = r.e164 AND o.id <> u.id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_phone_e164 ON users(phone_e164) WHERE phone_e164 IS NOT NULL;

-- Safety net: whatever writes a user (the app, the demo seed, an admin tool) leaves phone_e164 in step
-- with phone when the writer did not set it. Same rules as the backfill above and as normalizePhone().
CREATE OR REPLACE FUNCTION users_set_phone_e164() RETURNS trigger AS $$
DECLARE
  d TEXT;
  intl BOOLEAN;
  v TEXT;
BEGIN
  IF NEW.phone_e164 IS NOT NULL OR COALESCE(NEW.phone, '') = '' THEN
    RETURN NEW;
  END IF;
  d := regexp_replace(NEW.phone, '\D', '', 'g');
  intl := NEW.phone ~ '^\s*(\+|00)';
  v := CASE
    WHEN intl THEN
      CASE WHEN regexp_replace(d, '^00', '') ~ '^91' AND regexp_replace(d, '^00', '') !~ '^91[6-9][0-9]{9}$' THEN NULL
           WHEN length(regexp_replace(d, '^00', '')) BETWEEN 8 AND 15 THEN '+' || regexp_replace(d, '^00', '')
           ELSE NULL END
    WHEN d ~ '^91[6-9][0-9]{9}$' THEN '+' || d
    WHEN d ~ '^0[6-9][0-9]{9}$'  THEN '+91' || substr(d, 2)
    WHEN d ~ '^[6-9][0-9]{9}$'   THEN '+91' || d
    ELSE NULL
  END;
  IF v IS NOT NULL AND EXISTS (SELECT 1 FROM users o WHERE o.phone_e164 = v AND o.id <> NEW.id) THEN
    v := NULL;
  END IF;
  NEW.phone_e164 := v;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_set_phone_e164 ON users;
CREATE TRIGGER trg_users_set_phone_e164 BEFORE INSERT OR UPDATE OF phone ON users
  FOR EACH ROW EXECUTE FUNCTION users_set_phone_e164();

-- Rows that already exist (and the demo seed, if it ran before this migration): fill the blanks now.
UPDATE users SET phone = phone WHERE phone_e164 IS NULL AND COALESCE(phone, '') <> '';
