import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import '../../styles/modules.css'

interface Props { onNavigate: (path: string) => void }

// next quick-transitions offered per status (mirrors backend PROVIDER_TRANSITIONS)
const NEXT: Record<string, { to: string; key: string }[]> = {
  confirmed: [{ to: 'checked_in', key: 'checkIn' }, { to: 'in_progress', key: 'start' }, { to: 'no_show', key: 'noShow' }],
  provider_assigned: [{ to: 'checked_in', key: 'checkIn' }, { to: 'in_progress', key: 'start' }],
  en_route: [{ to: 'checked_in', key: 'checkIn' }, { to: 'in_progress', key: 'start' }],
  checked_in: [{ to: 'in_progress', key: 'start' }],
  intake_done: [{ to: 'in_progress', key: 'start' }],
  in_progress: [{ to: 'quality_check', key: 'qualityCheck' }, { to: 'ready_for_pickup', key: 'ready' }],
  quality_check: [{ to: 'ready_for_pickup', key: 'ready' }],
  ready_for_pickup: [{ to: 'completed', key: 'complete' }],
  returning: [{ to: 'completed', key: 'complete' }],
}

const GroomingOrdersBoard: React.FC<Props> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const [providerId, setProviderId] = useState('')
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true); setErr('')
      const prov = (await apiService.getMyGroomingProvider()).data
      if (!prov) { setErr(t('groomingBoard.noProvider')); setLoading(false); return }
      setProviderId(prov.id)
      const res = await apiService.listGroomingProviderOrders(prov.id, filter || undefined)
      setOrders(res.data || [])
    } catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setLoading(false) }
  }, [filter])
  useEffect(() => { load() }, [load])

  const act = async (id: string, to: string) => {
    try { setBusy(id); await apiService.transitionGroomingOrder(id, to); await load() }
    catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setBusy(null) }
  }

  const FILTERS = ['', 'confirmed', 'in_progress', 'ready_for_pickup', 'completed']

  return (
    <div className="module-page">
      <div className="module-header"><h1>📋 {t('groomingBoard.title')}</h1></div>
      {err && <div className="module-alert error">{err}</div>}
      <div className="module-tabs si-7e63ec4f">
        {FILTERS.map(f => (
          <button key={f || 'all'} className={`module-tab${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
            {f ? t(`groomingStatus.${f}`) : t('groomingBoard.all')}
          </button>
        ))}
      </div>
      {loading ? <div className="loading-container"><div className="loading-spinner" /></div>
        : orders.length === 0 ? <div className="empty-state"><div className="si-71a36f28">📋</div><p>{t('groomingBoard.none')}</p></div>
          : (
            <div style={{ display: 'grid', gap: 12 }}>
              {orders.map(o => (
                <div key={o.id} className="module-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <strong>{o.serviceName}</strong> · {o.ownerFirstName} {o.ownerLastName}
                      <div className="si-676930d7">{o.scheduledDate} · {o.timeSlotStart} · {t(o.serviceMode === 'mobile' ? 'groomingBook.mobile' : 'groomingBook.atPremises')}</div>
                      <div className="si-a5de6cea">{o.orderNumber}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge badge-info">{t(`groomingStatus.${o.status}`, { defaultValue: (o.status || '').replace(/_/g, ' ') })}</span>
                      <div style={{ fontWeight: 700, marginTop: 4 }}>{formatCurrency(Number(o.grandTotal))}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    <button className="btn btn-sm btn-outline" onClick={() => onNavigate(`/grooming/order/${o.id}`)}>{t('groomingBoard.details')}</button>
                    {(NEXT[o.status] || []).map(n => (
                      <button key={n.to} className="btn btn-sm btn-primary" disabled={busy === o.id} onClick={() => act(o.id, n.to)}>
                        {t(`groomingBoard.action.${n.key}`)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
      {providerId && (
        <div style={{ marginTop: 16 }}>
          <button className="module-btn" onClick={() => onNavigate('/grooming/earnings')}>💰 {t('groomingBoard.earnings')}</button>
        </div>
      )}
    </div>
  )
}

export default GroomingOrdersBoard
