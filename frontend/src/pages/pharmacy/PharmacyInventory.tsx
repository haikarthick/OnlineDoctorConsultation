import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import client from '../../services/api/client'
import { useSettings } from '../../context/SettingsContext'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import StockAdjustmentModal from './StockAdjustmentModal'
import ReorderRequestModal from './ReorderRequestModal'

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
  const [adjustTarget, setAdjustTarget] = useState<InventoryItem | null>(null)
  const [reorderTarget, setReorderTarget] = useState<InventoryItem | null>(null)
  const [showAddStock, setShowAddStock] = useState(false)
  const [addForm, setAddForm] = useState<AddStockForm>(emptyAddForm())
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')

  const load = useCallback(async () => {
    try {
      const [invRes, medRes] = await Promise.all([
        client.get(`/pharmacies/${pharmacyId}/inventory`),
        client.get(`/networks/${networkId}/medications`),
      ])
      setItems(Array.isArray(invRes.data) ? invRes.data : [])
      setMedications(Array.isArray(medRes.data) ? medRes.data : [])
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [pharmacyId, networkId, t])

  useEffect(() => { load() }, [load])
  useAutoRefresh('pharmacy-inventory', load, 30000)

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
    if (filterMode === 'low') result = result.filter(i => i.quantity <= (i.reorder_point || i.min_stock_level))
    if (filterMode === 'expiring') result = result.filter(i => {
      const exp = new Date(i.expiry_date)
      return exp <= in30Days && exp >= now
    })
    if (filterMode === 'expired') result = result.filter(i => new Date(i.expiry_date) < now)
    setFiltered(result)
  }, [items, search, filterMode])

  const getStockClass = (item: InventoryItem) => {
    const now = new Date()
    const exp = item.expiry_date ? new Date(item.expiry_date) : null
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    if (exp && exp < now) return 'stock-expired'
    if (exp && exp < in30) return 'stock-expiring'
    if (item.quantity <= (item.reorder_point || item.min_stock_level)) return 'stock-low'
    return 'stock-ok'
  }

  const getStockBadge = (item: InventoryItem) => {
    const now = new Date()
    const exp = item.expiry_date ? new Date(item.expiry_date) : null
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    if (exp && exp < now) return <span className="pharm-badge expired">{t('pharmacy.stock.expired')}</span>
    if (exp && exp < in30) return <span className="pharm-badge expiring">{t('pharmacy.stock.expiring')}</span>
    if (item.quantity <= (item.reorder_point || item.min_stock_level)) return <span className="pharm-badge low">{t('pharmacy.stock.low')}</span>
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
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {lowStockCount > 0 && (
            <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: '8px 16px', fontSize: '0.85rem', color: '#f57f17', flex: 1, minWidth: 200 }}>
              ⚠️ {lowStockCount} {t('pharmacy.inventory.lowStockAlert')}
              <button type="button" style={{ marginLeft: 8, color: '#e65100', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }} onClick={() => setFilterMode('low')}>
                {t('pharmacy.filter.show')} →
              </button>
            </div>
          )}
          {expiringCount > 0 && (
            <div style={{ background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 8, padding: '8px 16px', fontSize: '0.85rem', color: '#e65100', flex: 1, minWidth: 200 }}>
              ⏰ {expiringCount} {t('pharmacy.inventory.expiringAlert')}
              <button type="button" style={{ marginLeft: 8, color: '#bf360c', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }} onClick={() => setFilterMode('expiring')}>
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

        {error && <div className="pharm-error">⚠️ {error} <button type="button" onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button></div>}

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
          <p style={{ color: '#888', padding: '20px 0', textAlign: 'center' }}>{t('common.loading')}</p>
        ) : filtered.length === 0 ? (
          <div className="pharmacy-empty">
            <div className="empty-icon">📦</div>
            <p>{items.length === 0 ? t('pharmacy.inventory.empty') : t('pharmacy.inventory.noResults')}</p>
            {items.length === 0 && (
              <button type="button" className="module-btn primary" style={{ marginTop: 12 }} onClick={() => { setAddForm(emptyAddForm()); setShowAddStock(true) }}>
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
                      <small style={{ color: '#888' }}>
                        {[item.generic_name, item.form, item.strength].filter(Boolean).join(' · ')}
                      </small>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{item.batch_number || '—'}</td>
                    <td className={getStockClass(item)}>
                      <strong>{item.quantity}</strong> {item.unit}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: '#666' }}>{item.min_stock_level} {item.unit}</td>
                    <td className={getStockClass(item)}>
                      {item.expiry_date ? formatDate(item.expiry_date) : '—'}
                      {item.days_until_expiry !== null && item.days_until_expiry <= 30 && item.days_until_expiry >= 0 && (
                        <small style={{ display: 'block', color: '#e65100' }}>({item.days_until_expiry}d left)</small>
                      )}
                    </td>
                    <td>{formatCurrency(item.unit_cost)}</td>
                    <td>{getStockBadge(item)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
            <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#888', borderTop: '1px solid #f0f0f0' }}>
              {t('pharmacy.inventory.showing', { count: filtered.length, total: items.length })}
            </div>
          </div>
        )}
      </div>

      {/* Add Stock Modal */}
      {showAddStock && (
        <div className="pharm-modal-overlay" onClick={() => setShowAddStock(false)}>
          <div className="pharm-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="pharm-modal-header">
              <h2>📦 {t('pharmacy.inventory.addStockTitle')}</h2>
              <button type="button" className="pharm-modal-close" onClick={() => setShowAddStock(false)}>✕</button>
            </div>
            {addError && <div className="pharm-error">⚠️ {addError}</div>}
            {medications.length === 0 ? (
              <div className="pharmacy-empty" style={{ padding: '20px 0' }}>
                <p>{t('pharmacy.inventory.noCatalogMeds')}</p>
                <small style={{ color: '#888' }}>{t('pharmacy.inventory.goToCatalogHint')}</small>
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
                  <input value={addForm.received_from} onChange={e => setAddForm(f => ({ ...f, received_from: e.target.value }))}
                    placeholder={t('pharmacy.inventory.receivedFromPlaceholder')} />
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
