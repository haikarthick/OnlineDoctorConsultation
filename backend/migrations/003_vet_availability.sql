-- Migration 003: Enhanced Vet Availability System
-- Adds date overrides (day off / custom hours), blocked time slots, and hospital holidays

-- 1. Vet Date Overrides: mark specific dates as unavailable or set custom hours
CREATE TABLE IF NOT EXISTS vet_date_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veterinarian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  override_type VARCHAR(20) NOT NULL CHECK (override_type IN ('unavailable', 'custom_hours')),
  start_time VARCHAR(10),
  end_time VARCHAR(10),
  slot_duration INTEGER,
  reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(veterinarian_id, override_date)
);

-- 2. Vet Blocked Slots: block specific time ranges (one-time or recurring weekly)
CREATE TABLE IF NOT EXISTS vet_blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veterinarian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  block_date DATE,
  start_time VARCHAR(10) NOT NULL,
  end_time VARCHAR(10) NOT NULL,
  reason TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurring_day VARCHAR(10) CHECK (recurring_day IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Hospital Holidays: system-wide or hospital-specific holidays
CREATE TABLE IF NOT EXISTS hospital_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  name VARCHAR(255) NOT NULL,
  holiday_type VARCHAR(30) NOT NULL DEFAULT 'general'
    CHECK (holiday_type IN ('general', 'hospital_specific', 'emergency_closure')),
  is_full_day BOOLEAN DEFAULT true,
  start_time VARCHAR(10),
  end_time VARCHAR(10),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vet_date_overrides_vet ON vet_date_overrides(veterinarian_id);
CREATE INDEX IF NOT EXISTS idx_vet_date_overrides_date ON vet_date_overrides(override_date);
CREATE INDEX IF NOT EXISTS idx_vet_blocked_slots_vet ON vet_blocked_slots(veterinarian_id);
CREATE INDEX IF NOT EXISTS idx_vet_blocked_slots_date ON vet_blocked_slots(block_date);
CREATE INDEX IF NOT EXISTS idx_hospital_holidays_date ON hospital_holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_hospital_holidays_hospital ON hospital_holidays(hospital_id);

-- Triggers
DROP TRIGGER IF EXISTS update_vet_date_overrides_updated_at ON vet_date_overrides;
CREATE TRIGGER update_vet_date_overrides_updated_at BEFORE UPDATE ON vet_date_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vet_blocked_slots_updated_at ON vet_blocked_slots;
CREATE TRIGGER update_vet_blocked_slots_updated_at BEFORE UPDATE ON vet_blocked_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hospital_holidays_updated_at ON hospital_holidays;
CREATE TRIGGER update_hospital_holidays_updated_at BEFORE UPDATE ON hospital_holidays
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
