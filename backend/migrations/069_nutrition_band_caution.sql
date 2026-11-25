-- 069: a feeding-guide band can carry a caution (animal nutrition).
--
-- The pig guide's last band ("adult / sow", one flat figure for every pig over 220 days) is a maintenance figure for a dry adult.
-- A sow in pregnancy or nursing piglets, and a breeding boar, need much more and a different diet - shown as the normal table
-- value it would underfeed them. The band now carries a caution key the feed card shows in the farmer's language ("ask your vet
-- for a breeding-pig plan"). Data-driven: any other band can carry a caution the same way; no species is named in code.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

ALTER TABLE nutrition_feeding_curves ADD COLUMN IF NOT EXISTS caution_key VARCHAR(40);
UPDATE nutrition_feeding_curves SET caution_key = 'breeders_need_vet'
 WHERE curve_key = 'pig_general' AND feed_type = 'adult / sow' AND caution_key IS NULL;
