import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import client from '../../services/api/client'
import { useSettings } from '../../context/SettingsContext'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import StockAdjustmentModal from './StockAdjustmentModal'
import ReorderRequestModal from './ReorderRequestModal'
import { totalStockByMedication, isLowStock as isLowStockRow } from '../../utils/pharmacyStock'

interface InventoryItem {
  id: string
  med_id: string
  med_name: string
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
  reorder_point: number
  days_until_expiry: number | null
}

interface Medication { id: string; name: string; generic_name: string; form: string; strength: string; unit: string }
interface Supplier { id: string; name: string; is_approved: boolean }

interface Props {
  pharmacyId: string
  networkId: string
  onRefresh?: () => void
}

interface AddStockForm {
  med_id: string
  batch_number: string
  quantity: number
  unit: string
  expiry_date: string
  received_from: string
  location_code: string
}

const emptyAddForm = (): AddStockForm => ({
  med_id: '', batch_number: '', quantity: 1, unit: 'unit',
  expiry_date: '', received_from: '', location_code: ''
})

export default function PharmacyInventory({ pharmacyId, networkId, onRefresh }: Props) {
  const { t } = useTranslation()
  const { formatCurrency, formatDate } = useSettings()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [filtered, setFiltered] = useState<InventoryItem[]>([])
  const [medications, setMedications] = useState<Medication[]>([])
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [adjustTarget, setAdjustTarget] = useState<InventoryItem | null>(null)
  const [reorderTarget, setReorderTarget] = useState<InventoryItem | null>(null)
  const [showAddStock, setShowAddStock] = useState(false)
  const [addForm, setAddForm] = useState<AddStockForm>(emptyAddForm())
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')

  const load = useCallback(async () => {
    try {
      const [invRes, medRes, suppRes] = await Promise.all([
        client.get(`/pharmacies/${pharmacyId}/inventory`),
        client.get(`/networks/${networkId}/medications`),
        client.get(`/networks/${networkId}/suppliers`),
      ])
      setItems(Array.isArray(invRes.data) ? invRes.data : [])
      setMedications(Array.isArray(medRes.data) ? medRes.data : [])
      setSuppliers((Array.isArray(suppRes.data) ? suppRes.data : []).filter((s: Supplier) => s.is_approved !== false))
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [pharmacyId, networkId, t])

  useEffect(() => { load() }, [load])
  useAutoRefresh('pharmacy-inventory', load, 30000)

  // Low stock is measured per MEDICATION across all its batches, not per batch —
  // see utils/pharmacyStock.ts for why and for the matching backend query.
  const stockByMed = useMemo(() => totalStockByMedication(items), [items])
  const isLowStock = useCallback(
    (item: InventoryItem) => isLowStockRow(item, stockByMed),
    [stockByMed]
  )

  useEffect(() => {
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    let result = items
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(i =>
        (i.med_name || '').toLowerCase().includes(q) ||
        (i.batch_number || '').toLowerCase().includes(q) ||
        (i.generic_name || '').toLowerCase().includes(q)
      )
    }
    // Low stock is a property of the MEDICATION, not of one batch. Comparing a
    // single batch's quantity against the medication-level reorder point (as this
    // did) flags every batch of a well-stocked medication: 5 batches x 10 units
    // against a reorder point of 20 reported 5 shortages on 50 units in hand.
    // The backend's low-stock-alerts route is the reference for this — it does
    // `GROUP BY pm.id HAVING SUM(pi.quantity) <= pm.reorder_point`. Mirror it.
    if (filterMode === 'low') result = result.filter(isLowStock)
    if (filterMode === 'expiring') result = result.filter(i => {
      const exp = new Date(i.expiry_date)
      return exp <= in30Days && exp >= now
    })
    if (filterMode === 'expired') result = result.filter(i => new Date(i.expiry_date) < now)
    setFiltered(result)
  }, [items, search, filterMode, isLowStock])

  const getStockClass = (item: InventoryItem) => {
    const now = new Date()
    const exp = item.expiry_date ? new Date(item.expiry_date) : null
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    if (exp && exp < now) return 'stock-expired'
    if (exp && exp < in30) return 'stock-expiring'
    if (isLowStock(item)) return 'stock-low'
    return 'stock-ok'
  }

  const getStockBadge = (item: InventoryItem) => {
    const now = new Date()
    const exp = item.expiry_date ? new Date(item.expiry_date) : null
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    if (exp && exp < now) return <span className="pharm-badge expired">{t('pharmacy.stock.expired')}</span>
    if (exp && exp < in30) return <span className="pharm-badge expiring">{t('pharmacy.stock.expiring')}</span>
    if (isLowStock(item)) return <span className="pharm-badge low">{t('pharmacy.stock.low')}</span>
    return <span className="pharm-badge ok">{t('pharmacy.stock.ok')}</span>
  }

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addForm.med_id) { setAddError(t('pharmacy.inventory.medRequired')); return }
    if (addForm.quantity <= 0) { setAddError(t('pharmacy.inventory.qtyPositive')); return }
    setAddSaving(true)
    setAddError('')
    try {
      const selectedMed = medications.find(m => m.id === addForm.med_id)
      await client.post(`/pharmacies/${pharmacyId}/inventory`, {
        ...addForm,
        unit: addForm.unit || selectedMed?.unit || 'unit',
        quantity: parseInt(String(addForm.quantity)),
      })
      setShowAddStock(false)
      setAddForm(emptyAddForm())
      load()
      onRefresh?.()
    } catch (err: any) {
      setAddError(err?.response?.data?.message || err?.response?.data?.error || err.message || t('common.error'))
    } finally {
      setAddSaving(false)
    }
  }

  const lowStockCount = items.filter(i => i.quantity <= (i.reorder_point || i.min_stock_level)).length
  const expiringCount = items.filter(i => {
    const exp = i.expiry_date ? new Date(i.expiry_date) : null
    const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    return exp && exp <= in30 && exp >= new Date()
  }).length

  return (
    <div>
      {/* Alert bar */}
      {(lowStockCount > 0 || expiringCount > 0) && (
        <div className="si-51ef6b7c">
          {lowStockCount > 0 && (
            <div className="si-68d88ade">
              ⚠️ {lowStockCount} {t('pharmacy.inventory.lowStockAlert')}
              <button type="button" className="si-288ba992" onClick={() => setFilterMode('low')}>
                {t('pharmacy.filter.show')} →
              </button>
            </div>
          )}
          {expiringCount > 0 && (
            <div className="si-c9f0d294">
              ⏰ {expiringCount} {t('pharmacy.inventory.expiringAlert')}
              <button type="button" className="si-edc371b0" onClick={() => setFilterMode('expiring')}>
                {t('pharmacy.filter.show')} →
              </button>
            </div>
          )}
        </div>
      )}

      <div className="pharmacy-card">
        <div className="pharmacy-card-header">
          <h3>📦 {t('pharmacy.inventory.title')}</h3>
          <button type="button" className="module-btn primary small" onClick={() => { setAddForm(emptyAddForm()); setAddError(''); setShowAddStock(true) }}>
            + {t('pharmacy.inventory.addStock')}
          </button>
        </div>

        {error && <div className="pharm-error">⚠️ {error} <button type="button" onClick={() => setError('')} className="si-540cb98a">✕</button></div>}

        <div className="pharmacy-filter-bar">
          <input
            className="pharmacy-search"
            placeholder={t('pharmacy.inventory.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="pharmacy-select" value={filterMode} onChange={e => setFilterMode(e.target.value)}>
            <option value="all">{t('pharmacy.filter.all')}</option>
            <option value="low">{t('pharmacy.filter.lowStock')} {lowStockCount > 0 ? `(${lowStockCount})` : ''}</option>
            <option value="expiring">{t('pharmacy.filter.expiringSoon')} {expiringCount > 0 ? `(${expiringCount})` : ''}</option>
            <option value="expired">{t('pharmacy.filter.expired')}</option>
          </select>
          {filterMode !== 'all' && (
            <button type="button" className="module-btn small" onClick={() => setFilterMode('all')}>
              ✕ {t('pharmacy.filter.clear')}
            </button>
          )}
        </div>

        {loading ? (
          <p className="si-43f86130">{t('common.loading')}</p>
        ) : filtered.length === 0 ? (
          <div className="pharmacy-empty">
            <div className="empty-icon">📦</div>
            <p>{items.length === 0 ? t('pharmacy.inventory.empty') : t('pharmacy.inventory.noResults')}</p>
            {items.length === 0 && (
              <button type="button" className="module-btn primary si-66faea9d" onClick={() => { setAddForm(emptyAddForm()); setShowAddStock(true) }}>
                + {t('pharmacy.inventory.addFirst')}
              </button>
            )}
          </div>
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
                      <strong>{item.med_name}</strong>
                      <br />
                      <small className="si-40d2db53">
                        {[item.generic_name, item.form, item.strength].filter(Boolean).join(' · ')}
                      </small>
                    </td>
                    <td className="si-e04e9204">{item.batch_number || '—'}</td>
                    <td className={getStockClass(item)}>
                      <strong>{item.quantity}</strong> {item.unit}
                    </td>
                    <td className="si-d5d2428b">{item.min_stock_level} {item.unit}</td>
                    <td className={getStockClass(item)}>
                      {item.expiry_date ? formatDate(item.expiry_date) : '—'}
                      {item.days_until_expiry !== null && item.days_until_expiry <= 30 && item.days_until_expiry >= 0 && (
                        <small className="si-3b0e4dc4">({item.days_until_expiry}d left)</small>
                      )}
                    </td>
                    <td>{formatCurrency(item.unit_cost)}</td>
                    <td>{getStockBadge(item)}</td>
                    <td>
                      <div className="si-50c82988">
                        <button type="button" className="module-btn small" onClick={() => setAdjustTarget(item)}>
                          {t('pharmacy.actions.adjust')}
                        </button>
                        <button type="button" className="module-btn small" onClick={() => setReorderTarget(item)}>
                          {t('pharmacy.actions.reorder')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="si-cbaeeb44">
              {t('pharmacy.inventory.showing', { count: filtered.length, total: items.length })}
            </div>
          </div>
        )}
      </div>

      {/* Add Stock Modal */}
      {showAddStock && (
        <div className="pharm-modal-overlay" onClick={() => setShowAddStock(false)}>
          <div className="pharm-modal si-11bb4061" onClick={e => e.stopPropagation()}>
            <div className="pharm-modal-header">
              <h2>📦 {t('pharmacy.inventory.addStockTitle')}</h2>
              <button type="button" className="pharm-modal-close" onClick={() => setShowAddStock(false)}>✕</button>
            </div>
            {addError && <div className="pharm-error">⚠️ {addError}</div>}
            {medications.length === 0 ? (
              <div className="pharmacy-empty si-8a6436c0">
                <p>{t('pharmacy.inventory.noCatalogMeds')}</p>
                <small className="si-40d2db53">{t('pharmacy.inventory.goToCatalogHint')}</small>
              </div>
            ) : (
              <form onSubmit={handleAddStock}>
                <div className="pharm-form-group">
                  <label>{t('pharmacy.inventory.medicationLabel')} <span className="req-star">*</span></label>
                  <select value={addForm.med_id} onChange={e => {
                    const med = medications.find(m => m.id === e.target.value)
                    setAddForm(f => ({ ...f, med_id: e.target.value, unit: med?.unit || 'unit' }))
                  }}>
                    <option value="">{t('pharmacy.inventory.selectMedication')}</option>
                    {medications.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.strength ? `(${m.strength})` : ''} — {m.form}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="pharm-form-row">
                  <div className="pharm-form-group">
                    <label>{t('pharmacy.inventory.batchNumber')}</label>
                    <input value={addForm.batch_number} onChange={e => setAddForm(f => ({ ...f, batch_number: e.target.value }))}
                      placeholder="e.g. BATCH2026001" />
                  </div>
                  <div className="pharm-form-group">
                    <label>{t('pharmacy.inventory.quantity')} <span className="req-star">*</span></label>
                    <input type="number" min="1" value={addForm.quantity}
                      onChange={e => setAddForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} />
                  </div>
                </div>
                <div className="pharm-form-row">
                  <div className="pharm-form-group">
                    <label>{t('pharmacy.inventory.expiryDate')}</label>
                    <input type="date" value={addForm.expiry_date} onChange={e => setAddForm(f => ({ ...f, expiry_date: e.target.value }))} />
                  </div>
                  <div className="pharm-form-group">
                    <label>{t('pharmacy.inventory.locationCode')}</label>
                    <input value={addForm.location_code} onChange={e => setAddForm(f => ({ ...f, location_code: e.target.value }))}
                      placeholder="e.g. SHELF-A1" />
                  </div>
                </div>
                <div className="pharm-form-group">
                  <label>{t('pharmacy.inventory.receivedFrom')}</label>
                  {suppliers.length > 0 ? (
                    <select
                      value={addForm.received_from}
                      onChange={e => setAddForm(f => ({ ...f, received_from: e.target.value }))}
                    >
                      <option value="">{t('pharmacy.inventory.selectSupplier')}</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="si-6651dbab">
                      ⚠️ {t('pharmacy.inventory.noSuppliersHint')}
                    </div>
                  )}
                </div>
                <p className="req-legend">* {t('common.requiredField')}</p>
                <div className="pharm-modal-actions">
                  <button type="button" className="module-btn" onClick={() => setShowAddStock(false)}>{t('common.cancel')}</button>
                  <button type="submit" className="module-btn primary" disabled={addSaving || !addForm.med_id}>
                    {addSaving ? `⏳ ${t('common.saving')}` : `📦 ${t('pharmacy.inventory.addStockBtn')}`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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
