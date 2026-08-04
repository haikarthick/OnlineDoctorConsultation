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

/** Minutes left before the acceptance window lapses; negative once it has. */
function minutesLeft(deadline?: string | null): number | null {
  if (!deadline) return null
  const ms = new Date(deadline).getTime() - Date.now()
  return isNaN(ms) ? null : Math.round(ms / 60000)
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
  const [declining, setDeclining] = useState<{ id: string; reason: string } | null>(null)
  // Re-render on a timer so the "expires in N min" countdown stays honest without a refetch.
  const [, setTick] = useState(0)

  const load = useCallback(async () => {
    try {
      setLoading(true); setErr('')
      const prov = (await apiService.getMyGroomingProvider()).data
      if (!prov) { setErr(t('groomingBoard.noProvider')); setLoading(false); return }
      setProviderId(prov.id)
      const res = await apiService.listGroomingProviderOrders(prov.id, filter || undefined)
      setOrders(res.data || [])
    } catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setLoading(false) }
  }, [filter, t])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 30000)
    return () => clearInterval(id)
  }, [])

  const act = async (id: string, to: string) => {
    try { setBusy(id); await apiService.transitionGroomingOrder(id, to); await load() }
    catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setBusy(null) }
  }

  const accept = async (id: string) => {
    try { setBusy(id); setErr(''); await apiService.acceptGroomingOrder(id); await load() }
    catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setBusy(null) }
  }

  const confirmDecline = async () => {
    if (!declining || !declining.reason.trim()) return
    try {
      setBusy(declining.id); setErr('')
      await apiService.declineGroomingOrder(declining.id, declining.reason.trim())
      setDeclining(null)
      await load()
    } catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setBusy(null) }
  }

  // Bookings waiting on the provider are pulled out of the main list and shown first: they are
  // the only rows with a deadline attached, and missing one auto-refunds the customer.
  const pending = orders.filter(o => o.status === 'pending_provider_acceptance')
  const rest = orders.filter(o => o.status !== 'pending_provider_acceptance')

  const FILTERS = ['', 'pending_provider_acceptance', 'confirmed', 'in_progress', 'ready_for_pickup', 'completed']

  return (
    <div className="module-page">
      <div className="module-header"><h1>📋 {t('groomingBoard.title')}</h1></div>
      {err && <div className="module-alert error">{err}</div>}
      <div className="module-tabs si-7e63ec4f">
        {FILTERS.map(f => (
          <button key={f || 'all'} className={`module-tab${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
            {f ? t(`groomingStatus.${f}`, { defaultValue: f.replace(/_/g, ' ') }) : t('groomingBoard.all')}
            {f === 'pending_provider_acceptance' && pending.length > 0 ? ` (${pending.length})` : ''}
          </button>
        ))}
      </div>

      {loading ? <div className="loading-container"><div className="loading-spinner" /></div> : (
        <>
          {pending.length > 0 && (
            <section className="action-required-list">
              <h2>{t('groomingBoard.acceptance.heading', { count: pending.length })}</h2>
              {pending.map(o => {
                const mins = minutesLeft(o.acceptanceDeadline)
                const urgent = mins !== null && mins <= 30
                return (
                  <div key={o.id} className={`action-required-card${urgent ? ' is-urgent' : ''}`}>
                    <div className="action-required-head">
                      <div className="action-required-title">
                        {o.serviceName} · {o.ownerFirstName} {o.ownerLastName}
                        <div className="action-required-meta">
                          {o.scheduledDate} · {o.timeSlotStart} · {formatCurrency(Number(o.grandTotal))} · {o.orderNumber}
                        </div>
                      </div>
                      <div className="action-required-deadline">
                        {mins === null ? ''
                          : mins <= 0 ? t('groomingBoard.acceptance.expiring')
                            : t('groomingBoard.acceptance.expiresIn', { count: mins })}
                      </div>
                    </div>
                    <p className="action-required-note">{t('groomingBoard.acceptance.explainer')}</p>

                    {declining && declining.id === o.id ? (
                      <div className="reason-prompt">
                        <label htmlFor={`decline-${o.id}`}>{t('groomingBoard.acceptance.reasonLabel')}</label>
                        <textarea
                          id={`decline-${o.id}`}
                          value={declining.reason}
                          placeholder={t('groomingBoard.acceptance.reasonPlaceholder')}
                          onChange={e => setDeclining({ id: o.id, reason: e.target.value })}
                        />
                        <div className="action-required-actions">
                          <button className="btn btn-sm btn-danger" disabled={busy === o.id || !declining.reason.trim()}
                            onClick={confirmDecline}>
                            {t('groomingBoard.acceptance.confirmDecline')}
                          </button>
                          <button className="btn btn-sm btn-outline" disabled={busy === o.id}
                            onClick={() => setDeclining(null)}>
                            {t('common.cancel', { defaultValue: 'Cancel' })}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="action-required-actions">
                        <button className="btn btn-sm btn-success" disabled={busy === o.id} onClick={() => accept(o.id)}>
                          ✓ {t('groomingBoard.acceptance.accept')}
                        </button>
                        <button className="btn btn-sm btn-danger" disabled={busy === o.id}
                          onClick={() => setDeclining({ id: o.id, reason: '' })}>
                          {t('groomingBoard.acceptance.decline')}
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={() => onNavigate(`/grooming/order/${o.id}`)}>
                          {t('groomingBoard.details')}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          )}

          {rest.length === 0 && pending.length === 0
            ? <div className="empty-state"><div className="si-71a36f28">📋</div><p>{t('groomingBoard.none')}</p></div>
            : (
              <div className="order-list">
                {rest.map(o => (
                  <div key={o.id} className="module-card">
                    <div className="order-row-head">
                      <div>
                        <strong>{o.serviceName}</strong> · {o.ownerFirstName} {o.ownerLastName}
                        <div className="si-676930d7">{o.scheduledDate} · {o.timeSlotStart} · {t(o.serviceMode === 'mobile' ? 'groomingBook.mobile' : 'groomingBook.atPremises')}</div>
                        <div className="si-a5de6cea">{o.orderNumber}</div>
                      </div>
                      <div className="order-row-amount">
                        <span className="badge badge-info">{t(`groomingStatus.${o.status}`, { defaultValue: (o.status || '').replace(/_/g, ' ') })}</span>
                        <div className="order-row-total">{formatCurrency(Number(o.grandTotal))}</div>
                      </div>
                    </div>
                    <div className="order-row-actions">
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
        </>
      )}

      {providerId && (
        <div className="order-footer-actions">
          <button className="module-btn" onClick={() => onNavigate('/grooming/earnings')}>💰 {t('groomingBoard.earnings')}</button>
        </div>
      )}
    </div>
  )
}

export default GroomingOrdersBoard
