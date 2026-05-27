# VetCare Notes & Ad-hoc Logs

> Auto-generated. Agent-readable.

---

## Pharmacy Module E2E Functional Workflow
- **Logged:** 2026-05-27 12:46
- **Content:** ## PHARMACY MODULE — COMPLETE E2E FUNCTIONAL WORKFLOW

### WHO ONBOARDS PHARMACIST USERS
- **Who**: corporate_admin OR admin (at the network level)
- **Where**: HospitalNetworks page → Staff Invites tab → Invite with staff_position='pharmacist'
- **How**: POST /hospital-networks/:networkId/invite-staff with {email, staff_position:'pharmacist'}
- **Gap (BUG)**: accept-invite creates user with role='hospital_staff' not 'pharmacist' → MUST FIX

### ONBOARDING FLOW (Step by Step)
1. Corporate Admin logs in → Network & Hospital menu → Select network
2. Go to Staff tab → Invite Staff → Enter pharmacist email + select 'Pharmacist' position
3. Backend sends invite email with unique token
4. Pharmacist receives email → clicks accept link → fills name+password → account created
5. BUG: account gets role='hospital_staff' — SHOULD be role='pharmacist'
6. After fix: pharmacist logs in → sees Pharmacy menu → lands on PharmacyDashboard

### PRESCRIPTION REVIEW WORKFLOW (Vet → Pharmacy)
1. Vet creates prescription for network patient
2. PrescriptionService auto-routes: queries primary pharmacy for network → sets target_pharmacy_id + review_status='pending_review'
3. Pharmacist dashboard shows prescription in 'Pending Review' queue
4. Pharmacist opens PrescriptionReviewModal → validates: dosage correctness, allergy check, drug interactions, stock availability
5. Pharmacist clicks: Approve / Reject / Request Clarification
6. If APPROVED: prescription moves to 'Ready for Dispensing' queue
7. If REJECTED: vet sees rejection reason on their prescriptions view
8. If CLARIFICATION: vet gets notified, updates prescription

### DISPENSING WORKFLOW (Pharmacist)
1. Pharmacist opens 'Ready for Dispensing' queue
2. Opens DispensingModal → selects dispensing method (counter/delivery/pickup)
3. System checks stock for each medication line item
4. Pharmacist confirms quantities → dispensing_record created with line_items
5. Inventory auto-decremented via stock_adjustment record (type='dispense')
6. Prescription status → 'dispensed'
7. dispensing_record includes: total_cost, pharmacist_id, timestamp, method

### INVENTORY MANAGEMENT WORKFLOW
1. Pharmacist opens Inventory tab → sees stock grid with color coding (expired/expiring/low/ok)
2. Low stock triggers: system shows alert + pharmacist can click 'Reorder'
3. ReorderRequestModal → select supplier → set quantity → submit
4. POST /pharmacies/:id/reorders → creates reorder record with status='requested'
5. Supplier delivers → pharmacist clicks 'Mark Received' → PATCH reorder status='received'
6. Stock adjusted upward via stock_adjustment (type='received')
7. Expiry management: pharmacist can expire batches → stock_adjustment (type='expired')

### SUPPLIER MANAGEMENT WORKFLOW
1. Corporate Admin or Pharmacist manages suppliers in Suppliers tab
2. Add supplier: name, contact, lead_time_days, payment_terms
3. Supplier linked to medications and reorder requests
4. Analytics shows: cost per supplier, lead times, reliability

### INTER-HOSPITAL MEDICATION TRANSFER
1. One hospital pharmacy runs low → POST /networks/:id/med-requests
2. Specifies source+destination hospital, requested medications
3. Destination pharmacy fulfills → PATCH status='fulfilled' + tracking_number
4. Receiving pharmacy marks as received → stock incremented

### INTEGRATION WITH OTHER MODULES
- PRESCRIPTIONS: auto-routed on creation, status tracked through review→dispense cycle
- VET MODULE: vet sees review_status on their prescription list (gap — not yet shown in UI)
- PET OWNER: owner sees dispensing_status for their pet's prescriptions (gap — not shown in UI)
- NETWORK HOSPITALS: pharmacy staff invited via hospital invite flow
- ADMIN: full visibility across all networks via /networks/:id/pharmacy-reports
- SETTINGS: pharmacy config managed via PharmacySettings component

### CRITICAL BUG TO FIX
- File: backend/src/routes/index.ts around line 2622
- Issue: invite accept creates role='hospital_staff' not role='pharmacist'
- Fix: check staff_position in invite accept handler; if 'pharmacist' set role='pharmacist'

### DEMO CREDENTIALS (after fix)
- pharmacist@vetcare.com / Demo@123 → pharmacist role at demo network pharmacy

---

