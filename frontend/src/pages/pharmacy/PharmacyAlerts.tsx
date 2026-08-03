import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import client from '../../services/api/client'
import { useSettings } from '../../context/SettingsContext'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

/**
 * Stock alerts.
 *
 * The dashboard already showed COUNTS of low-stock and expiring items, but both
 * tiles linked to the inventory table, which lists one row per batch and can only
 * show medications that have batches. Two things were therefore invisible:
 *
 *   - a medication that has run out entirely has no inventory rows at all, so it
 *     never appeared anywhere despite being the most severe shortage possible;
 *   - already-expired stock was mixed in with everything else rather than called
 *     out as unusable.
 *
 * These two endpoints answer both questions properly - low-stock aggregates per
 * medication with a LEFT JOIN (so zero-stock medications are included), and
 * expiry returns anything within 90 days including already-expired batches.
 */

interface ExpiryAlert {
  id: string
  med_id: string
  med_name: string
  form: string
  strength: string
  batch_number: string
  quantity: number
  unit: string
  expiry_date: string
  days_until_expiry: number | null
}

interface LowStockAlert {
  med_id: string
  med_name: string
  form: string
  strength: string
  reorder_point: number
  min_stock_level: number
  current_stock: number
}

interface Props {
  pharmacyId: string
  onReorder?: (medId: string) => void
}

