import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { usePermission } from '../context/PermissionContext'
import apiService from '../services/api'
import { Booking, Consultation } from '../types'
import './Dashboard.css'
import { useTranslation } from 'react-i18next'

/* ════════════════════════════════════════════════════════
 * TYPES
 * ════════════════════════════════════════════════════════ */
interface DashStats { bookings: number; consultations: number; animals: number; pending: number; enterprises?: number }
interface ActivityItem { type: string; description: string; time: string; status: string }
interface QuickAction { icon: string; label: string; path: string; color: string; description?: string }
interface EnterpriseOverviewStats { totalAnimals: number; activeGroups: number; pendingMovements: number; activeCampaigns: number }

const Dashboard: React.FC = () => {
  const { t } = useTranslation()

  const { user } = useAuth()
  const { formatDate, formatSlotTime } = useSettings()
  const { hasPermission } = usePermission()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashStats>({ bookings: 0, consultations: 0, animals: 0, pending: 0, enterprises: 0 })
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [enterpriseOverview, setEnterpriseOverview] = useState<EnterpriseOverviewStats | null>(null)
  const [corpStats, setCorpStats] = useState({ totalNetworks: 0, approvedNetworks: 0, pendingNetworks: 0, totalHospitals: 0, totalMembers: 0 })
  const [staffDashboard, setStaffDashboard] = useState<any>(null)

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

  useEffect(() => { loadDashboardData() }, [])

  const loadDashboardData = async () => {
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
      try { aRes = await apiService.listAnimals({ limit: 50 }) } catch {}

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
            } catch { /* non-fatal */ }
          }
        } catch {}
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
          description: `${mode} ${t('common.with')} ${who} — ${b.reasonForVisit || t('common.consultation')}`,
          time: b.scheduledDate ? formatDate(b.scheduledDate, { month: 'short', day: 'numeric' }) : '',
          status: b.status
        })
      })
      consults.slice(0, 2).forEach((c: any) => {
        acts.push({
          type: t('common.consultation'),
          description: `${c.animalType || t('common.animal')} — ${c.symptomDescription || t('common.generalConsultation')}`,
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

  // Stat cards — different per role
  const statCards = useMemo(() => {
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
      return [
        { label: t('dashboard.stats.appointments'), value: stats.bookings, icon: '📅', color: '#667eea', path: '/consultations?tab=bookings' },
        { label: t('dashboard.stats.consultations'), value: stats.consultations, icon: '🩺', color: '#764ba2', path: '/consultations?tab=consultations' },
        { label: t('dashboard.stats.patients'), value: stats.animals, icon: '🐾', color: '#10b981', path: '/animals' },
        { label: t('dashboard.stats.pending'), value: stats.pending, icon: '🔔', color: '#ef4444', path: '/consultations?tab=bookings&status=pending' },
      ]
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

    // Admin
    return [
      { label: t('dashboard.stats.appointments'), value: stats.bookings, icon: '📅', color: '#667eea', path: '/consultations?tab=bookings' },
      { label: t('dashboard.stats.consultations'), value: stats.consultations, icon: '🩺', color: '#764ba2', path: '/consultations?tab=consultations' },
      { label: t('dashboard.stats.myAnimals'), value: stats.animals, icon: '🐾', color: '#10b981', path: '/animals' },
      { label: t('dashboard.stats.pending'), value: stats.pending, icon: '⏳', color: '#ef4444', path: '/consultations?tab=bookings&status=pending' },
    ]
  }, [stats, isFarmer, isPetOwner, isVeterinarian, isAdmin, isCorporateAdmin, corpStats, t])

  // Quick actions — role-specific
  const quickActions: QuickAction[] = useMemo(() => {
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

    // Admin
    return [
      { icon: '🛡️', label: t('dashboard.quickActions.adminPanel'), path: '/admin/dashboard', color: '#667eea', description: t('dashboard.quickActions.desc.systemOverview') },
      { icon: '👥', label: t('dashboard.quickActions.users'), path: '/admin/users', color: '#8b5cf6', description: t('dashboard.quickActions.desc.userManagement') },
      { icon: '🩺', label: t('dashboard.quickActions.viewConsultations'), path: '/admin/consultations', color: '#10b981', description: t('dashboard.quickActions.desc.allConsultations') },
      { icon: '💳', label: t('dashboard.quickActions.payments'), path: '/admin/payments', color: '#f59e0b', description: t('dashboard.quickActions.desc.paymentManagement') },
      { icon: '⚖️', label: t('dashboard.quickActions.reviews'), path: '/admin/reviews', color: '#06b6d4', description: t('dashboard.quickActions.desc.reviewModeration') },
      { icon: '📜', label: t('dashboard.quickActions.auditLogs'), path: '/admin/audit-logs', color: '#ef4444', description: t('dashboard.quickActions.desc.systemActivity') },
      { icon: '🏥', label: t('dashboard.quickActions.hospitalMgmt'), path: '/admin/vet-hospitals', color: '#0ea5e9', description: t('dashboard.quickActions.desc.hospitalOversight') },
    ]
  }, [isFarmer, isPetOwner, isVeterinarian, isAdmin, isHospitalStaff, isCorporateAdmin, t])

  // Subtitle per role
  const subtitle = useMemo(() => {
    if (isVeterinarian) return t('dashboard.subtitles.vet')
    if (isPetOwner) return t('dashboard.subtitles.petOwner')
    if (isFarmer) return t('dashboard.subtitles.farmer')
    if (isAdmin) return t('dashboard.subtitles.admin')
    if (isHospitalStaff) return t('dashboard.subtitles.hospitalStaff')
    if (isCorporateAdmin) return t('dashboard.subtitles.corporateAdmin')
    return t('dashboard.greeting', { name: user?.firstName })
  }, [isVeterinarian, isPetOwner, isFarmer, isAdmin, isHospitalStaff, isCorporateAdmin, t, user?.firstName])

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
        <div className="dashboard-stats-grid">
          {statCards.map((stat, index) => (
            <div key={index} className="stat-card" onClick={() => navigate(stat.path)} title={`${t('common.view')} ${stat.label}`}>
              <div className="stat-icon" style={{ background: `${stat.color}15`, color: stat.color }}>
                <span>{stat.icon}</span>
              </div>
              <div className="stat-content">
                <div className="stat-value">{loading ? '—' : stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Hospital Staff Dashboard ── */}
      {isHospitalStaff && staffDashboard && (
        <div className="module-stats" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-icon">🏥</div>
            <div className="stat-value">{staffDashboard.hospitalName || t('dashboard.noHospital')}</div>
            <div className="stat-label">{t('dashboard.stats.myHospital')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🐾</div>
            <div className="stat-value">{staffDashboard.enrolledPatients || 0}</div>
            <div className="stat-label">{t('dashboard.stats.enrolledPatients')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📋</div>
            <div className="stat-value">{staffDashboard.todayQueueCount || 0}</div>
            <div className="stat-label">{t('dashboard.stats.todayQueue')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🛏️</div>
            <div className="stat-value">{staffDashboard.activeInpatients || 0}</div>
            <div className="stat-label">{t('dashboard.stats.activeInpatients')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🔄</div>
            <div className="stat-value">{staffDashboard.pendingReferrals || 0}</div>
            <div className="stat-label">{t('dashboard.stats.pendingReferrals')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{staffDashboard.staffCount || 0}</div>
            <div className="stat-label">{t('dashboard.stats.branchStaff')}</div>
          </div>
        </div>
      )}

      {/* ── Pending Booking Approvals — vet/admin only ── */}
      {hasPermission('dashboard_pending_approvals') && pendingBookings.length > 0 && (
        <div className="dashboard-alert-section">
          <div className="alert-card alert-warning">
            <div className="alert-header">
              <span className="alert-header-icon">🔔</span>
              <h3>{t('dashboard.pendingBookings')} ({pendingBookings.filter(booking => {
                const d = new Date(booking.scheduledDate + 'T' + (booking.timeSlotEnd || '23:59') + ':00')
                return d >= new Date()
              }).length})</h3>
            </div>
            <div className="alert-body">
              {pendingBookings.map(booking => {
                const expired = booking.status === 'pending' && (() => {
                  const d = new Date(booking.scheduledDate + 'T' + (booking.timeSlotEnd || '23:59') + ':00')
                  return d < new Date()
                })()
                // Skip expired pending bookings — backend auto-transitions these to missed
                if (expired) return null
                return (
                <div key={booking.id} className="alert-item">
                  <div className="alert-item-info">
                    <strong>{booking.petOwnerName || t('dashboard.pending.patient')}</strong>
                    <span className="alert-item-meta">
                      {formatDate(booking.scheduledDate, { weekday: 'short', month: 'short', day: 'numeric' })} {t('common.at')} {formatSlotTime(booking.timeSlotStart)}
                      {' · '}{booking.bookingType === 'video_call' ? t('dashboard.pending.video') : t('dashboard.pending.chat')}
                    </span>
                    <span className="alert-item-reason">
                      {booking.reasonForVisit || booking.reason || t('dashboard.pending.generalConsultation')}
                      {(booking.priority === 'urgent' || booking.priority === 'emergency') && (
                        <span className="priority-tag"> ⚠️ {t(`common.${booking.priority}`)?.toUpperCase()}</span>
                      )}
                    </span>
                  </div>
                  <div className="alert-item-actions">
                    <button className="btn-confirm" onClick={() => handleConfirm(booking.id)}>{t('dashboard.pending.confirm')}</button>
                    <button className="btn-decline" onClick={() => handleCancel(booking.id)}>{t('dashboard.pending.decline')}</button>
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Main Grid: Quick Actions + Activity ── */}
      <div className="dashboard-main-grid">
        {/* Quick Actions */}
        {hasPermission('dashboard_quick_actions') && (
          <section className="dashboard-section quick-actions-section">
            <div className="section-header">
              <h2 className="section-title">{t('dashboard.pageTitle')}</h2>
            </div>
            <div className="quick-actions-grid">
              {quickActions.map((action, i) => (
                <button key={i} className="action-card" onClick={() => navigate(action.path)}>
                  <div className="action-card-icon" style={{ background: `${action.color}12`, color: action.color }}>
                    <span>{action.icon}</span>
                  </div>
                  <div className="action-card-content">
                    <span className="action-card-label">{action.label}</span>
                    {action.description && <span className="action-card-desc">{action.description}</span>}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Recent Activity */}
        {hasPermission('dashboard_recent_activity') && (
          <section className="dashboard-section activity-section">
            <div className="section-header">
              <h2 className="section-title">{t('dashboard.recentActivity')}</h2>
              <button className="section-link" onClick={() => navigate('/consultations?tab=bookings')}>{t('dashboard.viewAll')}</button>
            </div>
            <div className="activity-list">
              {activities.length === 0 && !loading && (
                <div className="empty-state">
                  <span className="empty-icon">📭</span>
                  <p>{t('dashboard.noActivity')}</p>
                  {hasPermission('book_consultation') && (
                    <button className="empty-action" onClick={() => navigate('/book-consultation')}>
                      {t('dashboard.bookFirst')}
                    </button>
                  )}
                </div>
              )}
              {activities.map((activity, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-icon">
                    {activity.type === 'Consultation' ? '🩺' : '📅'}
                  </div>
                  <div className="activity-content">
                    <div className="activity-title">{activity.type}</div>
                    <div className="activity-description">{activity.description}</div>
                  </div>
                  <div className="activity-meta">
                    <span className={`activity-status status-${activity.status}`}>{t(`common.${activity.status}`) || activity.status}</span>
                    <span className="activity-time">{activity.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Vet: Upcoming Bookings + Recent Consultations ── */}
      {(hasPermission('dashboard_upcoming_bookings') || hasPermission('dashboard_recent_consultations')) && (
        <div className="dashboard-two-col">
          {hasPermission('dashboard_upcoming_bookings') && (
            <section className="dashboard-section">
              <div className="section-header">
                <h2 className="section-title">{t('dashboard.upcomingBookings')}</h2>
                <button className="section-link" onClick={() => navigate('/consultations?tab=bookings&status=confirmed')}>{t('dashboard.viewAll')}</button>
              </div>
              {upcomingBookings.length === 0 ? (
                <div className="empty-state">
                  <p>{t('dashboard.noUpcoming')}</p>
                  {hasPermission('view_schedule') && (
                    <button className="empty-action" onClick={() => navigate('/consultations?tab=schedule')}>
                      {t('dashboard.manageSchedule')}
                    </button>
                  )}
                </div>
              ) : (
                <div className="booking-list">
                  {upcomingBookings.map(booking => (
                    <div key={booking.id} className="booking-item">
                      <div className="booking-item-info">
                        <strong>{booking.petOwnerName || t('dashboard.pending.patient')}</strong>
                        <span className="booking-item-meta">
                          {formatDate(booking.scheduledDate)} {t('common.at')} {booking.timeSlotStart}
                        </span>
                        <span className="booking-item-meta">
                          {booking.bookingType === 'video_call' ? t('dashboard.pending.video') : t('dashboard.pending.chat')} ·{' '}
                          <span style={{ color: booking.priority === 'urgent' || booking.priority === 'emergency' ? '#dc2626' : undefined }}>
                            {t(`common.${booking.priority || 'normal'}`) || booking.priority}
                          </span>
                        </span>
                      </div>
                      <span className={`status-pill status-${booking.status}`}>{t(`common.${booking.status}`) || booking.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {hasPermission('dashboard_recent_consultations') && (
            <section className="dashboard-section">
              <div className="section-header">
                <h2 className="section-title">{t('dashboard.recentConsultations')}</h2>
              </div>
              {recentConsultations.length === 0 ? (
                <div className="empty-state">
                  <p>{t('dashboard.noRecent')}</p>
                  {hasPermission('book_consultation') && (
                    <button className="empty-action" onClick={() => navigate('/find-doctor')}>
                      {t('dashboard.findDoctor')}
                    </button>
                  )}
                </div>
              ) : (
                <div className="booking-list">
                  {recentConsultations.map(consultation => (
                    <div key={consultation.id} className="booking-item">
                      <div className="booking-item-info">
                        <strong>{consultation.title || t('dashboard.pending.consultation')}</strong>
                        <span className="booking-item-meta">
                          {formatDate(consultation.createdAt || '')}
                        </span>
                      </div>
                      <span className={`status-pill status-${consultation.status}`}>{t(`common.${consultation.status}`) || consultation.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* ── Role-Specific Feature Sections ── */}

      {/* Farmer Enterprise Overview */}
      {isFarmer && enterpriseOverview && (
        <div className="module-card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem 1.25rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>🏢 {t('dashboard.enterpriseOverview', 'Enterprise Overview')}</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => navigate('/enterprises')}>{t('common.viewAll', 'View All')}</button>
          </div>
          <div className="module-stats" style={{ padding: '0.75rem 1.25rem 1.25rem' }}>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/animals')}>
              <div className="stat-icon">🐄</div>
              <div className="stat-value">{enterpriseOverview.totalAnimals}</div>
              <div className="stat-label">{t('dashboard.stats.myAnimals', 'Total Animals')}</div>
            </div>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/campaigns')}>
              <div className="stat-icon">💉</div>
              <div className="stat-value">{enterpriseOverview.activeCampaigns}</div>
              <div className="stat-label">{t('dashboard.enterpriseStats.activeCampaigns', 'Active Campaigns')}</div>
            </div>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/movement-log')}>
              <div className="stat-icon">⏳</div>
              <div className="stat-value">{enterpriseOverview.pendingMovements}</div>
              <div className="stat-label">{t('dashboard.enterpriseStats.pendingApprovals', 'Pending Approvals')}</div>
            </div>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/animal-groups')}>
              <div className="stat-icon">📂</div>
              <div className="stat-value">{enterpriseOverview.activeGroups}</div>
              <div className="stat-label">{t('dashboard.enterpriseStats.groups', 'Enterprise Groups')}</div>
            </div>
          </div>
          <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" style={{ fontSize: '0.85rem' }} onClick={() => navigate('/herd-medical')}>💊 {t('dashboard.features.herdMedicalTitle', 'Herd Medical')}</button>
            <button className="btn btn-secondary" style={{ fontSize: '0.85rem' }} onClick={() => navigate('/campaigns')}>💉 {t('dashboard.features.treatmentCampaigns', 'Campaigns')}</button>
            <button className="btn btn-secondary" style={{ fontSize: '0.85rem' }} onClick={() => navigate('/movement-log')}>🔄 {t('movementLog.pageTitle', 'Movement Log')}</button>
            <button className="btn btn-secondary" style={{ fontSize: '0.85rem' }} onClick={() => navigate('/feed-inventory')}>🌾 {t('dashboard.features.feedTitle', 'Feed Inventory')}</button>
          </div>
        </div>
      )}

      {isFarmer && (
        <div className="dashboard-feature-grid">
          <div className="feature-card" onClick={() => navigate('/herd-medical')}>
            <div className="feature-card-icon" style={{ background: '#ec489915', color: '#ec4899' }}>💊</div>
            <div className="feature-card-body">
              <h3>{t('dashboard.features.herdMedicalTitle')}</h3>
              <p>{t('dashboard.features.herdMedicalDesc')}</p>
            </div>
            <span className="feature-arrow">→</span>
          </div>
          <div className="feature-card" onClick={() => navigate('/breeding')}>
            <div className="feature-card-icon" style={{ background: '#8b5cf615', color: '#8b5cf6' }}>🧬</div>
            <div className="feature-card-body">
              <h3>{t('dashboard.features.breedingTitle')}</h3>
              <p>{t('dashboard.features.breedingDesc')}</p>
            </div>
            <span className="feature-arrow">→</span>
          </div>
          <div className="feature-card" onClick={() => navigate('/feed-inventory')}>
            <div className="feature-card-icon" style={{ background: '#f59e0b15', color: '#f59e0b' }}>🌾</div>
            <div className="feature-card-body">
              <h3>{t('dashboard.features.feedTitle')}</h3>
              <p>{t('dashboard.features.feedDesc')}</p>
            </div>
            <span className="feature-arrow">→</span>
          </div>
        </div>
      )}

      {isPetOwner && (
        <div className="dashboard-feature-grid">
          <div className="feature-card" onClick={() => navigate('/wellness')}>
            <div className="feature-card-icon" style={{ background: '#14b8a615', color: '#14b8a6' }}>💚</div>
            <div className="feature-card-body">
              <h3>{t('dashboard.features.wellnessTitle')}</h3>
              <p>{t('dashboard.features.wellnessDesc')}</p>
            </div>
            <span className="feature-arrow">→</span>
          </div>
          <div className="feature-card" onClick={() => navigate('/marketplace')}>
            <div className="feature-card-icon" style={{ background: '#6366f115', color: '#6366f1' }}>🏪</div>
            <div className="feature-card-body">
              <h3>{t('dashboard.features.marketplaceTitle')}</h3>
              <p>{t('dashboard.features.marketplaceDesc')}</p>
            </div>
            <span className="feature-arrow">→</span>
          </div>
          <div className="feature-card" onClick={() => navigate('/ai-copilot')}>
            <div className="feature-card-icon" style={{ background: '#667eea15', color: '#667eea' }}>🤖</div>
            <div className="feature-card-body">
              <h3>{t('dashboard.features.aiHealthTitle')}</h3>
              <p>{t('dashboard.features.aiHealthDesc')}</p>
            </div>
            <span className="feature-arrow">→</span>
          </div>
        </div>
      )}

      {isVeterinarian && (
        <div className="dashboard-feature-grid">
          <div className="feature-card" onClick={() => navigate('/disease-prediction')}>
            <div className="feature-card-icon" style={{ background: '#ec489915', color: '#ec4899' }}>🧠</div>
            <div className="feature-card-body">
              <h3>{t('dashboard.features.diseaseAITitle')}</h3>
              <p>{t('dashboard.features.diseaseAIDesc')}</p>
            </div>
            <span className="feature-arrow">→</span>
          </div>
          <div className="feature-card" onClick={() => navigate('/report-builder')}>
            <div className="feature-card-icon" style={{ background: '#6366f115', color: '#6366f1' }}>📊</div>
            <div className="feature-card-body">
              <h3>{t('dashboard.features.reportBuilderTitle')}</h3>
              <p>{t('dashboard.features.reportBuilderDesc')}</p>
            </div>
            <span className="feature-arrow">→</span>
          </div>
          <div className="feature-card" onClick={() => navigate('/ai-copilot')}>
            <div className="feature-card-icon" style={{ background: '#667eea15', color: '#667eea' }}>🤖</div>
            <div className="feature-card-body">
              <h3>{t('dashboard.features.aiCopilotTitle')}</h3>
              <p>{t('dashboard.features.aiCopilotDesc')}</p>
            </div>
            <span className="feature-arrow">→</span>
          </div>
        </div>
      )}

      {/* ── Pro Tips (all roles) ── */}
      {hasPermission('dashboard_tips') && (
        <section className="dashboard-section tips-section">
          <div className="section-header">
            <h2 className="section-title">{t('dashboard.proTips')}</h2>
          </div>
          <div className="tips-grid">
            <div className="tip-card">
              <span className="tip-icon">💡</span>
              <div>
                <h4>{t('dashboard.tips.appointmentTitle')}</h4>
                <p>{t('dashboard.tips.appointmentDesc')}</p>
              </div>
            </div>
            <div className="tip-card">
              <span className="tip-icon">📱</span>
              <div>
                <h4>{t('dashboard.tips.healthTitle')}</h4>
                <p>{t('dashboard.tips.healthDesc')}</p>
              </div>
            </div>
            {isFarmer && (
              <div className="tip-card">
                <span className="tip-icon">🌾</span>
                <div>
                  <h4>{t('dashboard.tips.communityTitle')}</h4>
                  <p>{t('dashboard.tips.communityDesc')}</p>
                </div>
              </div>
            )}
            {isPetOwner && (
              <div className="tip-card">
                <span className="tip-icon">🐾</span>
                <div>
                  <h4>{t('dashboard.tips.communityTitle')}</h4>
                  <p>{t('dashboard.tips.communityDesc')}</p>
                </div>
              </div>
            )}
            {isVeterinarian && (
              <div className="tip-card">
                <span className="tip-icon">🩺</span>
                <div>
                  <h4>{t('dashboard.tips.communityTitle')}</h4>
                  <p>{t('dashboard.tips.communityDesc')}</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

export default Dashboard
