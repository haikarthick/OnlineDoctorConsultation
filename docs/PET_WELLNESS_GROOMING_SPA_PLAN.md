# Pet Wellness, Grooming & Spa Services — Final Updated Plan (v2)

> Status: PLAN ONLY — no code written. This supersedes the raw functional scope by layering
> industry research, a platform-native innovation moat, a fact-checked integration map with the
> existing modules, an elegant multi-device/multi-language UX spec, and a dark-launch phased roadmap.
>
> Fact basis: every "reuse module X" claim below was checked against the current codebase
> (payment services dir, `bookings`/`payments`/`invoices` tables in `docker/init.sql`, the 4-file
> permission system, `master_*` tables, 6-locale i18n, `modules.css` design system). Where a detail
> comes only from memory notes (possibly stale), it is marked **(confirm at build)**.

---

## 0. TL;DR — what changes vs the raw scope

The raw scope describes a competent, standalone grooming marketplace (essentially "MoeGo + Rover for
our users"). That alone does **not** differentiate us — MoeGo, Gingr, Rover, Barkbus and, in India,
HUFT / Vetic / Supertails already do booking + payments + report cards well.

**Our unfair advantage is that this platform already owns the rest of the pet's life** — vet
consultations, medical records, pharmacy, marketplace, payments/GST, 6-language reach. The updated
plan reframes grooming from "another vertical" into **the highest-frequency touchpoint of a connected
pet‑care graph**, then adds a focused innovation layer on top of the raw scope. Grooming happens every
4–8 weeks; consultations happen rarely. Grooming is therefore the *retention engine* that feeds the
higher-margin medical + pharmacy + marketplace modules.

Seven differentiators, each built from modules we already have:

1. **Care‑continuum escalation** — a groomer who spots a lump/wound/parasite escalates in one tap into
   a *pre‑filled vet consultation* (photos + notes attached). No competitor can do this because they
   don't own the vet side.
2. **Wellness signals feed the pet health timeline** — a structured, non‑medical **S.C.E.N.T. check**
   (Skin, Coat, Ears, Nails, Teeth) captured at every groom becomes preventive‑care data on the pet
   record (with consent), surfacing "time to see a vet" nudges.
3. **Portable Grooming Passport** — unified per‑pet grooming history across *all* providers, owned by
   the pet owner. A switching moat + network effect.
4. **Transparent variable‑price approval** turned into a signature UX — photo + reason + price delta +
   one‑tap approve, settled in‑app. Kills the #1 grooming trust problem (surprise charges).
5. **Smart guided pre‑visit intake (human‑in‑the‑loop)** — photos + questionnaire the groomer reviews to
   pre‑approve add‑ons before the visit. **No paid/server AI** (verified infeasible on free hosting); the
   intelligence is guided UX + the human groomer, with an optional zero‑cost client‑side hint model later.
6. **Live mobile‑groomer tracking + Grooming Report Card** — reusing our existing realtime socket layer
   and media pipeline; the report card is a beautiful, shareable branded artifact.
7. **Wellness membership** (Scenthound‑style routine‑care plan) — the eventual glue between grooming and
   preventive vet care. **Deferred past R1** (needs a reliable provider base + escrow model first); R1 is
   pay‑per‑booking.

---

## 1. Industry research digest

### 1.1 Who does what today

| Player (segment) | Strengths we should match | Gaps we can exploit |
|---|---|---|
| **MoeGo, Gingr, DaySmart Pet, Pawfinity** (grooming/boarding SaaS) | Drag‑drop calendar, online booking, deposits/no‑show protection, two‑way SMS, report cards, waitlist auto‑fill, digital agreements | Provider‑side only; no consumer marketplace; **no vet/medical continuity**; weak in India (no UPI/GST/vernacular) |
| **Rover, Wag!, Petbacker, Pawshake** (pet‑service marketplaces) | Discovery, verified profiles, trust & safety, insurance, photo updates, in‑app chat, transparent reviews | Grooming is thin; no clinical layer; no India GST/tax invoicing; commission model only |
| **Barkbus, Aussie Pet Mobile, Zoomin** (mobile grooming) | Premium van experience, live ETA, recurring plans, groomer profiles | Single‑market ops; no platform ecosystem; no medical escalation |
| **Scenthound, Woof Gang** (membership wellness) | Subscription routine care, **S.C.E.N.T. wellness scoring**, high retention | Not a marketplace; not multi‑provider; US‑only |
| **HUFT, Vetic, Supertails, Petsy, Justdogs, DCC, Wiggles** (India retail + grooming + vet) | Doorstep grooming, retail cross‑sell, WhatsApp booking, membership, some in‑house vets | Closed ecosystems (own stores only); not an open provider marketplace; fragmented booking/records |

### 1.2 What the market has converged on (table stakes we must ship)

- Online, real‑time slot booking with deposits and clear cancellation policy.
- Two‑way messaging + automated reminders; **WhatsApp is the dominant channel in India**.
- Digital consent/waivers (handling, tools/products, photography, emergency contact).
- Before/after **report cards** with photos.
- No‑show / late‑cancel protection tied to deposits.
- Verified provider profiles + verified‑booking‑only reviews.
- Mobile/home grooming with live ETA.
- Transparent pricing incl. a clean flow for on‑site "extra work" approval.

### 1.3 Where everyone is still weak (our opportunity)

1. **No continuity with medical care** — grooming apps are islands. We are not.
2. **Surprise charges erode trust** — variable pricing is handled badly (verbal, post‑hoc). We make it a
   documented, pre‑approved, in‑app flow.
3. **Wellness data is thrown away** — groomers see the pet's skin/coat/ears/nails/teeth more often than
   any vet, yet none of it is recorded structurally. We capture it as preventive signal.
4. **India localization is shallow** — few do true vernacular + UPI + GST‑compliant invoicing. We already
   have 6 locales, Razorpay, and a GST invoice engine.
5. **Fragmented per‑pet history** — owners can't carry grooming history between providers. We give them a
   portable passport.

---

## 2. Positioning & product principles

- **"Grooming that keeps your pet healthy, not just clean."** Wellness‑forward, not just cosmetic.
- **One pet, one record.** Grooming, medical, pharmacy, and purchases live on a single pet timeline.
- **No surprises.** Every rupee is shown, consented, and pre‑approved before work continues.
- **Provider‑friendly.** A groomer/clinic runs their whole day (schedule, staff, resources, payouts) in
  one place; the marketplace brings them demand.
- **Safety first, medical stays medical.** Groomers never diagnose/prescribe; the platform routes real
  problems to a licensed vet in one tap.
- **Strictly separate from network hospitals.** This is a *platform‑level* marketplace. It must have
  **zero** integration with the isolated network‑hospital tenants (see §5.6) — the same hard boundary the
  payment module already enforces.

---

## 3. Scope (refined from the raw doc)

The raw functional scope (service categories, users, onboarding, owner journey, payments, ops workflow,
safety, cancellations, follow‑up, reports, first‑release boundaries, acceptance) is **adopted as‑is** and
enhanced by §§4–11 below. Only the deltas are called out here.

### 3.1 Deltas & clarifications to the raw scope

- **Service categories** become **admin‑managed master data** (see §6.2), not a hardcoded list — so ops
  can add "puppy first groom", seasonal packages, breed‑specific services without a deploy, each with
  per‑locale labels. (Mandatory per the platform's master‑data rule: master‑linked fields are always
  pickers, never free text.)
- **"Add‑ons", "packages", "memberships"** are modeled as first‑class priceable items with tax treatment,
  reusing the payment module's commission + GST snapshot logic.
- **Wellness / S.C.E.N.T. check** is added to the intake + completion workflow as a structured,
  non‑medical observation set (differentiator #2).
- **Report Card** is added as a first‑class completion artifact (differentiator #6).
- **Membership / prepaid packages are DEFERRED past R1 (owner decision 12.4).** Rationale: with no
  reliable provider base yet, taking prepaid money before providers reliably show up at the scheduled time
  is a refund/liability trap. R1 = **pay‑per‑booking only**, but with **all per‑booking payment modes**
  offered (full / deposit+balance / variable‑price top‑up) — provider's choice per service, nothing
  restricted.
- **Prepaid ownership (when eventually built) — recommended model:** the **platform is Merchant of Record
  and holds prepaid funds as an escrow / deferred‑revenue liability, releasing to the provider per
  completed service, with mandatory refund‑to‑source for unused balance** (consistent with the existing
  payment module's MoR + closed‑system‑wallet design). Provider‑owned prepaid is **not** recommended (if a
  provider vanishes, the owner's only recourse is the provider — brand‑damaging). **Indian‑law caveat:** GST
  on advances **for services is due at receipt** (unlike goods), so a prepaid package creates a GST liability
  before delivery — another reason to defer until an escrow model + CA sign‑off exist.
- **Provider reliability (R1, addresses the no‑show concern directly):** provider confirmation SLA +
  provider‑cancel penalty/goodwill **funded from the provider's own earnings** (the payment module's
  "at‑fault party bears the cost" invariant) + a reliability score surfaced in discovery. This makes
  scheduled‑time reliability enforceable *without* prepaid.
- **Cash/off‑platform excluded** in R1 (matches raw scope and the payment module's merchant‑of‑record
  design).

---

## 4. The innovation layer (the moat) — detailed

Each item lists the **existing module it reuses** so it is cheap to build and impossible for standalone
competitors to copy.

### 4.1 Care‑continuum safety escalation  *(reuses: consultations + bookings + media)*
When staff hit a safety trigger (wound, parasite, distress, suspected medical issue, sedation request),
a **"Pause & escalate"** action:
- records the issue + photos on the service order,
- notifies the owner,
- offers **one‑tap "Book a vet consult"** that deep‑links into the existing booking flow **pre‑filled**
  with the pet, the incident summary, and the intake photos.
Groomers cannot record diagnoses/prescriptions/medical claims (enforced in permissions, §5).

### 4.2 S.C.E.N.T. wellness check → pet timeline  *(reuses: medical‑records/pet timeline, consent)*
A lightweight, non‑medical scorecard captured at intake and completion:
**S**kin · **C**oat · **E**ars · **N**ails · **T**eeth, each rated (good / watch / vet‑advised) with an
optional note + photo. Aggregated into a **Wellness Trend** on the pet profile (with owner consent).
"Vet‑advised" on any item surfaces a soft nudge that links to §4.1. This is *observational only* and is
clearly labeled non‑diagnostic.

### 4.3 Portable Grooming Passport  *(reuses: animals/pets, media, invoices)*
Per‑pet, cross‑provider history: services, providers, before/after photos (consented), invoices, wellness
trend, allergies/handling notes, and rebooking cadence. Owner‑owned; a new provider can (with owner
consent) see the passport at intake — no re‑explaining the anxious labradoodle every time.

### 4.4 Transparent variable‑price approval  *(reuses: payment orchestrator + wallet + invoices)*
Signature UX for on‑site extras (severe matting, added service): staff compose **reason + photo + revised
line items + delta**; owner gets a push/WhatsApp with a single **Approve & Pay** (or **Skip add‑on**)
button; the additional charge is collected through the existing gateway/wallet; work resumes only after
approval. Every delta is itemized on the final GST invoice.

### 4.5 Smart guided pre‑visit intake — human‑in‑the‑loop  *(reuses: media pipeline; NO paid/server AI)*
**Owner decision 12.5: no paid AI, and — verified — no viable free AI on current hosting** (Render free
tier is 512MB RAM per `vite.config.ts`; server‑side model inference is infeasible and no ML dependency
exists; free‑tier hosted vision APIs become paid at scale). So the "intelligence" is guided UX + the human
groomer, not a model:
- At booking/check‑in the owner uploads coat photos + answers a short structured questionnaire (coat
  condition, matting, last groom, sensitivities).
- The **groomer reviews the photos and pre‑approves add‑ons before the visit** (deshedding, dematting), so
  extras are agreed up front — cutting on‑site surprises without any AI.
- Any suspected wound/parasite the groomer spots routes to §4.1. Never auto‑charged; never a medical claim.
- **Optional, later, zero‑cost:** a lazy‑loaded **client‑side** (in‑browser) model for *non‑medical* hints
  only (e.g., coat‑type suggestion) — runs on the user's device, no hosting cost, behind
  `grooming.clientHints.enabled`, as its own Vite chunk to respect the bundle budget.

### 4.6 Live mobile‑groomer tracking + ETA  *(reuses: existing socket.io realtime layer)*
For home/mobile service: "en route → arrived → in service → on the way back", with live ETA and a map.
The same socket channel powers the owner's status timeline for in‑clinic jobs.

### 4.7 Grooming Report Card  *(reuses: media, invoices, follow‑up/notifications)*
On completion: before/after photos, services done, products used (allergy transparency), S.C.E.N.T.
summary, aftercare tips, and rebooking CTA — a clean, branded, shareable card. Doubles as a marketing
asset (owners share it) and a review prompt.

### 4.8 Predictive rebooking + smart ops  *(reuses: notifications, scheduling)*
- **Cadence engine**: recommended rebooking interval per breed/coat/service (e.g., Poodle full groom
  ~4–6 weeks); auto‑reminders + one‑tap rebook.
- **Waitlist auto‑fill** on cancellations; **no‑show risk score** drives deposit size (new vs repeat
  customer).
- **Route optimization** for mobile grooming across travel zones.
These are additive polish (Phase 4+), not R1 blockers.

### 4.9 Multi‑channel communications — all channels (owner decision 12.6)  *(reuses: 6‑locale i18n)*
Because grooming is a **paid** service, it gets proper communication on **all** channels, not email‑only.
**Verified:** `EmailService` (nodemailer/SMTP) + `NotificationService` + a `notifications` table already
exist → in‑app + email are available today. SMS + WhatsApp are **new paid external integrations** (SMS via
MSG91/Twilio; WhatsApp Business API via a BSP — Gupshup/Twilio/Meta Cloud API) — accepted since this is a
paid service.
- A **multi‑channel notification layer**: in‑app + email always; SMS + WhatsApp when configured.
- Per‑user **channel + language preference**; localized templates for the full lifecycle (booking,
  en‑route, approval request, ready‑for‑pickup, report card, rebooking).
- Channel credentials are **admin‑managed and encrypted**, mirroring the `payment_gateway_credentials`
  pattern (never in source; rotatable from Admin UI). UPI via the existing Razorpay adapter.

---

## 5. Integration map with existing modules (fact‑checked)

> This is the heart of "must work nicely with all existing modules." Each row is grounded in code that
> currently exists.

### 5.1 Payments, commission, payout, GST  *(reuse — do NOT rebuild)*
Verified: `backend/src/services/payment/` contains `PaymentOrchestrator`, `EarningsService`,
`WithdrawalService`, `InvoiceService`, `ReferralService`, `PaymentModuleConfig`,
`PaymentCredentialsService`, and `gateways/` (Demo + Razorpay). Tables `payments`, `invoices`,
`doctor_earnings`, `withdrawal_requests` exist in `init.sql`.

Plan:
- Reuse `PaymentOrchestrator` for the grooming order's pay‑at‑booking / deposit / balance / variable‑price
  top‑up lifecycle. Add grooming order states mirroring the booking pattern (`payment_pending`,
  `payment_expired`).
- Reuse commission (global % + flat, provider override, **snapshotted at payment time**).
- **Earnings ledger is SEPARATE — do NOT generalize `doctor_earnings` (owner decision 12.2).** Build a
  dedicated `grooming_earnings` ledger + its own settlement pipeline, *copying the mechanics* (clearing →
  available, TDS 194‑O, clearance window, min‑withdrawal) but never touching `doctor_earnings`.
  Rationale: consultation and grooming have different clearance windows, refund/dispute periods, and
  commission; a shared ledger makes settlement/reconciliation and payouts hard and error‑prone. Two
  ledgers, two settlement runs, clean books.
- **Settlement is MANUAL in R1 — NO escrow / split‑settlement product (owner decision, cost).** Verified
  this matches the *existing* consultation module, which already settles manually (`EarningsService` ledger
  + admin‑triggered `WithdrawalService`), not via escrow. Grooming money flow: platform collects via
  Razorpay into its own account (Merchant of Record) → `grooming_earnings` tracks each provider's dues
  (clearing → available after the refund/dispute window) → an **admin reconciles and pays out manually**
  (UPI/bank transfer) and records the reference. Cheap, controllable, and consistent with consultations.
- **Settlement/reconciliation screens to build (R1):**
  1. **Provider earnings ledger** — per provider: gross, commission, tax, refunds, net owed, clearing vs
     available.
  2. **Reconciliation dashboard** — match collected payments ↔ completed orders ↔ commission ↔ provider
     dues ↔ payouts made; flags mismatches/aging.
  3. **Settlement / payout management** — admin queue of "available to pay", mark‑as‑paid with reference +
     date, batch view, payout history.
  4. **Payment reminders** — owner reminders (deposit/balance due), admin reminders (pending payouts, aging
     dues) over the multi‑channel layer (§4.9).
  5. **Provider statement** — downloadable periodic earnings/settlement statement per provider.
- Reuse `InvoiceService` **but as a separate invoice stream** with its own FY numbering series/prefix
  (e.g., `GRM/2026-27/…`). Raw scope requires grooming billing to be separate from consultation invoices;
  the invoice engine already runs *dual* GST streams, so this is a third series, not new machinery.
- Honor the **CORE INVARIANT**: platform never bears cost — commission is its only revenue; every gateway
  fee/goodwill is charged to the at‑fault party; customer UI shows one generic "cancellation processing
  charge" line, never itemized commission/gateway.
- GST rate is admin‑configurable and snapshotted at invoice time (grooming is a *taxable* service, unlike
  GST‑exempt consultation — **CA to confirm rate/SAC code**).
- Everything ships behind a `grooming.enabled` setting (default false), exactly like `payment.enabled`.

### 5.2 Roles & permissions  *(the 4‑file sync rule — highest‑risk area)*
Verified rule: any role/permission/nav change MUST update all four atomically —
`backend/src/services/PermissionService.ts`, `frontend/src/context/PermissionContext.tsx`,
`frontend/src/components/Navigation.tsx`, `frontend/src/App.tsx`.

**Role design DECIDED (owner 12.1) — one user must hold multiple base roles (Vet + Farmer + Spa), and the
multi‑role FOUNDATION IS ALREADY BUILT (verified — no refactor).**
- `user_roles` table (`init.sql` §46): *"secondary roles — additive, does not replace users.role"*
  (user_id, role, is_primary, granted_by…; `UNIQUE(user_id, role)`).
- Backend union: `roleMiddleware` grants access if **any** held role matches
  (`backend/src/middleware/auth.ts` ~L63‑67); route permissions are **merged across all roles**
  (`backend/src/routes/index.ts` ~L2206). Admin add/remove endpoints exist
  (`GET/POST /users/:id/roles`, `DELETE /users/:id/roles/:role`).
- Frontend union: `AuthContext.hasRole` checks all roles; `Navigation` shows a menu item if **any** role
  matches; login returns `roles[]`. `users.role` stays the PRIMARY/active role (default dashboard); the
  union drives nav + permissions.

So **Vet + Farmer already works today**, and **Vet + Farmer + Spa** = `user_roles` holds
`['veterinarian','farmer','groomer']` → all three navs + permission sets, automatically. Grooming plugs in:

- **Two new base roles `groomer` and `support`**, added to the role enums (the `user_roles` **and** `users`
  CHECK constraints, plus the `validRoles` array at `routes/index.ts` ~L2069) + the **4‑file permission
  sync**. `groomer` self‑register → `pending_approval` → admin‑verified (reuses `account_status`).
- **Grooming provider status = the `groomer` role (nav/permissions via the union) + a `grooming_providers`
  record** (the business entity) + **`grooming_provider_staff`** (invited manager/staff scoped to that
  provider, mirroring `hospital_network_members`; enforcement = holds a membership for *this* provider +
  scope: staff → only assigned jobs, manager → whole provider).
- **Veterinarian offering grooming** simply gains the `groomer` role additively + a `grooming_providers`
  record — keeps everything vet. This is the "vets have additional roles" requirement.
- **Gaining a 2nd base role**: admin‑grant works today via the existing endpoints (sufficient for phase 1).
  The role‑change flow we shipped *replaces* the primary role; a self‑serve "**add** a role" request is a
  later enhancement, not an R1 blocker.
- **Groomer safety constraint**: a `grooming_medical_write` permission is deliberately **withheld** from all
  grooming roles — groomers cannot write diagnoses/prescriptions; they can only *escalate* (§4.1).

New permission strings (added to `PermissionService.ts` + route map): `grooming_provider_manage`,
`grooming_service_publish`, `grooming_booking_manage`, `grooming_staff_invite`, `grooming_intake_write`,
`grooming_payout_view`, `grooming_admin`, `grooming_support`.

> ⚠ The remaining role work is small but still the most bug‑prone part: adding `groomer`/`support` is one
> atomic PR across the 4 permission‑sync files + the role‑enum CHECK constraints (migration **and**
> `init.sql`) + the `validRoles` array, with a checklist. The multi‑role plumbing itself is reused, not
> rebuilt.

### 5.3 Provider onboarding & verification  *(reuse: `account_status` + admin approval + consent)*
Verified: `account_status` state machine (`active`/`pending_approval`/`frozen`/`suspended`) with admin
approve/reject/freeze/suspend actions already exists; the vet flow captures license details at
registration and flips `is_verified` on approval.

Plan: reuse this exactly for providers — a provider self‑registers or is invited, lands in
`pending_approval`, submits business + legal/payout (PAN, GSTIN, bank) + service catalog, and becomes
publicly searchable only after admin verification. Reuse the versioned consent framework
(`legal_documents` + `user_policy_acceptances`) **(confirm at build)** for provider agreements and
owner‑side handling/photography/emergency consent.

### 5.4 Discovery & profiles  *(reuse: FindDoctor + Marketplace patterns + Cloudinary media)*
Verified: patient discovery (`FindDoctor.tsx`) already implements elegant card/grid/list search with slot
availability, filters, sort, and a booking deep link; the marketplace already does provider‑like listings
with Cloudinary media (multi‑image + video). Plan: build a **Find a Groomer** experience reusing the same
components, filters (service type, home/mobile, species/breed/size accepted, date/time, price, rating,
provider type), and the availability slot picker.

### 5.5 Master data & i18n  *(reuse: `master_*` tables + `resolveLabel` + 6 locales)*
Verified: `master_species`, `master_breeds`, `master_animal_classes`, `master_marketplace_categories`,
`master_marketplace_conditions` exist with per‑locale label support and a locale‑aware `resolveLabel`
resolver; 6 locale files must always be updated together. Plan: add `master_grooming_categories` (and
`master_grooming_addons`) following the exact same per‑locale pattern (new columns go in **both** a
migration **and** `docker/init.sql` `CREATE TABLE`, or pre‑push schema validation blocks the push).

### 5.6 Network‑hospital isolation  *(hard boundary — must NOT integrate)*
Verified design: network hospitals are independent SaaS tenants with zero platform booking/payment
integration; the payment module explicitly rejects bookings against `vet_hospitals.is_network_branch =
true`. Plan: the grooming module applies the **same rejection** — a network‑branch entity can never be a
grooming provider or receive grooming commission. **These files are change‑protected; the plan touches
none of them and treats them as a boundary to respect.**

### 5.7 Realtime, UX system, deployment  *(reuse)*
- Realtime status/ETA over the existing socket.io layer.
- UI strictly on the `modules.css` design system with the 4 responsive breakpoints; entity fields via
  `SearchSelect`/pickers; deep links carry record IDs.
- Vite `manualChunks` budget respected (add a `vendor-grooming` split only if a heavy dep like a map/AI
  lib is introduced) to stay under the Render free‑tier memory ceiling.

---

## 6. Data model additions (separate from consultation; mirrors existing conventions)

All new; nothing existing is altered. Names indicative; final in build.

- `grooming_providers` — provider profile (type: veterinarian/groomer/business/clinic, public profile,
  coverage, hours, species/breed/size limits, legal/payout, verification status). Keyed to `users.id`;
  a network‑branch id can never appear here.
- `grooming_provider_staff` — staff + capabilities + provider‑scoped role (invite‑based).
- `grooming_locations` — premises + mobile service areas / travel zones.
- `grooming_resources` — bookable tables, bath stations, drying cages, spa rooms.
- `master_grooming_categories`, `master_grooming_addons` — admin‑managed, per‑locale labels.
- `grooming_services` — provider's priceable services/packages/memberships: price, duration, tax
  treatment, deposit/payment rule, add‑ons, cancellation policy, pause flag.
- `grooming_orders` — the service order (owner, pet, provider, location, service items, add‑ons, status
  machine, payment linkage). **Separate lifecycle from `bookings`** (see §7).
- `grooming_order_items` — line items (service/add‑on/variable‑price delta) for precise invoicing.
- `grooming_intake` / `grooming_completion` — intake (condition, temperament, consents, before photos),
  S.C.E.N.T. check, execution notes, after photos, quality check, handover.
- `grooming_pet_profile` — grooming‑specific pet attributes (coat type/length, preference, allergies,
  handling notes) — extends the existing pet without polluting medical tables.
- `grooming_disputes` — dispute thread (reason, images, requested resolution, responses, outcome).
- `grooming_earnings` + `grooming_settlements` — **dedicated** provider earnings ledger & **manual**
  settlement records (decision 12.2 — NOT a generalization of `doctor_earnings`; copies mechanics only; no
  escrow — admin marks payouts done with a reference).
- Reuse (not recreate): `payments`, `invoices` (separate grooming series), `reviews` (add a
  `grooming_order_id` linkage / verified‑booking flag), `legal_documents`/`user_policy_acceptances`,
  `notifications` (extended to multi‑channel).
- **`grooming_services`** carries package/membership fields but **membership stays disabled in R1**
  (decision 12.4) — pay‑per‑booking only.

**Order status machine** (separate from bookings, richer for physical service):
```
draft → payment_pending → confirmed → provider_assigned → checked_in / en_route → intake_done
     → in_progress → (awaiting_approval ↔ in_progress) → quality_check → ready_for_pickup / returning
     → completed → (disputed?) → closed
   plus: cancelled_by_customer, cancelled_by_provider, no_show, expired
```

---

## 7. Bookings vs grooming orders — why separate

Verified: the consultation `bookings` table + status machine
(`pending/confirmed/cancelled/rescheduled/completed/missed`) is medical‑appointment shaped. Grooming is a
physical, multi‑step, resource‑and‑staff job with intake/execution/handover and variable pricing —
forcing it into `bookings` would corrupt both. Decision: **a dedicated `grooming_orders` lifecycle**,
sharing the *payment* and *review* rails but not the booking table. This keeps grooming/spa billing and
history cleanly separate from veterinary consultations (a hard requirement in the raw scope).

---

## 8. UX / UI specification (elegant · responsive · multilingual)

Design language: the existing `modules.css` system, all four responsive breakpoints (1200/768/640/480),
6 locales with `resolveLabel`/`t()` (no hardcoded strings, no hardcoded prices).

### 8.1 Pet owner (mobile‑first, thumb‑reachable)
- **Discover**: card grid ("Find a Groomer") — provider card shows photo, rating, price‑from, home/mobile
  badge, accepted species/size, next slot. Filters as a collapsible sheet on mobile.
- **Book (stepper)**: Pet → Provider → Service/Package → Add‑ons → Location (premises/home) → Date/Time
  slot → Handling & consent → Pay. A persistent bottom **summary bar** shows running total + deposit due.
- **Track (timeline)**: the vertical status timeline (reuse the consultation timeline component + socket),
  with live ETA + map for mobile service.
- **Approve extras**: a focused modal — photo, reason, old vs new total, **Approve & Pay / Skip** — never
  buried.
- **After**: Report Card screen (before/after, S.C.E.N.T., aftercare, invoice, review CTA, rebook).
- **Grooming Passport**: per‑pet history tab.

### 8.2 Provider / manager (dense but calm; desktop + tablet primary, mobile for staff)
- **Today board**: schedule, checked‑in pets, ready‑for‑pickup, pending‑payment, overdue — as status‑
  colored columns (reuse `STATUS_COLORS` convention).
- **Order detail**: intake → execution checklist (pending/started/completed/skipped/awaiting‑approval/
  paused) → quality check → handover, with photo capture and internal/aftercare notes.
- **Catalog & availability**: services/packages/add‑ons, resources, staff assignment, travel zones,
  pause toggles.
- **Money**: earnings ledger, payouts, invoices, refunds/disputes (reuse Finance patterns).
- **Staff mobile view**: assigned jobs, intake capture, progress updates, request‑approval.

### 8.3 Admin / support
- Provider verification queue (reuse the pending‑approval UX), category/commission/tax config, disputes,
  refunds with audit trail, fraud/risk flags, and the platform reports in §11.

### 8.4 Accessibility & polish
- Every actionable state has an explicit, translated label (no raw i18n keys — react‑i18next fails
  silently).
- Large tap targets, single‑column mobile forms with sticky footers for >3‑field modals, horizontal
  scroll contained (never body‑level), status conveyed by icon+text+color (not color alone).
- WhatsApp/email/SMS notifications localized to the owner's language.

---

## 9. Safety, consent & compliance

- **Escalation, not diagnosis** (§4.1). Permission model withholds any medical‑write capability from
  grooming roles (§5.2). All safety pauses are logged on the order.
- **Consent**: handling, tools/products (allergy transparency), photography, emergency contact — captured
  at booking and stored per order; reuse the versioned consent framework **(confirm at build)**.
- **Payments/legal — Indian rules (owner decision 12.7):** grooming is a **taxable** service (unlike
  GST‑exempt vet consultation) — GST rate **admin‑configurable and snapshotted at invoice time**, CA to
  confirm the SAC code + rate (never hardcoded, never asserted in code). Separate GST invoice series
  (`GRM/FY/…`). **TDS 194‑O** deducted on provider payouts (reuse the module's 194‑O fields). Merchant‑of‑
  record, closed‑system wallet rules, refund‑to‑source, versioned consent/agreements — all inherited from
  the payment module. **Lawyer + CA sign‑off** required before go‑live.
- **Data isolation**: provider staff see only their provider's data (scoped queries), the same discipline
  the codebase already applies to network members; verified‑booking‑only reviews to prevent review fraud.

---

## 10. Phased delivery roadmap (dark‑launch behind `grooming.enabled`)

Mirrors the payment module's proven P0–P7 dark‑launch approach. Each phase is shippable and reversible.

- **P0 — Foundations & flag**: `grooming.enabled` setting; schema (providers, services, orders, master
  categories, `grooming_earnings`/`grooming_settlements`); **add `groomer` + `support` to the role enums
  (`user_roles`/`users` CHECK + `validRoles`) and wire the 4‑file permission sync** (one atomic PR +
  checklist — the multi‑role union plumbing is reused, not built); admin verification queue. Nothing
  visible to end users yet.
- **P1 — Provider onboarding & catalog**: provider profile, legal/payout, locations, resources, services/
  add‑ons/packages, pause controls; verification → publish.
- **P2 — Discovery & booking (in‑premises), full/deposit payment**: Find‑a‑Groomer, booking stepper,
  pay‑at‑booking via the payment module, separate GST invoice stream, confirmation + timeline.
- **P3 — Ops workflow + money screens**: today board, intake (+S.C.E.N.T.), execution checklist, quality
  check, handover, report card, review + rebook; **provider earnings ledger, reconciliation dashboard,
  manual settlement/payout management, payment reminders, provider statements** (§5.1).
- **P4 — Variable‑price approval + home/mobile + live tracking**: in‑app extra‑work approval, travel
  zones, en‑route ETA over sockets.
- **P5 — Care‑continuum + passport**: one‑tap vet escalation (pre‑filled consult), wellness trend on pet
  timeline, portable Grooming Passport.
- **P6 — Cancellations/refunds/disputes**: policy engine, automatic refund calc, dispute threads, admin
  manual adjustment with audit.
- **P7 — Reports & loyalty**: provider + platform reports, predictive rebooking, waitlist auto‑fill,
  seasonal offers. (Membership/prepaid NOT here — deferred, decision 12.4.)
- **P8+ (post‑R1)**: prepaid/membership on a platform‑MoR escrow model (needs reliable providers + CA
  sign‑off), route optimization, optional zero‑cost client‑side coat hints, true auto‑debit membership.
  Multi‑channel SMS/WhatsApp lands in R1 (P2–P3) since it's core comms for a paid service, not deferred.

R1 "done" = P0–P7 (matches the raw acceptance criteria); P8 is the differentiation flywheel.

---

## 11. Reports & analytics

Adopt the raw scope's provider + platform report lists. Reuse the existing Finance Reports / admin
dashboard patterns and the same "prices/metrics from DB, never hardcoded" rule. Add two moat metrics:
**grooming→consultation escalation rate** and **wellness‑nudge conversion** (grooming customers who book a
vet after a "vet‑advised" S.C.E.N.T. flag) — these prove the care‑continuum value and cross‑sell lift.

---

## 12. Decisions — RESOLVED (owner, 2026‑07‑25)

1. **Role model — DECIDED: multi‑base‑role (Vet + Farmer + Spa), and the foundation is ALREADY BUILT.**
   Verified `user_roles` union system exists end‑to‑end (backend `roleMiddleware` + permission merge;
   frontend nav/`hasRole`). Vet+Farmer works today. Grooming adds two new base roles **`groomer` + `support`**
   to the role enums + 4‑file sync, and a `grooming_providers`/`grooming_provider_staff` capability for the
   business + staff scoping. Vets gain `groomer` additively. Admin‑grant of a 2nd role works now; self‑serve
   "add role" is a later nicety. See §5.2.
2. **Earnings — DECIDED: do NOT generalize; MANUAL settlement, no escrow.** Separate `grooming_earnings`
   ledger + its own manual settlement (matches the existing consultation module), never touching
   `doctor_earnings`. Build ledger + reconciliation + payout‑management + reminder + statement screens.
   See §5.1.
3. **Provider verification — DECIDED: admin‑approval = verified & publishable** (same as vets). See §5.3.
4. **Membership / prepaid — DECIDED: deferred past R1.** No reliable provider base yet. R1 = pay‑per‑booking
   with all payment modes, nothing restricted. When built: **platform = MoR / escrow / refund‑to‑source**
   (provider‑owned prepaid rejected); GST‑on‑advance‑for‑services caveat noted. Provider reliability handled
   via SLA + provider‑funded penalties + reliability score. See §3.1.
5. **AI intake — DECIDED: no paid AI, and verified no viable free server AI on current hosting.** Replaced by
   smart guided pre‑visit intake (human‑in‑the‑loop); optional zero‑cost client‑side hints later. See §4.5.
6. **Communications — DECIDED: all channels (in‑app + email now; SMS + WhatsApp as paid, admin‑configured
   integrations)** — proper comms for a paid service. See §4.9.
7. **GST/legal — DECIDED: implement per Indian rules** — taxable grooming GST (admin‑configurable, CA‑
   confirmed SAC/rate), TDS 194‑O, MoR, separate invoice series, lawyer + CA sign‑off. See §5.1 / §9.

**Remaining external (not code) sign‑offs before go‑live:** CA on grooming SAC/GST rate + 194‑O payout
treatment (+ GST‑on‑advance if/when prepaid is built); lawyer on provider/owner agreements; choice of SMS +
WhatsApp BSP vendors and their credentials.

## 13. Non‑goals for Release 1 (unchanged from raw scope)

Network‑hospital integration; cash/off‑platform collection; medical diagnosis/treatment/prescription/
sedation; boarding/day‑care; transport‑fleet management; insurance claims; subscription auto‑debit;
multi‑provider split orders.

## 14. Acceptance outcome (unchanged, plus moat checks)

The raw §13 acceptance flow (register → find → book → pay/deposit → track → approve extras → receive pet +
invoice + aftercare → review + rebook) — **plus**: a safety trigger escalates into a pre‑filled vet
consult, a S.C.E.N.T. "vet‑advised" flag appears on the pet timeline, and a Grooming Report Card + passport
entry are generated. Provider can run availability/staff/services/orders/payments/payout; platform safely
collects commission, handles refunds/disputes, and reports all activity — including the two moat metrics.
