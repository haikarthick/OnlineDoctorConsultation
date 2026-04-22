import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import './VetEarnings.css'

interface EarningsSummary {
  totalConsultations: number
  totalEarned: number
  cancelledByMe: number
  missed: number
}

interface DailyEarning {
  date: string
  earned: number
  consultations: number
}

interface RecentConsultation {
  id: string
  date: string
  time: string
  patientOwnerName: string
  animalName: string
  amount: number
  paymentStatus: string
  bookingStatus: string
}

const VetEarnings: React.FC = () => {
  const { t } = useTranslation()
  const { formatCurrency, formatDate } = useSettings()
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<EarningsSummary>({ totalConsultations: 0, totalEarned: 0, cancelledByMe: 0, missed: 0 })
  const [daily, setDaily] = useState<DailyEarning[]>([])
  const [recent, setRecent] = useState<RecentConsultation[]>([])

  const loadEarnings = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await (apiService as any).get(`/vet/earnings?days=${days}`)
      const data = res.data?.data || res.data
      setSummary(data.summary || { totalConsultations: 0, totalEarned: 0, cancelledByMe: 0, missed: 0 })
      setDaily(data.daily || [])
      setRecent(data.recent || [])
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load earnings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadEarnings() }, [days])

  return (
    <div className="module-page vet-earnings-page">
      <div className="module-header">
        <div>
          <h1>{t('vetEarnings.title')}</h1>
        </div>
        <div className="earnings-period-selector">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              className={`module-btn${days === d ? ' primary' : ''}`}
              onClick={() => setDays(d)}
            >
              {d === 30 ? t('vetEarnings.last30Days') : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="module-alert error">{error}</div>}

      {loading ? (
        <div className="loading-state"><div className="loading-spinner" /></div>
      ) : (
        <>
          <div className="module-stats">
            <div className="stat-card">
              <div className="stat-icon">💰</div>
              <div className="stat-value">{formatCurrency(summary.totalEarned)}</div>
              <div className="stat-label">{t('vetEarnings.totalEarned')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🩺</div>
              <div className="stat-value">{summary.totalConsultations}</div>
              <div className="stat-label">{t('vetEarnings.totalConsultations')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">❌</div>
              <div className="stat-value">{summary.cancelledByMe}</div>
              <div className="stat-label">{t('vetEarnings.cancelledByMe')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">⚠️</div>
              <div className="stat-value">{summary.missed}</div>
              <div className="stat-label">{t('vetEarnings.missedAppointments')}</div>
            </div>
          </div>

          <div className="module-card">
            <div className="card-header">
              <h2>{t('vetEarnings.dailyEarnings')}</h2>
            </div>
            <div className="card-body">
              {daily.length === 0 ? (
                <p className="empty-text">{t('vetEarnings.noEarnings')}</p>
              ) : (
                <div className="data-table-container">
                  <table className="module-table">
                    <thead>
                      <tr>
                        <th>{t('common.date')}</th>
                        <th>{t('vetEarnings.totalConsultations')}</th>
                        <th>{t('vetEarnings.totalEarned')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {daily.map((d, i) => (
                        <tr key={i}>
                          <td>{formatDate(d.date)}</td>
                          <td>{d.consultations}</td>
                          <td>{formatCurrency(Number(d.earned))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="module-card">
            <div className="card-header">
              <h2>{t('vetEarnings.recentConsultations')}</h2>
            </div>
            <div className="card-body">
              {recent.length === 0 ? (
                <p className="empty-text">{t('vetEarnings.noEarnings')}</p>
              ) : (
                <div className="data-table-container">
                  <table className="module-table">
                    <thead>
                      <tr>
                        <th>{t('common.date')}</th>
                        <th>{t('common.patient')}</th>
                        <th>{t('common.animal')}</th>
                        <th>{t('vetEarnings.totalEarned')}</th>
                        <th>{t('common.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map(r => (
                        <tr key={r.id}>
                          <td>{formatDate(r.date)}</td>
                          <td>{r.patientOwnerName || '—'}</td>
                          <td>{r.animalName || '—'}</td>
                          <td>{r.amount ? formatCurrency(r.amount) : '—'}</td>
                          <td><span className={`badge badge-${r.bookingStatus}`}>{r.bookingStatus}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default VetEarnings
