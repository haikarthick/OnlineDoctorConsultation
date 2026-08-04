import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import '../../styles/modules.css'

interface SettlementsProps {
  onNavigate?: (path: string) => void
}

/**
 * Admin → Payments & Finance → Settlements (plan §6.3, §10 item 6).
 * Withdrawal queue with aging, approve/reject/settle (UTR), discretionary
 * payout, and negative-balance doctor flags.
 */
const Settlements: React.FC<SettlementsProps> = () => {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const [statusFilter, setStatusFilter] = useState('')
  const [rows, setRows] = useState<any[]>([])
  const [negatives, setNegatives] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [settleDialog, setSettleDialog] = useState<{ id: string; utr: string; note: string } | null>(null)
  const [rejectDialog, setRejectDialog] = useState<{ id: string; reason: string } | null>(null)
  const [discDialog, setDiscDialog] = useState<{ doctorId: string; doctorName: string; utr: string; note: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [wResp, nResp] = await Promise.all([
        apiService.adminListWithdrawals(statusFilter || undefined),
        apiService.adminNegativeBalances(),
      ])
      setRows(Array.isArray(wResp?.data) ? wResp.data : [])
      setNegatives(Array.isArray(nResp?.data) ? nResp.data : [])
    } catch { setRows([]) } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const act = useCallback(async (id: string, fn: () => Promise<any>, successMsg: string) => {
    try {
      setBusyId(id)
      setMessage('')
      await fn()
      setMessage(successMsg)
      await load()
    } catch (err: any) {
      setMessage(err.response?.data?.error?.message || err.response?.data?.error || t('settlementsAdmin.actionFailed'))
    } finally { setBusyId(null) }
  }, [load, t])

  const statusColors: Record<string, { bg: string; fg: string }> = {
    requested: { bg: '#fef3c7', fg: '#b45309' },
    approved: { bg: '#dbeafe', fg: '#1d4ed8' },
    settled: { bg: '#dcfce7', fg: '#15803d' },
    rejected: { bg: '#fee2e2', fg: '#b91c1c' },
    cancelled: { bg: '#f3f4f6', fg: '#6b7280' },
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>{t('settlementsAdmin.title')}</h1>
          <p className="page-subtitle">{t('settlementsAdmin.subtitle')}</p>
        </div>
      </div>

      {negatives.length > 0 && (
        <div className="si-0d00f402">
          <div className="si-918cd316">⚠️ {t('settlementsAdmin.negativeTitle')}</div>
          {negatives.map((n) => (
            <div key={n.doctorId} className="si-25c28890">
              {n.doctorName} ({n.email}): <strong>{formatCurrency(parseFloat(String(n.available)))}</strong>
            </div>
          ))}
        </div>
      )}

      {message && (
        <div className="si-900a41f7">
          {message}
        </div>
      )}

      <div className="si-6398a4b6">
        {['', 'requested', 'approved', 'settled', 'rejected'].map((s) => (
          <button key={s || 'all'} className={`module-btn${statusFilter === s ? ' primary' : ''}`} onClick={() => setStatusFilter(s)}>
            {s === '' ? t('settlementsAdmin.filterAll') : String(t(`withdrawals.statuses.${s}`, s))}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /><p>{t('common.loading')}</p></div>
      ) : rows.length === 0 ? (
        <div className="si-8fce2994">{t('settlementsAdmin.empty')}</div>
      ) : (
        <div className="si-2a57fba0">
          {rows.map((w) => (
            <div key={w.id} className="si-2e21f3c6">
              <div className="si-544649a4">
                <div className="si-8b796880">
                  <div className="si-f3347717">
                    {w.doctorName}
                    {w.isDiscretionary && <span className="si-d8d1564e">{t('settlementsAdmin.discretionary')}</span>}
                  </div>
                  <div className="si-c3b93ebb">{w.doctorEmail}</div>
                  <div className="si-12c11b14">
                    <strong>{formatCurrency(parseFloat(String(w.amount)))}</strong>
                    <span className="si-23033f05"> · TDS {formatCurrency(parseFloat(String(w.tdsAmount || 0)))} · {t('withdrawals.netPaid')} <strong>{formatCurrency(parseFloat(String(w.netPaidAmount || 0)))}</strong></span>
                  </div>
                  <div className="si-322b324f">
                    {w.payoutUpi ? `UPI: ${w.payoutUpi}` : `${w.payoutAccountName || ''} · ${w.payoutAccountNumber || '-'} · ${w.payoutIfsc || ''}`}
                  </div>
                  {w.utrReference && <div className="si-48a0b045">UTR: {w.utrReference}</div>}
                  {w.rejectionReason && <div className="si-f900fd0c">{w.rejectionReason}</div>}
                </div>
                <div className="si-f4e64596">
                  <span style={{ background: statusColors[w.status]?.bg, color: statusColors[w.status]?.fg, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                    {String(t(`withdrawals.statuses.${w.status}`, w.status))}
                  </span>
                  {['requested', 'approved'].includes(w.status) && (
                    <div style={{ color: (w.ageDays || 0) > 5 ? '#b91c1c' : '#9ca3af', fontSize: 12, marginTop: 4 }}>
                      {t('settlementsAdmin.age', { days: w.ageDays || 0 })}
                    </div>
                  )}
                  <div className="si-a5676f76">
                    {w.status === 'requested' && (
                      <button className="module-btn" disabled={busyId === w.id}
                        onClick={() => act(w.id, () => apiService.adminApproveWithdrawal(w.id), t('settlementsAdmin.approved'))}>
                        {t('settlementsAdmin.approve')}
                      </button>
                    )}
                    {['requested', 'approved'].includes(w.status) && (
                      <>
                        <button className="module-btn primary" disabled={busyId === w.id}
                          onClick={() => setSettleDialog({ id: w.id, utr: '', note: '' })}>
                          {t('settlementsAdmin.settle')}
                        </button>
                        <button className="module-btn si-650f6574" disabled={busyId === w.id}
                          onClick={() => setRejectDialog({ id: w.id, reason: '' })}>
                          {t('settlementsAdmin.reject')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Settle dialog */}
      {settleDialog && (
        <div className="si-9f028f26">
          <div className="si-da07280d">
            <h3 className="si-3c64c436">{t('settlementsAdmin.settleTitle')}</h3>
            <p className="si-ea95bef1">{t('settlementsAdmin.settleHint')}</p>
            <input placeholder={t('settlementsAdmin.utrPlaceholder')} value={settleDialog.utr}
              onChange={(e) => setSettleDialog({ ...settleDialog, utr: e.target.value })}
              className="si-a01c8879" />
            <input placeholder={t('settlementsAdmin.notePlaceholder')} value={settleDialog.note}
              onChange={(e) => setSettleDialog({ ...settleDialog, note: e.target.value })}
              className="si-8c205b41" />
            <div className="si-ad918842">
              <button className="btn btn-outline si-6acd75e8" onClick={() => setSettleDialog(null)}>{t('common.cancel')}</button>
              <button className="btn btn-primary si-6acd75e8" disabled={!settleDialog.utr.trim()}
                onClick={() => { const d = settleDialog; setSettleDialog(null); act(d.id, () => apiService.adminSettleWithdrawal(d.id, d.utr.trim(), d.note || undefined), t('settlementsAdmin.settled')) }}>
                {t('settlementsAdmin.settle')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject dialog */}
      {rejectDialog && (
        <div className="si-9f028f26">
          <div className="si-da07280d">
            <h3 className="si-170de209">{t('settlementsAdmin.rejectTitle')}</h3>
            <textarea placeholder={t('settlementsAdmin.reasonPlaceholder')} value={rejectDialog.reason}
              onChange={(e) => setRejectDialog({ ...rejectDialog, reason: e.target.value })}
              className="si-9e7a62e0" />
            <div className="si-ad918842">
              <button className="btn btn-outline si-6acd75e8" onClick={() => setRejectDialog(null)}>{t('common.cancel')}</button>
              <button className="btn btn-primary si-6acd75e8" disabled={!rejectDialog.reason.trim()}
                onClick={() => { const d = rejectDialog; setRejectDialog(null); act(d.id, () => apiService.adminRejectWithdrawal(d.id, d.reason.trim()), t('settlementsAdmin.rejected')) }}>
                {t('settlementsAdmin.reject')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discretionary payout dialog (opened from negative/none - via button below) */}
      <div className="si-138c678b">
        <button className="module-btn" onClick={() => setDiscDialog({ doctorId: '', doctorName: '', utr: '', note: '' })}>
          ⚡ {t('settlementsAdmin.discretionaryButton')}
        </button>
      </div>
      {discDialog && (
        <div className="si-9f028f26">
          <div className="si-bcb8ed7e">
            <h3 className="si-3c64c436">{t('settlementsAdmin.discretionaryTitle')}</h3>
            <p className="si-ea95bef1">{t('settlementsAdmin.discretionaryHint')}</p>
            <input placeholder={t('settlementsAdmin.doctorIdPlaceholder')} value={discDialog.doctorId}
              onChange={(e) => setDiscDialog({ ...discDialog, doctorId: e.target.value })}
              className="si-a01c8879" />
            <input placeholder={t('settlementsAdmin.utrPlaceholder')} value={discDialog.utr}
              onChange={(e) => setDiscDialog({ ...discDialog, utr: e.target.value })}
              className="si-a01c8879" />
            <textarea placeholder={t('settlementsAdmin.discretionaryNotePlaceholder')} value={discDialog.note}
              onChange={(e) => setDiscDialog({ ...discDialog, note: e.target.value })}
              className="si-ce30fe82" />
            <div className="si-ad918842">
              <button className="btn btn-outline si-6acd75e8" onClick={() => setDiscDialog(null)}>{t('common.cancel')}</button>
              <button className="btn btn-primary si-6acd75e8" disabled={!discDialog.doctorId.trim() || !discDialog.utr.trim() || !discDialog.note.trim()}
                onClick={() => { const d = discDialog; setDiscDialog(null); act('disc', () => apiService.adminDiscretionaryPayout(d.doctorId.trim(), d.utr.trim(), d.note.trim()), t('settlementsAdmin.settled')) }}>
                {t('settlementsAdmin.payNow')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settlements
