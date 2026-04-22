# VetCare Feature Tracker

## Legend
- ✅ Completed
- ⚠️ Planned / In Progress
- ❌ Cancelled / Skipped (with reason)

---

## Core Platform

| Feature | Status | Notes |
|---------|--------|-------|
| Auth (login/register/JWT/refresh) | ✅ | All 4 roles |
| Role-based routing & permissions | ✅ | 4-file sync pattern enforced |
| Admin settings (time/date/currency/join window) | ✅ | `useSettings()` hook — all pages must use this |
| Floating chat widget | ✅ | Renders for all authenticated users globally |
| Multi-language i18n (5 locales) | ✅ | en, hi, ta, te, kn — all must be updated together |
| Responsive CSS (4 breakpoints) | ✅ | 1200 / 768 / 640 / 480px |
| Socket.IO real-time messaging | ✅ | |
| Demo data seeding | ✅ | `docker/seed-demo-data.sql` |
| Demo password auto-fix on startup | ✅ | `fixDemoPasswords.ts` runs every server start |

## Deployment & CI/CD

| Feature | Status | Notes |
|---------|--------|-------|
| Render.com DEV + DEMO services | ✅ | vetcare-dev (develop) + vetcare-demo (demo branch) |
| GitHub Actions CI/CD promotion | ✅ | develop → demo via "Promote DEV to Demo" workflow |
| DB schema separation | ✅ | vetcare_dev (Render Postgres) / vetcare_demo (Neon PostgreSQL) |
| Neon PostgreSQL for Demo | ✅ | Permanent free tier, never expires — `neondb` project, ap-southeast-1 |
| Cloudinary for Demo | ✅ | Cloud: dd8dcwzxz — env set via GitHub Actions |
| Automated Demo env setup | ✅ | setup-demo-env.yml — calls Render API, no dashboard needed |
| render-build.sh | ✅ | Builds frontend (Vite) then backend (tsc) |
| render-start.sh with timeout guards | ✅ | All node subprocesses have timeout + connectionTimeoutMillis |
| HTTP port bound before DB connect | ✅ | Fixed 2026-04-07 — critical for free-tier Render health check |
| connectWithRetry (5 attempts × 10s) | ✅ | Added 2026-04-06 |

### Branch → Environment Mapping
| Branch | Environment | Render Service | DB |
|--------|------------|----------------|----|
| `develop` | Dev | `vetcare-dev` | Render Postgres (vetcare_dev schema) |
| `demo` | Demo | `vetcare-demo` | Neon PostgreSQL (vetcare_demo schema) |
| `main` | Archive only | none | — |

### Demo Environment GitHub Secrets (required)
| Secret | Purpose |
|--------|---------|
| `RENDER_API_KEY` | Render Account → API Keys |
| `RENDER_DEMO_SERVICE_ID` | From Render service URL (`srv-xxx`) |
| `DEMO_DATABASE_URL` | Neon connection string |
| `DEMO_JWT_SECRET` | `MGK_wYpUugWh3T5okMqk1GntXnXqIywml2CcN7V0I9MV8nkIFE_JFe5H4WRd_M4F` |
| `CLOUDINARY_URL` | `cloudinary://914841916273552:iKt-RX_vRyiCuGO1rmyFkISAR3o@dd8dcwzxz` |
| `RENDER_DEPLOY_HOOK_DEMO` | Render → vetcare-demo → Settings → Deploy Hooks |

## Pet Owner Module

| Feature | Status | Notes |
|---------|--------|-------|
| Dashboard | ✅ | |
| Animals (CRUD + profiles) | ✅ | Species expanded: 10 → 40+ (India-focused breeds, grouped optgroup dropdown) |
| Medical Records | ✅ | Deep navigation: `/medical-records?animalId=X&recordId=Y` |
| Consultations (book, join, review) | ✅ | |
| AI Copilot | ✅ | Groq → OpenAI → local fallback |
| Marketplace | ✅ | Includes auto-populate listing from animal profile |
| Wellness tracker | ✅ | |
| Vet Hospitals / FindDoctor | ✅ | `useSettings()` time format; past slots filtered with 15-min buffer |
| Settings | ✅ | |
| Vaccine reminders | ✅ | Daily job via `VaccineScheduleService` |

## Farmer Module

| Feature | Status | Notes |
|---------|--------|-------|
| Farm / Enterprise management | ✅ | |
| Analytics | ✅ | |
| Innovation | ✅ | |
| Breeding management | ✅ | |
| Feed management | ✅ | |
| Compliance | ✅ | |
| Financial | ✅ | |
| Herd Medical | ✅ | i18n namespace added to all 5 locale files |

## Veterinarian Module

| Feature | Status | Notes |
|---------|--------|-------|
| Consultations & schedule | ✅ | |
| Prescriptions | ✅ | Joi schema matches frontend form fields |
| Medical Records | ✅ | |
| Reviews | ✅ | |
| Herd Medical | ✅ | |
| Health Analytics | ✅ | |
| AI Copilot | ✅ | |
| Vet Hospitals | ✅ | |
| Inpatient Search | ✅ | SQL columns verified against init.sql |
| Vet Certificates | ✅ | Farm extension: 4 new farm types + movement/herd detail fields (2026-04-09) |

## Admin Module

| Feature | Status | Notes |
|---------|--------|-------|
| Full access to all modules | ✅ | Bypasses frontend permission checks |
| Admin Settings panel | ✅ | time/date/currency/join window globally enforced |
| User management | ✅ | |

---

