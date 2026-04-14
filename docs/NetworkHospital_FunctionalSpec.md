# VetCare Network Hospital — Complete Functional Specification

> **Status:** Living Document — Updated 2026-04-14
> **Purpose:** Authoritative spec for the Hospital Network module — design, user personas, workflows, data access rules, menus, and integration with platform modules.
> **Rule:** ALL implementation MUST match this spec. Any deviation requires updating this document FIRST.

---

## Table of Contents

1. [Overview & Problem Statement](#1-overview--problem-statement)
2. [Architecture: Network vs Independent Hospitals](#2-architecture-network-vs-independent-hospitals)
3. [User Personas & Roles](#3-user-personas--roles)
4. [Complete Menu Matrix by Role](#4-complete-menu-matrix-by-role)
5. [Governance & Approval Matrix](#5-governance--approval-matrix)
6. [Registration & Login Flow per Staff Type](#6-registration--login-flow-per-staff-type)
7. [Platform Admin Check Gates](#7-platform-admin-check-gates)
8. [Data Access Model & Isolation Rules](#8-data-access-model--isolation-rules)
9. [Patient Workflow with Network Hospitals](#9-patient-workflow-with-network-hospitals)
10. [Network Hospital Core Rules](#10-network-hospital-core-rules)
11. [Inter-Hospital / Inter-Branch Functions](#11-inter-hospital--inter-branch-functions)
12. [Integration with Existing Platform Modules](#12-integration-with-existing-platform-modules)
13. [Reports by User Persona](#13-reports-by-user-persona)
14. [Comparison: Network Hospital vs Independent Hospital](#14-comparison-network-hospital-vs-independent-hospital)
15. [Current Implementation Gaps](#15-current-implementation-gaps)

---

## 1. Overview & Problem Statement

### What is a Hospital Network?

A **Hospital Network** (or Corporate Veterinary Group) is a multi-location veterinary organization operating under a single corporate umbrella. Examples: Apollo Vet Group (3 branches), TN Govt Vet Chain (5 branches).

```
VetCare Platform
├── Apollo Vet Group          (hospital_network #1)
│   ├── Apollo Chennai        (vet_hospital — branch)
│   ├── Apollo Mumbai         (vet_hospital — branch)
│   └── Apollo Delhi          (vet_hospital — branch)
│
├── NetworkHospital1          (hospital_network #2)
│   ├── NH1 Coimbatore        (vet_hospital — branch)
│   └── NH1 Trichy            (vet_hospital — branch)
│
└── Independent Hospitals     (no network — standalone)
    ├── Dr. Ravi's Clinic     (vet_hospital)
    └── PawsCare Downtown     (vet_hospital)
```

### Core Principle

**Hospital networks operate in a WALLED GARDEN.** Network staff can ONLY see patients enrolled in their network. They CANNOT see general platform patients, independent hospital patients, or patients from other networks. This is a **hard platform rule** — not a preference.

### Problem This Solves

| Problem | How Network Hospitals Solve It |
|---------|-------------------------------|
| Multi-location management | Single corporate dashboard, unified staff management |
| Patient data privacy | Consent-based enrollment — patient must opt-in |
| Staff governance | Invite-only registration, seat licensing, role hierarchy |
| Cross-hospital coordination | Inter-hospital referrals within network boundary |
| Corporate oversight | Audit logs, compliance dashboard, access tracking |
| Scalable operations | Subscription plans with seat limits, branch management |

---

## 2. Architecture: Network vs Independent Hospitals

### Database Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `hospital_networks` | Corporate umbrella entity | id, name, is_approved, is_active, id_prefix |
| `hospital_network_members` | Staff within a network | network_id, user_id, network_role, hospital_id |
| `hospital_network_hospitals` | Junction: network ↔ hospitals | network_id, hospital_id |
| `vet_hospitals` | Individual hospital (standalone or branch) | is_network_branch, branch_network_id |
| `hospital_staff_invites` | Invite-only staff registration | network_id, invite_token, staff_position, expires_at |
| `staff_positions` | Staff role within a hospital | hospital_id, user_id, position |
| `hospital_doctors` | Doctors within a hospital | hospital_id, doctor_id, hospital_role |
| `animal_care_contexts` | Patient enrollment in a network | network_id, animal_id, enrollment_status, network_patient_id |
| `patient_data_consent` | Owner consent for data sharing | animal_id, owner_id, granted_to_network_id |
| `clinical_data_access_log` | Immutable audit trail | accessor_id, accessor_network_id, animal_id, access_granted |
| `network_referrals` | Inter-hospital referral tracking | network_id, from_hospital_id, to_hospital_id |
| `hospital_patient_invites` | Walk-in patient invitations | network_id, invite_token, 72h expiry |
| `network_subscription_plans` | Seat/plan licensing | name, seat_limit, price_monthly |
| `network_subscriptions` | Active plan per network | network_id, plan_id, status |

### Branch Hospital Flag

A hospital is a branch when:
- `vet_hospitals.is_network_branch = true`
- `vet_hospitals.branch_network_id = <network_uuid>`

Branch hospitals are **excluded** from the general hospital listing (`/vet-hospitals`). They only appear within their network context.

---

## 3. User Personas & Roles

### Platform-Level Roles

| Role | Code | How Created | Scope |
|------|------|-------------|-------|
| Platform Admin | `admin` | Pre-seeded | Full platform — approves networks, manages subscriptions |
| Pet Owner | `pet_owner` | Self-register | Owns animals, grants/revokes consent to networks |
| Farmer | `farmer` | Self-register | Owns farm animals + enterprise features |
| Veterinarian | `veterinarian` | Self-register | Treats animals, can be independent or network-affiliated |
| Corporate Admin | `corporate_admin` | Self-register + network approval | Creates/manages hospital network, top-level governance |
| Hospital Staff | `hospital_staff` | **Invite-only** | Nurse, tech, receptionist etc. within a network hospital |

### Network-Level Roles (within `hospital_network_members`)

| Network Role | Who | Capabilities |
|-------------|-----|-------------|
| `corporate_admin` | Network creator/owner | Full network control: branches, staff, patients, reports, billing |
| `hospital_director` | Branch hospital head | Manages assigned branch: staff, patients, workflows |
| `auditor` | Compliance reviewer | Read-only access to audit logs, cannot modify data |
| `compliance_officer` | Data governance | Views consents, data access patterns, compliance reports |
| `hospital_staff` | Operational staff | Day-to-day patient care within assigned branch only |

### Staff Positions (within `staff_positions`)

| Position | Access Level |
|----------|-------------|
| `veterinarian` | Full clinical access at assigned hospital |
| `surgeon` | Clinical + surgical records |
| `nurse` | Patient care, vitals, medication tracking |
| `technician` | Lab, imaging, equipment |
| `receptionist` | Check-in, scheduling, basic patient info |
| `lab_tech` | Lab results entry and viewing |
| `radiologist` | Imaging records |
| `anesthesiologist` | Surgery records |
| `pharmacist` | Prescription fulfillment |
| `intern` | Limited supervised access |
| `admin_staff` | Administrative tasks, reports |

---

## 4. Complete Menu Matrix by Role

### Platform Admin (`admin`)

| Section | Menu Item | Route |
|---------|-----------|-------|
| Main | Dashboard | /dashboard |
| Admin | Hospital Networks | /hospital-networks |
| Admin | Network Subscriptions | /admin/network-subscriptions |
| Admin | User Management | /admin/users |
| Admin | System Settings | /admin/settings |
| Admin | Audit Logs | /admin/audit |
| Shared | AI Copilot | /ai-copilot |

### Corporate Admin (`corporate_admin`)

| Section | Menu Item | Route | What It Does |
|---------|-----------|-------|-------------|
| Main | Dashboard | /dashboard | Network-wide stats: total networks, hospitals, members, pending approvals |
| Network | Hospital Networks | /hospital-networks | Manage networks, branches, members, patients, referrals, audit |
| Analytics | Health Analytics | /health-analytics | Network-wide health trends |
| Shared | AI Copilot | /ai-copilot | AI-assisted analysis |
| Shared | Marketplace | /marketplace | Network purchasing |
| Shared | Wallet | /wallet | Financial management |
| Shared | Settings | /settings | Profile & preferences |

### Hospital Director (veterinarian with `hospital_director` network role)

| Section | Menu Item | Route | What It Does |
|---------|-----------|-------|-------------|
| Main | Dashboard | /dashboard | Branch-level stats |
| Hospital | Hospital Workflow | /hospital-workflow | Patient queue, triage, treatment workflow |
| Hospital | Inpatient & Boarding | /inpatient | Admissions, ward management |
| Hospital | Medical Records | /medical-records | **ONLY enrolled network patients** |
| Hospital | Patient Consent | /patient-consent | View/manage consent grants |
| Network | Network Memberships | /network-memberships | View own network affiliations |
| Clinical | My Consultations | /consultations | Personal consultation list |
| Clinical | My Schedule | /doctor/manage-schedule | Appointment management |
| Clinical | Prescriptions | /doctor/prescriptions | Prescription management |
| Animals | My Pets | /animals | **Only animals treated at network hospitals** |
| Analytics | Health Analytics | /health-analytics | Branch analytics |
| Shared | Settings | /settings | Profile |

### Hospital Staff (`hospital_staff`)

| Section | Menu Item | Route | What It Does |
|---------|-----------|-------|-------------|
| Main | Dashboard | /dashboard | Quick actions for daily tasks |
| Hospital | Hospital Workflow | /hospital-workflow | Patient check-in queue, triage |
| Hospital | Inpatient & Boarding | /inpatient | Inpatient tracking |
| Hospital | Medical Records | /medical-records | **ONLY enrolled patients at assigned hospital** |
| Shared | Settings | /settings | Profile |

### Pet Owner (`pet_owner`) — Interacting with Networks

| Section | Menu Item | Route | What It Does |
|---------|-----------|-------|-------------|
| Network | Network Memberships | /network-memberships | View enrollment requests, accept/decline |
| Network | Patient Consent | /patient-consent | Grant/revoke data sharing consent |
| Regular | All standard pet_owner menus | ... | Consultations, animals, records, etc. |

---

## 5. Governance & Approval Matrix

### Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                   PLATFORM ADMIN                         │
│  (VetCare system owner — ultimate authority)             │
│  • Approves/rejects network registration                 │
│  • Manages subscription plans                            │
│  • Can suspend/deactivate any network                    │
│  • Views cross-network compliance reports                │
└──────────────────┬──────────────────────────────────────┘
                   │ approves
┌──────────────────▼──────────────────────────────────────┐
│              CORPORATE ADMIN                             │
│  (Network owner/operator — one per network)              │
│  • Creates branch hospitals                              │
│  • Invites/manages all staff types                       │
│  • Sets network policies                                 │
│  • Views network-wide reports & audit logs               │
│  • Manages patient enrollment requests                   │
│  • Creates inter-hospital referrals                      │
│  • Cannot self-approve network (anti-fraud)              │
└──────────────────┬──────────────────────────────────────┘
                   │ delegates
┌──────────────────▼──────────────────────────────────────┐
│             HOSPITAL DIRECTOR                            │
│  (Branch head — one per branch hospital)                 │
│  • Manages branch-level staff                            │
│  • Oversees patient queue and workflow at branch         │
│  • Can accept referrals to their branch                  │
│  • Views branch-level reports                            │
│  • Cannot create new branches                            │
└──────────────────┬──────────────────────────────────────┘
                   │ manages
┌──────────────────▼──────────────────────────────────────┐
│             HOSPITAL STAFF                               │
│  (Day-to-day operational staff at a branch)              │
│  • Executes assigned duties (nurse, tech, reception)     │
│  • Can check-in patients, update records                 │
│  • CANNOT see patients from other branches               │
│  • CANNOT see general platform patients                  │
│  • No administrative privileges                          │
└─────────────────────────────────────────────────────────┘
```

### Approval Flow for Key Actions

| Action | Who Can Do It | Who Approves | Platform Gate |
|--------|--------------|-------------|---------------|
| Create hospital network | Any registered user | Platform Admin | `is_approved = false` until admin approves |
| Create branch hospital | Corporate Admin | Auto-approved (within approved network) | Network must be `is_approved = true` |
| Invite staff | Corporate Admin, Hospital Director | Auto-join on acceptance | Seat limit check at invite AND acceptance |
| Enroll patient (animal) | Network staff request | **Pet Owner must accept** | Consent-before-access rule |
| View patient records | Network staff | **Only if enrollment_status = 'active'** | Data isolation enforced |
| Inter-hospital referral | Treating vet | Receiving hospital accepts/declines | Both hospitals must be in same network |
| Suspend network | Platform Admin | Immediate effect | Blocks all corporate_admin + hospital_staff logins |
| Change subscription plan | Corporate Admin | Platform Admin approves upgrades | Seat limit enforced |

---

## 6. Registration & Login Flow per Staff Type

### Corporate Admin Registration

```
1. User self-registers on VetCare (role: any — typically veterinarian)
2. User creates a Hospital Network via /hospital-networks → Create Network
3. System auto-adds user as corporate_admin member of the network
4. Network starts with is_approved = false (pending review)
5. Platform Admin reviews and approves the network
6. Corporate Admin can now create branches and invite staff
```

### Hospital Staff Registration (INVITE-ONLY)

```
1. Corporate Admin opens Hospital Networks → Detail → Invite Staff
2. Enters: email, name, position (nurse/tech/etc.), assigned hospital
3. System checks seat limit (must have available seats)
4. Creates invite token (crypto 48 bytes, 72-hour expiry)
5. ★ Email sent to invitee with accept link
6. Invitee clicks: /accept-hospital-invite?token=<token>
7. System validates: token valid, not expired, not already used
8. Invitee creates account: first name, last name, phone, password
9. System creates user with role=hospital_staff
10. System adds user to hospital_network_members + staff_positions
11. System marks invite as 'accepted'
12. ★ Seat limit checked AGAIN at acceptance (race condition guard)
```

### Veterinarian Joining a Network

```
1. Veterinarian already has a VetCare account
2. Corporate Admin adds them via Hospital Networks → Detail → Add Member
3. Searches by name/email, selects user
4. Assigns network_role (hospital_director, etc.) + hospital
5. System adds to hospital_network_members
6. Veterinarian now sees network-related menus in navigation
```

### Login Behavior by Role

| Role | Login Behavior | Post-Login Page |
|------|---------------|----------------|
| `admin` | Standard login | Admin Dashboard |
| `corporate_admin` | Standard login; if network suspended → 403 | Corporate Dashboard (network stats) |
| `veterinarian` | Standard login | Vet Dashboard (consultations, schedule) |
| `hospital_staff` | Standard login; if network suspended → 403 | Hospital Staff Dashboard (workflow shortcuts) |
| `pet_owner` | Standard login | Pet Owner Dashboard (animals, bookings) |
| `farmer` | Standard login | Farm Dashboard (enterprise stats) |

---

## 7. Platform Admin Check Gates

| Gate | When Checked | What Happens on Failure |
|------|-------------|------------------------|
| **Network Approval** | Before network can add branches/staff | "Network pending approval" — create-only, no operations |
| **Network Active** | On every corporate_admin/hospital_staff login | 403: "Network has been suspended" |
| **Seat Limit** | On staff invite send AND accept | 403: "Seat limit reached (X/Y)" |
| **Subscription Status** | On network operations | If expired/suspended, limited to read-only |
| **Self-Approval Prevention** | When admin tries to approve own network | 403: "Cannot approve your own network" |

---

## 8. Data Access Model & Isolation Rules

### ★ CRITICAL: Who Can See What

```
┌─────────────────────────────────────────────────────────────┐
│ RULE #1: Hospital staff can ONLY see patients enrolled      │
│ in their network with enrollment_status = 'active'          │
│                                                              │
│ RULE #2: No cross-network data access, ever                 │
│                                                              │
│ RULE #3: Patient enrollment requires owner consent           │
│                                                              │
│ RULE #4: Every clinical data access is logged to             │
│ clinical_data_access_log (immutable, append-only)            │
│                                                              │
│ RULE #5: Data visibility defaults to PRIVATE                 │
│ (animal_care_contexts.visibility = 'private')                │
└─────────────────────────────────────────────────────────────┘
```

### Data Access Matrix

| Data Type | Platform Admin | Corporate Admin | Hospital Director | Hospital Staff | Pet Owner | Independent Vet |
|-----------|:-:|:-:|:-:|:-:|:-:|:-:|
| General platform patients | ✅ | ❌ | ❌ | ❌ | Own only | Own patients |
| Network enrolled patients | ✅ | Own network | Own branch | Own branch | Own animals | ❌ |
| Medical records | ✅ | Own network (audit) | Own branch patients | Own branch patients | Own animals | Own patients |
| Consultation history | ✅ | Own network | Own branch | ❌ (unless assigned) | Own animals | Own consultations |
| Financial data | ✅ | Own network | Own branch | ❌ | Own payments | ❌ |
| Staff information | ✅ | Own network | Own branch | ❌ | ❌ | ❌ |
| Audit logs | ✅ | Own network | Own branch | ❌ | ❌ | ❌ |
| Cross-network data | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### How Data Isolation Is Enforced

1. **Enrollment Gate**: `animal_care_contexts.enrollment_status = 'active'` — no active enrollment = no data
2. **Network Scope**: All queries MUST include `WHERE network_id = ?` or `WHERE hospital_id IN (SELECT hospital_id FROM hospital_network_hospitals WHERE network_id = ?)`
3. **Consent Scope**: `patient_data_consent` controls WHAT data is shared (basic profile, medical history, lab results, prescriptions, vaccination records, full history)
4. **Audit Trail**: `clinical_data_access_log` records every access with accessor_id, accessor_network_id, animal_id, record_type, access_granted (boolean)

### ★ CURRENT GAP — Medical Records Not Filtered by Hospital/Network

**Issue identified:** `MedicalRecordService.listRecords()` filters by `user_id / created_by / veterinarian_id` but does NOT filter by `hospital_id` or `network_id`. This means:
- A `hospital_staff` user can see ALL animals on the platform in the Medical Records dropdown
- This violates Rule #1 above

**Required fix:** The animal list API for `hospital_staff` must ONLY return animals with active enrollment in their network:
```sql
SELECT DISTINCT a.* FROM animals a
JOIN animal_care_contexts acc ON acc.animal_id = a.id
WHERE acc.network_id = $1  -- user's network
AND acc.enrollment_status = 'active'
AND acc.is_active = true
```

---

## 9. Patient Workflow with Network Hospitals

### Enrollment Flow (How a Patient Enters a Network Hospital)

```
METHOD 1: Network searches platform patient
─────────────────────────────────────────────
1. Hospital staff searches for patient by name/email/animal
   (via /hospital-networks/:id/search-patients)
2. Finds matching pet owner + animal on platform
3. Sends enrollment request → animal_care_contexts created with
   enrollment_status = 'pending_consent'
4. Pet owner sees enrollment request in /network-memberships
5. Pet owner reviews and either:
   a. ACCEPTS → enrollment_status = 'active', consent record created
   b. DECLINES → enrollment_status = 'declined'
6. Only after acceptance: network staff can see patient data

METHOD 2: Walk-in patient (not on platform)
──────────────────────────────────────────
1. Hospital staff sends walk-in invite via email
   (via /hospital-networks/:id/invite-walkin)
2. Creates hospital_patient_invites with 72-hour token
3. Patient clicks invite link, registers on platform
4. On registration: enrollment auto-activates for the hospital
5. Patient can later revoke consent from /patient-consent

METHOD 3: Patient self-enrolls (future feature)
──────────────────────────────────────────────
1. Patient browses hospital networks on platform
2. Selects a network and requests enrollment
3. Network admin reviews and approves
```

### Patient Visit Lifecycle at a Network Hospital

```
1. CHECK-IN: Patient arrives → receptionist checks in via Hospital Workflow queue
2. TRIAGE: Nurse assesses severity (critical/urgent/high/moderate/minor)
3. EXAMINATION: Assigned vet examines patient, creates medical records
4. TREATMENT: Procedures, medications administered, records updated
5. OBSERVATION: Post-treatment monitoring (if needed)
6. DISCHARGE: Case closed, discharge summary generated
   OR
6b. ADMISSION: Patient admitted as inpatient (moves to Inpatient & Boarding)
   OR
6c. REFERRAL: Patient referred to another branch hospital within network
```

### Consent Dimensions (6 Levels)

| Dimension | Default | What It Controls |
|-----------|---------|-----------------|
| Basic Profile | false | Name, species, breed, weight |
| Medical History | false | Diagnoses, treatments, surgeries |
| Lab Results | false | Blood work, imaging, tests |
| Prescriptions | false | Medication history |
| Vaccination Records | false | Vaccination schedule and records |
| Full History | false | Complete platform-wide records (includes `include_hospital_records`) |

The pet owner controls EXACTLY which data dimensions the network can see. Default is ALL false — opt-in only.

---

## 10. Network Hospital Core Rules

### HARD RULES (Non-Negotiable)

| # | Rule | Enforcement |
|---|------|-------------|
| R1 | **Consent-before-access**: No patient data visible until owner accepts enrollment | `enrollment_status = 'active'` gate on ALL queries |
| R2 | **Network boundary**: Staff can ONLY access patients in their own network | SQL `WHERE network_id = ?` on every query |
| R3 | **Hospital boundary**: Hospital staff see ONLY their assigned branch's patients | SQL `WHERE hospital_id = ?` additional filter |
| R4 | **No cross-network data**: Network A cannot see Network B's patients, ever | Separate network_id, no cross-joins |
| R5 | **Invite-only staff**: hospital_staff role CANNOT self-register | Registration endpoint rejects role=hospital_staff |
| R6 | **Seat licensing**: Staff count cannot exceed subscription seat limit | Checked at invite send AND acceptance |
| R7 | **Anti-self-approval**: Network creator cannot approve their own network | `created_by !== approverId` enforced |
| R8 | **Audit everything**: Every clinical data access logged immutably | `clinical_data_access_log` — append-only, no DELETE |
| R9 | **Private by default**: New enrollment visibility = 'private' | Default in animal_care_contexts |
| R10 | **Suspension blocks operations**: Suspended network → staff can't log in | Login check for network status |

### SOFT RULES (Configurable)

| # | Rule | Default | Configurable By |
|---|------|---------|----------------|
| S1 | Invite token expiry | 72 hours | Future: admin settings |
| S2 | Walk-in invite expiry | 72 hours | Future: admin settings |
| S3 | Maximum branches per network | Unlimited (plan-based) | Subscription plan |
| S4 | Auto-approval for transfers | No | Future: network settings |

---

## 11. Inter-Hospital / Inter-Branch Functions

### Network Referrals

```
FLOW: Branch A → Branch B (same network only)
─────────────────────────────────────────────
1. Vet at Branch A determines patient needs specialist at Branch B
2. Creates referral: /network-referrals
   - From: Branch A hospital + vet
   - To: Branch B hospital + vet (optional)
   - Animal, priority (urgent/high/routine/low), reason, notes
3. Branch B receives referral notification
4. Branch B director/vet accepts or declines
5. If accepted: patient is now visible to Branch B staff
   (via referral linkage, not enrollment duplication)
6. Referral status tracked: pending → accepted → in_progress → completed
```

### Referral Statuses

| Status | Meaning |
|--------|---------|
| `pending` | Sent, awaiting receiving hospital response |
| `accepted` | Receiving hospital accepted the referral |
| `declined` | Receiving hospital declined (with reason) |
| `in_progress` | Patient is being treated at receiving hospital |
| `completed` | Referral case completed |
| `cancelled` | Sending hospital cancelled the referral |

### What Can Cross Branch Boundaries

| Data | Crosses via | Authorization |
|------|-------------|---------------|
| Patient basic profile | Referral link | Automatic if referral accepted |
| Medical records | Referral + consent | Only if consent covers medical_history |
| Lab results | Referral + consent | Only if consent covers lab_results |
| Staff transfer | Corporate Admin action | Admin reassigns via member edit |
| Reports/analytics | Corporate dashboard | Corporate Admin sees all branches |

### What CANNOT Cross Network Boundaries

- Patient records between different networks
- Staff access between different networks
- Financial data between different networks
- Any data without patient consent

---

## 12. Integration with Existing Platform Modules

### How Network Hospitals Interact with Platform Modules

| Platform Module | Integration | Network Scope |
|----------------|-------------|---------------|
| **Consultations** | Hospital staff can create consultations for enrolled patients | Network patients only |
| **Medical Records** | Network staff create/view records for enrolled patients | ★ NEEDS FIX: Currently shows all platform animals |
| **Prescriptions** | Vets prescribe for enrolled patients; pharmacy staff fulfills | Network patients only |
| **Animals (My Pets)** | Pet owners always see their own animals; network staff see enrolled only | Dual scope |
| **Vaccination Passport** | Records created at network hospitals show hospital attribution | Hospital ID tagged |
| **Marketplace** | Corporate Admin can purchase supplies for the network | Standard marketplace |
| **AI Copilot** | All roles can use AI for clinical assistance | No data isolation issue (AI is per-query) |
| **Wallet** | Corporate Admin manages network finances | Network-scoped billing |
| **Settings** | All users manage personal settings | Standard |
| **Dashboard** | Corporate Admin gets network stats; staff gets workflow shortcuts | Role-specific views |
| **Find a Doctor** | Independent — patients find any vet | No network filtering needed |
| **Booking** | Patients can book at network hospitals | Standard booking flow |
| **Farm/Enterprise** | Separate module — farm enterprises are NOT hospital networks | Completely isolated (LESSON-025) |

### Modules NOT Available to Hospital Staff

| Module | Reason |
|--------|--------|
| Farm Management | hospital_staff is not a farmer |
| Enterprise Analytics | Separate domain (LESSON-025) |
| Breeding Planner | Farm-only feature |
| Feed Management | Farm-only feature |
| Compliance (Farm) | Farm-only feature |
| Vet Hospital Browse | Staff doesn't browse — they work at a specific hospital |

---

## 13. Reports by User Persona

### Platform Admin Reports

| Report | Data Source | Scope |
|--------|-----------|-------|
| Network Overview | hospital_networks | All networks — count, status, type |
| Subscription Revenue | network_subscriptions | All plans — active, trial, expired |
| Compliance Overview | clinical_data_access_log | Cross-network access patterns |
| User Growth | users | Platform-wide registration trends |

### Corporate Admin Reports

| Report | Data Source | Scope |
|--------|-----------|-------|
| Network Dashboard | hospital_network_members, hospital_network_hospitals | Own network — total members, hospitals, patients |
| Staff Distribution | hospital_network_members | Members by role, by branch |
| Patient Census | animal_care_contexts | Enrolled patients by branch, by status |
| Referral Analytics | network_referrals | Referrals by direction, status, priority |
| Audit Compliance | clinical_data_access_log | All access events within network |
| Consent Summary | patient_data_consent | Active consents by dimension |
| Branch Performance | vet_hospitals + queue + inpatient | Patients seen, avg wait time, occupancy |

### Hospital Director Reports

| Report | Data Source | Scope |
|--------|-----------|-------|
| Branch Dashboard | queue_entries, inpatient_admissions | Own branch stats |
| Staff Roster | staff_positions, hospital_network_members | Staff at own branch |
| Patient Queue Metrics | queue_entries | Average wait, triage distribution |
| Inpatient Occupancy | inpatient_admissions | Bed utilization at branch |
| Referral Tracking | network_referrals | Incoming/outgoing for branch |

### Hospital Staff Reports

| Report | Data Source | Scope |
|--------|-----------|-------|
| My Work Queue | queue_entries | Assigned/pending patients |
| Daily Summary | queue_entries, inpatient_admissions | Today's activity |

### Pet Owner Reports

| Report | Data Source | Scope |
|--------|-----------|-------|
| My Enrollments | animal_care_contexts | All networks my animals are enrolled in |
| Consent Status | patient_data_consent | Active consents by animal, by network |
| Visit History | queue_entries | Hospital visits across all networks |

---

## 14. Comparison: Network Hospital vs Independent Hospital

| Aspect | Network Hospital (Branch) | Independent Hospital |
|--------|--------------------------|---------------------|
| **Registration** | Created by Corporate Admin via branch management | Owner registers directly on platform |
| **Staff Onboarding** | Invite-only, seat-limited | Hospital owner adds doctors directly |
| **Patient Access** | Consent-based enrollment required | Any patient can visit/book |
| **Data Isolation** | Strict — network boundary enforced | Standard — hospital-level isolation |
| **Billing** | Network-level subscription (seats, features) | Free / platform marketplace |
| **Referrals** | Formal inter-hospital referral system | Informal — no tracking system |
| **Governance** | Multi-level hierarchy (corporate → director → staff) | Flat (owner → doctors) |
| **Compliance** | Audit logs, consent tracking, DPO | Basic platform logs |
| **Analytics** | Network-wide + branch-level dashboards | Hospital-level only |
| **Listing** | **NOT listed** in general hospital browse (internal only) | **Listed** in /vet-hospitals for patients |
| **Patient Onboarding** | Enrollment request → consent → activate | Walk-in or book appointment |
| **Cross-Hospital** | Referrals within network boundary | Not applicable (single location) |

### Key Database Differences

| Field | Network Branch | Independent |
|-------|---------------|-------------|
| `vet_hospitals.is_network_branch` | `true` | `false` (default) |
| `vet_hospitals.branch_network_id` | `<network_uuid>` | `NULL` |
| Listed in `/vet-hospitals` | No (filtered out) | Yes |
| Staff via | `hospital_network_members` + `staff_positions` | `hospital_doctors` |
| Patient access via | `animal_care_contexts` with enrollment | Direct booking/visit |

---

## 15. Current Implementation Gaps

### ★ CRITICAL (Must Fix Before Use)

| # | Gap | Impact | Required Fix |
|---|-----|--------|-------------|
| **G1** | Medical Records animal dropdown shows ALL platform animals to hospital_staff | **Data isolation violation** | API must filter animals by network enrollment for hospital_staff |
| **G2** | `MedicalRecordService.listRecords()` has NO hospital/network filter | hospital_staff can view any record they created regardless of hospital scope | Add network_id/hospital_id filtering |
| **G3** | `searchPatients()` in HospitalNetworkService searches ALL pet_owners platform-wide | Not a violation (it's for enrollment search), but should note: "search for enrollment only, not data access" | Add UI clarity that search is for enrollment |
| **G4** | Dashboard for hospital_staff shows generic consultation stats | Should show branch-specific queue stats, not platform-wide | Load hospital-specific dashboard data |
| **G5** | Referral authorization — no role/hospital membership check | Any authenticated user can create referral | Add network membership verification |

### MODERATE (Functional Gaps)

| # | Gap | Impact |
|---|-----|--------|
| **G6** | No branch hospital edit/delete from frontend (backend exists) | Corporate admin can't manage branches after creation |
| **G7** | Email delivery blocked on Render (SMTP ports blocked) | Staff invites don't deliver — using log-only mode, needs Resend API |
| **G8** | Hospital_staff dashboard shows 0 consultations/0 prescriptions | Generic dashboard data load — should show branch patient counts |
| **G9** | No "My Hospital" context awareness for hospital_staff | Staff should auto-load their assigned branch, not select from dropdown |

### LOW (Polish)

| # | Gap | Impact |
|---|-----|--------|
| **G10** | Audit log export formats limited to CSV | No PDF export |
| **G11** | No network-level financial reports | Revenue tracking per branch not implemented |
| **G12** | No holiday/leave management for network staff | Planned but not implemented |
| **G13** | No inter-branch patient transfer workflow | Only referrals exist, not formal transfers |

---

## Appendix A: Demo Accounts

| Email | Password | Role | Network Role | Assigned Branch |
|-------|----------|------|-------------|----------------|
| admin@vetcare.com | Admin@123 | admin | — | Platform admin |
| netadmin@vetcare.com | Demo@123 | corporate_admin | corporate_admin | DemoVetGroup (all branches) |
| branch.director@vetcare.com | Demo@123 | veterinarian | hospital_director | Chennai Central |
| staff.nurse@vetcare.com | Demo@123 | hospital_staff | hospital_staff | Chennai Central |
| staff.reception@vetcare.com | Demo@123 | hospital_staff | hospital_staff | Coimbatore |
| staff.labtech@vetcare.com | Demo@123 | hospital_staff | hospital_staff | Coimbatore |

## Appendix B: API Endpoint Summary

| Category | Count | Base Path |
|----------|-------|-----------|
| Network CRUD | 6 | /hospital-networks |
| Branch Management | 3 | /hospital-networks/:id/branch-hospitals |
| Member Management | 4 | /hospital-networks/:id/members |
| Staff Invites | 4 | /hospital-networks/:id/invite-staff |
| Patient Enrollment | 7 | /hospital-networks/:id/enroll-animal |
| Patient Consent | 3 | /patient-consent |
| Network Referrals | 3 | /network-referrals |
| Dashboard | 2 | /dashboard/corporate, /hospital-networks/:id/dashboard |
| Audit | 1 | /hospital-networks/:id/audit-logs |
| Subscriptions | 5 | /admin/network-subscription-plans |
| **Total** | **38** | |

---

*End of Functional Specification*
