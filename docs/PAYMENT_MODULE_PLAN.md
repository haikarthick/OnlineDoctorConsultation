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
| D9 | Goodwill bonus funding | **Doctor-funded** (confirmed 2026-07-05). The bonus credited to the patient on doctor-cancellation is deducted from the doctor's earnings ledger as a penalty entry — **together with the non-recoverable gateway fee of the refund**. The doctor's balance **may go negative**; recovered automatically from future earnings. Platform funds nothing. |
| D10 | Referrals (confirmed 2026-07-05) | Individual-doctor referrals are **in scope** (network hospitals are a separate subscription module — out of scope). **Pre-consultation referral = payment transfer** to the new doctor with difference settlement; **post-consultation referral = informational** — patient books & pays the specialist through the normal flow. Referral history visible to all personas. See §4.4 |
| D11 | Emergency consultations (confirmed 2026-07-05) | **Doctor-defined emergency fee, opt-in.** Emergency option shown only for doctors who set the fee (existing `acceptsEmergency` flag + new fee field). Fast-track confirmation window; same commission rules. See §4.5 |
| D12 | Cost-bearing principle (confirmed 2026-07-05) | **The platform never funds anything from its own pocket — commission is its only revenue.** Every cost (gateway fees, refunds, bonuses) is borne by the party who caused it. Patient-cancel refunds deduct a **cancellation processing charge = actual gateway fee + admin-configured flat fee**, shown to customers as **one generic line item** (never broken down as "commission"/"gateway fee" in customer-facing UI) |
| D13 | GST future-proofing (confirmed 2026-07-05) | Exemption assumed today, but **rate is 100% admin-configurable** (0% default). If the government changes the rule, admin edits the rate in settings — **zero code changes**. Rates snapshot into invoices at issue time, so changes apply prospectively only |
| D14 | Go-live data policy (confirmed 2026-07-05) | **Clean start at production launch** — no grandfathering. Legacy/demo bookings, consultations and payments are cleaned by a launch-checklist script before the flag is switched on |
| D15 | Legal & consent framework (confirmed 2026-07-05) | Patient wallet operated as **closed-system PPI** (no RBI license needed; merchant-of-record T&C required) with hard invariants — no cash-out, no expiry of refund credits, refund-to-source always offered, balance returned on account closure (§16). **Versioned platform policies + recorded acknowledgement at registration/invite for all personas**, Amazon-style (§17) |

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

**Governing rule (D12): the platform never bears a cost.** Every gateway fee and every bonus is charged to the party who caused the event. The **actual gateway fee paid on each payment is stored per-payment** (`gateway_fee_amount`) — wallet-paid amounts carry zero gateway fee, so fee recovery is always exact, never estimated.

**Cancellation processing charge** (patient-caused cancellations) = actual gateway fee of the original payment **+** `cancellation.processingFlatFee` (admin-configured, e.g. ₹25). Customer-facing UI shows this as **one generic line item** — i18n key like "Cancellation processing charge" — never itemized into commission/gateway components (D12).

| Scenario | Patient gets | Doctor gets | Platform keeps | Driven by |
|---|---|---|---|---|
| Vet declines / no-show / cancels (patient chooses refund) | 100% + goodwill bonus % | **−(goodwill bonus + gateway fee of the refunded payment)** — penalty entries; balance may go negative (D9/D12) | commission = 0; fully cost-covered | existing `cancellation.autoRefundOnDoctorCancel`, `goodwillBonusPercent` |
| Pre-consultation referral (patient accepts / picks another doctor) | nothing to refund — payment **transfers** (no gateway refund, no fee incurred) | new doctor: full gross at his fee, commission at **his** rate; old doctor: nothing | normal commission on final amount | §4.4 |
| Patient cancels ≥ `patientFreeWindowHours` (24h) | 100% **− cancellation processing charge** | nothing | flat-fee component of the charge (covers admin overhead); gateway component just covers cost | existing keys + `cancellation.processingFlatFee` |
| Patient cancels in partial window (2–24h) | `partialRefundPercent` (50%) − cancellation processing charge | `compensation.doctorShareOfRetainedPercent` (default 50%) of retained | remainder of retained (gateway fee recovered from retained first) | existing keys + **new** keys |
| Patient cancels < 2h / patient no-show | 0% | `compensation.doctorShareOnPatientNoShowPercent` (default: full net share — he showed up) | remainder (after gateway-fee recovery) | **new** keys |
| Refund after completion (dispute, within clearance window) | per admin decision | earning **reversed** from `clearing`; fee borne per admin's fault ruling | — | admin refund console |
| Payment hold expires | auto-void (nothing captured, no fee exists) | — | — | scheduler |

