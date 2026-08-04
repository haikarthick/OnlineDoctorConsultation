import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import client from '../../services/api/client'
import { useSettings } from '../../context/SettingsContext'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

interface ReorderRequest {
  id: string
  pharmacy_id: string
  med_id: string
  med_name: string
  form: string
  strength: string
  supplier_id: string | null
  supplier_name: string | null
  requested_qty: number
  requested_by_name: string
  triggered_by: string
  status: string
  tracking_number: string | null
  expected_delivery_date: string | null
  received_at: string | null
  shipped_at: string | null
  notes: string | null
  created_at: string
}

interface Props {
  pharmacyId: string
  networkId?: string
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:          { bg: '#fff3e0', color: '#e65100' },
  sent_to_supplier: { bg: '#e8eaf6', color: '#3949ab' },
  confirmed:        { bg: '#e8f5e9', color: '#388e3c' },
  shipped:          { bg: '#e3f2fd', color: '#1565c0' },
  received:         { bg: '#f1f8e9', color: '#33691e' },
  cancelled:        { bg: '#ffebee', color: '#c62828' },
}

export default function ReordersManagement({ pharmacyId }: Props) {
  const { t } = useTranslation()
  const { formatDate } = useSettings()
  const [reorders, setReorders] = useState<ReorderRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState('active')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [editingTracking, setEditingTracking] = useState<{ id: string; tracking: string; delivery: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await client.get(`/pharmacies/${pharmacyId}/reorders`)
      setReorders(Array.isArray(res.data) ? res.data : [])
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [pharmacyId, t])

  useEffect(() => { load() }, [load])
  useAutoRefresh('pharmacy-reorders', load, 30000)

  const filtered = filterStatus === 'active'
    ? reorders.filter(r => !['received', 'cancelled'].includes(r.status))
    : filterStatus === 'all'
    ? reorders
    : reorders.filter(r => r.status === filterStatus)

  const updateStatus = async (id: string, status: string, extraData?: Record<string, string>) => {
    setUpdatingId(id)
    try {
      await client.patch(`/pharmacies/${pharmacyId}/reorders/${id}`, { status, ...extraData })
      await load()
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleTrackingSubmit = async () => {
    if (!editingTracking) return
    await updateStatus(editingTracking.id, 'shipped', {
      tracking_number: editingTracking.tracking,
      expected_delivery_date: editingTracking.delivery || undefined as any,
    })
    setEditingTracking(null)
  }

  return (
    <div>
      <div className="pharmacy-card">
        <div className="pharmacy-card-header">
          <h3>🔄 {t('pharmacy.reorders.title')}</h3>
        </div>

        {error && <div className="pharm-error">⚠️ {error} <button type="button" onClick={() => setError('')} className="si-540cb98a">✕</button></div>}

        <div className="pharmacy-filter-bar">
          <select className="pharmacy-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="active">{t('pharmacy.reorders.activeOrders')}</option>
            <option value="all">{t('pharmacy.filter.all')}</option>
            <option value="pending">{t('pharmacy.reorders.status.pending')}</option>
            <option value="sent_to_supplier">{t('pharmacy.reorders.status.sent_to_supplier')}</option>
            <option value="shipped">{t('pharmacy.reorders.status.shipped')}</option>
            <option value="received">{t('pharmacy.reorders.status.received')}</option>
            <option value="cancelled">{t('pharmacy.reorders.status.cancelled')}</option>
          </select>
          <span className="si-22cd98cf">{filtered.length} {t('pharmacy.reorders.orders')}</span>
        </div>

        {loading ? (
          <p className="si-43f86130">{t('common.loading')}</p>
        ) : filtered.length === 0 ? (
          <div className="pharmacy-empty">
            <div className="empty-icon">🔄</div>
            <p>{filterStatus === 'active' ? t('pharmacy.reorders.noActive') : t('pharmacy.reorders.empty')}</p>
          </div>
        ) : (
          <div className="pharmacy-table-wrap">
            <table className="pharmacy-table">
              <thead>
                <tr>
                  <th>{t('pharmacy.table.medication')}</th>
                  <th>{t('pharmacy.reorders.qty')}</th>
                  <th>{t('pharmacy.reorders.supplier')}</th>
                  <th>{t('pharmacy.reorders.requestedBy')}</th>
                  <th>{t('pharmacy.table.date')}</th>
                  <th>{t('pharmacy.table.status')}</th>
                  <th>{t('pharmacy.reorders.tracking')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const colors = STATUS_COLORS[r.status] || { bg: '#f5f5f5', color: '#666' }
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.med_name}</strong>
                        {r.form && <small className="si-1a0c0bfa">{r.form} {r.strength}</small>}
                      </td>
                      <td><strong>{r.requested_qty}</strong></td>
                      <td>{r.supplier_name || <span className="si-c81ca09e">-</span>}</td>
                      <td className="si-c5381d69">
                        {r.requested_by_name}
                        {r.triggered_by === 'automatic' && (
                          <span className="pharm-badge si-d463a1cd">
                            {t('pharmacy.reorders.auto')}
                          </span>
                        )}
                      </td>
                      <td className="si-86931177">
                        {formatDate(r.created_at)}
                        {r.expected_delivery_date && (
                          <small className="si-1a0c0bfa">
                            Exp: {formatDate(r.expected_delivery_date)}
                          </small>
                        )}
                      </td>
                      <td>
                        <span className="pharm-badge" style={{ background: colors.bg, color: colors.color }}>
                          {t(`pharmacy.reorders.status.${r.status}`) || r.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="si-f2dbbee4">
                        {r.tracking_number || <span className="si-c81ca09e">-</span>}
                        {r.shipped_at && <small className="si-1a0c0bfa">Shipped: {formatDate(r.shipped_at)}</small>}
                        {r.received_at && <small className="si-b661dbed">Received: {formatDate(r.received_at)}</small>}
                      </td>
                      <td>
                        <div className="si-8aa04a6d">
                          {r.status === 'pending' && (
                            <button type="button" className="module-btn small"
                              disabled={updatingId === r.id}
                              onClick={() => updateStatus(r.id, 'sent_to_supplier')}>
                              {t('pharmacy.reorders.markSent')}
                            </button>
                          )}
                          {(r.status === 'pending' || r.status === 'sent_to_supplier') && (
                            <button type="button" className="module-btn small"
                              onClick={() => setEditingTracking({ id: r.id, tracking: r.tracking_number || '', delivery: r.expected_delivery_date || '' })}>
                              {t('pharmacy.reorders.addTracking')}
                            </button>
                          )}
                          {r.status === 'shipped' && (
                            <button type="button" className="module-btn small primary"
                              disabled={updatingId === r.id}
                              onClick={() => updateStatus(r.id, 'received')}>
                              ✓ {t('pharmacy.reorders.markReceived')}
                            </button>
                          )}
                          {r.status === 'sent_to_supplier' && (
                            <button type="button" className="module-btn small primary"
                              disabled={updatingId === r.id}
                              onClick={() => updateStatus(r.id, 'received')}>
                              ✓ {t('pharmacy.reorders.markReceived')}
                            </button>
                          )}
                          {!['received', 'cancelled'].includes(r.status) && (
                            <button type="button" className="module-btn small si-bc631a4a"
                              disabled={updatingId === r.id}
                              onClick={() => updateStatus(r.id, 'cancelled')}>
                              {t('common.cancel')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tracking modal */}
      {editingTracking && (
        <div className="pharm-modal-overlay" onClick={() => setEditingTracking(null)}>
          <div className="pharm-modal si-3196bd33" onClick={e => e.stopPropagation()}>
            <div className="pharm-modal-header">
              <h2>📦 {t('pharmacy.reorders.addTracking')}</h2>
              <button type="button" className="pharm-modal-close" onClick={() => setEditingTracking(null)}>✕</button>
            </div>
            <div className="pharm-form-group">
              <label>{t('pharmacy.reorders.trackingNumber')}</label>
              <input value={editingTracking.tracking}
                onChange={e => setEditingTracking(et => et ? { ...et, tracking: e.target.value } : et)}
                placeholder="e.g. INDP12345678" />
            </div>
            <div className="pharm-form-group">
              <label>{t('pharmacy.reorders.expectedDelivery')}</label>
              <input type="date" value={editingTracking.delivery}
                onChange={e => setEditingTracking(et => et ? { ...et, delivery: e.target.value } : et)} />
            </div>
            <div className="pharm-modal-actions">
              <button type="button" className="module-btn" onClick={() => setEditingTracking(null)}>{t('common.cancel')}</button>
              <button type="button" className="module-btn primary" onClick={handleTrackingSubmit}>{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
