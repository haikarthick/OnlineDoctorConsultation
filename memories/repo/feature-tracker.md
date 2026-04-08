# VetCare Feature Tracker

## Legend
- ✅ Completed
- ⚠️ Planned / In Progress
- ❌ Cancelled / Skipped (with reason)

---

## Core Platform

| Feature | Status | Notes |
|---------|--------|-------|
| Auth (login/register/JWT/refresh) | ✅ | All 4 roles |
| Role-based routing & permissions | ✅ | 4-file sync pattern enforced |
| Admin settings (time/date/currency/join window) | ✅ | `useSettings()` hook — all pages must use this |
| Floating chat widget | ✅ | Renders for all authenticated users globally |
| Multi-language i18n (5 locales) | ✅ | en, hi, ta, te, kn — all must be updated together |
| Responsive CSS (4 breakpoints) | ✅ | 1200 / 768 / 640 / 480px |
| Socket.IO real-time messaging | ✅ | |
| Demo data seeding | ✅ | `docker/seed-demo-data.sql` |
| Demo password auto-fix on startup | ✅ | `fixDemoPasswords.ts` runs every server start |

## Deployment & CI/CD

| Feature | Status | Notes |
|---------|--------|-------|
| Render.com DEV + PROD services | ✅ | vetcare-dev (develop) + vetcare-app (main) |
| GitHub Actions CI/CD promotion | ✅ | develop → main via "Promote DEV to PROD" workflow |
| DB schema separation | ✅ | vetcare_dev (develop) / vetcare_prod (main) |
| render-build.sh | ✅ | Builds frontend (Vite) then backend (tsc) |
| render-start.sh with timeout guards | ✅ | All node subprocesses have timeout + connectionTimeoutMillis |
| HTTP port bound before DB connect | ✅ | Fixed 2026-04-07 — critical for free-tier Render health check |
| connectWithRetry (5 attempts × 10s) | ✅ | Added 2026-04-06 |

## Pet Owner Module

| Feature | Status | Notes |
|---------|--------|-------|
| Dashboard | ✅ | |
| Animals (CRUD + profiles) | ✅ | |
| Medical Records | ✅ | Deep navigation: `/medical-records?animalId=X&recordId=Y` |
| Consultations (book, join, review) | ✅ | |
| AI Copilot | ✅ | Groq → OpenAI → local fallback |
| Marketplace | ✅ | Includes auto-populate listing from animal profile |
| Wellness tracker | ✅ | |
| Vet Hospitals / FindDoctor | ✅ | `useSettings()` time format; past slots filtered with 15-min buffer |
| Settings | ✅ | |
| Vaccine reminders | ✅ | Daily job via `VaccineScheduleService` |

## Farmer Module

| Feature | Status | Notes |
|---------|--------|-------|
| Farm / Enterprise management | ✅ | |
| Analytics | ✅ | |
| Innovation | ✅ | |
| Breeding management | ✅ | |
| Feed management | ✅ | |
| Compliance | ✅ | |
| Financial | ✅ | |
| Herd Medical | ✅ | i18n namespace added to all 5 locale files |

## Veterinarian Module

| Feature | Status | Notes |
|---------|--------|-------|
| Consultations & schedule | ✅ | |
| Prescriptions | ✅ | Joi schema matches frontend form fields |
| Medical Records | ✅ | |
| Reviews | ✅ | |
| Herd Medical | ✅ | |
| Health Analytics | ✅ | |
| AI Copilot | ✅ | |
| Vet Hospitals | ✅ | |
| Inpatient Search | ✅ | SQL columns verified against init.sql |
| Vet Certificates | ✅ | |

## Admin Module

| Feature | Status | Notes |
|---------|--------|-------|
| Full access to all modules | ✅ | Bypasses frontend permission checks |
| Admin Settings panel | ✅ | time/date/currency/join window globally enforced |
| User management | ✅ | |

---

