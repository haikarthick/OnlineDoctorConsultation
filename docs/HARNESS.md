# The harness - rules that keep the whole app working

One rulebook for the **entire** application. Nothing here is about one page: every rule runs over
every route, every role and every shared control, and most of them discover new screens by
themselves. `docs/VERIFICATION.md` explains the database/runtime gate in depth; this file is the map
of everything and the rules a change must satisfy.

**Principle:** a rule that depends on someone remembering it will be forgotten. Each rule below says
what enforces it. "Process" rules are the ones a machine cannot judge; they live in the skills.

## Layers - what runs where

| Layer | Runs | Time | Blocks |
|---|---|---|---|
| Editor / `tsc` / ESLint while coding | continuously | - | nothing (feedback) |
| **Pre-push** (`backend/scripts/pre-deploy.js`) | every `git push` | ~5 min | the push |
| **CI** (`.github/workflows/ci-cd.yml`) | every push / PR | ~10-30 min | the deploy (Render deploys only after CI passes) |
| **Runtime gate** (`verify:runtime`, in CI) | every push | ~3-20 min | the deploy |
| Nightly full e2e (`e2e-full.yml`) | nightly | long | nothing (report) |

The local hook can be skipped with `--no-verify`; **CI cannot**, and it runs every check the hook
runs. So nothing reaches `vetcare-dev` unchecked.

## The rules

| # | Rule | Enforced by | Kind |
|---|---|---|---|
| **H1** | Types, lint errors and every frontend test pass. (`vite build` does **not** type-check, and the frontend tests used to run nowhere.) | pre-push: `tsc --noEmit`, `eslint --quiet`, `vitest run`; CI `frontend-test` | automatic |
| **H2** | The app builds, stays inside the bundle budget, SQL matches `init.sql`, page CSS stays in its page, every route has e2e coverage. | pre-push checks 1-4b (unchanged) | automatic |
| **H3** | Every translation key used in code exists, and all 6 languages have the same keys. | `src/guards/i18nKeysUsed.guard.test.ts` + `i18n/localeParity.test.ts` | automatic |
| **H4** | Users never see an HTTP code, raw `err.message`, `[object Object]`, `undefined` or `NaN`. | `errorMessages.guard.test.ts` (source) + sweep `error-text` (rendered) + `backend/tests/unit/userFacingText.guard.test.ts` (no ".env" / API-key / "restart the backend" wording in anything a response shows a person) | automatic |
| **H5** | **Every route renders**: no crash page, no console error, not blank, no leaked i18n key, no error text - for every role the gate can sign in as, on a phone and on a desktop. Routes are read from `App.tsx`, so a new page is covered the day it exists. | `e2e/app-sweep.spec.ts` in runtime-gate PHASE 7 | automatic |
| **H6** | **Every control works**: each tab / chip / toggle that says it is unselected changes something when tapped; every invisible native date/time field laid over a styled control opens its picker; no page scrolls sideways on a phone. | `e2e/app-sweep.spec.ts` (`did-nothing`, `picker-not-opened`, `overflow`) | automatic |
| **H7** | A shared control (`components/mobile/*`, `components/shared/*`) has a behaviour test that **performs the action** and asserts the visible result. Shared patterns live in the shared layer, never as a one-page special. | `components/mobile/mobileBlocks.test.tsx` and siblings; review via `ui-review` | automatic + process |
| **H8** | **Ratchets only shrink.** Inline styles (ESLint allowlist), unscoped CSS (`css-scoping-allowlist.json`), and known sweep problems (`e2e/sweep-known-issues.json`) may lose lines, never gain them. Fixing one means deleting its line. | each file's own check | automatic |
| **H9** | A change touching DB, routes or auth runs against a real Postgres and a real booted server. | runtime gate (`docs/VERIFICATION.md`) | automatic |
| **H9b** | **No SQL schema error may appear in the server's own log during the whole run.** A query naming a column that does not exist is usually caught and swallowed (a `try/catch` that returns an empty value) or becomes a vague 500, so no screen-level check sees it. The gate reads the server log after driving every screen as every role, and PHASE 6c has a seeded farmer ask the AI assistant about an animal. | runtime gate PHASE 6c + PHASE 8 | automatic |
| **H10** | **Design contract before code** for any screen: what the sub-views are and how a person moves between them, the largest realistic data size (40 animals, not 3), what changes on phone vs desktop, which shared controls it reuses. A list that can grow past ~8 cards must be grouped or filterable *by design*. | `feature-delivery` skill, Phase 2 | process |
| **H11** | A red check is fixed, not bypassed: never `--no-verify`, never loosen or delete a check to get green, never add to a ratchet without the owner's say-so. A check that cannot run must **fail**, not skip silently. | `pre-ship` skill; review | process |
| **H12** | "Done" for a UI change means the sweep ran green (or its new findings are explained) and the screenshots/behaviour were looked at - not just that unit tests passed. | `pre-ship` skill | process |

### Existing rules this file folds in (nothing was dropped)

- "Users never see error codes" - CLAUDE.md + `feedback-usability-standards` §0 -> **H4**
- Master-data pickers, `resolveLabel`, species-name rule -> unchanged, reviewed by `farm-domain-review`
- Inline-style ban + legacy allowlist, CSS scoping -> **H2/H8**
- Route split, i18n split, `add-module` scaffolding -> unchanged; the sweep now covers whatever they add
- Runtime verification, drift check, retiring self-heal -> **H9**, unchanged in `docs/VERIFICATION.md`

