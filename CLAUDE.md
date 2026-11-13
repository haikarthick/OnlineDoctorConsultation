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
backend/src/routes/index.ts  remaining monolithic routes, ~4,500 lines — being split per-module, see below
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

Done: `pharmacy.routes.ts`, `grooming.routes.ts` (2025-11-13). `index.ts` is now ~4,500 lines.
Remaining in the monolith: auth, consultations, bookings, video, schedules, prescriptions,
animals, vet profiles, enterprise/farm, hospital network, medical records, payments/wallet,
reviews, admin, permissions, marketplace, vet hospital, vaccine protocols, master data, role
change requests, network subscriptions, staff invites. Extract one module at a time, smallest/
most self-contained next — don't attempt the rest in one pass.

New modules should be feature-flagged (pattern: `grooming.enabled`, `payment.enabled`) and ship
as their own `routes/<module>.routes.ts` from the start rather than growing the monolith further.

## Module docs
- *(add a line here per module as `docs/modules/<name>.md` is written)*

## Where the rest of the context lives
This repo's full history of bugs, fixes, architectural decisions, and domain rules lives in
Claude's persistent memory for this project — not duplicated here to avoid two sources of truth.