## ✅ Completed — Phase 0: DB Cleanup & Restructuring (2026-04-09)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| P0-1 | Fix missing enterprise_members table in init.sql | ✅ Done | Already existed — verified (2026-04-09) |
| P0-2 | Convert enterpriseMigration.ts → migrations/005_farm_enterprises.sql | ✅ Done | SQL migration file already existed; dead TS file deleted (commit 76d9e20) |
| P0-3 | Convert tier2Migration.ts → migrations/006_tier2_features.sql | ✅ Done | SQL migration file already existed; dead TS file deleted (commit 76d9e20) |
| P0-4 | Convert tier3Migration.ts → migrations/007_tier3_features.sql | ✅ Done | SQL migration file already existed; dead TS file deleted (commit 76d9e20) |
| P0-5 | Convert tier4Migration.ts → migrations/008_tier4_features.sql | ✅ Done | SQL migration file already existed; dead TS file deleted (commit 76d9e20) |
| P0-6 | Update render-start.sh to use migrate.js for all migrations | ✅ Done | render-start.sh already used migrate.js; old TS comment removed; Step 1b added (commit 76d9e20) |
| P0-7 | Split seed-demo-data.sql into platform_required + demo layers | ✅ Done | docker/seeds/01_platform_required.sql created + wired into render-start.sh Step 1b (commit 76d9e20) |

## ⚠️ Planned Items — Phase 1: Enterprise Hospital Network Foundation

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| P1-1 | hospital_networks + supporting tables in init.sql + migration | ✅ Done | 6 tables added to init.sql + migration 009 |
| P1-2 | HospitalNetworkService + routes | ✅ Done | HospitalNetworkService.ts + HospitalNetworkController.ts + 17 routes |
| P1-3 | corporate_admin + hospital_director roles — 4-file sync | ✅ Done | Permissions + navigation + App.tsx synced (2026-04-09) |
| P1-4 | Hospital data isolation middleware | ✅ Done | hospitalDataIsolation.ts — checkAnimalAccess, requireAnimalAccess middleware, logClinicalAccess. Applied to /animals/:id, /consultations/animal/:id, /prescriptions/animal/:id, /vaccinations/animal/:id. Access-check endpoint added (2026-04-08) |
| P1-6 | 6-digit VC-IDs + per-network patient ID system | ✅ Done | VC-IDs upgraded to 6-digit (VC-DOG-26-000001). id_prefix on hospital_networks. network_patient_id_sequences table. enrollAnimal()/getNetworkPatients() in service. 3 new routes. Frontend form + badge. Migration 010. |
| P1-5 | Corporate Admin — Hospital Network Management UI | ✅ Done | HospitalNetworks.tsx — 3-tab UI: Networks list/stats/approve, Network Detail (dashboard+hospitals+members), Audit Tab fully implemented (2026-04-09) |
| P1-6 | Patient Consent Management UI (pet_owner + farmer) | ✅ Done | PatientConsent.tsx — 2-panel layout, 6-dim consents, CSS toggles, presets (2026-04-08) |
| P1-7 | Demo hospital network seed data | ✅ Done | DemoVetGroup + demo hospitals + corporate_admin in seed-demo-data.sql |

### Architecture Decisions (Locked)
- Farm `enterprises` table and `hospital_networks` are COMPLETELY SEPARATE — never merged
- Hospital data: opt-in, private by default, isolation enforced at SQL level
- Multiple networks: each (Apollo, NH1, TN Govt) registers independently
- Corporate admin: direct access to own network, every access immutably audit-logged
- Dual patient ID: `VC-DOG-26-00001` (platform) + `APOLLO-P-00423` (corporate)
- Patient consent: 6-dimension granular, `include_hospital_records` defaults to `false`

---

## Recently Completed (last 10)

1. ✅ Role Change Request System (2026-04-10)
   - Users can request role changes from Settings → "Role & Account Type" section
   - Admin approves/rejects from UserManagement → "Role Change Requests" tab
   - DB: role_change_requests table (init.sql table 42 + runtime migration in database.ts)
   - DB: users.role CHECK constraint updated to include corporate_admin (DROP/ADD constraint migration)
   - Backend: 6 endpoints — submit/my/cancel/admin-list/approve/reject
   - Frontend: Settings.tsx — request form, pending/approved banners, history table, re-login prompt
   - Frontend: UserManagement.tsx — full requests tab with approve/reject + reject modal
   - api.ts + adminApi.ts — 6 new API methods
   - Fix: UserManagement 'vet' → 'veterinarian' long-standing bug in filter/badge/modal
   - Fix: adminApi.ts template literals corrupted by PowerShell → fixed in api.ts class
   - All 5 locales: settings.roleChange.* (34 keys) + adminRoleRequests.* namespace
   - Commit: 1a1553c

2. ✅ Comprehensive Species Expansion — 10 → 40+ species (2026-04-09)
   - Animals.tsx: BREED_DATABASE expanded to 40+ species with India-focused breeds
   - SPECIES_CATEGORIES added for grouped optgroup dropdowns (10 category groups)
   - SPECIES_ICONS: emoji for all 40+ species
   - EAR_TAG_SPECIES: expanded to include all farm/livestock/exotic large
   - AnimalService.ts: getSpeciesCode() covers all 40+ species → 3-letter codes
   - HospitalNetworkService.ts: SPECIES_CODES dict expanded to match
   - seed-demo-data.sql: 6 new demo animals (Parrot, Tortoise, Arowana, Hamster, Peacock, Emu)
   - All 5 locale files: speciesCategories translations (10 groups)
   - Species groups: Common Pets / Small Pets / Birds / Reptiles / Amphibians / Ornamental Fish / Livestock / Poultry / Exotic Large / Other
