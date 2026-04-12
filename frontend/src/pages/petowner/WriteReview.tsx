import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import '../../styles/modules.css'
import './WriteReview.css'

interface ReviewableConsultation {
  consultationId: string
  bookingId: string
  vetId: string
  vetName: string
  vetSpecialization: string
  vetAvatarUrl?: string
  vetClinicName?: string
  consultationDate: string
  consultationReason?: string
  consultationType: string
}

interface WriteReviewProps {
  consultationId?: string
  vetId?: string
  onNavigate: (path: string) => void
}

const QUICK_TAGS = [
  '👍 Professional',
  '❤️ Caring',
  '⚡ Punctual',
  '💬 Great Communication',
  '🧠 Knowledgeable',
  '💰 Good Value',
  '🏥 Clean Facility',
  '🔄 Would Return',
]

const RATING_LABELS: Record<number, string> = {
  1: 'ratingPoor',
  2: 'ratingFair',
  3: 'ratingGood',
  4: 'ratingVeryGood',
  5: 'ratingExcellent',
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatConsultationType(type: string) {
  const map: Record<string, string> = {
    video_call: '📹 Video Call', video: '📹 Video',
    chat: '💬 Chat', phone: '📞 Phone',
    in_person: '🏥 In Person',
  }
  return map[type] || type
}

const WriteReview: React.FC<WriteReviewProps> = ({ consultationId, vetId, onNavigate }) => {
  const { t } = useTranslation()
  const { formatDate } = useSettings()

  // Determine initial step from URL params or props
  const urlParams = new URLSearchParams(window.location.search)
  const urlConsultationId = consultationId || urlParams.get('consultationId') || ''
  const urlVetId = vetId || urlParams.get('vetId') || ''
  const hasUrlParams = !!(urlConsultationId && urlVetId)

  const [step, setStep] = useState<'pick' | 'write'>(hasUrlParams ? 'write' : 'pick')
  const [reviewableConsultations, setReviewableConsultations] = useState<ReviewableConsultation[]>([])
  const [loadingConsultations, setLoadingConsultations] = useState(false)
  const [selectedConsultation, setSelectedConsultation] = useState<ReviewableConsultation | null>(null)

  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const loadConsultations = useCallback(async () => {
    try {
      setLoadingConsultations(true)
      const result = await apiService.getReviewableConsultations()
      setReviewableConsultations(Array.isArray(result.data) ? result.data : [])
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || t('writeReview.failedToSubmit'))
    } finally {
      setLoadingConsultations(false)
    }
  }, [t])

  // Load reviewable consultations when on pick step
  useEffect(() => {
    if (step === 'pick') {
      loadConsultations()
    }
  }, [step, loadConsultations])

  // If URL params provided, create a minimal consultation object for display
  useEffect(() => {
    if (hasUrlParams && !selectedConsultation) {
      setSelectedConsultation({
        consultationId: urlConsultationId,
        bookingId: '',
        vetId: urlVetId,
        vetName: urlParams.get('vetName') || 'Your Veterinarian',
        vetSpecialization: urlParams.get('spec') || 'General Practice',
        consultationDate: urlParams.get('date') || '',
        consultationType: urlParams.get('type') || 'video',
      })
    }
  }, [hasUrlParams]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectConsultation = (c: ReviewableConsultation) => {
    setSelectedConsultation(c)
    setStep('write')
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (rating === 0) { setError(t('writeReview.errorSelectRating')); return }
    if (!comment.trim()) { setError(t('writeReview.errorWriteComment')); return }
    if (comment.trim().length < 10) { setError(t('writeReview.errorMinChars')); return }
    if (!selectedConsultation) { setError('No consultation selected'); return }

    try {
      setSubmitting(true)
      await apiService.createReview({
        consultationId: selectedConsultation.consultationId,
        veterinarianId: selectedConsultation.vetId,
        rating,
        comment: comment.trim(),
        isPublic,
      })
      setSubmitted(true)
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || t('writeReview.failedToSubmit'))
    } finally {
      setSubmitting(false)
    }
  }

  const isSubmitDisabled = rating === 0 || comment.trim().length < 10

  /* ────── SUCCESS ────── */
  if (submitted && selectedConsultation) {
    return (
      <div className="module-page">
        <div className="wr-success">
          <div className="wr-success-icon">🎉</div>
          <h1 style={{ marginBottom: 8 }}>{t('writeReview.thankYou')}</h1>
          <p style={{ color: '#6b7280', fontSize: 16, marginBottom: 8 }}>
            {t('writeReview.submittedFor', { name: selectedConsultation.vetName })}
          </p>
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 28 }}>
            {t('writeReview.helpCommunity')}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="module-btn primary" onClick={() => onNavigate('/my-bookings')}>
              {t('writeReview.myBookings')}
            </button>
            <button className="module-btn" onClick={() => onNavigate('/dashboard')}>
              {t('writeReview.dashboard')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ────── STEP 1: PICK CONSULTATION ────── */
  if (step === 'pick') {
    return (
      <div className="module-page">
        <div className="module-header">
          <div>
            <h1>{t('writeReview.title')}</h1>
            <p className="module-subtitle">{t('writeReview.pickSubtitle')}</p>
          </div>
          <div className="module-header-actions">
            <button className="module-btn" onClick={() => onNavigate('/my-bookings')}>
              {t('writeReview.backToBookings')}
            </button>
          </div>
        </div>

        {error && <div className="module-alert error">{error}</div>}

        {loadingConsultations ? (
          <div className="loading-container"><div className="loading-spinner" /></div>
        ) : reviewableConsultations.length === 0 ? (
          <div className="wr-empty">
            <div className="wr-empty-icon">🎉</div>
            <h3>{t('writeReview.noReviewable')}</h3>
            <p>{t('writeReview.noReviewableDesc')}</p>
            <button className="module-btn primary" onClick={() => onNavigate('/my-bookings')}>
              {t('writeReview.myBookings')}
            </button>
          </div>
        ) : (
          <div className="wr-consultation-list">
            {reviewableConsultations.map(c => (
              <div key={c.consultationId} className="wr-consultation-card" onClick={() => handleSelectConsultation(c)}>
                {c.vetAvatarUrl ? (
                  <img src={c.vetAvatarUrl} alt={c.vetName} className="wr-avatar" />
                ) : (
                  <div className="wr-avatar-initials">{getInitials(c.vetName)}</div>
                )}
                <div className="wr-vet-info">
                  <p className="wr-vet-name">{c.vetName}</p>
                  <p className="wr-vet-meta">
                    {c.vetSpecialization}
                    {c.vetClinicName ? ` • ${c.vetClinicName}` : ''}
                  </p>
                  <span className="wr-consult-badge">{formatConsultationType(c.consultationType)}</span>
                  {c.consultationDate && (
                    <p className="wr-consult-date">
                      📅 {formatDate(c.consultationDate)}
                    </p>
                  )}
                  {c.consultationReason && (
                    <p className="wr-consult-date" style={{ marginTop: 2 }}>
                      {c.consultationReason.slice(0, 80)}{c.consultationReason.length > 80 ? '…' : ''}
                    </p>
                  )}
                </div>
                <div className="wr-arrow">›</div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  /* ────── STEP 2: WRITE REVIEW ────── */
  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>{t('writeReview.title')}</h1>
          {selectedConsultation && (
            <p className="module-subtitle">
              {t('writeReview.writeFor', { name: selectedConsultation.vetName })}
            </p>
          )}
        </div>
        <div className="module-header-actions">
          {!hasUrlParams && (
            <button className="module-btn" onClick={() => { setStep('pick'); setError('') }}>
              {t('writeReview.backToPick')}
            </button>
          )}
        </div>
      </div>

      <div className="module-card" style={{ maxWidth: 640, margin: '0 auto' }}>
        {error && <div className="wr-error">{error}</div>}

        {/* Doctor context banner */}
        {selectedConsultation && (
          <div className="wr-context-banner">
            {selectedConsultation.vetAvatarUrl ? (
              <img src={selectedConsultation.vetAvatarUrl} alt={selectedConsultation.vetName} className="wr-context-avatar" />
            ) : (
              <div className="wr-context-initials">🩺</div>
            )}
            <div className="wr-context-info">
              <div className="wr-context-label">{t('writeReview.reviewingDoctor')}</div>
              <p className="wr-context-name">{selectedConsultation.vetName}</p>
              <div className="wr-context-meta">
                {selectedConsultation.vetSpecialization}
                {selectedConsultation.vetClinicName ? ` • ${selectedConsultation.vetClinicName}` : ''}
                {selectedConsultation.consultationDate && (
                  <span> · 📅 {formatDate(selectedConsultation.consultationDate)} · {formatConsultationType(selectedConsultation.consultationType)}</span>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Star Rating */}
          <div className="module-form-group">
            <label className="module-label">
              {t('writeReview.overallRating')} <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div className="wr-stars">
              {[1, 2, 3, 4, 5].map(star => (
                <span
                  key={star}
                  className={`wr-star${star <= (hoverRating || rating) ? ' active' : ''}`}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                >★</span>
              ))}
            </div>
            <p className="wr-rating-label">
              {(hoverRating || rating) > 0 ? t(`writeReview.${RATING_LABELS[hoverRating || rating]}`) : ''}
            </p>
          </div>

          {/* Comment */}
          <div className="module-form-group">
            <label className="module-label">
              {t('writeReview.yourReview')} <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              className="module-input"
              rows={5}
              placeholder={t('writeReview.reviewPlaceholder')}
              value={comment}
              onChange={e => setComment(e.target.value)}
              style={{ resize: 'vertical' }}
            />
            <p className="wr-char-count">{t('writeReview.charCount', { count: comment.length })}</p>
          </div>

          {/* Quick Tags */}
          <div className="module-form-group">
            <label className="module-label">{t('writeReview.quickTags')}</label>
            <div className="wr-tags">
              {QUICK_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  className={`wr-tag${comment.includes(tag) ? ' selected' : ''}`}
                  onClick={() => {
                    if (comment.includes(tag)) {
                      setComment(comment.replace(tag, '').replace(/\s{2,}/g, ' ').trim())
                    } else {
                      setComment(prev => prev ? `${prev} ${tag}` : tag)
                    }
                  }}
                >{tag}</button>
              ))}
            </div>
          </div>

          {/* Make Public */}
          <div className="module-form-group">
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={e => setIsPublic(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 2 }}
              />
              <span>
                <strong>{t('writeReview.isPublic')}</strong>
                <br />
                <span style={{ color: '#6b7280', fontSize: 13 }}>{t('writeReview.isPublicDesc')}</span>
              </span>
            </label>
          </div>

          {/* Disabled helper text */}
          {isSubmitDisabled && (
            <div className="wr-helper-text">⚠️ {t('writeReview.helpRequired')}</div>
          )}

          {/* Submit */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button
              type="button"
              className="module-btn"
              onClick={() => !hasUrlParams ? setStep('pick') : onNavigate('/my-bookings')}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="module-btn primary"
              disabled={submitting || isSubmitDisabled}
            >
              {submitting ? t('writeReview.submitting') : t('writeReview.submitReview')}
            </button>
          </div>

          <p className="wr-form-legend">* {t('common.requiredField', { defaultValue: 'Required field' })}</p>
        </form>
      </div>
    </div>
  )
}

export default WriteReview
