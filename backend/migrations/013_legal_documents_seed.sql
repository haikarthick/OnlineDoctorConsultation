-- Migration: 013_legal_documents_seed.sql
-- Placeholder v1 policy documents (docs/PAYMENT_MODULE_PLAN.md §17.1).
-- Admin replaces content via Admin → Legal & Policies (publishing creates v2+).
-- Idempotent.

INSERT INTO legal_documents (id, doc_type, version, title, content, requires_reacceptance, is_active) VALUES
  (gen_random_uuid(), 'terms', 1, 'Terms of Service', 'Placeholder Terms of Service. The platform acts as merchant of record for consultation services; veterinarians provide services under a separate service-provider agreement. Replace this text with the lawyer-approved Terms of Service before production go-live.', false, true),
  (gen_random_uuid(), 'privacy', 1, 'Privacy Policy', 'Placeholder Privacy Policy aligned to the DPDP Act 2023. Replace this text with the lawyer-approved Privacy Policy before production go-live.', false, true),
  (gen_random_uuid(), 'refund_policy', 1, 'Refund & Cancellation Policy', 'Placeholder Refund & Cancellation Policy. Doctor cancellation: full refund plus goodwill bonus. Patient cancellation: full refund minus a cancellation processing charge when cancelled 24 hours or more before the appointment; 50 percent minus the processing charge between 2 and 24 hours; no refund within 2 hours. Replace with the final policy text before go-live.', false, true),
  (gen_random_uuid(), 'wallet_terms', 1, 'Wallet Terms', 'Placeholder Wallet Terms. The wallet is a closed credit usable only on this platform. Wallet balances cannot be withdrawn as cash. Refund-sourced balances never expire and are returned to the original payment method on account closure. Replace with lawyer-approved text before go-live.', false, true),
  (gen_random_uuid(), 'doctor_agreement', 1, 'Doctor Service-Provider Agreement', 'Placeholder Doctor Agreement covering platform commission, settlement clearance windows, cancellation penalties, referral rules and professional responsibility. Replace with the lawyer-approved agreement before production go-live.', false, true),
  (gen_random_uuid(), 'grievance_policy', 1, 'Grievance Redressal Policy', 'Placeholder Grievance Redressal Policy. A named grievance officer and escalation timelines are required under the Consumer Protection (E-Commerce) Rules 2020. Replace with the final policy and officer details before go-live.', false, true),
  (gen_random_uuid(), 'disclaimer', 1, 'Service Disclaimer', 'Placeholder Service Disclaimer. Online consultation is not a substitute for physical emergency veterinary care. In an emergency, visit the nearest veterinary clinic immediately. Replace with the final disclaimer before go-live.', false, true)
ON CONFLICT (doc_type, version) DO NOTHING;