2. ✅ Privacy-First Hospital Patient Onboarding — Consent-Before-Access (2026-04-09)
   - HARD RULE: Hospital requests enrollment → patient must approve → data flows only after
   - DB: enrollment_status (pending_consent/active/declined/revoked) on animal_care_contexts
   - DB: hospital_patient_invites table (walk-in patients, 72hr crypto token, expiry tracking)
   - Migration 011 + database.ts safety nets
   - HospitalNetworkService: 7 new methods (searchPatients, enrollAnimal updated, acceptEnrollment, declineEnrollment, getMyEnrollments, inviteWalkInPatient, getPendingEnrollments)
   - 6 new API routes: search-patients, all-enrollments, invite-walkin, accept, decline, my-network-enrollments
   - HospitalNetworks.tsx: new Patients tab (smart search, walk-in invite modal, enrollment list with filter tabs)
   - NetworkMemberships.tsx: new pet_owner page (pending approvals with consent level selector, active memberships, past/declined)
   - 4-file permission sync: network_membership_manage for pet_owner + farmer
   - All 5 locale files: networkMemberships namespace + hospitalNetworks.patients section
   - lessons.md: LESSON-029/030/031 — consent-before-access, walk-in invite pattern, dual-ID system
2. ✅ Animal Unique ID — 6-digit upgrade + Per-network patient ID series (2026-04-08)
   - Platform VC-IDs upgraded: VC-DOG-26-000001 (was 5-digit)
   - Per-network IDs: PREFIX-DOG-26-000042 (e.g. APOLLO-DOG-26-000042)
   - New table: network_patient_id_sequences (race-safe per-network/species/year counter)
   - hospital_networks.id_prefix VARCHAR(10) added (init.sql + migration 010 + database.ts safety net)
   - HospitalNetworkService: generateNetworkPatientId(), enrollAnimal(), getNetworkPatients()
   - 3 new routes: POST /hospital-networks/:id/enroll-animal, GET .../patients, GET /animals/:id/care-contexts
   - HospitalNetworks.tsx: id_prefix field in network creation form + badge on cards
   - database.ts backfill: re-generates old 5-digit IDs to 6-digit on server startup
   - All 5 locale files: idPrefix, networkPatientId, enrollPatient, enrolledPatients keys
   - seed-demo-data.sql: demo network gets id_prefix = 'DEMO'
2. ✅ P0 DB Cleanup (2026-04-09) — commit 76d9e20
   - Deleted 4 dead TS migration files (enterpriseMigration.ts, tier2-4Migration.ts) — replaced by SQL files 005-008
   - Added render-start.sh Step 1b: loads 01_platform_required.sql (admin + settings + permissions) on every deploy
   - Fixed seed-demo-data.ts stale warning pointing to old TS migration commands
2. ✅ Certificate Farm Extension (2026-04-09)
   - 4 new farm cert types: movement_permit, herd_health_certificate, slaughter_fitness, export_health_certificate
   - CertificateService.ts: new types in VALID_CERT_TYPES + movementDetails/herdDetails JSONB support
   - CertificateWriter.tsx: enterprise animals loading (by enterpriseId when farm cert selected), movement fields UI, herd fields UI, herd certs allow optional animal
   - CertificatePrintView.tsx: movement + herd detail sections rendered
   - VetCertificates.tsx: 4 new types in filter dropdown
   - database.ts: ALTER TABLE safety nets for movement_details + herd_details columns
   - All 5 locale files: new cert type labels + all new field labels
2. ✅ Animal Unique ID (VC-{SPE}-{YY}-{NNNNN}) — full system complete (2026-04-09)
   - database.ts: backfill for all existing animals without VC-IDs on server startup
   - PrescriptionService.ts: animalUniqueId in all prescription listing queries
   - MarketplaceService.ts: JOIN animals on linked_animal_id → animal_unique_id in listings
   - VaccinationPassport.tsx: VC-ID badge (copy-to-clipboard) + in print template
   - Marketplace.tsx: VC-ID badge on sell form + on listing cards
   - types/index.ts: animalUniqueId added to MarketplaceListing type
2. ✅ HospitalNetworks.tsx Audit Tab (Tab 3) — stats row, filter bar, paginated table, CSV export, empty/loading states (2026-04-09)
3. ✅ PatientConsent.tsx full UI — 2-panel layout, 6-dim consent, CSS toggle switches, presets (2026-04-08)
4. ✅ HospitalNetworks.tsx full UI — 3-tab admin dashboard, network CRUD, member/hospital management (2026-04-08)
5. ✅ api.ts — 14 new methods for hospital networks + patient consent (2026-04-08)
6. ✅ Hospital Network 4-file permission sync — `hospital_network_manage/view/audit`, `patient_consent_manage` (2026-04-09)
7. ✅ Empty-state shortcuts — contextual navigation buttons across BookConsultation, MedicalRecords, WellnessPortal (2026-04-08)
8. ✅ Fix Render deploy — HTTP port bound FIRST before DB connect (2026-04-07)
9. ✅ render-start.sh — tighten timeouts: connectionTimeoutMillis 30000→15000, migrations 60→40s (2026-04-07)
10. ✅ connectWithRetry() — 5 attempts × 10s for free-tier Render PostgreSQL (2026-04-06)

