import type { TFunction } from 'i18next'
import { MenuItem, User } from '../types'

/**
 * Every destination in the app, in menu order - the ONE list the sidebar, the phone bottom tab
 * bar and the quick-action sheet are all built from. Add a screen here once and it can be
 * offered anywhere; nothing else holds a second copy of a path, label or icon.
 *
 * `roles` says who may ever see an item; the live permission / feature-flag filtering happens in
 * useNavMenuItems(). Section order here IS the sidebar's render order.
 */
export function buildMenuItems(t: TFunction, user: User | null): MenuItem[] {
  const isPetOwner = user?.role === 'pet_owner'
  return [
    // ── Dashboard (always first, ungrouped) ──
    { id: 'dashboard', label: t('nav.dashboard'), icon: '📊', path: '/dashboard',
      roles: ['veterinarian', 'pet_owner', 'farmer', 'admin', 'corporate_admin', 'hospital_staff', 'pharmacist', 'groomer', 'support'], section: 'Main' },
    { id: 'marketplace', label: t('nav.marketplace'), icon: '🏪', path: '/marketplace',
      roles: ['farmer', 'admin', 'pet_owner', 'veterinarian'], section: 'Main' },

    // ── Consultation & Booking ──
    { id: 'consultations', label: t('nav.myConsultations'), icon: '🏥', path: '/consultations',
      roles: ['veterinarian', 'pet_owner', 'farmer', 'admin'], section: 'Consultations' },
    { id: 'find-doctor', label: t('nav.findDoctor'), icon: '🔍', path: '/find-doctor',
      roles: ['pet_owner', 'farmer'], section: 'Consultations' },
    { id: 'book-consultation', label: t('nav.bookConsultation'), icon: '📝', path: '/book-consultation',
      roles: ['pet_owner', 'farmer'], section: 'Consultations' },
    { id: 'manage-schedule', label: t('nav.mySchedule'), icon: '🗓️', path: '/doctor/manage-schedule',
      roles: ['veterinarian'], section: 'Consultations' },
    { id: 'prescriptions', label: t('nav.prescriptions'), icon: '💊', path: '/doctor/prescriptions',
      roles: ['veterinarian'], section: 'Consultations' },
    { id: 'prescriptions', label: t('nav.myPrescriptions'), icon: '💊', path: '/prescriptions',
      roles: ['pet_owner', 'farmer'], section: 'Consultations' },

    // ── Grooming & Spa ──
    // Sits directly after Consultations by design: both are "book a service for my animal"
    // journeys, so a customer scanning the menu finds them together instead of hunting past
    // the farm/analytics/network sections. Section order here IS the render order.
    { id: 'grooming-find', label: t('nav.groomingFind'), icon: '💈', path: '/grooming/find',
      roles: ['pet_owner', 'farmer'], section: 'Grooming & Spa' },
    { id: 'grooming-my-orders', label: t('nav.groomingMyOrders'), icon: '📅', path: '/grooming/my-orders',
      roles: ['pet_owner', 'farmer'], section: 'Grooming & Spa' },
    // Self-service onboarding entry. Same path as the console below - the page renders the
    // "create your business" form until a provider exists. Hidden once the user actually holds
    // grooming_provider_console (see the filter below) so the two never show at once.
    { id: 'grooming-apply', label: t('nav.groomingApply'), icon: '🏪', path: '/grooming/provider',
      roles: ['pet_owner', 'farmer', 'veterinarian'], section: 'Grooming & Spa' },
    // pet_owner/farmer are listed on the provider items because createProvider() grants the
    // 'groomer' role in the DB but the cached login payload keeps their original role until they
    // re-login. The permission check below is the real gate - it reads live DB roles - so a
    // customer who has not registered a business still never sees these.
    { id: 'grooming-provider', label: t('nav.groomingProvider'), icon: '💈', path: '/grooming/provider',
      roles: ['groomer', 'veterinarian', 'pet_owner', 'farmer', 'admin'], section: 'Grooming & Spa' },
    { id: 'grooming-orders', label: t('nav.groomingOrders'), icon: '📋', path: '/grooming/orders',
      roles: ['groomer', 'veterinarian', 'pet_owner', 'farmer', 'admin'], section: 'Grooming & Spa' },
    // The grooming counterpart of the vet's "My Schedule" under Consultations.
    { id: 'grooming-schedule', label: t('nav.groomingSchedule'), icon: '🗓️', path: '/grooming/schedule',
      roles: ['groomer', 'veterinarian', 'pet_owner', 'farmer', 'admin'], section: 'Grooming & Spa' },
    { id: 'grooming-earnings', label: t('nav.groomingEarnings'), icon: '💰', path: '/grooming/earnings',
      roles: ['groomer', 'veterinarian', 'pet_owner', 'farmer', 'admin'], section: 'Grooming & Spa' },
    { id: 'admin-grooming-providers', label: t('nav.groomingAdmin'), icon: '💈', path: '/admin/grooming-providers',
      roles: ['admin'], section: 'Grooming & Spa' },

    // ── Animals & Health ──
    { id: 'animals', label: t(isPetOwner ? 'nav.myPets' : (user?.role === 'veterinarian' ? 'nav.myPets' : 'nav.myAnimals')),
      icon: (isPetOwner || user?.role === 'veterinarian') ? '🐾' : '🐄', path: '/animals',
      roles: ['pet_owner', 'farmer', 'veterinarian'], section: 'Animals & Health' },
    { id: 'medical', label: t('nav.medicalRecords'), icon: '📋', path: '/medical-records',
      roles: ['veterinarian', 'pet_owner', 'farmer'], section: 'Animals & Health' },
    { id: 'animal-timeline', label: t('nav.animalTimeline'), icon: '📅', path: '/animal-timeline',
      roles: ['pet_owner', 'farmer', 'veterinarian', 'admin'], section: 'Animals & Health' },
    { id: 'vaccination-passport', label: t('nav.vaccinationPassport'), icon: '💉', path: '/vaccination-passport',
      roles: ['pet_owner', 'farmer', 'veterinarian', 'admin'], section: 'Animals & Health' },
    { id: 'vet-certificates', label: t('nav.vetCertificates'), icon: '📜', path: '/vet-certificates',
      roles: ['veterinarian', 'pet_owner', 'farmer', 'admin'], section: 'Animals & Health' },
    { id: 'write-review', label: t('nav.writeReview'), icon: '✍️', path: '/write-review',
      roles: ['pet_owner', 'farmer'], section: 'Animals & Health' },
    { id: 'patient-consent', label: t('nav.dataConsent'), icon: '🔒', path: '/patient-consent',
      roles: ['pet_owner', 'farmer'], section: 'Animals & Health' },
    { id: 'networkMemberships', label: t('nav.networkMemberships'), icon: '🏥', path: '/network-memberships',
      roles: ['pet_owner', 'farmer'], section: 'Animals & Health' },
    { id: 'my-reviews', label: t('nav.myReviews'), icon: '⭐', path: '/doctor/reviews',
      roles: ['veterinarian'], section: 'Animals & Health' },
    { id: 'vet-earnings', label: t('vetEarnings.title'), icon: '💰', path: '/doctor/earnings', roles: ['veterinarian'], section: 'Finance' },

    // ── Farm / Enterprise Module ──
    { id: 'enterprises', label: t('nav.farmEnterprise'), icon: '🏢', path: '/enterprises',
      roles: ['farmer', 'admin'], section: 'Farm Management' },
    // Daily records (milk, eggs, feed...). Hidden until an admin switches farm.records.enabled on - see
    // useNavMenuItems. No permission key: the page only lists farms the caller belongs to.
    { id: 'farm-records', label: t('nav.farmRecords'), icon: '📝', path: '/farm-records',
      roles: ['farmer', 'admin'], section: 'Farm Management' },
    { id: 'animal-groups', label: t('nav.herdsGroups'), icon: '🐄', path: '/animal-groups',
      roles: ['farmer', 'admin'], section: 'Farm Management' },
    { id: 'herd-medical', label: t('nav.herdMedical'), icon: '💊', path: '/herd-medical',
      roles: ['farmer', 'admin', 'veterinarian'], section: 'Farm Management' },
    { id: 'locations', label: t('nav.locations'), icon: '📍', path: '/locations',
      roles: ['farmer', 'admin'], section: 'Farm Management' },
    { id: 'movement-log', label: t('nav.movementLog'), icon: '🔄', path: '/movement-log',
      roles: ['farmer', 'admin'], section: 'Farm Management' },
    { id: 'campaigns', label: t('nav.campaigns'), icon: '💉', path: '/campaigns',
      roles: ['farmer', 'admin', 'veterinarian'], section: 'Farm Management' },

    // ── Analytics & Tools ──
    { id: 'health-analytics', label: t('nav.healthAnalytics'), icon: '📈', path: '/health-analytics',
      roles: ['farmer', 'admin', 'veterinarian', 'corporate_admin'], section: 'Analytics & Tools' },
    { id: 'breeding', label: t('nav.breedingGenetics'), icon: '🧬', path: '/breeding',
      roles: ['farmer', 'admin'], section: 'Analytics & Tools' },
    { id: 'feed-inventory', label: t('nav.feedInventory'), icon: '🌾', path: '/feed-inventory',
      roles: ['farmer', 'admin'], section: 'Analytics & Tools' },
    { id: 'compliance', label: t('nav.complianceDocs'), icon: '📜', path: '/compliance',
      roles: ['farmer', 'admin'], section: 'Analytics & Tools' },
    { id: 'financial', label: t('nav.financialAnalytics'), icon: '💰', path: '/financial',
      roles: ['farmer', 'admin', 'corporate_admin'], section: 'Analytics & Tools' },
    { id: 'alerts', label: t('nav.smartAlerts'), icon: '🔔', path: '/alerts',
      roles: ['farmer', 'admin', 'veterinarian'], section: 'Analytics & Tools' },

    // ── Innovation Modules ──
    { id: 'disease-prediction', label: t('nav.diseaseAI'), icon: '🧠', path: '/disease-prediction',
      roles: ['farmer', 'admin', 'veterinarian'], section: 'Innovation' },
    { id: 'genomic-lineage', label: t('nav.genomicLineage'), icon: '🧬', path: '/genomic-lineage',
      roles: ['farmer', 'admin'], section: 'Innovation' },
    { id: 'iot-sensors', label: t('nav.iotSensors'), icon: '📡', path: '/iot-sensors',
      roles: ['farmer', 'admin'], section: 'Innovation' },
    { id: 'supply-chain', label: t('nav.supplyChain'), icon: '🔗', path: '/supply-chain',
      roles: ['farmer', 'admin'], section: 'Innovation' },
    { id: 'workforce', label: t('nav.workforce'), icon: '👷', path: '/workforce',
      roles: ['farmer', 'admin'], section: 'Innovation' },
    { id: 'report-builder', label: t('nav.reportBuilder'), icon: '📊', path: '/report-builder',
      roles: ['farmer', 'admin', 'veterinarian'], section: 'Innovation' },

    // ── Intelligence Modules ──
    { id: 'ai-copilot', label: t('nav.aiCopilot'), icon: '🤖', path: '/ai-copilot',
      roles: ['veterinarian', 'farmer', 'admin', 'pet_owner', 'corporate_admin'], section: 'Intelligence' },
    { id: 'digital-twin', label: t('nav.digitalTwin'), icon: '🔮', path: '/digital-twin',
      roles: ['farmer', 'admin'], section: 'Intelligence' },
    { id: 'sustainability', label: t('nav.sustainability'), icon: '🌱', path: '/sustainability',
      roles: ['farmer', 'admin'], section: 'Intelligence' },
    { id: 'wellness', label: t('nav.wellnessPortal'), icon: '💚', path: '/wellness',
      roles: ['pet_owner', 'farmer', 'admin', 'veterinarian'], section: 'Intelligence' },
    { id: 'geospatial', label: t('nav.geospatial'), icon: '🗺️', path: '/geospatial',
      roles: ['farmer', 'admin'], section: 'Intelligence' },

    // ── Vet Hospital Network ──
    { id: 'vet-hospitals', label: t('nav.vetHospitals'), icon: '🏥', path: '/vet-hospitals',
      roles: ['pet_owner', 'farmer', 'veterinarian', 'admin', 'hospital_staff'], section: 'Vet Network' },
    { id: 'vet-hospitals-manage', label: t('nav.myHospital'), icon: '🏨', path: '/vet-hospitals/manage',
      roles: ['veterinarian'], section: 'Vet Network' },
    { id: 'hospital-workflow', label: 'Hospital Workflow', icon: '🔄', path: '/hospital-workflow',
      roles: ['veterinarian', 'admin', 'hospital_staff', 'corporate_admin'], section: 'Vet Network' },
    { id: 'inpatient', label: 'Inpatient & Boarding', icon: '🛏️', path: '/inpatient',
      roles: ['veterinarian', 'admin', 'hospital_staff', 'corporate_admin'], section: 'Vet Network' },
    { id: 'pharmacy', label: t('pharmacy.nav.title'), icon: '💊', path: '/pharmacy',
      roles: ['pharmacist', 'corporate_admin', 'admin'], section: 'Vet Network' },

    // ── Finance (Wallet, Payments, Earnings, Referrals) ──
    { id: 'wallet', label: t('nav.myWallet'), icon: '💰', path: '/wallet',
      roles: ['pet_owner', 'farmer', 'veterinarian', 'admin', 'corporate_admin'], section: 'Finance' },
    { id: 'payments-history', label: t('nav.myPayments'), icon: '🧾', path: '/payments',
      roles: ['pet_owner', 'farmer'], section: 'Finance' },
    { id: 'referrals', label: t('nav.referrals'), icon: '🔀', path: '/referrals',
      roles: ['pet_owner', 'farmer', 'veterinarian'], section: 'Finance' },

    // ── Administration (platform-level admin only) ──
    { id: 'admin-dashboard', label: t('nav.adminPanel'), icon: '🛡️', path: '/admin/dashboard',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-users', label: t('nav.userManagement'), icon: '👥', path: '/admin/users',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-consultations', label: t('nav.consultations'), icon: '🩺', path: '/admin/consultations',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-payments', label: t('nav.payments'), icon: '💳', path: '/admin/payments',
      roles: ['admin'], section: 'Finance' },
    { id: 'admin-legal-policies', label: t('nav.legalPolicies'), icon: '📜', path: '/admin/legal-policies',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-commission', label: t('nav.commissionSettings'), icon: '🪙', path: '/admin/commission-settings',
      roles: ['admin'], section: 'Finance' },
    // Payables answers "who do I owe"; Settlements is the withdrawal queue. Payables first -
    // it is the screen an admin opens to decide what to pay, before actioning anything.
    { id: 'admin-payables', label: t('nav.payables'), icon: '💸', path: '/admin/payables',
      roles: ['admin'], section: 'Finance' },
    { id: 'admin-settlements', label: t('nav.settlements'), icon: '🏦', path: '/admin/settlements',
      roles: ['admin'], section: 'Finance' },
    { id: 'admin-finance-reports', label: t('nav.financeReports'), icon: '📈', path: '/admin/finance-reports',
      roles: ['admin'], section: 'Finance' },
    { id: 'admin-reviews', label: t('nav.reviewModeration'), icon: '⚖️', path: '/admin/reviews',
      roles: ['admin'], section: 'Administration' },
    // 'support' holds dispute_management and admin_cancellation_dashboard in
    // DEFAULT_ROLE_PERMISSIONS, so RoleRoute already lets it open both of these.
    // Without the role listed here there was simply no link to them, leaving the
    // role with two reachable pages and no way to reach either.
    { id: 'admin-disputes', label: t('disputeManagement.title'), icon: '⚖️', path: '/admin/disputes',
      roles: ['admin', 'support'], section: 'Administration' },
    { id: 'admin-cancellation-dashboard', label: t('nav.cancellations'), icon: '📊', path: '/admin/cancellation-dashboard',
      roles: ['admin', 'support'], section: 'Administration' },
    { id: 'admin-medical-records', label: t('nav.medicalRecords'), icon: '📋', path: '/admin/medical-records',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-audit', label: t('nav.auditLogs'), icon: '📜', path: '/admin/audit-logs',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-compliance', label: 'HIPAA Compliance', icon: '🛡️', path: '/admin/compliance',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-settings', label: t('nav.systemSettings'), icon: '⚙️', path: '/admin/settings',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-sms-settings', label: t('nav.smsSettings'), icon: '💬', path: '/admin/sms-settings',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-prescription-settings', label: t('nav.prescriptionSettings'), icon: '📄', path: '/admin/prescription-settings',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-permissions', label: t('nav.permissions'), icon: '🔐', path: '/admin/permissions',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-vaccine-protocols', label: t('nav.vaccineProtocols'), icon: '🧬', path: '/admin/vaccine-protocols',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-master-data', label: t('nav.masterData'), icon: '🗂️', path: '/admin/master-data',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-certificate-settings', label: t('nav.certificateSettings'), icon: '📋', path: '/admin/certificate-settings',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-holidays', label: 'Holiday Management', icon: '🎉', path: '/admin/holidays',
      roles: ['admin', 'veterinarian'], section: 'Administration' },

    // ── Hospital Network Management (admin + corporate_admin) ──
    { id: 'hospital-networks', label: 'Hospital Networks', icon: '🌐', path: '/hospital-networks',
      roles: ['admin', 'corporate_admin', 'hospital_staff', 'veterinarian'], section: 'Hospital Networks' },
    { id: 'admin-hospitals', label: t('nav.hospitalMgmt'), icon: '🏥', path: '/admin/vet-hospitals',
      roles: ['admin'], section: 'Hospital Networks' },
    { id: 'admin-staff-settings', label: 'Staff & Positions', icon: '👥', path: '/admin/staff-settings',
      roles: ['admin'], section: 'Hospital Networks' },
    { id: 'admin-network-subscriptions', label: 'Network Subscriptions', icon: '💳', path: '/admin/network-subscriptions',
      roles: ['admin'], section: 'Hospital Networks' },

    // ── Preferences (bottom) ──
    { id: 'settings', label: t('nav.settings'), icon: '⚙️', path: '/settings',
      roles: ['veterinarian', 'pet_owner', 'farmer', 'corporate_admin', 'hospital_staff', 'pharmacist', 'groomer', 'support'], section: 'Preferences' }
  ]
}
