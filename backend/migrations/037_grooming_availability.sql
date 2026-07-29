-- Migration 037: grooming availability, working hours and bookable slots
--
-- Grooming had NO availability infrastructure whatsoever. Consultations have four cooperating
-- tables (vet_schedules, vet_date_overrides, vet_blocked_slots, hospital_holidays) feeding
-- ScheduleService.getAvailability(); grooming had none of them. createOrder() accepted any
-- scheduled_date + time_slot_start string with no validation at all, so a customer could book
-- 3am on a closed Sunday and two customers could book the same groomer at the same minute.
-- grooming_providers.operating_hours (JSONB) existed but was read by nothing.
--
-- Modelled on the consultation tables, with two deliberate differences that the doctor model
-- cannot express and a spa genuinely needs:
--
--   CAPACITY  — a doctor serves one patient at a time. A salon has several tables/stations, so
--               a slot is bookable while CONCURRENT orders < capacity, not merely "unbooked".
--   DURATION  — every consultation slot is one fixed slot_duration. Grooming services already
--               carry their own duration_minutes (nail trim 20, full groom 120), so occupancy
--               is an interval [start, start+duration) and start times are offered on a finer
--               slot_interval grid.
--
-- location_id is nullable throughout: a provider with no separate locations configures one
-- schedule for the whole business; a multi-branch provider configures one per location.

CREATE TABLE IF NOT EXISTS grooming_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES grooming_providers(id) ON DELETE CASCADE,
  location_id UUID REFERENCES grooming_locations(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time VARCHAR(5) NOT NULL,
  close_time VARCHAR(5) NOT NULL,
  -- How often a new appointment may START. Independent of how long one RUNS.
  slot_interval_minutes INT NOT NULL DEFAULT 30 CHECK (slot_interval_minutes BETWEEN 5 AND 480),
  -- How many appointments may overlap: tables, stations or groomers working in parallel.
  capacity INT NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- One row per provider/location/day. Two partial indexes rather than a plain UNIQUE constraint
-- because Postgres treats NULLs as distinct, which would silently allow unlimited duplicate
-- business-wide (location_id IS NULL) rows for the same weekday.
CREATE UNIQUE INDEX IF NOT EXISTS idx_grooming_schedules_provider_day_loc
  ON grooming_schedules (provider_id, location_id, day_of_week) WHERE location_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_grooming_schedules_provider_day_nolo
  ON grooming_schedules (provider_id, day_of_week) WHERE location_id IS NULL;

-- A specific date that differs from the weekly pattern: a closure, or one-off hours.
CREATE TABLE IF NOT EXISTS grooming_date_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES grooming_providers(id) ON DELETE CASCADE,
  location_id UUID REFERENCES grooming_locations(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  override_type VARCHAR(20) NOT NULL CHECK (override_type IN ('closed', 'custom_hours')),
  open_time VARCHAR(5),
  close_time VARCHAR(5),
  slot_interval_minutes INT CHECK (slot_interval_minutes BETWEEN 5 AND 480),
  capacity INT CHECK (capacity BETWEEN 1 AND 100),
  reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_grooming_overrides_date_loc
  ON grooming_date_overrides (provider_id, location_id, override_date) WHERE location_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_grooming_overrides_date_nolo
  ON grooming_date_overrides (provider_id, override_date) WHERE location_id IS NULL;

-- Sub-day unavailability: a lunch break (recurring) or a one-off appointment elsewhere.
CREATE TABLE IF NOT EXISTS grooming_blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES grooming_providers(id) ON DELETE CASCADE,
  location_id UUID REFERENCES grooming_locations(id) ON DELETE CASCADE,
  block_date DATE,
  start_time VARCHAR(5) NOT NULL,
  end_time VARCHAR(5) NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurring_day INT CHECK (recurring_day BETWEEN 0 AND 6),
  reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- A block is either a one-off on a date, or a weekly recurrence on a weekday. Never neither:
  -- a row with both NULL would be invisible to every lookup and silently block nothing.
  CONSTRAINT grooming_blocked_slots_when_check CHECK (
    (is_recurring = true AND recurring_day IS NOT NULL)
    OR (is_recurring = false AND block_date IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_grooming_blocked_provider_date
  ON grooming_blocked_slots (provider_id, block_date);
CREATE INDEX IF NOT EXISTS idx_grooming_blocked_provider_recurring
  ON grooming_blocked_slots (provider_id, recurring_day) WHERE is_recurring = true;

-- Occupancy lookups are always "this provider, this date, statuses that hold a slot".
CREATE INDEX IF NOT EXISTS idx_grooming_orders_provider_date
  ON grooming_orders (provider_id, scheduled_date);

-- Orders never recorded when they were expected to finish, so overlap could not be computed.
-- Backfilled from the service duration where the order has one.
ALTER TABLE grooming_orders ADD COLUMN IF NOT EXISTS duration_minutes INT;

UPDATE grooming_orders o
   SET duration_minutes = COALESCE(gs.duration_minutes, 60)
  FROM grooming_services gs
 WHERE gs.id = o.primary_service_id
   AND o.duration_minutes IS NULL;

-- Orders whose service row is gone still need a sane occupancy footprint.
UPDATE grooming_orders SET duration_minutes = 60 WHERE duration_minutes IS NULL;