Consistency check (D12): in every row, the platform's commission and the flat-fee component are its only inflows, and no row leaves a gateway fee unassigned. Wallet refunds bypass the gateway entirely — money stays inside the platform — so wallet-destination refunds never generate a *new* gateway cost (the original capture fee is still recovered per the rules above).

All compensation entries post to the doctor-earnings ledger with a `reason` type, so the doctor's statement is self-explanatory.

Refund destination (D7): patient picks **wallet (instant)** or **original method (gateway refund, 5–7 days)** at cancel time; wallet is preselected with an "instant" badge — a gentle nudge that also reduces gateway refund fees.

### 4.4 Referral flows (D10)

Scope note: **network-hospital referrals stay in the existing subscription-side staff-workflow module** (`referrals` table, `StaffWorkflowService`) and are untouched. This section adds **platform-level referrals between individual doctors**, reusing/extending that table (`referral_type = 'platform'`, nullable `hospital_id`, new `booking_id`, `payment_id`, `transfer_status` columns).

**A. Pre-consultation referral — payment transfer.** The booked doctor is unavailable (or any reason) *before* the consultation happens and refers the patient onward. No consultation occurred, so the doctor earns nothing and the money follows the patient:

```
Doctor initiates referral (target doctor + reason, before consultation)
        │  original booking → status 'referred'; patient notified
        ▼
Patient chooses within referral.actionWindowHours (default 72h):
  1) ACCEPT referred doctor  ── picks a slot with the new doctor
  2) PICK ANY OTHER doctor   ── same carry-over mechanics, patient's own choice
  3) REFUND                  ── treated exactly as doctor-cancellation:
                                100% + goodwill bonus; old doctor's ledger bears
                                bonus + gateway fee (D9/D12)
  (no action in window ⇒ auto-refund as option 3)
```

- **Difference settlement (confirmed):** new doctor's fee > paid amount ⇒ patient pays the difference at slot selection (normal checkout on the delta); fee < paid ⇒ excess **instantly refunded to wallet**. Final amount, not original, is the new booking's gross.
- **Commission recomputed at the NEW doctor's rate** (his override or global) and snapshotted onto the transferred payment; the old snapshot is retained in `payment_events` for audit.
- The new booking enters the normal lifecycle at `pending` (new doctor must confirm). If the new doctor declines or never confirms, the patient returns to the 3-option state above — the *original* referring doctor still bears refund costs if it ends in refund (his unavailability started the chain).
- Elegant side-effect: transfers move money **without any gateway refund**, so options 1–2 incur zero extra gateway cost.

**B. Post-consultation referral — informational + booking shortcut.** Consultation completed and paid normally (referring doctor's earning is untouched); doctor refers the patient to a specialist via the referral module. Patient books the specialist through the **regular booking + payment flow** (new payment, new lifecycle). The referral record links the two consultations.

**Referral history (all personas):** patient sees their referral chain on the booking/consultation detail; both doctors see sent/received referrals with outcomes (accepted / re-chosen / refunded / completed); admin gets a referral report (volume, conversion, refund rate per doctor — a doctor whose referrals routinely end in refunds is a quality signal). Referral context (reason, originating consultation) is shown to the receiving doctor **with the existing consent/data-isolation rules respected**.

### 4.5 Emergency consultations (D11)

- `vet_profiles.emergency_consultation_fee` (nullable) alongside the existing `acceptsEmergency` flag. **Opt-in:** the emergency option appears to patients only for doctors with both the flag and a fee set (fee field is the master switch; per master-data rule the patient never types a price).
- Emergency booking uses the emergency fee as the server-derived gross; **commission rules identical** to normal bookings (same %, flat, snapshot).
- **Fast-track confirmation:** emergency bookings notify the doctor on all channels with a response window `booking.emergencyConfirmMinutes` (default 10). No response ⇒ patient is immediately shown alternative emergency-enabled doctors — payment **carries over via the same transfer mechanics as §4.4** (pick-another-doctor path) or refunds in full with costs on the non-responding doctor's ledger (he opted into emergencies and didn't respond).
- Payment hold for emergency checkout uses a shorter window (`payment.emergencyHoldMinutes`, default 5) so slots aren't blocked during a live emergency.

