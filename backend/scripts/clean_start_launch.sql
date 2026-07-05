-- ============================================================
-- GO-LIVE CLEAN-START SCRIPT (docs/PAYMENT_MODULE_PLAN.md D14)
-- ============================================================
-- Owner rule (2026-07-05): production launches with a clean slate —
-- no grandfathered bookings/consultations/payments. This script wipes
-- TRANSACTIONAL data while preserving accounts, profiles, master data,
-- settings, policies and consent records.
--
-- ⚠️  DESTRUCTIVE. Run manually, once, against the production database
--     immediately before flipping payment.enabled=true. Take a backup first:
--       pg_dump "$DATABASE_URL" > pre_launch_backup.sql
--
-- Preserved: users, vet_profiles, vet_hospitals, hospital_networks,
--            animals, enterprises, system_settings, tax_codes,
--            legal_documents, user_policy_acceptances, permissions.
-- ============================================================

BEGIN;

-- Payment module transactional data
DELETE FROM payment_events;
DELETE FROM invoices;
DELETE FROM doctor_earnings;
DELETE FROM withdrawal_requests;
DELETE FROM wallet_transactions;
UPDATE wallets SET balance = 0, bonus_credits = 0, updated_at = NOW();

-- Referrals (platform + legacy hospital workflow referrals tied to test data)
DELETE FROM referrals;

-- Consultation cycle
DELETE FROM chat_messages;
DELETE FROM video_sessions;
DELETE FROM prescriptions;
DELETE FROM reviews;
DELETE FROM payments;
UPDATE bookings SET consultation_id = NULL;
DELETE FROM medical_records WHERE consultation_id IS NOT NULL;
DELETE FROM consultations;
DELETE FROM bookings;

-- Notifications referencing wiped entities
DELETE FROM notifications;

COMMIT;

-- Post-run verification (expect all zeros):
--   SELECT (SELECT COUNT(*) FROM bookings) bookings,
--          (SELECT COUNT(*) FROM consultations) consultations,
--          (SELECT COUNT(*) FROM payments) payments,
--          (SELECT COUNT(*) FROM doctor_earnings) earnings,
--          (SELECT COUNT(*) FROM withdrawal_requests) withdrawals;