## How the sweep decides

For each role x viewport it opens every static route in `App.tsx` and, on each, runs the page
checks (`crash`, `console-error`, `blank`, `raw-i18n-key`, `error-text`, `overflow`), then taps up to
12 tab-like controls, re-running the checks after each tap (a tab is a different screen), and
clicks every invisible date/time overlay to confirm a calendar opens.

- A page the role may not open is fine **if it explains itself** (`AccessProblem`); being sent to
  sign-in means the sweep's session broke and is reported.
- Roles: farmer and pet owner are registered by the spec; veterinarian, corporate admin and admin
  are prepared by `runtime-verify.js` (which can activate accounts in the database) and passed in
  as `SWEEP_ACCOUNTS`. A role with no account is skipped and says so.
- Flags the sweep turns on so flag-gated screens are exercised: `grooming.enabled`,
  `farm.records.enabled`. **When a new module ships behind a flag, add the flag in
  `runtime-verify.js` PHASE 7**, or the sweep tests a smaller app than production runs.
- Output of each run: `frontend/test-results/app-sweep-<role>-<viewport>.json`.

### When the sweep reports a new problem

1. Fix it. That is the normal case and the point.
2. Only if it demonstrably existed before the sweep and cannot be fixed now: add its key to
   `e2e/sweep-known-issues.json` **with the owner's approval** and a tracking note in the commit.
3. Never widen the sweep's ignore lists to make a real error disappear.

## Harness engineering lessons (read before changing `runtime-verify.js` or the sweep)

Each of these cost hours to find; each looked like "the app is broken" and was not.

1. **Never wait synchronously while the server is up.** `runtime-verify.js` reads the server's console
   through pipes drained by event handlers. `execFileSync` freezes that draining; after ~64KB of request
   logging the server blocks on its next log line and every request hangs. Use `runAsync()`.
2. **The API rate limiter answers a whole-app sweep with 429s.** The gate lifts it for the verification
   run only (`AUTH_/API_/SENSITIVE_RATE_LIMIT_MAX`); production defaults are unchanged.
3. **One browser worker.** Three at once starved the throwaway Postgres on Windows (a trivial query took
   7s). `VERIFY_E2E_WORKERS` exists to experiment; the gate default is 1.
4. **Scope control-tapping to the page** (`.layout-content`). The app shell is identical on every route;
   tapping it everywhere made one role take 16 minutes instead of 2.
5. **Develop a spec against a held stack:** `VERIFY_HOLD=1 VERIFY_E2E_GREP="<one test>" node
   backend/scripts/runtime-verify.js` keeps Postgres + server up (details in `%TEMP%/vetcare-verify-hold.json`),
   then run Playwright by hand with `E2E_BASE_URL`, `SWEEP_ACCOUNTS`, `SWEEP_ROLES`, `SWEEP_ROUTES`.
   Release with `%TEMP%/vetcare-verify-release`.
6. **Git Bash rewrites arguments that start with `/`** (`/dashboard` became a Windows path). Set
   `MSYS_NO_PATHCONV=1` when passing routes to the sweep from a shell.

7. **A swallowed error is invisible to every other check.** `buildUserContext()` caught its own SQL error and
   returned an empty string, so the AI assistant answered knowing nothing about a user's animals while
   `tsc`, the schema check (it only reads `INSERT` lists) and every screen stayed green. Prefer logging at
   `error` level and failing loudly; PHASE 8 exists because a `warn`-and-continue hides exactly this.
8. **Anything sent to an outside provider must be bounded.** Prompt data had no size limit; a provider
   refuses an oversized request and the person gets no answer. Cap per section and overall.

## What the harness cannot see (honest list)

- Whether a screen is *good*: colour choice, hierarchy, wording. `ui-review` and a human look cover that.
- Real-device behaviour: the native date picker UI itself, keyboards, camera, push notifications.
  The sweep proves the app *asks* the browser to open the picker, not how a given phone draws it.
- Money: real payment gateways, GST maths against real invoices - covered by their own module checks.
- Long-lived data: a production database's contents. The gate runs on a seconds-old database.
- Other languages' text length: the sweep runs in English. Long Tamil/Malayalam strings are a
  `ui-resilience-review` item until a per-locale sweep is added (planned next step).
- Time: the full sweep is ~15 minutes (5 roles x 2 viewports x ~98 routes). That is why the gate runs it
  once per push in CI rather than per commit.
- Roles with no gate account: `hospital_staff`, `pharmacist`, `groomer` need invites or a flag; their
  screens are covered by the nightly full suite, not the sweep.

## Adding to the harness

- New rule that can be a static scan of source -> a `*.guard.test.ts` in `frontend/src/guards/`
  (auto-run by vitest). Prove it can fail: plant a violation, watch it go red, remove it.
- New rule about rendered behaviour -> a check in `e2e/app-sweep.spec.ts`, so it applies to every page.
- New shared control -> a behaviour test next to it (H7).
- Never a check for "one page". If it is worth guarding there, it is worth guarding everywhere.