---

## 5. Commission engine

- Settings: `commission.defaultPercent` (e.g. 15), `commission.flatFee` (e.g. ₹20).
- Per-doctor override: nullable `commission_percent_override`, `commission_flat_override` on `vet_profiles`, editable from Admin → doctor detail. Effective rate = override ?? global.
- **Snapshot at payment time** into the payment row (`commission_percent`, `commission_flat`, `commission_amount`, `doctor_earning_amount`) so later config changes never rewrite history.
- Every change to commission config (global or per-doctor) writes an **audit log** row (who, old → new, when) — visible in the admin payments console.
- Computation: `commission = round2(gross × pct/100) + flat`; `doctorNet = gross − commission`. Validation: flat fee may never exceed gross (guard on config save and on booking of ultra-low fees).
- **Referral transfers (§4.4):** commission is recomputed at the receiving doctor's effective rate on the final settled amount; the superseded snapshot is preserved in `payment_events`.

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
- **TDS on payouts (§16):** each settlement records `tds_rate`/`tds_amount` (admin-configurable rate, default per Section 194-O — CA to confirm) and the net amount actually transferred; doctor's statement and annual summary show gross/TDS/net so certificates reconcile.
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

**Future-proofing contract (D13):** every tax figure anywhere in the system is computed from the admin-configured rate table at transaction time and **snapshotted** into the payment/invoice rows — nothing is hardcoded, no code path assumes 0%. Today admin sets consultation SAC rate = 0 (exempt) and commission SAC rate = 18%. If the government changes either, admin edits the rate in **Admin → Payments & Finance → Tax & Invoicing** and it applies to all *future* transactions automatically; historical invoices are immutable snapshots. This section of code is designed to never need touching again.

---

## 8. Database changes (migration `004_payment_module.sql`)

**`payments` (alter):** add `gateway_order_id`, `gateway_payment_id`, `gateway_fee_amount` (actual fee paid — basis for all fee recovery, D12), `commission_percent`, `commission_flat`, `commission_amount`, `doctor_earning_amount`, `wallet_amount_used`, `refund_destination` (`wallet|gateway`), `processing_charge_amount` (deducted on patient-cancel refunds), `expires_at`; extend `status` CHECK with `created`, `expired`, `partially_refunded`, `transferred`; default `currency` → `'INR'`, default `gateway` → `'demo'`.

**New tables:**
- `payment_events` — append-only audit of every transition + raw webhook payloads (idempotency: unique on `gateway_event_id`).
- `doctor_earnings` — `id, doctor_id, payment_id, booking_id, consultation_id, gross, commission_amount, net_amount, type (consultation|cancel_compensation|no_show_compensation|penalty|adjustment), status (clearing|available|locked|withdrawn|reversed), clear_at, withdrawal_id, created_at` — `penalty` rows carry negative `net_amount` (D9).
- `withdrawal_requests` — `id, doctor_id, amount, tds_rate, tds_amount, net_paid_amount, status (requested|approved|rejected|settled|cancelled), requested_at, reviewed_by, reviewed_at, settled_by, settled_at, utr_reference, admin_note, rejection_reason` — TDS fields present from day one so tax deduction (§16) is never a retrofit.
- `legal_documents` — `id, doc_type (terms|privacy|refund_policy|wallet_terms|doctor_agreement|grievance_policy|disclaimer), version, title, content, effective_from, requires_reacceptance, is_active, created_by` — versioned, immutable once published (§17).
- `user_policy_acceptances` — `id, user_id, doc_type, version, accepted_at, ip_address, user_agent, context (registration|invite|login_reacceptance|payout_setup)` — append-only proof of consent (§17).
- `invoices` — snapshot table per §7.
- `tax_codes` — SAC master (per master-data rule: SAC on forms is always a picker, never free text).

**`vet_profiles` (alter):** `commission_percent_override`, `commission_flat_override`, `emergency_consultation_fee` (D11), `gstin`, `payout_account_name`, `payout_account_number`, `payout_ifsc`, `payout_upi`.

**`bookings` (alter):** extend status CHECK with `payment_pending`, `payment_expired`, `referred`.

