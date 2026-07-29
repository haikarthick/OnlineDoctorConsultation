import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import '../../styles/modules.css'

interface Props { onNavigate: (path: string) => void; animalId?: string }

const CATS = ['skin', 'coat', 'ears', 'nails', 'teeth'] as const
/** Modifier class + icon per S.C.E.N.T. rating; the colours live in modules.css. */
const SCENT_UI: Record<string, { cls: string; icon: string }> = {
  good: { cls: 'is-good', icon: '✓' },
  watch: { cls: 'is-watch', icon: '👁' },
  vet_advised: { cls: 'is-vet-advised', icon: '🩺' },
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
      <button className="module-btn back-link" onClick={() => onNavigate('/grooming/my-orders')}>
        ← {t('groomingPassport.back')}
      </button>
      <div className="module-header"><h1>🐾 {t('groomingPassport.title', { name: animal.name })}</h1></div>
      <p className="page-subtitle">{animal.species}{animal.breed ? ` · ${animal.breed}` : ''}</p>

      {/* Wellness trend */}
      <div className="module-card">
        <h3>{t('groomingPassport.wellness')}</h3>
        <p className="slot-hint">{t('groomingPassport.wellnessNote')}</p>
        <div className="scent-grid">
          {CATS.map(c => {
            const v = latestScent[c]
            const ui = v ? SCENT_UI[v] : null
            return (
              <div key={c} className={`scent-tile ${ui ? ui.cls : 'is-unknown'}`}>
                <div className="scent-tile-icon">{ui ? ui.icon : '—'}</div>
                <div className="scent-tile-label">{t(`groomingDetail.scent${c[0].toUpperCase()}${c.slice(1)}`)}</div>
                <div className="scent-tile-value">{v ? t(`groomingScent.${v}`) : t('groomingPassport.noData')}</div>
              </div>
            )
          })}
        </div>
        {vetAdvised && vetAdvised.length > 0 && (
          <div className="module-alert error vet-advised-banner">
            <span>🩺 {t('groomingPassport.vetAdvised', { areas: vetAdvised.join(', ') })}</span>
            <button className="btn btn-sm btn-primary" onClick={() => onNavigate(`/book-consultation?animalId=${animal.id}`)}>
              {t('groomingEsc.bookConsult')}
            </button>
          </div>
        )}
      </div>

      {/* History */}
      <div className="module-card">
        <h3>{t('groomingPassport.history')}</h3>
        {(!orders || orders.length === 0) ? <p className="slot-hint">{t('groomingPassport.noHistory')}</p> : (
          <ul className="history-list">
            {orders.map((o: any) => (
              <li key={o.id}>
                {/* A real button, not a click handler on a span — the row navigates, so it must
                    be reachable and activatable from the keyboard. */}
                <button type="button" className="link-button" onClick={() => onNavigate(`/grooming/order/${o.id}`)}>
                  💈 <strong>{o.serviceName}</strong> · {o.providerName} · {o.scheduledDate}
                </button>
                <span>
                  {formatCurrency(Number(o.grandTotal))} ·{' '}
                  {t(`groomingStatus.${o.status}`, { defaultValue: (o.status || '').replace(/_/g, ' ') })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default GroomingPassport
