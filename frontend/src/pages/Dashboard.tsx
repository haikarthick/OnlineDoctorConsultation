import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { usePermission } from '../context/PermissionContext'
import apiService from '../services/api'
import { Booking, Consultation } from '../types'
import './Dashboard.css'
import { useTranslation } from 'react-i18next'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { useGroomingEnabled } from '../hooks/useGroomingEnabled'
import { DashStats, ActivityItem, EnterpriseOverviewStats, FeatureCardDef } from '../components/dashboard/dashboardShared'
import { buildStatCards, buildQuickActions } from '../components/dashboard/dashboardRoleConfig'
import DashboardStatsGrid from '../components/dashboard/DashboardStatsGrid'
import HospitalStaffStatsPanel from '../components/dashboard/HospitalStaffStatsPanel'
import PendingApprovalsPanel from '../components/dashboard/PendingApprovalsPanel'
import QuickActionsPanel from '../components/dashboard/QuickActionsPanel'
import RecentActivityPanel from '../components/dashboard/RecentActivityPanel'
import UpcomingBookingsPanel from '../components/dashboard/UpcomingBookingsPanel'
import RecentConsultationsPanel from '../components/dashboard/RecentConsultationsPanel'
import FarmerEnterpriseOverviewPanel from '../components/dashboard/FarmerEnterpriseOverviewPanel'
import FeatureCardGrid from '../components/dashboard/FeatureCardGrid'
import ProTipsPanel from '../components/dashboard/ProTipsPanel'

const FARMER_FEATURES: FeatureCardDef[] = [
  { icon: '💊', iconClass: 'si-237b0eb5', titleKey: 'dashboard.features.herdMedicalTitle', descKey: 'dashboard.features.herdMedicalDesc', path: '/herd-medical' },
  { icon: '🧬', iconClass: 'si-decf142f', titleKey: 'dashboard.features.breedingTitle', descKey: 'dashboard.features.breedingDesc', path: '/breeding' },
  { icon: '🌾', iconClass: 'si-9861cb6d', titleKey: 'dashboard.features.feedTitle', descKey: 'dashboard.features.feedDesc', path: '/feed-inventory' },
]

const PET_OWNER_FEATURES: FeatureCardDef[] = [
  { icon: '💚', iconClass: 'si-0545d449', titleKey: 'dashboard.features.wellnessTitle', descKey: 'dashboard.features.wellnessDesc', path: '/wellness' },
  { icon: '🏪', iconClass: 'si-bdf67f5f', titleKey: 'dashboard.features.marketplaceTitle', descKey: 'dashboard.features.marketplaceDesc', path: '/marketplace' },
  { icon: '🤖', iconClass: 'si-f4bcf8a7', titleKey: 'dashboard.features.aiHealthTitle', descKey: 'dashboard.features.aiHealthDesc', path: '/ai-copilot' },
]

const VETERINARIAN_FEATURES: FeatureCardDef[] = [
  { icon: '🧠', iconClass: 'si-237b0eb5', titleKey: 'dashboard.features.diseaseAITitle', descKey: 'dashboard.features.diseaseAIDesc', path: '/disease-prediction' },
  { icon: '📊', iconClass: 'si-bdf67f5f', titleKey: 'dashboard.features.reportBuilderTitle', descKey: 'dashboard.features.reportBuilderDesc', path: '/report-builder' },
  { icon: '🤖', iconClass: 'si-f4bcf8a7', titleKey: 'dashboard.features.aiCopilotTitle', descKey: 'dashboard.features.aiCopilotDesc', path: '/ai-copilot' },
]

