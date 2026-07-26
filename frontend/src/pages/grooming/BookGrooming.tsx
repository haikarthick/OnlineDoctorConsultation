import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { payGroomingOrderFlow } from '../../utils/groomingCheckout'
import { useSettings } from '../../context/SettingsContext'
import '../../styles/modules.css'

interface Props { onNavigate: (path: string) => void }

function useQuery() {
  const p = new URLSearchParams(window.location.search)
  return { providerId: p.get('providerId') || '', serviceId: p.get('serviceId') || '' }
}

function dateChips() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i)
    return { value: d.toISOString().split('T')[0], label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) }
  })
}
const TIMES = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00']

const BookGrooming: React.FC<Props> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const { providerId, serviceId } = useQuery()
  const [provider, setProvider] = useState<any>(null)
  const [service, setService] = useState<any>(null)
  const [animals, setAnimals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [animalId, setAnimalId] = useState('')
  const [serviceMode, setServiceMode] = useState('premises')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [handlingNotes, setHandlingNotes] = useState('')
  const [consentHandling, setConsentHandling] = useState(false)
  const [consentPhoto, setConsentPhoto] = useState(true)

  const load = useCallback(async () => {
    if (!providerId || !serviceId) { setErr(t('groomingBook.missingParams')); setLoading(false); return }
    try {
      setLoading(true); setErr('')
      const pv = (await apiService.getPublicGroomingProvider(providerId)).data
      setProvider(pv)
      const svc = (pv.services || []).find((s: any) => s.id === serviceId)
      if (!svc) { setErr(t('groomingBook.serviceUnavailable')); return }
      setService(svc)
      setServiceMode(pv.offersMobile && !pv.offersAtPremises ? 'mobile' : 'premises')
      try { const a = await apiService.listAnimals({ limit: 100 }); setAnimals(a.data?.animals || a.data?.items || (Array.isArray(a.data) ? a.data : [])) } catch { /* animals optional */ }
    } catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setLoading(false) }
  }, [providerId, serviceId])
  useEffect(() => { load() }, [load])

  const price = service ? Number(service.basePrice) : 0
  const taxPct = service ? Number(service.taxPercent) : 0
  const tax = +(price * taxPct / 100).toFixed(2)
  const grand = +(price + tax).toFixed(2)

  const canSubmit = !!date && !!time && consentHandling && !submitting

  const submit = async () => {
    if (!canSubmit) { if (!consentHandling) setErr(t('groomingBook.consentRequired')); return }
    try {
      setSubmitting(true); setErr('')
      const orderRes = await apiService.createGroomingOrder({
        providerId, serviceId, animalId: animalId || undefined, serviceMode,
        scheduledDate: date, timeSlotStart: time, handlingNotes: handlingNotes || undefined,
        consent: { handling: consentHandling, photography: consentPhoto },
      })
      const order = orderRes.data
      // Real gateway checkout (demo auto-confirms; Razorpay opens the widget) + GST invoice
      await payGroomingOrderFlow(order.id, false)
      onNavigate('/grooming/my-orders')
    } catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setSubmitting(false) }
  }

  if (loading) return <div className="module-page"><div className="loading-container"><div className="loading-spinner" /></div></div>
  if (err && !service) return <div className="module-page"><div className="module-alert error">{err}</div>
    <button className="module-btn" onClick={() => onNavigate('/grooming/find')}>← {t('groomingBook.back')}</button></div>

  return (
    <div className="module-page">
      <div className="module-header"><h1>📅 {t('groomingBook.title')}</h1></div>
      {err && <div className="module-alert error">{err}</div>}

      <div className="module-card">
        <h3>{provider?.businessName}</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span><strong>{service?.name}</strong> · {service?.durationMinutes} min</span>
          <span style={{ fontWeight: 700 }}>{formatCurrency(grand)}{taxPct > 0 ? ` (${t('groomingBook.inclTax')})` : ''}</span>
        </div>
      </div>

      {animals.length > 0 && (
        <div className="module-card">
          <label className="module-label">{t('groomingBook.selectPet')}</label>
          <select className="module-input" value={animalId} onChange={e => setAnimalId(e.target.value)}>
            <option value="">{t('groomingBook.noPet')}</option>
            {animals.map(a => <option key={a.id} value={a.id}>{a.name}{a.species ? ` (${a.species})` : ''}</option>)}
          </select>
        </div>
      )}

      <div className="module-card">
        <label className="module-label">{t('groomingBook.serviceMode')}</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {provider?.offersAtPremises && <button className={`module-btn${serviceMode === 'premises' ? ' primary' : ''}`} onClick={() => setServiceMode('premises')}>🏠 {t('groomingBook.atPremises')}</button>}
          {provider?.offersMobile && <button className={`module-btn${serviceMode === 'mobile' ? ' primary' : ''}`} onClick={() => setServiceMode('mobile')}>🚐 {t('groomingBook.mobile')}</button>}
        </div>
      </div>

      <div className="module-card">
        <label className="module-label">{t('groomingBook.date')} *</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {dateChips().map(d => (
            <button key={d.value} className={`module-btn small${date === d.value ? ' primary' : ''}`} onClick={() => setDate(d.value)}>{d.label}</button>
          ))}
        </div>
        <label className="module-label">{t('groomingBook.time')} *</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TIMES.map(tm => <button key={tm} className={`module-btn small${time === tm ? ' primary' : ''}`} onClick={() => setTime(tm)}>{tm}</button>)}
        </div>
      </div>

      <div className="module-card">
        <label className="module-label">{t('groomingBook.handlingNotes')}</label>
        <textarea className="module-input" rows={2} value={handlingNotes} onChange={e => setHandlingNotes(e.target.value)} placeholder={t('groomingBook.handlingPlaceholder')} />
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10 }}>
          <input type="checkbox" checked={consentHandling} onChange={e => setConsentHandling(e.target.checked)} />
          <span>{t('groomingBook.consentHandling')} *</span>
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 6 }}>
          <input type="checkbox" checked={consentPhoto} onChange={e => setConsentPhoto(e.target.checked)} />
          <span>{t('groomingBook.consentPhoto')}</span>
        </label>
      </div>

      <div className="module-card" style={{ position: 'sticky', bottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div><strong>{t('groomingBook.total')}: {formatCurrency(grand)}</strong> <span className="si-676930d7">· {t('groomingBook.demoPay')}</span></div>
        <button className="module-btn primary" disabled={!canSubmit} onClick={submit}>
          {submitting ? t('groomingBook.booking') : t('groomingBook.confirmPay')}
        </button>
      </div>
    </div>
  )
}

export default BookGrooming
