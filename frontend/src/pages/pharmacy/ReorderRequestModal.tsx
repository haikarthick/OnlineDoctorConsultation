import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import client from '../../services/api/client'
import { useSettings } from '../../context/SettingsContext'

interface InventoryItem {
  id: string
  med_id: string
  medication_name?: string
  med_name?: string
  quantity: number
  unit: string
  min_stock_level: number
}

interface Supplier {
  id: string
  name: string
}

interface Props {
  pharmacyId: string
  networkId: string
  item: InventoryItem
  onClose: () => void
  onDone: () => void
}

export default function ReorderRequestModal({ pharmacyId, networkId, item, onClose, onDone }: Props) {
  const { t } = useTranslation()
  useSettings() // load settings context for currency consistency
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [form, setForm] = useState({
    supplier_id: '',
    requested_qty: Math.max(item.min_stock_level - item.quantity, 10),
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    client.get(`/networks/${networkId}/suppliers`).then(res => {
      setSuppliers(res.data || [])
      if (res.data?.length > 0) setForm(f => ({ ...f, supplier_id: res.data[0].id }))
    }).catch(() => {})
  }, [networkId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.supplier_id) { setError(t('pharmacy.reorder.supplierRequired')); return }
    if (form.requested_qty <= 0) { setError(t('pharmacy.reorder.qtyPositive')); return }
    setSaving(true)
    setError('')
    try {
      await client.post(`/pharmacies/${pharmacyId}/reorders`, {
        med_id: item.med_id,
        supplier_id: form.supplier_id,
        requested_qty: form.requested_qty,
        notes: form.notes,
        triggered_by: 'manual',
      })
      onDone()
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pharm-modal-overlay" onClick={onClose}>
      <div className="pharm-modal" onClick={e => e.stopPropagation()}>
        <div className="pharm-modal-header">
          <h2>🔄 {t('pharmacy.reorder.title')}</h2>
          <button className="pharm-modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ background: '#f5f7fa', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: '0.88rem' }}>
          <strong>{item.medication_name || item.med_name}</strong>
          <br />
          <span style={{ color: '#666' }}>{t('pharmacy.stock.currentQty')}: {item.quantity} {item.unit} · {t('pharmacy.table.minStock')}: {item.min_stock_level}</span>
        </div>

        {error && <div className="pharm-error">⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="pharm-form-group">
            <label>{t('pharmacy.reorder.supplier')} <span className="req-star">*</span></label>
            <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
              <option value="">{t('pharmacy.reorder.selectSupplier')}</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {!form.supplier_id && (
              <small style={{ color: '#e65100' }}>⚠️ {t('pharmacy.reorder.supplierRequired')}</small>
            )}
          </div>
          <div className="pharm-form-group">
            <label>{t('pharmacy.reorder.quantity')} <span className="req-star">*</span></label>
            <input type="number" min="1" value={form.requested_qty} onChange={e => setForm(f => ({ ...f, requested_qty: parseInt(e.target.value) || 1 }))} />
          </div>
          <div className="pharm-form-group">
            <label>{t('pharmacy.reorder.notes')}</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('pharmacy.reorder.notesPlaceholder')} />
          </div>
          <p className="req-legend">* {t('common.requiredField')}</p>
          <div className="pharm-modal-actions">
            <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="module-btn primary" disabled={saving || !form.supplier_id}>
              {saving ? `⏳ ${t('common.saving')}` : t('pharmacy.reorder.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