## ⚠️ Planned Items — Phase 0: DB Cleanup & Restructuring

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| P0-1 | Fix missing enterprise_members table in init.sql | ⚠️ Planned | Referenced in EnterpriseService.ts but missing from canonical schema |
| P0-2 | Convert enterpriseMigration.ts → migrations/005_farm_enterprises.sql | ⚠️ Planned | TypeScript migrations must become numbered SQL files |
| P0-3 | Convert tier2Migration.ts → migrations/006_tier2_features.sql | ⚠️ Planned | breeding_records, feed_inventory, compliance_documents, etc. |
| P0-4 | Convert tier3Migration.ts → migrations/007_tier3_features.sql | ⚠️ Planned | disease_predictions, iot_sensors, traceability_events, etc. |
| P0-5 | Convert tier4Migration.ts → migrations/008_tier4_features.sql | ⚠️ Planned | ai_chat_sessions, marketplace_listings, wellness_scorecards, etc. |
| P0-6 | Update render-start.sh to use migrate.ts for all migrations | ⚠️ Planned | Replace 4 individual TS migration calls with single migrate.js call |
| P0-7 | Split seed-demo-data.sql into platform_required + demo layers | ⚠️ Planned | seeds/01_platform_required.sql + seeds/03_demo_data.sql |

## ⚠️ Planned Items — Phase 1: Enterprise Hospital Network Foundation

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| P1-1 | hospital_networks + supporting tables in init.sql + migration | ✅ Done | 6 tables added to init.sql + migration 009 |
| P1-2 | HospitalNetworkService + routes | ✅ Done | HospitalNetworkService.ts + HospitalNetworkController.ts + 17 routes |
| P1-3 | corporate_admin + hospital_director roles — 4-file sync | ✅ Done | Permissions + navigation + App.tsx synced (2026-04-09) |
| P1-4 | Hospital data isolation middleware | ✅ Done | hospitalDataIsolation.ts — checkAnimalAccess, requireAnimalAccess middleware, logClinicalAccess. Applied to /animals/:id, /consultations/animal/:id, /prescriptions/animal/:id, /vaccinations/animal/:id. Access-check endpoint added (2026-04-08) |
| P1-5 | Corporate Admin — Hospital Network Management UI | ✅ Done | HospitalNetworks.tsx — 3-tab UI: Networks list/stats/approve, Network Detail (dashboard+hospitals+members), Audit Tab fully implemented (2026-04-09) |
| P1-6 | Patient Consent Management UI (pet_owner + farmer) | ✅ Done | PatientConsent.tsx — 2-panel layout, 6-dim consents, CSS toggles, presets (2026-04-08) |
| P1-7 | Demo hospital network seed data | ✅ Done | DemoVetGroup + demo hospitals + corporate_admin in seed-demo-data.sql |

### Architecture Decisions (Locked)
- Farm `enterprises` table and `hospital_networks` are COMPLETELY SEPARATE — never merged
- Hospital data: opt-in, private by default, isolation enforced at SQL level
- Multiple networks: each (Apollo, NH1, TN Govt) registers independently
- Corporate admin: direct access to own network, every access immutably audit-logged
- Dual patient ID: `VC-DOG-26-00001` (platform) + `APOLLO-P-00423` (corporate)
- Patient consent: 6-dimension granular, `include_hospital_records` defaults to `false`

---

## Recently Completed (last 10)

1. ✅ HospitalNetworks.tsx Audit Tab (Tab 3) — stats row, filter bar, paginated table, CSV export, empty/loading states (2026-04-09)
2. ✅ PatientConsent.tsx full UI — 2-panel layout, 6-dim consent, CSS toggle switches, presets (2026-04-08)
2. ✅ HospitalNetworks.tsx full UI — 3-tab admin dashboard, network CRUD, member/hospital management (2026-04-08)
3. ✅ api.ts — 14 new methods for hospital networks + patient consent (2026-04-08)
4. ✅ Hospital Network 4-file permission sync — `hospital_network_manage/view/audit`, `patient_consent_manage` (2026-04-09)
5. ✅ Empty-state shortcuts — contextual navigation buttons across BookConsultation, MedicalRecords, WellnessPortal (2026-04-08)
6. ✅ Fix Render deploy — HTTP port bound FIRST before DB connect (2026-04-07)
7. ✅ render-start.sh — tighten timeouts: connectionTimeoutMillis 30000→15000, migrations 60→40s (2026-04-07)
8. ✅ connectWithRetry() — 5 attempts × 10s for free-tier Render PostgreSQL (2026-04-06)
9. ✅ Inpatient search — SQL column names fixed and verified against init.sql (prior)
10. ✅ FindDoctor — useSettings() formatters, past slot filtering with 15-min buffer (prior)

11. `PatientConsent.tsx` — Full page implemented: 2-panel sidebar layout, animal list with active consent count badges, consent cards with scope badges + permissions grid + revoke action, Grant Consent modal with preset quick-fills, 6 data permission toggles (CSS-only), scope radio cards, grant-to tabs (Doctor/Hospital/Network), validity period pickers. All 5 locale files updated. PatientConsent.css with 4 responsive breakpoints.
