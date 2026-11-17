---
name: mobile-farmer-ux
description: Phone-first build and review rules for any screen a farmer uses — one-thumb reach, tap-not-type entry, cards instead of tables, short step forms, sensible defaults, and offline-safe saving. Use whenever building or changing a farm-management screen or form, whenever a screen will mostly be used on a phone, and before shipping any farmer-facing UI. Complements ui-review (design system) and ui-resilience-review (motion, messy data); this one is about speed and ease of entry on a small, cheap Android phone held in one hand.
---

# Mobile farmer UX

The farmer has no laptop. They have a mid-range Android phone, often poor signal, sometimes wet or
dirty hands, and are standing next to the animal. If recording something takes longer than writing
it in a notebook, they will use the notebook. Design the phone screen first; the desktop layout is
the same screen with more room, not the other way round.

Functional twin: `farm-domain-review`. Run both on any farm screen.

## The one test that matters

**Count taps and typed characters for the commonest task on the screen.** Targets:

- Record today's milk for one cow: ≤ 4 taps, digits only.
- Record an event (heat, insemination, calving, treatment, death, sale): ≤ 5 taps.
- Register a new animal: ≤ 6 required fields on the first step; everything else optional, later.
- Find an animal: type or scan the tag number, or 2 taps from the group.

Write the count in the review. If it misses the target, the screen isn't done.

## Layout

- **Bottom tab bar, at most 5 items**, each an icon plus a label, for the farmer role on phone
  widths. The long sidebar stays for desktop and lives under "More" on phone.
- **Primary action in the bottom third** of the screen, full-width, within thumb reach. Never a
  small button top-right.
- **Touch targets ≥ 48×48 px** with ≥ 8 px between them (Apple HIG says 44 pt, Material 48 dp —
  use the larger).
- **Lists are cards, not tables,** below 768 px: animal name/tag large, 2–3 key facts, one clear
  tap target. No horizontal scrolling for primary content.
- **Forms are bottom sheets or full-screen steps,** never a wide multi-column panel. One topic per
  step, progress visible, Back never loses what was typed.
- Body text ≥ 16 px (also stops iOS zooming on input focus). Respect safe-area insets.

## Entry: tap, don't type

- Choices with ≤ 6 options are **chips/segmented buttons**, not a `<select>`.
- Long lists (breeds, animals) are a **searchable picker** with the farmer's recent and most-used
  values first.
- Numbers use `inputMode="decimal"` or `"numeric"` so the digit keypad opens. Offer **stepper
  (+/−) or quick-value chips** for small quantities like litres. (As of 2026-11-14 the codebase
  has 142 `type="number"` inputs and zero `inputMode` — don't add another without it.)
- Dates default to **today** with one-tap "Yesterday"; never make the farmer open a calendar for
  the common case.
- **Default everything inferable:** farm (if they have one), group (from where they came), species
  (from the group), session (morning/evening from the clock), unit (litres/kg).
- Ask only what this species and class needs (see `farm-domain-review` §3).
- After save: stay in flow. "Saved. Next cow?" beats returning to a list.

## Words and pictures

- Farmer's language first; every string through i18n in all 6 locales. Short, concrete verbs:
  "Add milk", not "Create production record".
- **Icon and label together, always.** Research with low-literacy rural users in India (Microsoft
  Research; VideoKheti) found icons alone or voice alone are not enough, and that deep menus and
  long scrolling lose people. Keep hierarchy shallow: any daily task ≤ 2 levels from the home tab.
- Colour never carries meaning alone; pair with an icon or word. High contrast for sunlight.
- Follow `docs/DESIGN_SYSTEM.md` §5a: the user always knows where they stand, sees the server's
  real message, and is told the next action. Blocked is not styled as an error.

## Never lose an entry

- Signal drops in a shed. A save with no connection must be **kept on the phone and sent later**,
  with a visible "waiting to send" state — not an error and not silently dropped. (As of
  2026-11-14 `frontend/public/sw.js` only caches GETs; its background-sync handler is a
  placeholder. Until an offline queue exists, at minimum keep the form filled and offer Retry.)
- Disable the save button while sending; make repeated taps harmless (no duplicate records).
- Undo for a just-saved record is better than a confirmation dialog before saving.

## Performance on a cheap phone

- First usable screen must not wait on every list. Load the Today view first, the rest lazily.
- Paginate or virtualise any list that can pass ~50 rows (herds do).
- No layout-animating transitions (see `ui-resilience-review`).

## How to review

1. Open the screen at 360×800 in device emulation with 4× CPU throttle and "Slow 4G".
2. Do the commonest task with one thumb. Count taps and typed characters; compare to the targets.
3. Switch to Tamil (or another non-English locale) and repeat; check nothing truncates or overflows.
4. Go offline mid-save. Confirm the entry is not lost and the state is honest.
5. Report the counts, what failed, and the fix. A screen that wasn't opened at phone width wasn't
   reviewed.
