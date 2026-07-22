import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import apiService from '../../services/api'
import { AdminDashboardStats } from '../../types'
import '../../styles/modules.css'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

interface RevenueTrend {
  date: string
  revenue: number
  transactions: number
  refunds: number
}

interface TopVet {
  vetName: string
  totalRevenue: number
  consultations: number
}

interface AdminDashboardProps {
  onNavigate: (path: string) => void
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
  void useAuth() // ensure auth context
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revenueTrends, setRevenueTrends] = useState<{ daily: RevenueTrend[], topVets: TopVet[] } | null>(null)

  useEffect(() => {
    loadStats()
    loadRevenueTrends()
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

  const loadRevenueTrends = async () => {
    try {
      const result = await (apiService as any).get('/admin/revenue-trends?days=30')
      setRevenueTrends(result?.data?.data || null)
    } catch {
      // non-fatal — revenue trends unavailable
    }
  }
  useAutoRefresh(['dashboard', 'bookings', 'consultations', 'users'], loadStats)

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
        <div className="si-9ae995d6">
          <div className="si-aea35a6f">⚠️</div>
          <h3>{error || t('adminDashboard.failedToLoad')}</h3>
          <button className="btn btn-primary si-b0aee75b" onClick={loadStats}>🔄 {t('adminDashboard.retry')}</button>
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
      <div className="stats-grid si-019485cb">
        <div className="stat-card si-3c1f81b9" onClick={() => onNavigate('/admin/users')} title={t('adminDashboard.userManagement')}>
          <div className="stat-icon">👥</div>
          <div className="stat-value">{stats.totalUsers}</div>
          <div className="stat-label">{t('adminDashboard.totalUsers')}</div>
          <p className="si-cbb75da5">
            {stats.activeUsers} {t('adminDashboard.active')}
          </p>
        </div>
        <div className="stat-card si-3c1f81b9" onClick={() => onNavigate('/admin/users')} title={t('adminDashboard.veterinarians')}>
          <div className="stat-icon">👨‍⚕️</div>
          <div className="stat-value">{stats.totalVets}</div>
          <div className="stat-label">{t('adminDashboard.veterinarians')}</div>
        </div>
        <div className="stat-card si-3c1f81b9" onClick={() => onNavigate('/admin/consultations')} title={t('adminDashboard.consultations')}>
          <div className="stat-icon">🩺</div>
          <div className="stat-value">{stats.totalConsultations}</div>
          <div className="stat-label">{t('adminDashboard.totalConsultations')}</div>
          <p className="si-92ce97ac">
            {stats.activeConsultations} {t('adminDashboard.active')}
          </p>
        </div>
        <div className="stat-card si-3c1f81b9" onClick={() => onNavigate('/admin/payments')} title={t('adminDashboard.payments')}>
          <div className="stat-icon">💰</div>
          <div className="stat-value">${((stats.totalRevenue || 0) / 100).toLocaleString()}</div>
          <div className="stat-label">{t('adminDashboard.totalRevenue')}</div>
        </div>
      </div>

      {/* More Stats */}
      <div className="stats-grid si-54b5c5e0">
        <div className="stat-card si-3c1f81b9" onClick={() => onNavigate('/consultations')} title={t('adminDashboard.pendingBookings')}>
          <div className="stat-icon">📅</div>
          <div className="stat-value">{stats.pendingBookings}</div>
          <div className="stat-label">{t('adminDashboard.pendingBookings')}</div>
        </div>
        <div className="stat-card si-3c1f81b9" onClick={() => onNavigate('/admin/reviews')} title={t('adminDashboard.totalReviews')}>
          <div className="stat-icon">⭐</div>
          <div className="stat-value">{(+(stats.averageRating ?? 0)).toFixed(1)}</div>
          <div className="stat-label">{t('adminDashboard.avgRating')}</div>
        </div>
        <div className="stat-card si-3c1f81b9" onClick={() => onNavigate('/admin/reviews')} title={t('adminDashboard.totalReviews')}>
          <div className="stat-icon">📝</div>
          <div className="stat-value">{stats.totalReviews}</div>
          <div className="stat-label">{t('adminDashboard.totalReviews')}</div>
        </div>
        <div className="stat-card si-3c1f81b9" onClick={() => onNavigate('/admin/payments')} title={t('adminDashboard.pendingPayments')}>
          <div className="stat-icon">💳</div>
          <div className="stat-value">{stats.pendingPayments}</div>
          <div className="stat-label">{t('adminDashboard.pendingPayments')}</div>
        </div>
      </div>

      {/* Pending Actions */}
      {(stats.pendingUserApprovals ?? 0) > 0 && (
        <div className="module-alert error si-d0408997"
          onClick={() => onNavigate('/admin/users')}>
          <span>⚠️ <strong>{stats.pendingUserApprovals}</strong> user registration{(stats.pendingUserApprovals ?? 0) > 1 ? 's' : ''} pending your approval</span>
          <span className="si-8756b2e7">Review →</span>
        </div>
      )}
      {(stats.pendingNetworkApprovals ?? 0) > 0 && (
        <div className="module-alert error si-f764bc8b"
          onClick={() => onNavigate('/hospital-networks')}>
          <span>⚠️ <strong>{stats.pendingNetworkApprovals}</strong> hospital network{(stats.pendingNetworkApprovals ?? 0) > 1 ? 's' : ''} pending your approval</span>
          <span className="si-8756b2e7">Review → </span>
        </div>
      )}

      {/* More Stats — row 3: approval queues */}
      <div className="stats-grid si-54b5c5e0">
        <div className="stat-card" onClick={() => onNavigate('/admin/users')} style={{ cursor: 'pointer', borderLeft: (stats.pendingUserApprovals ?? 0) > 0 ? '4px solid #ef4444' : undefined }}
          title="User registrations awaiting approval">
          <div className="stat-icon">👤</div>
          <div className="stat-value" style={{ color: (stats.pendingUserApprovals ?? 0) > 0 ? '#ef4444' : undefined }}>{stats.pendingUserApprovals ?? 0}</div>
          <div className="stat-label">Pending User Approvals</div>
          {(stats.pendingUserApprovals ?? 0) > 0 && (
            <p className="si-74e80c30">⚠️ Action Required</p>
          )}
        </div>
        <div className="stat-card" onClick={() => onNavigate('/hospital-networks')} style={{ cursor: 'pointer', borderLeft: (stats.pendingNetworkApprovals ?? 0) > 0 ? '4px solid #f59e0b' : undefined }}
          title="Hospital Networks awaiting approval">
          <div className="stat-icon">🌐</div>
          <div className="stat-value" style={{ color: (stats.pendingNetworkApprovals ?? 0) > 0 ? '#f59e0b' : undefined }}>{stats.pendingNetworkApprovals ?? 0}</div>
          <div className="stat-label">Pending Network Approvals</div>
          {(stats.pendingNetworkApprovals ?? 0) > 0 && (
            <p className="si-28f50e75">⚠️ Action Required</p>
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
      </div>

      {/* Quick Navigation */}
      <div className="card si-b4c2d096">
        <div className="card-header"><h2>⚡ {t('adminDashboard.management')}</h2></div>
        <div className="card-body">
          <div className="si-8474b7be">
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
                className="btn btn-outline si-7ac62883"
               
                onClick={() => onNavigate(item.path)}
              >
                <span className="si-4b9a6e6e">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="card si-b4c2d096">
        <div className="card-header"><h2>🏥 {t('adminDashboard.systemHealth')}</h2></div>
        <div className="card-body">
          <div className="si-11f7f734">
            <div className="si-d85b8bef">
              <div className="si-bab2d193">
                <span className="si-1a2a957f" />
                <strong>{t('adminDashboard.apiServer')}</strong>
              </div>
              <p className="si-faa1c026">{t('adminDashboard.operational')}</p>
            </div>
            <div className="si-d85b8bef">
              <div className="si-bab2d193">
                <span className="si-1a2a957f" />
                <strong>{t('adminDashboard.database')}</strong>
              </div>
              <p className="si-faa1c026">{t('adminDashboard.connected')}</p>
            </div>
            <div className="si-d85b8bef">
              <div className="si-bab2d193">
                <span className="si-1a2a957f" />
                <strong>{t('adminDashboard.videoService')}</strong>
              </div>
              <p className="si-faa1c026">{t('adminDashboard.available')}</p>
            </div>
          </div>
        </div>
      </div>
      {/* Revenue Trends */}
      {revenueTrends && (
        <div className="card si-b4c2d096">
          <div className="card-header"><h2>📈 {t('adminDashboard.revenueTrends')} — {t('adminDashboard.last30Days')}</h2></div>
          <div className="card-body">
            <div className="si-e1725f0f">
              {/* Top Earning Vets */}
              <div>
                <h4 className="si-861621a0">🏆 {t('adminDashboard.topEarningVets')}</h4>
                {revenueTrends.topVets.length === 0 ? (
                  <p className="si-c36d98d3">No data</p>
                ) : (
                  <div className="si-977f8af1">
                    {revenueTrends.topVets.map((v, i) => (
                      <div key={i} className="si-c1ac1c29">
                        <div>
                          <span className="si-a9b7f385">{i + 1}. {v.vetName}</span>
                          <span className="si-824a7a1e">{v.consultations} consults</span>
                        </div>
                        <span className="si-a1917757">${((v.totalRevenue || 0) / 100).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Daily Revenue (last 7 days) */}
              <div>
                <h4 className="si-861621a0">📊 {t('adminDashboard.dailyRevenue')}</h4>
                {revenueTrends.daily.length === 0 ? (
                  <p className="si-c36d98d3">No data</p>
                ) : (() => {
                  const last7 = revenueTrends.daily.slice(-7)
                  const maxRev = Math.max(...last7.map(d => Number(d.revenue) || 0), 1)
                  const totalTx = revenueTrends.daily.reduce((s, d) => s + (Number(d.transactions) || 0), 0)
                  const totalRefunds = revenueTrends.daily.reduce((s, d) => s + (Number(d.refunds) || 0), 0)
                  return (
                    <>
                      <div className="si-55b6ce05">
                        {last7.map((d, i) => {
                          const h = Math.max(4, Math.round(((Number(d.revenue) || 0) / maxRev) * 72))
                          return (
                            <div key={i} className="si-4ab6939e">
                              <div style={{ width: '100%', height: h, background: 'linear-gradient(180deg,#6366f1,#818cf8)', borderRadius: '4px 4px 0 0' }} title={`$${((Number(d.revenue) || 0) / 100).toFixed(2)}`} />
                              <span className="si-85dee051">{new Date(d.date).getDate()}</span>
                            </div>
                          )
                        })}
                      </div>
                      <div className="si-2b60bf86">
                        <span><strong>{totalTx}</strong> {t('adminDashboard.totalTransactions')}</span>
                        <span className="si-4fb20e94"><strong>${((totalRefunds || 0) / 100).toFixed(2)}</strong> {t('adminDashboard.refundsIssued')}</span>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard
