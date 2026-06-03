import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import client from '../../services/api/client'
import { useSettings } from '../../context/SettingsContext'

interface Medication {
  name: string
  dosage: string
  frequency: string
  duration: string
  route?: string
  instructions?: string
}

interface Prescription {
  id: string
  pet_name: string
  owner_name: string
  vet_name: string
  medication_names: string
  medications?: Medication[] | string
  animal_species?: string
  created_at: string
  review_status: string
}

interface Props {
  prescription: Prescription
  pharmacyId?: string
  onClose: () => void
  onDone: () => void
}

function parseMeds(raw: Medication[] | string | undefined): Medication[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) } catch { return [] }
}

type Decision = 'approved' | 'rejected' | 'needs_clarification'

export default function PrescriptionReviewModal({ prescription, onClose, onDone }: Props) {
  const { t } = useTranslation()
  const { formatDate } = useSettings()
  const [checks, setChecks] = useState({ dosage_ok: false, allergy_ok: false, interaction_ok: false, stock_ok: false })
  const [decision, setDecision] = useState<Decision>('approved')
  const [rejectionReason, setRejectionReason] = useState('')
  const [suggestions, setSuggestions] = useState('')
  const [findings, setFindings] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const meds = parseMeds(prescription.medications)
  const allChecked = checks.dosage_ok && checks.allergy_ok && checks.interaction_ok && checks.stock_ok
  const canSubmit = decision === 'rejected'
    ? rejectionReason.trim().length > 0
    : decision === 'needs_clarification'
    ? suggestions.trim().length > 0
    : allChecked

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) {
      setError(decision === 'approved' ? t('pharmacy.review.completeChecksFirst') : t('pharmacy.review.provideReason'))
      return
    }
    setSaving(true)
    setError('')
    try {
      await client.post(`/prescriptions/${prescription.id}/review`, {
        review_status: decision,
        validation_checks: checks,
        findings: findings || null,
        rejection_reason: decision === 'rejected' ? rejectionReason : null,
        suggested_modifications: decision === 'needs_clarification' ? suggestions : null,
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
      <div className="pharm-modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <div className="pharm-modal-header">
          <h2>🔍 {t('pharmacy.review.title')}</h2>
          <button type="button" className="pharm-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Patient summary */}
        <div style={{ background: '#f0f4ff', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong>🐾 {prescription.pet_name}</strong>
              {prescription.animal_species && <span style={{ color: '#666', marginLeft: 6 }}>({prescription.animal_species})</span>}
              <br />
              <span style={{ color: '#555', fontSize: '0.87rem' }}>👤 {prescription.owner_name}</span>
              {prescription.vet_name && (
                <span style={{ color: '#555', fontSize: '0.87rem', marginLeft: 12 }}>👨‍⚕️ {prescription.vet_name}</span>
              )}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#888' }}>
              {prescription.created_at && formatDate(prescription.created_at)}
            </div>
          </div>
        </div>

        {/* Medications detail */}
        {meds.length > 0 ? (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontWeight: 600, fontSize: '0.87rem', color: '#444', marginBottom: 8 }}>💊 {t('pharmacy.review.prescribedMedications')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {meds.map((med, i) => (
                <div key={i} style={{ background: '#fafafa', border: '1px solid #e0e0e0', borderRadius: 8, padding: '10px 14px', fontSize: '0.87rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                    <strong style={{ color: '#1a237e' }}>{med.name}</strong>
                    <span style={{ fontSize: '0.78rem', background: '#e8eaf6', color: '#3949ab', borderRadius: 4, padding: '1px 8px' }}>
                      {med.dosage}
                    </span>
                  </div>
                  <div style={{ color: '#555', marginTop: 3, fontSize: '0.83rem' }}>
                    {[med.frequency, med.duration, med.route].filter(Boolean).join(' · ')}
                  </div>
                  {med.instructions && (
                    <div style={{ color: '#666', fontSize: '0.8rem', marginTop: 3, fontStyle: 'italic' }}>
                      {med.instructions}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : prescription.medication_names ? (
          <div style={{ background: '#fafafa', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.87rem' }}>
            <strong>💊 </strong>{prescription.medication_names}
          </div>
        ) : null}

        {error && <div className="pharm-error">⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Validation checklist */}
          <div className="pharm-form-group">
            <label>{t('pharmacy.review.validationChecks')} <span className="req-star">*</span></label>
            <div className="validation-checks">
              {(['dosage_ok', 'allergy_ok', 'interaction_ok', 'stock_ok'] as const).map(key => (
                <label key={key} className="check-item" style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={checks[key]}
                    onChange={e => setChecks(c => ({ ...c, [key]: e.target.checked }))}
                    style={{ width: 'auto', marginRight: 0 }}
                  />
                  <span className={`check-icon ${checks[key] ? 'check-ok' : 'check-fail'}`}>
                    {checks[key] ? '✅' : '⬜'}
                  </span>
                  <div>
                    <strong>{t(`pharmacy.review.checks.${key}`)}</strong>
                    <small style={{ display: 'block', color: '#888', fontWeight: 400 }}>
                      {t(`pharmacy.review.checksNote.${key}`)}
                    </small>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Decision */}
          <div className="pharm-form-group">
            <label>{t('pharmacy.review.decision')} <span className="req-star">*</span></label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {(['approved', 'rejected', 'needs_clarification'] as Decision[]).map(d => (
                <label key={d} style={{
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1, minWidth: 140,
                  border: `2px solid ${decision === d
                    ? d === 'approved' ? '#4caf50' : d === 'rejected' ? '#f44336' : '#ff9800'
                    : '#e0e0e0'}`,
                  borderRadius: 8, padding: '10px 14px',
                  background: decision === d
                    ? d === 'approved' ? '#f1f8e9' : d === 'rejected' ? '#ffebee' : '#fff8e1'
                    : '#fff',
                  fontWeight: decision === d ? 700 : 400,
                  userSelect: 'none',
                }}>
                  <input type="radio" name="decision" value={d} checked={decision === d}
                    onChange={() => setDecision(d)} style={{ width: 'auto' }} />
                  {d === 'approved' ? '✅' : d === 'rejected' ? '❌' : '❓'}
                  {' '}{t(`pharmacy.review.${d}`)}
                </label>
              ))}
            </div>
          </div>

          {/* Conditional fields */}
          {decision === 'rejected' && (
            <div className="pharm-form-group">
              <label>{t('pharmacy.review.rejectionReason')} <span className="req-star">*</span></label>
              <textarea rows={2} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                placeholder={t('pharmacy.review.rejectionReasonPlaceholder')} />
            </div>
          )}
          {decision === 'needs_clarification' && (
            <div className="pharm-form-group">
              <label>{t('pharmacy.review.suggestedModifications')} <span className="req-star">*</span></label>
              <textarea rows={2} value={suggestions} onChange={e => setSuggestions(e.target.value)}
                placeholder={t('pharmacy.review.suggestionsPlaceholder')} />
            </div>
          )}
          {decision === 'approved' && (
            <div className="pharm-form-group">
              <label>{t('pharmacy.review.findings')}</label>
              <textarea rows={2} value={findings} onChange={e => setFindings(e.target.value)}
                placeholder={t('pharmacy.review.findingsPlaceholder')} />
            </div>
          )}

          {/* Submit blocker hints */}
          {decision === 'approved' && !allChecked && (
            <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', color: '#f57f17', marginBottom: 12 }}>
              ⚠️ {t('pharmacy.review.completeChecksFirst')}
            </div>
          )}

          <p className="req-legend">* {t('common.requiredField')}</p>
          <div className="pharm-modal-actions">
            <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="module-btn primary" disabled={saving || !canSubmit}
              title={!canSubmit ? (decision === 'approved' ? t('pharmacy.review.completeChecksFirst') : t('pharmacy.review.provideReason')) : ''}>
              {saving ? `⏳ ${t('common.saving')}` : t('pharmacy.review.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