11. ✅ Privacy-First Hospital Patient Onboarding — consent-before-access system (2026-04-09)
   - CONSENT-BEFORE-ACCESS: hospitals REQUEST enrollment, patients APPROVE/DECLINE
   - enrollment_status column on animal_care_contexts (pending_consent/active/declined/revoked)
   - hospital_patient_invites table (72hr token, walk-in patient invite system)
   - Migration 011 + database.ts ALTER TABLE safety nets
   - HospitalNetworkService: searchPatients, acceptEnrollment, declineEnrollment, getMyEnrollments, inviteWalkInPatient, getPendingEnrollments
   - 6 new backend API routes (search, all-enrollments, invite-walkin, accept, decline, my-network-enrollments)
   - api.ts: 7 new methods (enrollAnimalInNetwork + 6 new)
   - HospitalNetworks.tsx: Patients tab (Section A: smart search, Section B: invite modal, Section C: enrollment table with status badges)
   - NetworkMemberships.tsx: pet owner page (pending requests with consent selector, active memberships, past memberships)
   - NetworkMemberships.css: responsive 4-tier breakpoints, privacy-focused design
   - 4-file permission sync: network_membership_manage for pet_owner + farmer
   - All 5 locale files: networkMemberships namespace + hospitalNetworks.patients section
   - memories/repo/lessons.md: LESSON-029/030/031 (consent-before-access, dual-ID system, 72hr token)

## Hospital Staff System + Seat Licensing + Pricing Visibility

| Feature | Status | Notes |
|---------|--------|-------|
| hospital_staff user role | ✅ | Invite-only, cannot self-register |
| Hospital staff invite system | ✅ | Token-based 72hr invite, seat-gated |
| Seat licensing / user quota | ✅ | Per-network subscription with seat_limit enforcement |
| Network subscription plans | ✅ | 5 default plans (Trial/Starter/Growth/Enterprise/Unlimited), all private by default |
| Platform admin network subscriptions UI | ✅ | /admin/network-subscriptions — 3 tabs: Networks, Plans, Pricing Visibility |
| Private pricing visibility system | ✅ | Global toggle + per-plan + per-section; all prices in DB only, never hardcoded |
| usePricing() hook | ✅ | Reads /pricing/plans; returns isVisible, plans, ctaText |
| AcceptHospitalInvite page | ✅ | /accept-hospital-invite?token=XXX — public, no auth required |
| Network suspend/unsuspend | ✅ | Admin-only; suspended staff get 403, pet owners unaffected |
| 4-file permission sync | ✅ | hospital_network_subscription + hospital_staff_invite perms |

### DB Tables Added
- `network_subscription_plans` — plan tiers with prices (NULL = not set yet), is_published flag
- `network_subscriptions` — per-network subscription + seat limit (UNIQUE(network_id))
- `hospital_staff_invites` — invite tokens with 72hr expiry, seat check at send + accept

### API Endpoints Added (15 total)
- GET/POST/PUT/DELETE /admin/network-subscription-plans
- GET /admin/network-subscriptions
- POST /admin/networks/:id/set-subscription
- PUT /admin/networks/:id/override-seat-limit
- POST /admin/networks/:id/suspend + unsuspend
- GET /pricing/plans (public)
- GET/PUT /admin/pricing-settings
- GET /my-network-subscription
- POST /hospital-networks/:id/invite-staff
- GET /hospital-staff-invites/token/:token (public)
- POST /hospital-staff-invites/accept (public)
- GET/DELETE /hospital-networks/:id/staff-invites

### Key Rules
- Seat check runs at BOTH invite-send time AND invite-accept time (race condition protection)
- Suspended network: all staff get 403, corporate_admin blocked, pet owners unaffected
- Pricing: NEVER hardcode prices — all stored in DB, fetched via /pricing/plans API
- hospital_staff role: added to users.role CHECK in BOTH init.sql (fresh install) AND database.ts safety-net (existing DBs) — must keep both in sync
- admin_staff position: added to staff_positions.position CHECK in both init.sql and database.ts
- Dynamic SQL in plan update route: uses allowedFields whitelist (SEC-001 fix)
- All 5 locale files: adminNetworkSubscriptions + hospitalStaff + seatLimit namespaces
- HospitalNetworks.tsx: "Invite Staff" button in Members panel → modal → calls POST /hospital-networks/:id/invite-staff
- Codebase scan (session b4fd6b6e) fixed: SQL injection, duplicate constraint, formatPrice locale bug, hospital_staff nav gap, date formatting violations

### ✅ Hospital Visits tab in Medical Records
- **Logged:** 2026-04-12 14:09
- **Status:** done
- **Description:** New Hospital Visits tab in Medical Records page shows queue visits + inpatient admissions. Auto-creates medical record on queue discharge. Auto-creates Clinical Case when Start Exam clicked. backend route GET /animals/:animalId/hospital-visits added. All 5 locale files updated.


### ✅ Verified-Only Review System
- **Logged:** 2026-04-12 16:30
- **Status:** done
- **Description:** Complete overhaul: consultation-linked reviews with ownership validation, vet context banner, 2-step WriteReview flow, helpful/report/vet-response endpoints, flag/unflag moderation, isPublic submission fix, total_reviews bug fix, UNIQUE constraint DB safety net, all 5 locales updated


### ✅ Farmer module phase 2
- **Logged:** 2026-04-13 10:12
- **Status:** done
- **Description:** Completed remaining farmer gaps: movement approval UI (status badge + approve/reject buttons for farmers), enterprise dashboard stats (4 stat cards + quick farm actions), member management (invite by email, role update, remove), groups dropdown in TreatmentCampaigns, backend invite-member route, approveMovement API method


### ✅ Farmer/Enterprise Integration Gaps
- **Logged:** 2026-04-13 10:22
- **Status:** done
- **Description:** Added enterprise/group context (enterpriseName, enterpriseType, groupName, groupType) to getQueue(), listInpatients(), listWorkflowCases() in StaffWorkflowService. Added group-belongs-to-enterprise validation in BookingService. Added farm_visit and herd_consultation booking types to Joi validation and database constraint.


