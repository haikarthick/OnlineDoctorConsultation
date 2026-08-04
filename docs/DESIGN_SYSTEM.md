# VetCare Design System

**The rule: a page's visual decisions live in CSS, not in JSX.**

Every module — Consultations, Grooming & Spa, Pharmacy, Marketplace, Admin — must look like
the same product to every persona, including Admin. This document is the standard, and
`react/forbid-dom-props` in [`frontend/.eslintrc.json`](../frontend/.eslintrc.json) is the
enforcement. The standard is not advisory; new inline styles fail CI.

---

## Why this document exists

The Grooming & Spa module shipped visually inconsistent with the rest of the app. The cause was
not carelessness about design — it was that **nothing mechanically prevented drift**. `npm run
lint` passed with 651 inline styles across 95 files, so "match the other modules" was a habit
rather than a gate, and a new module built quickly had no reason to inherit it.

Habits do not survive deadlines. Gates do. That is the permanent fix.

---

## 1. Tokens — the only source of visual values

Defined at the top of [`frontend/src/styles/modules.css`](../frontend/src/styles/modules.css).
**Never hardcode a value that a token already names.**

| Purpose | Tokens |
|---|---|
| Brand | `--primary` `--primary-hover` `--primary-light` |
| Status | `--success` `--warning` `--danger` `--info` (each with a `-light` pair) |
| Neutrals | `--gray-50` … `--gray-900` |
| Radius | `--radius-sm` `--radius` `--radius-lg` `--radius-xl` |
| Elevation | `--shadow-sm` `--shadow` `--shadow-md` `--shadow-lg` |

Common mistakes this replaces:

```diff
- <div style={{ color: '#6b7280' }}>          // this IS --gray-500
+ <div className="muted-text">

- <div style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)' }}>
+ // #667eea is not in the design system at all — pick a token or add one deliberately
```

## 2. Layout & component classes — check before you invent

A large inventory already exists. Most "I need a grid here" moments are already solved:

| Need | Use | Not |
|---|---|---|
| Page shell | `.module-page`, `.module-header`, `.module-content` | — |
| Card | `.module-card`, `.card`, `.card-header`, `.card-body` | inline `background`/`border`/`padding` |
| Provider/doctor result grid | `.vet-grid` + `.vet-card` | inline `gridTemplateColumns` |
| KPI row | `.module-stats` or `.stats-grid` + `.stat-card` | inline flex/grid |
| Bookable times | `.time-slots-grid` + `.time-slot` | inline grid |
| Weekly schedule | `.schedule-grid` + `.schedule-day-card` | inline grid |
| Buttons | `.module-btn`, `.btn` (+ `primary`/`-danger`/`-sm`/`-lg`) | inline padding/colour |
| Inputs | `.module-input`, `.form-input`, `.form-group`, `.form-label` | inline width/border |
| Status pill | `.module-badge`, `.badge-*` | inline background/colour |
| Tables | `.module-table`, `.data-table`, `.data-table-container` | inline borders |
| Loading / empty | `.loading-container` + `.loading-spinner`, `.empty-state` | ad-hoc markup |
| Alerts | `.module-alert` (+ `error`), `.toast-*` | inline colour blocks |
| Modals | `.modal-overlay`, `.modal`, `.modal-header/body/footer` | inline overlays |

**Before adding CSS, grep `modules.css` for an existing class.** A near-duplicate class is drift
too — it just takes longer to notice.

## 2a. Surface-coupled classes must name and scope their dependency

Some classes are only correct on a particular background. `color: white` on a transparent field
is a *dark-surface* decision, not a hierarchy decision. A class like that, declared globally with
a context-free name, is a trap: the next person picks it for the right semantic reason
(a secondary CTA) and gets an invisible control.

That is not hypothetical. `.btn-secondary-outline` in `Home.css` was written for the hero band
and used, entirely reasonably, on a white grooming card and a light marketplace band. Default
state was white-on-white; `:hover` flipped the text to `#667eea`, so both buttons were invisible
until moused over. `npm run lint` was green — no inline styles were involved.

