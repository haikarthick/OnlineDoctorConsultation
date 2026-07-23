import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import { Review } from '../../types'
import '../../styles/modules.css'

interface ReviewModerationProps {
  onNavigate: (path: string) => void
}

const STATUS_COLOR: Record<string, string> = {
  active:   '#10b981',
  hidden:   '#6b7280',
  flagged:  '#f59e0b',
  removed:  '#dc2626',
  pending:  '#f59e0b',
  approved: '#10b981',
}

const ReviewModeration: React.FC<ReviewModerationProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { formatDate } = useSettings()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [vetSearch, setVetSearch] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

  const loadReviews = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const result = await apiService.adminListReviews({ status: statusFilter || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      const items = result.data?.items || (Array.isArray(result.data) ? result.data : [])
      setReviews(prev => page === 0 ? items : [...prev, ...items])
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page])

  useEffect(() => {
    setPage(0)
  }, [statusFilter])

  useEffect(() => {
    loadReviews()
  }, [loadReviews])

  const handleModerate = async (reviewId: string, action: string) => {
    try {
      setProcessing(reviewId)
      await apiService.adminModerateReview(reviewId, action as 'approve' | 'hide' | 'remove')
      // Fix: map action to the correct DB status values
      const newStatus = action === 'approve' ? 'active'
        : action === 'hide'   ? 'hidden'
        : action === 'flag'   ? 'flagged'
        : action === 'unflag' ? 'active'
        : 'removed'
      setReviews(reviews.map(r => r.id === reviewId ? { ...r, status: newStatus } : r))
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to moderate review')
    } finally {
      setProcessing(null)
    }
  }

  const filteredReviews = vetSearch.trim()
    ? reviews.filter(r =>
        (r.vetName || '').toLowerCase().includes(vetSearch.trim().toLowerCase())
      )
    : reviews

  const activeCount = reviews.filter(r => r.status === 'active').length
  const flaggedCount = reviews.filter(r => r.status === 'flagged' || (r.reportCount || 0) >= 3).length

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>{t('reviewModeration.title')}</h1>
          <p className="module-subtitle">
            {t('reviewModeration.subtitle', { total: reviews.length, pending: activeCount, flagged: flaggedCount })}
          </p>
        </div>
        <div className="module-header-actions">
          <button className="module-btn" onClick={() => onNavigate('/admin/dashboard')}>← {t('reviewModeration.dashboard')}</button>
        </div>
      </div>

      {error && <div className="module-alert error">{error}</div>}

      {/* Filters */}
      <div className="module-filters si-cb911935">
        <input
          className="module-input si-41094ac4"
         
          placeholder={t('reviewModeration.searchByVet')}
          value={vetSearch}
          onChange={e => setVetSearch(e.target.value)}
        />
        <select
          className="module-input si-7f996198"
         
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">{t('reviewModeration.allStatuses')}</option>
          <option value="active">{t('reviewModeration.approved')}</option>
          <option value="hidden">{t('reviewModeration.hidden')}</option>
          <option value="flagged">{t('reviewModeration.flagged')}</option>
          <option value="removed">{t('reviewModeration.removed')}</option>
        </select>
        <button className="module-btn" onClick={() => { setPage(0); loadReviews() }}>🔄 {t('reviewModeration.refresh')}</button>
      </div>

      {loading && page === 0 ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : filteredReviews.length === 0 ? (
        <div className="empty-state"><div className="si-353e617d">⭐</div><h3>{t('reviewModeration.noReviews')}</h3></div>
      ) : (
        <>
          <div className="si-58f59f7a">
            {filteredReviews.map(review => (
              <div key={review.id} className="module-card" style={{
                borderLeft: `4px solid ${STATUS_COLOR[review.status] || '#6b7280'}`
              }}>
                <div className="si-0a210958">
                  <div className="si-26d7edc3">
                    {/* Reviewer → Vet + Stars */}
                    <div className="si-5c21a377">
                      <strong>{(review as any).reviewerFirstName ? `${(review as any).reviewerFirstName} ${(review as any).reviewerLastName}` : (review as any).petOwnerName || t('reviewModeration.petOwner')}</strong>
                      <span className="si-e70e9abd">→</span>
                      <strong>{review.vetName || t('reviewModeration.vet')}</strong>
                      <span>
                        {[1, 2, 3, 4, 5].map(s => (
                          <span key={s} style={{ fontSize: 14, color: s <= review.rating ? '#f59e0b' : '#d1d5db' }}>★</span>
                        ))}
                      </span>
                    </div>

                    {/* Comment */}
                    {review.comment && (
                      <p className="si-637d2dc1">{review.comment}</p>
                    )}

                    {/* Meta */}
                    <div className="si-948dbd2b">
                      <span>📅 {formatDate(review.createdAt || '')}</span>
                      {(review as any).consultationDate && (
                        <span>{t('reviewModeration.consultationDate')}: {formatDate((review as any).consultationDate)}</span>
                      )}
                      {review.helpfulCount ? <span>👍 {review.helpfulCount} {t('reviewModeration.helpful')}</span> : null}
                      {review.reportCount ? <span className="si-f84f41a5">🚩 {review.reportCount} {t('reviewModeration.reports')}</span> : null}
                    </div>

                    {/* Vet response */}
                    {review.responseFromVet && (
                      <div className="si-06a5e7fa">
                        <strong className="si-8ad4a3c7">{t('reviewModeration.vetResponse')}:</strong> {review.responseFromVet}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="si-d3e2681c">
                    <span className={`module-badge badge-${
                      review.status === 'active'  ? 'success' :
                      review.status === 'hidden'  ? 'neutral' :
                      review.status === 'flagged' ? 'warning' : 'danger'
                    } si-4b6b7fbc`}>
                      {review.status === 'active' ? t('reviewModeration.approved') :
                       review.status === 'flagged' ? t('reviewModeration.flagged') :
                       review.status}
                    </span>

                    {review.status !== 'active' && review.status !== 'removed' && (
                      <button className="module-btn primary module-btn-small" disabled={processing === review.id}
                        onClick={() => handleModerate(review.id, 'approve')}>
                        ✓ {t('reviewModeration.approve')}
                      </button>
                    )}
                    {review.status === 'active' && (
                      <button className="module-btn module-btn-small" disabled={processing === review.id}
                        onClick={() => handleModerate(review.id, 'hide')}>
                        👁️ {t('reviewModeration.hide')}
                      </button>
                    )}
                    {review.status !== 'flagged' && review.status !== 'removed' && (
                      <button className="module-btn module-btn-small" disabled={processing === review.id}
                        onClick={() => handleModerate(review.id, 'flag')}>
                        🚩 {t('reviewModeration.flag')}
                      </button>
                    )}
                    {review.status === 'flagged' && (
                      <button className="module-btn module-btn-small" disabled={processing === review.id}
                        onClick={() => handleModerate(review.id, 'unflag')}>
                        ✅ {t('reviewModeration.unflag')}
                      </button>
                    )}
                    {review.status !== 'removed' && (
                      <button className="module-btn module-btn-small si-f28a2f40" disabled={processing === review.id}
                        onClick={() => handleModerate(review.id, 'remove')}
                       >
                        🗑️ {t('reviewModeration.remove')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Load More */}
          {filteredReviews.length >= PAGE_SIZE && (
            <div className="si-e8476e94">
              <button className="module-btn" onClick={() => setPage(p => p + 1)} disabled={loading}>
                {loading ? '⏳ Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ReviewModeration
