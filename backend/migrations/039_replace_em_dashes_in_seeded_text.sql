-- Replace em-dashes in seeded, user-visible text.
--
-- docker/init.sql was updated to stop using the em-dash, but its seed rows are
-- written with ON CONFLICT DO NOTHING, so an already-deployed database keeps the
-- original wording forever. This carries the same change to existing rows.
--
-- Only tax_codes.label is affected: it is the one seeded string in init.sql that
-- contains an em-dash outside a SQL comment, and it is displayed in the tax admin
-- screen and on generated invoices.
--
-- Written as a general replace rather than a hardcoded string so a row that an
-- operator has since edited is still cleaned rather than skipped.

UPDATE tax_codes
   SET label = replace(replace(label, ' — ', ' - '), '—', '-')
 WHERE label LIKE '%—%';

-- Same treatment for any operator-entered system settings text, which is
-- surfaced in the admin UI.
UPDATE system_settings
   SET description = replace(replace(description, ' — ', ' - '), '—', '-')
 WHERE description LIKE '%—%';

UPDATE system_settings
   SET value = replace(replace(value, ' — ', ' - '), '—', '-')
 WHERE value LIKE '%—%';
