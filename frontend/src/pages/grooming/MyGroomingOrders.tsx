import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { payGroomingOrderFlow, payGroomingBalanceFlow } from '../../utils/groomingCheckout'
import { useSettings } from '../../context/SettingsContext'
import '../../styles/modules.css'

interface Props { onNavigate: (path: string) => void }

// Every status the order state machine can reach needs a chip, not just the happy path — a
// missing entry renders as an unlabelled grey pill. payment_expired in particular is now
// reachable for real customers since the slot-hold expiry job went live.
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  draft: { bg: '#f3f4f6', color: '#374151' },
  payment_pending: { bg: '#fef3c7', color: '#92400e' },
  payment_expired: { bg: '#fee2e2', color: '#7f1d1d' },
  confirmed: { bg: '#dbeafe', color: '#1e40af' },
  provider_assigned: { bg: '#e0e7ff', color: '#3730a3' },
  checked_in: { bg: '#e0f2fe', color: '#075985' },
  en_route: { bg: '#e0f2fe', color: '#075985' },
  intake_done: { bg: '#ede9fe', color: '#5b21b6' },
  in_progress: { bg: '#fef9c3', color: '#854d0e' },
  awaiting_approval: { bg: '#ffedd5', color: '#9a3412' },
  quality_check: { bg: '#ede9fe', color: '#5b21b6' },
  ready_for_pickup: { bg: '#d1fae5', color: '#065f46' },
  returning: { bg: '#d1fae5', color: '#065f46' },
  completed: { bg: '#dcfce7', color: '#166534' },
  cancelled_by_customer: { bg: '#fee2e2', color: '#991b1b' },
  cancelled_by_provider: { bg: '#fee2e2', color: '#991b1b' },
  no_show: { bg: '#e5e7eb', color: '#374151' },
  disputed: { bg: '#fce7f3', color: '#9d174d' },
  closed: { bg: '#e5e7eb', color: '#374151' },
}

