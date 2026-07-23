import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import client from '../../services/api/client'
import { useSettings } from '../../context/SettingsContext'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import DispensingReceiptView, { DispensingReceiptData } from '../../components/pharmacy/DispensingReceiptView'

interface DispensingRecord {
  id: string
  prescription_id: string
  pharmacist_name: string
  owner_name: string
  animal_name: string
  animal_species: string
  vet_name: string
  dispensing_method: string
  dispensing_status: string
  total_cost: number
  received_by: string
  notes: string
  created_at: string
  handed_over_at: string | null
  prescription_medications: any
  pharmacy_name: string
  pharmacy_address: string
  pharmacy_phone: string
  line_items: { name: string; quantity: number; unit: string; unitPrice: number; lineTotal: number; batchNumber: string }[] | null
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
  const [receipt, setReceipt] = useState<DispensingReceiptData | null>(null)

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

  const openReceipt = (r: DispensingRecord) => {
    setReceipt({
      dispensingId: r.id,
      createdAt: r.created_at,
      dispensingMethod: r.dispensing_method,
      pharmacyName: r.pharmacy_name,
      pharmacyAddress: r.pharmacy_address,
      pharmacyPhone: r.pharmacy_phone,
      animalName: r.animal_name,
      animalSpecies: r.animal_species,
      ownerName: r.owner_name,
      vetName: r.vet_name,
      pharmacistName: r.pharmacist_name,
      lineItems: (r.line_items || []).map(li => ({
        name: li.name, quantity: li.quantity, unit: li.unit, unitPrice: li.unitPrice, lineTotal: li.lineTotal, batchNumber: li.batchNumber,
      })),
      totalCost: r.total_cost,
    })
  }

  return (
    <div>
      <div className="pharmacy-card">
        <div className="pharmacy-card-header">
          <h3>📜 {t('pharmacy.history.title')}</h3>
        </div>

        {error && <div className="pharm-error">⚠️ {error} <button type="button" onClick={() => setError('')} className="si-540cb98a">✕</button></div>}

        <div className="pharmacy-filter-bar">
          <select className="pharmacy-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">{t('pharmacy.filter.all')}</option>
            <option value="pending">{t('pharmacy.history.status.pending')}</option>
            <option value="prepared">{t('pharmacy.history.status.prepared')}</option>
            <option value="handed_over">{t('pharmacy.history.status.handed_over')}</option>
            <option value="delivered">{t('pharmacy.history.status.delivered')}</option>
            <option value="cancelled">{t('pharmacy.history.status.cancelled')}</option>
          </select>
          <span className="si-22cd98cf">{filtered.length} {t('pharmacy.history.records')}</span>
        </div>

        {loading ? (
          <p className="si-43f86130">{t('common.loading')}</p>
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
                        {r.animal_species && <small className="si-1a0c0bfa">{r.animal_species}</small>}
                        <small className="si-40d2db53">👤 {r.owner_name || '—'}</small>
                      </td>
                      <td className="si-d83d7d70">
                        <span className="si-315ca681">{parseMedNames(r.prescription_medications)}</span>
                      </td>
                      <td className="si-86931177">
                        {formatDate(r.created_at)}
                        {r.handed_over_at && (
                          <small className="si-1a0c0bfa">
                            Handed: {formatDate(r.handed_over_at)}
                          </small>
                        )}
                      </td>
                      <td className="si-ba472c26">
                        {icon} <span className="si-033883f7">
                          {(r.dispensing_method || '').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <span className="pharm-badge" style={{ background: colors.bg, color: colors.color }}>
                          {t(`pharmacy.history.status.${r.dispensing_status}`) || r.dispensing_status}
                        </span>
                      </td>
                      <td className="si-e9da3a87">
                        {formatCurrency(r.total_cost)}
                      </td>
                      <td className="si-f2dbbee4">
                        {r.pharmacist_name || '—'}
                        {r.received_by && <small className="si-1a0c0bfa">Rcvd by: {r.received_by}</small>}
                      </td>
                      <td>
                        <div className="si-8aa04a6d">
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
                          {r.dispensing_status !== 'cancelled' && (
                            <button type="button" className="module-btn small" onClick={() => openReceipt(r)}>
                              🖨 {t('pharmacyReceipt.print')}
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
      {receipt && <DispensingReceiptView receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  )
}
