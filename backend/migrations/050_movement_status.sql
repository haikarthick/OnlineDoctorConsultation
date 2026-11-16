-- Movement approval status.
-- movement_records.status was only ever added by a seed script (utils/database/seed/phase3NetworkSubscriptions.ts), so a
-- database that was not seeded had no such column: approving or rejecting a movement failed with a bare server error and
-- the list could not show what had been decided. It belongs to the schema.
-- Movements that already exist were recorded before approval existed in this database; they are 'completed', not
-- 'pending' (waiting for somebody who may not even know about them). New ones start 'pending'.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'movement_records' AND column_name = 'status'
  ) THEN
    ALTER TABLE movement_records ADD COLUMN status VARCHAR(20);
    UPDATE movement_records SET status = 'completed';
    ALTER TABLE movement_records ALTER COLUMN status SET DEFAULT 'pending';
    ALTER TABLE movement_records ADD CONSTRAINT movement_records_status_check
      CHECK (status IN ('pending', 'approved', 'rejected', 'completed'));
  END IF;
END $$;
