-- 066: the "whole farm" subject rule no longer names a record type (ledger NUT-220).
--
-- Migration 063 allowed an entry with no animal and no group ("All my animals") only when record_type = 'feed'. Which
-- record types may be for the whole farm is a master-data fact (a type with a `stock` field), decided by
-- FarmRecordService from master_record_types - the database only has to refuse the one thing that is always wrong:
-- an entry for BOTH an animal and a group.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

ALTER TABLE farm_daily_records DROP CONSTRAINT IF EXISTS farm_daily_records_subject_ck;
DO $$ BEGIN
  ALTER TABLE farm_daily_records ADD CONSTRAINT farm_daily_records_subject_ck CHECK (
    ((animal_id IS NOT NULL) <> (group_id IS NOT NULL))
    OR (animal_id IS NULL AND group_id IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