**`referrals` (alter, D10):** `referral_type ('hospital'|'platform')` default `'hospital'` (existing rows unchanged), `hospital_id` → nullable, add `booking_id`, `payment_id`, `transfer_status ('offered'|'accepted'|'rechosen'|'refunded'|'expired'|'completed')`, `action_deadline`.

**`system_settings` seeds:** `payment.gatewayMode`, `payment.holdMinutes=15`, `payment.emergencyHoldMinutes=5`, `payment.enabled=false` (feature flag — module ships dark), `commission.defaultPercent=15`, `commission.flatFee=20`, `cancellation.processingFlatFee=25` (D12 — flat component of the customer-facing "cancellation processing charge"), `settlement.clearanceDays=2`, `settlement.minWithdrawalAmount=500`, `compensation.doctorShareOfRetainedPercent=50`, `compensation.doctorShareOnPatientNoShowPercent=100`, `compensation.negativeBalanceAlertAmount=2000`, `referral.actionWindowHours=72`, `booking.emergencyConfirmMinutes=10`, `tax.*` (§7), plus existing `cancellation.*` keys unchanged.

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
| Scheduler (`utils/scheduler.ts`) | + expire unpaid holds (5 min), + mature `clearing → available` earnings (hourly), + reconciliation sweep (daily: `pending` payments > 1h old re-checked against gateway via `fetchPayment`), + expire referral action windows → auto-refund (hourly), + emergency confirm-window timeout → offer alternatives (every minute while any emergency booking is open) |
| Validation | Joi schemas for every new route; **no client-supplied amounts anywhere** |
| Notifications | payment received (both parties), payment expired + retry link, refund initiated/landed, earning available, withdrawal status changes, admin alert on webhook signature failures |

---

## 10. Frontend changes per persona

### Pet owner / Farmer
- **BookConsultation / HospitalBooking:** new payment step after slot selection — fee breakdown card (fee, tax if any, wallet applied, payable now), wallet-pay toggle, Razorpay checkout (demo mode: simulated checkout dialog), success/failure/retry states.
- **Payments & Receipts page:** payment history (upgrade of existing list), invoice PDF download, refund status per cancelled booking.
- **Wallet page (upgrade):** balance usable at checkout, transaction list already exists; add "instant refund" badge history.
- **Cancel dialog:** shows the computed refund amount *before* confirming (policy transparency — patients see "you'll get ₹250 of ₹500 back") + refund destination choice. Any deduction appears as a **single "cancellation processing charge" line** (D12 — never itemized into commission/gateway components in customer-facing UI).
- **Referral action screen (new):** when a doctor refers pre-consultation, the patient gets a guided 3-choice card — accept referred doctor (slot picker + difference settlement), choose another doctor, or refund — with a visible action deadline countdown.
- **Emergency booking path:** emergency toggle (visible only for emergency-enabled doctors), emergency fee shown clearly, live "waiting for doctor to accept (10:00)" state, automatic alternatives screen on timeout.

### Veterinarian
- **Profile:** consultation fee (exists — verify editability), **emergency fee (opt-in switch for emergency availability)**, GSTIN, payout bank/UPI details.
- **Refer patient action (new):** on a confirmed booking (pre-consultation) or from a completed consultation (specialist referral) — target-doctor picker (master-data rule: picker, not free text), reason, and for pre-consult referrals a clear notice of what happens to the payment (and that a resulting refund lands on his ledger).
- **My Earnings (new page):** four stat tiles (clearing / available / locked / lifetime), threshold progress bar, per-consultation statement (gross, commission, net, type — including compensation entries), withdrawal request + history, auto-request opt-in.
- **Booking cards:** paid badge; unpaid (`payment_pending`) requests visually distinct and *not confirmable*.

