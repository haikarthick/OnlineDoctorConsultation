import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import apiService from '../services/api'
import './Dashboard.css'

interface DashStats { bookings: number; consultations: number; animals: number; pending: number }
interface ActivityItem { type: string; description: string; time: string; status: string }

const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const { formatDate } = useSettings()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashStats>({ bookings: 0, consultations: 0, animals: 0, pending: 0 })
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  const isVeterinarian = user?.role === 'veterinarian'
  const isPetOwner = user?.role === 'pet_owner'
  const isFarmer = user?.role === 'farmer'

  useEffect(() => { loadDashboardData() }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
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

      setStats({ bookings: bookings.length, consultations: consults.length, animals: animals.length, pending })

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
    } catch { /* silently fail, stats stay 0 */ }
    finally { setLoading(false) }
  }

  const statCards = [
    { label: 'Appointments', value: stats.bookings, icon: '📅', color: '#667eea',
      path: '/consultations' },
    { label: 'Consultations', value: stats.consultations, icon: '🏥', color: '#764ba2',
      path: '/consultations' },
    { label: isPetOwner || isFarmer ? 'My Animals' : 'Patients', value: stats.animals, icon: '🐾', color: '#f093fb',
      path: isVeterinarian ? '/consultations' : '/animals' },
    { label: 'Pending Actions', value: stats.pending, icon: '⏳', color: '#4facfe',
      path: '/consultations' }
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
          </p>
        </div>
        <div className="dashboard-date">
          {formatDate(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats Cards */}
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

      <div className="dashboard-main-grid">
        {/* Quick Actions */}
        <section className="dashboard-section quick-actions">
          <div className="section-header">
            <h2 className="section-title">Quick Actions</h2>
          </div>
          <div className="quick-actions-grid">
            {isVeterinarian && (
              <>
                <button className="action-btn" onClick={() => navigate('/consultations')}>
                  <span className="action-icon">➕</span>
                  <span className="action-label">New Consultation</span>
                </button>
                <button className="action-btn" onClick={() => navigate('/consultations')}>
                  <span className="action-icon">👥</span>
                  <span className="action-label">View Patients</span>
                </button>
                <button className="action-btn" onClick={() => navigate('/doctor/manage-schedule')}>
                  <span className="action-icon">📊</span>
                  <span className="action-label">Manage Schedule</span>
                </button>
              </>
            )}
            {isPetOwner && (
              <>
                <button className="action-btn" onClick={() => navigate('/book-consultation')}>
                  <span className="action-icon">📞</span>
                  <span className="action-label">Book Consultation</span>
                </button>
                <button className="action-btn" onClick={() => navigate('/medical-records')}>
                  <span className="action-icon">📋</span>
                  <span className="action-label">View Records</span>
                </button>
                <button className="action-btn" onClick={() => navigate('/animals')}>
                  <span className="action-icon">🐾</span>
                  <span className="action-label">Add Pet</span>
                </button>
              </>
            )}
            {isFarmer && (
              <>
                <button className="action-btn" onClick={() => navigate('/animals')}>
                  <span className="action-icon">🚜</span>
                  <span className="action-label">Herd Management</span>
                </button>
                <button className="action-btn" onClick={() => navigate('/medical-records')}>
                  <span className="action-icon">💉</span>
                  <span className="action-label">Vaccination Schedule</span>
                </button>
                <button className="action-btn" onClick={() => navigate('/book-consultation')}>
                  <span className="action-icon">📞</span>
                  <span className="action-label">Consult Vet</span>
                </button>
              </>
            )}
          </div>
        </section>

        {/* Recent Activity */}
        <section className="dashboard-section recent-activity">
          <div className="section-header">
            <h2 className="section-title">Recent Activity</h2>
            <button className="view-all-link" onClick={() => navigate('/consultations')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667eea' }}>View All</button>
          </div>
          <div className="activity-list">
            {activities.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>
                <p>No recent activity yet</p>
                {isPetOwner && <button className="action-btn" onClick={() => navigate('/book-consultation')}><span className="action-label">Book your first consultation</span></button>}
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
      </div>

      {/* Featured Section */}
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
    </div>
  )
}

export default Dashboard
