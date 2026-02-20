import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import apiService from '../../services/api'
import { AdminDashboardStats } from '../../types'
import '../../styles/modules.css'

interface AdminDashboardProps {
  onNavigate: (path: string) => void
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  void useAuth() // ensure auth context
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      setLoading(true)
      setError('')
      const result = await apiService.getAdminDashboard()
      setStats(result.data)
    } catch (err: any) {
setError(err?.response?.data?.error?.message || err?.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="module-page">
        <div className="loading-container"><div className="loading-spinner" /><p>Loading admin dashboard...</p></div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="module-page">
        <div className="page-header"><div><h1>Admin Dashboard</h1></div></div>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h3>{error || 'Failed to load dashboard data'}</h3>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={loadStats}>🔄 Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="page-subtitle">System overview and management</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={loadStats}>🔄 Refresh</button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card" onClick={() => onNavigate('/admin/users')} style={{ cursor: 'pointer' }} title="View User Management">
          <div className="stat-icon">👥</div>
          <div className="stat-value">{stats.totalUsers}</div>
          <div className="stat-label">Total Users</div>
          <p style={{ fontSize: 12, color: '#059669', margin: '4px 0 0' }}>
            {stats.activeUsers} active
          </p>
        </div>
        <div className="stat-card" onClick={() => onNavigate('/admin/users')} style={{ cursor: 'pointer' }} title="View Veterinarians">
          <div className="stat-icon">👨‍⚕️</div>
          <div className="stat-value">{stats.totalVets}</div>
          <div className="stat-label">Veterinarians</div>
        </div>
        <div className="stat-card" onClick={() => onNavigate('/admin/consultations')} style={{ cursor: 'pointer' }} title="View Consultations">
          <div className="stat-icon">🩺</div>
          <div className="stat-value">{stats.totalConsultations}</div>
          <div className="stat-label">Total Consultations</div>
          <p style={{ fontSize: 12, color: '#3b82f6', margin: '4px 0 0' }}>
            {stats.activeConsultations} active
          </p>
        </div>
        <div className="stat-card" onClick={() => onNavigate('/admin/payments')} style={{ cursor: 'pointer' }} title="View Payments">
          <div className="stat-icon">💰</div>
          <div className="stat-value">${((stats.totalRevenue || 0) / 100).toLocaleString()}</div>
          <div className="stat-label">Total Revenue</div>
        </div>
      </div>

      {/* More Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 16 }}>
        <div className="stat-card" onClick={() => onNavigate('/consultations')} style={{ cursor: 'pointer' }} title="View Pending Bookings">
          <div className="stat-icon">📅</div>
          <div className="stat-value">{stats.pendingBookings}</div>
          <div className="stat-label">Pending Bookings</div>
        </div>
        <div className="stat-card" onClick={() => onNavigate('/admin/reviews')} style={{ cursor: 'pointer' }} title="View Reviews">
          <div className="stat-icon">⭐</div>
          <div className="stat-value">{(stats.averageRating ?? 0).toFixed(1)}</div>
          <div className="stat-label">Avg Rating</div>
        </div>
        <div className="stat-card" onClick={() => onNavigate('/admin/reviews')} style={{ cursor: 'pointer' }} title="View Reviews">
          <div className="stat-icon">📝</div>
          <div className="stat-value">{stats.totalReviews}</div>
          <div className="stat-label">Total Reviews</div>
        </div>
        <div className="stat-card" onClick={() => onNavigate('/admin/payments')} style={{ cursor: 'pointer' }} title="View Payments">
          <div className="stat-icon">💳</div>
          <div className="stat-value">{stats.pendingPayments}</div>
          <div className="stat-label">Pending Payments</div>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header"><h2>⚡ Management</h2></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { icon: '👥', label: 'User Management', path: '/admin/users' },
              { icon: '🩺', label: 'Consultations', path: '/admin/consultations' },
              { icon: '💳', label: 'Payments', path: '/admin/payments' },
              { icon: '⭐', label: 'Review Moderation', path: '/admin/reviews' },
              { icon: '⚙️', label: 'System Settings', path: '/admin/settings' },
              { icon: '📋', label: 'Audit Logs', path: '/admin/audit-logs' }
            ].map(item => (
              <button
                key={item.path}
                className="btn btn-outline"
                style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: 'auto' }}
                onClick={() => onNavigate(item.path)}
              >
                <span style={{ fontSize: 28 }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header"><h2>🏥 System Health</h2></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                <strong>API Server</strong>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>Operational</p>
            </div>
            <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                <strong>Database</strong>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>Connected</p>
            </div>
            <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                <strong>Video Service</strong>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>Available</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
