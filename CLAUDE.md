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
backend/src/routes/index.ts  ALL routes, ~5,800 lines — known scalability debt, see below
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

## Known structural debt (tracked, not yet fixed)
`backend/src/routes/index.ts` is a single ~5,800-line file holding every module's routes. It's
the main scalability and editor-performance risk as more modules are added — splitting it into
`routes/<module>.ts` is planned. Until then, keep new routes grouped and commented by module
inside the file, and feature-flag new modules (pattern: `grooming.enabled`, `payment.enabled`)
rather than wiring them in unconditionally.

## Module docs
- *(add a line here per module as `docs/modules/<name>.md` is written)*

## Where the rest of the context lives
This repo's full history of bugs, fixes, architectural decisions, and domain rules lives in
Claude's persistent memory for this project — not duplicated here to avoid two sources of truth.
