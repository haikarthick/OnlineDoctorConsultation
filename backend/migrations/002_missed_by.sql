-- Migration: 002_missed_by.sql
-- Adds missed_by column to bookings table and a new system setting for
-- patient no-show reschedule limit.

-- ── Add missed_by column ─────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'missed_by'
  ) THEN
    ALTER TABLE bookings ADD COLUMN missed_by VARCHAR(20)
      CHECK (missed_by IN ('doctor', 'patient', 'both'));
  END IF;
END $$;

-- ── Add patientNoShowRescheduleLimit setting ─────────────────
INSERT INTO system_settings (id, key, value, category, description)
VALUES (
  uuid_generate_v4(),
  'booking.patientNoShowRescheduleLimit',
  '1',
  'booking',
  'Maximum times a patient can reschedule after a patient no-show (0 = unlimited)'
)
ON CONFLICT (key) DO NOTHING;
