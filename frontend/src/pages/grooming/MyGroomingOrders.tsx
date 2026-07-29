import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { payGroomingOrderFlow, payGroomingBalanceFlow } from '../../utils/groomingCheckout'
import { useSettings } from '../../context/SettingsContext'
import '../../styles/modules.css'

interface Props { onNavigate: (path: string) => void }

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

  // declined_by_provider is terminal and already refunded — offering Cancel on it would send the
  // customer into a dialog the server rejects, on an order that owes them nothing further.
  const cancellable = (s: string) => !['completed', 'closed', 'cancelled_by_customer', 'cancelled_by_provider', 'declined_by_provider', 'no_show', 'payment_expired'].includes(s)

  return (
    <div className="module-page">
      <div className="module-header module-header-split">
        <h1>💈 {t('groomingOrders.title')}</h1>
        <button className="module-btn primary" onClick={() => onNavigate('/grooming/find')}>+ {t('groomingOrders.bookNew')}</button>
      </div>
      {err && <div className="module-alert error">{err}</div>}
      {msg && <div className="module-alert success">{msg}</div>}
      {loading ? <div className="loading-container"><div className="loading-spinner" /></div>
        : items.length === 0 ? <div className="empty-state"><div className="empty-state-icon">💈</div><h3>{t('groomingOrders.none')}</h3>
            <button className="module-btn primary" onClick={() => onNavigate('/grooming/find')}>{t('groomingOrders.findGroomer')}</button></div>
          : (
            <div className="order-list">
              {items.map(o => {
                const balance = Number(o.balanceDue || 0)
                const refunded = Number(o.refundAmount || 0)
                return (
                  <div key={o.id} className="module-card">
                    <div className="order-row-head">
                      <div>
                        <strong>{o.providerName}</strong> · {o.serviceName}
                        <div className="slot-hint">{o.scheduledDate} · {o.timeSlotStart} · {t(o.serviceMode === 'mobile' ? 'groomingBook.mobile' : 'groomingBook.atPremises')}</div>
                        <div className="si-a5de6cea">{o.orderNumber}</div>
                      </div>
                      <div className="order-row-amount">
                        <span className={`module-badge status-chip status-${o.status}`}>
                          {String(t(`groomingStatus.${o.status}`, { defaultValue: (o.status || '').replace(/_/g, ' ') }))}
                        </span>
                        <div className="order-row-total">{formatCurrency(Number(o.grandTotal))}</div>
                      </div>
                    </div>

                    {/* The gate is invisible to the customer unless we explain it: they have paid
                        but are not confirmed, and the money can still come back automatically. */}
                    {o.status === 'pending_provider_acceptance' && (
                      <div className="module-alert warning acceptance-notice">
                        <strong>⏳ {t('groomingMyOrders.acceptance.awaitingTitle')}</strong>
                        <p>{t('groomingMyOrders.acceptance.awaitingBody')}</p>
                      </div>
                    )}
                    {o.status === 'declined_by_provider' && (
                      <div className="module-alert error acceptance-notice">
                        <strong>{t('groomingMyOrders.acceptance.declinedTitle')}</strong>
                        <p>
                          {o.declineReason ? `“${o.declineReason}” — ` : ''}
                          {t('groomingMyOrders.acceptance.declinedBody')}
                        </p>
                      </div>
                    )}

                    {balance > 0 && (
                      <div className="module-alert warning balance-due-banner">
                        <span>{t('groomingOrders.balanceDue', { amount: formatCurrency(balance) })}</span>
                        <button className="btn btn-sm btn-primary" disabled={busy === o.id} onClick={() => payBalance(o.id)}>
                          {t('groomingOrders.payBalance')}
                        </button>
                      </div>
                    )}
                    {refunded > 0 && (
                      <div className="refund-note">
                        ↩ {t('groomingOrders.refunded', { amount: formatCurrency(refunded) })}
                        {o.refundStatus === 'partial' ? ` (${t('groomingOrders.refundPartial')})` : ''}
                        {o.refundDestination ? ` · ${t(`groomingOrders.refundTo.${o.refundDestination}`, { defaultValue: o.refundDestination })}` : ''}
                      </div>
                    )}

                    <div className="order-row-actions">
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
          <div className="modal-content modal-medium" onClick={e => e.stopPropagation()}>
            <h3>{t('groomingOrders.cancelTitle')}</h3>
            <p className="slot-hint">{cancelFor.providerName} · {cancelFor.orderNumber}</p>

            {previewLoading ? <div className="loading-container"><div className="loading-spinner" /></div>
              : preview?.hasPayment ? (
                <div className="module-card refund-preview">
                  <div className="refund-preview-row">
                    <span>{t('groomingOrders.amountPaid')}</span><strong>{formatCurrency(Number(preview.amountPaid))}</strong>
                  </div>
                  {Number(preview.processingCharge) > 0 && (
                    <div className="refund-preview-row">
                      <span>{t('groomingOrders.processingCharge')}</span><span>− {formatCurrency(Number(preview.processingCharge))}</span>
                    </div>
                  )}
                  <div className="refund-preview-row is-total">
                    <strong>{t('groomingOrders.youGetBack')}</strong>
                    <strong>{formatCurrency(Number(preview.refundAmount))}</strong>
                  </div>
                  <div className="slot-hint">
                    {t(`groomingOrders.policy.${preview.policy}`, { defaultValue: String(preview.policy || '').replace(/_/g, ' ') })}
                  </div>
                </div>
              ) : <p className="slot-hint">{t('groomingOrders.noPaymentToRefund')}</p>}

            <label className="module-label slot-label">{t('groomingOrders.cancelReason')}</label>
            <textarea className="module-input" rows={2} value={cancelReason} onChange={e => setCancelReason(e.target.value)} />

            <div className="modal-footer">
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
          <div className="modal-content modal-narrow" onClick={e => e.stopPropagation()}>
            <h3>{t('groomingDispute.raise')}</h3>
            <p className="slot-hint">{disputeFor.providerName} · {disputeFor.orderNumber}</p>
            <label className="module-label">{t('groomingDispute.reasonPrompt')}</label>
            <textarea className="module-input" rows={3} value={disputeReason} onChange={e => setDisputeReason(e.target.value)} />
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDisputeFor(null)}>{t('groomingOrders.keepBooking')}</button>
              <button className="btn btn-primary" disabled={!disputeReason.trim() || busy === disputeFor.id} onClick={confirmDispute}>
                {t('groomingDispute.submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {disputes.length > 0 && (
        <div className="module-card disputes-card">
          <h3>{t('groomingDispute.myDisputes')}</h3>
          {disputes.map(d => (
            <div key={d.id} className="dispute-list-row">
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
