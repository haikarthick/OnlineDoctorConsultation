import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { payGroomingOrderFlow } from '../../utils/groomingCheckout'
import { useSettings } from '../../context/SettingsContext'
import '../../styles/modules.css'

interface Props { onNavigate: (path: string) => void }

interface Slot { startTime: string; endTime: string; isAvailable: boolean; remainingCapacity: number }

function useQuery() {
  const p = new URLSearchParams(window.location.search)
  return { providerId: p.get('providerId') || '', serviceId: p.get('serviceId') || '' }
}

function localDate(d: Date): string {
  // Deliberately NOT toISOString(): that converts to UTC first, so anywhere east of Greenwich
  // "today" becomes yesterday's date for the first hours of the day.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateChips(t: (k: string) => string) {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i)
    return {
      value: localDate(d),
      label: i === 0 ? t('groomingBook.today') : i === 1 ? t('groomingBook.tomorrow')
        : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    }
  })
}

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

  // Real availability, replacing a hardcoded TIMES array that had no connection to the
  // provider's actual hours - it offered 09:00-17:00 on every provider, every day, forever.
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [closedReason, setClosedReason] = useState('')

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
      try {
        const a = await apiService.listAnimals({ limit: 100 })
        setAnimals(a.data?.animals || a.data?.items || (Array.isArray(a.data) ? a.data : []))
      } catch { /* animals optional */ }
    } catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setLoading(false) }
  }, [providerId, serviceId, t])
  useEffect(() => { load() }, [load])

  // Reload slots whenever the chosen date changes; clear any time that is no longer offered.
  useEffect(() => {
    if (!date || !providerId || !serviceId) { setSlots([]); setClosedReason(''); return }
    let cancelled = false
    ;(async () => {
      try {
        setSlotsLoading(true); setClosedReason('')
        const res = await apiService.getGroomingAvailability(providerId, date, { serviceId })
        if (cancelled) return
        const list: Slot[] = res.data?.slots || []
        setSlots(list)
        setClosedReason(res.data?.closedReason || '')
        setTime(prev => (list.some(s => s.startTime === prev && s.isAvailable) ? prev : ''))
      } catch (e: any) {
        if (!cancelled) { setSlots([]); setClosedReason(e?.response?.data?.message || e.message) }
      } finally { if (!cancelled) setSlotsLoading(false) }
    })()
    return () => { cancelled = true }
  }, [date, providerId, serviceId])

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
    } catch (e: any) {
      // The slot can be taken between rendering and submitting, so refresh what is left rather
      // than leaving a stale grid that still shows the time as free.
      setErr(e?.response?.data?.message || e.message)
      if (date) {
        try {
          const res = await apiService.getGroomingAvailability(providerId, date, { serviceId })
          setSlots(res.data?.slots || [])
        } catch { /* the error above is what matters */ }
      }
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="module-page"><div className="loading-container"><div className="loading-spinner" /></div></div>
  if (err && !service) return (
    <div className="module-page">
      <div className="module-alert error">{err}</div>
      <button className="module-btn" onClick={() => onNavigate('/grooming/find')}>← {t('groomingBook.back')}</button>
    </div>
  )

  return (
    <div className="module-page">
      <div className="module-header"><h1>📅 {t('groomingBook.title')}</h1></div>
      {err && <div className="module-alert error">{err}</div>}

      <div className="module-card">
        <h3>{provider?.businessName}</h3>
        <div className="booking-summary-row">
          <span><strong>{service?.name}</strong> · {service?.durationMinutes} {t('groomingBook.minutes')}</span>
          <span className="booking-summary-price">
            {formatCurrency(grand)}{taxPct > 0 ? ` (${t('groomingBook.inclTax')})` : ''}
          </span>
        </div>
      </div>

      {animals.length > 0 && (
        <div className="module-card">
          <label className="module-label" htmlFor="grooming-pet">{t('groomingBook.selectPet')}</label>
          <select id="grooming-pet" className="module-input" value={animalId} onChange={e => setAnimalId(e.target.value)}>
            <option value="">{t('groomingBook.noPet')}</option>
            {animals.map(a => <option key={a.id} value={a.id}>{a.name}{a.species ? ` (${a.species})` : ''}</option>)}
          </select>
        </div>
      )}

      <div className="module-card">
        <label className="module-label">{t('groomingBook.serviceMode')}</label>
        <div className="chip-row">
          {provider?.offersAtPremises && (
            <button className={`module-btn${serviceMode === 'premises' ? ' primary' : ''}`} onClick={() => setServiceMode('premises')}>
              🏠 {t('groomingBook.atPremises')}
            </button>
          )}
          {provider?.offersMobile && (
            <button className={`module-btn${serviceMode === 'mobile' ? ' primary' : ''}`} onClick={() => setServiceMode('mobile')}>
              🚐 {t('groomingBook.mobile')}
            </button>
          )}
        </div>
      </div>

      <div className="module-card">
        <label className="module-label">{t('groomingBook.date')} *</label>
        <div className="chip-row chip-row-scroll">
          {dateChips(t).map(d => (
            <button key={d.value} className={`module-btn small${date === d.value ? ' primary' : ''}`}
              onClick={() => setDate(d.value)}>{d.label}</button>
          ))}
        </div>

        <label className="module-label slot-label">{t('groomingBook.time')} *</label>
        {!date ? <p className="slot-hint">{t('groomingBook.pickDateFirst')}</p>
          : slotsLoading ? <div className="loading-container"><div className="loading-spinner" /></div>
            : closedReason ? <div className="module-alert warning">{closedReason}</div>
              : slots.length === 0 ? <p className="slot-hint">{t('groomingBook.noSlots')}</p>
                : (
                  <>
                    <div className="time-slots-grid">
                      {slots.map(s => (
                        <button key={s.startTime} type="button"
                          className={`time-slot${time === s.startTime ? ' selected' : ''}${s.isAvailable ? '' : ' unavailable'}`}
                          disabled={!s.isAvailable}
                          title={s.isAvailable
                            ? t('groomingBook.slotRange', { start: s.startTime, end: s.endTime })
                            : t('groomingBook.slotFull')}
                          onClick={() => setTime(s.startTime)}>
                          {s.startTime}
                        </button>
                      ))}
                    </div>
                    {time && (
                      <p className="slot-hint">
                        {t('groomingBook.slotRange', {
                          start: time,
                          end: slots.find(s => s.startTime === time)?.endTime || '',
                        })}
                      </p>
                    )}
                  </>
                )}
      </div>

      <div className="module-card">
        <label className="module-label" htmlFor="grooming-notes">{t('groomingBook.handlingNotes')}</label>
        <textarea id="grooming-notes" className="module-input" rows={2} value={handlingNotes}
          onChange={e => setHandlingNotes(e.target.value)} placeholder={t('groomingBook.handlingPlaceholder')} />
        <label className="consent-row">
          <input type="checkbox" checked={consentHandling} onChange={e => setConsentHandling(e.target.checked)} />
          <span>{t('groomingBook.consentHandling')} *</span>
        </label>
        <label className="consent-row">
          <input type="checkbox" checked={consentPhoto} onChange={e => setConsentPhoto(e.target.checked)} />
          <span>{t('groomingBook.consentPhoto')}</span>
        </label>
      </div>

      <div className="module-card booking-sticky-bar">
        <div>
          <strong>{t('groomingBook.total')}: {formatCurrency(grand)}</strong>
        </div>
        <button className="module-btn primary" disabled={!canSubmit} onClick={submit}>
          {submitting ? t('groomingBook.booking') : t('groomingBook.confirmPay')}
        </button>
      </div>
    </div>
  )
}

export default BookGrooming
