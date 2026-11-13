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
backend/src/services/      business logic + DB queries (76 files, well split)
backend/src/routes/index.ts  remaining routes, ~2,000 lines — the network-hospital permission/
                              visibility zone (change-protected, needs approval before touching)
backend/src/routes/<module>.routes.ts  routes extracted from the monolith, one module per file
backend/src/middleware/     auth, validation, upload, hospitalDataIsolation
docker/init.sql            canonical schema, ONE transaction (any error wipes the schema)
backend/migrations/        numbered SQL migrations for existing DBs — never hardcode `public.`
frontend/src/pages/<role-or-module>/   one subdirectory per role/module
frontend/src/services/api.ts   the class-based API client every page uses (there's also
                                services/api/ — a second, modular set; update BOTH when relevant)
docs/modules/              per-module deep-dive docs (load only the one you're touching)
```

## Branches
`develop` → Render `vetcare-dev`. `demo` → Render `vetcare-demo` (Neon). `main` is archive only.
Never push directly to `demo`/`main`; promote via the GitHub Actions workflow.

## Before shipping anything that touches DB, routes, or auth
Static checks (`tsc`, `vitest`, `npm run build`) cannot see SQL or runtime behavior. Run
`npm run verify:runtime` (backend) before calling a DB/route/constraint change done — full
rationale and the production incident that proved it necessary: `docs/VERIFICATION.md`.

## Known structural debt (in progress)
`backend/src/routes/index.ts` was a single ~5,800-line file holding every module's routes — the
main scalability and editor-performance risk as more modules are added. Splitting it into
`routes/<module>.routes.ts`, each a self-contained `Router()` mounted with `router.use(...)` in
`index.ts`, in the exact original position (route match order matters) so nothing reorders across
modules. Each split is verified with `npm run build` + `npm run verify:runtime` before the next.

Done (2025-11-13), `index.ts` is now ~2,000 lines (from ~5,800):
- `pharmacy.routes.ts`, `grooming.routes.ts`
- `core-clinical.routes.ts` — auth, consultations, bookings, video, schedules, prescriptions,
  animal/vet-profile CRUD (exports `ensureGroupAccess`, imported by nothing else currently)
- `enterprise-farm.routes.ts` — enterprise/farm, animal groups, batch/herd management (defines
  and exports `ensureGroupAccess`, imported by `core-clinical.routes.ts`)
- `medical-records.routes.ts` — medical records, vaccinations, weight/allergy/lab, notifications
- `payments-and-reviews.routes.ts` — payments, referrals, withdrawals, legal docs, wallet, reviews
- `admin-and-permissions.routes.ts` — admin user/content management, system-role permissions
- `marketplace.routes.ts` — marketplace/auctions/wellness/sustainability/geospatial (Tier4Controller)
- `catalog-and-roles.routes.ts` — vet hospital CRUD, vaccine protocols, master data, role-change
  requests

**NOT touched, left inline in `index.ts` — change-protected, approval required first**
([[feedback-network-hospital-change-approval]]): hospital network CRUD + patient enrollment,
network role permissions + custom roles CRUD, network subscription plans/admin, hospital staff
invites, network financial summary. These banner sections are NOT reliably pure — they contain
interleaved unrelated content (Tier2/3/4 AI-copilot/sustainability routes, enterprise medical
records, a stray undocumented `/repair-schema` debug endpoint) found while mapping dependencies
for the split above, so don't assume a banner's title describes everything under it. Get explicit
approval before extracting any of this, and re-verify its true contents first — don't rely on
banner comments.

New modules should be feature-flagged (pattern: `grooming.enabled`, `payment.enabled`) and ship
as their own `routes/<module>.routes.ts` from the start rather than growing the monolith further.

## Module docs
- *(add a line here per module as `docs/modules/<name>.md` is written)*

## Where the rest of the context lives
This repo's full history of bugs, fixes, architectural decisions, and domain rules lives in
Claude's persistent memory for this project — not duplicated here to avoid two sources of truth.
