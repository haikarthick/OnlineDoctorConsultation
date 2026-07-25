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
      <button className="module-btn" style={{ marginBottom: 12 }} onClick={() => onNavigate('/grooming/find')}>← {t('groomingPublic.back')}</button>
      <div className="module-card">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 68, height: 68, borderRadius: 14, background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>💈</div>
          <div>
            <h1 style={{ margin: 0 }}>{p.businessName}</h1>
            <div style={{ color: '#6b7280' }}>⭐ {Number(p.rating || 0).toFixed(1)} · {p.totalReviews || 0} · {p.totalOrders || 0} {t('groomingPublic.orders')}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {p.offersMobile && <span className="si-d9973be4">🚐 {t('groomingFind.mobile')}</span>}
              {p.offersAtPremises && <span className="si-d9973be4">🏠 {t('groomingFind.atPremises')}</span>}
            </div>
          </div>
        </div>
        {p.description && <p style={{ marginTop: 12 }}>{p.description}</p>}
        {p.contactPhone && <div className="si-676930d7">📞 {p.contactPhone}</div>}
      </div>

      <div className="module-card">
        <h3>{t('groomingPublic.services')}</h3>
        {(!p.services || p.services.length === 0) ? <p className="si-676930d7">{t('groomingPublic.noServices')}</p>
          : (
            <div style={{ display: 'grid', gap: 12 }}>
              {p.services.map((s: any) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 12, border: '1px solid #e5e7eb', borderRadius: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{s.name}</strong>
                    <div className="si-676930d7">{s.durationMinutes} min · {t(s.paymentRule === 'deposit' ? 'grooming.payDeposit' : 'grooming.payFull')}</div>
                    {s.description && <div style={{ fontSize: 13, color: '#6b7280' }}>{s.description}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{formatCurrency(Number(s.basePrice))}{Number(s.taxPercent) > 0 ? ` +${s.taxPercent}%` : ''}</div>
                    <button className="module-btn primary small" style={{ marginTop: 6 }}
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
