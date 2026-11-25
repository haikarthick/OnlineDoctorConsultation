import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import { userMessage } from '../../utils/userMessage'
import { appLocale } from '../../utils/appLocale'
import { BottomSheet } from '../mobile/BottomSheet'
import './WalletWithdrawalsQueue.css'

interface WalletWithdrawal {
  id: string
  amount: number | string
  status: 'requested' | 'approved' | 'settled' | 'rejected' | 'cancelled'
  method: string
  accountName?: string | null
  accountNumber?: string | null
  ifsc?: string | null
  upiId?: string | null
  utrReference?: string | null
  rejectionReason?: string | null
  customerName: string
  customerEmail: string
  createdAt: string
  ageDays?: number
}

type Step = { kind: 'settle' | 'reject'; row: WalletWithdrawal; text: string; note: string } | null

const FILTERS = ['', 'requested', 'approved', 'settled', 'rejected', 'cancelled'] as const

/**
 * Admin queue for CUSTOMER wallet withdrawals (pet owners, farmers). Same layout and statuses as the doctor queue above it.
 * The amount left the customer's wallet when they asked; a rejection puts it back (the server does that, and says so to the customer).
 */
export function WalletWithdrawalsQueue() {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<WalletWithdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [step, setStep] = useState<Step>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiService.adminListWalletWithdrawals(status || undefined)
      setRows(Array.isArray(res?.data) ? res.data : [])
    } catch (e) {
      setRows([])
      setMessage({ text: userMessage(e, 'walletWithdrawalsAdmin.loadFailed'), ok: false })
    } finally { setLoading(false) }
  }, [status])

  useEffect(() => { void load() }, [load])

  const run = async (fn: () => Promise<unknown>, okText: string) => {
    if (busy) return // a second tap while the first is still running must never pay twice
    setBusy(true)
    setMessage(null)
    try {
      await fn()
      setMessage({ text: okText, ok: true })
      setStep(null)
      await load()
    } catch (e) {
      setMessage({ text: userMessage(e, 'walletWithdrawalsAdmin.actionFailed'), ok: false })
    } finally { setBusy(false) }
  }

  const payTo = (w: WalletWithdrawal) => (w.method === 'upi'
    ? t('walletWithdrawalsAdmin.payUpi', { upi: w.upiId || '-' })
    : t('walletWithdrawalsAdmin.payBank', { name: w.accountName || '-', number: w.accountNumber || '-', ifsc: w.ifsc || '-' }))

  return (
    <section className="wwq" aria-labelledby="wwq-title">
      <h2 id="wwq-title">{t('walletWithdrawalsAdmin.title')}</h2>
      <p className="wwq-hint">{t('walletWithdrawalsAdmin.subtitle')}</p>

      <div className="wwq-filters" role="group" aria-label={t('walletWithdrawalsAdmin.filterLabel')}>
        {FILTERS.map(s => (
          <button key={s || 'all'} type="button" className={`module-btn${status === s ? ' primary' : ''}`} aria-pressed={status === s} onClick={() => setStatus(s)}>
            {s === '' ? t('settlementsAdmin.filterAll') : t(`walletWithdrawalsAdmin.statuses.${s}`)}
          </button>
        ))}
      </div>

      {message && <div className={message.ok ? 'wwq-ok' : 'wwq-error'} role={message.ok ? 'status' : 'alert'}>{message.text}</div>}
      {loading && <p role="status">{t('common.loading')}</p>}
      {!loading && rows.length === 0 && <p className="wwq-empty">{t('walletWithdrawalsAdmin.empty')}</p>}

      <ul className="wwq-list">
        {rows.map(w => {
          const open = w.status === 'requested' || w.status === 'approved'
          return (
            <li key={w.id} className="wwq-card">
              <div className="wwq-main">
                <strong>{w.customerName}</strong>
                <span className="wwq-muted">{w.customerEmail}</span>
                <span className="wwq-amount">{formatCurrency(parseFloat(String(w.amount)))}</span>
                <span className="wwq-muted">{payTo(w)}</span>
                <span className="wwq-muted">{new Date(w.createdAt).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                {w.utrReference && <span className="wwq-muted">{t('walletWithdrawalsAdmin.reference', { ref: w.utrReference })}</span>}
                {w.rejectionReason && <span className="wwq-muted">{t('walletWithdrawalsAdmin.reason', { reason: w.rejectionReason })}</span>}
              </div>
              <div className="wwq-side">
                <span className={`wwq-status wwq-status-${w.status}`}>{t(`walletWithdrawalsAdmin.statuses.${w.status}`)}</span>
                {open && <span className={`wwq-age${(w.ageDays || 0) > 5 ? ' wwq-age-late' : ''}`}>{t('settlementsAdmin.age', { days: w.ageDays || 0 })}</span>}
                {open && (
                  <div className="wwq-actions">
                    {w.status === 'requested' && (
                      <button type="button" className="module-btn" disabled={busy} onClick={() => run(() => apiService.adminApproveWalletWithdrawal(w.id), t('walletWithdrawalsAdmin.approvedDone'))}>{t('settlementsAdmin.approve')}</button>
                    )}
                    <button type="button" className="module-btn primary" disabled={busy} onClick={() => setStep({ kind: 'settle', row: w, text: '', note: '' })}>{t('settlementsAdmin.settle')}</button>
                    <button type="button" className="module-btn" disabled={busy} onClick={() => setStep({ kind: 'reject', row: w, text: '', note: '' })}>{t('settlementsAdmin.reject')}</button>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <BottomSheet open={!!step} title={step?.kind === 'settle' ? t('settlementsAdmin.settleTitle') : t('walletWithdrawalsAdmin.rejectTitle')} onClose={() => setStep(null)}>
        {step && (
          <div className="wwq-sheet">
            <p>{step.row.customerName} · <strong>{formatCurrency(parseFloat(String(step.row.amount)))}</strong></p>
            {step.kind === 'settle' ? (
              <>
                <p className="wwq-muted">{t('settlementsAdmin.settleHint')}</p>
                <label>{t('settlementsAdmin.utrPlaceholder')}
                  <input value={step.text} onChange={e => setStep({ ...step, text: e.target.value })} autoComplete="off" />
                </label>
                <label>{t('settlementsAdmin.notePlaceholder')}
                  <input value={step.note} onChange={e => setStep({ ...step, note: e.target.value })} autoComplete="off" />
                </label>
              </>
            ) : (
              <>
                <p className="wwq-muted">{t('walletWithdrawalsAdmin.rejectHint')}</p>
                <label>{t('walletWithdrawalsAdmin.reasonLabel')}
                  <textarea value={step.text} onChange={e => setStep({ ...step, text: e.target.value })} rows={3} />
                </label>
              </>
            )}
            <div className="record-sheet-actions">
              <button type="button" className="module-btn" onClick={() => setStep(null)}>{t('common.cancel')}</button>
              <button type="button" className="module-btn primary" disabled={busy || !step.text.trim()}
                onClick={() => run(
                  step.kind === 'settle'
                    ? () => apiService.adminSettleWalletWithdrawal(step.row.id, step.text.trim(), step.note.trim() || undefined)
                    : () => apiService.adminRejectWalletWithdrawal(step.row.id, step.text.trim()),
                  step.kind === 'settle' ? t('walletWithdrawalsAdmin.settledDone') : t('walletWithdrawalsAdmin.rejectedDone'))}>
                {step.kind === 'settle' ? t('settlementsAdmin.settle') : t('settlementsAdmin.reject')}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </section>
  )
}
