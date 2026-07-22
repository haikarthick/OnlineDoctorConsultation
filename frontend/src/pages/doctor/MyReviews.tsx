import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import { Review } from '../../types'
import '../../styles/modules.css'

interface MyReviewsProps {
  onNavigate: (path: string) => void
}

const MyReviews: React.FC<MyReviewsProps> = ({ onNavigate: _onNavigate }) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { formatDate } = useSettings()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [responseText, setResponseText] = useState('')

  useEffect(() => {
    loadReviews()
  }, [])

  const loadReviews = async () => {
    try {
      setLoading(true)
      const result = await apiService.listVetReviews(user?.id || '')
      setReviews(result.data?.reviews || result.data?.items || (Array.isArray(result.data) ? result.data : []))
    } catch (err) {
} finally {
      setLoading(false)
    }
  }

  const handleRespond = async (reviewId: string) => {
    if (!responseText.trim()) return
    // In a real app, this would call an API to add vet response
    setReviews(reviews.map(r =>
      r.id === reviewId ? { ...r, responseFromVet: responseText } : r
    ))
    setRespondingTo(null)
    setResponseText('')
  }

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + Number(r.rating), 0) / reviews.length
    : 0

  const ratingDist = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => Number(r.rating) === star).length,
    pct: reviews.length > 0 ? (reviews.filter(r => Number(r.rating) === star).length / reviews.length * 100) : 0
  }))

  if (loading) {
    return (
      <div className="module-page">
        <div className="loading-container"><div className="loading-spinner" /><p>{t('doctorReviews.loadingReviews')}</p></div>
      </div>
    )
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>{t('doctorReviews.title')}</h1>
          <p className="page-subtitle">{reviews.length} {t('doctorReviews.reviews')} {reviews.length !== 1 ? '' : ''}</p>
        </div>
      </div>

      {/* Rating Summary */}
      <div className="card si-af65fe13">
        <div className="card-body">
          <div className="si-2f303522">
            <div className="si-4b6b7fbc">
              <div className="si-4a0be8b2">{avgRating.toFixed(1)}</div>
              <div className="star-rating si-79bc7330">
                {[1, 2, 3, 4, 5].map(s => (
                  <span key={s} style={{ fontSize: 24, color: s <= Math.round(avgRating) ? '#f59e0b' : '#d1d5db' }}>★</span>
                ))}
              </div>
              <p className="si-09dee8a9">{reviews.length} {t('doctorReviews.reviews')}</p>
            </div>
            <div className="si-6acd75e8">
              {ratingDist.map(d => (
                <div key={d.star} className="si-b8d2089f">
                  <span className="si-b2b5468c">{d.star}★</span>
                  <div className="si-bda83d5f">
                    <div style={{ width: `${d.pct}%`, height: '100%', background: '#f59e0b', borderRadius: 4 }} />
                  </div>
                  <span className="si-e922db48">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="empty-state">
          <div className="si-353e617d">⭐</div>
          <h3>{t('doctorReviews.noReviewsYet')}</h3>
          <p>{t('doctorReviews.reviewsWillAppear')}</p>
        </div>
      ) : (
        <div className="si-58f59f7a">
          {reviews.map(review => (
            <div key={review.id} className="card">
              <div className="card-body">
                <div className="si-b1549cde">
                  <div>
                    <div className="si-b8d2089f">
                      <strong>{review.petOwnerName || t('doctorReviews.petOwner')}</strong>
                      <div className="star-rating si-32deb58a">
                        {[1, 2, 3, 4, 5].map(s => (
                          <span key={s} style={{ fontSize: 16, color: s <= review.rating ? '#f59e0b' : '#d1d5db' }}>★</span>
                        ))}
                      </div>
                    </div>
                    <p className="si-4c7d5b07">
                      {formatDate(review.createdAt || '')}
                    </p>
                  </div>
                  <span className={`badge badge-${review.status === 'approved' ? 'active' : review.status === 'pending' ? 'pending' : 'inactive'}`}>
                    {review.status}
                  </span>
                </div>

                <p className="si-fe0c9bbe">{review.comment}</p>

                {/* Vet Response */}
                {review.responseFromVet && (
                  <div className="si-5facabee">
                    <p className="si-96b2fabe">{t('doctorReviews.yourResponse')}</p>
                    <p className="si-c3c3ed3b">{review.responseFromVet}</p>
                  </div>
                )}

                {/* Respond Form */}
                {!review.responseFromVet && respondingTo === review.id && (
                  <div className="si-66faea9d">
                    <textarea
                      className="module-input si-71dd43e2"
                      placeholder={t('doctorReviews.writeResponse')}
                      value={responseText}
                      onChange={e => setResponseText(e.target.value)}
                      rows={3}
                     
                    />
                    <div className="si-d223efb3">
                      <button className="btn btn-primary" onClick={() => handleRespond(review.id)}>{t('doctorReviews.send')}</button>
                      <button className="btn btn-outline" onClick={() => { setRespondingTo(null); setResponseText('') }}>{t('doctorReviews.cancel')}</button>
                    </div>
                  </div>
                )}

                {!review.responseFromVet && respondingTo !== review.id && (
                  <button
                    className="btn btn-outline btn-sm si-66faea9d"
                   
                    onClick={() => setRespondingTo(review.id)}
                  >
                    💬 {t('doctorReviews.respond')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MyReviews
