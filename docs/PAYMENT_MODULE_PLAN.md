# Payment Module — End-to-End Implementation Plan (v1)

> **Status:** DRAFT — awaiting owner review and phase sign-off
> **Date:** 2026-07-04
> **Scope:** Consultation-booking payments only (marketplace/pharmacy monetization are separate modules)
> **Verified against:** codebase audit of 2026-07-04 (payment stub, no gateway, no enforcement, dead refund logic, no earnings/settlement)

---

## 1. Where we are today (verified)

| Area | Current state |
|---|---|
| Gateway | `PaymentService` is a stub. `demo` mode instantly completes; `test`/`live` insert `processing` rows that nothing ever completes. No SDK, no webhook. |
| Patient journey | `createPayment` API exists but is **never called by any screen**. Fee is displayed at booking, never collected. |
| Enforcement | Nothing requires payment — booking confirm, consultation create, video join are all free. The one guard only blocks `status='failed'`, which no code path ever sets. |
| Refunds | Full policy engine exists in `BookingService.cancelBooking` (doctor-cancel full refund + goodwill bonus, time-based patient refund) but is dead code — no payments exist to refund. |
| Doctor earnings | No concept at all. `WalletService.credit/debit` never invoked. |
| Wallet | View-only dead-end ledger. No top-up, no spend path. |
| Amount integrity | `POST /payments` accepts any client-supplied amount; never checked against `vet_profiles.consultation_fee`. |

**What we reuse:** the `payments` table already has `payer_id`, `payee_id`, `invoice_number`, `tax_amount`, `discount_amount`; `wallet_transactions` already supports `withdrawal`; the cancellation/refund policy engine and its `system_settings` keys (`cancellation.*`) are written and tested-by-design — they just need real payments to act on.

---

## 2. Confirmed design decisions

| # | Decision | Choice (confirmed by owner) |
|---|---|---|
| D1 | Gateway | **Razorpay** behind a pluggable `PaymentGateway` adapter; existing **demo mode retained** for dev/QA (full flow works without keys) |
| D2 | Payment timing | **Pay at booking creation.** Vet decline / non-confirmation / cancellation ⇒ auto refund |
| D3 | Payouts | **Earnings wallet + manual settlement**, with: minimum-withdrawal threshold (config), **clearance window** (consultation completed + N days, default 2) before earnings become withdrawable, **admin discretionary payout** allowed anytime regardless of threshold |
| D4 | Commission | **Percentage + flat fee.** Global default in admin settings; **per-doctor override** of both components; rate **locked (snapshotted) at payment time** |
| D5 | Currency | **INR single-currency v1.** Migrate defaults from USD; multi-currency deferred |
| D6 | Retained-money split | On late patient cancel / patient no-show, doctor receives a **configurable share of the retained amount** (compensation for the blocked slot) |
| D7 | Wallet | **Both:** wallet balance usable to pay for bookings (Razorpay covers shortfall), and on refund the **patient chooses destination** — instant wallet credit or original payment method (5–7 days) |
| D8 | Tax | **Full GST module** — per-doctor GSTIN, SAC codes, invoice generation, GST reports |
| D9 | Goodwill bonus funding | **Doctor-funded** (confirmed 2026-07-05). The bonus credited to the patient on doctor-cancellation is deducted from the doctor's earnings ledger as a penalty entry. The doctor's balance **may go negative**; recovered automatically from future earnings. Platform funds nothing. |

---

## 3. Architecture overview

```
Patient/Farmer                    Platform                          Doctor
     │                                │                                │
     │ 1. Book slot ────────────────► │ booking: payment_pending       │
     │ 2. Checkout (Razorpay/wallet)  │ payment: created → pending     │
     │ ───────────────────────────►   │                                │
     │        Razorpay webhook ─────► │ payment: completed             │
     │                                │ booking: pending ─────────────►│ 3. Confirm
     │                                │ booking: confirmed             │
     │ 4. Consultation happens        │ consultation: completed        │
     │                                │ ── commission engine ──        │
     │                                │ earning: clearing (T+2d)       │
     │                                │ earning: available ───────────►│ 5. Withdraw request
     │                                │ admin settles (UTR ref)  ─────►│ bank transfer
```

