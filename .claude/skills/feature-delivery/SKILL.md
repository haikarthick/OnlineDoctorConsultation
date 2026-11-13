---
name: feature-delivery
description: The default end-to-end process for delivering any new functionality, enhancement, or module on this platform — requirements clarification, design, build, review, and ship, chained automatically so the user only has to state what they want functionally. Use this whenever the user describes a new feature, enhancement, module, or capability to add to the app (phrased as a request, a user story, or even a rough idea) — not for a one-line bug fix, a pure refactor, or a question. This is the BA→Dev→QA→Ship pipeline for this repo; don't skip phases because the request sounds simple, the phases are what catch what a simple-looking request usually hides.
---

# Feature delivery pipeline

This exists so the user can state a functional requirement and trust that requirements
clarity, design fit, correctness review, and shipping discipline all happen — without having to
separately ask for each one. Five phases, every time, scaled to the size of the request (a small
enhancement moves through all five quickly; a new module takes longer on each). Don't silently
skip a phase because the request looks simple — "add a button that does X" still has a design
phase (which existing pattern does X follow?) and a review phase (does it actually work for every
role?), even if that phase takes thirty seconds.

## Phase 1 — Requirements (BA)

Restate the request back in concrete terms before writing code: what should happen, for which
role(s), and what does success look like. Then actively surface what the request leaves unstated
— don't wait for these to surface as bugs later:

- **Which roles are affected?** This platform has 7+ roles with genuinely different screens and
  permissions (`pet_owner`, `farmer`, `veterinarian`, `admin`, `corporate_admin`,
  `hospital_staff`, `pharmacist`, plus network roles). A request phrased for one role usually
  implies a decision for the others — "hide" vs "show read-only" vs "not applicable" are
  different outcomes a requirement rarely states explicitly.
- **Does this touch a module boundary?** New capability entirely, or an addition to an existing
  one? This decides whether the `add-module` skill's scaffolding applies.
- **Does this touch multi-tenant data** (hospital network, enterprise/farm, pharmacy, animal
  group)? If so, the `tenant-isolation-review` skill's checklist is not optional later.
- **What's the edge case the happy path hides?** Empty state, the first user ever, the 5,000th
  animal, a name in Kannada script, a field that's optional in the schema. Per
  `ui-resilience-review`, these are routine for this platform's real users, not exotic.
- **Is this dark-launch-worthy?** Anything substantial ships behind a feature flag on this
  platform (`grooming.enabled`, `payment.enabled` pattern) — decide this now, not as an
  afterthought during build.

Resolve ambiguity with a reasonable, stated assumption and move on; only stop to actually ask the
user when a wrong guess would be expensive to undo (a schema/data-model decision, a security
boundary, a decision about money) — matching this session's general bias toward proceeding rather
than stalling on every small unknown.

## Phase 2 — Design

Decide the shape before writing code:

- New module → follow the `add-module` skill's conventions (own route file, controller → service
  → DB layering, feature flag, DB in both `init.sql` and a migration).
- Touches hospital-network permission/visibility code → **stop and get explicit approval first**,
  per `CLAUDE.md` and the `tenant-isolation-review` skill. This is a hard stop, not a judgment call.
- Has a UI surface → identify which existing patterns it should match (`modules.css` classes,
  which module's pages it's visually closest to) before building, not after — matching an
  existing pattern is cheaper than retrofitting one later.
- State the plan concretely enough that Phase 4's review has something specific to check against.

## Phase 3 — Build

Implement following this repo's established patterns (see `CLAUDE.md` for the directory map).
Keep the same engineering discipline used throughout this session: mechanical, verifiable
changes; no speculative abstractions; real file paths and real verification, not assumptions.

## Phase 4 — Review (QA)

Run, in order, whichever of these actually apply to what Phase 3 touched — don't skip one because
the change "looks small," small changes are exactly where a skipped review goes unnoticed:

1. **`code-review` skill** (built-in, not one of this repo's own) — correctness pass on the diff.
   Run this on every change with non-trivial logic.
2. **`tenant-isolation-review` skill** — if Phase 1 flagged multi-tenant data.
3. **`ui-review` skill** — if there's a UI surface.
4. **`ui-resilience-review` skill** — if there's a UI surface with any list, name, count, or
   animation/transition.
5. Fix what the reviews find before moving to Phase 5. A review that finds nothing worth fixing
   is a valid outcome; a review that didn't run is not.

## Phase 5 — Ship

Run the **`pre-ship` skill**. Don't report the feature done until its checklist is actually
satisfied — verification run (or explicitly not, with a reason), committed, pushed to
`origin/develop`.

## What this pipeline is not

It is not a team of independent agents working ambiently in the background — it's a checklist
this session follows for itself, every time, so the user doesn't have to re-request each phase.
For a genuinely large initiative with independent parallel pieces, the `Workflow` tool can spawn
real parallel subagents — but only when the user explicitly asks for that scale in a given
message; this skill does not invoke it on its own.
