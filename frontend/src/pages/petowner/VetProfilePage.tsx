import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import { VetProfile, Review, DoctorReliability } from '../../types'
import '../../styles/modules.css'

interface VetProfilePageProps {
  vetId?: string
  onNavigate: (path: string) => void
}

const VetProfilePage: React.FC<VetProfilePageProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const [vet, setVet] = useState<VetProfile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [error, setError] = useState('')
  const [reviewPage, setReviewPage] = useState(0)
  const [hasMoreReviews, setHasMoreReviews] = useState(false)
  const [reliability, setReliability] = useState<DoctorReliability | null>(null)

  const vetUserId = new URLSearchParams(window.location.search).get('id') ||
    window.location.pathname.split('/vet-profile/')[1]?.split('?')[0] || ''

  useEffect(() => {
    if (!vetUserId) { setError('No vet specified'); setLoading(false); return }
    loadProfile()
    loadReviews(0)
    loadReliability()
  }, [vetUserId])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const res = await apiService.getVetProfile(vetUserId)
      setVet(res.data || res)
    } catch {
      setError(t('vetProfile.failedToLoad'))
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

  const loadReliability = async () => {
    try {
      const res = await apiService.getDoctorReliability(vetUserId)
      setReliability(res.data)
    } catch { /* ignore */ }
  }

  const renderStars = (rating: number, size = 16) => (
    <span className="si-317a3d7a">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < Math.round(rating) ? '#f59e0b' : '#d1d5db', fontSize: size }}>★</span>
      ))}
    </span>
  )

  const formatDays = (days?: string) => {
    if (!days) return t('vetProfile.notSpecified')
    return days.split(',').map(d => d.trim()).join(', ')
  }

  if (loading) {
    return (
      <div className="module-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>{t('vetProfile.loadingProfile')}</p>
        </div>
      </div>
    )
  }

  if (error || !vet) {
    return (
      <div className="module-page">
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <h3>{error || t('vetProfile.notFound')}</h3>
          <button className="btn btn-primary si-66faea9d" onClick={() => onNavigate('/find-doctor')}>
            {t('vetProfile.backToFindDoctor')}
          </button>
        </div>
      </div>
    )
  }

  const experience = vet.yearsOfExperience || vet.experience || 0

  return (
    <div className="module-page si-93ce6507">
      {/* Back button */}
      <button onClick={() => onNavigate('/find-doctor')}
        className="si-b4d07026">
        {t('vetProfile.backToFindDoctor')}
      </button>

      {/* ── Profile Header ── */}
      <div className="si-9c8f4f29">
        <div className="si-c4374ccb">
          {vet.firstName?.charAt(0) || '🐾'}
        </div>
        <div className="si-f9a19b13">
          <h1 className="si-941c12ef">Dr. {vet.firstName || ''} {vet.lastName || ''}</h1>
          <p className="si-703d77f6">
            {(vet.specializations || []).join(', ') || 'General Veterinarian'}
          </p>
          <div className="si-145bdc71">
            {renderStars(Number(vet.rating) || 0, 18)}
            <span className="si-244b0f61">{Number(vet.rating || 0).toFixed(1)}</span>
            <span className="si-7e5620e0">({vet.totalReviews || 0} reviews)</span>
            {vet.isVerified && <span className="si-796c4341">✓ Verified</span>}
          </div>
          <div className="si-f4a5565c">
            {vet.isAvailable && <span className="si-a74bd6ce">● Available</span>}
            {vet.acceptsEmergency && <span className="si-ee4b738d">🚨 Emergency</span>}
            {reliability?.isReliable && (
              <span className="si-cb5a5738"
                title={`Reliability score: ${reliability.reliabilityScore}% (${reliability.totalBookings} bookings, ${reliability.totalCancellations} cancellations)`}>
                ✅ Guaranteed
              </span>
            )}
            {reliability && !reliability.isReliable && (
              <span className="si-dbec1238"
                title={`Reliability score: ${reliability.reliabilityScore}% - This doctor has had ${reliability.monthCancellations} cancellation(s) this month`}>
                ⚠️ {reliability.reliabilityScore}% reliable
              </span>
            )}
          </div>
        </div>
        <div className="si-f9523ef5">
          <div className="si-2154c3c2">{formatCurrency(vet.consultationFee || 0)}</div>
          <div className="si-dbe52463">{t('vetProfile.perSession')}</div>
          <button className="btn si-6b456d68" onClick={() => onNavigate(`/book-consultation?vetId=${vet.userId}`)}
           >
            📅 {t('vetProfile.bookConsultation')}
          </button>
        </div>
      </div>

      <div className="si-3161d7c5">
        {/* ── About ── */}
        <div className="si-8d2f51ba">
          <h3 className="si-74083aa1">📋 {t('vetProfile.about')}</h3>
          <p className="si-ee644e7d">
            {vet.bio || t('vetProfile.noBio')}
          </p>
        </div>

        {/* ── Stats ── */}
        <div className="si-8d2f51ba">
          <h3 className="si-74083aa1">📊 {t('vetProfile.statistics')}</h3>
          <div className="si-fbb64b4e">
            <div className="si-789be025">
              <div className="si-89e8725d">{experience}</div>
              <div className="si-48a0b045">{t('vetProfile.yearsExperience')}</div>
            </div>
            <div className="si-789be025">
              <div className="si-5ed0b9a5">{vet.totalConsultations || 0}</div>
              <div className="si-48a0b045">{t('vetProfile.consultations')}</div>
            </div>
            <div className="si-789be025">
              <div className="si-96dc472c">{Number(vet.rating || 0).toFixed(1)}</div>
              <div className="si-48a0b045">{t('vetProfile.rating')}</div>
            </div>
            <div className="si-789be025">
              <div className="si-575f78ab">{vet.totalReviews || 0}</div>
              <div className="si-48a0b045">{t('vetProfile.reviews')}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="si-3161d7c5">
        {/* ── Qualifications & Specializations ── */}
        <div className="si-8d2f51ba">
          <h3 className="si-74083aa1">🎓 {t('vetProfile.qualifications')}</h3>
          {(vet.qualifications || []).length > 0 ? (
            <ul className="si-67f60fa0">
              {vet.qualifications.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          ) : <p className="si-dd1c0d5a">{t('vetProfile.notSpecified')}</p>}

          <h3 className="si-ac6bd8ad">🩺 {t('vetProfile.specializations')}</h3>
          {(vet.specializations || []).length > 0 ? (
            <div className="si-50c82988">
              {vet.specializations.map((s, i) => (
                <span key={i} className="si-f0aea0d0">{s}</span>
              ))}
            </div>
          ) : <p className="si-dd1c0d5a">{t('vetProfile.generalPractice')}</p>}
        </div>

        {/* ── Practice Details ── */}
        <div className="si-8d2f51ba">
          <h3 className="si-74083aa1">🏥 {t('vetProfile.practiceDetails')}</h3>
          <div className="si-a3e0353e">
            {vet.clinicName && (
              <div><span className="si-23033f05">{t('vetProfile.clinic')}:</span> <strong>{vet.clinicName}</strong></div>
            )}
            {vet.clinicAddress && (
              <div><span className="si-23033f05">{t('vetProfile.address')}:</span> <strong>{vet.clinicAddress}</strong></div>
            )}
            {vet.licenseNumber && (
              <div><span className="si-23033f05">{t('vetProfile.license')}:</span> <strong className="si-d70e5ad0">{vet.licenseNumber}</strong></div>
            )}
            <div><span className="si-23033f05">{t('vetProfile.availableDays')}:</span> <strong>{formatDays(vet.availableDays)}</strong></div>
            {vet.availableHoursStart && vet.availableHoursEnd && (
              <div><span className="si-23033f05">{t('vetProfile.hours')}:</span> <strong>{vet.availableHoursStart} - {vet.availableHoursEnd}</strong></div>
            )}
          </div>

          <h3 className="si-ac6bd8ad">🌐 {t('vetProfile.languages')}</h3>
          {(vet.languages || []).length > 0 ? (
            <div className="si-50c82988">
              {vet.languages.map((l, i) => (
                <span key={i} className="si-2d17b549">{l}</span>
              ))}
            </div>
          ) : <p className="si-dd1c0d5a">{t('vetProfile.notSpecified')}</p>}
        </div>
      </div>

      {/* ── Reviews Section ── */}
      <div className="si-6430d10e">
        <h3 className="si-2ba6a341">
          ⭐ {t('vetProfile.patientReviews')} ({vet.totalReviews || 0})
        </h3>

        {reviews.length === 0 && !reviewsLoading ? (
          <div className="si-bd1436ca">
            <div className="si-75bae6a3">💬</div>
            <p>{t('vetProfile.noReviews')}</p>
          </div>
        ) : (
          <div className="si-58f59f7a">
            {reviews.map(review => (
              <div key={review.id} className="si-22ff1db5">
                <div className="si-9ba69a5a">
                  <div className="si-98d3a741">
                    <div className="si-851f0983">
                      {(review.petOwnerName || review.reviewerName || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="si-643647c5">
                        {review.petOwnerName || review.reviewerName || 'Anonymous'}
                      </div>
                      <div className="si-3f4bbe41">
                        {new Date(review.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                  <div className="si-ba711cbb">
                    {renderStars(review.rating, 14)}
                    <span className="si-be4f16ea">{review.rating}/5</span>
                    {review.isVerified && <span className="si-3896a67f">✓ Verified</span>}
                  </div>
                </div>
                {review.comment && (
                  <p className="si-8ecea675">
                    {review.comment}
                  </p>
                )}
                {review.responseFromVet && (
                  <div className="si-d0e3e03a">
                    <div className="si-b89b9194">{t('vetProfile.doctorResponse')}:</div>
                    <p className="si-387955ba">{review.responseFromVet}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {reviewsLoading && (
          <div className="si-0e6b0ac5">
            <div className="loading-spinner si-c22fb4da" />
          </div>
        )}

        {hasMoreReviews && !reviewsLoading && (
          <button onClick={() => loadReviews(reviewPage + 1)}
            className="btn btn-outline si-81d60c8b">
            {t('vetProfile.loadMoreReviews')}
          </button>
        )}
      </div>

      {/* ── CTA Footer ── */}
      <div className="si-70977387">
        <button className="btn btn-primary btn-lg" onClick={() => onNavigate(`/book-consultation?vetId=${vet.userId}`)}>
          📅 Book Consultation with Dr. {vet.firstName} {vet.lastName}
        </button>
      </div>
    </div>
  )
}

export default VetProfilePage
