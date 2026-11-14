# waytovet (repo name: OnlineDoctorConsultation)

Enterprise veterinary SaaS platform — **not** a human-doctor app. "Patient" = animal, "owner" = human.
Roles: pet_owner, farmer, veterinarian, admin, corporate_admin, hospital_staff (invite-only),
pharmacist (invite-only). Full role/network-role detail: ask for it, it's covered in persistent memory.

This file is intentionally short. It's the always-loaded root of a **progressive-disclosure**
context model — don't grow it; add detail to `docs/modules/<module>.md` instead and link it below.

## Tech stack
Backend: Node 18 + Express + TypeScript, PostgreSQL (`gen_random_uuid()`), Redis, Socket.IO, JWT.
Frontend: React 18 + TypeScript + Vite, CSS modules are **global** (no scoping — see
`docs/DESIGN_SYSTEM.md` §5a), i18n across 6 locales. DB: Render Postgres (dev) / Neon (demo).

## Key directories
```
backend/src/controllers/   HTTP layer
backend/src/services/      business logic + DB queries (76 files, well split; the two that
                            weren't — database.ts, HospitalNetworkService.ts — are now class
                            skeletons delegating to utils/database/ and services/hospitalNetwork/)
backend/src/routes/index.ts  pure aggregator, 36 lines — mounts every routes/<module>.routes.ts
backend/src/routes/<module>.routes.ts  one module's routes per file, 15 files total
backend/src/middleware/     auth, validation, upload, hospitalDataIsolation
docker/init.sql            canonical schema, ONE transaction (any error wipes the schema)
backend/migrations/        numbered SQL migrations for existing DBs — never hardcode `public.`
frontend/src/pages/<role-or-module>/   one subdirectory per role/module
frontend/src/services/api.ts   the class-based API client every page uses (there's also
                                services/api/ — a second, modular set; update BOTH when relevant)
frontend/src/locales/<lang>/modules/<module>.json  i18n per module per locale, 16 files x 6
                                locales (was one ~8,400-line file per locale until 2026-11-13);
                                public/locales is generated from these, never edit it directly
docs/modules/              per-module deep-dive docs (load only the one you're touching)
```

## Branches
`develop` → Render `vetcare-dev`. `demo` → Render `vetcare-demo` (Neon). `main` is archive only.
Never push directly to `demo`/`main`; promote via the GitHub Actions workflow.

## Before shipping anything that touches DB, routes, or auth
Static checks (`tsc`, `vitest`, `npm run build`) cannot see SQL or runtime behavior — only
`npm run verify:runtime` (backend) does. Since 2026-11-13 it runs in CI on every push rather than
locally by default (it's heavy and, on Windows, flashes console windows — see
`docs/VERIFICATION.md`), and `vetcare-dev` deploys only after CI checks pass, so a broken change
still can't reach Render undetected. Run it locally yourself (`RUN_RUNTIME_VERIFY=1`) when you
want confidence before waiting on CI, or when working offline.

## Route split (done, 2025-11-13)
`backend/src/routes/index.ts` was a single ~5,800-line file holding every module's routes — the
main scalability and editor-performance risk as new modules got added. Now fully split into 15
files under `routes/`, each a self-contained `Router()` mounted with `router.use(...)` in
`index.ts` in the exact original position (route match order matters — nothing was reordered).
`index.ts` itself is now a 36-line aggregator. Each extraction was verified with `npm run build`
+ `npm run verify:runtime` (real Postgres, real server boot, browser journeys) before the next.

- `pharmacy.routes.ts`, `grooming.routes.ts`
- `core-clinical.routes.ts` — auth, consultations, bookings, video, schedules, prescriptions,
  animal/vet-profile CRUD (imports `ensureGroupAccess` from `enterprise-farm.routes.ts`)
- `enterprise-farm.routes.ts` — enterprise/farm, animal groups, batch/herd management (defines
  and exports `ensureGroupAccess`)
- `medical-records.routes.ts` — medical records, vaccinations, weight/allergy/lab, notifications
- `payments-and-reviews.routes.ts` — payments, referrals, withdrawals, legal docs, wallet, reviews
- `admin-and-permissions.routes.ts` — admin user/content management, system-role permissions
- `marketplace.routes.ts` — marketplace/auctions/wellness/sustainability/geospatial (Tier4Controller)
- `catalog-and-roles.routes.ts` — vet hospital CRUD, vaccine protocols, master data, role-change
  requests
- `hospital-network.routes.ts` — hospital network CRUD, patient enrollment/consent, referrals
  ([[feedback-network-hospital-change-approval]] zone — extracted with explicit owner approval,
  zero logic changes, mechanical move only)