export default function PharmacyAlerts({ pharmacyId, onReorder }: Props) {
  const { t } = useTranslation()
  const { formatDate } = useSettings()
  const [expiry, setExpiry] = useState<ExpiryAlert[]>([])
  const [lowStock, setLowStock] = useState<LowStockAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setError('')
      const [expRes, lowRes] = await Promise.all([
        client.get(`/pharmacies/${pharmacyId}/expiry-alerts`),
        client.get(`/pharmacies/${pharmacyId}/low-stock-alerts`),
      ])
      setExpiry(Array.isArray(expRes.data) ? expRes.data : [])
      setLowStock(Array.isArray(lowRes.data) ? lowRes.data : [])
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [pharmacyId, t])

  useEffect(() => { load() }, [load])
  useAutoRefresh('pharmacy-alerts', load, 60000)

  // Expired stock cannot legally be dispensed, so it is separated from stock
  // that is merely approaching its expiry date.
  const expired = expiry.filter(e => (e.days_until_expiry ?? 0) < 0)
  const expiringSoon = expiry.filter(e => (e.days_until_expiry ?? 0) >= 0)
  const outOfStock = lowStock.filter(l => Number(l.current_stock) <= 0)
  const running = lowStock.filter(l => Number(l.current_stock) > 0)

  if (loading) return <div className="pharmacy-card"><p>{t('common.loading')}</p></div>

  return (
    <div className="pharmacy-alerts">
      {error && (
        <div className="pharm-error si-7e63ec4f">
          ⚠️ {error}
          <button type="button" onClick={() => setError('')} className="si-540cb98a">✕</button>
        </div>
      )}

      {/* ── Expired: unusable stock ── */}
      <div className="pharmacy-card">
        <div className="pharmacy-card-header">
          <h3>🚫 {t('pharmacy.alerts.expired')} ({expired.length})</h3>
        </div>
        {expired.length === 0 ? (
          <p className="empty-state">{t('pharmacy.alerts.noExpired')}</p>
        ) : (
          <div className="table-scroll">
            <table className="pharmacy-table">
              <thead>
                <tr>
                  <th>{t('pharmacy.inventory.medicationLabel')}</th>
                  <th>{t('pharmacy.inventory.batchNumber')}</th>
                  <th>{t('pharmacy.inventory.quantity')}</th>
                  <th>{t('pharmacy.inventory.expiryDate')}</th>
                  <th>{t('pharmacy.alerts.expiredAgo')}</th>
                </tr>
              </thead>
              <tbody>
                {expired.map(e => (
                  <tr key={e.id}>
                    <td>{e.med_name} {e.strength ? `(${e.strength})` : ''}</td>
                    <td>{e.batch_number || '-'}</td>
                    <td>{e.quantity} {e.unit}</td>
                    <td>{e.expiry_date ? formatDate(new Date(e.expiry_date)) : '-'}</td>
                    <td><span className="pharm-badge expired">{Math.abs(e.days_until_expiry ?? 0)}d</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Expiring within 90 days ── */}
      <div className="pharmacy-card">
        <div className="pharmacy-card-header">
          <h3>⏰ {t('pharmacy.alerts.expiringSoon')} ({expiringSoon.length})</h3>
        </div>
        {expiringSoon.length === 0 ? (
          <p className="empty-state">{t('pharmacy.alerts.noExpiring')}</p>
        ) : (
          <div className="table-scroll">
            <table className="pharmacy-table">
              <thead>
                <tr>
                  <th>{t('pharmacy.inventory.medicationLabel')}</th>
                  <th>{t('pharmacy.inventory.batchNumber')}</th>
                  <th>{t('pharmacy.inventory.quantity')}</th>
                  <th>{t('pharmacy.inventory.expiryDate')}</th>
                  <th>{t('pharmacy.alerts.daysLeft')}</th>
                </tr>
              </thead>
              <tbody>
                {expiringSoon.map(e => (
                  <tr key={e.id}>
                    <td>{e.med_name} {e.strength ? `(${e.strength})` : ''}</td>
                    <td>{e.batch_number || '-'}</td>
                    <td>{e.quantity} {e.unit}</td>
                    <td>{e.expiry_date ? formatDate(new Date(e.expiry_date)) : '-'}</td>
                    <td>
                      <span className={`pharm-badge ${(e.days_until_expiry ?? 0) <= 30 ? 'expiring' : 'ok'}`}>
                        {e.days_until_expiry ?? 0}d
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Out of stock: nothing on the shelf at all ── */}
      <div className="pharmacy-card">
        <div className="pharmacy-card-header">
          <h3>❗ {t('pharmacy.alerts.outOfStock')} ({outOfStock.length})</h3>
        </div>
        {outOfStock.length === 0 ? (
          <p className="empty-state">{t('pharmacy.alerts.noOutOfStock')}</p>
        ) : (
          <div className="table-scroll">
            <table className="pharmacy-table">
              <thead>
                <tr>
                  <th>{t('pharmacy.inventory.medicationLabel')}</th>
                  <th>{t('pharmacy.alerts.reorderPoint')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {outOfStock.map(l => (
                  <tr key={l.med_id}>
                    <td>{l.med_name} {l.strength ? `(${l.strength})` : ''}</td>
                    <td>{l.reorder_point ?? l.min_stock_level ?? 0}</td>
                    <td>
                      {onReorder && (
                        <button type="button" className="btn-small btn-primary" onClick={() => onReorder(l.med_id)}>
                          🔄 {t('pharmacy.alerts.reorder')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Running low but not empty ── */}
      <div className="pharmacy-card">
        <div className="pharmacy-card-header">
          <h3>⚠️ {t('pharmacy.alerts.runningLow')} ({running.length})</h3>
        </div>
        {running.length === 0 ? (
          <p className="empty-state">{t('pharmacy.alerts.noLowStock')}</p>
        ) : (
          <div className="table-scroll">
            <table className="pharmacy-table">
              <thead>
                <tr>
                  <th>{t('pharmacy.inventory.medicationLabel')}</th>
                  <th>{t('pharmacy.alerts.inStock')}</th>
                  <th>{t('pharmacy.alerts.reorderPoint')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {running.map(l => (
                  <tr key={l.med_id}>
                    <td>{l.med_name} {l.strength ? `(${l.strength})` : ''}</td>
                    <td><span className="pharm-badge low">{l.current_stock}</span></td>
                    <td>{l.reorder_point ?? l.min_stock_level ?? 0}</td>
                    <td>
                      {onReorder && (
                        <button type="button" className="btn-small btn-primary" onClick={() => onReorder(l.med_id)}>
                          🔄 {t('pharmacy.alerts.reorder')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