const MyGroomingOrders: React.FC<Props> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  // Cancel dialog: the refund policy is fetched and shown BEFORE the customer commits, so they
  // never discover the processing charge or the 50% window after the fact.
  const [cancelFor, setCancelFor] = useState<any | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [preview, setPreview] = useState<any | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [disputeFor, setDisputeFor] = useState<any | null>(null)
  const [disputeReason, setDisputeReason] = useState('')

  const [disputes, setDisputes] = useState<any[]>([])
  const load = useCallback(async () => {
    try {
      setLoading(true); setErr('')
      setItems((await apiService.listMyGroomingOrders()).data || [])
      try { setDisputes((await apiService.listMyGroomingDisputes()).data || []) } catch { /* optional */ }
    } catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const openCancel = async (o: any) => {
    setCancelFor(o); setCancelReason(''); setPreview(null); setPreviewLoading(true)
    try { setPreview((await apiService.getGroomingRefundPreview(o.id)).data) }
    catch { setPreview(null) } finally { setPreviewLoading(false) }
  }
  const confirmCancel = async () => {
    if (!cancelFor) return
    const id = cancelFor.id
    try { setBusy(id); await apiService.cancelGroomingOrder(id, cancelReason.trim() || undefined); setCancelFor(null); flash(t('groomingOrders.cancelled')); load() }
    catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setBusy(null) }
  }

  const confirmDispute = async () => {
    if (!disputeFor || !disputeReason.trim()) return
    const id = disputeFor.id
    try { setBusy(id); await apiService.raiseGroomingDispute(id, { reason: disputeReason.trim() }); setDisputeFor(null); flash(t('groomingDispute.raised')); load() }
    catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setBusy(null) }
  }

  const pay = async (id: string) => {
    try { setBusy(id); await payGroomingOrderFlow(id, false); flash(t('groomingOrders.paid')); load() }
    catch (e: any) { setErr(e?.response?.data?.message || e.message || 'Payment failed') } finally { setBusy(null) }
  }
  const payBalance = async (id: string) => {
    try { setBusy(id); await payGroomingBalanceFlow(id); flash(t('groomingOrders.balancePaid')); load() }
    catch (e: any) { setErr(e?.response?.data?.message || e.message || 'Payment failed') } finally { setBusy(null) }
  }

  const cancellable = (s: string) => !['completed', 'closed', 'cancelled_by_customer', 'cancelled_by_provider', 'no_show', 'payment_expired'].includes(s)

  return (
    <div className="module-page">
      <div className="module-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h1>💈 {t('groomingOrders.title')}</h1>
        <button className="module-btn primary" onClick={() => onNavigate('/grooming/find')}>+ {t('groomingOrders.bookNew')}</button>
      </div>
      {err && <div className="module-alert error">{err}</div>}
      {msg && <div className="module-alert success">{msg}</div>}
      {loading ? <div className="loading-container"><div className="loading-spinner" /></div>
        : items.length === 0 ? <div className="empty-state"><div className="si-71a36f28">💈</div><h3>{t('groomingOrders.none')}</h3>
            <button className="module-btn primary" onClick={() => onNavigate('/grooming/find')}>{t('groomingOrders.findGroomer')}</button></div>
          : (
            <div style={{ display: 'grid', gap: 12 }}>
              {items.map(o => {
                const c = STATUS_COLOR[o.status] || { bg: '#e5e7eb', color: '#374151' }
                const balance = Number(o.balanceDue || 0)
                const refunded = Number(o.refundAmount || 0)
                return (
                  <div key={o.id} className="module-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <strong>{o.providerName}</strong> · {o.serviceName}
                        <div className="si-676930d7">{o.scheduledDate} · {o.timeSlotStart} · {t(o.serviceMode === 'mobile' ? 'groomingBook.mobile' : 'groomingBook.atPremises')}</div>
                        <div className="si-a5de6cea">{o.orderNumber}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ background: c.bg, color: c.color, padding: '4px 10px', borderRadius: 14, fontWeight: 700, fontSize: 12 }}>
                          {String(t(`groomingStatus.${o.status}`, { defaultValue: (o.status || '').replace(/_/g, ' ') }))}
                        </span>
                        <div style={{ fontWeight: 700, marginTop: 6 }}>{formatCurrency(Number(o.grandTotal))}</div>
                      </div>
                    </div>

                    {balance > 0 && (
                      <div className="module-alert warning" style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <span>{t('groomingOrders.balanceDue', { amount: formatCurrency(balance) })}</span>
                        <button className="btn btn-sm btn-primary" disabled={busy === o.id} onClick={() => payBalance(o.id)}>
                          {t('groomingOrders.payBalance')}
                        </button>
                      </div>
                    )}
                    {refunded > 0 && (
                      <div className="si-676930d7" style={{ marginTop: 8 }}>
                        ↩ {t('groomingOrders.refunded', { amount: formatCurrency(refunded) })}
                        {o.refundStatus === 'partial' ? ` (${t('groomingOrders.refundPartial')})` : ''}
                        {o.refundDestination ? ` · ${t(`groomingOrders.refundTo.${o.refundDestination}`, { defaultValue: o.refundDestination })}` : ''}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <button className="btn btn-sm btn-outline" onClick={() => onNavigate(`/grooming/order/${o.id}`)}>{t('groomingOrders.details')}</button>
                      {o.animalId && <button className="btn btn-sm btn-outline" onClick={() => onNavigate(`/grooming/passport/${o.animalId}`)}>🐾 {t('groomingOrders.passport')}</button>}
                      {['completed', 'closed', 'ready_for_pickup'].includes(o.status) && <button className="btn btn-sm btn-outline" disabled={busy === o.id} onClick={() => { setDisputeFor(o); setDisputeReason('') }}>{t('groomingDispute.raise')}</button>}
                      {o.status === 'payment_pending' && <button className="btn btn-sm btn-primary" disabled={busy === o.id} onClick={() => pay(o.id)}>{t('groomingOrders.payNow')}</button>}
                      {cancellable(o.status) && <button className="btn btn-sm btn-outline" disabled={busy === o.id} onClick={() => openCancel(o)}>{t('groomingOrders.cancel')}</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

      {cancelFor && (
        <div className="modal-overlay" onClick={() => setCancelFor(null)}>
          <div className="modal-content" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <h3>{t('groomingOrders.cancelTitle')}</h3>
            <p className="si-676930d7">{cancelFor.providerName} · {cancelFor.orderNumber}</p>

            {previewLoading ? <div className="loading-container"><div className="loading-spinner" /></div>
              : preview?.hasPayment ? (
                <div className="module-card" style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{t('groomingOrders.amountPaid')}</span><strong>{formatCurrency(Number(preview.amountPaid))}</strong>
                  </div>
                  {Number(preview.processingCharge) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{t('groomingOrders.processingCharge')}</span><span>− {formatCurrency(Number(preview.processingCharge))}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', marginTop: 6, paddingTop: 6 }}>
                    <strong>{t('groomingOrders.youGetBack')}</strong>
                    <strong>{formatCurrency(Number(preview.refundAmount))}</strong>
                  </div>
                  <div className="si-a5de6cea" style={{ marginTop: 6 }}>
                    {t(`groomingOrders.policy.${preview.policy}`, { defaultValue: String(preview.policy || '').replace(/_/g, ' ') })}
                  </div>
                </div>
              ) : <p className="si-676930d7">{t('groomingOrders.noPaymentToRefund')}</p>}

            <label className="module-label" style={{ marginTop: 10 }}>{t('groomingOrders.cancelReason')}</label>
            <textarea className="module-input" rows={2} value={cancelReason} onChange={e => setCancelReason(e.target.value)} />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn btn-outline" onClick={() => setCancelFor(null)}>{t('groomingOrders.keepBooking')}</button>
              <button className="btn btn-danger" disabled={busy === cancelFor.id} onClick={confirmCancel}>
                {busy === cancelFor.id ? t('groomingOrders.cancelling') : t('groomingOrders.confirmCancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {disputeFor && (
        <div className="modal-overlay" onClick={() => setDisputeFor(null)}>
          <div className="modal-content" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h3>{t('groomingDispute.raise')}</h3>
            <p className="si-676930d7">{disputeFor.providerName} · {disputeFor.orderNumber}</p>
            <label className="module-label">{t('groomingDispute.reasonPrompt')}</label>
            <textarea className="module-input" rows={3} value={disputeReason} onChange={e => setDisputeReason(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn btn-outline" onClick={() => setDisputeFor(null)}>{t('groomingOrders.keepBooking')}</button>
              <button className="btn btn-primary" disabled={!disputeReason.trim() || busy === disputeFor.id} onClick={confirmDispute}>
                {t('groomingDispute.submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {disputes.length > 0 && (
        <div className="module-card" style={{ marginTop: 16 }}>
          <h3>{t('groomingDispute.myDisputes')}</h3>
          {disputes.map(d => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee', flexWrap: 'wrap', gap: 8 }}>
              <span><strong>{d.orderNumber}</strong> · {d.providerName} · {d.reason}</span>
              <span className="badge badge-inactive">{t(`groomingDispute.st.${d.status}`, { defaultValue: (d.status || '').replace(/_/g, ' ') })}{d.resolutionNote ? ` · ${d.resolutionNote}` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MyGroomingOrders