- `network-permissions-and-workflow.routes.ts` — network role permissions + custom roles CRUD,
  PLUS interleaved unrelated content found while mapping dependencies: staff workflow/inpatient
  queue (`StaffWorkflowController`), Tier2/3/4 AI-copilot & sustainability routes, and the
  enterprise-medical-records cross-tenant fix. Its banner name undersells what's actually in it.
- `network-subscriptions.routes.ts` — network subscription plans + admin management (exports
  `checkSeatLimit`, imported by `hospital-staff-invites.routes.ts`)
- `hospital-staff-invites.routes.ts` — invite-only `hospital_staff` registration flow
- `network-financial-summary.routes.ts` — G11 network financial summary

The `/repair-schema` + `/debug/db-state` endpoints (now in `marketplace.routes.ts`, inherited
from where they sat in the monolith) were checked during this split and are NOT a vulnerability:
`emergencyGate` requires a 16+ char `EMERGENCY_DIAGNOSTIC_TOKEN`, constant-time compared, fails
closed if unset, responds 404 not 401/403. This matches the 2026-08-03 fix recorded in
[[codebase-audit-2026-08-03]] — confirmed still in place, not regressed.

New modules should be feature-flagged (pattern: `grooming.enabled`, `payment.enabled`) and ship
as their own `routes/<module>.routes.ts` from the start.

## i18n split (done, 2026-11-13)
Same debt pattern as the route split, same fix shape. Each locale was a single ~8,400-line
`translation.json` (143 flat top-level keys) — one stray comma broke every feature's translations
for that whole language. Split into `frontend/src/locales/<lang>/modules/<module>.json` (16 files
per locale: common, auth, home, dashboard, consultations, medicalRecords, animals, enterprise,
analytics, hospital, hospitalNetwork, pharmacy, grooming, marketplace, payments, admin), grouped
by the same module boundaries as the route split. Runtime is unchanged — `copy-locales.cjs` now
merges the module files into the one `translation.json` per locale that `i18next-http-backend`
already fetched, and `src/i18n/index.ts` merges English's modules the same way via
`import.meta.glob` instead of one static import — no `t()` call site anywhere changed. Verified
by deep-equality against the original files before deleting them, plus `localeParity.test.ts`
(updated to read the split files), a full `vitest run` (74 tests), and the frontend build.

Along the way, `localeParity.test.ts` surfaced a real pre-existing bug (not caused by the split —
proven by the deep-equality check): `VaccinationPassport.tsx`'s `tabs.passport/compliance/history`
had never been defined in any locale, only `tabs.group` existed. Fixed by reusing real existing
translations from the same file (`vaccinationPassport.compliance`, the transliterated "Passport"
word already inside `vaccinationPassport.title`) rather than inventing fresh ones; `history` uses
the English word in every locale, matching every other `tabs.history` label in the codebase
(`pharmacy.tabs.history` etc.), which is untranslated everywhere too — a known, deliberately
deferred gap (see `codebase-audit-2026-08-03` in memory), not something to paper over silently.

Adding a new module's translations: add a new module file per locale (don't grow an existing
one), per the `add-module` skill.

## Project skills (`.claude/skills/`)
Invoke these for the workflows they cover rather than improvising each time:
- `feature-delivery` — **the default pipeline for any new feature/enhancement/module request**:
  requirements clarification → design → build → review (chains the skills below) → ship. Starts
  automatically when the user describes new functionality; don't skip its phases.
- `add-module` — scaffolding a new module (route file, controller/service layering, DB,
  frontend page, i18n, feature flag)
- `ui-review` — DESIGN_SYSTEM.md gates + an Apple-HIG-style polish pass for any screen
- `ui-resilience-review` — animation performance discipline + real-world edge-case data
  (long names in every locale, huge lists, missing fields) for any public-facing screen
- `farm-domain-review` — functional gate for any farm feature: species-correct terms, life-stage
  groups, the farmer's daily record-keeping loop, NBAGR breeds, vet-sees-what-farmer-recorded
- `mobile-farmer-ux` — phone-first rules for any farmer screen: tap counts, bottom tab bar,
  cards not tables, tap-not-type entry, never lose an entry offline
- `tenant-isolation-review` — the cross-tenant/IDOR checklist for any route taking a
  network/enterprise/pharmacy/group id
- `pre-ship` — what "done" actually requires, beyond a green `tsc`

## Module docs
- *(add a line here per module as `docs/modules/<name>.md` is written)*

## Where the rest of the context lives
This repo's full history of bugs, fixes, architectural decisions, and domain rules lives in
Claude's persistent memory for this project — not duplicated here to avoid two sources of truth.
