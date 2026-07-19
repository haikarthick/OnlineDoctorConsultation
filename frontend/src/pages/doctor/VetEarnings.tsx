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

interface LedgerSummary {
  clearing: number
  available: number
  locked: number
  withdrawn: number
  lifetime: number
  minWithdrawalAmount: number
  clearanceDays: number
  paymentsEnabled: boolean
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
  const [ledger, setLedger] = useState<LedgerSummary | null>(null)
  const [statement, setStatement] = useState<any[]>([])
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [payout, setPayout] = useState({ accountName: '', accountNumber: '', ifsc: '', upi: '' })
  const [payoutSaved, setPayoutSaved] = useState(false)
  const [showPayoutForm, setShowPayoutForm] = useState(false)
  const [actionMsg, setActionMsg] = useState('')
  const [actionBusy, setActionBusy] = useState(false)

  const loadWithdrawals = async () => {
    try {
      const resp: any = await apiService.listMyWithdrawals()
      setWithdrawals(Array.isArray(resp?.data) ? resp.data : [])
    } catch { setWithdrawals([]) }
  }

  const loadPayoutDetails = async () => {
    try {
      const resp: any = await apiService.getMyVetProfile()
      const p = resp?.data || resp
      setPayout({
        accountName: p?.payoutAccountName || '',
        accountNumber: p?.payoutAccountNumber || '',
        ifsc: p?.payoutIfsc || '',
        upi: p?.payoutUpi || '',
      })
      setPayoutSaved(!!((p?.payoutAccountNumber && p?.payoutIfsc) || p?.payoutUpi))
    } catch { /* form stays blank */ }
  }

  const savePayoutDetails = async () => {
    try {
      setActionBusy(true)
      setActionMsg('')
      await apiService.updateVetProfile({
        payoutAccountName: payout.accountName || null,
        payoutAccountNumber: payout.accountNumber || null,
        payoutIfsc: payout.ifsc || null,
        payoutUpi: payout.upi || null,
      })
      setPayoutSaved(!!((payout.accountNumber && payout.ifsc) || payout.upi))
      setShowPayoutForm(false)
      setActionMsg(t('withdrawals.payoutSaved'))
    } catch (err: any) {
      setActionMsg(err?.response?.data?.error?.message || err?.response?.data?.error || t('withdrawals.payoutSaveFailed'))
    } finally { setActionBusy(false) }
  }

  const requestWithdrawal = async () => {
    try {
      setActionBusy(true)
      setActionMsg('')
      await apiService.requestWithdrawal()
      setActionMsg(t('withdrawals.requested'))
      await Promise.all([loadWithdrawals(), loadLedger()])
    } catch (err: any) {
      setActionMsg(err?.response?.data?.error?.message || err?.response?.data?.error || t('withdrawals.requestFailed'))
    } finally { setActionBusy(false) }
  }

  const cancelWithdrawal = async (id: string) => {
    try {
      setActionBusy(true)
      await apiService.cancelWithdrawal(id)
      await Promise.all([loadWithdrawals(), loadLedger()])
    } catch { /* stays */ } finally { setActionBusy(false) }
  }

  const loadLedger = async () => {
    try {
      const [sumResp, stmtResp] = await Promise.all([
        apiService.getEarningsSummary(),
        apiService.getEarningsStatement({ limit: 30 }),
      ])
      const s = sumResp?.data || sumResp
      if (s?.paymentsEnabled) {
        setLedger(s)
        const st = stmtResp?.data || stmtResp
        setStatement(Array.isArray(st?.items) ? st.items : [])
      } else {
        setLedger(null)
      }
    } catch { setLedger(null) }
  }

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
  useEffect(() => { loadLedger(); loadWithdrawals(); loadPayoutDetails() }, [])

  const thresholdProgress = ledger && ledger.minWithdrawalAmount > 0
    ? Math.max(0, Math.min(100, (ledger.available / ledger.minWithdrawalAmount) * 100))
    : 0

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

