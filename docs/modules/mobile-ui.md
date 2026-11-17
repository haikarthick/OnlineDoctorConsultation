# Phone-first UI: tab bar and building blocks

Shipped as Phase 2 of `docs/FARM_MANAGEMENT_PLAN.md` (2026-11-15). One shared set of phone
components for **every role** - a pattern built for one role is a shared pattern (owner rule D8/D12).
The point of this layout is that a future UI/UX change is a **one-place edit**.

## "I want to change X" - where to do it

| Change | Edit only | Notes |
|---|---|---|
| Which destinations a role sees on the phone bar | `frontend/src/navigation/bottomTabs.ts` | Lists of menu-item ids per role. First 3 usable ids become tabs (4 when the role has no "+"). |
| What the "+" offers a role | same file, `quickActions` | Empty list = that role has no "+" and gets four tabs. |
| The words under a tab | `locales/<lang>/modules/mobileUi.json` → `tabLabels.<id>` (or `tabLabelsByRole.<role>.<id>`) | Keep it short: the box is 68px at 360px wide. A test enforces ≤ 14 characters in English. Missing label = falls back to the menu's long label (works, but truncates). |
| A screen's name, path, icon or who may open it | `frontend/src/navigation/menuItems.ts` | The sidebar, tab bar and "+" sheet all read it. Permission and feature-flag filtering is in `useNavMenuItems.ts` - one place, so a hidden item is hidden everywhere. |
| Sizes, brand colour, radii, tab bar height | the token block at the top of the "PHONE-FIRST BUILDING BLOCKS" section of `styles/modules.css` | `--tap-min`, `--tabbar-height`, `--brand`, `--brand-strong`, `--sheet-radius`, `--chip-radius`, `--mobile-font`. |
| How a component looks | its classes in the same CSS section | Class names are `bottom-tab*`, `bottom-sheet*`, `action-tile*`, `choice-chip*`, `num-stepper*`, `save-state*`, `step-form*`. They are unique on purpose: the CSS scoping gate rejects clashes with page stylesheets. |
| How a component behaves | `frontend/src/components/mobile/<Component>.tsx` | Every screen that uses it changes with it. |
| Steps in a form | the `steps` array the screen passes to `<StepForm>` | Steps are data; add, remove or reorder without touching layout. |

Adding a new role: add one entry to `BOTTOM_TABS`. `bottomTabs.test.ts` fails if a role the menu
knows has no entry, if an id no longer exists in the menu, or if a tab has no short label.

## The building blocks (`frontend/src/components/mobile/`)

- `BottomTabBar` - five cells: tabs, the "+" in the middle, More. Hidden above 768px.
- `BottomSheet` - slides up on a phone, centred dialog on wide screens. Escape, backdrop and ✕
  close it; focus returns to what opened it. Sits above everything (z-index 10000).
- `ChipSelect` - tap-to-choose for ≤ ~6 options (replaces `<select>`); `variant="segmented"`.
- `NumberStepper` - big − / + buttons, quick values, digit keypad. Accepts a decimal comma.
- `DateQuick` - Today / Yesterday / other date; uses the local calendar day, never UTC.
- `StepForm` - one topic per step, progress, sticky primary button, says why it is blocked.
- `SaveState` + `useSaveAction()` (`hooks/useSaveAction.ts`) - the shared save behaviour: a second tap
  while saving is ignored (no duplicate record), a failure keeps the form filled, shows the server's
  own message and offers Retry, and a dropped connection is shown as "waiting", not as an error.

Use these instead of writing a new modal, select or save handler on a farm screen.

## Gates that keep it honest

- `i18n/numericInputs.test.ts` - every `<input type="number">` must declare `inputMode`
  (140 were missing). Use `numeric` for whole numbers, `decimal` otherwise.
- `navigation/bottomTabs.test.ts` - config vs menu consistency, all roles.
- `components/mobile/mobileBlocks.test.tsx` - behaviour of each block.
- `i18n/localeParity.test.ts` - all six locales define the same `mobileUi` keys.
- `scripts/check-css-scoping.cjs` - no clashing class names.

## Verified in a real browser (2026-11-15)

For farmer, pet owner, veterinarian and admin at 360×800: bar present, every cell ≥ 44px, no
sideways scroll, page content clear of the bar, chat bubble above the bar, the menu opens above the
bar, no label in any of the six languages needs a mid-word break, bar hidden on desktop and on the
login page. Roles not logged in during that run (hospital staff, pharmacist, groomer, corporate
admin, support) have unit-test coverage only - no seeded demo account exists for them.

## Stacking order (phone)

Tab bar 1002 · chat bubble 1003 · edit-form overlays 9998 · bottom sheet 10000. On a phone
`.layout-main` has `z-index: auto` (it used to be 1, which trapped every modal in its own stacking
context UNDER the header and the tab bar and hid a form's Save button). Keep a floating control
below 9998 or it will cover a form's primary button.

## Known limits

- Tab labels are 11.5px; some Indic words are shortened to fit (e.g. the consult tab reads "Doctor"
  in Tamil, Malayalam, Telugu). Native-speaker review of all short labels is still owed.
- The top header's ☰ and the bar's More open the same menu; the header one is left as it was.
- Phase 3 will move the animal and group forms onto `StepForm`, `ChipSelect` and `NumberStepper`;
  until then those pages keep their existing forms.
