import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import '../../styles/modules.css'

interface Props { onNavigate: (path: string) => void; animalId?: string }

const CATS = ['skin', 'coat', 'ears', 'nails', 'teeth'] as const
const SCENT_COLOR: Record<string, { bg: string; color: string; icon: string }> = {
  good: { bg: '#d1fae5', color: '#065f46', icon: '✓' },
  watch: { bg: '#fef3c7', color: '#92400e', icon: '👁' },
  vet_advised: { bg: '#fee2e2', color: '#991b1b', icon: '🩺' },
}

const GroomingPassport: React.FC<Props> = ({ onNavigate, animalId }) => {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    if (!animalId) return
    try { setLoading(true); setErr(''); setData((await apiService.getGroomingPetPassport(animalId)).data) }
    catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setLoading(false) }
  }, [animalId])
  useEffect(() => { load() }, [load])

  if (loading) return <div className="module-page"><div className="loading-container"><div className="loading-spinner" /></div></div>
  if (err || !data) return <div className="module-page"><div className="module-alert error">{err || t('groomingPassport.notFound')}</div></div>

  const { animal, orders, latestScent, vetAdvised } = data

  return (
    <div className="module-page">
      <button className="module-btn" style={{ marginBottom: 12 }} onClick={() => onNavigate('/grooming/my-orders')}>← {t('groomingPassport.back')}</button>
      <div className="module-header"><h1>🐾 {t('groomingPassport.title', { name: animal.name })}</h1></div>
      <p className="si-676930d7">{animal.species}{animal.breed ? ` · ${animal.breed}` : ''}</p>

      {/* Wellness trend */}
      <div className="module-card">
        <h3>{t('groomingPassport.wellness')}</h3>
        <p className="si-676930d7">{t('groomingPassport.wellnessNote')}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {CATS.map(c => {
            const v = latestScent[c]; const s = v ? SCENT_COLOR[v] : { bg: '#f3f4f6', color: '#6b7280', icon: '—' }
            return (
              <div key={c} style={{ flex: '1 1 100px', textAlign: 'center', padding: 12, borderRadius: 10, background: s.bg, color: s.color }}>
                <div style={{ fontSize: 22 }}>{s.icon}</div>
                <div style={{ fontWeight: 700 }}>{t(`groomingDetail.scent${c[0].toUpperCase()}${c.slice(1)}`)}</div>
                <div style={{ fontSize: 12 }}>{v ? t(`groomingScent.${v}`) : t('groomingPassport.noData')}</div>
              </div>
            )
          })}
        </div>
        {vetAdvised && vetAdvised.length > 0 && (
          <div className="module-alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span>🩺 {t('groomingPassport.vetAdvised', { areas: vetAdvised.join(', ') })}</span>
            <button className="btn btn-sm btn-primary" onClick={() => onNavigate(`/book-consultation?animalId=${animal.id}`)}>{t('groomingEsc.bookConsult')}</button>
          </div>
        )}
      </div>

      {/* History */}
      <div className="module-card">
        <h3>{t('groomingPassport.history')}</h3>
        {(!orders || orders.length === 0) ? <p className="si-676930d7">{t('groomingPassport.noHistory')}</p> : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {orders.map((o: any) => (
              <li key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee', flexWrap: 'wrap', gap: 8 }}>
                <span onClick={() => onNavigate(`/grooming/order/${o.id}`)} style={{ cursor: 'pointer' }}>
                  💈 <strong>{o.serviceName}</strong> · {o.providerName} · {o.scheduledDate}
                </span>
                <span>{formatCurrency(Number(o.grandTotal))} · {t(`groomingStatus.${o.status}`, { defaultValue: (o.status || '').replace(/_/g, ' ') })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default GroomingPassport