      {/* ── Earnings ledger (payment module §6) ── */}
      {ledger && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ color: '#6b7280', fontSize: 13 }}>{t('earningsLedger.clearing')}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#b45309' }}>{formatCurrency(ledger.clearing)}</div>
              <div style={{ color: '#9ca3af', fontSize: 11 }}>{t('earningsLedger.clearingHint', { days: ledger.clearanceDays })}</div>
            </div>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ color: '#6b7280', fontSize: 13 }}>{t('earningsLedger.available')}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: ledger.available < 0 ? '#dc2626' : '#15803d' }}>{formatCurrency(ledger.available)}</div>
              {ledger.available < 0 && (
                <div style={{ color: '#dc2626', fontSize: 11 }}>{t('earningsLedger.negativeHint')}</div>
              )}
            </div>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ color: '#6b7280', fontSize: 13 }}>{t('earningsLedger.locked')}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#6d28d9' }}>{formatCurrency(ledger.locked)}</div>
            </div>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ color: '#6b7280', fontSize: 13 }}>{t('earningsLedger.withdrawn')}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1d4ed8' }}>{formatCurrency(ledger.withdrawn)}</div>
            </div>
          </div>

          {/* Threshold progress toward minimum withdrawal (§6.1) */}
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: '#6b7280' }}>{t('earningsLedger.withdrawalThreshold')}</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(Math.max(ledger.available, 0))} / {formatCurrency(ledger.minWithdrawalAmount)}</span>
            </div>
            <div style={{ background: '#f3f4f6', borderRadius: 999, height: 10, overflow: 'hidden' }}>
              <div style={{ width: `${thresholdProgress}%`, background: thresholdProgress >= 100 ? '#15803d' : '#2563eb', height: '100%', borderRadius: 999, transition: 'width 0.4s' }} />
            </div>
            <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 6 }}>
              {thresholdProgress >= 100 ? t('earningsLedger.thresholdReached') : t('earningsLedger.thresholdHint')}
            </div>
          </div>

          {/* Withdrawal card (§6.3) */}
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{t('withdrawals.title')}</div>
                <div style={{ color: '#6b7280', fontSize: 13 }}>
                  {payoutSaved ? t('withdrawals.payoutOnFile') : t('withdrawals.payoutMissing')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="module-btn" onClick={() => setShowPayoutForm(v => !v)}>
                  {t('withdrawals.payoutDetails')}
                </button>
                <button
                  className="module-btn primary"
                  disabled={actionBusy || !payoutSaved || ledger.available <= 0 || ledger.available < ledger.minWithdrawalAmount || withdrawals.some(w => ['requested', 'approved'].includes(w.status))}
                  onClick={requestWithdrawal}
                >
                  {t('withdrawals.requestButton')}
                </button>
              </div>
            </div>

            {actionMsg && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 8, padding: '8px 12px', marginTop: 10, fontSize: 13 }}>
                {actionMsg}
              </div>
            )}

            {showPayoutForm && (
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                <input placeholder={t('withdrawals.accountName')} value={payout.accountName}
                  onChange={e => setPayout(p => ({ ...p, accountName: e.target.value }))}
                  style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px' }} />
                <input placeholder={t('withdrawals.accountNumber')} value={payout.accountNumber}
                  onChange={e => setPayout(p => ({ ...p, accountNumber: e.target.value }))}
                  style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px' }} />
                <input placeholder={t('withdrawals.ifsc')} value={payout.ifsc}
                  onChange={e => setPayout(p => ({ ...p, ifsc: e.target.value }))}
                  style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px' }} />
                <input placeholder={t('withdrawals.upi')} value={payout.upi}
                  onChange={e => setPayout(p => ({ ...p, upi: e.target.value }))}
                  style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px' }} />
                <button className="module-btn primary" disabled={actionBusy} onClick={savePayoutDetails}>
                  {actionBusy ? t('common.loading') : t('common.save')}
                </button>
              </div>
            )}

            {withdrawals.length > 0 && (
              <div style={{ marginTop: 12, borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                {withdrawals.slice(0, 5).map(w => (
                  <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', gap: 8, flexWrap: 'wrap' }}>
                    <span>
                      <strong>{formatCurrency(parseFloat(String(w.amount)))}</strong>
                      {parseFloat(String(w.tdsAmount || 0)) > 0 && (
                        <span style={{ color: '#6b7280' }}> · TDS {formatCurrency(parseFloat(String(w.tdsAmount)))} · {t('withdrawals.netPaid')} {formatCurrency(parseFloat(String(w.netPaidAmount || 0)))}</span>
                      )}
                      {w.utrReference && <span style={{ color: '#6b7280' }}> · {w.utrReference}</span>}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{String(t(`withdrawals.statuses.${w.status}`, w.status))}</span>
                      {w.status === 'requested' && (
                        <button className="module-btn" style={{ padding: '3px 10px', fontSize: 12 }} disabled={actionBusy} onClick={() => cancelWithdrawal(w.id)}>
                          {t('common.cancel')}
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Statement */}
          {statement.length > 0 && (
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>{t('earningsLedger.statementTitle')}</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>{t('earningsLedger.colDate')}</th>
                      <th style={{ padding: '8px 12px' }}>{t('earningsLedger.colType')}</th>
                      <th style={{ padding: '8px 12px' }}>{t('earningsLedger.colPatient')}</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>{t('earningsLedger.colGross')}</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>{t('earningsLedger.colCommission')}</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>{t('earningsLedger.colNet')}</th>
                      <th style={{ padding: '8px 12px' }}>{t('earningsLedger.colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.map((row) => (
                      <tr key={row.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{row.createdAt ? formatDate(row.createdAt) : '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{String(t(`earningsLedger.types.${row.type}`, row.type))}</td>
                        <td style={{ padding: '8px 12px' }}>{row.patientName || '—'}{row.animalName ? ` (${row.animalName})` : ''}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatCurrency(parseFloat(String(row.grossAmount || 0)))}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatCurrency(parseFloat(String(row.commissionAmount || 0)))}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: parseFloat(String(row.netAmount)) < 0 ? '#dc2626' : '#111827' }}>
                          {formatCurrency(parseFloat(String(row.netAmount || 0)))}
                        </td>
                        <td style={{ padding: '8px 12px' }}>{String(t(`earningsLedger.statuses.${row.status}`, row.status))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

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
