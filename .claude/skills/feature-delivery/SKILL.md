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

## Independent agents and the ledger (owner rule 2026-11-23)

The phases below are no longer only a checklist this session follows for itself. Four project agents in
`.claude/agents/` do the parts where the builder must not mark their own work, each in its own fresh context:

| Agent | When | Output |
|---|---|---|
| `requirements-analyst` | Phase 1, before any plan is shown | grep-verified cross-module trace, use cases per role, rows in `docs/modules/<module>-ledger.md` |
| `domain-reviewer` | Phase 1 (missing species / life stages) and Phase 4 (numbers, safety, terms) | ranked findings |
| `journey-tester` | Phase 4, after build | journeys per ledger row in `runtime-verify.js`, run on a real DB |
| `completeness-auditor` | Phase 4, last | DONE / NOT DONE verdict against ledger + plan + code |

Spawn them with the Agent tool (`subagent_type` = the agent name). Independent ones may run in parallel. The owner
asked for this standing process, so this skill spawning them IS the explicit request.

**The ledger** (`docs/modules/<module>-ledger.md`, guard `frontend/src/guards/requirementsLedger.guard.test.ts`,
HARNESS H16): every requirement, cross-module link and use case is a row; rows never disappear (lock file), `Built`
Every new route or client method also ships with its screen (HARNESS H17, orphan guards); an uncalled one fails the push.
needs real evidence including a test, `Deferred` needs the owner's decision and date. A feature is reported done
only with the ledger table and the auditor's DONE verdict in the message.

**"Proceed without stopping" means don't pause for questions - it never means skip Phase 1 or Phase 4.**

## Phase 1 — Requirements (BA)

Run the `requirements-analyst` agent (and `domain-reviewer` for anything a farmer, pet owner or vet records) first;
the bullets below are what it must cover and what you check its report against.

Restate the request back in concrete terms before writing code: what should happen, for which
role(s), and what does success look like. Then actively surface what the request leaves unstated
— don't wait for these to surface as bugs later:

- **Cross-module trace — mandatory, done before any plan is presented.** The owner's basic rule
  for this application: data, functionality, look and feel and usability are seamless across
  every module, role and screen. So for every table, column, field or UI pattern the request
  touches, grep its name across `backend/src/services` and `frontend/src` and list every module
  and persona that reads or writes it (farmer, pet owner, vet consultation, prescription,
  certificates, medical records, marketplace, dashboards, analytics, hospital network, pharmacy,
  admin). State for each what changes, or why nothing does. A captured field that another
  persona needs but cannot see is a defect in the requirement, not a follow-up. "Not yet checked"
  is not an acceptable line in a plan — check it, then present.
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
- **Write the design contract (harness rule H10, `docs/HARNESS.md`) before any UI code** - four
  answers, in the plan, so the review has something to hold the result against:
  1. *Sub-views*: how does a person switch between the parts of this screen (tabs, sections,
     filters), and what is the default one?
  2. *Largest realistic data*: design for 40 animals / 200 rows / a 60-character name in Tamil,
     not the 3 in the demo. A list that can pass ~8 cards must be grouped, filtered or searchable
     **by design** - never "one long scroll" (that is exactly how Daily records shipped as one
     undifferentiated wall of cards).
  3. *Phone vs desktop*: what changes at 390px, and which shared building blocks are reused
     (`components/mobile/*`, `components/shared/*`). A new pattern goes in the shared layer.
  4. *Native controls*: any date/time/file/select styled over a native input - how does the tap
     reach the native control, and which test proves it (H7)?
- State the plan concretely enough that Phase 4's review has something specific to check against.

## Phase 3 — Build

Implement following this repo's established patterns (see `CLAUDE.md` for the directory map).
Keep the same engineering discipline used throughout this session: mechanical, verifiable
changes; no speculative abstractions; real file paths and real verification, not assumptions.

## Phase 4 — Review (QA)

Run, in order, whichever of these actually apply to what Phase 3 touched — don't skip one because
the change "looks small," small changes are exactly where a skipped review goes unnoticed:

0. **Agents** (always, for a feature / module / gap fix): `domain-reviewer`, then `journey-tester` (journeys for
   every ledger row delivered), then `completeness-auditor`. Fix what they find, re-run the auditor until DONE.

1. **`code-review` skill** (built-in, not one of this repo's own) — correctness pass on the diff.
   Run this on every change with non-trivial logic.
2. **`tenant-isolation-review` skill** — if Phase 1 flagged multi-tenant data.
3. **`ui-review` skill** — if there's a UI surface.
4. **`ui-resilience-review` skill** — if there's a UI surface with any list, name, count, or
   animation/transition.
5. **`farm-domain-review` skill** — if the feature is anything a farmer records or reads, or
   touches species/breed/class/group-type master data. Also consult it in Phase 1.
6. **`mobile-farmer-ux` skill** — if a farmer uses the screen (assume on a phone).
7. Fix what the reviews find before moving to Phase 5. A review that finds nothing worth fixing
   is a valid outcome; a review that didn't run is not.

## Phase 5 — Ship

The harness (`docs/HARNESS.md`) runs on its own at push and in CI - `tsc`, lint, every frontend
test, the whole-app browser sweep. Do not weaken, skip or add exceptions to it to get green (H11).
A **new module behind a feature flag** must also have its flag switched on in `runtime-verify.js`
PHASE 7, or the sweep never sees its screens.

Run the **`pre-ship` skill**. Don't report the feature done until its checklist is actually
satisfied — verification run (or explicitly not, with a reason), committed, pushed to
`origin/develop`.

## What this pipeline is not

It is not ambient: nothing runs in the background on its own. Each phase is started by the session doing the work,
and the agents above are spawned at the phase that needs them. What makes it trustworthy is that the agents work in
their own context, judge against the ledger rather than the builder's summary, and the ledger guard and harness
refuse silent drops and fake "Built" rows at push and in CI.
