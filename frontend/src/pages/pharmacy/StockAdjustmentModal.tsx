import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import client from '../../services/api/client'


interface InventoryItem {
  id: string
  med_id: string
  medication_name?: string
  med_name?: string
  batch_number: string
  quantity: number
  unit: string
}

interface Props {
  pharmacyId: string
  item: InventoryItem
  onClose: () => void
  onDone: () => void
}

const TYPES = ['add', 'remove', 'correct', 'expire', 'damage', 'return'] as const

export default function StockAdjustmentModal({ pharmacyId, item, onClose, onDone }: Props) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    adjustment_type: 'add' as typeof TYPES[number],
    adjustment_qty: 1,
    reason: '',
    batch_number: item.batch_number,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.reason.trim()) { setError(t('pharmacy.stock.reasonRequired')); return }
    if (form.adjustment_qty <= 0) { setError(t('pharmacy.stock.qtyPositive')); return }
    setSaving(true)
    setError('')
    try {
      await client.post(`/pharmacies/${pharmacyId}/stock-adjustments`, {
        med_id: item.med_id,
        ...form,
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
          <h2>📦 {t('pharmacy.stock.adjustTitle')}</h2>
          <button className="pharm-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="si-b5128f08">
          <strong>{item.medication_name || item.med_name}</strong> — {t('pharmacy.table.batch')}: {item.batch_number}
          <br />
          <span className="si-50edd4e9">{t('pharmacy.stock.currentQty')}: {item.quantity} {item.unit}</span>
        </div>

        {error && <div className="pharm-error">⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="pharm-form-group">
            <label>{t('pharmacy.stock.adjustmentType')} <span className="req-star">*</span></label>
            <select value={form.adjustment_type} onChange={e => setForm(f => ({ ...f, adjustment_type: e.target.value as any }))}>
              {TYPES.map(typ => (
                <option key={typ} value={typ}>{t(`pharmacy.stock.types.${typ}`)}</option>
              ))}
            </select>
          </div>
          <div className="pharm-form-row">
            <div className="pharm-form-group">
              <label>{t('pharmacy.stock.quantity')} <span className="req-star">*</span></label>
              <input type="number" min="1" value={form.adjustment_qty} onChange={e => setForm(f => ({ ...f, adjustment_qty: parseInt(e.target.value) || 1 }))} />
            </div>
            <div className="pharm-form-group">
              <label>{t('pharmacy.table.batch')}</label>
              <input value={form.batch_number} onChange={e => setForm(f => ({ ...f, batch_number: e.target.value }))} />
            </div>
          </div>
          <div className="pharm-form-group">
            <label>{t('pharmacy.stock.reason')} <span className="req-star">*</span></label>
            <textarea rows={2} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder={t('pharmacy.stock.reasonPlaceholder')} />
          </div>
          <p className="req-legend">* {t('common.requiredField')}</p>
          <div className="pharm-modal-actions">
            <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="module-btn primary" disabled={saving}>
              {saving ? `⏳ ${t('common.saving')}` : t('pharmacy.stock.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
