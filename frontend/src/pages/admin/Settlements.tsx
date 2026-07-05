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
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#b91c1c', marginBottom: 6 }}>⚠️ {t('settlementsAdmin.negativeTitle')}</div>
          {negatives.map((n) => (
            <div key={n.doctorId} style={{ fontSize: 13, color: '#7f1d1d' }}>
              {n.doctorName} ({n.email}): <strong>{formatCurrency(parseFloat(String(n.available)))}</strong>
            </div>
          ))}
        </div>
      )}

      {message && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 14 }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['', 'requested', 'approved', 'settled', 'rejected'].map((s) => (
          <button key={s || 'all'} className={`module-btn${statusFilter === s ? ' primary' : ''}`} onClick={() => setStatusFilter(s)}>
            {s === '' ? t('settlementsAdmin.filterAll') : String(t(`withdrawals.statuses.${s}`, s))}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /><p>{t('common.loading')}</p></div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: '#6b7280' }}>{t('settlementsAdmin.empty')}</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map((w) => (
            <div key={w.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>
                    {w.doctorName}
                    {w.isDiscretionary && <span style={{ marginLeft: 8, fontSize: 11, background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 999 }}>{t('settlementsAdmin.discretionary')}</span>}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 13 }}>{w.doctorEmail}</div>
                  <div style={{ fontSize: 13, marginTop: 6 }}>
                    <strong>{formatCurrency(parseFloat(String(w.amount)))}</strong>
                    <span style={{ color: '#6b7280' }}> · TDS {formatCurrency(parseFloat(String(w.tdsAmount || 0)))} · {t('withdrawals.netPaid')} <strong>{formatCurrency(parseFloat(String(w.netPaidAmount || 0)))}</strong></span>
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>
                    {w.payoutUpi ? `UPI: ${w.payoutUpi}` : `${w.payoutAccountName || ''} · ${w.payoutAccountNumber || '—'} · ${w.payoutIfsc || ''}`}
                  </div>
                  {w.utrReference && <div style={{ color: '#6b7280', fontSize: 12 }}>UTR: {w.utrReference}</div>}
                  {w.rejectionReason && <div style={{ color: '#b91c1c', fontSize: 12 }}>{w.rejectionReason}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ background: statusColors[w.status]?.bg, color: statusColors[w.status]?.fg, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                    {String(t(`withdrawals.statuses.${w.status}`, w.status))}
                  </span>
                  {['requested', 'approved'].includes(w.status) && (
                    <div style={{ color: (w.ageDays || 0) > 5 ? '#b91c1c' : '#9ca3af', fontSize: 12, marginTop: 4 }}>
                      {t('settlementsAdmin.age', { days: w.ageDays || 0 })}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
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
                        <button className="module-btn" style={{ color: '#b91c1c' }} disabled={busyId === w.id}
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 12, maxWidth: 420, width: '100%', padding: 24 }}>
            <h3 style={{ marginBottom: 6 }}>{t('settlementsAdmin.settleTitle')}</h3>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 14 }}>{t('settlementsAdmin.settleHint')}</p>
            <input placeholder={t('settlementsAdmin.utrPlaceholder')} value={settleDialog.utr}
              onChange={(e) => setSettleDialog({ ...settleDialog, utr: e.target.value })}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }} />
            <input placeholder={t('settlementsAdmin.notePlaceholder')} value={settleDialog.note}
              onChange={(e) => setSettleDialog({ ...settleDialog, note: e.target.value })}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setSettleDialog(null)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={!settleDialog.utr.trim()}
                onClick={() => { const d = settleDialog; setSettleDialog(null); act(d.id, () => apiService.adminSettleWithdrawal(d.id, d.utr.trim(), d.note || undefined), t('settlementsAdmin.settled')) }}>
                {t('settlementsAdmin.settle')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject dialog */}
      {rejectDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 12, maxWidth: 420, width: '100%', padding: 24 }}>
            <h3 style={{ marginBottom: 10 }}>{t('settlementsAdmin.rejectTitle')}</h3>
            <textarea placeholder={t('settlementsAdmin.reasonPlaceholder')} value={rejectDialog.reason}
              onChange={(e) => setRejectDialog({ ...rejectDialog, reason: e.target.value })}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', minHeight: 80, marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setRejectDialog(null)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={!rejectDialog.reason.trim()}
                onClick={() => { const d = rejectDialog; setRejectDialog(null); act(d.id, () => apiService.adminRejectWithdrawal(d.id, d.reason.trim()), t('settlementsAdmin.rejected')) }}>
                {t('settlementsAdmin.reject')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discretionary payout dialog (opened from negative/none — via button below) */}
      <div style={{ marginTop: 20 }}>
        <button className="module-btn" onClick={() => setDiscDialog({ doctorId: '', doctorName: '', utr: '', note: '' })}>
          ⚡ {t('settlementsAdmin.discretionaryButton')}
        </button>
      </div>
      {discDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 12, maxWidth: 460, width: '100%', padding: 24 }}>
            <h3 style={{ marginBottom: 6 }}>{t('settlementsAdmin.discretionaryTitle')}</h3>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 14 }}>{t('settlementsAdmin.discretionaryHint')}</p>
            <input placeholder={t('settlementsAdmin.doctorIdPlaceholder')} value={discDialog.doctorId}
              onChange={(e) => setDiscDialog({ ...discDialog, doctorId: e.target.value })}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }} />
            <input placeholder={t('settlementsAdmin.utrPlaceholder')} value={discDialog.utr}
              onChange={(e) => setDiscDialog({ ...discDialog, utr: e.target.value })}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }} />
            <textarea placeholder={t('settlementsAdmin.discretionaryNotePlaceholder')} value={discDialog.note}
              onChange={(e) => setDiscDialog({ ...discDialog, note: e.target.value })}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', minHeight: 70, marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setDiscDialog(null)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={!discDialog.doctorId.trim() || !discDialog.utr.trim() || !discDialog.note.trim()}
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
