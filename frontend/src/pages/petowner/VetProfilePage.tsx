import React, { useState, useEffect } from 'react'
import apiService from '../../services/api'
import { VetProfile, Review } from '../../types'
import '../../styles/modules.css'

interface VetProfilePageProps {
  vetId?: string
  onNavigate: (path: string) => void
}

const VetProfilePage: React.FC<VetProfilePageProps> = ({ onNavigate }) => {
  const [vet, setVet] = useState<VetProfile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [error, setError] = useState('')
  const [reviewPage, setReviewPage] = useState(0)
  const [hasMoreReviews, setHasMoreReviews] = useState(false)

  const vetUserId = new URLSearchParams(window.location.search).get('id') ||
    window.location.pathname.split('/vet-profile/')[1]?.split('?')[0] || ''

  useEffect(() => {
    if (!vetUserId) { setError('No vet specified'); setLoading(false); return }
    loadProfile()
    loadReviews(0)
  }, [vetUserId])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const res = await apiService.getVetProfile(vetUserId)
      setVet(res.data || res)
    } catch {
      setError('Failed to load veterinarian profile')
    } finally {
      setLoading(false)
    }
  }

  const loadReviews = async (page: number) => {
    try {
      setReviewsLoading(true)
      const res = await apiService.listVetReviews(vetUserId, { limit: 10, offset: page * 10 })
      const list = res.data?.reviews || res.data?.items || (Array.isArray(res.data) ? res.data : [])
      if (page === 0) {
        setReviews(list)
      } else {
        setReviews(prev => [...prev, ...list])
      }
      setHasMoreReviews(list.length === 10)
      setReviewPage(page)
    } catch { /* ignore */ }
    finally { setReviewsLoading(false) }
  }

  const renderStars = (rating: number, size = 16) => (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < Math.round(rating) ? '#f59e0b' : '#d1d5db', fontSize: size }}>★</span>
      ))}
    </span>
  )

  const formatDays = (days?: string) => {
    if (!days) return 'Not specified'
    return days.split(',').map(d => d.trim()).join(', ')
  }

  if (loading) {
    return (
      <div className="module-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading profile...</p>
        </div>
      </div>
    )
  }

  if (error || !vet) {
    return (
      <div className="module-page">
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <h3>{error || 'Veterinarian not found'}</h3>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => onNavigate('/find-doctor')}>
            ← Back to Find Doctor
          </button>
        </div>
      </div>
    )
  }

  const experience = vet.yearsOfExperience || vet.experience || 0

  return (
    <div className="module-page" style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Back button */}
      <button onClick={() => onNavigate('/find-doctor')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        ← Back to Find Doctor
      </button>

      {/* ── Profile Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 16, padding: '32px 36px', color: 'white', marginBottom: 24,
        display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap'
      }}>
        <div style={{
          width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, fontWeight: 700,
          border: '3px solid rgba(255,255,255,0.4)', flexShrink: 0
        }}>
          {vet.firstName?.charAt(0) || '🐾'}
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ margin: 0, fontSize: 28 }}>Dr. {vet.firstName || ''} {vet.lastName || ''}</h1>
          <p style={{ margin: '6px 0 0', opacity: 0.9, fontSize: 15 }}>
            {(vet.specializations || []).join(', ') || 'General Veterinarian'}
          </p>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {renderStars(vet.rating || 0, 18)}
            <span style={{ fontWeight: 600, fontSize: 16 }}>{(vet.rating || 0).toFixed(1)}</span>
            <span style={{ opacity: 0.8, fontSize: 13 }}>({vet.totalReviews || 0} reviews)</span>
            {vet.isVerified && <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>✓ Verified</span>}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {vet.isAvailable && <span style={{ background: '#059669', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>● Available</span>}
            {vet.acceptsEmergency && <span style={{ background: '#dc2626', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>🚨 Emergency</span>}
          </div>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{vet.currency || '$'}{vet.consultationFee || 0}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>per session</div>
          <button className="btn" onClick={() => onNavigate(`/book-consultation?vetId=${vet.userId}`)}
            style={{ marginTop: 12, background: 'white', color: '#4F46E5', fontWeight: 700, padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14 }}>
            📅 Book Consultation
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* ── About ── */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px 24px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#1f2937' }}>📋 About</h3>
          <p style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            {vet.bio || 'No biography provided yet.'}
          </p>
        </div>

        {/* ── Stats ── */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px 24px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#1f2937' }}>📊 Statistics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ textAlign: 'center', padding: 12, background: '#f9fafb', borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#2563eb' }}>{experience}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Years Experience</div>
            </div>
            <div style={{ textAlign: 'center', padding: 12, background: '#f9fafb', borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#059669' }}>{vet.totalConsultations || 0}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Consultations</div>
            </div>
            <div style={{ textAlign: 'center', padding: 12, background: '#f9fafb', borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{(vet.rating || 0).toFixed(1)}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Rating</div>
            </div>
            <div style={{ textAlign: 'center', padding: 12, background: '#f9fafb', borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#8b5cf6' }}>{vet.totalReviews || 0}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Reviews</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* ── Qualifications & Specializations ── */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px 24px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#1f2937' }}>🎓 Qualifications</h3>
          {(vet.qualifications || []).length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 20, color: '#374151', fontSize: 14, lineHeight: 2 }}>
              {vet.qualifications.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          ) : <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>Not specified</p>}

          <h3 style={{ margin: '16px 0 12px', fontSize: 16, color: '#1f2937' }}>🩺 Specializations</h3>
          {(vet.specializations || []).length > 0 ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {vet.specializations.map((s, i) => (
                <span key={i} style={{ background: '#eef2ff', color: '#4338ca', padding: '4px 12px', borderRadius: 16, fontSize: 13, fontWeight: 500 }}>{s}</span>
              ))}
            </div>
          ) : <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>General practice</p>}
        </div>

        {/* ── Practice Details ── */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px 24px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#1f2937' }}>🏥 Practice Details</h3>
          <div style={{ display: 'grid', gap: 10, fontSize: 14, color: '#374151' }}>
            {vet.clinicName && (
              <div><span style={{ color: '#6b7280' }}>Clinic:</span> <strong>{vet.clinicName}</strong></div>
            )}
            {vet.clinicAddress && (
              <div><span style={{ color: '#6b7280' }}>Address:</span> <strong>{vet.clinicAddress}</strong></div>
            )}
            {vet.licenseNumber && (
              <div><span style={{ color: '#6b7280' }}>License:</span> <strong style={{ fontFamily: 'monospace' }}>{vet.licenseNumber}</strong></div>
            )}
            <div><span style={{ color: '#6b7280' }}>Available Days:</span> <strong>{formatDays(vet.availableDays)}</strong></div>
            {vet.availableHoursStart && vet.availableHoursEnd && (
              <div><span style={{ color: '#6b7280' }}>Hours:</span> <strong>{vet.availableHoursStart} – {vet.availableHoursEnd}</strong></div>
            )}
          </div>

          <h3 style={{ margin: '16px 0 12px', fontSize: 16, color: '#1f2937' }}>🌐 Languages</h3>
          {(vet.languages || []).length > 0 ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {vet.languages.map((l, i) => (
                <span key={i} style={{ background: '#f0fdf4', color: '#166534', padding: '4px 12px', borderRadius: 16, fontSize: 13, fontWeight: 500 }}>{l}</span>
              ))}
            </div>
          ) : <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>Not specified</p>}
        </div>
      </div>

      {/* ── Reviews Section ── */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '24px 28px', marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18, color: '#1f2937' }}>
          ⭐ Patient Reviews ({vet.totalReviews || 0})
        </h3>

        {reviews.length === 0 && !reviewsLoading ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
            <p>No reviews yet. Be the first to review after a consultation!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {reviews.map(review => (
              <div key={review.id} style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', background: '#eef2ff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, color: '#4338ca', fontSize: 14
                    }}>
                      {(review.petOwnerName || review.reviewerName || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>
                        {review.petOwnerName || review.reviewerName || 'Anonymous'}
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>
                        {new Date(review.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {renderStars(review.rating, 14)}
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginLeft: 4 }}>{review.rating}/5</span>
                    {review.isVerified && <span style={{ fontSize: 11, color: '#059669', marginLeft: 6 }}>✓ Verified</span>}
                  </div>
                </div>
                {review.comment && (
                  <p style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.6, margin: '4px 0 0', paddingLeft: 46 }}>
                    {review.comment}
                  </p>
                )}
                {review.responseFromVet && (
                  <div style={{ marginTop: 8, marginLeft: 46, padding: '10px 14px', background: '#fefce8', borderRadius: 8, borderLeft: '3px solid #f59e0b' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>Doctor's Response:</div>
                    <p style={{ color: '#4b5563', fontSize: 13, lineHeight: 1.5, margin: 0 }}>{review.responseFromVet}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {reviewsLoading && (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <div className="loading-spinner" style={{ width: 24, height: 24, margin: '0 auto' }} />
          </div>
        )}

        {hasMoreReviews && !reviewsLoading && (
          <button onClick={() => loadReviews(reviewPage + 1)}
            className="btn btn-outline" style={{ display: 'block', margin: '16px auto 0' }}>
            Load More Reviews
          </button>
        )}
      </div>

      {/* ── CTA Footer ── */}
      <div style={{
        textAlign: 'center', padding: '24px 0 8px'
      }}>
        <button className="btn btn-primary btn-lg" onClick={() => onNavigate(`/book-consultation?vetId=${vet.userId}`)}>
          📅 Book Consultation with Dr. {vet.firstName} {vet.lastName}
        </button>
      </div>
    </div>
  )
}

export default VetProfilePage
