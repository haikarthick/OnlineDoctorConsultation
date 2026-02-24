import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { usePermission } from '../context/PermissionContext'
import apiService from '../services/api'
import { Booking, Consultation } from '../types'
import './Dashboard.css'

/* ════════════════════════════════════════════════════════
 * TYPES
 * ════════════════════════════════════════════════════════ */
interface DashStats { bookings: number; consultations: number; animals: number; pending: number; enterprises?: number }
interface ActivityItem { type: string; description: string; time: string; status: string }
interface QuickAction { icon: string; label: string; path: string; color: string; description?: string }

const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const { formatDate } = useSettings()
  const { hasPermission } = usePermission()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashStats>({ bookings: 0, consultations: 0, animals: 0, pending: 0, enterprises: 0 })
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  // Doctor-specific state
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([])
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([])
  const [recentConsultations, setRecentConsultations] = useState<Consultation[]>([])
  const [error, setError] = useState('')

  const isVeterinarian = user?.role === 'veterinarian'
  const isPetOwner = user?.role === 'pet_owner'
  const isFarmer = user?.role === 'farmer'
  const isAdmin = user?.role === 'admin'

  useEffect(() => { loadDashboardData() }, [])

  const loadDashboardData = async () => {
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
        } catch {}
      }

      const bookings = bRes.data?.items || (Array.isArray(bRes.data) ? bRes.data : [])
      const consults = cRes.data?.items || (Array.isArray(cRes.data) ? cRes.data : [])
      const animals = aRes.data?.animals || aRes.data?.items || (Array.isArray(aRes.data) ? aRes.data : [])
      const pending = bookings.filter((b: any) => b.status === 'pending').length
      const consultationsDone = bookings.filter((b: any) => b.consultationId).length
      setStats({ bookings: bookings.length, consultations: consultationsDone, animals: animals.length, pending, enterprises: eCount })

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
        const who = isVeterinarian ? (b.petOwnerName || 'Patient') : (b.vetName || 'Doctor')
        acts.push({
          type: 'Booking',
          description: `${b.bookingType === 'video_call' ? 'Video' : 'In-person'} with ${who} — ${b.reasonForVisit || 'Consultation'}`,
          time: b.scheduledDate ? formatDate(b.scheduledDate, { month: 'short', day: 'numeric' }) : '',
          status: b.status
        })
      })
      consults.slice(0, 2).forEach((c: any) => {
        acts.push({
          type: 'Consultation',
          description: `${c.animalType || 'Animal'} — ${c.symptomDescription || 'General consultation'}`,
          time: c.scheduledAt ? formatDate(c.scheduledAt, { month: 'short', day: 'numeric' }) : '',
          status: c.status
        })
      })
      setActivities(acts)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  // ── Doctor actions ──
  const handleConfirm = async (id: string) => {
    try { await apiService.confirmBooking(id); loadDashboardData() }
    catch (err: any) { setError(err?.response?.data?.error?.message || 'Failed to confirm') }
  }
  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancel this booking?')) return
    try { await apiService.cancelBooking(id, 'Declined by doctor'); loadDashboardData() }
    catch (err: any) { setError(err?.response?.data?.error?.message || 'Failed to cancel') }
  }

  /* ════════════════════════════════════════════════════════
   * ROLE-SPECIFIC CONFIGURATIONS
   * ════════════════════════════════════════════════════════ */

  // Stat cards — different per role
  const statCards = useMemo(() => {
    const base = [
      { label: 'Appointments', value: stats.bookings, icon: '📅', color: '#667eea', path: '/consultations' },
      { label: 'Consultations', value: stats.consultations, icon: '🩺', color: '#764ba2', path: '/consultations' },
    ]

    if (isFarmer) {
      return [
        ...base,
        { label: 'My Animals', value: stats.animals, icon: '🐄', color: '#10b981', path: '/animals' },
        { label: 'Enterprises', value: stats.enterprises || 0, icon: '🏢', color: '#f59e0b', path: '/enterprises' },
        { label: 'Pending', value: stats.pending, icon: '⏳', color: '#ef4444', path: '/consultations' },
      ]
    }

    if (isPetOwner) {
      return [
        ...base,
        { label: 'My Pets', value: stats.animals, icon: '🐾', color: '#10b981', path: '/animals' },
        { label: 'Pending', value: stats.pending, icon: '⏳', color: '#ef4444', path: '/consultations' },
      ]
    }

    if (isVeterinarian) {
      return [
        ...base,
        { label: 'Patients Seen', value: stats.animals, icon: '🐾', color: '#10b981', path: '/consultations' },
        { label: 'Pending Approvals', value: stats.pending, icon: '🔔', color: '#ef4444', path: '/consultations' },
      ]
    }

    // Admin
    return [
      ...base,
      { label: 'Total Animals', value: stats.animals, icon: '🐾', color: '#10b981', path: '/admin/dashboard' },
      { label: 'Pending', value: stats.pending, icon: '⏳', color: '#ef4444', path: '/admin/consultations' },
    ]
  }, [stats, isFarmer, isPetOwner, isVeterinarian, isAdmin])

  // Quick actions — role-specific
  const quickActions: QuickAction[] = useMemo(() => {
    if (isFarmer) {
      return [
        { icon: '📝', label: 'Book Consultation', path: '/book-consultation', color: '#667eea', description: 'Schedule a vet visit' },
        { icon: '🐄', label: 'My Animals', path: '/animals', color: '#10b981', description: 'Manage your livestock' },
        { icon: '🏢', label: 'Farm / Enterprise', path: '/enterprises', color: '#f59e0b', description: 'Manage your farm' },
        { icon: '🐾', label: 'Herds & Groups', path: '/animal-groups', color: '#8b5cf6', description: 'Organize animal groups' },
        { icon: '📋', label: 'Medical Records', path: '/medical-records', color: '#06b6d4', description: 'Health history' },
        { icon: '💊', label: 'Herd Medical', path: '/herd-medical', color: '#ec4899', description: 'Herd health management' },
        { icon: '💉', label: 'Campaigns', path: '/campaigns', color: '#14b8a6', description: 'Treatment campaigns' },
        { icon: '📈', label: 'Health Analytics', path: '/health-analytics', color: '#6366f1', description: 'Insights & trends' },
      ]
    }

    if (isPetOwner) {
      return [
        { icon: '📝', label: 'Book Consultation', path: '/book-consultation', color: '#667eea', description: 'Schedule a vet visit' },
        { icon: '🔍', label: 'Find Doctor', path: '/find-doctor', color: '#8b5cf6', description: 'Search veterinarians' },
        { icon: '🐾', label: 'My Pets', path: '/animals', color: '#10b981', description: 'Manage your pets' },
        { icon: '📋', label: 'Medical Records', path: '/medical-records', color: '#06b6d4', description: 'Pet health history' },
        { icon: '💚', label: 'Wellness Portal', path: '/wellness', color: '#14b8a6', description: 'Pet wellness tips' },
        { icon: '✍️', label: 'Write Review', path: '/write-review', color: '#f59e0b', description: 'Rate your vet' },
      ]
    }

    if (isVeterinarian) {
      return [
        { icon: '🏥', label: 'Consultations', path: '/consultations', color: '#667eea', description: 'View all consultations' },
        { icon: '🗓️', label: 'My Schedule', path: '/doctor/manage-schedule', color: '#8b5cf6', description: 'Manage availability' },
        { icon: '💊', label: 'Prescriptions', path: '/doctor/prescriptions', color: '#10b981', description: 'Write prescriptions' },
        { icon: '📋', label: 'Medical Records', path: '/medical-records', color: '#06b6d4', description: 'Patient records' },
        { icon: '📈', label: 'Health Analytics', path: '/health-analytics', color: '#f59e0b', description: 'Health insights' },
        { icon: '🧠', label: 'Disease AI', path: '/disease-prediction', color: '#ec4899', description: 'AI diagnosis assist' },
        { icon: '⭐', label: 'My Reviews', path: '/doctor/reviews', color: '#14b8a6', description: 'Patient feedback' },
        { icon: '🔔', label: 'Smart Alerts', path: '/alerts', color: '#ef4444', description: 'Health notifications' },
      ]
    }

    // Admin
    return [
      { icon: '🛡️', label: 'Admin Panel', path: '/admin/dashboard', color: '#667eea', description: 'System overview' },
      { icon: '👥', label: 'Users', path: '/admin/users', color: '#8b5cf6', description: 'User management' },
      { icon: '🩺', label: 'Consultations', path: '/admin/consultations', color: '#10b981', description: 'All consultations' },
      { icon: '💳', label: 'Payments', path: '/admin/payments', color: '#f59e0b', description: 'Payment management' },
      { icon: '⚖️', label: 'Reviews', path: '/admin/reviews', color: '#06b6d4', description: 'Review moderation' },
      { icon: '📜', label: 'Audit Logs', path: '/admin/audit-logs', color: '#ef4444', description: 'System activity' },
    ]
  }, [isFarmer, isPetOwner, isVeterinarian, isAdmin])

  // Subtitle per role
  const subtitle = useMemo(() => {
    if (isVeterinarian) return 'Manage your consultations, patients, and schedule'
    if (isPetOwner) return 'Take care of your pets and book vet consultations'
    if (isFarmer) return 'Manage your farm, animals, and veterinary care'
    if (isAdmin) return 'System administration and oversight'
    return 'Welcome to VetCare'
  }, [isVeterinarian, isPetOwner, isFarmer, isAdmin])

  return (
    <div className="dashboard-container">
      {/* ── Header ── */}
      <div className="dashboard-header">
        <div className="dashboard-title-section">
          <h1 className="dashboard-title">Welcome, {user?.firstName}!</h1>
          <p className="dashboard-subtitle">{subtitle}</p>
        </div>
        <div className="dashboard-date">
          {formatDate(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {error && (
        <div className="dashboard-error">
          <span>⚠️ {error}</span>
          <button onClick={loadDashboardData}>Retry</button>
        </div>
      )}

      {/* ── Stats Cards ── */}
      {hasPermission('dashboard_stats') && (
        <div className="dashboard-stats-grid">
          {statCards.map((stat, index) => (
            <div key={index} className="stat-card" onClick={() => navigate(stat.path)} title={`View ${stat.label}`}>
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

      {/* ── Pending Booking Approvals — vet/admin only ── */}
      {hasPermission('dashboard_pending_approvals') && pendingBookings.length > 0 && (
        <div className="dashboard-alert-section">
          <div className="alert-card alert-warning">
            <div className="alert-header">
              <span className="alert-header-icon">🔔</span>
              <h3>Pending Booking Confirmations ({pendingBookings.length})</h3>
            </div>
            <div className="alert-body">
              {pendingBookings.map(booking => (
                <div key={booking.id} className="alert-item">
                  <div className="alert-item-info">
                    <strong>{booking.petOwnerName || 'Patient'}</strong>
                    <span className="alert-item-meta">
                      {formatDate(booking.scheduledDate, { weekday: 'short', month: 'short', day: 'numeric' })} at {booking.timeSlotStart}
                      {' · '}{booking.bookingType === 'video_call' ? '📹 Video' : '💬 Chat'}
                    </span>
                    <span className="alert-item-reason">
                      {booking.reasonForVisit || booking.reason || 'General consultation'}
                      {(booking.priority === 'urgent' || booking.priority === 'emergency') && (
                        <span className="priority-tag"> ⚠️ {booking.priority?.toUpperCase()}</span>
                      )}
                    </span>
                  </div>
                  <div className="alert-item-actions">
                    <button className="btn-confirm" onClick={() => handleConfirm(booking.id)}>✓ Confirm</button>
                    <button className="btn-decline" onClick={() => handleCancel(booking.id)}>✕ Decline</button>
                  </div>
                </div>
              ))}
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
              <h2 className="section-title">Quick Actions</h2>
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
              <h2 className="section-title">Recent Activity</h2>
              <button className="section-link" onClick={() => navigate('/consultations')}>View All</button>
            </div>
            <div className="activity-list">
              {activities.length === 0 && !loading && (
                <div className="empty-state">
                  <span className="empty-icon">📭</span>
                  <p>No recent activity yet</p>
                  {hasPermission('book_consultation') && (
                    <button className="empty-action" onClick={() => navigate('/book-consultation')}>
                      Book your first consultation
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
                    <span className={`activity-status status-${activity.status}`}>{activity.status}</span>
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
                <h2 className="section-title">📅 Upcoming Bookings</h2>
                <button className="section-link" onClick={() => navigate('/consultations')}>View All</button>
              </div>
              {upcomingBookings.length === 0 ? (
                <div className="empty-state"><p>No upcoming bookings</p></div>
              ) : (
                <div className="booking-list">
                  {upcomingBookings.map(booking => (
                    <div key={booking.id} className="booking-item">
                      <div className="booking-item-info">
                        <strong>{booking.petOwnerName || 'Patient'}</strong>
                        <span className="booking-item-meta">
                          {formatDate(booking.scheduledDate)} at {booking.timeSlotStart}
                        </span>
                        <span className="booking-item-meta">
                          {booking.bookingType === 'video_call' ? '📹 Video' : '💬 Chat'} ·{' '}
                          <span style={{ color: booking.priority === 'urgent' || booking.priority === 'emergency' ? '#dc2626' : undefined }}>
                            {booking.priority || 'normal'}
                          </span>
                        </span>
                      </div>
                      <span className={`status-pill status-${booking.status}`}>{booking.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {hasPermission('dashboard_recent_consultations') && (
            <section className="dashboard-section">
              <div className="section-header">
                <h2 className="section-title">🩺 Recent Consultations</h2>
              </div>
              {recentConsultations.length === 0 ? (
                <div className="empty-state"><p>No recent consultations</p></div>
              ) : (
                <div className="booking-list">
                  {recentConsultations.map(consultation => (
                    <div key={consultation.id} className="booking-item">
                      <div className="booking-item-info">
                        <strong>{consultation.title || 'Consultation'}</strong>
                        <span className="booking-item-meta">
                          {formatDate(consultation.createdAt || '')}
                        </span>
                      </div>
                      <span className={`status-pill status-${consultation.status}`}>{consultation.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* ── Role-Specific Feature Sections ── */}
      {isFarmer && (
        <div className="dashboard-feature-grid">
          <div className="feature-card" onClick={() => navigate('/herd-medical')}>
            <div className="feature-card-icon" style={{ background: '#ec489915', color: '#ec4899' }}>💊</div>
            <div className="feature-card-body">
              <h3>Herd Medical Management</h3>
              <p>Track treatments, vaccinations, and health records for your entire herd</p>
            </div>
            <span className="feature-arrow">→</span>
          </div>
          <div className="feature-card" onClick={() => navigate('/breeding')}>
            <div className="feature-card-icon" style={{ background: '#8b5cf615', color: '#8b5cf6' }}>🧬</div>
            <div className="feature-card-body">
              <h3>Breeding & Genetics</h3>
              <p>Manage breeding cycles, lineage tracking, and genetic data</p>
            </div>
            <span className="feature-arrow">→</span>
          </div>
          <div className="feature-card" onClick={() => navigate('/feed-inventory')}>
            <div className="feature-card-icon" style={{ background: '#f59e0b15', color: '#f59e0b' }}>🌾</div>
            <div className="feature-card-body">
              <h3>Feed & Inventory</h3>
              <p>Monitor feed stock, nutrition plans, and supply management</p>
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
              <h3>Wellness Portal</h3>
              <p>Health tips, nutrition guides, and wellness tracking for your pet</p>
            </div>
            <span className="feature-arrow">→</span>
          </div>
          <div className="feature-card" onClick={() => navigate('/marketplace')}>
            <div className="feature-card-icon" style={{ background: '#6366f115', color: '#6366f1' }}>🏪</div>
            <div className="feature-card-body">
              <h3>Marketplace</h3>
              <p>Browse pet products, medications, and health supplies</p>
            </div>
            <span className="feature-arrow">→</span>
          </div>
          <div className="feature-card" onClick={() => navigate('/ai-copilot')}>
            <div className="feature-card-icon" style={{ background: '#667eea15', color: '#667eea' }}>🤖</div>
            <div className="feature-card-body">
              <h3>AI Health Assistant</h3>
              <p>Get instant AI-powered health advice for your pet</p>
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
              <h3>Disease AI Prediction</h3>
              <p>AI-assisted diagnosis and disease prediction tools</p>
            </div>
            <span className="feature-arrow">→</span>
          </div>
          <div className="feature-card" onClick={() => navigate('/report-builder')}>
            <div className="feature-card-icon" style={{ background: '#6366f115', color: '#6366f1' }}>📊</div>
            <div className="feature-card-body">
              <h3>Report Builder</h3>
              <p>Create custom medical and analytics reports</p>
            </div>
            <span className="feature-arrow">→</span>
          </div>
          <div className="feature-card" onClick={() => navigate('/ai-copilot')}>
            <div className="feature-card-icon" style={{ background: '#667eea15', color: '#667eea' }}>🤖</div>
            <div className="feature-card-body">
              <h3>AI Copilot</h3>
              <p>Get AI-powered clinical decision support</p>
            </div>
            <span className="feature-arrow">→</span>
          </div>
        </div>
      )}

      {/* ── Pro Tips (all roles) ── */}
      {hasPermission('dashboard_tips') && (
        <section className="dashboard-section tips-section">
          <div className="section-header">
            <h2 className="section-title">Tips & Resources</h2>
          </div>
          <div className="tips-grid">
            <div className="tip-card">
              <span className="tip-icon">💡</span>
              <div>
                <h4>Keyboard Shortcut</h4>
                <p>Press <kbd>Ctrl</kbd>+<kbd>B</kbd> to toggle the sidebar for more screen space</p>
              </div>
            </div>
            <div className="tip-card">
              <span className="tip-icon">📱</span>
              <div>
                <h4>Stay Connected</h4>
                <p>Use video consultations for remote check-ups and follow-ups</p>
              </div>
            </div>
            {isFarmer && (
              <div className="tip-card">
                <span className="tip-icon">🌾</span>
                <div>
                  <h4>Farm Tip</h4>
                  <p>Set up treatment campaigns for efficient herd-wide vaccination management</p>
                </div>
              </div>
            )}
            {isPetOwner && (
              <div className="tip-card">
                <span className="tip-icon">🐾</span>
                <div>
                  <h4>Pet Care Tip</h4>
                  <p>Keep medical records up to date for faster consultations</p>
                </div>
              </div>
            )}
            {isVeterinarian && (
              <div className="tip-card">
                <span className="tip-icon">🩺</span>
                <div>
                  <h4>Practice Tip</h4>
                  <p>Use the AI Copilot for evidence-based clinical decision support</p>
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
