import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import apiService from '../../services/api'
import { AdminDashboardStats } from '../../types'
import '../../styles/modules.css'

interface AdminDashboardProps {
  onNavigate: (path: string) => void
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
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
        <div className="loading-container"><div className="loading-spinner" /><p>{t('adminDashboard.loading')}</p></div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="module-page">
        <div className="page-header"><div><h1>{t('adminDashboard.title')}</h1></div></div>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h3>{error || t('adminDashboard.failedToLoad')}</h3>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={loadStats}>🔄 {t('adminDashboard.retry')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>{t('adminDashboard.title')}</h1>
          <p className="page-subtitle">{t('adminDashboard.subtitle')}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={loadStats}>🔄 {t('adminDashboard.refresh')}</button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card" onClick={() => onNavigate('/admin/users')} style={{ cursor: 'pointer' }} title={t('adminDashboard.userManagement')}>
          <div className="stat-icon">👥</div>
          <div className="stat-value">{stats.totalUsers}</div>
          <div className="stat-label">{t('adminDashboard.totalUsers')}</div>
          <p style={{ fontSize: 12, color: '#059669', margin: '4px 0 0' }}>
            {stats.activeUsers} {t('adminDashboard.active')}
          </p>
        </div>
        <div className="stat-card" onClick={() => onNavigate('/admin/users')} style={{ cursor: 'pointer' }} title={t('adminDashboard.veterinarians')}>
          <div className="stat-icon">👨‍⚕️</div>
          <div className="stat-value">{stats.totalVets}</div>
          <div className="stat-label">{t('adminDashboard.veterinarians')}</div>
        </div>
        <div className="stat-card" onClick={() => onNavigate('/admin/consultations')} style={{ cursor: 'pointer' }} title={t('adminDashboard.consultations')}>
          <div className="stat-icon">🩺</div>
          <div className="stat-value">{stats.totalConsultations}</div>
          <div className="stat-label">{t('adminDashboard.totalConsultations')}</div>
          <p style={{ fontSize: 12, color: '#3b82f6', margin: '4px 0 0' }}>
            {stats.activeConsultations} {t('adminDashboard.active')}
          </p>
        </div>
        <div className="stat-card" onClick={() => onNavigate('/admin/payments')} style={{ cursor: 'pointer' }} title={t('adminDashboard.payments')}>
          <div className="stat-icon">💰</div>
          <div className="stat-value">${((stats.totalRevenue || 0) / 100).toLocaleString()}</div>
          <div className="stat-label">{t('adminDashboard.totalRevenue')}</div>
        </div>
      </div>

      {/* More Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 16 }}>
        <div className="stat-card" onClick={() => onNavigate('/consultations')} style={{ cursor: 'pointer' }} title={t('adminDashboard.pendingBookings')}>
          <div className="stat-icon">📅</div>
          <div className="stat-value">{stats.pendingBookings}</div>
          <div className="stat-label">{t('adminDashboard.pendingBookings')}</div>
        </div>
        <div className="stat-card" onClick={() => onNavigate('/admin/reviews')} style={{ cursor: 'pointer' }} title={t('adminDashboard.totalReviews')}>
          <div className="stat-icon">⭐</div>
          <div className="stat-value">{(+(stats.averageRating ?? 0)).toFixed(1)}</div>
          <div className="stat-label">{t('adminDashboard.avgRating')}</div>
        </div>
        <div className="stat-card" onClick={() => onNavigate('/admin/reviews')} style={{ cursor: 'pointer' }} title={t('adminDashboard.totalReviews')}>
          <div className="stat-icon">📝</div>
          <div className="stat-value">{stats.totalReviews}</div>
          <div className="stat-label">{t('adminDashboard.totalReviews')}</div>
        </div>
        <div className="stat-card" onClick={() => onNavigate('/admin/payments')} style={{ cursor: 'pointer' }} title={t('adminDashboard.pendingPayments')}>
          <div className="stat-icon">💳</div>
          <div className="stat-value">{stats.pendingPayments}</div>
          <div className="stat-label">{t('adminDashboard.pendingPayments')}</div>
        </div>
      </div>

      {/* Pending Actions */}
      {(stats.pendingNetworkApprovals ?? 0) > 0 && (
        <div className="module-alert error" style={{ marginTop: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          onClick={() => onNavigate('/hospital-networks')}>
          <span>⚠️ <strong>{stats.pendingNetworkApprovals}</strong> hospital network{(stats.pendingNetworkApprovals ?? 0) > 1 ? 's' : ''} pending your approval</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Review → </span>
        </div>
      )}

      {/* More Stats — row 3: network approvals */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 16 }}>
        <div className="stat-card" onClick={() => onNavigate('/hospital-networks')} style={{ cursor: 'pointer', borderLeft: (stats.pendingNetworkApprovals ?? 0) > 0 ? '4px solid #f59e0b' : undefined }}
          title="Hospital Networks awaiting approval">
          <div className="stat-icon">🌐</div>
          <div className="stat-value" style={{ color: (stats.pendingNetworkApprovals ?? 0) > 0 ? '#f59e0b' : undefined }}>{stats.pendingNetworkApprovals ?? 0}</div>
          <div className="stat-label">Pending Network Approvals</div>
          {(stats.pendingNetworkApprovals ?? 0) > 0 && (
            <p style={{ fontSize: 12, color: '#f59e0b', margin: '4px 0 0', fontWeight: 600 }}>⚠️ Action Required</p>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎬</div>
          <div className="stat-value">{stats.activeVideoSessions}</div>
          <div className="stat-label">{t('adminDashboard.liveVideoSessions')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-value">{stats.totalBookings}</div>
          <div className="stat-label">{t('adminDashboard.totalBookings')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-value">{stats.completedConsultations}</div>
          <div className="stat-label">{t('adminDashboard.completedConsultations')}</div>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header"><h2>⚡ {t('adminDashboard.management')}</h2></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { icon: '👥', label: t('adminDashboard.userManagement'), path: '/admin/users' },
              { icon: '🩺', label: t('adminDashboard.consultations'), path: '/admin/consultations' },
              { icon: '💳', label: t('adminDashboard.payments'), path: '/admin/payments' },
              { icon: '⭐', label: t('adminDashboard.reviewModeration'), path: '/admin/reviews' },
              { icon: '⚙️', label: t('adminDashboard.systemSettings'), path: '/admin/settings' },
              { icon: '📋', label: t('adminDashboard.auditLogs'), path: '/admin/audit-logs' }
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
        <div className="card-header"><h2>🏥 {t('adminDashboard.systemHealth')}</h2></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                <strong>{t('adminDashboard.apiServer')}</strong>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{t('adminDashboard.operational')}</p>
            </div>
            <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                <strong>{t('adminDashboard.database')}</strong>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{t('adminDashboard.connected')}</p>
            </div>
            <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                <strong>{t('adminDashboard.videoService')}</strong>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{t('adminDashboard.available')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
