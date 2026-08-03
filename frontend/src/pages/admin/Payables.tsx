import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import '../../styles/modules.css'

interface Props { onNavigate?: (path: string) => void }

/**
 * Admin → Payables: "who do I owe, and how much, right now".
 *
 * Settlement is manual, so this is the screen that makes it operable. Before it existed the
 * admin could only look up one vendor at a time by an id they had to already know, which meant
 * a provider could sit unpaid indefinitely simply by never being checked.
 *
 * Covers both vendor types because they have the same operational question and two different
 * mechanisms: grooming providers are paid by admin push, doctors by their own withdrawal
 * request - so a doctor with a balance and no request is a payable nobody is tracking.
 */
const Payables: React.FC<Props> = () => {
  const { t } = useTranslation()
  const { formatCurrency, formatDateTime } = useSettings()
  const [tab, setTab] = useState<'grooming' | 'doctors'>('grooming')
  const [grooming, setGrooming] = useState<any>(null)
  const [doctors, setDoctors] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [payDialog, setPayDialog] = useState<any | null>(null)
  const [payForm, setPayForm] = useState({ method: 'bank_transfer', reference: '', tdsAmount: '', notes: '' })

  const load = useCallback(async () => {
    try {
      setLoading(true); setErr('')
      // Settled independently: the grooming module can be dark-launched off, and that must not
      // blank the doctor payables the admin still needs.
      const [g, d] = await Promise.allSettled([
        apiService.getGroomingPayables(),
        apiService.getDoctorPayables(),
      ])
      setGrooming(g.status === 'fulfilled' ? g.value?.data : null)
      setDoctors(d.status === 'fulfilled' ? d.value?.data : null)
    } catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const openPay = (row: any) => {
    setPayForm({ method: 'bank_transfer', reference: '', tdsAmount: '', notes: '' })
    setPayDialog(row)
  }

  const confirmPay = async () => {
    if (!payDialog || !payForm.reference.trim()) return
    try {
      setBusy(payDialog.providerId); setErr(''); setMsg('')
      await apiService.adminSettleGrooming(payDialog.providerId, {
        method: payForm.method,
        reference: payForm.reference.trim(),
        ...(payForm.tdsAmount !== '' ? { tdsAmount: Number(payForm.tdsAmount) } : {}),
        notes: payForm.notes || undefined,
      })
      setMsg(t('payables.paidAndNotified', { name: payDialog.businessName }))
      setPayDialog(null)
      await load()
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message || e?.response?.data?.message || e.message)
    } finally { setBusy(null) }
  }

  if (loading) return <div className="module-page"><div className="loading-container"><div className="loading-spinner" /></div></div>

  const gRows = grooming?.providers || []
  const dRows = doctors?.doctors || []

  return (
    <div className="module-page">
      <div className="module-header"><h1>💸 {t('payables.title')}</h1></div>
      <p className="slot-hint">{t('payables.subtitle')}</p>

      {err && <div className="module-alert error">{err}</div>}
      {msg && <div className="module-alert success">{msg}</div>}

      <div className="module-stats">
        <div className="stat-card">
          <div className="stat-content">
            <div className="field-caption">{t('payables.groomingPayable')}</div>
            <div className="stat-value">{formatCurrency(Number(grooming?.totalPayableNow || 0))}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <div className="field-caption">{t('payables.groomingClearing')}</div>
            <div className="stat-value">{formatCurrency(Number(grooming?.totalClearing || 0))}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <div className="field-caption">{t('payables.doctorPayable')}</div>
            <div className="stat-value">{formatCurrency(Number(doctors?.totalPayableNow || 0))}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <div className="field-caption">{t('payables.blocked')}</div>
            <div className="stat-value">{Number(grooming?.blockedCount || 0)}</div>
            <div className="slot-hint">{t('payables.blockedHint')}</div>
          </div>
        </div>
      </div>

      <div className="module-tabs">
        <button className={`module-tab${tab === 'grooming' ? ' active' : ''}`} onClick={() => setTab('grooming')}>
          {t('payables.groomingTab')} ({gRows.length})
        </button>
        <button className={`module-tab${tab === 'doctors' ? ' active' : ''}`} onClick={() => setTab('doctors')}>
          {t('payables.doctorsTab')} ({dRows.length})
        </button>
      </div>

      {tab === 'grooming' ? (
        gRows.length === 0 ? <div className="empty-state"><p>{t('payables.noneGrooming')}</p></div> : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('payables.vendor')}</th>
                  <th>{t('payables.payableNow')}</th>
                  <th>{t('payables.clearing')}</th>
                  <th>{t('payables.waiting')}</th>
                  <th>{t('payables.lastPaid')}</th>
                  <th>{t('payables.payoutTo')}</th>
                  <th>{t('payables.action')}</th>
                </tr>
              </thead>
              <tbody>
                {gRows.map((r: any) => (
                  <tr key={r.providerId}>
                    <td>
                      <strong>{r.businessName}</strong>
                      <div className="slot-hint">{r.ownerEmail}</div>
                    </td>
                    <td><strong>{formatCurrency(r.payableNow)}</strong></td>
                    <td>{formatCurrency(r.clearing)}</td>
                    <td>{r.ageDays == null ? '-' : t('payables.days', { count: r.ageDays })}</td>
                    <td>{r.lastSettledAt ? formatDateTime(r.lastSettledAt) : t('payables.never')}</td>
                    <td>
                      {r.missingPayoutDetails
                        ? <span className="badge badge-error">{t('payables.noPayoutDetails')}</span>
                        : (r.payoutUpi || `${r.payoutAccountNumber || ''} / ${r.payoutIfsc || ''}`)}
                    </td>
                    <td>
                      <button className="btn btn-sm btn-primary" disabled={!r.canPay || busy === r.providerId}
                        title={r.missingPayoutDetails ? t('payables.noPayoutDetailsHint') : ''}
                        onClick={() => openPay(r)}>
                        {t('payables.recordPayout')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        dRows.length === 0 ? <div className="empty-state"><p>{t('payables.noneDoctors')}</p></div> : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('payables.vendor')}</th>
                  <th>{t('payables.payableNow')}</th>
                  <th>{t('payables.clearing')}</th>
                  <th>{t('payables.waiting')}</th>
                  <th>{t('payables.lastPaid')}</th>
                  <th>{t('payables.status')}</th>
                </tr>
              </thead>
              <tbody>
                {dRows.map((r: any) => (
                  <tr key={r.doctorId}>
                    <td>
                      <strong>{r.doctorName}</strong>
                      <div className="slot-hint">{r.email}</div>
                    </td>
                    <td><strong>{formatCurrency(r.available)}</strong></td>
                    <td>{formatCurrency(r.clearing)}</td>
                    <td>{r.ageDays == null ? '-' : t('payables.days', { count: r.ageDays })}</td>
                    <td>{r.lastSettledAt ? formatDateTime(r.lastSettledAt) : t('payables.never')}</td>
                    <td>
                      {r.pendingRequest
                        ? <span className="badge badge-info">{t('payables.inQueue')}</span>
                        : <span className="badge badge-pending">{t('payables.noRequestYet')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {tab === 'doctors' && dRows.length > 0 && (
        <p className="slot-hint">{t('payables.doctorsHint')}</p>
      )}

      {payDialog && (
        <div className="modal-overlay" onClick={() => setPayDialog(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{t('payables.recordPayoutFor', { name: payDialog.businessName })}</h3></div>
            <div className="modal-body">
              <p className="slot-hint">
                {t('payables.payoutExplainer', { amount: formatCurrency(payDialog.payableNow) })}
              </p>
              <div className="inline-form-row">
                <label>
                  <span className="field-caption">{t('payables.method')}</span>
                  <select className="module-input" value={payForm.method}
                    onChange={e => setPayForm({ ...payForm, method: e.target.value })}>
                    <option value="bank_transfer">{t('payables.bankTransfer')}</option>
                    <option value="upi">UPI</option>
                    <option value="other">{t('payables.other')}</option>
                  </select>
                </label>
                <label className="inline-form-grow">
                  <span className="field-caption">{t('payables.reference')} *</span>
                  <input className="module-input" value={payForm.reference}
                    placeholder={t('payables.referencePlaceholder')}
                    onChange={e => setPayForm({ ...payForm, reference: e.target.value })} />
                </label>
                <label>
                  <span className="field-caption">{t('payables.tdsOverride')}</span>
                  <input className="module-input" type="number" min={0} step="0.01" value={payForm.tdsAmount}
                    placeholder={t('payables.tdsAuto')}
                    onChange={e => setPayForm({ ...payForm, tdsAmount: e.target.value })} />
                </label>
              </div>
              <label>
                <span className="field-caption">{t('payables.notes')}</span>
                <input className="module-input" value={payForm.notes}
                  onChange={e => setPayForm({ ...payForm, notes: e.target.value })} />
              </label>
              <p className="slot-hint">{t('payables.notifyNote')}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setPayDialog(null)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" disabled={!payForm.reference.trim() || busy === payDialog.providerId}
                onClick={confirmPay}>
                {busy === payDialog.providerId ? t('payables.recording') : t('payables.confirmPaid')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Payables
