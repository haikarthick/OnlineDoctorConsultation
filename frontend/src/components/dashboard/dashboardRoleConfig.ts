import { TFunction } from 'i18next'
import { DashStats, StatCard, QuickAction } from './dashboardShared'

export interface RoleFlags {
  isFarmer: boolean
  isPetOwner: boolean
  isVeterinarian: boolean
  isAdmin: boolean
  isHospitalStaff: boolean
  isCorporateAdmin: boolean
  isPharmacist: boolean
  isSupport: boolean
}

interface BuildStatCardsArgs extends RoleFlags {
  stats: DashStats
  corpStats: { totalNetworks: number; approvedNetworks: number; pendingNetworks: number; totalHospitals: number; totalMembers: number }
  vetPharmacyStats: { pendingReview: number; rejectedThisWeek: number; dispensedCount: number } | null
  t: TFunction
}

// Stat cards - different per role
export function buildStatCards(args: BuildStatCardsArgs): StatCard[] {
  const { stats, isFarmer, isPetOwner, isVeterinarian, isAdmin, isHospitalStaff, isCorporateAdmin, isPharmacist, isSupport, corpStats, vetPharmacyStats, t } = args

  const base = [
    { label: t('dashboard.stats.appointments'), value: stats.bookings, icon: '📅', color: '#667eea', path: '/consultations?tab=bookings' },
    { label: t('dashboard.stats.consultations'), value: stats.consultations, icon: '🩺', color: '#764ba2', path: '/consultations?tab=consultations' },
  ]

  if (isFarmer) {
    return [
      ...base,
      { label: t('dashboard.stats.myAnimals'), value: stats.animals, icon: '🐄', color: '#10b981', path: '/animals' },
      { label: t('dashboard.stats.enterprises'), value: stats.enterprises || 0, icon: '🏢', color: '#f59e0b', path: '/enterprises' },
      { label: t('dashboard.stats.pending'), value: stats.pending, icon: '⏳', color: '#ef4444', path: '/consultations?tab=bookings&status=pending' },
    ]
  }

  if (isPetOwner) {
    return [
      ...base,
      { label: t('dashboard.stats.myAnimals'), value: stats.animals, icon: '🐾', color: '#10b981', path: '/animals' },
      { label: t('dashboard.stats.pending'), value: stats.pending, icon: '⏳', color: '#ef4444', path: '/consultations?tab=bookings&status=pending' },
    ]
  }

  if (isVeterinarian) {
    const tiles = [
      { label: t('dashboard.stats.appointments'), value: stats.bookings, icon: '📅', color: '#667eea', path: '/consultations?tab=bookings' },
      { label: t('dashboard.stats.consultations'), value: stats.consultations, icon: '🩺', color: '#764ba2', path: '/consultations?tab=consultations' },
      { label: t('dashboard.stats.patients'), value: stats.animals, icon: '🐾', color: '#10b981', path: '/animals' },
      { label: t('dashboard.stats.pending'), value: stats.pending, icon: '🔔', color: '#ef4444', path: '/consultations?tab=bookings&status=pending' },
    ]
    // Only shown once this vet has ever sent a prescription into a network pharmacy
    if (vetPharmacyStats && (vetPharmacyStats.pendingReview + vetPharmacyStats.rejectedThisWeek + vetPharmacyStats.dispensedCount) > 0) {
      tiles.push(
        { label: t('dashboard.stats.rxPendingReview'), value: vetPharmacyStats.pendingReview, icon: '💊', color: '#3949ab', path: '/doctor/prescriptions' },
        { label: t('dashboard.stats.rxRejectedThisWeek'), value: vetPharmacyStats.rejectedThisWeek, icon: '❌', color: '#dc2626', path: '/doctor/prescriptions' },
        { label: t('dashboard.stats.rxDispensed'), value: vetPharmacyStats.dispensedCount, icon: '✅', color: '#15803d', path: '/doctor/prescriptions' },
      )
    }
    return tiles
  }

  if (isCorporateAdmin) {
    return [
      { label: t('dashboard.stats.totalNetworks'), value: corpStats.totalNetworks, icon: '🌐', color: '#667eea', path: '/hospital-networks' },
      { label: t('dashboard.stats.approvedNetworks'), value: corpStats.approvedNetworks, icon: '✅', color: '#10b981', path: '/hospital-networks' },
      { label: t('dashboard.stats.pendingApproval'), value: corpStats.pendingNetworks, icon: '⏳', color: '#f59e0b', path: '/hospital-networks' },
      { label: t('dashboard.stats.branchHospitals'), value: corpStats.totalHospitals, icon: '🏥', color: '#06b6d4', path: '/hospital-networks' },
      { label: t('dashboard.stats.networkMembers'), value: corpStats.totalMembers, icon: '👥', color: '#8b5cf6', path: '/hospital-networks' },
    ]
  }

  // Hospital staff: dedicated stat section renders separately below - no generic tiles
  if (isHospitalStaff) return []

  // Pharmacist - redirected to /pharmacy, but guard against any fallthrough
  if (isPharmacist) {
    return [
      { label: t('pharmacy.stats.pendingReviews'), value: 0, icon: '📋', color: '#3949ab', path: '/pharmacy' },
      { label: t('pharmacy.stats.readyToDispense'), value: 0, icon: '✅', color: '#4caf50', path: '/pharmacy' },
      { label: t('pharmacy.stats.lowStock'), value: 0, icon: '⚠️', color: '#f44336', path: '/pharmacy' },
    ]
  }

  // Platform support: the quick actions below are the navigation surface. No
  // generic tiles rather than tiles of zeroes - support holds none of the
  // permissions those counts describe.
  if (isSupport) return []

  // Admin. Explicitly guarded: this used to be the bare fallback, so every
  // role without a branch above (support) silently inherited the admin tiles
  // and quick actions and got redirected back here on clicking any of them.
  if (isAdmin) {
    return [
      { label: t('dashboard.stats.appointments'), value: stats.bookings, icon: '📅', color: '#667eea', path: '/consultations?tab=bookings' },
      { label: t('dashboard.stats.consultations'), value: stats.consultations, icon: '🩺', color: '#764ba2', path: '/consultations?tab=consultations' },
      { label: t('dashboard.stats.myAnimals'), value: stats.animals, icon: '🐾', color: '#10b981', path: '/animals' },
      { label: t('dashboard.stats.pending'), value: stats.pending, icon: '⏳', color: '#ef4444', path: '/consultations?tab=bookings&status=pending' },
    ]
  }

  return []
}

