-- A consultation can be about a whole group (a herd or flock booked as a 'herd_consultation'), not only one animal.
-- PrescriptionService already read consultations.group_id to find the subject of a prescription written from the
-- consultation room, but the column was never created, so that lookup failed (and was swallowed) and the prescription was
-- refused. Additive; existing rows keep NULL.
ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_consultations_group ON consultations(group_id) WHERE group_id IS NOT NULL;
