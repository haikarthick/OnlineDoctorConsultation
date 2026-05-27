import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import StockAdjustmentModal from './StockAdjustmentModal'
import ReorderRequestModal from './ReorderRequestModal'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

interface InventoryItem {
  id: string
  med_id: string
  medication_name: string
  generic_name: string
  form: string
  strength: string
  batch_number: string
  quantity: number
  unit: string
  expiry_date: string
  min_stock_level: number
  selling_price: number
  unit_cost: number
}

interface Props {
  pharmacyId: string
  networkId: string
  onRefresh?: () => void
}

export default function PharmacyInventory({ pharmacyId, networkId, onRefresh }: Props) {
  const { t } = useTranslation()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [filtered, setFiltered] = useState<InventoryItem[]>([])
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adjustTarget, setAdjustTarget] = useState<InventoryItem | null>(null)
  const [reorderTarget, setReorderTarget] = useState<InventoryItem | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`/api/v1/pharmacies/${pharmacyId}/inventory`)
      setItems(res.data || [])
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [pharmacyId, t])

  useEffect(() => { load() }, [load])
  useAutoRefresh('pharmacy-inventory', load, 30000)

  useEffect(() => {
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    let result = items
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(i =>
        i.medication_name?.toLowerCase().includes(q) ||
        i.batch_number?.toLowerCase().includes(q) ||
        i.generic_name?.toLowerCase().includes(q)
      )
    }
    if (filterMode === 'low') result = result.filter(i => i.quantity <= i.min_stock_level)
    if (filterMode === 'expiring') result = result.filter(i => {
      const exp = new Date(i.expiry_date)
      return exp <= in30Days && exp >= now
    })
    if (filterMode === 'expired') result = result.filter(i => new Date(i.expiry_date) < now)
    setFiltered(result)
  }, [items, search, filterMode])

  const getStockClass = (item: InventoryItem) => {
    const now = new Date()
    const exp = new Date(item.expiry_date)
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    if (exp < now) return 'stock-expired'
    if (exp < in30) return 'stock-expiring'
    if (item.quantity <= item.min_stock_level) return 'stock-low'
    return 'stock-ok'
  }

  const getStockBadge = (item: InventoryItem) => {
    const now = new Date()
    const exp = new Date(item.expiry_date)
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    if (exp < now) return <span className="pharm-badge expired">{t('pharmacy.stock.expired')}</span>
    if (exp < in30) return <span className="pharm-badge expiring">{t('pharmacy.stock.expiring')}</span>
    if (item.quantity <= item.min_stock_level) return <span className="pharm-badge low">{t('pharmacy.stock.low')}</span>
    return <span className="pharm-badge ok">{t('pharmacy.stock.ok')}</span>
  }

  return (
    <div>
      <div className="pharmacy-card">
        <div className="pharmacy-card-header">
          <h3>📦 {t('pharmacy.inventory.title')}</h3>
        </div>

        {error && <div className="pharm-error">⚠️ {error}</div>}

        <div className="pharmacy-filter-bar">
          <input
            className="pharmacy-search"
            placeholder={t('pharmacy.inventory.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="pharmacy-select" value={filterMode} onChange={e => setFilterMode(e.target.value)}>
            <option value="all">{t('pharmacy.filter.all')}</option>
            <option value="low">{t('pharmacy.filter.lowStock')}</option>
            <option value="expiring">{t('pharmacy.filter.expiringSoon')}</option>
            <option value="expired">{t('pharmacy.filter.expired')}</option>
          </select>
        </div>

        {loading ? (
          <p style={{ color: '#888' }}>{t('common.loading')}</p>
        ) : filtered.length === 0 ? (
          <div className="pharmacy-empty"><div className="empty-icon">📦</div><p>{t('pharmacy.inventory.empty')}</p></div>
        ) : (
          <div className="pharmacy-table-wrap">
            <table className="pharmacy-table">
              <thead>
                <tr>
                  <th>{t('pharmacy.table.medication')}</th>
                  <th>{t('pharmacy.table.batch')}</th>
                  <th>{t('pharmacy.table.quantity')}</th>
                  <th>{t('pharmacy.table.minStock')}</th>
                  <th>{t('pharmacy.table.expiry')}</th>
                  <th>{t('pharmacy.table.unitCost')}</th>
                  <th>{t('pharmacy.table.status')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.medication_name}</strong>
                      <br />
                      <small style={{ color: '#888' }}>{item.generic_name} · {item.form} {item.strength}</small>
                    </td>
                    <td>{item.batch_number}</td>
                    <td className={getStockClass(item)}>{item.quantity} {item.unit}</td>
                    <td>{item.min_stock_level} {item.unit}</td>
                    <td className={getStockClass(item)}>
                      {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : '—'}
                    </td>
                    <td>₹{item.unit_cost}</td>
                    <td>{getStockBadge(item)}</td>
                    <td>
                      <button className="module-btn small" onClick={() => setAdjustTarget(item)} style={{ marginRight: 6 }}>
                        {t('pharmacy.actions.adjust')}
                      </button>
                      <button className="module-btn small" onClick={() => setReorderTarget(item)}>
                        {t('pharmacy.actions.reorder')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adjustTarget && (
        <StockAdjustmentModal
          pharmacyId={pharmacyId}
          item={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onDone={() => { setAdjustTarget(null); load(); onRefresh?.() }}
        />
      )}
      {reorderTarget && (
        <ReorderRequestModal
          pharmacyId={pharmacyId}
          networkId={networkId}
          item={reorderTarget}
          onClose={() => setReorderTarget(null)}
          onDone={() => { setReorderTarget(null); load(); onRefresh?.() }}
        />
      )}
    </div>
  )
}
