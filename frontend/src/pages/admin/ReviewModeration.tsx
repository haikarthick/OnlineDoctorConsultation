import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import { Review } from '../../types'
import '../../styles/modules.css'

interface ReviewModerationProps {
  onNavigate: (path: string) => void
}

const ReviewModeration: React.FC<ReviewModerationProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { formatDate } = useSettings()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    loadReviews()
  }, [statusFilter])

  const loadReviews = async () => {
    try {
      setLoading(true)
      const result = await apiService.adminListReviews({ status: statusFilter || undefined })
      setReviews(result.data?.items || (Array.isArray(result.data) ? result.data : []))
    } catch (err) {
} finally {
      setLoading(false)
    }
  }

  const handleModerate = async (reviewId: string, action: string) => {
    try {
      setProcessing(reviewId)
      await apiService.adminModerateReview(reviewId, action as 'approve' | 'hide' | 'remove')
      setReviews(reviews.map(r =>
        r.id === reviewId ? { ...r, status: action === 'approve' ? 'approved' : action === 'hide' ? 'hidden' : 'removed' } : r
      ))
    } catch (err) {
} finally {
      setProcessing(null)
    }
  }

  const pendingCount = reviews.filter(r => r.status === 'pending').length
  const flaggedCount = reviews.filter(r => (r.reportCount || 0) > 0).length

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>{t('reviewModeration.title')}</h1>
          <p className="page-subtitle">
            {t('reviewModeration.subtitle', { total: reviews.length, pending: pendingCount, flagged: flaggedCount })}
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => onNavigate('/admin/dashboard')}>← {t('reviewModeration.dashboard')}</button>
        </div>
      </div>

      {/* Filters */}
      <div className="search-filter-bar" style={{ marginBottom: 24 }}>
        <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 180 }}>
          <option value="">{t('reviewModeration.allStatuses')}</option>
          <option value="pending">{t('reviewModeration.pending')}</option>
          <option value="approved">{t('reviewModeration.approved')}</option>
          <option value="hidden">{t('reviewModeration.hidden')}</option>
          <option value="removed">{t('reviewModeration.removed')}</option>
        </select>
        <button className="btn btn-outline" onClick={loadReviews}>🔄 {t('reviewModeration.refresh')}</button>
      </div>

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : reviews.length === 0 ? (
        <div className="empty-state"><div style={{ fontSize: 48 }}>⭐</div><h3>{t('reviewModeration.noReviews')}</h3></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {reviews.map(review => (
            <div key={review.id} className="card" style={{
              borderLeft: `4px solid ${
                review.status === 'pending' ? '#f59e0b' :
                review.status === 'approved' ? '#10b981' :
                review.status === 'hidden' ? '#6b7280' : '#dc2626'
              }`
            }}>
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <strong>{review.petOwnerName || t('reviewModeration.petOwner')}</strong>
                      <span style={{ color: '#6b7280' }}>→</span>
                      <strong>{review.vetName || t('reviewModeration.vet')}</strong>
                      <div className="star-rating" style={{ gap: 2 }}>
                        {[1, 2, 3, 4, 5].map(s => (
                          <span key={s} style={{ fontSize: 14, color: s <= review.rating ? '#f59e0b' : '#d1d5db' }}>★</span>
                        ))}
                      </div>
                    </div>
                    <p style={{ fontSize: 14, margin: '8px 0', lineHeight: 1.5 }}>{review.comment}</p>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#6b7280' }}>
                      <span>📅 {formatDate(review.createdAt || '')}</span>
                      {review.helpfulCount ? <span>👍 {review.helpfulCount} {t('reviewModeration.helpful')}</span> : null}
                      {review.reportCount ? <span style={{ color: '#dc2626' }}>🚩 {review.reportCount} {t('reviewModeration.reports')}</span> : null}
                    </div>
                    {review.responseFromVet && (
                      <div style={{ marginTop: 8, padding: 10, background: '#eff6ff', borderRadius: 6, fontSize: 13 }}>
                        <strong style={{ color: '#3b82f6' }}>{t('reviewModeration.vetResponse')}:</strong> {review.responseFromVet}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 16 }}>
                    <span className={`badge badge-${
                      review.status === 'approved' ? 'active' :
                      review.status === 'pending' ? 'pending' :
                      review.status === 'hidden' ? 'warning' : 'danger'
                    }`}>
                      {review.status}
                    </span>
                    {review.status === 'pending' && (
                      <>
                        <button
                          className="btn btn-sm btn-success"
                          disabled={processing === review.id}
                          onClick={() => handleModerate(review.id, 'approve')}
                        >✓ {t('reviewModeration.approve')}</button>
                        <button
                          className="btn btn-sm btn-warning"
                          disabled={processing === review.id}
                          onClick={() => handleModerate(review.id, 'hide')}
                        >👁️ {t('reviewModeration.hide')}</button>
                      </>
                    )}
                    {review.status === 'approved' && (
                      <button
                        className="btn btn-sm btn-warning"
                        disabled={processing === review.id}
                        onClick={() => handleModerate(review.id, 'hide')}
                      >👁️ {t('reviewModeration.hide')}</button>
                    )}
                    {review.status !== 'removed' && (
                      <button
                        className="btn btn-sm btn-danger"
                        disabled={processing === review.id}
                        onClick={() => handleModerate(review.id, 'remove')}
                      >🗑️ {t('reviewModeration.remove')}</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ReviewModeration
