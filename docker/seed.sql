-- ============================================================
-- Seed Data for VetCare Platform
-- Run AFTER init.sql to populate initial demo data
-- ============================================================

-- ─── Admin User ──────────────────────────────────────────────
-- Password: Admin@123  (bcrypt hash)
INSERT INTO users (id, email, first_name, last_name, role, phone, password_hash, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'admin@vetcare.com', 'System', 'Admin', 'admin', '+1-555-0100',
  '$2a$10$FDap/eOYFgBCzs2HfWCZ2Or6s54BdHzr1N.RGsNhnx09o3PYWjzma',
  true
) ON CONFLICT (email) DO NOTHING;

-- ─── Veterinarian Users ─────────────────────────────────────
-- Password: Doctor@123
INSERT INTO users (id, email, first_name, last_name, role, phone, password_hash, is_active)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'dr.smith@vetcare.com', 'James', 'Smith', 'veterinarian', '+1-555-0201',
   '$2a$10$XnbUdsXyHocdULEt.uTDpe4MzWEwbCKyXa2EULaFL72xXSwUpwbM.', true),
  ('b0000000-0000-0000-0000-000000000002', 'dr.johnson@vetcare.com', 'Sarah', 'Johnson', 'veterinarian', '+1-555-0202',
   '$2a$10$XnbUdsXyHocdULEt.uTDpe4MzWEwbCKyXa2EULaFL72xXSwUpwbM.', true),
  ('b0000000-0000-0000-0000-000000000003', 'dr.williams@vetcare.com', 'Michael', 'Williams', 'veterinarian', '+1-555-0203',
   '$2a$10$XnbUdsXyHocdULEt.uTDpe4MzWEwbCKyXa2EULaFL72xXSwUpwbM.', true)
ON CONFLICT (email) DO NOTHING;

-- ─── Vet Profiles ───────────────────────────────────────────
INSERT INTO vet_profiles (id, user_id, license_number, specializations, qualifications, years_of_experience, bio, clinic_name, consultation_fee, currency, is_available, accepts_emergency, languages, rating, total_reviews, total_consultations)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'VET-46975', ARRAY['General Practice','Surgery'], ARRAY['DVM','Board Certified'],
   12, 'Dr. Smith is an experienced veterinarian with over 12 years specializing in general practice and surgery.',
   'Smith Veterinary Clinic', 75.00, 'USD', true, true, ARRAY['English','Spanish'], 4.80, 124, 350),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002',
   'VET-94579', ARRAY['Dermatology','Internal Medicine'], ARRAY['DVM','Board Certified'],
   8, 'Dr. Johnson specializes in dermatology and internal medicine with a gentle approach to pet care.',
   'Johnson Veterinary Clinic', 85.00, 'USD', true, false, ARRAY['English','French'], 4.60, 89, 210),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003',
   'VET-37158', ARRAY['Emergency Care','Orthopedics'], ARRAY['DVM','Board Certified','ACVS Fellow'],
   15, 'Dr. Williams is a veterinary surgeon with 15 years specializing in emergency care and orthopedics.',
   'Williams Veterinary Clinic', 95.00, 'USD', true, true, ARRAY['English','Spanish'], 4.90, 156, 480)
ON CONFLICT (user_id) DO NOTHING;

-- ─── Pet Owner User ──────────────────────────────────────────
-- Password: Owner@123
INSERT INTO users (id, email, first_name, last_name, role, phone, password_hash, is_active)
VALUES (
  'd0000000-0000-0000-0000-000000000001',
  'owner@vetcare.com', 'Emily', 'Davis', 'pet_owner', '+1-555-0301',
  '$2a$10$IyV8cp5ySrgwb5EYAVfNd.VXNVsMld5ss8bAGhJeru8c1RojI.EzC',
  true
) ON CONFLICT (email) DO NOTHING;

-- ─── Animals (Pets) ─────────────────────────────────────────
INSERT INTO animals (id, owner_id, name, species, breed, gender, date_of_birth, weight, color, is_active)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
   'Buddy', 'Dog', 'Golden Retriever', 'Male', '2020-03-15', 32.0, 'Golden', true),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001',
   'Whiskers', 'Cat', 'Siamese', 'Female', '2021-07-20', 4.5, 'Cream', true),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001',
   'Max', 'Dog', 'German Shepherd', 'Male', '2019-11-10', 38.0, 'Black and Tan', true)
ON CONFLICT (id) DO NOTHING;

-- ─── Default Vet Schedules ──────────────────────────────────
INSERT INTO vet_schedules (id, veterinarian_id, day_of_week, start_time, end_time, slot_duration, max_appointments, is_active)
VALUES
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', 'monday', '09:00', '17:00', 30, 16, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', 'tuesday', '09:00', '17:00', 30, 16, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', 'wednesday', '09:00', '17:00', 30, 16, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', 'thursday', '09:00', '17:00', 30, 16, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', 'friday', '09:00', '15:00', 30, 12, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000002', 'monday', '10:00', '18:00', 30, 16, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000002', 'wednesday', '10:00', '18:00', 30, 16, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000002', 'friday', '10:00', '16:00', 30, 12, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000003', 'tuesday', '08:00', '16:00', 30, 16, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000003', 'thursday', '08:00', '16:00', 30, 16, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000003', 'saturday', '09:00', '13:00', 30, 8, true)
ON CONFLICT (veterinarian_id, day_of_week) DO NOTHING;

-- ─── Default System Settings ────────────────────────────────
INSERT INTO system_settings (id, key, value, category, description)
VALUES
  (uuid_generate_v4(), 'site_name', 'VetCare Platform', 'general', 'Application name'),
  (uuid_generate_v4(), 'max_booking_days_ahead', '30', 'booking', 'Maximum days in advance a booking can be made'),
  (uuid_generate_v4(), 'default_slot_duration', '30', 'booking', 'Default consultation slot duration in minutes'),
  (uuid_generate_v4(), 'payment_currency', 'USD', 'payment', 'Default payment currency'),
  (uuid_generate_v4(), 'video_quality', 'high', 'video', 'Default video call quality'),
  (uuid_generate_v4(), 'session_timeout', '86400', 'security', 'Session timeout in seconds'),
  (uuid_generate_v4(), 'enable_notifications', 'true', 'notification', 'Enable in-app notifications'),
  (uuid_generate_v4(), 'maintenance_mode', 'false', 'general', 'Enable maintenance mode')
ON CONFLICT (key) DO NOTHING;
