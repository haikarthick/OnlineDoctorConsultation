---
name: deploy-parity-and-write-paths
description: Use whenever a change adds or renames a database column/table, changes an INSERT/UPDATE, adds a form or Save/Publish button, adds a migration, or touches error handling or the deploy scripts - and whenever a user reports a server/database error on a screen. Makes sure the DEPLOYED database matches the code and that every write path was actually executed against it, not just compiled.
---

# Deploy parity and write paths

Born from the 2026-11-19 incident: a farmer finished the whole Sell form, pressed Publish and read
`column "state" of relation "marketplace_listings" does not exist`. Every check was green because
every check ran against a database built fresh from `init.sql`; only the **deployed** database was
behind. Three independent holes lined up: the in-process migration runner looked in the wrong
folder, the deploy script tolerates a timed-out migration run, and `/health` said "healthy" anyway.

## Rules (each is enforced somewhere - the table says where)

| # | Rule | Enforced by |
|---|---|---|
| D1 | A new column/table goes in **both** `docker/init.sql` (idempotent `ADD COLUMN IF NOT EXISTS`) and a numbered `backend/migrations/NNN_*.sql`. Migration columns must be written as `ALTER TABLE t ADD COLUMN IF NOT EXISTS c ...;` so the schema contract can read and re-apply them. | `utils/database/schemaContract.ts` (boot), `tests/unit/SchemaContract.test.ts` |
| D2 | The server verifies, at every boot, that every column/table the migrations promise exists, re-applies any missing one, and reports the rest in `/health` (`schemaContract: ok|drift`, HTTP 503 on drift). A deploy with drift is unhealthy - never "healthy". | `schemaContract.ts`, `/health` in `marketplace.routes.ts` |
| D3 | After every deploy CI polls `/health`, fails on `schemaContract:"drift"`, then runs `backend/scripts/post-deploy-smoke.js`, which signs in on the **deployed** app and performs a real write (publish + delete a listing). | `.github/workflows/ci-cd.yml` Post-deploy steps |
| D4 | Every new Save / Publish / Submit button has a write-path check that executes it against a real Postgres: add it to `runtime-verify.js` (the PHASE 6d marketplace block is the template) and, if it is a headline journey, to `post-deploy-smoke.js`. "It compiles" and "unit test with a mocked database" are not evidence a write works. | `runtime-verify.js`, review |
| D5 | No technical text reaches a person. Controllers still do `res.status(500).json({error:{message: err.message}})` ~220 times, so `middleware/safeErrorResponse.ts` rewrites any SQL/stack/library message into a plain sentence + a `reference` id and logs the original. New code should still send a readable `message` itself (see `userFacing()` in `MarketplaceService.ts`). The sweep also fails if such text is rendered. | `safeErrorResponse.ts`, `SafeErrorResponse.test.ts`, sweep `error-text` |
| D5b | Hidden technical errors are never silent: each distinct one is counted in `system_error_log`; a brand-new 5xx emails `OPS_ALERT_EMAIL` at once (max 1 per 30 min) and a digest goes out daily 09:00 IST when anything is new or still happening. Full text: Render dashboard > service > Logs > search the reference id. | `services/ErrorAlertService.ts`, `ErrorAlertService.test.ts` |
| D6 | A migration failure must never be swallowed. If you touch `render-start.sh`, `migrate.ts` or `runSQLMigrations.ts`, keep: fail on a real SQL error; tolerate only "cannot reach the DB"; and rely on D2 to catch the tolerated case. | review + `pre-ship` |

## When a user reports "a server error on Save"

1. Reproduce against the **deployed** environment first (`node backend/scripts/post-deploy-smoke.js <url>`, or `curl <url>/api/v1/health` and read `schemaContract`), not locally - a fresh local DB hides drift.
2. Find which layer let it through: schema (D1-D3), missing write-path check (D4), or a technical message reaching the screen (D5). Fix the layer, then add the check that would have caught it.
3. Say plainly in the reply which environment (dev / demo / local) showed it; a local backend runs no deploy script, so restart it - boot now self-heals the schema (D2).

## Review checklist for a change that writes data

- [ ] Column in `init.sql` AND a migration (D1); `npm run schema-check` passes.
- [ ] The write ran against real Postgres in `runtime-verify.js` (D4).
- [ ] Failure of this write shows a readable, translated message (what happened / why / what next) - cause each realistic failure and look at the screen.
- [ ] If it is a headline user journey, it is in `post-deploy-smoke.js` (D3).
