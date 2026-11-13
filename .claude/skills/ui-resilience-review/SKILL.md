---
name: ui-resilience-review
description: Review a screen's animation/transition performance and its behavior under real-world edge-case data (long names, huge lists, missing fields, every locale) — the two things that separate a demo that looks good with clean sample data from a product that holds up for the general public. Use whenever adding or reviewing CSS transitions/animations, whenever a screen displays a list, a name, a count, or a currency figure that could come from real user data, and before shipping any screen that the general public (not just an internal demo) will use.
---

# UI resilience review

This platform is public-facing — farmers, pet owners, veterinarians, and hospital staff, not an
internal tool with curated demo data. Two kinds of bug only show up once real people and real
data hit a screen: motion that isn't actually smooth, and layouts that assumed tidy input. Both
are invisible in a quick look at a screen built with clean sample data, which is exactly why they
need a deliberate pass rather than a glance.

This complements the `ui-review` skill (design-system compliance and general visual judgment) —
use both, but this one is specifically about performance under motion and correctness under
messy data.

## Part 1 — Animation/transition performance

This app has no animation library (`frontend/package.json` has none) — every transition is plain
CSS, which is the right default per `docs/DESIGN_SYSTEM.md` §4 ("hover, focus and transitions
belong in CSS"). Keep it that way; don't reach for a JS animation library to solve something CSS
already does well. The discipline that matters is narrower than it sounds:

- **Animate `transform` and `opacity`, not layout properties.** Those two can run on the
  compositor without forcing the browser to recalculate layout on every frame; animating `width`,
  `height`, `top`, `left`, `margin`, or `padding` cannot, and will visibly stutter on a modest
  phone or laptop — exactly the hardware a lot of this app's real users are on. If a slide-in
  needs to move something, animate `transform: translateX(...)`, not `left`.
- **Never `transition: all`.** `modules.css` already has six of these (search it before adding a
  seventh) — it's an existing, not a hypothetical, risk: it forces the browser to watch every
  animatable property for changes instead of the one or two that are actually meant to move, and
  it silently starts animating a property nobody intended the moment some future change adds one
  (e.g. a JS-driven width change suddenly animates instead of snapping, because `all` was already
  there). Name the exact properties: `transition: box-shadow 0.2s, border-color 0.2s`.
- **Respect `prefers-reduced-motion`.** Nothing in this codebase currently does — that's a real,
  not hypothetical, gap. A user who's set this (often for vestibular/motion-sensitivity reasons,
  not just preference) still gets every `@keyframes` animation at full strength today. Wrap
  non-essential motion:
  ```css
  @media (prefers-reduced-motion: reduce) {
    .some-animated-thing { animation: none; transition: none; }
  }
  ```
  Essential state feedback (a loading spinner, a focus ring) can stay — the rule is for motion
  that's decorative, not motion that's the only signal something happened.
- **Motion should clarify a state change, not decorate.** Before adding a new `@keyframes` (eight
  already exist in `modules.css`), ask what state change it's communicating. If you can't name
  one, it's probably not earning its CPU cost.
- **Test on throttled hardware**, not just your dev machine — Chrome DevTools' CPU throttling
  (4x–6x slowdown) is the cheap way to see whether something that looks smooth locally will
  actually be smooth for a user on a low-end phone, which a meaningful share of this app's real
  users are.

## Part 2 — Real-world data, not demo data

`docs/DESIGN_SYSTEM.md` §5 already states the baseline rule: "long names truncate or wrap; tables
scroll inside `.data-table-container` rather than breaking the page." Before calling a screen
done, actually throw the kind of data this platform's real users will produce at it — don't just
confirm the rule exists in CSS, confirm the specific screen honors it:

- **Long names, in every script.** This app ships in six locales (`en, hi, kn, ml, ta, te`) —
  Kannada, Malayalam, Tamil, and Telugu names and labels can run meaningfully longer or render
  wider than their English equivalent for the same string. Check a name/label field with the
  longest realistic value in each locale, not just English, in every place a name is displayed:
  table cells, cards, dropdown options, breadcrumbs.
- **Large counts and lists.** This platform explicitly supports batch/herd management (see
  `docs/BATCH_ANIMAL_MANAGEMENT_PLAN.md`) — a farm can have thousands of animals under one group.
  A screen that lists or counts animals, bookings, orders, or records needs to hold up at
  realistic scale, not just the 3-5 rows a demo account has. Check pagination actually engages,
  not just that the table renders N rows without virtualizing or paginating them.
- **Large currency figures.** Payments and invoices are in INR; a commercial farm's invoice total
  can run to 7+ digits. Check that currency displays don't wrap awkwardly, truncate a digit, or
  break a card's layout at that width.
- **Missing/optional data.** A field that's optional in the schema *will* be empty for some real
  record. Check what the screen shows when `notes`, `avatarUrl`, a secondary phone, or any other
  optional field is null — not a broken layout, not an unstyled fallback, not a raw `undefined`.
- **Empty and single-item states**, not just "full of data": a brand-new farmer with zero
  animals, a search with exactly one result, a list with exactly enough items to just barely
  trigger pagination.

## How to actually run this, not just read it

Don't eyeball it from the component code — load the real screen with data shaped like the above,
at the 360px breakpoint specifically (where overflow and long names bite hardest), with CPU
throttling on for anything animated. If you can run the app, do; see the `run` skill. State
findings concretely: which field, which screen, what breaks, not "edge cases should be handled."
