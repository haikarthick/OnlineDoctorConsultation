import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import { CancellationStats } from '../../types'
import '../../styles/modules.css'

interface CancellationDashboardProps {
  onNavigate: (path: string) => void
}

const CancellationDashboard: React.FC<CancellationDashboardProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const [stats, setStats] = useState<CancellationStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      setLoading(true)
      const result = await apiService.adminGetCancellationStats()
      setStats(result.data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="module-page"><div className="loading-container"><div className="loading-spinner" /></div></div>
  }

  const totalCancellations = stats?.totalCancellations || 0
  const doctorCancellations = stats?.doctorCancellations || 0
  const patientCancellations = stats?.patientCancellations || 0
  const adminCancellations = stats?.adminCancellations || 0
  const totalRefunded = stats?.totalRefunded || 0
  const avgRefund = stats?.avgRefundAmount || 0

  const doctorPercent = totalCancellations > 0 ? Math.round((doctorCancellations / totalCancellations) * 100) : 0
  const patientPercent = totalCancellations > 0 ? Math.round((patientCancellations / totalCancellations) * 100) : 0
  const adminPercent = totalCancellations > 0 ? Math.round((adminCancellations / totalCancellations) * 100) : 0

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>📊 {t('cancellationDashboard.title')}</h1>
          <p className="page-subtitle">{t('cancellationDashboard.subtitle')}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={loadStats}>🔄 {t('cancellationDashboard.refresh')}</button>
          <button className="btn btn-outline" onClick={() => onNavigate('/admin/dashboard')}>← {t('cancellationDashboard.adminDashboard')}</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>{t('cancellationDashboard.totalCancellations')}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#dc2626' }}>{totalCancellations}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>{t('cancellationDashboard.byDoctors')}</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#d97706' }}>{doctorCancellations}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{doctorPercent}% {t('cancellationDashboard.ofTotal')}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>{t('cancellationDashboard.byPatients')}</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#2563eb' }}>{patientCancellations}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{patientPercent}% {t('cancellationDashboard.ofTotal')}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>{t('cancellationDashboard.byAdmin')}</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#6b7280' }}>{adminCancellations}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{adminPercent}% {t('cancellationDashboard.ofTotal')}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>{t('cancellationDashboard.totalRefunded')}</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#059669' }}>{formatCurrency(totalRefunded)}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>{t('cancellationDashboard.avgRefund')}</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#059669' }}>{formatCurrency(avgRefund)}</div>
        </div>
      </div>

      {/* Cancellation Breakdown Bar */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2>📊 {t('cancellationDashboard.cancellationBreakdown')}</h2>
        </div>
        <div className="card-body">
          {totalCancellations > 0 ? (
            <>
              <div style={{ display: 'flex', height: 32, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                {doctorPercent > 0 && (
                  <div style={{ width: `${doctorPercent}%`, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 600 }}>
                    {doctorPercent}%
                  </div>
                )}
                {patientPercent > 0 && (
                  <div style={{ width: `${patientPercent}%`, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 600 }}>
                    {patientPercent}%
                  </div>
                )}
                {adminPercent > 0 && (
                  <div style={{ width: `${adminPercent}%`, background: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 600 }}>
                    {adminPercent}%
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: '#f59e0b' }} />
                  <span style={{ fontSize: 13 }}>{t('cancellationDashboard.doctor')} ({doctorCancellations})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: '#3b82f6' }} />
                  <span style={{ fontSize: 13 }}>{t('cancellationDashboard.patient')} ({patientCancellations})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: '#6b7280' }} />
                  <span style={{ fontSize: 13 }}>{t('cancellationDashboard.admin')} ({adminCancellations})</span>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
              <p>{t('cancellationDashboard.noCancellationsYet')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Policy guidance */}
      <div className="card">
        <div className="card-header">
          <h2>💡 {t('cancellationDashboard.insightsAndActions')}</h2>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gap: 12 }}>
            {doctorPercent > 40 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
                🚨 <strong>{t('cancellationDashboard.highDoctorCancellationRate')} ({doctorPercent}%)</strong> — {t('cancellationDashboard.highDoctorCancellationAdvice')}
                <button className="btn btn-sm btn-outline" style={{ marginLeft: 8 }} onClick={() => onNavigate('/admin/settings')}>
                  {t('cancellationDashboard.reviewPolicy')}
                </button>
              </div>
            )}
            {totalRefunded > 10000 && (
              <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
                ⚠️ <strong>{t('cancellationDashboard.highRefundVolume')} ({formatCurrency(totalRefunded)})</strong> — {t('cancellationDashboard.highRefundAdvice')}
              </div>
            )}
            {totalCancellations === 0 && (
              <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
                ✅ <strong>{t('cancellationDashboard.noCancellations')}</strong> — {t('cancellationDashboard.perfectCompletionRate')}
              </div>
            )}
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
              📋 <strong>{t('cancellationDashboard.managePolicies')}</strong> {' '}
              <button className="btn btn-sm btn-outline" style={{ marginLeft: 4 }} onClick={() => onNavigate('/admin/settings')}>
                {t('cancellationDashboard.systemSettings')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CancellationDashboard