// Quick actions - role-specific
export function buildQuickActions(args: RoleFlags & { t: TFunction }): QuickAction[] {
  const { isFarmer, isPetOwner, isVeterinarian, isAdmin, isHospitalStaff, isCorporateAdmin, isPharmacist, isSupport, t } = args

  if (isFarmer) {
    return [
      { icon: '📝', label: t('dashboard.quickActions.bookConsultation'), path: '/book-consultation', color: '#667eea', description: t('dashboard.quickActions.desc.scheduleVetVisit') },
      { icon: '🐄', label: t('dashboard.quickActions.myAnimals'), path: '/animals', color: '#10b981', description: t('dashboard.quickActions.desc.manageYourLivestock') },
      { icon: '🏢', label: t('dashboard.quickActions.farmEnterprise'), path: '/enterprises', color: '#f59e0b', description: t('dashboard.quickActions.desc.manageYourFarm') },
      { icon: '🐾', label: t('dashboard.quickActions.herdManagement'), path: '/animal-groups', color: '#8b5cf6', description: t('dashboard.quickActions.desc.organizeAnimalGroups') },
      { icon: '📋', label: t('dashboard.quickActions.medicalRecords'), path: '/medical-records', color: '#06b6d4', description: t('dashboard.quickActions.desc.healthHistory') },
      { icon: '💊', label: t('dashboard.quickActions.herdMedical'), path: '/herd-medical', color: '#ec4899', description: t('dashboard.quickActions.desc.herdHealthMgmt') },
      { icon: '💉', label: t('dashboard.quickActions.campaigns'), path: '/campaigns', color: '#14b8a6', description: t('dashboard.quickActions.desc.treatmentCampaigns') },
      { icon: '📈', label: t('dashboard.quickActions.healthAnalytics'), path: '/health-analytics', color: '#6366f1', description: t('dashboard.quickActions.desc.insightsAndTrends') },
      { icon: '🏥', label: t('dashboard.quickActions.findHospital'), path: '/vet-hospitals', color: '#0ea5e9', description: t('dashboard.quickActions.desc.browseVetHospitals') },
    ]
  }

  if (isPetOwner) {
    return [
      { icon: '📝', label: t('dashboard.quickActions.bookConsultation'), path: '/book-consultation', color: '#667eea', description: t('dashboard.quickActions.desc.scheduleVetVisit') },
      { icon: '🔍', label: t('dashboard.quickActions.findDoctor'), path: '/find-doctor', color: '#8b5cf6', description: t('dashboard.quickActions.desc.searchVeterinarians') },
      { icon: '🐾', label: t('dashboard.quickActions.myAnimals'), path: '/animals', color: '#10b981', description: t('dashboard.quickActions.desc.manageYourPets') },
      { icon: '📋', label: t('dashboard.quickActions.medicalRecords'), path: '/medical-records', color: '#06b6d4', description: t('dashboard.quickActions.desc.petHealthHistory') },
      { icon: '💚', label: t('dashboard.quickActions.wellnessPortal'), path: '/wellness', color: '#14b8a6', description: t('dashboard.quickActions.desc.petWellnessTips') },
      { icon: '✍️', label: t('dashboard.quickActions.writeReview'), path: '/write-review', color: '#f59e0b', description: t('dashboard.quickActions.desc.rateYourVet') },
      { icon: '🏥', label: t('dashboard.quickActions.findHospital'), path: '/vet-hospitals', color: '#0ea5e9', description: t('dashboard.quickActions.desc.browseVetHospitals') },
    ]
  }

  if (isVeterinarian) {
    return [
      { icon: '🏥', label: t('dashboard.quickActions.viewConsultations'), path: '/consultations', color: '#667eea', description: t('dashboard.quickActions.desc.viewAllConsultations') },
      { icon: '🗓️', label: t('dashboard.quickActions.manageSchedule'), path: '/doctor/manage-schedule', color: '#8b5cf6', description: t('dashboard.quickActions.desc.manageAvailability') },
      { icon: '💊', label: t('dashboard.quickActions.prescriptions'), path: '/doctor/prescriptions', color: '#10b981', description: t('dashboard.quickActions.desc.writePrescriptions') },
      { icon: '📋', label: t('dashboard.quickActions.medicalRecords'), path: '/medical-records', color: '#06b6d4', description: t('dashboard.quickActions.desc.patientRecords') },
      { icon: '📈', label: t('dashboard.quickActions.healthAnalytics'), path: '/health-analytics', color: '#f59e0b', description: t('dashboard.quickActions.desc.healthInsights') },
      { icon: '🧠', label: t('dashboard.quickActions.diseaseAI'), path: '/disease-prediction', color: '#ec4899', description: t('dashboard.quickActions.desc.aiDiagnosisAssist') },
      { icon: '⭐', label: t('dashboard.quickActions.myReviews'), path: '/doctor/reviews', color: '#14b8a6', description: t('dashboard.quickActions.desc.patientFeedback') },
      { icon: '🔔', label: t('dashboard.quickActions.smartAlerts'), path: '/alerts', color: '#ef4444', description: t('dashboard.quickActions.desc.healthNotifications') },
      { icon: '🏨', label: t('dashboard.quickActions.myHospital'), path: '/vet-hospitals/manage', color: '#0ea5e9', description: t('dashboard.quickActions.desc.hospitalDashboard') },
    ]
  }

  if (isHospitalStaff) {
    return [
      { icon: '🔄', label: t('dashboard.quickActions.hospitalWorkflow'), path: '/hospital-workflow', color: '#667eea', description: t('dashboard.quickActions.desc.patientQueue') },
      { icon: '🛏️', label: t('dashboard.quickActions.inpatient'), path: '/inpatient', color: '#10b981', description: t('dashboard.quickActions.desc.inpatientBoarding') },
      { icon: '📋', label: t('dashboard.quickActions.medicalRecords'), path: '/medical-records', color: '#06b6d4', description: t('dashboard.quickActions.desc.patientRecords') },
      { icon: '⚙️', label: t('dashboard.quickActions.settings'), path: '/settings', color: '#8b5cf6', description: t('dashboard.quickActions.desc.manageSettings') },
    ]
  }

  if (isCorporateAdmin) {
    return [
      { icon: '🌐', label: t('dashboard.quickActions.hospitalNetworks'), path: '/hospital-networks', color: '#667eea', description: t('dashboard.quickActions.desc.manageYourNetworks') },
      { icon: '📊', label: t('dashboard.quickActions.healthAnalytics'), path: '/health-analytics', color: '#10b981', description: t('dashboard.quickActions.desc.networkHealthInsights') },
      { icon: '⚙️', label: t('dashboard.quickActions.settings'), path: '/settings', color: '#8b5cf6', description: t('dashboard.quickActions.desc.manageSettings') },
    ]
  }

  // Pharmacist - home is /pharmacy, redirect handles it but provide fallback actions
  if (isPharmacist) {
    return [
      { icon: '💊', label: t('pharmacy.tabs.overview'), path: '/pharmacy', color: '#3949ab', description: t('pharmacy.pendingReview') },
      { icon: '📋', label: t('pharmacy.tabs.review'), path: '/pharmacy', color: '#f57f17', description: t('pharmacy.noPendingReviews') },
      { icon: '📦', label: t('pharmacy.tabs.inventory'), path: '/pharmacy', color: '#388e3c', description: t('pharmacy.inventory.title') },
      { icon: '⚙️', label: t('dashboard.quickActions.settings'), path: '/settings', color: '#8b5cf6', description: t('dashboard.quickActions.desc.manageSettings') },
    ]
  }

  // Platform support - exactly the pages its DEFAULT_ROLE_PERMISSIONS grant
  // (dispute_management, admin_cancellation_dashboard, settings). Anything
  // more would render a tile that RoleRoute bounces straight back here.
  if (isSupport) {
    return [
      { icon: '⚖️', label: t('disputeManagement.title'), path: '/admin/disputes', color: '#667eea', description: t('dashboard.quickActions.desc.resolveDisputes') },
      { icon: '📊', label: t('nav.cancellations'), path: '/admin/cancellation-dashboard', color: '#f59e0b', description: t('dashboard.quickActions.desc.cancellationOversight') },
      { icon: '⚙️', label: t('dashboard.quickActions.settings'), path: '/settings', color: '#8b5cf6', description: t('dashboard.quickActions.desc.manageSettings') },
    ]
  }

  // Admin - explicitly guarded, see the note on the stat cards above.
  if (isAdmin) {
    return [
      { icon: '🛡️', label: t('dashboard.quickActions.adminPanel'), path: '/admin/dashboard', color: '#667eea', description: t('dashboard.quickActions.desc.systemOverview') },
      { icon: '👥', label: t('dashboard.quickActions.users'), path: '/admin/users', color: '#8b5cf6', description: t('dashboard.quickActions.desc.userManagement') },
      { icon: '🩺', label: t('dashboard.quickActions.viewConsultations'), path: '/admin/consultations', color: '#10b981', description: t('dashboard.quickActions.desc.allConsultations') },
      { icon: '💳', label: t('dashboard.quickActions.payments'), path: '/admin/payments', color: '#f59e0b', description: t('dashboard.quickActions.desc.paymentManagement') },
      { icon: '⚖️', label: t('dashboard.quickActions.reviews'), path: '/admin/reviews', color: '#06b6d4', description: t('dashboard.quickActions.desc.reviewModeration') },
      { icon: '📜', label: t('dashboard.quickActions.auditLogs'), path: '/admin/audit-logs', color: '#ef4444', description: t('dashboard.quickActions.desc.systemActivity') },
      { icon: '🏥', label: t('dashboard.quickActions.hospitalMgmt'), path: '/admin/vet-hospitals', color: '#0ea5e9', description: t('dashboard.quickActions.desc.hospitalOversight') },
    ]
  }

  // Only reached by a role added to the backend without a branch here. An
  // empty action list is honest; the admin list was not.
  return [
    { icon: '⚙️', label: t('dashboard.quickActions.settings'), path: '/settings', color: '#8b5cf6', description: t('dashboard.quickActions.desc.manageSettings') },
  ]
}
