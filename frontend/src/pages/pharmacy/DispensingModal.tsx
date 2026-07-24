import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import client from '../../services/api/client'
import { useSettings } from '../../context/SettingsContext'
import { useMasterData } from '../../context/MasterDataContext'
import DispensingReceiptView, { DispensingReceiptData } from '../../components/pharmacy/DispensingReceiptView'
import MedicationLabelPrint, { LabelItem } from '../../components/pharmacy/MedicationLabelPrint'

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
  const { speciesLabel } = useMasterData()
  const [method, setMethod] = useState<typeof METHODS[number]>('walk_in_pickup')
  const [notes, setNotes] = useState('')
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [loadingInv, setLoadingInv] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pharmacyInfo, setPharmacyInfo] = useState<{ pharmacy_name?: string; address?: string; phone?: string }>({})
  const [receipt, setReceipt] = useState<DispensingReceiptData | null>(null)
  const [labelItems, setLabelItems] = useState<LabelItem[] | null>(null)
  const [showLabels, setShowLabels] = useState(false)

  const medications = parseMedications(prescription.medications)

  useEffect(() => {
    client.get(`/pharmacies/${pharmacyId}`).then(res => setPharmacyInfo(res.data || {})).catch(() => {})
  }, [pharmacyId])

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
      const dispensedLines = lineItems.filter(l => l.inventory_id && l.quantity_dispensed > 0)
      const res = await client.post('/dispensing', {
        prescription_id: prescription.id,
        pharmacy_id: pharmacyId,
        dispensing_method: method,
        notes,
        line_items: dispensedLines.map(l => ({
          med_id: l.med_id,
          inventory_id: l.inventory_id,
          batch_number: l.batch_number,
          quantity_dispensed: l.quantity_dispensed,
          unit: l.unit,
          unit_price: l.unit_price,
          line_total: l.line_total,
        })),
      })
      setReceipt({
        dispensingId: res.data?.id || '',
        createdAt: res.data?.created_at || new Date().toISOString(),
        dispensingMethod: method,
        pharmacyName: pharmacyInfo.pharmacy_name,
        pharmacyAddress: pharmacyInfo.address,
        pharmacyPhone: pharmacyInfo.phone,
        animalName: prescription.pet_name,
        animalSpecies: prescription.animal_species,
        ownerName: prescription.owner_name,
        vetName: prescription.vet_name,
        lineItems: dispensedLines.map(l => ({
          name: l.med_name, quantity: l.quantity_dispensed, unit: l.unit,
          unitPrice: l.unit_price, lineTotal: l.line_total, batchNumber: l.batch_number,
        })),
        totalCost,
      })
      setLabelItems(dispensedLines.map((l, idx) => ({
        medicationName: l.med_name,
        directions: medications[idx] ? `${medications[idx].dosage} · ${medications[idx].frequency}${medications[idx].duration ? ' · ' + medications[idx].duration : ''}` : undefined,
        quantity: l.quantity_dispensed,
        unit: l.unit,
      })))
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  if (receipt) {
    return (
      <>
        <DispensingReceiptView
          receipt={receipt}
          onClose={onDone}
          secondaryAction={labelItems && labelItems.length > 0 ? { label: `🏷 ${t('medicationLabel.printLabels')}`, onClick: () => setShowLabels(true) } : undefined}
        />
        {showLabels && labelItems && (
          <MedicationLabelPrint
            pharmacyName={pharmacyInfo.pharmacy_name}
            pharmacyPhone={pharmacyInfo.phone}
            animalName={prescription.pet_name}
            animalSpecies={prescription.animal_species}
            ownerName={prescription.owner_name}
            rxRef={prescription.id}
            items={labelItems}
            onClose={() => setShowLabels(false)}
          />
        )}
      </>
    )
  }

  return (
    <div className="pharm-modal-overlay" onClick={onClose}>
      <div className="pharm-modal si-b86380be" onClick={e => e.stopPropagation()}>
        <div className="pharm-modal-header">
          <h2>💊 {t('pharmacy.dispense.title')}</h2>
          <button type="button" className="pharm-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Patient summary */}
        <div className="si-b11f08cf">
          <strong>🐾 {prescription.pet_name}</strong>
          {prescription.animal_species && <span className="si-50edd4e9"> ({speciesLabel(prescription.animal_species, t)})</span>}
          {' · '}<span className="si-c477d325">👤 {prescription.owner_name}</span>
          {prescription.vet_name && <span className="si-c477d325"> · 👨‍⚕️ {prescription.vet_name}</span>}
        </div>

        {error && <div className="pharm-error">⚠️ {error} <button type="button" onClick={() => setError('')} className="si-540cb98a">✕</button></div>}

        {loadingInv ? (
          <div className="si-fed9d898">⏳ {t('pharmacy.dispense.loadingInventory')}</div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Medication line items */}
            <div className="si-7e63ec4f">
              <label className="si-86032ed0">
                {t('pharmacy.dispense.medications')} <span className="req-star">*</span>
              </label>
              {lineItems.length === 0 ? (
                <div className="pharmacy-empty si-8a6436c0">
                  <p className="si-1a1e3482">{t('pharmacy.dispense.noMedications')}</p>
                </div>
              ) : (
                <div className="si-51b511c9">
                  {lineItems.map((line, idx) => {
                    const isOverStock = line.inventory_id && line.quantity_dispensed > line.quantity_available
                    return (
                      <div key={idx} style={{
                        border: `1px solid ${isOverStock ? '#f44336' : '#e0e0e0'}`,
                        borderRadius: 8, padding: '12px 14px', background: isOverStock ? '#fff5f5' : '#fafafa'
                      }}>
                        <div className="si-fb9d49f5">
                          <strong className="si-d6adcc9a">
                            {medications[idx]?.name || line.med_name}
                          </strong>
                          {medications[idx] && (
                            <span className="si-1c53bdb8">
                              {medications[idx].dosage} · {medications[idx].frequency}
                              {medications[idx].duration && ` · ${medications[idx].duration}`}
                            </span>
                          )}
                        </div>

                        <div className="pharm-form-row si-403e4828">
                          {/* Inventory selector */}
                          <div className="pharm-form-group si-d7d15c11">
                            <label className="si-c384180a">{t('pharmacy.dispense.inventoryBatch')}</label>
                            <select
                              value={line.inventory_id}
                              onChange={e => updateLine(idx, 'inventory_id', e.target.value)}
                              className="si-c5381d69"
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
                          <div className="pharm-form-group si-7120288a">
                            <label className="si-c384180a">{t('pharmacy.dispense.qty')}</label>
                            <input
                              type="number" min="1"
                              max={line.quantity_available || 9999}
                              value={line.quantity_dispensed}
                              onChange={e => updateLine(idx, 'quantity_dispensed', parseInt(e.target.value) || 1)}
                            />
                          </div>
                          {/* Unit price */}
                          <div className="pharm-form-group si-7120288a">
                            <label className="si-c384180a">{t('pharmacy.dispense.unitPrice')}</label>
                            <input
                              type="number" min="0" step="0.01"
                              value={line.unit_price}
                              onChange={e => updateLine(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          {/* Line total */}
                          <div className="pharm-form-group si-7120288a">
                            <label className="si-c384180a">{t('pharmacy.dispense.lineTotal')}</label>
                            <div className="si-5c4cbed7">
                              {formatCurrency(line.line_total)}
                            </div>
                          </div>
                        </div>

                        {line.inventory_id && (
                          <div className="si-bccb4078">
                            <span style={{ color: isOverStock ? '#f44336' : '#388e3c' }}>
                              {isOverStock ? '⚠️' : '✓'} {t('pharmacy.dispense.available')}: {line.quantity_available} {line.unit}
                            </span>
                            {line.batch_number && <span className="si-40d2db53">Batch: {line.batch_number}</span>}
                          </div>
                        )}
                        {!line.inventory_id && (
                          <div className="si-fd56b816">
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
            <div className="si-49750ca1">
              <span className="si-22eb4164">💰 {t('pharmacy.dispense.totalCost')}</span>
              <span className="si-7458a255">{formatCurrency(totalCost)}</span>
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
              <div className="pharm-error si-bab8e8bc">
                ⚠️ {t('pharmacy.dispense.stockWarningError')}
              </div>
            )}
            {hasUnmatchedItems && !hasStockWarning && (
              <div className="si-f7ad46ed">
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
