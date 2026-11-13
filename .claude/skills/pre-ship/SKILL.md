---
name: pre-ship
description: The final checklist before calling any change to this app "done" — before committing, before telling the user a task is finished, or when the user asks if something is ready to ship/deploy. Covers what the automatic pre-push gates check, the one gate (runtime verification) that is easy to skip because it isn't fully automatic in your own head, and the commit/push convention for this repo. Use for backend, database, route, or UI changes — not for pure documentation edits.
---

# Before calling it done

This repo's `git push` already runs a 5-gate pipeline automatically via a pre-push hook
(`npm run pre-deploy`). You don't need to remember to run it — you need to remember that passing
it is **not** the same as the change being verified, because two of those five gates are static
and one specific kind of bug is invisible to anything static.

## The five automatic gates (for context, not action — these just run)

1. Backend build (`tsc`)
2. Frontend build + bundle budget
3. Schema validation (column names in code vs. `docker/init.sql`)
4. E2E route coverage (every route has a test)
5. **Runtime verification** — the only gate that executes anything

Gates 1–4 are static. They catch type errors, build failures, and column-name typos — they
cannot see SQL, cannot boot a server, cannot notice that startup code silently reverted a tracked
migration. A change shipped on 2026-07-27 was green on all of gates 1–4, including the migration
that caused the bug, and broke registration for every user in production. Read
`docs/VERIFICATION.md` for the full story — it's worth the few minutes, because "it compiled and
the tests passed" is exactly the confidence level that incident disproves.

## The one thing to actively remember: run it yourself before pushing

If your change touched a **database migration, a route, a constraint, or auth**, run this
yourself rather than trusting the push hook to be your first signal:

```bash
cd backend
npm run build          # gate 5 boots backend/dist — build first
npm run verify:runtime
```

It builds a throwaway Postgres the way production is built, boots the real compiled server,
re-snapshots the schema to catch drift, registers every self-registerable role, and drives the
real SPA through Playwright. Needs `frontend/dist` too if you haven't built it:

```bash
cd frontend && npm run build && npx playwright install chromium
```

Takes 2–3 minutes. If Postgres isn't on the default path: `PGBIN="<path>\bin" npm run
verify:runtime`. A missing Postgres **fails** the gate, it does not skip it — `SKIP_RUNTIME_VERIFY=1`
exists but using it should come with a reason in the commit message, not silence.

## For a UI change specifically

`tsc` and `vitest` verify correctness, not that the feature actually works or looks right. If you
can run the app, do — start it and actually click through the golden path and at least one edge
case before calling a frontend task done. If you can't, say so explicitly rather than reporting
success on the strength of a green build. See the `ui-review` skill for the visual-quality pass,
which is a separate concern from "does it function."

## Commit and push

This repo is develop-only: commit and push to `origin/develop`, never create side branches
(`copilot/*` branches belong to GitHub's own agent, not to work done here), and never push
directly to `demo` or `main` — promote `develop → demo` through the GitHub Actions workflow.
Commit after every completed, verified change rather than batching unrelated work into one
commit.

## If the change touched the network-hospital permission/visibility zone

Confirm the approval step actually happened before this point — "it passed verify:runtime" is
not a substitute for the sign-off that area requires. See the `tenant-isolation-review` skill and
`CLAUDE.md`'s note on that zone.

## Quick self-check before you report "done"

- [ ] `npm run verify:runtime` actually run (not just assumed green via the static gates), if the
      change touched DB/routes/auth
- [ ] For a UI change: ran the app and exercised it, or said plainly that you didn't
- [ ] Committed with a message describing *why*, pushed to `origin/develop`
- [ ] If this touched the network-hospital zone: approval was obtained, not assumed