**Gateway adapter contract** (`services/payment/gateways/`):

```ts
interface PaymentGateway {
  createOrder(amountPaise: number, receipt: string, notes: object): Promise<GatewayOrder>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
  verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean;
  refund(gatewayPaymentId: string, amountPaise: number, notes: object): Promise<GatewayRefund>;
  fetchPayment(gatewayPaymentId: string): Promise<GatewayPaymentStatus>;  // reconciliation
}
```

Implementations: `RazorpayGateway`, `DemoGateway` (auto-succeeds after simulated checkout — keeps every downstream flow testable locally and on Render free tier). Selected by `payment.gatewayMode` (`demo` | `razorpay_test` | `razorpay_live`). **Keys live in env vars (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`), never in `system_settings`.**

---

## 4. Payment lifecycle & booking-workflow integration

### 4.1 Payment status machine

```
created ──► pending ──► completed ──► partially_refunded ──► refunded
   │           │            │
   │           └─► failed ──┘ (retry allowed → new attempt row)
   └─► expired (hold window elapsed, slot released)
```

### 4.2 Booking status machine (extended)

Current: `pending → confirmed → completed | cancelled | missed | rescheduled`

New states **prepended**:

```
payment_pending ──(paid)──► pending ──► confirmed ──► completed
      │                                     │              │
      └─(15 min hold expires)─► payment_expired            │
                                        cancelled / missed / rescheduled
```

Rules:
1. `POST /bookings` creates booking as `payment_pending`, **soft-holds the slot** (conflict check already excludes only `cancelled` — add `payment_expired`), creates payment `created`, creates gateway order. **Amount is server-derived from `vet_profiles.consultation_fee`** (or `hospital_doctors.consultation_fee` when booked via hospital) — the client never sends an amount.
2. Checkout success (client callback **+ webhook confirmation**) ⇒ payment `completed`, booking → `pending`, vet notified (existing notification), patient receives receipt.
3. Scheduler job (every 5 min): payments older than `payment.holdMinutes` (default 15) still unpaid ⇒ payment `expired`, booking `payment_expired`, slot freed, patient notified with "complete payment" retry link (smart retry creates a fresh order against the same booking if slot still free).
4. **Enforcement:** consultation creation and video-session join for a booking-linked consultation require a `completed` payment (replaces today's fail-open `failed`-only check). Direct/legacy consultations without bookings stay allowed behind `payment.enforceForDirectConsultations` (default off) to avoid breaking hospital walk-in flows.
5. **Reschedule:** reschedule creates a *new* booking row — the completed payment is **re-linked** to the new booking (`payments.booking_id` updated, old link recorded in `payment_events`). No second charge.
6. **Vet decline or vet never confirms** (existing `missed_by='doctor'` detection): auto **full refund** + existing goodwill-bonus logic — now actually fires.

### 4.3 Refund & compensation matrix (single source of truth)

| Scenario | Patient gets | Doctor gets | Platform keeps | Driven by |
|---|---|---|---|---|
| Vet declines / no-show / cancels | 100% + goodwill bonus % | **−(goodwill bonus)** — penalty entry on earnings ledger; balance may go negative (D9) | nothing (absorbs only the non-recoverable gateway transaction fee) | existing `cancellation.autoRefundOnDoctorCancel`, `goodwillBonusPercent` |
| Patient cancels ≥ `patientFreeWindowHours` (24h) | 100% | nothing | nothing | existing keys |
| Patient cancels in partial window (2–24h) | `partialRefundPercent` (50%) | `compensation.doctorShareOfRetainedPercent` (default 50%) of retained | remainder of retained | existing keys + **new** key |
| Patient cancels < 2h / patient no-show | 0% | `compensation.doctorShareOnPatientNoShowPercent` (default: full net share — he showed up) | remainder | **new** keys |
| Refund after completion (dispute, within clearance window) | per admin decision | earning **reversed** from `clearing` | — | admin refund console |
| Payment hold expires | auto-void (nothing captured) | — | — | scheduler |

All compensation entries post to the doctor-earnings ledger with a `reason` type, so the doctor's statement is self-explanatory.

Refund destination (D7): patient picks **wallet (instant)** or **original method (gateway refund, 5–7 days)** at cancel time; wallet is preselected with an "instant" badge — a gentle nudge that also reduces gateway refund fees.

---

## 5. Commission engine

- Settings: `commission.defaultPercent` (e.g. 15), `commission.flatFee` (e.g. ₹20).
- Per-doctor override: nullable `commission_percent_override`, `commission_flat_override` on `vet_profiles`, editable from Admin → doctor detail. Effective rate = override ?? global.
- **Snapshot at payment time** into the payment row (`commission_percent`, `commission_flat`, `commission_amount`, `doctor_earning_amount`) so later config changes never rewrite history.
- Every change to commission config (global or per-doctor) writes an **audit log** row (who, old → new, when) — visible in the admin payments console.
- Computation: `commission = round2(gross × pct/100) + flat`; `doctorNet = gross − commission`. Validation: flat fee may never exceed gross (guard on config save and on booking of ultra-low fees).

---

## 6. Doctor earnings & settlement lifecycle

### 6.1 Ledger states

```
(consultation completed) ─► clearing ──(clear_at = completed_at + settlement.clearanceDays)──► available
                                │                                                                 │
                                └─(refund/dispute)─► reversed                    (withdrawal) ──► locked ──► withdrawn
```

- `settlement.clearanceDays` (default **2**) — your rule: settlement window opens only after successful completion + 2 days, absorbing the dispute/refund window.
- `settlement.minWithdrawalAmount` (e.g. ₹500) — doctor can submit a withdrawal request only when `available ≥ min`. The UI shows a **progress bar toward the threshold** ("₹350 of ₹500 — about 1 consultation away") instead of a disabled button, so the rule feels motivating rather than restrictive.
- **Admin discretionary payout:** admin can settle any amount for any doctor at any time (below threshold, even mid-clearing with an explicit "override clearance" confirmation). Every discretionary payout requires a note and is audit-logged.

### 6.2 Negative balance & penalty handling (D9)

- Doctor-cancellation goodwill bonus posts a **negative `penalty` entry** to `doctor_earnings` (type `penalty`, negative `net_amount`, reason = booking reference). If the doctor has no available balance, the running balance goes **negative**.
- **Recovery is automatic:** new earnings first offset the negative balance before anything becomes withdrawable — no separate collection step, no invoicing the doctor.
- Withdrawal gate becomes: `available > 0 AND available ≥ settlement.minWithdrawalAmount` (a negative or zero balance simply shows the shortfall on the progress bar: "−₹150 — clears with your next consultation").
- The doctor's statement shows each penalty with the cancelled booking it came from, so it is self-explanatory and disputable.
- Admin visibility: settlement console flags doctors with negative balances and a **deep-negative alert threshold** (`compensation.negativeBalanceAlertAmount`, e.g. −₹2,000) — a doctor repeatedly cancelling into deep negative is a churn/abuse signal that ties into the existing doctor-reliability score.
- Edge rule: penalties never touch `clearing` entries retroactively; they only affect the running balance, keeping the clearance ledger append-only and auditable.

### 6.3 Withdrawal workflow

```
doctor: request (amount ≤ available) ─► admin: approve / reject (reason)
        approved ─► admin marks settled (UTR / bank reference, date) ─► doctor notified + statement entry
```

- Requesting **locks** the amount (moves `available → locked`) so a second request can't double-spend.
- Doctor adds bank details (account/IFSC/UPI) in profile → payout details section; shown to admin on the settlement screen. v1 transfer happens outside the app (NEFT/UPI by admin); **Razorpay Route automated payouts are Phase-2+** and slot cleanly behind the same ledger.
- Innovative ease-of-use additions:
  - **Auto-request opt-in:** doctor can enable "auto-request withdrawal every time available crosses ₹X" — removes the chore entirely.
  - **Settlement calendar hint** for admin: console groups due requests and shows aging (e.g. "3 requests waiting > 5 days").

---

## 7. GST & invoicing module (D8 — full module)

**Important domain nuance (verify with your CA before build):** under GST Notification 12/2017 (entry 46), *veterinary clinic services for healthcare of animals/birds are GST-exempt*. The *platform's commission* charged to doctors is a normal taxable service (18% GST). The module therefore produces **two invoice streams**:

| Stream | Issuer → Recipient | Tax treatment (default) |
|---|---|---|
| **Consultation invoice** | Doctor (via platform, on his behalf) → Patient | Exempt by default (SAC 998351 pets / 998352 livestock); rate configurable per SAC in case interpretation differs |
| **Commission invoice** | Platform → Doctor | 18% GST on commission (SAC 998599 / configurable); generated per settlement cycle |

Build items:
- Settings: platform legal name, GSTIN, address, invoice prefix, financial-year sequential numbering (`VC/2026-27/00001`) using the existing `invoice_number` column; SAC master table with per-SAC rate (0% default for veterinary healthcare).
- `vet_profiles`: `gstin` (optional — most individual vets are unregistered), registered legal name.
- Invoice snapshot table (immutable JSON of line items, party details, tax breakup) + **downloadable PDF receipt** for patients and doctors (print-friendly HTML → browser print, consistent with existing print patterns).
- GST reports: monthly taxable-value summary of commission invoices (CSV export for the accountant), exempt-supply register for consultations. No filing integration — data out, filing stays with the CA.
- Enterprise/farmer bookings: invoice carries the enterprise legal name (farms often need books-of-account entries) — pulled from `enterprises`.

---

## 8. Database changes (migration `004_payment_module.sql`)

**`payments` (alter):** add `gateway_order_id`, `gateway_payment_id`, `commission_percent`, `commission_flat`, `commission_amount`, `doctor_earning_amount`, `wallet_amount_used`, `refund_destination` (`wallet|gateway`), `expires_at`; extend `status` CHECK with `created`, `expired`, `partially_refunded`; default `currency` → `'INR'`, default `gateway` → `'demo'`.

**New tables:**
- `payment_events` — append-only audit of every transition + raw webhook payloads (idempotency: unique on `gateway_event_id`).
- `doctor_earnings` — `id, doctor_id, payment_id, booking_id, consultation_id, gross, commission_amount, net_amount, type (consultation|cancel_compensation|no_show_compensation|penalty|adjustment), status (clearing|available|locked|withdrawn|reversed), clear_at, withdrawal_id, created_at` — `penalty` rows carry negative `net_amount` (D9).
- `withdrawal_requests` — `id, doctor_id, amount, status (requested|approved|rejected|settled|cancelled), requested_at, reviewed_by, reviewed_at, settled_by, settled_at, utr_reference, admin_note, rejection_reason`.
- `invoices` — snapshot table per §7.
- `tax_codes` — SAC master (per master-data rule: SAC on forms is always a picker, never free text).

**`vet_profiles` (alter):** `commission_percent_override`, `commission_flat_override`, `gstin`, `payout_account_name`, `payout_account_number`, `payout_ifsc`, `payout_upi`.

**`bookings` (alter):** extend status CHECK with `payment_pending`, `payment_expired`.

**`system_settings` seeds:** `payment.gatewayMode`, `payment.holdMinutes=15`, `payment.enabled=false` (feature flag — module ships dark), `commission.defaultPercent=15`, `commission.flatFee=20`, `settlement.clearanceDays=2`, `settlement.minWithdrawalAmount=500`, `compensation.doctorShareOfRetainedPercent=50`, `compensation.doctorShareOnPatientNoShowPercent=100`, `compensation.negativeBalanceAlertAmount=2000`, `tax.*` (§7), plus existing `cancellation.*` keys unchanged.

Per `database-rules.md`: UUIDs via `gen_random_uuid()`, camelCase SELECT aliases, all ledger writes inside transactions, CHECK constraints mirrored in Joi schemas. Wallet/earnings mutations use `SELECT … FOR UPDATE` (seat-limit race-condition rule from `backend-security-audit.md`).

---

## 9. Backend changes

| Component | Work |
|---|---|
| `services/payment/` (new folder) | `PaymentOrchestrator` (lifecycle + enforcement), `CommissionEngine`, `EarningsService`, `WithdrawalService`, `InvoiceService`, `gateways/{RazorpayGateway,DemoGateway}` |
| `PaymentService` | Refactor into orchestrator; keep public API compatible where used |
| `BookingService` | `payment_pending` creation path, slot-hold conflict rules, re-link on reschedule, wire compensation matrix into cancel/missed paths |
| `WalletService` | `debit` for wallet-pay (transactional, `FOR UPDATE`), refund-destination handling |
| Routes | `POST /payments/checkout/:bookingId` (creates order), `POST /payments/verify` (checkout signature), `POST /webhooks/razorpay` (**no auth middleware, signature-verified, raw-body parser**), `GET /payments/receipt/:id`, `/earnings/*` (doctor), `/withdrawals/*` (doctor + admin), `/admin/payment-settings/*`, `/admin/settlements/*`, `/admin/reports/finance/*` |
| Scheduler (`utils/scheduler.ts`) | + expire unpaid holds (5 min), + mature `clearing → available` earnings (hourly), + reconciliation sweep (daily: `pending` payments > 1h old re-checked against gateway via `fetchPayment`) |
| Validation | Joi schemas for every new route; **no client-supplied amounts anywhere** |
| Notifications | payment received (both parties), payment expired + retry link, refund initiated/landed, earning available, withdrawal status changes, admin alert on webhook signature failures |

---

## 10. Frontend changes per persona

### Pet owner / Farmer
- **BookConsultation / HospitalBooking:** new payment step after slot selection — fee breakdown card (fee, tax if any, wallet applied, payable now), wallet-pay toggle, Razorpay checkout (demo mode: simulated checkout dialog), success/failure/retry states.
- **Payments & Receipts page:** payment history (upgrade of existing list), invoice PDF download, refund status per cancelled booking.
- **Wallet page (upgrade):** balance usable at checkout, transaction list already exists; add "instant refund" badge history.
- **Cancel dialog:** shows the computed refund amount *before* confirming (policy transparency — patients see "you'll get ₹250 of ₹500 back") + refund destination choice.

### Veterinarian
- **Profile:** consultation fee (exists — verify editability), GSTIN, payout bank/UPI details.
- **My Earnings (new page):** four stat tiles (clearing / available / locked / lifetime), threshold progress bar, per-consultation statement (gross, commission, net, type — including compensation entries), withdrawal request + history, auto-request opt-in.
- **Booking cards:** paid badge; unpaid (`payment_pending`) requests visually distinct and *not confirmable*.

### Admin — new "Payments & Finance" menu group
1. **Gateway Settings** — mode switch, webhook health indicator, env-key presence check (never shows secrets).
2. **Commission Rules** — global % + flat; per-doctor override table with search; change-audit trail inline.
3. **Settlement Policy** — clearance days, min withdrawal, compensation splits, hold minutes.
4. **Tax & Invoicing** — GSTIN, SAC rates, invoice numbering.
5. **Transactions** — upgrade existing `PaymentManagement.tsx`: live status filters, stuck-payment flag, manual refund with destination choice.
6. **Settlements** — withdrawal queue (aging indicators), approve/reject/settle with UTR, discretionary payout button.
7. **Finance Reports** — see §11.
8. **Dashboard widget:** payment health (today's collections, failed webhooks, stuck `pending` count, settlements due).

### Hospital personas
Hospital-booked consultations use `hospital_doctors.consultation_fee` as the price source; revenue attribution to hospitals (hospital commission layer) is **explicitly deferred — see Open Item O1.**

All screens: 6-locale i18n keys added up-front with the mandatory audit command; 4-breakpoint responsive; no raw keys (per `feedback-usability-standards.md`). Master-linked fields (SAC, refund destination, gateway mode) are pickers, never free text.

---

## 11. Reports & dashboards

| Persona | Report |
|---|---|
| Admin | Revenue overview (GMV, commission earned, refunds out, net platform revenue — daily/monthly trend), settlement liability (owed to doctors: clearing vs available), GST/commission-invoice export (CSV), reconciliation report (gateway vs ledger mismatches), doctor-wise earnings & commission table |
| Doctor | Earnings statement (filterable, CSV export), monthly summary, commission invoices received |
| Patient/Farmer | Spend history + receipts; enterprise-level spend rollup for farm accounts |

---

## 12. Security & integrity rules (non-negotiable)

1. Amounts always server-derived; client never sends a price.
2. Webhook: raw-body signature verification, idempotent on `gateway_event_id`, replay-safe; webhook route bypasses auth middleware but nothing else.
3. Payment completion trusted **only** from webhook or server-verified checkout signature — never from a client "success" callback alone.
4. All wallet/earnings mutations in DB transactions with row locks; no read-then-write balance math.
5. `payment_events` append-only audit for every state change; commission/settings changes audit-logged.
6. Secrets in env vars only; admin UI shows presence, never values.
7. Data isolation: doctors see only their earnings; patients only their payments; existing role middleware patterns reused.
8. Feature flag `payment.enabled` — everything ships dark and is switched on per environment after verification.

---

## 13. Phased delivery

| Phase | Contents | Outcome / verify gate |
|---|---|---|
| **P0 — Foundations** | Migration 004, settings seeds, INR migration, feature flag, gateway adapter interfaces + DemoGateway | tsc clean; app unchanged with flag off |
| **P1 — Collect & enforce** | Booking `payment_pending` flow, demo checkout step in booking UI, hold/expiry job, payment enforcement, refund engine goes live (wallet destination only), receipts (basic) | Full cycle works end-to-end in demo mode incl. cancel/refund matrix |
| **P2 — Razorpay** | RazorpayGateway (orders, checkout, webhook, refunds), reconciliation job, gateway refund destination, smart retry | Test-mode Razorpay round-trip verified incl. webhook replay + signature-failure alarms |
| **P3 — Commission & earnings** | CommissionEngine, per-doctor overrides UI, earnings ledger + clearance job, doctor My Earnings page, compensation matrix wiring | Every completed/cancelled/missed scenario produces correct ledger rows |
| **P4 — Settlements** | Withdrawal workflow (doctor + admin console), discretionary payout, payout details in profile, notifications | Money-out lifecycle audited end-to-end |
| **P5 — GST & invoicing** | Invoice snapshots, PDF receipts, SAC master, commission invoices, GST exports | CA-reviewable invoice samples for both streams |
| **P6 — Reports & polish** | Finance reports/dashboards, i18n audit (6 locales), unit tests (CommissionEngine, refund matrix, ledger transitions), /verify pass, deploy checklist | Flag flipped on in dev env |

Each phase is independently committable/pushable to `origin/develop` (flag keeps prod behavior unchanged until switch-on).

---

## 14. Open items needing your confirmation

- **O1 — Hospital commission layer:** when a booking comes via a hospital, does the *hospital* take a cut of the doctor's earning (three-way split)? Deferred from v1 unless you say otherwise.
- **O2 — Existing unpaid history:** bookings/consultations created before go-live stay payment-exempt (grandfathered). Confirm.
- **O3 — Emergency-priority bookings:** same price, or allow a doctor-set emergency surcharge? (Priority field already exists.) v1 assumes same price.
- **O4 — Promo/discount codes:** `discount_amount` column exists; module designed so codes can slot into the fee-breakdown later. Deferred from v1 unless wanted.
- **O5 — GST exemption treatment** for consultation invoices to be confirmed by your CA (module defaults to exempt, rate configurable).
- ~~**O6 — Goodwill bonus funding**~~ — **RESOLVED 2026-07-05 → D9:** doctor-funded via negative penalty entry on the earnings ledger; balance may go negative and is recovered from future earnings. See §6.2.

## 15. Explicitly out of scope (v1)

Multi-currency; automated bank payouts (Razorpay Route); patient wallet top-up (wallet fills via refunds only); pharmacy/marketplace payment convergence; EMI/subscription plans; GST filing integration.
