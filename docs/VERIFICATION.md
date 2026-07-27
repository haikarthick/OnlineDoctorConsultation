# Verification — what actually gets checked before a push

## The rule

**A change that touches the database or a request path is not verified until it has run against
a real Postgres and a real booted server.** `tsc`, vitest and `npm run build` cannot see SQL.

## Why this document exists

On 2026-07-27 registering as a Grooming Provider failed in production with
`Error creating user`. At the moment it shipped:

- `tsc --noEmit` — green (both backend and frontend)
- `vitest` — 33/33 green
- `render-build.sh` — green, bundle within budget
- Pre-push gate — all 4 checks green
- The migration widening the constraint — applied cleanly, recorded in `_migrations`

Every signal said ship. The feature was broken for every user, because the only thing that
could have caught it was *running it*. The root cause (startup self-heal reverting a tracked
migration on every boot) is invisible to every static tool, and invisible in the migration log.

## The five gates (`npm run pre-deploy`, runs on every push)

| # | Check | Catches | Nature |
|---|-------|---------|--------|
| 1 | Backend build | TS errors, build failures | static |
| 2 | Frontend build + bundle budget | TS errors, Vite/Rollup failures, oversized chunks | static |
| 3 | Schema validation | column-name mismatches between code and `init.sql` | static |
| 4 | E2E route coverage | routes with no test | static |
| 5 | **Runtime verification** | **everything the above cannot see** | **executes** |

## Gate 5 — `backend/scripts/runtime-verify.js`

Builds a throwaway PostgreSQL the way production is built, then drives the real server.

| Phase | What it does | The failure it exists to catch |
|-------|--------------|-------------------------------|
| 1 | `docker/init.sql` as **one transaction** | a fresh deploy aborting the whole schema — production applies it atomically, so one bad statement leaves **no schema at all** |
| 2 | every `backend/migrations/*.sql` in order | a migration that only fails against a real database |
| 3 | schema snapshot, before the server ever connects | — (baseline) |
| 4 | boots the **real compiled server** (`backend/dist`) | startup crashes that only happen with a real DB |
| 5 | **drift check** — re-snapshot and diff | **startup code silently overwriting a tracked migration.** This is the generic form of the 2026-07-27 bug |
| 6 | HTTP: register **every** self-registerable role, log in, read permissions | a role that cannot actually be created, or resolves to zero permissions |

### Design decisions worth keeping

- **Schema is `vetcare_dev`, not `public`.** All deployments are schema-scoped. Testing on
  `public` hides an entire bug class — migration 030 had a hardcoded `public.user_roles` that
  silently no-opped on every real environment.
- **The role list in phase 6 is parsed from `validation.ts`**, not hardcoded. Add a role to the
  Joi schema and this gate automatically covers it. A hardcoded list would drift and go quiet.
- **Drift check allows ADDITIONS, fails on CHANGES and REMOVALS.** The legacy self-heal
  legitimately creates objects `init.sql` predates; what is never legitimate is startup code
  redefining or deleting what a migration established.
- **`ARRAY[...]` element order is normalised** before diffing — reordering is not a change.
- **Missing Postgres FAILS the gate; it does not skip.** A check that silently no-ops is how
  this class of bug reaches production. Override is `SKIP_RUNTIME_VERIFY=1`, and using it
  should be justified in the commit message.
- **Email providers are blanked** (`RESEND_API_KEY=""`, `SMTP_HOST=""`) so a verification run
  can never send real mail — a unit test once did exactly that.

### What it found on its first real run

Beyond the bug it was built for, immediately and unprompted:

1. `invoices_invoice_type_check` was rebuilt on every boot **without `'grooming'`** — every
   grooming GST invoice (GRM series) would have been rejected in production, the identical
   failure to groomer registration, waiting for the first paid grooming order.
2. `consultations_animal_id_fkey` was reverted from `SET NULL` to `RESTRICT` on every boot —
   `init.sql` and startup disagreed about a delete policy.
3. `hospital_staff_invites.invitee_name` had its `NOT NULL` silently dropped on every boot.

None were reachable by any static check.

## Running it

```bash
cd backend
npm run build          # gate 5 boots backend/dist, so build first
npm run verify:runtime
```

Needs a local PostgreSQL. If it is not on a default path:

```bash
PGBIN="C:\Program Files\PostgreSQL\18\bin" npm run verify:runtime
```

Takes ~2-3 minutes. It creates a temporary cluster on a random free port and removes it
afterwards; it never touches your own databases.

## When adding a new role, enum value, or CHECK-constrained column

1. `docker/init.sql` — fresh installs
2. a migration in `backend/migrations/` — existing databases (**never hardcode `public.`**;
   bare identifiers resolve through the runner's `search_path`)
3. `backend/src/utils/database.ts` — check whether the self-heal rebuilds that constraint. If
   it does, derive it from a shared constant (`SYSTEM_ROLES`, `INVOICE_TYPES`); **never inline
   the list**, that is precisely how it falls behind
4. the app-level validator (`validation.ts`, `PermissionService.ts`, …)
5. run `npm run verify:runtime` and watch phases 5 and 6
