import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import client from '../../services/api/client'
import { useSettings } from '../../context/SettingsContext'

interface Medication {
  name: string
  dosage: string
  frequency: string
  duration: string
  instructions?: string
}

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
  selling_price: number
  unit_cost: number
  min_stock_level: number
}

interface LineItem {
  med_id: string
  inventory_id: string
  med_name: string
  batch_number: string
  unit: string
  unit_price: number
  quantity_dispensed: number
  quantity_available: number
  line_total: number
  is_partial: boolean
}

interface Prescription {
  id: string
  pet_name: string
  owner_name: string
  medication_names: string
  medications?: Medication[] | string
  vet_name?: string
  animal_species?: string
}

interface Props {
  prescription: Prescription
  pharmacyId: string
  onClose: () => void
  onDone: () => void
}

const METHODS = ['walk_in_pickup', 'home_delivery', 'courier', 'hospital_pickup'] as const

function parseMedications(raw: Medication[] | string | undefined): Medication[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) } catch { return [] }
}

export default function DispensingModal({ prescription, pharmacyId, onClose, onDone }: Props) {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const [method, setMethod] = useState<typeof METHODS[number]>('walk_in_pickup')
  const [notes, setNotes] = useState('')
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [loadingInv, setLoadingInv] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const medications = parseMedications(prescription.medications)

  // Load pharmacy inventory and pre-match medications
  useEffect(() => {
    client.get(`/pharmacies/${pharmacyId}/inventory`)
      .then(res => {
        const inv: InventoryItem[] = res.data || []
        setInventory(inv)
        // Pre-match each prescribed medication to available inventory
        const lines: LineItem[] = medications.map(med => {
          // Find best matching inventory item (by name similarity)
          const match = inv.find(i =>
            i.med_name.toLowerCase().includes(med.name.toLowerCase()) ||
            med.name.toLowerCase().includes(i.med_name.toLowerCase()) ||
            (i.generic_name && i.generic_name.toLowerCase().includes(med.name.toLowerCase()))
          ) || inv[0] // fallback to first item if no match
          if (!match) {
            return {
              med_id: '',
              inventory_id: '',
              med_name: med.name,
              batch_number: '',
              unit: 'unit',
              unit_price: 0,
              quantity_dispensed: 1,
              quantity_available: 0,
              line_total: 0,
              is_partial: false,
            }
          }
          return {
            med_id: match.med_id,
            inventory_id: match.id,
            med_name: match.med_name,
            batch_number: match.batch_number,
            unit: match.unit,
            unit_price: match.selling_price,
            quantity_dispensed: 1,
            quantity_available: match.quantity,
            line_total: match.selling_price,
            is_partial: false,
          }
        })
        setLineItems(lines)
      })
      .catch(() => setError(t('pharmacy.dispense.inventoryLoadError')))
      .finally(() => setLoadingInv(false))
  }, [pharmacyId])

  const updateLine = (idx: number, field: keyof LineItem, value: string | number | boolean) => {
    setLineItems(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const updated = { ...l, [field]: value }
      if (field === 'inventory_id') {
        const inv = inventory.find(item => item.id === value)
        if (inv) {
          updated.med_id = inv.med_id
          updated.med_name = inv.med_name
          updated.batch_number = inv.batch_number
          updated.unit = inv.unit
          updated.unit_price = inv.selling_price
          updated.quantity_available = inv.quantity
          updated.line_total = inv.selling_price * updated.quantity_dispensed
        }
      }
      if (field === 'quantity_dispensed') {
        updated.line_total = updated.unit_price * (value as number)
        updated.is_partial = (value as number) < updated.quantity_available
      }
      if (field === 'unit_price') {
        updated.line_total = (value as number) * updated.quantity_dispensed
      }
      return updated
    }))
  }

  const totalCost = lineItems.reduce((sum, l) => sum + (l.line_total || 0), 0)

  const hasStockWarning = lineItems.some(l => l.inventory_id && l.quantity_dispensed > l.quantity_available)
  const hasUnmatchedItems = lineItems.some(l => !l.inventory_id)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (hasStockWarning) { setError(t('pharmacy.dispense.stockWarningError')); return }
    setSaving(true)
    setError('')
    try {
      await client.post('/dispensing', {
        prescription_id: prescription.id,
        pharmacy_id: pharmacyId,
        dispensing_method: method,
        notes,
        line_items: lineItems.filter(l => l.inventory_id && l.quantity_dispensed > 0).map(l => ({
          med_id: l.med_id,
          inventory_id: l.inventory_id,
          batch_number: l.batch_number,
          quantity_dispensed: l.quantity_dispensed,
          unit: l.unit,
          unit_price: l.unit_price,
          line_total: l.line_total,
        })),
      })
      onDone()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pharm-modal-overlay" onClick={onClose}>
      <div className="pharm-modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <div className="pharm-modal-header">
          <h2>💊 {t('pharmacy.dispense.title')}</h2>
          <button type="button" className="pharm-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Patient summary */}
        <div style={{ background: '#f0f4ff', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.88rem' }}>
          <strong>🐾 {prescription.pet_name}</strong>
          {prescription.animal_species && <span style={{ color: '#666' }}> ({prescription.animal_species})</span>}
          {' · '}<span style={{ color: '#555' }}>👤 {prescription.owner_name}</span>
          {prescription.vet_name && <span style={{ color: '#555' }}> · 👨‍⚕️ {prescription.vet_name}</span>}
        </div>

        {error && <div className="pharm-error">⚠️ {error} <button type="button" onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button></div>}

        {loadingInv ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#888' }}>⏳ {t('pharmacy.dispense.loadingInventory')}</div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Medication line items */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 600, fontSize: '0.88rem', color: '#444', display: 'block', marginBottom: 8 }}>
                {t('pharmacy.dispense.medications')} <span className="req-star">*</span>
              </label>
              {lineItems.length === 0 ? (
                <div className="pharmacy-empty" style={{ padding: '20px 0' }}>
                  <p style={{ fontSize: '0.85rem' }}>{t('pharmacy.dispense.noMedications')}</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {lineItems.map((line, idx) => {
                    const isOverStock = line.inventory_id && line.quantity_dispensed > line.quantity_available
                    return (
                      <div key={idx} style={{
                        border: `1px solid ${isOverStock ? '#f44336' : '#e0e0e0'}`,
                        borderRadius: 8, padding: '12px 14px', background: isOverStock ? '#fff5f5' : '#fafafa'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                          <strong style={{ fontSize: '0.9rem', color: '#1a237e' }}>
                            {medications[idx]?.name || line.med_name}
                          </strong>
                          {medications[idx] && (
                            <span style={{ fontSize: '0.78rem', color: '#666', background: '#e8eaf6', borderRadius: 4, padding: '2px 8px' }}>
                              {medications[idx].dosage} · {medications[idx].frequency}
                              {medications[idx].duration && ` · ${medications[idx].duration}`}
                            </span>
                          )}
                        </div>

                        <div className="pharm-form-row" style={{ gap: 8 }}>
                          {/* Inventory selector */}
                          <div className="pharm-form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.78rem' }}>{t('pharmacy.dispense.inventoryBatch')}</label>
                            <select
                              value={line.inventory_id}
                              onChange={e => updateLine(idx, 'inventory_id', e.target.value)}
                              style={{ fontSize: '0.82rem' }}
                            >
                              <option value="">{t('pharmacy.dispense.selectInventory')}</option>
                              {inventory.map(i => (
                                <option key={i.id} value={i.id}>
                                  {i.med_name} {i.strength} — Batch {i.batch_number} (Qty: {i.quantity})
                                  {i.expiry_date ? ` Exp: ${new Date(i.expiry_date).toLocaleDateString()}` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          {/* Quantity */}
                          <div className="pharm-form-group" style={{ marginBottom: 0, minWidth: 90 }}>
                            <label style={{ fontSize: '0.78rem' }}>{t('pharmacy.dispense.qty')}</label>
                            <input
                              type="number" min="1"
                              max={line.quantity_available || 9999}
                              value={line.quantity_dispensed}
                              onChange={e => updateLine(idx, 'quantity_dispensed', parseInt(e.target.value) || 1)}
                            />
                          </div>
                          {/* Unit price */}
                          <div className="pharm-form-group" style={{ marginBottom: 0, minWidth: 90 }}>
                            <label style={{ fontSize: '0.78rem' }}>{t('pharmacy.dispense.unitPrice')}</label>
                            <input
                              type="number" min="0" step="0.01"
                              value={line.unit_price}
                              onChange={e => updateLine(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          {/* Line total */}
                          <div className="pharm-form-group" style={{ marginBottom: 0, minWidth: 90 }}>
                            <label style={{ fontSize: '0.78rem' }}>{t('pharmacy.dispense.lineTotal')}</label>
                            <div style={{ padding: '9px 12px', background: '#f5f7fa', borderRadius: 8, fontSize: '0.88rem', fontWeight: 600, color: '#1a237e' }}>
                              {formatCurrency(line.line_total)}
                            </div>
                          </div>
                        </div>

                        {line.inventory_id && (
                          <div style={{ marginTop: 6, fontSize: '0.78rem', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <span style={{ color: isOverStock ? '#f44336' : '#388e3c' }}>
                              {isOverStock ? '⚠️' : '✓'} {t('pharmacy.dispense.available')}: {line.quantity_available} {line.unit}
                            </span>
                            {line.batch_number && <span style={{ color: '#888' }}>Batch: {line.batch_number}</span>}
                          </div>
                        )}
                        {!line.inventory_id && (
                          <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#e65100' }}>
                            ⚠️ {t('pharmacy.dispense.selectInventoryWarning')}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Total cost */}
            <div style={{ background: '#e8f5e9', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#2e7d32' }}>💰 {t('pharmacy.dispense.totalCost')}</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1b5e20' }}>{formatCurrency(totalCost)}</span>
            </div>

            {/* Dispensing method */}
            <div className="pharm-form-group">
              <label>{t('pharmacy.dispense.method')} <span className="req-star">*</span></label>
              <select value={method} onChange={e => setMethod(e.target.value as any)}>
                {METHODS.map(m => (
                  <option key={m} value={m}>{t(`pharmacy.dispense.methods.${m}`)}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div className="pharm-form-group">
              <label>{t('pharmacy.dispense.notes')}</label>
              <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={t('pharmacy.dispense.notesPlaceholder')} />
            </div>

            {hasStockWarning && (
              <div className="pharm-error" style={{ marginBottom: 12 }}>
                ⚠️ {t('pharmacy.dispense.stockWarningError')}
              </div>
            )}
            {hasUnmatchedItems && !hasStockWarning && (
              <div style={{ fontSize: '0.82rem', color: '#f57f17', marginBottom: 12 }}>
                ⚠️ {t('pharmacy.dispense.unmatchedWarning')}
              </div>
            )}

            <p className="req-legend">* {t('common.requiredField')}</p>
            <div className="pharm-modal-actions">
              <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
              <button
                type="submit"
                className="module-btn primary"
                disabled={saving || hasStockWarning || lineItems.every(l => !l.inventory_id)}
              >
                {saving ? `⏳ ${t('common.saving')}` : `💊 ${t('pharmacy.dispense.confirm')}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
