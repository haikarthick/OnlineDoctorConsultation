-- Migration 002: Staff & Workflow Management tables
-- Adds: staff_positions, appointment_queue, workflow_cases, workflow_transitions, referrals, inpatient_admissions

CREATE TABLE IF NOT EXISTS staff_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position VARCHAR(50) NOT NULL
    CHECK (position IN ('veterinarian','surgeon','nurse','technician','receptionist','intern','radiologist','lab_tech','anesthesiologist','pharmacist')),
  department VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  hired_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointment_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_vet_id UUID REFERENCES users(id) ON DELETE SET NULL,
  queue_number INTEGER NOT NULL DEFAULT 0,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('emergency','urgent','high','normal','low')),
  triage_level INTEGER DEFAULT 3 CHECK (triage_level BETWEEN 1 AND 5),
  status VARCHAR(30) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','in_triage','in_examination','in_treatment','in_observation','referred','discharged','no_show')),
  reason TEXT,
  triage_notes TEXT,
  triaged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  called_at TIMESTAMP,
  completed_at TIMESTAMP,
  estimated_wait_minutes INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workflow_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  queue_entry_id UUID REFERENCES appointment_queue(id) ON DELETE SET NULL,
  hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  current_stage VARCHAR(30) NOT NULL DEFAULT 'triage'
    CHECK (current_stage IN ('triage','examination','treatment','observation','discharge')),
  assigned_vet_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
  priority VARCHAR(20) DEFAULT 'normal'
    CHECK (priority IN ('emergency','urgent','high','normal','low')),
  chief_complaint TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,
  discharge_summary TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','referred','cancelled')),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workflow_transitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES workflow_cases(id) ON DELETE CASCADE,
  from_stage VARCHAR(30),
  to_stage VARCHAR(30) NOT NULL,
  transitioned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_position VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES workflow_cases(id) ON DELETE SET NULL,
  hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE CASCADE,
  from_vet_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_vet_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  specialty_needed VARCHAR(100),
  priority VARCHAR(20) DEFAULT 'normal'
    CHECK (priority IN ('emergency','urgent','high','normal','low')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','completed','cancelled')),
  clinical_notes TEXT,
  response_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inpatient_admissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE CASCADE,
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admitted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id UUID REFERENCES workflow_cases(id) ON DELETE SET NULL,
  admission_type VARCHAR(30) NOT NULL DEFAULT 'observation'
    CHECK (admission_type IN ('surgery_recovery','overnight_observation','boarding','icu','post_treatment','quarantine')),
  room_number VARCHAR(20),
  bed_number VARCHAR(20),
  status VARCHAR(30) NOT NULL DEFAULT 'admitted'
    CHECK (status IN ('admitted','in_treatment','recovering','ready_to_discharge','discharged','transferred','deceased')),
  admitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  estimated_discharge TIMESTAMP,
  discharged_at TIMESTAMP,
  discharged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  discharge_notes TEXT,
  care_instructions TEXT,
  medications JSONB DEFAULT '[]',
  vitals_log JSONB DEFAULT '[]',
  special_needs TEXT,
  daily_rate DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_staff_positions_hospital ON staff_positions(hospital_id);
CREATE INDEX IF NOT EXISTS idx_staff_positions_user ON staff_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_appointment_queue_hospital ON appointment_queue(hospital_id);
CREATE INDEX IF NOT EXISTS idx_appointment_queue_status ON appointment_queue(status);
CREATE INDEX IF NOT EXISTS idx_workflow_cases_hospital ON workflow_cases(hospital_id);
CREATE INDEX IF NOT EXISTS idx_workflow_cases_stage ON workflow_cases(current_stage);
CREATE INDEX IF NOT EXISTS idx_workflow_cases_status ON workflow_cases(status);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_case ON workflow_transitions(case_id);
CREATE INDEX IF NOT EXISTS idx_referrals_hospital ON referrals(hospital_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_inpatient_hospital ON inpatient_admissions(hospital_id);
CREATE INDEX IF NOT EXISTS idx_inpatient_status ON inpatient_admissions(status);
CREATE INDEX IF NOT EXISTS idx_inpatient_animal ON inpatient_admissions(animal_id);

-- Triggers
DROP TRIGGER IF EXISTS update_staff_positions_updated_at ON staff_positions;
CREATE TRIGGER update_staff_positions_updated_at BEFORE UPDATE ON staff_positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointment_queue_updated_at ON appointment_queue;
CREATE TRIGGER update_appointment_queue_updated_at BEFORE UPDATE ON appointment_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflow_cases_updated_at ON workflow_cases;
CREATE TRIGGER update_workflow_cases_updated_at BEFORE UPDATE ON workflow_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_referrals_updated_at ON referrals;
CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inpatient_admissions_updated_at ON inpatient_admissions;
CREATE TRIGGER update_inpatient_admissions_updated_at BEFORE UPDATE ON inpatient_admissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