const Dashboard: React.FC = () => {
  const { t } = useTranslation()

  const { user } = useAuth()
  const { formatDate } = useSettings()
  const { hasPermission } = usePermission()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashStats>({ bookings: 0, consultations: 0, animals: 0, pending: 0, enterprises: 0 })
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [enterpriseOverview, setEnterpriseOverview] = useState<EnterpriseOverviewStats | null>(null)
  const [corpStats, setCorpStats] = useState({ totalNetworks: 0, approvedNetworks: 0, pendingNetworks: 0, totalHospitals: 0, totalMembers: 0 })
  const [staffDashboard, setStaffDashboard] = useState<any>(null)
  const [vetPharmacyStats, setVetPharmacyStats] = useState<{ pendingReview: number; rejectedThisWeek: number; dispensedCount: number } | null>(null)

  // Doctor-specific state
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([])
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([])
  const [recentConsultations, setRecentConsultations] = useState<Consultation[]>([])
  const [error, setError] = useState('')

  const isVeterinarian = user?.role === 'veterinarian'
  const isPetOwner = user?.role === 'pet_owner'
  const isFarmer = user?.role === 'farmer'
  const isAdmin = user?.role === 'admin'
  const isHospitalStaff = user?.role === 'hospital_staff'
  const isCorporateAdmin = user?.role === 'corporate_admin'
  const isPharmacist = user?.role === 'pharmacist'
  const isGroomer = user?.role === 'groomer'
  const isSupport = user?.role === 'support'
  const { enabled: groomingEnabled } = useGroomingEnabled()

  // Pharmacist's home is the Pharmacy module - redirect immediately so they never see the generic dashboard
  useEffect(() => {
    if (isPharmacist) {
      navigate('/pharmacy', { replace: true })
    }
  }, [isPharmacist, navigate])

  // Same for a groomer-primary account: their home is the grooming business console, which doubles
  // as the onboarding form for someone who just self-registered. Only when the module is live -
  // otherwise every /grooming route 404s and the generic dashboard is the safer landing.
  // Users who hold 'groomer' as a SECONDARY role keep their own primary dashboard.
  useEffect(() => {
    if (isGroomer && groomingEnabled) {
      navigate('/grooming/provider', { replace: true })
    }
  }, [isGroomer, groomingEnabled, navigate])

  useEffect(() => { loadDashboardData() }, [])

  // Vets who prescribe into a network pharmacy get a lightweight status tile - silent no-op for standalone vets
  useEffect(() => {
    if (!isVeterinarian) return
    apiService.getVetPharmacyStats()
      .then((resp: any) => setVetPharmacyStats(resp?.data || null))
      .catch(() => setVetPharmacyStats(null))
  }, [isVeterinarian])

  const loadDashboardData = async () => {
    // Pharmacist is redirected to /pharmacy - skip all data loading
    if (isPharmacist) return

    // Corporate admin loads network stats instead of booking/consultation data
    if (isCorporateAdmin) {
      try {
        const corpRes = await apiService.getCorporateDashboardStats()
        const d = corpRes.data?.data || corpRes.data || {}
        setCorpStats({
          totalNetworks: d.totalNetworks || 0,
          approvedNetworks: d.approvedNetworks || 0,
          pendingNetworks: d.pendingNetworks || 0,
          totalHospitals: d.totalHospitals || 0,
          totalMembers: d.totalMembers || 0,
        })
      } catch (err: any) {
        console.error('Failed to load corporate stats:', err?.message)
      } finally {
        setLoading(false)
      }
      return
    }

    // Hospital staff: load network-specific dashboard
    if (isHospitalStaff) {
      try {
        const staffRes = await apiService.getHospitalStaffDashboard();
        setStaffDashboard(staffRes.data?.data || staffRes.data || {});
      } catch (err: any) {
        console.error('Failed to load staff dashboard:', err?.message);
        setStaffDashboard({ enrolledPatients: 0, todayQueueCount: 0, activeInpatients: 0, pendingReferrals: 0, staffCount: 0 });
      }
      setLoading(false);
      return;
    }

    try {
      setLoading(true)
      setError('')

      const [bRes, cRes] = await Promise.all([
        apiService.listBookings({ limit: 50 }),
        apiService.listConsultations({ limit: 50 })
      ])
      let aRes: any = { data: [] }
      try { aRes = await apiService.listAnimals({ limit: 50 }) } catch (err: any) { console.error('Dashboard data load error:', err?.message) }

      let eCount = 0
      if (isFarmer || isAdmin) {
        try {
          const eRes = await apiService.listEnterprises({ limit: 50 })
          const enterprises = eRes.data?.items || (Array.isArray(eRes.data) ? eRes.data : [])
          eCount = enterprises.length
          // Load enterprise overview for farmer
          if (isFarmer && enterprises.length > 0) {
            const firstEnt = enterprises[0]
            try {
              const [entStats, movRes, campRes] = await Promise.all([
                apiService.getEnterpriseStats(firstEnt.id),
                apiService.listMovements(firstEnt.id),
                apiService.listCampaigns(firstEnt.id)
              ])
              const movements = movRes.data?.items || []
              const campaigns = campRes.data?.items || []
              setEnterpriseOverview({
                totalAnimals: entStats.data?.totalAnimals || 0,
                activeGroups: entStats.data?.totalGroups || 0,
                pendingMovements: movements.filter((m: any) => (m.status || 'pending') === 'pending').length,
                activeCampaigns: campaigns.filter((c: any) => c.status === 'in_progress' || c.status === 'planned').length
              })
            } catch (err: any) { console.error('Dashboard enterprise data load error:', err?.message) }
          }
        } catch (err: any) { console.error('Dashboard data load error:', err?.message) }
      }

      const bookings = bRes.data?.items || (Array.isArray(bRes.data) ? bRes.data : [])
      const consults = cRes.data?.items || (Array.isArray(cRes.data) ? cRes.data : [])
      const animals = aRes.data?.animals || aRes.data?.items || (Array.isArray(aRes.data) ? aRes.data : [])
      // Counts aligned to match what each destination page tab shows
      const activeStatList = ['pending', 'confirmed', 'rescheduled', 'missed']
      const activeBookingsCount = bookings.filter((b: any) => activeStatList.includes(b.status)).length
      const historyBookingsCount = bookings.filter((b: any) => ['completed', 'cancelled'].includes(b.status)).length
      const pendingCount = bookings.filter((b: any) => b.status === 'pending').length
      setStats({ bookings: activeBookingsCount, consultations: historyBookingsCount, animals: animals.length, pending: pendingCount, enterprises: eCount })

      // Vet-specific
      if (hasPermission('dashboard_pending_approvals')) {
        setPendingBookings(bookings.filter((b: any) => b.status === 'pending'))
      }
      if (hasPermission('dashboard_upcoming_bookings')) {
        setUpcomingBookings(bookings.filter((b: any) => b.status === 'confirmed').slice(0, 5))
      }
      if (hasPermission('dashboard_recent_consultations')) {
        setRecentConsultations(consults.slice(0, 5))
      }

      // Build recent activity
      const acts: ActivityItem[] = []
      bookings.slice(0, 3).forEach((b: any) => {
        const who = isVeterinarian ? (b.petOwnerName || t('common.patient')) : (b.vetName || t('common.doctor'))
        const mode = b.bookingType === 'video_call' ? t('common.video') : t('common.inPerson')
        acts.push({
          type: t('common.booking'),
          description: `${mode} ${t('common.with')} ${who} - ${b.reasonForVisit || t('common.consultation')}`,
          time: b.scheduledDate ? formatDate(b.scheduledDate, { month: 'short', day: 'numeric' }) : '',
          status: b.status
        })
      })
      consults.slice(0, 2).forEach((c: any) => {
        acts.push({
          type: t('common.consultation'),
          description: `${c.animalType || t('common.animal')} - ${c.symptomDescription || t('common.generalConsultation')}`,
          time: c.scheduledAt ? formatDate(c.scheduledAt, { month: 'short', day: 'numeric' }) : '',
          status: c.status
        })
      })
      setActivities(acts)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || t('common.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }
  useAutoRefresh(['bookings', 'consultations', 'dashboard'], loadDashboardData)

  // ── Doctor actions ──
  const handleConfirm = async (id: string) => {
    try { await apiService.confirmBooking(id); loadDashboardData() }
    catch (err: any) { setError(err?.response?.data?.error?.message || t('common.failedToSave')) }
  }
  const handleCancel = async (id: string) => {
    if (!window.confirm(t('dashboard.cancelBooking'))) return
    try { await apiService.cancelBooking(id, t('dashboard.declinedByDoctor')); loadDashboardData() }
    catch (err: any) { setError(err?.response?.data?.error?.message || t('common.failedToSave')) }
  }

  /* ════════════════════════════════════════════════════════
   * ROLE-SPECIFIC CONFIGURATIONS
   * ════════════════════════════════════════════════════════ */

  // Stat cards - different per role
  const statCards = useMemo(
    () => buildStatCards({ isFarmer, isPetOwner, isVeterinarian, isAdmin, isHospitalStaff, isCorporateAdmin, isPharmacist, isSupport, stats, corpStats, vetPharmacyStats, t }),
    [stats, isFarmer, isPetOwner, isVeterinarian, isAdmin, isHospitalStaff, isCorporateAdmin, isPharmacist, isSupport, corpStats, vetPharmacyStats, t]
  )

  // Quick actions - role-specific
  const quickActions = useMemo(
    () => buildQuickActions({ isFarmer, isPetOwner, isVeterinarian, isAdmin, isHospitalStaff, isCorporateAdmin, isPharmacist, isSupport, t }),
    [isFarmer, isPetOwner, isVeterinarian, isAdmin, isHospitalStaff, isCorporateAdmin, isPharmacist, isSupport, t]
  )

  // Subtitle per role
  const subtitle = useMemo(() => {
    if (isVeterinarian) return t('dashboard.subtitles.vet')
    if (isPetOwner) return t('dashboard.subtitles.petOwner')
    if (isFarmer) return t('dashboard.subtitles.farmer')
    if (isAdmin) return t('dashboard.subtitles.admin')
    if (isHospitalStaff) return t('dashboard.subtitles.hospitalStaff')
    if (isCorporateAdmin) return t('dashboard.subtitles.corporateAdmin')
    if (isPharmacist) return t('dashboard.subtitles.pharmacist')
    if (isSupport) return t('dashboard.subtitles.support')
    return t('dashboard.greeting', { name: user?.firstName })
  }, [isVeterinarian, isPetOwner, isFarmer, isAdmin, isHospitalStaff, isCorporateAdmin, isPharmacist, isSupport, t, user?.firstName])

  const extraTipIcon = isFarmer ? '🌾' : isPetOwner ? '🐾' : isVeterinarian ? '🩺' : undefined

  return (
    <div className="dashboard-container">
      {/* ── Header ── */}
      <div className="dashboard-header">
        <div className="dashboard-title-section">
          <h1 className="dashboard-title">{t('dashboard.greeting', { name: user?.firstName })}</h1>
          <p className="dashboard-subtitle">{subtitle}</p>
        </div>
        <div className="dashboard-date">
          {formatDate(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {error && (
        <div className="dashboard-error">
          <span>⚠️ {error}</span>
          <button onClick={loadDashboardData}>{t('common.retry')}</button>
        </div>
      )}

      {/* ── Stats Cards ── */}
      {hasPermission('dashboard_stats') && (
        <DashboardStatsGrid statCards={statCards} loading={loading} />
      )}

      {/* ── Hospital Staff Dashboard ── */}
      {isHospitalStaff && staffDashboard && (
        <HospitalStaffStatsPanel staffDashboard={staffDashboard} />
      )}

      {/* ── Pending Booking Approvals - vet/admin only ── */}
      {hasPermission('dashboard_pending_approvals') && pendingBookings.length > 0 && (
        <PendingApprovalsPanel pendingBookings={pendingBookings} onConfirm={handleConfirm} onCancel={handleCancel} />
      )}

      {/* ── Main Grid: Quick Actions + Activity ── */}
      <div className="dashboard-main-grid">
        {/* Quick Actions */}
        {hasPermission('dashboard_quick_actions') && (
          <QuickActionsPanel quickActions={quickActions} />
        )}

        {/* Recent Activity */}
        {hasPermission('dashboard_recent_activity') && (
          <RecentActivityPanel activities={activities} loading={loading} />
        )}
      </div>

      {/* ── Vet: Upcoming Bookings + Recent Consultations ── */}
      {(hasPermission('dashboard_upcoming_bookings') || hasPermission('dashboard_recent_consultations')) && (
        <div className="dashboard-two-col">
          {hasPermission('dashboard_upcoming_bookings') && (
            <UpcomingBookingsPanel upcomingBookings={upcomingBookings} />
          )}

          {hasPermission('dashboard_recent_consultations') && (
            <RecentConsultationsPanel recentConsultations={recentConsultations} />
          )}
        </div>
      )}

      {/* ── Role-Specific Feature Sections ── */}

      {/* Farmer Enterprise Overview */}
      {isFarmer && enterpriseOverview && (
        <FarmerEnterpriseOverviewPanel enterpriseOverview={enterpriseOverview} />
      )}

      {isFarmer && <FeatureCardGrid features={FARMER_FEATURES} />}

      {isPetOwner && <FeatureCardGrid features={PET_OWNER_FEATURES} />}

      {isVeterinarian && <FeatureCardGrid features={VETERINARIAN_FEATURES} />}

      {/* ── Pro Tips (all roles) ── */}
      {hasPermission('dashboard_tips') && (
        <ProTipsPanel extraTipIcon={extraTipIcon} />
      )}
    </div>
  )
}

export default Dashboard