### Admin — new "Payments & Finance" menu group
1. **Gateway Settings** — mode switch, webhook health indicator, env-key presence check (never shows secrets).
2. **Commission Rules** — global % + flat; per-doctor override table with search; change-audit trail inline.
3. **Settlement & Cancellation Policy** — clearance days, min withdrawal, compensation splits, hold minutes, cancellation processing flat fee, referral action window, emergency confirm/hold windows.
4. **Tax & Invoicing** — GSTIN, SAC rates, invoice numbering.
5. **Transactions** — upgrade existing `PaymentManagement.tsx`: live status filters, stuck-payment flag, manual refund with destination choice.
6. **Settlements** — withdrawal queue (aging indicators), approve/reject/settle with UTR, discretionary payout button.
7. **Finance Reports** — see §11.
8. **Legal & Policies** — versioned policy document manager (§17): edit/publish T&C, privacy, refund, wallet terms, doctor agreement; toggle "requires re-acceptance"; acceptance-coverage stats.
9. **Dashboard widget:** payment health (today's collections, failed webhooks, stuck `pending` count, settlements due, wallet liability total).

### Hospital personas
Hospital-booked consultations use `hospital_doctors.consultation_fee` as the price source; revenue attribution to hospitals (hospital commission layer) is **explicitly deferred — see Open Item O1.**

All screens: 6-locale i18n keys added up-front with the mandatory audit command; 4-breakpoint responsive; no raw keys (per `feedback-usability-standards.md`). Master-linked fields (SAC, refund destination, gateway mode) are pickers, never free text.

---

## 11. Reports & dashboards

| Persona | Report |
|---|---|
| Admin | Revenue overview (GMV, commission earned, refunds out, processing charges collected, net platform revenue — daily/monthly trend), settlement liability (owed to doctors: clearing vs available, negative balances), **patient wallet liability** (total closed-wallet balances — money owed to customers, §16), GST/commission-invoice export (CSV), TDS deduction register, reconciliation report (gateway vs ledger mismatches), doctor-wise earnings & commission table, referral report (volume, conversion, refund rate per doctor), policy-acceptance coverage report (§17) |
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
| **P0 — Foundations** | Migration 004 (incl. legal/consent tables §17), settings seeds, INR migration, feature flag, gateway adapter interfaces + DemoGateway | tsc clean; app unchanged with flag off |
| **P1 — Collect & enforce** | Booking `payment_pending` flow, demo checkout step in booking UI, hold/expiry job, payment enforcement, refund engine goes live (wallet destination only), receipts (basic), **consent framework** (§17: policy pages + placeholders, registration/invite acknowledgement for all personas, admin Legal & Policies manager, re-acceptance modal) | Full cycle works end-to-end in demo mode incl. cancel/refund matrix; every registration path records consent |
| **P2 — Razorpay** | RazorpayGateway (orders, checkout, webhook, refunds), reconciliation job, gateway refund destination, smart retry. **Prerequisite: policy pages (§17.1) live with real content — Razorpay KYC reviews them** | Test-mode Razorpay round-trip verified incl. webhook replay + signature-failure alarms |
| **P3 — Commission & earnings** | CommissionEngine, per-doctor overrides UI, earnings ledger + clearance job, doctor My Earnings page, compensation matrix wiring | Every completed/cancelled/missed scenario produces correct ledger rows |
| **P4 — Settlements** | Withdrawal workflow (doctor + admin console), discretionary payout, payout details in profile, notifications | Money-out lifecycle audited end-to-end |
| **P5 — Referrals & emergency** | Platform referral flows (§4.4: transfer, difference settlement, 3-option patient screen, history views), emergency fee + fast-track confirm (§4.5), related scheduler jobs | Every referral/emergency path produces correct payment + ledger outcomes |
| **P6 — GST & invoicing** | Invoice snapshots, PDF receipts, SAC master with admin-editable rates (D13), commission invoices, GST exports | CA-reviewable invoice samples for both streams; rate change in admin UI reflects on next invoice with no code change |
| **P7 — Reports, cleanup & launch** | Finance reports/dashboards (incl. wallet-liability + TDS register), referral report, i18n audit (6 locales), unit tests (CommissionEngine, refund matrix incl. D12 fee recovery, ledger transitions, transfer flows, consent gating), /verify pass, **go-live data-cleanup script (D14)**, **pre-launch legal checklist (§16.5 — lawyer/CA sign-offs)**, deploy checklist | Flag flipped on in dev env; clean-start script rehearsed; legal checklist fully ticked |

Each phase is independently committable/pushable to `origin/develop` (flag keeps prod behavior unchanged until switch-on).

---

## 14. Open items — ALL RESOLVED (2026-07-05)

- ~~**O1 — Hospital commission layer**~~ → **RESOLVED → D10:** network hospitals are a **separate subscription-based module** (future work — not this plan). This plan covers individual-doctor bookings only; individual doctors may have their own registered hospital, which changes nothing in the money flow. Referral flows added instead — see §4.4.
- ~~**O2 — Existing unpaid history**~~ → **RESOLVED → D14:** no grandfathering. Clean start at prod launch; legacy data cleaned by launch script (P7).
- ~~**O3 — Emergency bookings**~~ → **RESOLVED → D11:** doctor-defined emergency fee, opt-in, fast-track confirm — see §4.5.
- ~~**O4 — Promo/discount codes**~~ → **RESOLVED:** dedicated future module with its own end-to-end workflow — tracked in §15. Fee-breakdown UI and `discount_amount` column keep the slot open.
- ~~**O5 — GST exemption**~~ → **RESOLVED → D13:** exemption confirmed by owner for now; rates fully admin-configurable so future government changes need zero code — see §7.
- ~~**O6 — Goodwill bonus funding**~~ → **RESOLVED → D9/D12:** doctor-funded (bonus + gateway fee) via negative penalty entries; balance may go negative and is recovered from future earnings. See §6.2.

## 15. Future scope (tracked, not in v1)

- **Promo/discount code module (owner-requested tracker, 2026-07-05):** dedicated module with code lifecycle (create/limit/expire), eligibility rules, redemption audit, and fee-breakdown integration. Hooks reserved: `payments.discount_amount`, fee-breakdown line slot, admin menu slot under Payments & Finance.
- **Network-hospital subscription billing module (owner-stated direction, 2026-07-05):** network hospitals pay platform subscription fees instead of per-consultation commission — separate plan when taken up.
- Multi-currency; automated bank payouts (Razorpay Route); patient wallet top-up (wallet fills via refunds only); pharmacy/marketplace payment convergence; EMI plans; GST filing integration.

---

## 16. Legal & compliance — wallet and fund flows (added 2026-07-05)

### 16.1 What wallet money physically is

Wallet balances are **ledger entries, not stored money**. Cash settles from Razorpay into the platform's current account and stays there; a wallet credit is a **current liability** (money owed to the customer), never platform revenue. The platform bank account therefore always holds three buckets — platform commission (yours), doctor earnings payable, and patient wallet liability — and the admin liability reports (§11) exist precisely so buckets 2 and 3 are never mistaken for spendable profit.

### 16.2 Regulatory position: closed-system PPI (no RBI license needed)

Under the **RBI Master Directions on Prepaid Payment Instruments (2021, as amended)**, a wallet that (a) is usable **only to purchase services on this platform**, (b) permits **no cash withdrawal**, and (c) makes **no third-party payments** is a **closed system PPI** — explicitly outside RBI's authorization regime. The patient wallet is designed to stay inside this definition permanently.

**Structural requirement (legal, not code):** because wallet money ultimately compensates independent doctors, the Terms of Service must establish the **platform as merchant of record** — the patient contracts with and pays the *platform* for the consultation service; doctors are the platform's service providers paid under a separate doctor agreement. This keeps the wallet unambiguously closed-loop. → Lawyer/CA drafts this into T&C + doctor agreement before go-live (§17).

### 16.3 Non-negotiable wallet invariants (enforced in code)

1. **No cash withdrawal from the patient wallet, ever.** (Doctor earnings are accounts payable — a different legal object — and are paid out via §6.)
2. **Wallet spendable only on this platform.**
3. **Refund-to-original-method always remains an offered choice** (D7) — wallet-only forced refunds are a consumer-protection exposure.
4. **Refund-sourced wallet credits never expire.** Promotional/bonus credits (`bonus_credits` column) may carry expiry; refund money may not.
5. **Account closure ⇒ remaining refund-sourced balance is returned to source**, never confiscated.
6. Adding wallet **top-up** in future changes the risk profile — requires fresh legal review before build (noted in §15).

### 16.4 Adjacent obligations

| Item | Treatment |
|---|---|
| **TDS on doctor payouts** | Platform acts as e-commerce operator; Section **194-O** (0.1% of gross, ₹5L/yr individual threshold) likely applies over 194J — **CA to confirm exact section/rate**. `withdrawal_requests` carries TDS fields from day one; admin-configurable rate; TDS register report |
| **GST TCS (Sec 52)** | Applies to *taxable* supplies through an ECO — exempt veterinary consultations likely out of scope; commission invoicing already handled in §7 — **CA to confirm** |
| **Payment aggregation** | Collection leg runs through Razorpay (a licensed PA) — compliant. Future Razorpay Route migration (§15) moves doctor funds into PA escrow, removing them from the platform account entirely — cleaner as volumes grow |
| **Accounting** | Wallet liability + doctor payable disclosed as current liabilities; monthly liability report (§11) is the bookkeeping source |
| **Grievance handling** | Consumer Protection (E-Commerce) Rules 2020 require a named grievance officer + published grievance policy → §17 |

### 16.5 Pre-launch legal checklist (P7 gate, external to code)

- [ ] T&C with merchant-of-record structure — lawyer
- [ ] Doctor/Service-Provider agreement (commission schedule, penalties D9/D12, referral rules, professional-responsibility clause) — lawyer
- [ ] Refund & Cancellation policy page matching §4.3 exactly (Razorpay KYC requires it published)
- [ ] Privacy policy aligned to **DPDP Act 2023** (owner personal data + payment data)
- [ ] Wallet terms (closed-loop, no-expiry, closure-refund rules of §16.3)
- [ ] Grievance officer named + policy page
- [ ] CA sign-off: 194-O/194J, GST TCS, commission GST rate, exemption treatment (D13)

---

## 17. Platform policies & user consent framework (added 2026-07-05)

Platform-wide (not payment-gated) — standard-platform behavior (Amazon-style): every persona explicitly acknowledges the applicable policies, and the platform keeps **provable, versioned consent records**.

### 17.1 Policy document set

| Document | Applies to | Notes |
|---|---|---|
| Terms of Service | all personas | merchant-of-record structure (§16.2) |
| Privacy Policy | all personas | DPDP Act 2023 aligned |
| Refund & Cancellation Policy | patients/farmers | public page; mirrors §4.3; Razorpay KYC prerequisite |
| Wallet Terms | patients/farmers | closed-loop rules of §16.3 |
| Doctor / Service-Provider Agreement | veterinarians | commission, settlement, penalties, referrals, professional responsibility |
| Grievance Redressal Policy | all personas | named grievance officer |
| Service Disclaimer | patients/farmers | online consultation is not a substitute for physical emergency care |

Content is drafted by lawyer/CA; the platform ships the **plumbing + placeholder drafts**: versioned `legal_documents` storage, public pages (`/terms`, `/privacy`, `/refund-policy`, `/grievance`, footer links on all public/auth pages), and the admin **Legal & Policies** manager (§10). Published versions are immutable; edits create a new version with `effective_from`.

### 17.2 Consent capture — all personas

| Touchpoint | Behavior |
|---|---|
| **Self-registration** (pet owner, farmer, veterinarian) | Registration blocked until the acknowledgement checkbox ("I agree to the Terms of Service and Privacy Policy", with links opening in-place) is ticked; vets additionally acknowledge the Doctor Agreement. Acceptance recorded server-side (doc type, version, timestamp, IP, user-agent) — a checkbox alone is not proof; the `user_policy_acceptances` row is |
| **Invite flows** (hospital staff, network members, admin-created users) | Acceptance captured on the invite-acceptance / first-login screen — invited users must consent personally; the inviter cannot consent for them |
| **Payout setup** (doctors) | Re-acknowledgement of the Doctor Agreement + commission schedule when saving bank/UPI details — consent recorded with `context='payout_setup'` |
| **Policy updates** | Publishing a version flagged `requires_reacceptance` triggers a blocking modal on next login for affected personas; acceptance re-recorded. Non-material edits skip the modal |
| **Booking checkout** | One-line notice "By paying you agree to the Refund & Cancellation Policy" (link) — informational, no extra click (checkout friction kills conversion); the registration-time ToS acceptance already binds |

### 17.3 Enforcement & audit

- Backend guard: login/refresh response includes `pendingPolicyAcceptances[]`; protected app routes surface the blocking modal until cleared (API remains usable for the acceptance endpoint only — mirrors the existing `account_status` gating pattern).
- Admin: acceptance-coverage report (who's pending after a re-acceptance push), per-user consent history on the user detail page.
- All 7 documents × 6 locales: policy *pages* render the admin-managed content (single canonical language with locale disclaimer acceptable at launch — translated legal text only if lawyer provides it; machine-translating legal documents is a liability, not a feature).
