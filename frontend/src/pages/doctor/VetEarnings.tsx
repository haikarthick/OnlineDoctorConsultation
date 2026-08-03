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
        <div className="si-576ad7ab">
          <div className="si-26bb084f">
            <div className="si-73701409">
              <div className="si-c3b93ebb">{t('earningsLedger.clearing')}</div>
              <div className="si-c9f6f584">{formatCurrency(ledger.clearing)}</div>
              <div className="si-a5de6cea">{t('earningsLedger.clearingHint', { days: ledger.clearanceDays })}</div>
            </div>
            <div className="si-73701409">
              <div className="si-c3b93ebb">{t('earningsLedger.available')}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: ledger.available < 0 ? '#dc2626' : '#15803d' }}>{formatCurrency(ledger.available)}</div>
              {ledger.available < 0 && (
                <div className="si-941af66a">{t('earningsLedger.negativeHint')}</div>
              )}
            </div>
            <div className="si-73701409">
              <div className="si-c3b93ebb">{t('earningsLedger.locked')}</div>
              <div className="si-e5d9bda7">{formatCurrency(ledger.locked)}</div>
            </div>
            <div className="si-73701409">
              <div className="si-c3b93ebb">{t('earningsLedger.withdrawn')}</div>
              <div className="si-364c1a5b">{formatCurrency(ledger.withdrawn)}</div>
            </div>
          </div>

          {/* Threshold progress toward minimum withdrawal (§6.1) */}
          <div className="si-f7a0b6a7">
            <div className="si-410451ff">
              <span className="si-23033f05">{t('earningsLedger.withdrawalThreshold')}</span>
              <span className="si-b2cfcbec">{formatCurrency(Math.max(ledger.available, 0))} / {formatCurrency(ledger.minWithdrawalAmount)}</span>
            </div>
            <div className="si-85b1fbd5">
              <div style={{ width: `${thresholdProgress}%`, background: thresholdProgress >= 100 ? '#15803d' : '#2563eb', height: '100%', borderRadius: 999, transition: 'width 0.4s' }} />
            </div>
            <div className="si-822af7c2">
              {thresholdProgress >= 100 ? t('earningsLedger.thresholdReached') : t('earningsLedger.thresholdHint')}
            </div>
          </div>

          {/* Withdrawal card (§6.3) */}
          <div className="si-f7a0b6a7">
            <div className="si-07f0b96d">
              <div>
                <div className="si-f3347717">{t('withdrawals.title')}</div>
                <div className="si-c3b93ebb">
                  {payoutSaved ? t('withdrawals.payoutOnFile') : t('withdrawals.payoutMissing')}
                </div>
              </div>
              <div className="si-d223efb3">
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
              <div className="si-6189703b">
                {actionMsg}
              </div>
            )}

            {showPayoutForm && (
              <div className="si-7586ce37">
                <input placeholder={t('withdrawals.accountName')} value={payout.accountName}
                  onChange={e => setPayout(p => ({ ...p, accountName: e.target.value }))}
                  className="si-9c357596" />
                <input placeholder={t('withdrawals.accountNumber')} value={payout.accountNumber}
                  onChange={e => setPayout(p => ({ ...p, accountNumber: e.target.value }))}
                  className="si-9c357596" />
                <input placeholder={t('withdrawals.ifsc')} value={payout.ifsc}
                  onChange={e => setPayout(p => ({ ...p, ifsc: e.target.value }))}
                  className="si-9c357596" />
                <input placeholder={t('withdrawals.upi')} value={payout.upi}
                  onChange={e => setPayout(p => ({ ...p, upi: e.target.value }))}
                  className="si-9c357596" />
                <button className="module-btn primary" disabled={actionBusy} onClick={savePayoutDetails}>
                  {actionBusy ? t('common.loading') : t('common.save')}
                </button>
              </div>
            )}

            {withdrawals.length > 0 && (
              <div className="si-e3041b91">
                {withdrawals.slice(0, 5).map(w => (
                  <div key={w.id} className="si-3f840b9b">
                    <span>
                      <strong>{formatCurrency(parseFloat(String(w.amount)))}</strong>
                      {parseFloat(String(w.tdsAmount || 0)) > 0 && (
                        <span className="si-23033f05"> · TDS {formatCurrency(parseFloat(String(w.tdsAmount)))} · {t('withdrawals.netPaid')} {formatCurrency(parseFloat(String(w.netPaidAmount || 0)))}</span>
                      )}
                      {w.utrReference && <span className="si-23033f05"> · {w.utrReference}</span>}
                    </span>
                    <span className="si-bab2d193">
                      <span className="si-b2cfcbec">{String(t(`withdrawals.statuses.${w.status}`, w.status))}</span>
                      {w.status === 'requested' && (
                        <button className="module-btn si-0bf6d12d" disabled={actionBusy} onClick={() => cancelWithdrawal(w.id)}>
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
            <div className="si-0b7c8512">
              <div className="si-761baba8">{t('earningsLedger.statementTitle')}</div>
              <div className="si-9aa6c55f">
                <table className="si-ec76dd85">
                  <thead>
                    <tr className="si-321a0f36">
                      <th className="si-6032b198">{t('earningsLedger.colDate')}</th>
                      <th className="si-6032b198">{t('earningsLedger.colType')}</th>
                      <th className="si-6032b198">{t('earningsLedger.colPatient')}</th>
                      <th className="si-2d673c2a">{t('earningsLedger.colGross')}</th>
                      <th className="si-2d673c2a">{t('earningsLedger.colCommission')}</th>
                      <th className="si-2d673c2a">{t('earningsLedger.colNet')}</th>
                      <th className="si-6032b198">{t('earningsLedger.colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.map((row) => (
                      <tr key={row.id} className="si-c20fa118">
                        <td className="si-85d1aad6">{row.createdAt ? formatDate(row.createdAt) : '-'}</td>
                        <td className="si-6032b198">{String(t(`earningsLedger.types.${row.type}`, row.type))}</td>
                        <td className="si-6032b198">{row.patientName || '-'}{row.animalName ? ` (${row.animalName})` : ''}</td>
                        <td className="si-2d673c2a">{formatCurrency(parseFloat(String(row.grossAmount || 0)))}</td>
                        <td className="si-2d673c2a">{formatCurrency(parseFloat(String(row.commissionAmount || 0)))}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: parseFloat(String(row.netAmount)) < 0 ? '#dc2626' : '#111827' }}>
                          {formatCurrency(parseFloat(String(row.netAmount || 0)))}
                        </td>
                        <td className="si-6032b198">{String(t(`earningsLedger.statuses.${row.status}`, row.status))}</td>
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
                          <td>{r.patientOwnerName || '-'}</td>
                          <td>{r.animalName || '-'}</td>
                          <td>{r.amount ? formatCurrency(r.amount) : '-'}</td>
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
