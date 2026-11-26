-- The column's default ('observation') was not in its own CHECK list, so any insert that left the type out failed.
ALTER TABLE inpatient_admissions ALTER COLUMN admission_type SET DEFAULT 'overnight_observation';
