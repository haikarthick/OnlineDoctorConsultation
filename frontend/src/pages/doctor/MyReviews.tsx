import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import { Review } from '../../types'
import '../../styles/modules.css'

interface MyReviewsProps {
  onNavigate: (path: string) => void
}

const MyReviews: React.FC<MyReviewsProps> = ({ onNavigate: _onNavigate }) => {
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
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0

  const ratingDist = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
    pct: reviews.length > 0 ? (reviews.filter(r => r.rating === star).length / reviews.length * 100) : 0
  }))

  if (loading) {
    return (
      <div className="module-page">
        <div className="loading-container"><div className="loading-spinner" /><p>Loading reviews...</p></div>
      </div>
    )
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>My Reviews</h1>
          <p className="page-subtitle">{reviews.length} review{reviews.length !== 1 ? 's' : ''} from patients</p>
        </div>
      </div>

      {/* Rating Summary */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 700 }}>{avgRating.toFixed(1)}</div>
              <div className="star-rating" style={{ justifyContent: 'center', gap: 4 }}>
                {[1, 2, 3, 4, 5].map(s => (
                  <span key={s} style={{ fontSize: 24, color: s <= Math.round(avgRating) ? '#f59e0b' : '#d1d5db' }}>★</span>
                ))}
              </div>
              <p style={{ color: '#6b7280', fontSize: 14 }}>{reviews.length} reviews</p>
            </div>
            <div style={{ flex: 1 }}>
              {ratingDist.map(d => (
                <div key={d.star} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 20, fontSize: 14, textAlign: 'right' }}>{d.star}★</span>
                  <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${d.pct}%`, height: '100%', background: '#f59e0b', borderRadius: 4 }} />
                  </div>
                  <span style={{ width: 30, fontSize: 12, color: '#6b7280' }}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 48 }}>⭐</div>
          <h3>No reviews yet</h3>
          <p>Reviews from patients will appear here</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {reviews.map(review => (
            <div key={review.id} className="card">
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <strong>{review.petOwnerName || 'Pet Owner'}</strong>
                      <div className="star-rating" style={{ gap: 2 }}>
                        {[1, 2, 3, 4, 5].map(s => (
                          <span key={s} style={{ fontSize: 16, color: s <= review.rating ? '#f59e0b' : '#d1d5db' }}>★</span>
                        ))}
                      </div>
                    </div>
                    <p style={{ color: '#6b7280', fontSize: 12, margin: 0 }}>
                      {formatDate(review.createdAt || '')}
                    </p>
                  </div>
                  <span className={`badge badge-${review.status === 'approved' ? 'active' : review.status === 'pending' ? 'pending' : 'inactive'}`}>
                    {review.status}
                  </span>
                </div>

                <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>{review.comment}</p>

                {/* Vet Response */}
                {review.responseFromVet && (
                  <div style={{ marginTop: 12, padding: 12, background: '#eff6ff', borderRadius: 8, borderLeft: '3px solid #3b82f6' }}>
                    <p style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600, margin: '0 0 4px' }}>Your Response:</p>
                    <p style={{ margin: 0, fontSize: 14 }}>{review.responseFromVet}</p>
                  </div>
                )}

                {/* Respond Form */}
                {!review.responseFromVet && respondingTo === review.id && (
                  <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    <input
                      className="form-input"
                      placeholder="Write your response..."
                      value={responseText}
                      onChange={e => setResponseText(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn-primary" onClick={() => handleRespond(review.id)}>Send</button>
                    <button className="btn btn-outline" onClick={() => { setRespondingTo(null); setResponseText('') }}>Cancel</button>
                  </div>
                )}

                {!review.responseFromVet && respondingTo !== review.id && (
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ marginTop: 12 }}
                    onClick={() => setRespondingTo(review.id)}
                  >
                    💬 Respond
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
