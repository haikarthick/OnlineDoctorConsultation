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
      <div className="si-76bd994f">
        <div className="card si-5e451b11">
          <div className="si-d8c79ed7">{t('cancellationDashboard.totalCancellations')}</div>
          <div className="si-92e68741">{totalCancellations}</div>
        </div>
        <div className="card si-5e451b11">
          <div className="si-d8c79ed7">{t('cancellationDashboard.byDoctors')}</div>
          <div className="si-a3e9861f">{doctorCancellations}</div>
          <div className="si-3f4bbe41">{doctorPercent}% {t('cancellationDashboard.ofTotal')}</div>
        </div>
        <div className="card si-5e451b11">
          <div className="si-d8c79ed7">{t('cancellationDashboard.byPatients')}</div>
          <div className="si-87ce733a">{patientCancellations}</div>
          <div className="si-3f4bbe41">{patientPercent}% {t('cancellationDashboard.ofTotal')}</div>
        </div>
        <div className="card si-5e451b11">
          <div className="si-d8c79ed7">{t('cancellationDashboard.byAdmin')}</div>
          <div className="si-927ef5d8">{adminCancellations}</div>
          <div className="si-3f4bbe41">{adminPercent}% {t('cancellationDashboard.ofTotal')}</div>
        </div>
        <div className="card si-5e451b11">
          <div className="si-d8c79ed7">{t('cancellationDashboard.totalRefunded')}</div>
          <div className="si-5c34ccdf">{formatCurrency(totalRefunded)}</div>
        </div>
        <div className="card si-5e451b11">
          <div className="si-d8c79ed7">{t('cancellationDashboard.avgRefund')}</div>
          <div className="si-5c34ccdf">{formatCurrency(avgRefund)}</div>
        </div>
      </div>

      {/* Cancellation Breakdown Bar */}
      <div className="card si-af65fe13">
        <div className="card-header">
          <h2>📊 {t('cancellationDashboard.cancellationBreakdown')}</h2>
        </div>
        <div className="card-body">
          {totalCancellations > 0 ? (
            <>
              <div className="si-53a3ff01">
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
              <div className="si-33938b8e">
                <div className="si-c2db3694">
                  <div className="si-84086133" />
                  <span className="si-0a803082">{t('cancellationDashboard.doctor')} ({doctorCancellations})</span>
                </div>
                <div className="si-c2db3694">
                  <div className="si-d404ed51" />
                  <span className="si-0a803082">{t('cancellationDashboard.patient')} ({patientCancellations})</span>
                </div>
                <div className="si-c2db3694">
                  <div className="si-84e43ea0" />
                  <span className="si-0a803082">{t('cancellationDashboard.admin')} ({adminCancellations})</span>
                </div>
              </div>
            </>
          ) : (
            <div className="si-e64a3412">
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
          <div className="si-2a57fba0">
            {doctorPercent > 40 && (
              <div className="si-56fca271">
                🚨 <strong>{t('cancellationDashboard.highDoctorCancellationRate')} ({doctorPercent}%)</strong> - {t('cancellationDashboard.highDoctorCancellationAdvice')}
                <button className="btn btn-sm btn-outline si-7984dfbc" onClick={() => onNavigate('/admin/settings')}>
                  {t('cancellationDashboard.reviewPolicy')}
                </button>
              </div>
            )}
            {totalRefunded > 10000 && (
              <div className="si-88cee687">
                ⚠️ <strong>{t('cancellationDashboard.highRefundVolume')} ({formatCurrency(totalRefunded)})</strong> - {t('cancellationDashboard.highRefundAdvice')}
              </div>
            )}
            {totalCancellations === 0 && (
              <div className="si-a535e093">
                ✅ <strong>{t('cancellationDashboard.noCancellations')}</strong> - {t('cancellationDashboard.perfectCompletionRate')}
              </div>
            )}
            <div className="si-fbbff6c4">
              📋 <strong>{t('cancellationDashboard.managePolicies')}</strong> {' '}
              <button className="btn btn-sm btn-outline si-12f273ab" onClick={() => onNavigate('/admin/settings')}>
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
