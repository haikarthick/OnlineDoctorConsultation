import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { usePermission } from '../context/PermissionContext'
import apiService from '../services/api'
import { Booking, Consultation } from '../types'
import './Dashboard.css'

interface DashStats { bookings: number; consultations: number; animals: number; pending: number }
interface ActivityItem { type: string; description: string; time: string; status: string }

const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const { formatDate } = useSettings()
  const { hasPermission } = usePermission()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashStats>({ bookings: 0, consultations: 0, animals: 0, pending: 0 })
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  // Doctor-specific state (merged from DoctorDashboard)
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([])
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([])
  const [recentConsultations, setRecentConsultations] = useState<Consultation[]>([])
  const [error, setError] = useState('')

  const isVeterinarian = user?.role === 'veterinarian'
  const isPetOwner = user?.role === 'pet_owner'
  const isFarmer = user?.role === 'farmer'

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

      const bookings = bRes.data?.items || (Array.isArray(bRes.data) ? bRes.data : [])
      const consults = cRes.data?.items || (Array.isArray(cRes.data) ? cRes.data : [])
      const animals = aRes.data?.animals || aRes.data?.items || (Array.isArray(aRes.data) ? aRes.data : [])
      const pending = bookings.filter((b: any) => b.status === 'pending').length

      // Consultation count = bookings that actually had a consultation session (have consultationId)
      const consultationsDone = bookings.filter((b: any) => b.consultationId).length
      setStats({ bookings: bookings.length, consultations: consultationsDone, animals: animals.length, pending })

      // Vet-specific: pending approvals, upcoming confirmed, recent consultations
      if (hasPermission('dashboard_pending_approvals')) {
        setPendingBookings(bookings.filter((b: any) => b.status === 'pending'))
      }
      if (hasPermission('dashboard_upcoming_bookings')) {
        setUpcomingBookings(bookings.filter((b: any) => b.status === 'confirmed').slice(0, 5))
      }
      if (hasPermission('dashboard_recent_consultations')) {
        setRecentConsultations(consults.slice(0, 5))
      }

      // Build recent activity from real data
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
      setActivities(acts.length > 0 ? acts : [])
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

  const statCards = [
    { label: 'Appointments', value: stats.bookings, icon: '📅', color: '#667eea', path: '/consultations' },
    { label: 'Consultations', value: stats.consultations, icon: '🏥', color: '#764ba2', path: '/consultations' },
    { label: isPetOwner || isFarmer ? 'My Animals' : 'Patients', value: stats.animals, icon: '🐾', color: '#f093fb',
      path: isVeterinarian ? '/consultations' : '/animals' },
    { label: 'Pending Actions', value: stats.pending, icon: '⏳', color: '#4facfe', path: '/consultations' }
  ]

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="dashboard-title-section">
          <h1 className="dashboard-title">Welcome, {user?.firstName}!</h1>
          <p className="dashboard-subtitle">
            {isVeterinarian && 'Manage your consultations and patients'}
            {isPetOwner && 'Manage your pets and consultations'}
            {isFarmer && 'Manage your farm animals and consultations'}
            {user?.role === 'admin' && 'System administration overview'}
          </p>
        </div>
        <div className="dashboard-date">
          {formatDate(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {error && (
        <div style={{ padding: '14px 18px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
          <button style={{ marginLeft: 12, padding: '4px 12px', border: '1px solid #dc2626', borderRadius: 4, background: 'white', cursor: 'pointer' }} onClick={loadDashboardData}>Retry</button>
        </div>
      )}

      {/* Stats Cards */}
      {hasPermission('dashboard_stats') && (
        <div className="dashboard-stats-grid">
          {statCards.map((stat, index) => (
            <div key={index} className="stat-card" onClick={() => navigate(stat.path)}
              style={{ cursor: 'pointer' }} title={`View ${stat.label}`}>
              <div className="stat-icon" style={{ background: `${stat.color}20` }}>
                <span>{stat.icon}</span>
              </div>
              <div className="stat-content">
                <div className="stat-value">{loading ? '…' : stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending Booking Approvals — vet/admin only (permission-gated) */}
      {hasPermission('dashboard_pending_approvals') && pendingBookings.length > 0 && (
        <div className="dashboard-pending-section" style={{ marginBottom: 24 }}>
          <div style={{ border: '2px solid #fbbf24', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: '#fffbeb', padding: '16px 20px', fontWeight: 600, fontSize: 16 }}>
              🔔 Pending Booking Confirmations ({pendingBookings.length})
            </div>
            <div style={{ padding: '8px 20px 16px' }}>
              {pendingBookings.map(booking => (
                <div key={booking.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <strong>{booking.petOwnerName || 'Patient'}</strong>
                    <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
                      {formatDate(booking.scheduledDate, { weekday: 'short', month: 'short', day: 'numeric' })} at {booking.timeSlotStart}
                      {' • '}{booking.bookingType === 'video_call' ? '📹 Video' : '💬 Chat'}
                    </p>
                    <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
                      Reason: {booking.reasonForVisit || booking.reason || 'General consultation'}
                      {booking.priority === 'urgent' || booking.priority === 'emergency'
                        ? <span style={{ color: '#dc2626', fontWeight: 600 }}> — ⚠️ {booking.priority?.toUpperCase()}</span>
                        : null}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ padding: '6px 16px', fontSize: 13, border: 'none', borderRadius: 6, background: '#667eea', color: 'white', cursor: 'pointer' }} onClick={() => handleConfirm(booking.id)}>✓ Confirm</button>
                    <button style={{ padding: '6px 16px', fontSize: 13, border: '1px solid #dc2626', borderRadius: 6, background: 'white', color: '#dc2626', cursor: 'pointer' }} onClick={() => handleCancel(booking.id)}>✕ Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-main-grid">
        {/* Quick Actions */}
        {hasPermission('dashboard_quick_actions') && (
          <section className="dashboard-section quick-actions">
            <div className="section-header">
              <h2 className="section-title">Quick Actions</h2>
            </div>
            <div className="quick-actions-grid">
              {hasPermission('consultations') && (
                <button className="action-btn" onClick={() => navigate('/consultations')}>
                  <span className="action-icon">{isVeterinarian ? '👥' : '➕'}</span>
                  <span className="action-label">{isVeterinarian ? 'View Consultations' : 'New Consultation'}</span>
                </button>
              )}
              {hasPermission('book_consultation') && (
                <button className="action-btn" onClick={() => navigate('/book-consultation')}>
                  <span className="action-icon">📞</span>
                  <span className="action-label">Book Consultation</span>
                </button>
              )}
              {hasPermission('schedule_manage') && (
                <button className="action-btn" onClick={() => navigate('/doctor/manage-schedule')}>
                  <span className="action-icon">📊</span>
                  <span className="action-label">Manage Schedule</span>
                </button>
              )}
              {hasPermission('prescription_create') && (
                <button className="action-btn" onClick={() => navigate('/doctor/prescriptions')}>
                  <span className="action-icon">💊</span>
                  <span className="action-label">Prescriptions</span>
                </button>
              )}
              {hasPermission('medical_records') && (
                <button className="action-btn" onClick={() => navigate('/medical-records')}>
                  <span className="action-icon">📋</span>
                  <span className="action-label">Medical Records</span>
                </button>
              )}
              {hasPermission('animal_manage') && (
                <button className="action-btn" onClick={() => navigate('/animals')}>
                  <span className="action-icon">{isFarmer ? '🚜' : '🐾'}</span>
                  <span className="action-label">{isFarmer ? 'Herd Management' : 'My Animals'}</span>
                </button>
              )}
              {hasPermission('reviews') && isVeterinarian && (
                <button className="action-btn" onClick={() => navigate('/doctor/reviews')}>
                  <span className="action-icon">⭐</span>
                  <span className="action-label">My Reviews</span>
                </button>
              )}
            </div>
          </section>
        )}

        {/* Recent Activity */}
        {hasPermission('dashboard_recent_activity') && (
          <section className="dashboard-section recent-activity">
            <div className="section-header">
              <h2 className="section-title">Recent Activity</h2>
              <button className="view-all-link" onClick={() => navigate('/consultations')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667eea' }}>View All</button>
            </div>
            <div className="activity-list">
              {activities.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>
                  <p>No recent activity yet</p>
                  {hasPermission('book_consultation') && (
                    <button className="action-btn" onClick={() => navigate('/book-consultation')}>
                      <span className="action-label">Book your first consultation</span>
                    </button>
                  )}
                </div>
              )}
              {activities.map((activity, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-icon">
                    {activity.type === 'Consultation' && '🏥'}
                    {activity.type === 'Booking' && '📅'}
                  </div>
                  <div className="activity-content">
                    <div className="activity-title">{activity.type}</div>
                    <div className="activity-description">{activity.description}</div>
                  </div>
                  <div className="activity-meta">
                    <span className={`activity-status status-${activity.status}`}>
                      {activity.status}
                    </span>
                    <span className="activity-time">{activity.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Vet: Upcoming Bookings + Recent Consultations (two-column) */}
      {(hasPermission('dashboard_upcoming_bookings') || hasPermission('dashboard_recent_consultations')) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
          {/* Upcoming Bookings */}
          {hasPermission('dashboard_upcoming_bookings') && (
            <div className="dashboard-section" style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 className="section-title" style={{ margin: 0 }}>📅 Upcoming Bookings</h2>
                <button onClick={() => navigate('/consultations')} style={{ padding: '4px 12px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, background: 'white', cursor: 'pointer' }}>View All</button>
              </div>
              {upcomingBookings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>
                  <p>No upcoming bookings</p>
                </div>
              ) : (
                upcomingBookings.map(booking => (
                  <div key={booking.id} style={{ marginBottom: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{booking.petOwnerName || 'Patient'}</strong>
                        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
                          {formatDate(booking.scheduledDate)} at {booking.timeSlotStart}
                        </p>
                        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
                          {booking.bookingType === 'video_call' ? '📹 Video' : '💬 Chat'} •{' '}
                          <span style={{ color: booking.priority === 'urgent' || booking.priority === 'emergency' ? '#dc2626' : '#6b7280' }}>
                            {booking.priority || 'normal'}
                          </span>
                        </p>
                      </div>
                      <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 500,
                        background: booking.status === 'confirmed' ? '#dcfce7' : '#fef3c7',
                        color: booking.status === 'confirmed' ? '#16a34a' : '#d97706' }}>
                        {booking.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Recent Consultations */}
          {hasPermission('dashboard_recent_consultations') && (
            <div className="dashboard-section" style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div className="section-header" style={{ marginBottom: 16 }}>
                <h2 className="section-title" style={{ margin: 0 }}>🩺 Recent Consultations</h2>
              </div>
              {recentConsultations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>
                  <p>No recent consultations</p>
                </div>
              ) : (
                recentConsultations.map(consultation => (
                  <div key={consultation.id} style={{ marginBottom: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{consultation.title || 'Consultation'}</strong>
                        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
                          {formatDate(consultation.createdAt || '')}
                        </p>
                      </div>
                      <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 500,
                        background: consultation.status === 'completed' ? '#dcfce7' : consultation.status === 'in_progress' ? '#fef3c7' : '#f3f4f6',
                        color: consultation.status === 'completed' ? '#16a34a' : consultation.status === 'in_progress' ? '#d97706' : '#6b7280' }}>
                        {consultation.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Featured Section */}
      {hasPermission('dashboard_tips') && (
        <section className="dashboard-section featured-section">
          <div className="section-header">
            <h2 className="section-title">Pro Tips & Resources</h2>
          </div>
          <div className="featured-grid">
            <div className="featured-card">
              <div className="featured-icon">💡</div>
              <h3>Appointment Best Practices</h3>
              <p>Schedule consultations in advance for better availability</p>
              <a href="#" className="featured-link">Learn More →</a>
            </div>
            <div className="featured-card">
              <div className="featured-icon">📚</div>
              <h3>Health Resources</h3>
              <p>Access our comprehensive health articles and guides</p>
              <a href="#" className="featured-link">Explore →</a>
            </div>
            <div className="featured-card">
              <div className="featured-icon">🎯</div>
              <h3>Community Forum</h3>
              <p>Connect with other users and share experiences</p>
              <a href="#" className="featured-link">Join →</a>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

export default Dashboard
