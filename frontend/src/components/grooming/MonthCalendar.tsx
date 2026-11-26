import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { appLocale } from '../../utils/appLocale'
import { dayState, isoDay, monthCells, shiftMonth } from './monthGrid'
import './MonthCalendar.css'

interface Props {
  providerId: string
  serviceId: string
  /** The chosen day (YYYY-MM-DD) or ''. */
  value: string
  onPick: (isoDate: string) => void
}

interface DayInfo { date: string; hasAvailability: boolean; closedReason?: string }

const todayIso = () => { const d = new Date(); return isoDay(d.getFullYear(), d.getMonth() + 1, d.getDate()) }

/**
 * The grooming booking calendar: one month at a time, each day marked "has free times" or "full / closed" from the provider's real hours,
 * closures and bookings (GET availability/month). A day that is already past cannot be chosen. If the month cannot be checked the days
 * stay tappable - the time step right below still shows the real slots, so a failed check never blocks a booking.
 */
export function MonthCalendar({ providerId, serviceId, value, onPick }: Props) {
  const { t } = useTranslation()
  const now = new Date()
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [days, setDays] = useState<Record<string, DayInfo>>({})
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true); setFailed(false); setDays({})
    apiService.getGroomingMonthAvailability(providerId, cursor.year, cursor.month, { serviceId })
      .then((res: any) => {
        if (!active) return
        const list: DayInfo[] = Array.isArray(res?.data) ? res.data : []
        setDays(Object.fromEntries(list.map(d => [d.date, d])))
      })
      .catch(() => { if (active) setFailed(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [providerId, serviceId, cursor.year, cursor.month])

  const cells = useMemo(() => monthCells(cursor.year, cursor.month), [cursor.year, cursor.month])
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 1 + i).toLocaleDateString(appLocale(), { weekday: 'narrow' })), [])
  const monthName = new Date(cursor.year, cursor.month - 1, 1).toLocaleDateString(appLocale(), { month: 'long', year: 'numeric' })
  const today = todayIso()
  const canGoBack = cursor.year * 12 + cursor.month > now.getFullYear() * 12 + now.getMonth() + 1

  return (
    <div className="gm-calendar">
      <div className="gm-head">
        <button type="button" className="module-btn small" disabled={!canGoBack} onClick={() => setCursor(c => shiftMonth(c.year, c.month, -1))} aria-label={t('groomingCalendar.previous')}>‹</button>
        <strong aria-live="polite">{monthName}</strong>
        <button type="button" className="module-btn small" onClick={() => setCursor(c => shiftMonth(c.year, c.month, 1))} aria-label={t('groomingCalendar.next')}>›</button>
      </div>
      <div className="gm-grid" role="grid" aria-busy={loading}>
        {weekdays.map((w, i) => <span key={i} className="gm-weekday" aria-hidden="true">{w}</span>)}
        {cells.map((d, i) => {
          if (d === null) return <span key={`b${i}`} />
          const iso = isoDay(cursor.year, cursor.month, d)
          const state = dayState(iso, today, days[iso])
          const disabled = state === 'past' || state === 'full'
          return (
            <button key={iso} type="button" role="gridcell" disabled={disabled} aria-pressed={value === iso}
              className={`gm-day is-${state}${value === iso ? ' is-selected' : ''}`}
              title={state === 'full' ? (days[iso]?.closedReason || t('groomingCalendar.full')) : undefined}
              onClick={() => onPick(iso)}>{d}</button>
          )
        })}
      </div>
      <p className="gm-legend">
        {failed ? t('groomingCalendar.unchecked') : loading ? t('groomingCalendar.checking') : t('groomingCalendar.legend')}
      </p>
    </div>
  )
}
