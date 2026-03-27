import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import '../../styles/modules.css'

interface WriteReviewProps {
  consultationId?: string
  vetId?: string
  onNavigate: (path: string) => void
}

const WriteReview: React.FC<WriteReviewProps> = ({ consultationId, vetId, onNavigate }) => {
  const { t } = useTranslation()
  // auth context available for user info if needed
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // Extract from URL params if not provided as props
  const params = new URLSearchParams(window.location.search)
  const conId = consultationId || params.get('consultationId') || ''
  const vId = vetId || params.get('vetId') || ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (rating === 0) {
      setError(t('writeReview.errorSelectRating'))
      return
    }
    if (!comment.trim()) {
      setError(t('writeReview.errorWriteComment'))
      return
    }
    if (comment.trim().length < 10) {
      setError(t('writeReview.errorMinChars'))
      return
    }

    try {
      setSubmitting(true)
      await apiService.createReview({
        consultationId: conId,
        veterinarianId: vId,
        rating,
        comment: comment.trim()
      })
      setSubmitted(true)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="module-page">
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
          <h1 style={{ marginBottom: 8 }}>{t('writeReview.thankYou')}</h1>
          <p style={{ color: '#6b7280', fontSize: 16, marginBottom: 24 }}>
            {t('writeReview.submittedSuccess')}
          </p>
          <div className="star-rating" style={{ justifyContent: 'center', marginBottom: 24 }}>
            {[1, 2, 3, 4, 5].map(star => 
              star <= rating ? (
                <span key={star} className="star filled" style={{ fontSize: 36 }}>★</span>
              ) : null
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => onNavigate('/my-bookings')}>
              {t('writeReview.myBookings')}
            </button>
            <button className="btn btn-outline" onClick={() => onNavigate('/dashboard')}>
              {t('writeReview.dashboard')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>{t('writeReview.title')}</h1>
          <p className="page-subtitle">
            {t('writeReview.subtitle')}
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => onNavigate('/my-bookings')}>
            {t('writeReview.backToBookings')}
          </button>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
        <div className="card-header">
          <h2>{t('writeReview.yourFeedback')}</h2>
        </div>
        <div className="card-body">
          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              borderRadius: 8,
              marginBottom: 20,
              fontSize: 14
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Star Rating */}
            <div className="form-group">
              <label className="form-label">{t('writeReview.overallRating')}</label>
              <div className="star-rating" style={{ gap: 8, marginTop: 4 }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <span
                    key={star}
                    className={`star ${star <= (hoverRating || rating) ? 'filled' : ''}`}
                    style={{
                      fontSize: 40,
                      cursor: 'pointer',
                      transition: 'transform 0.15s',
                      display: 'inline-block',
                      transform: star <= (hoverRating || rating) ? 'scale(1.1)' : 'scale(1)',
                      color: star <= (hoverRating || rating) ? '#f59e0b' : '#d1d5db'
                    }}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                  >
                    ★
                  </span>
                ))}
              </div>
              <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>
                {rating === 1 && t('writeReview.ratingPoor')}
                {rating === 2 && t('writeReview.ratingFair')}
                {rating === 3 && t('writeReview.ratingGood')}
                {rating === 4 && t('writeReview.ratingVeryGood')}
                {rating === 5 && t('writeReview.ratingExcellent')}
              </p>
            </div>

            {/* Comment */}
            <div className="form-group">
              <label className="form-label">{t('writeReview.yourReview')}</label>
              <textarea
                className="form-input"
                rows={6}
                placeholder={t('writeReview.reviewPlaceholder')}
                value={comment}
                onChange={e => setComment(e.target.value)}
                style={{ resize: 'vertical' }}
              />
              <p style={{ color: '#6b7280', fontSize: 12, marginTop: 4, textAlign: 'right' }}>
                {t('writeReview.charCount', { count: comment.length })}
              </p>
            </div>

            {/* Public toggle */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={e => setIsPublic(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                <span>
                  <strong>{t('writeReview.makePublic')}</strong>
                  <br />
                  <span style={{ color: '#6b7280', fontSize: 13 }}>
                    {t('writeReview.publicDescription')}
                  </span>
                </span>
              </label>
            </div>

            {/* Quick Review Tags */}
            <div className="form-group">
              <label className="form-label">{t('writeReview.quickTags')}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  '👍 Professional',
                  '❤️ Caring',
                  '⚡ Punctual',
                  '💬 Great Communication',
                  '🧠 Knowledgeable',
                  '💰 Good Value',
                  '🏥 Clean Facility',
                  '🔄 Would Return'
                ].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    className={`btn ${comment.includes(tag) ? 'btn-primary' : 'btn-outline'}`}
                    style={{ fontSize: 13, padding: '6px 12px' }}
                    onClick={() => {
                      if (comment.includes(tag)) {
                        setComment(comment.replace(tag, '').replace(/\s{2,}/g, ' ').trim())
                      } else {
                        setComment(prev => prev ? `${prev} ${tag}` : tag)
                      }
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24, borderTop: '1px solid #e5e7eb', paddingTop: 20 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => onNavigate('/my-bookings')}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={submitting}
              >
                {submitting ? t('writeReview.submitting') : t('writeReview.submitReview')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default WriteReview