Two requirements, both mandatory:

1. **The name states the constraint.** Use an `-inverse` / `-on-dark` suffix. `btn-outline-inverse`
   is honest; `btn-secondary-outline` is not.
2. **The CSS is scoped to the surfaces it is valid on**, never declared globally:

```css
/* Right: typing this on a white card yields an unstyled .btn - loud, caught at once. */
.hero-section .btn-outline-inverse,
.cta-section .btn-outline-inverse { color: white; background: transparent; }

/* Wrong: applies anywhere it is typed, and fails silently when it does. */
.btn-secondary-outline { color: white; background: transparent; }
```

Scoping is the gate. It converts a bug only a human eye can catch into one the very first render
makes obvious. For a secondary CTA **on a light surface, use `.btn-outline` from `modules.css`.**

A related smell: `!important` on every property of a page-local `.btn-*` variant means no
surrounding context can ever correct it. Prefer scoping over `!important`.

## 3. Genuinely dynamic values

Some values are computed at runtime (a progress width, a chart bar height, a transform). These
are legitimate — but they still don't belong in a style object of hardcoded design decisions.
Set a CSS custom property and let the class consume it:

```tsx
// The class owns the design; JSX supplies only the datum.
<div className="progress-bar" style={{ ['--fill' as string]: `${pct}%` }} />
```

```css
.progress-bar::after { width: var(--fill); background: var(--primary); }
```

If you must use `style` for this, that single line is the only thing the eslint-disable may
cover, and it needs a comment saying why:

```tsx
{/* eslint-disable-next-line react/forbid-dom-props -- runtime-computed bar width */}
```

## 4. Hover, focus and transitions belong in CSS

Never drive presentation from React event handlers:

```diff
- onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,.12)'}
- onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
+ .provider-card:hover { box-shadow: var(--shadow-lg); }
```

JS hover handlers skip keyboard focus entirely, so they are an accessibility defect as well as a
consistency one. `:hover` and `:focus-visible` in CSS cover both.

## 5. Non-negotiables for every page, every persona

Carried over from the usability standard — Admin screens are held to these too:

- **No raw i18n keys rendered.** Every label resolves; every new key lands in all six locales
  (`en, hi, kn, ml, ta, te`). Edit `src/locales` — `public/locales` is generated.
- **Every role gets a real branch.** No persona sees an empty or dead screen.
- **Overflow protection.** Long names truncate or wrap; tables scroll inside
  `.data-table-container` rather than breaking the page.
- **Four breakpoints.** Verify at 360 / 768 / 1024 / 1440px.
- **Loading, empty and error states** use the shared classes above — not bespoke markup.

---

## 6. The ratchet — how the debt gets paid

`react/forbid-dom-props` is an **error** everywhere. The 95 files that predate this rule are
listed in the `overrides` block of `.eslintrc.json` and downgraded to a **warning**, so CI is
green today while no new violation can enter.

**The allowlist must only ever shrink.**

When you touch a file on that list:

1. Replace its inline styles with tokens and classes from §1–§2.
2. Delete the file's entry from the `overrides.files` array.
3. Run `npm run lint` — the file is now protected at error level permanently.

Never add a file to the allowlist. If a new file needs to be there, the correct fix is to write
it with classes instead.

To audit current state:

```bash
cd frontend && grep -rl 'style={{' --include=*.tsx src | wc -l   # files remaining
npx eslint src --ext .ts,.tsx                                    # must report 0 errors
```

### Known internal drift

`modules.css` is itself not fully tokenised — `.module-card`, for example, hardcodes `#e2e8f0`
and `14px` instead of `--gray-200` and `--radius-lg`. This is deliberate debt: changing it
restyles every page at once and needs its own visual review. Fix it as a dedicated change, not
as a side effect of a feature.
