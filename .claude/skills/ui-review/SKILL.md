---
name: ui-review
description: Review a screen, page, or component for visual quality, consistency, and polish before shipping — combining this repo's mandatory DESIGN_SYSTEM.md gates with Apple-HIG-style design judgment (clarity, hierarchy, spacing rhythm, motion, honest feedback states). Use whenever building or reviewing any new or changed UI, when the user asks to "polish", "review the design of", "make this look better/more professional", or before marking any frontend task done.
---

# UI review

This review has two layers. Layer 1 is **mechanically enforced** — if it fails, it's a bug, not
a style opinion, and CI will eventually catch it anyway. Layer 2 is **judgment** — the kind of
pass a careful designer does that no linter can, modeled on Apple's clarity/deference/depth
framing because it's a good forcing function for "does this feel considered."

Do layer 1 first. There's no point judging the polish of a screen that's about to fail the gate.

## Layer 1 — the non-negotiables (read `docs/DESIGN_SYSTEM.md` in full)

These are from that document, restated here because they're the most commonly missed:

- **No inline styles.** `style={{...}}` is an ESLint **error** except for the one genuinely
  dynamic case (a runtime-computed value fed to a CSS custom property) — and even then it needs
  an explanatory `eslint-disable-next-line` comment. If you're about to write `style={{ color:
  '#...' }}`, there is almost certainly already a token or class for it (§1–§2 of the design doc).
- **No CSS modules — every stylesheet is global.** A page's CSS file may only style class names
  it owns. Never write a selector targeting a shared class (`.btn`, `.card`, `.form-group`) or a
  bare element (`input`, `button`) without scoping it to the page's own root class via
  `:where(.that-pages-root)`. This single rule caused a real incident (a 28px-wide number input on
  the Create Enterprise screen) — read §2b before touching any page's CSS.
- **Hover/focus/transitions live in CSS**, never in `onMouseEnter`/`onMouseLeave` handlers — those
  skip keyboard focus entirely, which is an accessibility defect, not just a code-style one.
- **The user must always know where they stand** (§5a, as binding as the inline-style ban):
  - Every error path renders the *server's actual message* (`data.message || data.error?.message`),
    never a generic fallback the server didn't send.
  - A blocked-but-legitimate state (pending approval, frozen, feature not yet on) is informational
    styling, never red — red means "retrying can fix this."
  - Every blocked/empty/pending state says what happens next, including "do nothing, just wait."
  - Success is explicitly confirmed. Nobody should wonder if it saved.
- **No raw i18n keys on screen**, in any of the six locales (`en, hi, kn, ml, ta, te`).
- **Every role gets a real branch.** No persona lands on an empty or dead screen.
- **Four breakpoints**: verify at 360 / 768 / 1024 / 1440px — not just desktop.

Verify mechanically, don't eyeball it:

```bash
cd frontend
npx eslint src --ext .ts,.tsx         # must be 0 errors
npm run check:css-scoping             # the allowlist is empty and must stay empty
grep -c 'style={{' src/pages/<path-to-your-file>
```

If the file you touched is on the legacy `overrides` allowlist in `.eslintrc.json` (pre-existing
inline styles downgraded to warnings), **fix it and remove it from the list while you're there** —
the allowlist may only shrink. Never add a new file to it.

## Layer 2 — the judgment pass

Once layer 1 is clean, look at the screen the way you'd look at a shipped Apple app and ask what
it's actually doing for the user, not just whether it's technically compliant.

**Clarity.** One primary action per screen or per section — if two buttons are fighting for
attention, one of them is wrong. Hierarchy should be visible even in grayscale: size and weight
carry meaning, not color alone, because a user with color-vision deficiency gets nothing extra
from a tint. Text should be legible at a glance, not merely present.

**Deference.** The content is the product — an animal's record, a booking, an invoice — and the
UI's job is to get out of its way. Chrome (borders, dividers, background tints) should earn its
presence; when in doubt, remove a line rather than add one. Use `--shadow-sm`/`--shadow`/
`--shadow-md`/`--shadow-lg` for layering instead of inventing a one-off shadow — depth should
come from the design system's own scale, consistently, not from whatever felt right locally.

**Consistency of rhythm.** Spacing that looks "close enough" reads as sloppy once two screens sit
side by side. Check that padding/gaps on the new screen match the scale already used by sibling
screens in the same module (grep `modules.css` and the module's existing pages before inventing a
new spacing value) — this is the same principle as §1 of the design doc ("never hardcode a value
a token already names") applied to spatial rhythm, not just color.

**Motion with restraint.** Animation should clarify a state change (something opened, something
was added, focus moved here), not decorate. If you can't articulate what a transition is
communicating, it's probably noise. Respect `prefers-reduced-motion`.

**Touch and click targets.** Interactive elements should be comfortably tappable — roughly 44px
in the smallest dimension — especially in mobile-width layouts (check this at the 360px
breakpoint specifically, not just desktop with a narrow window).

**States are designed, not left over.** Loading, empty, and error states (via `.loading-container`
+ `.loading-spinner`, `.empty-state`, `.module-alert`) deserve the same care as the populated
state — they're not "the version before the real content loads," they're states real users see
constantly (a new user's empty dashboard, a network hiccup, a search with no results).

**Information density matches the persona.** An admin triage screen can be denser than a pet
owner's dashboard; a farmer managing hundreds of animals needs scannable tables, not cards sized
for five items. Don't apply one density to every role reflexively — check what that persona's
other screens already do.

## When you're reviewing someone else's (or your own past) work

State findings concretely: name the file, the rule or judgment call, and what you'd change — "the
submit button uses inline `background: '#2563eb'` instead of `.btn-primary`" is useful; "the
styling could be better" is not. Layer-1 findings are objective bugs; say so plainly. Layer-2
findings are judgment — offer them as a recommendation with the reasoning, since the person asking
may have context (a deliberate persona-specific choice) that changes the right answer.
