---
name: add-module
description: Scaffold a brand-new feature module for the waytovet platform (backend routes/controller/service/DB, frontend page + i18n, feature flag). Use whenever the user asks to add a new module, a new top-level feature area, or a new major capability to this app — not for a small endpoint or a tweak to an existing module. Also use when the user says things like "scaffold", "new module", "add a <thing> module/feature", or describes a feature that doesn't fit inside any existing routes/*.routes.ts file.
---

# Adding a new module

This repo just finished splitting a single 5,800-line `routes/index.ts` into 15 per-module
route files (see `CLAUDE.md`). The whole point of that work is wasted if the next module goes
back into one giant file, or skips the isolation patterns that past incidents paid for. Follow
this shape for every new module.

## 1. Backend: its own route file, never index.ts directly

Create `backend/src/routes/<module>.routes.ts` as a **self-contained Express router**:

```ts
import { Router, Request, Response } from 'express';
import { authMiddleware, roleMiddleware, validateBody } from '../middleware/auth';
import { asyncHandler } from '../utils/errorHandler';
import <Module>Controller from '../controllers/<Module>Controller';
import { create<Module>Schema } from '../middleware/validation';

const router = Router();

router.post('/<module>', authMiddleware, validateBody(create<Module>Schema), asyncHandler((req: Request, res: Response) => <Module>Controller.create(req, res)));

export default router;
```

Then in `backend/src/routes/index.ts`, add one import and one mount line, appended at the end:

```ts
import <module>Routes from './<module>.routes';
...
router.use(<module>Routes);
```

**Why its own file and not a few lines dropped into an existing one:** every route file in this
repo earned its boundary by being independently verifiable — you can grep, test and reason about
one module without loading fifteen others. Dropping new routes into whichever file is open
defeats that, and it's exactly how the original monolith grew to 5,800 lines in the first place.

**Check for path collisions before appending the mount line.** Express matches routes in
registration order; two routers both defining `GET /:id`-shaped patterns on overlapping prefixes
can shadow each other. A quick `grep` across `routes/*.routes.ts` for the path prefix you're about
to use is cheap insurance.

Layering inside the module: **controller → service → database**, matching every existing module.
The controller is the HTTP layer (parse request, call service, shape response); the service holds
business logic and SQL. Don't put `database.query(...)` calls directly in the route file except
for the kind of small, self-contained guard helpers the pharmacy and enterprise-farm modules use
(`guardPharmacy`, `ensureGroupAccess`) — anything bigger belongs in a service.

## 2. Dark-launch behind a feature flag

Every non-trivial module in this app ships dark first (`grooming.enabled`, `payment.enabled`) and
is turned on deliberately, not by merging to `develop`. Copy the pattern in
`backend/src/middleware/grooming.ts` (a tiny middleware that 404s when the flag is off) and
`backend/src/config/featureFlags.ts` (where flags are read/written). Gate every route in your new
module behind it the same way grooming does — a public, ungated `/<module>/status` probe plus
everything else behind the gate is the established shape.

## 3. Database: both places, every time

1. `docker/init.sql` — fresh installs. It is **one atomic transaction**: a single bad statement
   wipes the whole schema, so get the SQL right, don't "add it later."
2. A numbered migration in `backend/migrations/` — existing databases. **Never hardcode
   `public.`** in a migration; bare identifiers resolve through the runner's `search_path`.

If you're adding a role, enum value, or CHECK-constrained column, there's a 5-step checklist for
exactly that in `docs/VERIFICATION.md` ("When adding a new role, enum value, or
CHECK-constrained column") — follow it, including checking whether `database.ts`'s legacy
self-heal rebuilds the same constraint on every boot (it has silently reverted migrations before).

## 4. Frontend: a page directory, the real API client, every locale

- `frontend/src/pages/<module>/` — one component per page, mirroring the existing per-role/
  per-module subdirectories.
- Give the page wrapper its own unique class (e.g. `<module>-page`) and scope every selector in
  its CSS file with `:where(.<module>-page)` — **there are no CSS modules in this app, every
  stylesheet is global.** Read `docs/DESIGN_SYSTEM.md` in full before writing any CSS; it is a
  gated standard (`react/forbid-dom-props` is an ESLint error), not a style guide you can skim.
  The `ui-review` skill covers the quality pass once the page exists.
- `frontend/src/services/api.ts` is the **real, class-based API client every page uses.** There is
  also a `services/api/` directory — a second, unfinished modular rewrite that a barrel import
  silently resolves away from. Add your calls to `api.ts`. If you're not sure which one a page
  already uses, check its import, don't assume.
- New UI copy needs a key in **all six locales**: `en, hi, kn, ml, ta, te`. Edit
  `frontend/src/locales/<lang>/modules/<module>.json` — each locale is split by module (16 files,
  e.g. `pharmacy.json`, `grooming.json`), not one giant file. For a brand-new module, add a new
  module file per locale rather than piling onto an existing one. `public/locales` is generated
  from these by `copy-locales.cjs`, editing it directly is a no-op on the next build. A raw i18n
  key rendered on screen is a shipped bug, not a cosmetic one.

## 5. Before calling it done

- Run `npm run verify:runtime` (backend) — this module's routes, migrations and any constraint
  changes need to survive a real Postgres boot and the browser critical-journey suite, not just
  `tsc`. See the `pre-ship` skill and `docs/VERIFICATION.md` for why static checks aren't enough.
- Add a line to `docs/modules/<module>.md` describing the module (what it is, its feature flag,
  its route file, known gaps) and link it from `CLAUDE.md`'s "Module docs" list — that's the
  progressive-disclosure contract this repo uses: the root context file stays thin, detail lives
  one level down, loaded only when someone is actually working on that module.

## One hard stop

If the module you're building reads or writes hospital-network membership, roles, or
visibility data — not just "it's used by a network hospital," but actually touches who can see or
do what within a network — **stop and get explicit approval before writing code there.** That
area is change-protected for good reason (15 cross-tenant isolation bugs were found in it
historically); see the `tenant-isolation-review` skill and the note in `CLAUDE.md` about the
network-hospital zone.
