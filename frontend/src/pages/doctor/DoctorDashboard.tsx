import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import { Booking, Consultation } from '../../types'
import '../../styles/modules.css'

interface DoctorDashboardProps {
  onNavigate: (path: string) => void
}

const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth()
  const { formatDate } = useSettings()
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([])
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([])
  const [recentConsultations, setRecentConsultations] = useState<Consultation[]>([])
  const [stats, setStats] = useState({ totalPatients: 0, todayBookings: 0, completedToday: 0, pendingCount: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError('')
      const [confirmedRes, pendingRes, consultationsRes] = await Promise.all([
        apiService.listBookings({ status: 'confirmed' }),
        apiService.listBookings({ status: 'pending' }),
        apiService.listConsultations()
      ])

      const confirmed = confirmedRes.data?.items || (Array.isArray(confirmedRes.data) ? confirmedRes.data : [])
      const pending = pendingRes.data?.items || (Array.isArray(pendingRes.data) ? pendingRes.data : [])
      const consultations = consultationsRes.data?.items || (Array.isArray(consultationsRes.data) ? consultationsRes.data : [])

      setUpcomingBookings(confirmed.slice(0, 5))
      setPendingBookings(pending)
      setRecentConsultations(consultations.slice(0, 5))

      const today = new Date().toISOString().split('T')[0]
      setStats({
        totalPatients: new Set(consultations.map((c: any) => c.petOwnerId || c.pet_owner_id)).size,
        todayBookings: confirmed.filter((b: any) => b.scheduledDate?.startsWith(today) || b.scheduled_date?.startsWith(today)).length,
        completedToday: consultations.filter((c: any) =>
          c.status === 'completed' &&
          (c.updatedAt?.startsWith(today) || c.updated_at?.startsWith(today))
        ).length,
        pendingCount: pending.length
      })
    } catch (err: any) {
setError(err?.response?.data?.error?.message || err?.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (id: string) => {
    try { await apiService.confirmBooking(id); loadDashboard() }
    catch (err: any) { setError(err?.response?.data?.error?.message || 'Failed to confirm') }
  }
  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancel this booking?')) return
    try { await apiService.cancelBooking(id, 'Declined by doctor'); loadDashboard() }
    catch (err: any) { setError(err?.response?.data?.error?.message || 'Failed to cancel') }
  }

  if (loading) {
    return (
      <div className="module-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>Doctor Dashboard</h1>
          <p className="page-subtitle">Welcome back, Dr. {user?.lastName || user?.firstName}</p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '14px 18px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
          <button className="btn btn-outline" style={{ marginLeft: 12 }} onClick={loadDashboard}>Retry</button>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-value">{stats.totalPatients}</div>
          <div className="stat-label">Total Patients</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-value">{stats.todayBookings}</div>
          <div className="stat-label">Today's Bookings</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-value">{stats.completedToday}</div>
          <div className="stat-label">Completed Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-value">{stats.pendingCount}</div>
          <div className="stat-label">Pending Approvals</div>
        </div>
      </div>

      {/* Pending Booking Confirmations - Doctor Quick Action */}
      {pendingBookings.length > 0 && (
        <div className="card" style={{ marginBottom: 24, border: '2px solid #fbbf24' }}>
          <div className="card-header" style={{ background: '#fffbeb' }}>
            <h2>🔔 Pending Booking Confirmations ({pendingBookings.length})</h2>
          </div>
          <div className="card-body">
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
                  <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => handleConfirm(booking.id)}>✓ Confirm</button>
                  <button className="btn btn-outline" style={{ padding: '6px 16px', fontSize: 13, color: '#dc2626', borderColor: '#dc2626' }} onClick={() => handleCancel(booking.id)}>✕ Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><h2>⚡ Quick Actions</h2></div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => onNavigate('/consultations')}>
              👥 Consultations
            </button>
            <button className="btn btn-outline" onClick={() => onNavigate('/doctor/manage-schedule')}>
              📅 Manage Schedule
            </button>
            <button className="btn btn-outline" onClick={() => onNavigate('/doctor/prescriptions')}>
              💊 Write Prescription
            </button>
            <button className="btn btn-outline" onClick={() => onNavigate('/doctor/reviews')}>
              ⭐ My Reviews
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Upcoming Bookings */}
        <div className="card">
          <div className="card-header">
            <h2>📅 Upcoming Bookings</h2>
            <button className="btn btn-sm btn-outline" onClick={() => onNavigate('/consultations')}>
              View All
            </button>
          </div>
          <div className="card-body">
            {upcomingBookings.length === 0 ? (
              <div className="empty-state">
                <p>No upcoming bookings</p>
              </div>
            ) : (
              upcomingBookings.map(booking => (
                <div key={booking.id} className="booking-card" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{booking.petOwnerName || 'Patient'}</strong>
                      <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
                        {formatDate(booking.scheduledDate)} at {booking.timeSlotStart}
                      </p>
                      <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
                        {booking.consultationType === 'video' ? '📹 Video' : '💬 Chat'} •{' '}
                        <span className={`priority-${booking.priority || 'normal'}`}>
                          {booking.priority || 'normal'}
                        </span>
                      </p>
                    </div>
                    <span className={`badge badge-${booking.status === 'confirmed' ? 'active' : 'pending'}`}>
                      {booking.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Consultations */}
        <div className="card">
          <div className="card-header">
            <h2>🩺 Recent Consultations</h2>
          </div>
          <div className="card-body">
            {recentConsultations.length === 0 ? (
              <div className="empty-state">
                <p>No recent consultations</p>
              </div>
            ) : (
              recentConsultations.map(consultation => (
                <div key={consultation.id} className="booking-card" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{consultation.title || 'Consultation'}</strong>
                      <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
                        {formatDate(consultation.createdAt || '')}
                      </p>
                    </div>
                    <span className={`badge badge-${consultation.status === 'completed' ? 'active' : consultation.status === 'in_progress' ? 'pending' : 'inactive'}`}>
                      {consultation.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DoctorDashboard