### ✅ Farmer/Enterprise UI Integration
- **Logged:** 2026-04-13 10:26
- **Status:** done
- **Description:** Added enterprise/farm badges (enterpriseName, groupName) to HospitalWorkflow queue list, InpatientManagement patient cards, DoctorDashboard pending+upcoming bookings, ConsultationRoom animal info panel. Added farm_visit booking type option in BookConsultation for farmer role / enterprise mode. Added enterprise filter dropdown in MedicalRecords for vet/admin roles using useMemo-computed enterprise list.


### ✅ Farm-Vet Integration
- **Logged:** 2026-04-13 10:34
- **Status:** done
- **Description:** Vets and hospital staff now see enterprise/farm context in queue, inpatient, bookings, consultation room, and medical records. Farm Visit booking type added. Enterprise filter in MedicalRecords for vets/admins.


### ✅ HospitalNetworks UX/i18n fixes
- **Logged:** 2026-04-13 11:00
- **Status:** done
- **Description:** Fix 1: AssignHospitalModal loading/error states. Fix 2: staff invite success key update. Fix 3: academic->cooperative already done. Fix 4: Already Enrolled badge. Fix 5: missing i18n keys in all 5 locales. Fix 6: hardcoded strings -> t() calls. Fix 7: deactivateNetwork API + UI button.


### ✅ Network Referral System
- **Logged:** 2026-04-13 11:24
- **Status:** done
- **Description:** Full cross-hospital network referral backend: network_referrals table (with indexes), 3 service methods (create/updateStatus/list), 3 controller methods, 3 routes (GET/POST /network-referrals, PATCH /network-referrals/:id/status), and Joi validation schema createNetworkReferralSchema


### ✅ networkReferrals i18n namespace
- **Logged:** 2026-04-13 11:29
- **Status:** done
- **Description:** Added networkReferrals top-level namespace to all 5 locale files (en/hi/ta/te/kn) with 40+ keys covering referral CRUD UI, status labels, priority levels, and confirmation dialogs. Inserted alphabetically between hospitalNetworks and patientConsent.


### ✅ Hospital Networks — Referrals Tab
- **Logged:** 2026-04-13 11:38
- **Status:** done
- **Description:** Added Referrals (TAB 5) to HospitalNetworks.tsx: direction filter (incoming/outgoing/all), referrals table with accept/reject modals, create referral modal. Added 3 API methods to api.ts: createNetworkReferral, updateNetworkReferralStatus, listNetworkReferrals. All translations already existed in all 5 locale files.


### ✅ Network Referral UI Integration
- **Logged:** 2026-04-13 13:54
- **Status:** done
- **Description:** Added referral UI to 4 frontend pages: ConsultationRoom (Refer to Network button + modal with disabled-state UX), MedicalRecords (Network Referral History table in hospitalVisits tab), HospitalWorkflow (Referred-from-Network badge on queue entries), InpatientManagement (Referred-from-Network badge on patient cards)


### ✅ Hospital Network Cross-Module Referrals
- **Logged:** 2026-04-13 13:54
- **Status:** done
- **Description:** Full network referral system: network_referrals table (DB), createNetworkReferral/updateNetworkReferralStatus/listNetworkReferrals services+routes, Referrals tab in HospitalNetworks (incoming/outgoing/all + accept/reject), Refer to Network button in ConsultationRoom, Referral history in MedicalRecords hospitalVisits tab, Referred-from-Network badge in HospitalWorkflow + InpatientManagement. All 5 locales: networkReferrals namespace.


### ✅ corporate-admin backend fixes
- **Logged:** 2026-04-13 16:24
- **Status:** done
- **Description:** Restrict network approval to admin-only route + self-approval guard; add getCorporateDashboardStats + createBranchHospital to HospitalNetworkService; branch hospital columns in init.sql/database.ts; filter branch hospitals from public listing; GET /dashboard/corporate and POST /hospital-networks/:id/branch-hospitals routes


### ✅ corporate_admin frontend fixes
- **Logged:** 2026-04-13 16:35
- **Status:** done
- **Description:** Nav: removed Vet Hospitals from corporate_admin. Dashboard: isCorporateAdmin branch with corpStats, stat cards, quick actions, subtitle. HospitalNetworks: Approve button admin-only, Pending badge for others, AssignHospitalModal replaced by CreateBranchHospitalModal (full form), showAssignHospital->showCreateBranch. api.ts: getCorporateDashboardStats + createBranchHospital. i18n: 5 locales updated with corporateAdmin subtitle, network stats keys, hospitalNetworks quickAction, manageSettings desc.


### ✅ Walk-in patient registration in check-in modal
- **Logged:** 2026-04-18 13:13
- **Status:** done
- **Description:** Network hospital staff can register new walk-in patients directly from the Check In Patient modal. Collects owner name/phone/email + animal name/species/breed, calls /hospital-networks/:networkId/register-walkin, auto-selects animal for immediate check-in. Only shown when hospital.branchNetworkId is set.


### ✅ Walk-in Registration Form Expansion
- **Logged:** 2026-04-19 12:17
- **Status:** done
- **Description:** Full animal attributes + photo upload added to hospital walk-in form. Fields: gender, DOB, weight, color, microchip ID, registration number, is_neutered, medical_notes, owner address, avatar_url. All optional except ownerName, animalName, animalSpecies. Base64 photo stored in animals.avatar_url. All 6 locale files updated.


