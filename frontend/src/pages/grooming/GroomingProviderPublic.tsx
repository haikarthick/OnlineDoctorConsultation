import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import '../../styles/modules.css'

interface Props { onNavigate: (path: string) => void; id?: string }

const GroomingProviderPublic: React.FC<Props> = ({ onNavigate, id }) => {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const [p, setP] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    try { setLoading(true); setErr(''); setP((await apiService.getPublicGroomingProvider(id)).data) }
    catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setLoading(false) }
  }, [id])
  useEffect(() => { load() }, [load])

  if (loading) return <div className="module-page"><div className="loading-container"><div className="loading-spinner" /></div></div>
  if (err || !p) return <div className="module-page"><div className="module-alert error">{err || t('groomingPublic.notFound')}</div>
    <button className="module-btn" onClick={() => onNavigate('/grooming/find')}>← {t('groomingPublic.back')}</button></div>

  return (
    <div className="module-page">
      <button className="module-btn back-link" onClick={() => onNavigate('/grooming/find')}>← {t('groomingPublic.back')}</button>
      <div className="module-card">
        <div className="provider-hero">
          <div className="provider-hero-avatar" aria-hidden="true">💈</div>
          <div className="provider-hero-identity">
            <h1>{p.businessName}</h1>
            <div className="provider-card-rating">
              ⭐ {Number(p.rating || 0).toFixed(1)} · {p.totalReviews || 0} · {p.totalOrders || 0} {t('groomingPublic.orders')}
            </div>
            <div className="provider-card-tags">
              {p.offersMobile && <span className="module-badge">🚐 {t('groomingFind.mobile')}</span>}
              {p.offersAtPremises && <span className="module-badge">🏠 {t('groomingFind.atPremises')}</span>}
            </div>
          </div>
        </div>
        {p.description && <p className="provider-hero-description">{p.description}</p>}
        {p.contactPhone && <div className="slot-hint">📞 {p.contactPhone}</div>}
      </div>

      <div className="module-card">
        <h3>{t('groomingPublic.services')}</h3>
        {(!p.services || p.services.length === 0) ? <p className="slot-hint">{t('groomingPublic.noServices')}</p>
          : (
            <div className="service-list">
              {p.services.map((s: any) => (
                <div key={s.id} className="service-row">
                  <div className="service-row-info">
                    <strong>{s.name}</strong>
                    <div className="slot-hint">{s.durationMinutes} {t('groomingBook.minutes')} · {t(s.paymentRule === 'deposit' ? 'grooming.payDeposit' : 'grooming.payFull')}</div>
                    {s.description && <div className="service-row-description">{s.description}</div>}
                  </div>
                  <div className="service-row-buy">
                    <div className="service-row-price">
                      {formatCurrency(Number(s.basePrice))}{Number(s.taxPercent) > 0 ? ` +${s.taxPercent}%` : ''}
                    </div>
                    <button className="module-btn primary small"
                      onClick={() => onNavigate(`/grooming/book?providerId=${p.id}&serviceId=${s.id}`)}>
                      {t('groomingPublic.book')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}

export default GroomingProviderPublic
