-- ============================================================
-- VetCare Platform — MANDATORY Platform Seed Data
-- ============================================================
-- Run this on EVERY environment (production, development, staging).
-- Contains only data the platform CANNOT run without.
--
-- Execution order:
--   1. docker/init.sql           (schema + tables)
--   2. backend/migrations/*.sql  (incremental schema changes)
--   3. THIS FILE                 (mandatory platform data)
--   4. 03_demo_data.sql          (OPTIONAL — dev/demo only, NEVER production)
-- ============================================================

-- ── Platform Admin User ────────────────────────────────────────
-- Password: Admin@123  (bcrypt hash — must be changed in production)
INSERT INTO users (id, email, first_name, last_name, role, phone, password_hash, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'admin@vetcare.com', 'System', 'Admin', 'admin', '+1-555-0100',
  '$2a$10$RlWrPlmVC6hPxDMki3mX3.u98NgKNMfOH4/uPH2zaRIlYsvkL7LmK',
  true
) ON CONFLICT (email) DO NOTHING;

-- ── Default System Settings ─────────────────────────────────────
-- These settings power the admin Settings panel and are referenced by
-- useSettings() across the entire frontend. Without them, time/date/
-- currency formatting and booking rules will fail silently.
INSERT INTO system_settings (id, key, value, category, description)
VALUES
  (gen_random_uuid(), 'site_name',                          'VetCare Platform', 'general',      'Application name'),
  (gen_random_uuid(), 'max_booking_days_ahead',             '30',               'booking',      'Maximum days ahead a booking can be made'),
  (gen_random_uuid(), 'default_slot_duration',              '30',               'booking',      'Default consultation slot duration in minutes'),
  (gen_random_uuid(), 'booking.patientNoShowRescheduleLimit','1',               'booking',      'Max reschedules after patient no-show (0 = unlimited)'),
  (gen_random_uuid(), 'payment_currency',                   'USD',              'payment',      'Default payment currency'),
  (gen_random_uuid(), 'video_quality',                      'high',             'video',        'Default video call quality'),
  (gen_random_uuid(), 'session_timeout',                    '86400',            'security',     'Session timeout in seconds'),
  (gen_random_uuid(), 'enable_notifications',               'true',             'notification', 'Enable in-app notifications'),
  (gen_random_uuid(), 'maintenance_mode',                   'false',            'general',      'Enable maintenance mode'),
  (gen_random_uuid(), 'display.timeFormat',                 '12h',              'display',      'Time display format: 12h or 24h'),
  (gen_random_uuid(), 'display.dateFormat',                 'MM/DD/YYYY',       'display',      'Date display format'),
  (gen_random_uuid(), 'display.currency',                   'USD',              'display',      'Currency code for price display'),
  (gen_random_uuid(), 'consultation.joinWindowMinutes',     '15',               'consultation', 'Minutes before scheduled time that Join button becomes active'),
  (gen_random_uuid(), 'consultation.autoCompleteHours',     '2',                'consultation', 'Hours after scheduled time to auto-complete consultation')
ON CONFLICT (key) DO NOTHING;

-- ── Default Role Permissions ────────────────────────────────────
-- Required for PermissionService to work. Without these rows,
-- all permission checks will fail and no protected routes will load.
INSERT INTO role_permissions (id, role, permission, is_granted)
VALUES
  -- pet_owner permissions
  (gen_random_uuid(), 'pet_owner', 'dashboard_view',        true),
  (gen_random_uuid(), 'pet_owner', 'animals_manage',        true),
  (gen_random_uuid(), 'pet_owner', 'consultations_book',    true),
  (gen_random_uuid(), 'pet_owner', 'consultations_view',    true),
  (gen_random_uuid(), 'pet_owner', 'medical_records_view',  true),
  (gen_random_uuid(), 'pet_owner', 'marketplace_view',      true),
  (gen_random_uuid(), 'pet_owner', 'marketplace_sell',      true),
  (gen_random_uuid(), 'pet_owner', 'wellness_view',         true),
  (gen_random_uuid(), 'pet_owner', 'ai_copilot_use',        true),
  (gen_random_uuid(), 'pet_owner', 'vet_hospitals_view',    true),
  (gen_random_uuid(), 'pet_owner', 'settings_view',         true),
  (gen_random_uuid(), 'pet_owner', 'vet_certificates_view', true),
  -- veterinarian permissions
  (gen_random_uuid(), 'veterinarian', 'dashboard_view',          true),
  (gen_random_uuid(), 'veterinarian', 'consultations_manage',    true),
  (gen_random_uuid(), 'veterinarian', 'consultations_view',      true),
  (gen_random_uuid(), 'veterinarian', 'prescriptions_manage',    true),
  (gen_random_uuid(), 'veterinarian', 'medical_records_manage',  true),
  (gen_random_uuid(), 'veterinarian', 'medical_records_view',    true),
  (gen_random_uuid(), 'veterinarian', 'schedule_manage',         true),
  (gen_random_uuid(), 'veterinarian', 'ai_copilot_use',          true),
  (gen_random_uuid(), 'veterinarian', 'vet_hospitals_view',      true),
  (gen_random_uuid(), 'veterinarian', 'herd_medical_view',       true),
  (gen_random_uuid(), 'veterinarian', 'health_analytics_view',   true),
  (gen_random_uuid(), 'veterinarian', 'vet_certificates_manage', true),
  (gen_random_uuid(), 'veterinarian', 'settings_view',           true),
  -- farmer permissions
  (gen_random_uuid(), 'farmer', 'dashboard_view',         true),
  (gen_random_uuid(), 'farmer', 'animals_manage',         true),
  (gen_random_uuid(), 'farmer', 'consultations_book',     true),
  (gen_random_uuid(), 'farmer', 'consultations_view',     true),
  (gen_random_uuid(), 'farmer', 'medical_records_view',   true),
  (gen_random_uuid(), 'farmer', 'marketplace_view',       true),
  (gen_random_uuid(), 'farmer', 'marketplace_sell',       true),
  (gen_random_uuid(), 'farmer', 'wellness_view',          true),
  (gen_random_uuid(), 'farmer', 'ai_copilot_use',         true),
  (gen_random_uuid(), 'farmer', 'vet_hospitals_view',     true),
  (gen_random_uuid(), 'farmer', 'settings_view',          true),
  (gen_random_uuid(), 'farmer', 'enterprise_manage',      true),
  (gen_random_uuid(), 'farmer', 'analytics_view',         true),
  (gen_random_uuid(), 'farmer', 'innovation_view',        true),
  (gen_random_uuid(), 'farmer', 'breeding_manage',        true),
  (gen_random_uuid(), 'farmer', 'feed_manage',            true),
  (gen_random_uuid(), 'farmer', 'compliance_manage',      true),
  (gen_random_uuid(), 'farmer', 'financial_view',         true),
  (gen_random_uuid(), 'farmer', 'vet_certificates_view',  true),
  -- admin permissions (all)
  (gen_random_uuid(), 'admin', 'all_access', true)
ON CONFLICT DO NOTHING;