### ✅ Walk-in Form — Ear Tag + Smart Breed Dropdown
- **Logged:** 2026-04-19 12:41
- **Status:** done
- **Description:** Species dropdown now uses grouped optgroups (Pets/Farm/Exotic). Breed field shows smart dropdown when breeds exist for selected species; 'Other' shows custom breed text input. Ear tag ID field appears conditionally for livestock species. All 6 locale files updated. 18-param SQL INSERT complete.


### ✅ Network Hospital Role Access Matrix
- **Logged:** 2026-04-19 13:52
- **Status:** done
- **Description:** Static matrix showing 5 network roles (corporate_admin, hospital_director, compliance_officer, auditor, hospital_staff) x 15 features across 6 categories. Added as tab in HospitalNetworks.tsx and PermissionManagement.tsx. Also fixed backend enforcement gaps: updateNetwork restricted to corporate_admin, getAuditLogs restricted to management roles. hospital_staff added to all PermissionService role lists. corporate_admin gained hospital_workflow+inpatient_manage permissions. All 6 locale files updated.


### ✅ Editable Network Role Permissions
- **Logged:** 2026-04-19 14:29
- **Status:** done
- **Description:** DB-backed network role permission matrix: admin can click cells to toggle access per role/action. Enforced via DB in HospitalNetworkController. 17 actions x 5 roles. Platform-only actions locked.


### ✅ Network Role Matrix (per-network scoped)
- **Logged:** 2026-04-19 16:03
- **Status:** done
- **Description:** Role access matrix for hospital network roles, scoped per network_id. Editable only within Hospital Networks section (not PermissionManagement). Each network has its own permission rows in network_role_permissions table with UNIQUE(network_id, network_role, action). Falls back to code defaults for networks with no DB rows. Tab only visible when a network is selected.


### ✅ Hospital Network Security Hardening
- **Logged:** 2026-04-19 16:59
- **Status:** done
- **Description:** 6 security/bug fixes: vet permissions for hospital_network_manage+patient_consent_manage; walk-in invite membership check; enrollAnimal ownership+consent check with notification; walk-in registration consent tracking; inpatient network scoping with branch_network_id check; notifications wired into approve/addMember/removeMember/createReferral controller methods


### ✅ P2-HIGH2 Hospital Assignment Consolidation
- **Logged:** 2026-04-19 17:11
- **Status:** done
- **Description:** Replaced dual-path hospital assignment (vet_hospitals flags + junction table UNION) with canonical branch_network_id path. assignHospitalToNetwork now writes both paths atomically. listNetworkHospitals uses single canonical query eliminating duplicates. Added network_id column to inpatient_admissions in init.sql.


### ✅ P2-HIGH4 Network Origin Badge for Walk-in Animals
- **Logged:** 2026-04-19 17:11
- **Status:** done
- **Description:** listAnimalsByOwner now uses correlated subqueries to add networkId, networkName, networkEnrollmentStatus, networkVisibility fields. Uses most-recently-enrolled active context per animal. Safe additive approach, no duplicates.


### ✅ P2-GAP1 Network Security Audit Trail
- **Logged:** 2026-04-19 17:11
- **Status:** done
- **Description:** Added network_security_audit table to init.sql and database.ts migrations. Added logAudit method to HospitalNetworkService. Wired audit calls in HospitalNetworkController for addNetworkMember, removeNetworkMember, updateNetwork. Added GET /hospital-networks/:networkId/security-audit route with role check.


### ✅ P2-GAP3 Time-Bound Network Member Permissions
- **Logged:** 2026-04-19 17:11
- **Status:** done
- **Description:** Added valid_from/valid_until columns to hospital_network_members in init.sql and database.ts migrations. getNetworkMember and listNetworkMembers filter out expired memberships. addNetworkMember accepts validUntil param. Joi schema updated. Controller passes validUntil to service.


### ✅ P2 Network Hospital Security
- **Logged:** 2026-04-19 17:14
- **Status:** done
- **Description:** Consolidated dual hospital-assignment paths, added network-origin badge to animal list, implemented security audit trail table+wiring, added time-bound permissions (valid_from/valid_until) on network members


### ✅ P3-CRITICAL1: network_id on medical tables
- **Logged:** 2026-04-19 17:24
- **Status:** done
- **Description:** Added network_id UUID FK to consultations, prescriptions, medical_records, lab_results, vaccination_records, workflow_cases, video_sessions — both in docker/init.sql (column + index) and database.ts runtime migrations


### ✅ P3-HIGH5: Network badge on consultations
- **Logged:** 2026-04-19 17:24
- **Status:** done
- **Description:** ConsultationService.listConsultations now joins hospital_networks and returns networkId/networkName. ConsultationController passes networkId query param. ConsultRow interface updated. History tab shows hospital network badge.


### ✅ P3-GAP4: POST staff invite route
- **Logged:** 2026-04-19 17:24
- **Status:** done
- **Description:** Added POST /hospital-networks/:id/staff-invites route with role/network checks, duplicate detection, token generation, and email send via emailService.send(). Uses EmailService.send() not sendEmail().


### ✅ P3 Network Hospital Data Integrity
- **Logged:** 2026-04-19 17:26
- **Status:** done
- **Description:** Added network_id column to 7 medical tables (consultations, prescriptions, medical_records, lab_results, vaccinations, workflow_cases, video_sessions); consultation network context badge in UI; staff invite POST endpoint


### ✅ P3-GAP2: Dynamic Custom Roles per Hospital Network
- **Logged:** 2026-04-20 00:01
- **Status:** done
- **Description:** Added network_custom_roles table (init.sql + database.ts safety net). Extended NetworkRolePermissionService with getNetworkRoles, createCustomRole, updateCustomRole, deactivateCustomRole, getRoleIcon, and updated checkAccess/getMatrix for custom role fallback. Added 4 CRUD routes in routes/index.ts. Added 4 API methods in frontend/src/services/api.ts. Added Custom Roles UI section in NetworkRoleMatrix.tsx. Updated all 6 locale files with customRoles, createCustomRole, roleKey, displayName, baseTemplate, noCustomRoles keys.


