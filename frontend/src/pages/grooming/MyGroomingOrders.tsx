import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import '../../styles/modules.css'

interface Props { onNavigate: (path: string) => void }

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  payment_pending: { bg: '#fef3c7', color: '#92400e' },
  confirmed: { bg: '#dbeafe', color: '#1e40af' },
  in_progress: { bg: '#fef9c3', color: '#854d0e' },
  ready_for_pickup: { bg: '#d1fae5', color: '#065f46' },
  completed: { bg: '#dcfce7', color: '#166534' },
  cancelled_by_customer: { bg: '#fee2e2', color: '#991b1b' },
  cancelled_by_provider: { bg: '#fee2e2', color: '#991b1b' },
  no_show: { bg: '#e5e7eb', color: '#374151' },
}

const MyGroomingOrders: React.FC<Props> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setLoading(true); setErr(''); setItems((await apiService.listMyGroomingOrders()).data || []) }
    catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const cancel = async (id: string) => {
    const reason = prompt(t('groomingOrders.cancelReason')); if (reason === null) return
    try { setBusy(id); await apiService.cancelGroomingOrder(id, reason || undefined); load() }
    catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setBusy(null) }
  }
  const pay = async (id: string) => {
    try { setBusy(id); await apiService.payGroomingOrder(id, false); load() }
    catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setBusy(null) }
  }

  const cancellable = (s: string) => !['completed', 'closed', 'cancelled_by_customer', 'cancelled_by_provider', 'no_show'].includes(s)

  return (
    <div className="module-page">
      <div className="module-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h1>💈 {t('groomingOrders.title')}</h1>
        <button className="module-btn primary" onClick={() => onNavigate('/grooming/find')}>+ {t('groomingOrders.bookNew')}</button>
      </div>
      {err && <div className="module-alert error">{err}</div>}
      {loading ? <div className="loading-container"><div className="loading-spinner" /></div>
        : items.length === 0 ? <div className="empty-state"><div className="si-71a36f28">💈</div><h3>{t('groomingOrders.none')}</h3>
            <button className="module-btn primary" onClick={() => onNavigate('/grooming/find')}>{t('groomingOrders.findGroomer')}</button></div>
          : (
            <div style={{ display: 'grid', gap: 12 }}>
              {items.map(o => {
                const c = STATUS_COLOR[o.status] || { bg: '#e5e7eb', color: '#374151' }
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
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <button className="btn btn-sm btn-outline" onClick={() => onNavigate(`/grooming/order/${o.id}`)}>{t('groomingOrders.details')}</button>
                      {o.status === 'payment_pending' && <button className="btn btn-sm btn-primary" disabled={busy === o.id} onClick={() => pay(o.id)}>{t('groomingOrders.payNow')}</button>}
                      {cancellable(o.status) && <button className="btn btn-sm btn-outline" disabled={busy === o.id} onClick={() => cancel(o.id)}>{t('groomingOrders.cancel')}</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
    </div>
  )
}

export default MyGroomingOrders
