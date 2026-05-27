import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'

interface Prescription {
  id: string
  pet_name: string
  owner_name: string
  vet_name: string
  medication_names: string
  created_at: string
  review_status: string
}

interface Props {
  prescription: Prescription
  pharmacyId: string
  onClose: () => void
  onDone: () => void
}

export default function PrescriptionReviewModal({ prescription, pharmacyId, onClose, onDone }: Props) {
  const { t } = useTranslation()
  const [checks, setChecks] = useState({
    dosage_ok: false,
    allergy_ok: false,
    interaction_ok: false,
    stock_ok: false
  })
  const [decision, setDecision] = useState<'approved' | 'rejected' | 'needs_clarification'>('approved')
  const [notes, setNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = checks.dosage_ok && checks.allergy_ok && checks.interaction_ok && checks.stock_ok

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit && decision !== 'rejected' && decision !== 'needs_clarification') {
      setError(t('pharmacy.review.completeChecksFirst'))
      return
    }
    setSaving(true)
    setError('')
    try {
      await axios.post(`/api/v1/prescriptions/${prescription.id}/review`, {
        pharmacy_id: pharmacyId,
        review_status: decision,
        validation_checks: checks,
        review_notes: notes,
        rejection_reason: decision === 'rejected' ? rejectionReason : undefined,
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
          <h2>🔍 {t('pharmacy.review.title')}</h2>
          <button className="pharm-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Prescription summary */}
        <div style={{ background: '#f5f7fa', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: '0.88rem' }}>
          <strong>{prescription.pet_name}</strong> · {prescription.owner_name}
          <br />
          <span style={{ color: '#666' }}>{t('pharmacy.table.vet')}: {prescription.vet_name}</span>
          <br />
          <span style={{ color: '#444', marginTop: 4, display: 'block' }}>{prescription.medication_names}</span>
        </div>

        {error && <div className="pharm-error">⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Validation checklist */}
          <div className="pharm-form-group">
            <label>{t('pharmacy.review.validationChecks')} <span className="req-star">*</span></label>
            <div className="validation-checks">
              {(['dosage_ok', 'allergy_ok', 'interaction_ok', 'stock_ok'] as const).map(key => (
                <label key={key} className="check-item" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checks[key]}
                    onChange={e => setChecks(c => ({ ...c, [key]: e.target.checked }))}
                    style={{ width: 'auto', marginRight: 6 }}
                  />
                  <span className={`check-icon ${checks[key] ? 'check-ok' : 'check-fail'}`}>
                    {checks[key] ? '✅' : '⬜'}
                  </span>
                  {t(`pharmacy.review.checks.${key}`)}
                </label>
              ))}
            </div>
          </div>

          <div className="pharm-form-group">
            <label>{t('pharmacy.review.decision')} <span className="req-star">*</span></label>
            <select value={decision} onChange={e => setDecision(e.target.value as any)}>
              <option value="approved">{t('pharmacy.review.approved')}</option>
              <option value="rejected">{t('pharmacy.review.rejected')}</option>
              <option value="needs_clarification">{t('pharmacy.review.needsClarification')}</option>
            </select>
          </div>

          {decision === 'rejected' && (
            <div className="pharm-form-group">
              <label>{t('pharmacy.review.rejectionReason')} <span className="req-star">*</span></label>
              <textarea rows={2} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
            </div>
          )}

          <div className="pharm-form-group">
            <label>{t('pharmacy.review.notes')}</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('pharmacy.review.notesPlaceholder')} />
          </div>

          {!canSubmit && decision === 'approved' && (
            <p style={{ color: '#e65100', fontSize: '0.82rem', marginBottom: 10 }}>
              ⚠️ {t('pharmacy.review.completeChecksFirst')}
            </p>
          )}

          <p className="req-legend">* {t('common.requiredField')}</p>
          <div className="pharm-modal-actions">
            <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="module-btn primary" disabled={saving || (decision === 'approved' && !canSubmit)}>
              {saving ? t('common.saving') : t('pharmacy.review.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