### ✅ P3-GAP2 Dynamic Custom Roles
- **Logged:** 2026-04-20 00:03
- **Status:** done
- **Description:** network_custom_roles table + CRUD API + NetworkRoleMatrix UI. Custom roles inherit base_template permissions, can override per-action in network_role_permissions table. Corporate admins and hospital directors can create/edit/deactivate custom roles.


### ✅ P4-HIGH1 Dual Role System
- **Logged:** 2026-04-20 00:48
- **Status:** done
- **Description:** user_roles table, secondary role management via admin UI, multi-role nav/permission merging, roles[] in JWT response


### ✅ P4-MED1 Per-Branch Consent
- **Logged:** 2026-04-20 00:48
- **Status:** done
- **Description:** animal_care_contexts.hospital_id safety-net ALTER, consent scope badge in NetworkMemberships (All Branches vs specific hospital)


### ✅ P4-MED2 Unified Referral System
- **Logged:** 2026-04-20 00:48
- **Status:** done
- **Description:** referrals.network_referral_id + network_referrals.platform_referral_id FK, GET /animals/:id/referrals unified endpoint, MedicalRecords shows type badges


### ✅ P6-APPROVAL: Network Approval Workflow
- **Logged:** 2026-04-20 01:33
- **Status:** done
- **Description:** Multi-level approval workflow with network_approval_events table, tracked history timeline in frontend, admin actions (Request Info/Approve/Reject/Suspend), corporate_admin read-only history view, notifications on info_requested


### ✅ P6-BRANDING: Network Branding Settings
- **Logged:** 2026-04-20 01:33
- **Status:** done
- **Description:** Corp admins can set logo (base64), contact info, website, operating hours (day-by-day), specializations (chip-select), emergency services toggle via PUT /hospital-networks/:id/branding


### ✅ P6-NOTIFICATIONS: Weekly Digest Email
- **Logged:** 2026-04-20 01:33
- **Status:** done
- **Description:** Weekly Monday 08:00 UTC digest job in scheduler.ts, sendNetworkDigest in NotificationService, digest_emails_enabled on users table, GET/PUT /notification-preferences routes, Settings.tsx preference panel


### ✅ P4 - Dual Role System + Per-Branch Consent + Unified Referrals
- **Logged:** 2026-04-20 03:03
- **Status:** done
- **Description:** user_roles table with secondary roles; AuthContext hasRole() multi-role; Nav multi-role filtering; per-branch consent hospital_id on animal_care_contexts; unified referrals GET /animals/:id/referrals merging platform + network referrals


### ✅ P5 - Network Analytics + Patient Search + Compliance Export
- **Logged:** 2026-04-20 03:03
- **Status:** done
- **Description:** GET /hospital-networks/:id/analytics (8 stats + trend); enhanced network-wide patient search with consent filter + deep-link; GET /hospital-networks/:id/compliance-report with date range JSON export UI


### ✅ P6 - Approval Workflow + Network Branding + Notification Digest
- **Logged:** 2026-04-20 03:03
- **Status:** done
- **Description:** network_approval_events table + tracked approval timeline + info-request flow; network logo/contact/hours/specializations settings; weekly digest email service + notification preferences settings


### ✅ Auto-Refresh System
- **Logged:** 2026-04-21 10:45
- **Status:** done
- **Description:** useAutoRefresh hook (interval + socket push), socketIO role rooms, emitDataRefresh/emitRoleRefresh/emitBroadcastRefresh exports, 12 mutation routes instrumented (bookings, consultations, animals, prescriptions, inpatients, marketplace)


### ✅ useAutoRefresh hook integration
- **Logged:** 2026-04-21 10:55
- **Status:** done
- **Description:** Applied useAutoRefresh hook to 17 React pages for silent background refresh (30s interval + socket push): Dashboard, AdminDashboard, DoctorDashboard, Consultations, Animals, InpatientManagement, PatientQueue, Marketplace, Prescriptions, HospitalNetworks, MyBookings, AlertCenter, HospitalWorkflow, Wallet, UserManagement, HospitalBooking, MedicalRecords. Note: for const-declared functions (not useCallback), useAutoRefresh must be placed AFTER the function declaration to avoid TS2448 used-before-declaration errors.


### ✅ Auto-Refresh System
- **Logged:** 2026-04-21 10:59
- **Status:** done
- **Description:** 30s polling + socket push across 17 pages. useAutoRefresh hook + emitDataRefresh/emitRoleRefresh/emitBroadcastRefresh. Backend routes emit data:refresh on mutations. Users join role rooms on socket auth.


### ✅ Admin Password Reset
- **Logged:** 2026-04-22 07:20
- **Status:** done
- **Description:** POST /admin/users/:id/reset-password with bcrypt hashing + audit log; UI modal in UserManagement.tsx


### ✅ Admin Wallet Summary
- **Logged:** 2026-04-22 07:20
- **Status:** done
- **Description:** GET /admin/wallet-summary aggregates wallet stats + top-10 balances; Wallet Overview tab in PaymentManagement.tsx


### ✅ H2 Auto Medical Record on Consultation Complete
- **Logged:** 2026-04-22 07:29
- **Status:** done
- **Description:** When consultation status changes to completed, ConsultationController auto-creates an 'other' type medical record with consultation summary. Uses actual DB columns (user_id, content, animal_id, veterinarian_id, consultation_id). Added safety-net ALTER TABLE migration in database.ts.


