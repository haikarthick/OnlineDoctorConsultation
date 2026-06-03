import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import client from '../../services/api/client'
import { useSettings } from '../../context/SettingsContext'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

interface DispensingRecord {
  id: string
  prescription_id: string
  pharmacist_name: string
  owner_name: string
  animal_name: string
  animal_species: string
  dispensing_method: string
  dispensing_status: string
  total_cost: number
  received_by: string
  notes: string
  created_at: string
  handed_over_at: string | null
  prescription_medications: any
}

interface Props {
  pharmacyId: string
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:      { bg: '#fff3e0', color: '#e65100' },
  prepared:     { bg: '#e8eaf6', color: '#3949ab' },
  handed_over:  { bg: '#e8f5e9', color: '#2e7d32' },
  delivered:    { bg: '#e3f2fd', color: '#1565c0' },
  cancelled:    { bg: '#ffebee', color: '#c62828' },
}

const METHOD_ICONS: Record<string, string> = {
  walk_in_pickup:  '🚶',
  home_delivery:   '🏠',
  courier:         '📦',
  hospital_pickup: '🏥',
}

export default function DispensingHistory({ pharmacyId }: Props) {
  const { t } = useTranslation()
  const { formatCurrency, formatDate } = useSettings()
  const [records, setRecords] = useState<DispensingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await client.get(`/pharmacies/${pharmacyId}/dispensing-history?limit=100`)
      setRecords(Array.isArray(res.data) ? res.data : [])
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [pharmacyId, t])

  useEffect(() => { load() }, [load])
  useAutoRefresh('pharmacy-history', load, 30000)

  const filtered = filterStatus === 'all'
    ? records
    : records.filter(r => r.dispensing_status === filterStatus)

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id)
    try {
      await client.patch(`/dispensing/${id}`, { dispensing_status: status })
      setRecords(prev => prev.map(r => r.id === id ? { ...r, dispensing_status: status } : r))
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message)
    } finally {
      setUpdatingId(null)
    }
  }

  const parseMedNames = (raw: any): string => {
    try {
      const arr = Array.isArray(raw) ? raw : JSON.parse(raw)
      return arr.map((m: any) => m?.name || m).join(', ')
    } catch { return '—' }
  }

  return (
    <div>
      <div className="pharmacy-card">
        <div className="pharmacy-card-header">
          <h3>📜 {t('pharmacy.history.title')}</h3>
        </div>

        {error && <div className="pharm-error">⚠️ {error} <button type="button" onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button></div>}

        <div className="pharmacy-filter-bar">
          <select className="pharmacy-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">{t('pharmacy.filter.all')}</option>
            <option value="pending">{t('pharmacy.history.status.pending')}</option>
            <option value="prepared">{t('pharmacy.history.status.prepared')}</option>
            <option value="handed_over">{t('pharmacy.history.status.handed_over')}</option>
            <option value="delivered">{t('pharmacy.history.status.delivered')}</option>
            <option value="cancelled">{t('pharmacy.history.status.cancelled')}</option>
          </select>
          <span style={{ fontSize: '0.82rem', color: '#888' }}>{filtered.length} {t('pharmacy.history.records')}</span>
        </div>

        {loading ? (
          <p style={{ color: '#888', padding: '20px 0', textAlign: 'center' }}>{t('common.loading')}</p>
        ) : filtered.length === 0 ? (
          <div className="pharmacy-empty">
            <div className="empty-icon">📜</div>
            <p>{t('pharmacy.history.empty')}</p>
          </div>
        ) : (
          <div className="pharmacy-table-wrap">
            <table className="pharmacy-table">
              <thead>
                <tr>
                  <th>{t('pharmacy.table.patient')}</th>
                  <th>{t('pharmacy.table.medications')}</th>
                  <th>{t('pharmacy.table.date')}</th>
                  <th>{t('pharmacy.table.method')}</th>
                  <th>{t('pharmacy.table.status')}</th>
                  <th>{t('pharmacy.table.cost')}</th>
                  <th>{t('pharmacy.table.pharmacist')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const colors = STATUS_COLORS[r.dispensing_status] || { bg: '#f5f5f5', color: '#666' }
                  const icon = METHOD_ICONS[r.dispensing_method] || '💊'
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.animal_name || '—'}</strong>
                        {r.animal_species && <small style={{ color: '#888', display: 'block' }}>{r.animal_species}</small>}
                        <small style={{ color: '#888' }}>👤 {r.owner_name || '—'}</small>
                      </td>
                      <td style={{ maxWidth: 200 }}>
                        <span style={{ fontSize: '0.83rem' }}>{parseMedNames(r.prescription_medications)}</span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                        {formatDate(r.created_at)}
                        {r.handed_over_at && (
                          <small style={{ display: 'block', color: '#888' }}>
                            Handed: {formatDate(r.handed_over_at)}
                          </small>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {icon} <span style={{ fontSize: '0.82rem', textTransform: 'capitalize' }}>
                          {(r.dispensing_method || '').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <span className="pharm-badge" style={{ background: colors.bg, color: colors.color }}>
                          {t(`pharmacy.history.status.${r.dispensing_status}`) || r.dispensing_status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: '#1a237e' }}>
                        {formatCurrency(r.total_cost)}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: '#555' }}>
                        {r.pharmacist_name || '—'}
                        {r.received_by && <small style={{ display: 'block', color: '#888' }}>Rcvd by: {r.received_by}</small>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {r.dispensing_status === 'pending' && (
                            <button type="button" className="module-btn small"
                              disabled={updatingId === r.id}
                              onClick={() => updateStatus(r.id, 'prepared')}>
                              {t('pharmacy.history.markPrepared')}
                            </button>
                          )}
                          {r.dispensing_status === 'prepared' && (
                            <button type="button" className="module-btn small primary"
                              disabled={updatingId === r.id}
                              onClick={() => updateStatus(r.id, 'handed_over')}>
                              {t('pharmacy.history.markHandedOver')}
                            </button>
                          )}
                          {r.dispensing_status === 'handed_over' && r.dispensing_method === 'home_delivery' && (
                            <button type="button" className="module-btn small primary"
                              disabled={updatingId === r.id}
                              onClick={() => updateStatus(r.id, 'delivered')}>
                              {t('pharmacy.history.markDelivered')}
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
    </div>
  )
}
