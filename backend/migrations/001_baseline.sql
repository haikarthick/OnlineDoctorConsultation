-- Migration: 001_baseline.sql
-- Created: Baseline migration — marks the existing schema as tracked.
-- The actual schema was created via docker/init.sql.
-- This migration is intentionally empty; it exists solely to establish
-- the migration tracking baseline so future migrations run correctly.

-- No-op: schema already exists from init.sql
SELECT 1;