### ✅ H3 Walk-in Patient Duplicate Detection
- **Logged:** 2026-04-22 07:29
- **Status:** done
- **Description:** Added microchip_id exact match and name+species+phone fuzzy duplicate checks before registerWalkInPatientDirect(). Returns 409 with existing record info and isDuplicateWarning flag.


### ✅ H5 hospital_director Member Edit Scope
- **Logged:** 2026-04-22 07:29
- **Status:** done
- **Description:** PUT /hospital-networks/:id/members/:userId now restricts hospital_director to only edit members in their own branch hospital. Also blocks hospital_director from assigning corporate_admin role.


### ✅ H6 Staff Invite In-App Notifications
- **Logged:** 2026-04-22 07:29
- **Status:** done
- **Description:** Added in-app notification via NotificationService to both invite-staff and staff-invites routes when invitee already has an account. Added invite_status VARCHAR(20) migration to hospital_network_members. Fixed code order in invite-staff route so networkName is defined before notification.


### ✅ H7 Patient Transfer Verification
- **Logged:** 2026-04-22 07:29
- **Status:** done
- **Description:** Verified patient transfer routes (POST/complete/GET) are fully implemented using network_referrals table with referral_type=transfer. No new table needed. createPatientTransfer validates both hospitals in network. completePatientTransfer updates animal_care_contexts.hospital_id.


### ✅ H8 Dispute Resolution
- **Logged:** 2026-04-22 07:50
- **Status:** done
- **Description:** Full dispute workflow: disputes table, CRUD API routes, DisputeManagement admin page with resolve modal, 4-file permission sync


### ✅ H9 Revenue Dashboard Charts
- **Logged:** 2026-04-22 07:50
- **Status:** done
- **Description:** Added /admin/revenue-trends endpoint with daily + top-vets data; AdminDashboard shows CSS bar chart + vet leaderboard


### ✅ H11 Vet Patient History Access
- **Logged:** 2026-04-22 07:50
- **Status:** done
- **Description:** Added Step 3.5 in checkAnimalAccess: vets with confirmed/pending/in_progress/completed booking for animal bypass hospital data isolation


### ✅ H12 Farmer Bulk Import
- **Logged:** 2026-04-22 07:50
- **Status:** done
- **Description:** Added /animals/bulk-import (POST) and /compliance/report (GET) endpoints; Animals.tsx CSV import UI with preview table + results modal


### ✅ M3 Maintenance Amber Banner
- **Logged:** 2026-04-22 10:19
- **Status:** done
- **Description:** Replace full-page maintenance block with dismissable amber banner in App.tsx. Non-admin users see amber banner; admin sees yellow bypass warning. Both are dismissable.


### ✅ M4 Leave Form i18n
- **Logged:** 2026-04-22 10:19
- **Status:** done
- **Description:** Leave form select options now use t() keys (annualLeave/sickLeave/personalLeave/emergencyLeave) instead of hardcoded English text.


### ✅ M6 Onboarding Locale Keys
- **Logged:** 2026-04-22 10:19
- **Status:** done
- **Description:** Added hospitalNetworks.onboarding and extended leave/auditLogs/systemSettings keys to all 6 locale files including ml which was missing the entire hospitalNetworks section.


### ✅ M7 Branch Hospital operatingHours and specializations
- **Logged:** 2026-04-22 10:19
- **Status:** done
- **Description:** BranchHospitalFormData interface, state, and form UI updated with chip-style specialization picker and operatingHours input. HospitalNetworkService.createBranchHospital INSERT updated to include operating_hours column.


### ✅ M11 Vet Earnings Dashboard
- **Logged:** 2026-04-22 11:18
- **Status:** done
- **Description:** VetEarnings.tsx + VetEarnings.css, /vet/earnings API, 4-file permission sync (vet_earnings permission), nav item in Consultations section


### ✅ M2 Email Templates UI
- **Logged:** 2026-04-22 11:18
- **Status:** done
- **Description:** Email template config in SystemSettings.tsx + GET/PUT /admin/email-templates routes backed by system_settings table


### ✅ M5 Department Assignment
- **Logged:** 2026-04-22 11:18
- **Status:** done
- **Description:** hospital_network_members.department column via ALTER TABLE IF NOT EXISTS, PUT route update, GET /departments endpoint, HospitalNetworks.tsx UI select


### ✅ M8 Vaccination Reminders
- **Logged:** 2026-04-22 11:18
- **Status:** done
- **Description:** Daily job in index.ts — queries vaccinations with next_due_date = TODAY+7, sends notifications via NotificationService with dedup check


### ✅ M9 Animal Health Passport PDF
- **Logged:** 2026-04-22 11:18
- **Status:** done
- **Description:** handleDownloadPassport in Animals.tsx — fetches vaccinations + medical records, generates HTML, opens print dialog


### ✅ M10 Cancel/Reschedule UI Clarity
- **Logged:** 2026-04-22 11:18
- **Status:** done
- **Description:** Reschedule btn for confirmed bookings in MyBookings.tsx, late-cancel policy notice, MyBookings.css


### ✅ M12 No-Show Marking
- **Logged:** 2026-04-22 11:18
- **Status:** done
- **Description:** PUT /bookings/:id/no-show route, PatientQueue no-show button for past confirmed/pending bookings


### ✅ M13 Certificates in MedicalRecords
- **Logged:** 2026-04-22 11:18
- **Status:** done
- **Description:** New certificates tab in MedicalRecords.tsx using /vet-certificates?animalId= endpoint

