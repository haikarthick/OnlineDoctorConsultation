import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'

interface Prescription {
  id: string
  pet_name: string
  owner_name: string
  medication_names: string
}

interface Props {
  prescription: Prescription
  pharmacyId: string
  onClose: () => void
  onDone: () => void
}

const METHODS = ['walk_in_pickup', 'home_delivery', 'courier', 'hospital_pickup'] as const

export default function DispensingModal({ prescription, pharmacyId, onClose, onDone }: Props) {
  const { t } = useTranslation()
  const [method, setMethod] = useState<typeof METHODS[number]>('walk_in_pickup')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await axios.post('/api/v1/dispensing', {
        prescription_id: prescription.id,
        pharmacy_id: pharmacyId,
        dispensing_method: method,
        notes,
        line_items: []
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
          <h2>💊 {t('pharmacy.dispense.title')}</h2>
          <button className="pharm-modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ background: '#f5f7fa', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: '0.88rem' }}>
          <strong>{prescription.pet_name}</strong> · {prescription.owner_name}
          <br />
          <span style={{ color: '#444', marginTop: 4, display: 'block' }}>{prescription.medication_names}</span>
        </div>

        {error && <div className="pharm-error">⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="pharm-form-group">
            <label>{t('pharmacy.dispense.method')} <span className="req-star">*</span></label>
            <select value={method} onChange={e => setMethod(e.target.value as any)}>
              {METHODS.map(m => (
                <option key={m} value={m}>{t(`pharmacy.dispense.methods.${m}`)}</option>
              ))}
            </select>
          </div>
          <div className="pharm-form-group">
            <label>{t('pharmacy.dispense.notes')}</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('pharmacy.dispense.notesPlaceholder')} />
          </div>
          <p className="req-legend">* {t('common.requiredField')}</p>
          <div className="pharm-modal-actions">
            <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="module-btn primary" disabled={saving}>
              {saving ? `⏳ ${t('common.saving')}` : t('pharmacy.dispense.confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
