import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { userMessage } from '../../utils/userMessage'

interface Review {
  id: string
  review_status: 'approved' | 'rejected' | 'needs_clarification'
  pharmacist_name: string
  reviewed_at: string
  rejection_reason?: string | null
  suggested_modifications?: string | null
  findings?: string[] | string | null
}

/**
 * What the pharmacist said about a prescription, for the vet who wrote it: the decision, the reason or the change they ask for,
 * who said it and when. Opens on a tap (phone-friendly - the old hover text never showed on a phone). The vet is also notified when a
 * prescription is rejected or needs clarification; this is where the full words are.
 */
export const PharmacyReviewPanel: React.FC<{ prescriptionId: string }> = ({ prescriptionId }) => {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Review[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (!next || items) return
    setBusy(true); setError('')
    try {
      const res = await apiService.prescriptionReviews(prescriptionId)
      setItems(Array.isArray(res) ? res : (res?.data || []))
    } catch (err) {
      setError(userMessage(err, 'prescriptions.pharmacy.reviewLoadFailed'))
    } finally { setBusy(false) }
  }

  const decision = (s: Review['review_status']) =>
    t(s === 'approved' ? 'prescriptions.pharmacy.decisionApproved' : s === 'rejected' ? 'prescriptions.pharmacy.decisionRejected' : 'prescriptions.pharmacy.decisionClarify')
  const when = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })
  const findings = (f: Review['findings']) => (Array.isArray(f) ? f : f ? [f] : []).filter(Boolean)

  return (
    <div className="rx-review-panel">
      <button type="button" className="btn btn-sm btn-outline" aria-expanded={open} onClick={() => void toggle()}>
        {open ? t('prescriptions.pharmacy.hideReview') : t('prescriptions.pharmacy.seeReview')}
      </button>
      {open && (
        <div className="rx-review-body" role="region" aria-label={t('prescriptions.pharmacy.reviewTitle')}>
          {busy && <p className="rx-review-hint">{t('common.loading')}</p>}
          {error && <p className="rx-review-error" role="alert">{error}</p>}
          {!busy && !error && items && items.length === 0 && <p className="rx-review-hint">{t('prescriptions.pharmacy.noReviewYet')}</p>}
          {(items || []).map(r => (
            <div key={r.id} className={`rx-review-item rx-review-${r.review_status}`}>
              <strong>{decision(r.review_status)}</strong>
              <span className="rx-review-by"> - {t('prescriptions.pharmacy.reviewedBy', { name: r.pharmacist_name, date: when(r.reviewed_at) })}</span>
              {r.rejection_reason && <p><em>{t('prescriptions.pharmacy.reasonLabel')}:</em> {r.rejection_reason}</p>}
              {r.suggested_modifications && <p><em>{t('prescriptions.pharmacy.changeLabel')}:</em> {r.suggested_modifications}</p>}
              {findings(r.findings).length > 0 && <p><em>{t('prescriptions.pharmacy.notesLabel')}:</em> {findings(r.findings).join(' ')}</p>}
              {r.review_status !== 'approved' && <p className="rx-review-hint">{t('prescriptions.pharmacy.nextStep')}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PharmacyReviewPanel
