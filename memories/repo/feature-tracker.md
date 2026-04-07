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

## ⚠️ Planned Items (not yet implemented)

_None currently. Add items here as features are discussed with the user._

---

## Recently Completed (last 10)

1. ✅ Fix Render deploy — HTTP port bound FIRST before DB connect (2026-04-07)
2. ✅ render-start.sh — tighten timeouts: connectionTimeoutMillis 30000→15000, migrations 60→40s, seed 300→120s (2026-04-07)
3. ✅ connectWithRetry() — 5 attempts × 10s for free-tier Render PostgreSQL (2026-04-06)
4. ✅ render-start.sh — connectionTimeoutMillis:30000 + timeout guards on all migrations/seed (2026-04-06)
5. ✅ Inpatient search — SQL column names fixed and verified against init.sql (prior)
6. ✅ FindDoctor — useSettings() formatters, past slot filtering with 15-min buffer (prior)
7. ✅ HerdMedical — i18n namespace added to all 5 locale files (prior)
8. ✅ Marketplace — animal profile auto-populate listing (prior)
9. ✅ Medical Records — deep navigation with animalId + recordId params (prior)
10. ✅ Vet "My Pets" — fixed to query own animals via owner_id, not consultation tables (prior)
