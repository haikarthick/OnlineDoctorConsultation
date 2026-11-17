import React from 'react'
import { useTranslation } from 'react-i18next'
import { DateOverride, CalendarDay, buildCalendarGrid, statusKey } from './manageScheduleShared'

interface CalendarTabProps {
  calMonth: { year: number; month: number }
  setCalMonth: React.Dispatch<React.SetStateAction<{ year: number; month: number }>>
  calendarDays: CalendarDay[]
  overrides: DateOverride[]
  todayStr: string
  formatSlotTime: (t: string) => string
  formatDate: (d: string | Date, opts?: Intl.DateTimeFormatOptions) => string
  onOpenVacation: () => void
  onOpenOverride: () => void
  onOpenOverrideForDate: (date: string) => void
  onDeleteOverride: (id: string) => void
}

const LEGEND_STATUSES: { status: CalendarDay['status']; labelKey: string }[] = [
  { status: 'available', labelKey: 'manageSchedule.available' },
  { status: 'custom', labelKey: 'manageSchedule.customHours' },
  { status: 'unavailable', labelKey: 'manageSchedule.dayOff' },
  { status: 'holiday', labelKey: 'manageSchedule.holiday' },
  { status: 'no_schedule', labelKey: 'manageSchedule.noSchedule' },
]

const CalendarTab: React.FC<CalendarTabProps> = ({
  calMonth, setCalMonth, calendarDays, overrides, todayStr, formatSlotTime, formatDate, onOpenVacation, onOpenOverride, onOpenOverrideForDate, onDeleteOverride
}) => {
  const { t } = useTranslation()
  const grid = buildCalendarGrid(calMonth, calendarDays)
  const upcomingOverrides = overrides.filter(o => o.overrideDate >= todayStr)

  return (
    <div>
      <div className="si-101fd1d0">
        <div className="si-0b20392f">
          <button className="btn btn-sm btn-outline" onClick={() => setCalMonth(p => { const m = p.month - 1; return m < 1 ? { year: p.year - 1, month: 12 } : { ...p, month: m } })}>◀</button>
          <h2 className="si-de4136e0">
            {new Date(calMonth.year, calMonth.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h2>
          <button className="btn btn-sm btn-outline" onClick={() => setCalMonth(p => { const m = p.month + 1; return m > 12 ? { year: p.year + 1, month: 1 } : { ...p, month: m } })}>▶</button>
        </div>
        <div className="si-d223efb3">
          <button className="btn btn-outline" onClick={onOpenVacation}>🏖️ {t('manageSchedule.setVacation')}</button>
          <button className="btn btn-primary" onClick={onOpenOverride}>+ {t('manageSchedule.dayOverride')}</button>
        </div>
      </div>

      {/* Legend */}
      <div className="si-f5a443a7">
        {LEGEND_STATUSES.map(l => (
          <div key={l.status} className="si-aace88d4">
            <div className={`ms-legend-swatch status-${statusKey(l.status)}`} />
            <span className={`ms-legend-label status-${statusKey(l.status)}`}>{t(l.labelKey)}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="si-a1d48e67">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="si-ac98329f">{d}</div>
        ))}
        {grid.map((cd, i) => {
          if (!cd) return <div key={`pad-${i}`} />
          const isPast = cd.date < todayStr
          const dayNum = parseInt(cd.date.split('-')[2])
          const isToday = cd.date === todayStr
          return (
            <div key={cd.date} className={`ms-cal-cell status-${statusKey(cd.status)} ${isPast ? 'is-past' : ''}`}
              onClick={() => { if (!isPast) onOpenOverrideForDate(cd.date) }}>
              <div className={`ms-cal-daynum ${isToday ? 'is-today' : ''}`}>{dayNum}</div>
              {cd.status !== 'no_schedule' && !isPast && (
                <div className="ms-cal-status-icon">
                  {cd.status === 'holiday' ? '🎉' : cd.status === 'unavailable' ? '🚫' : cd.status === 'custom' ? '⚙️' : '✅'}
                  {cd.reason && <div className="si-3b8d5aa2" title={cd.reason}>{cd.reason}</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Upcoming Overrides List */}
      <h3 className="si-b1238182">{t('manageSchedule.upcomingDateOverrides')}</h3>
      {upcomingOverrides.length === 0 ? (
        <div className="card si-6c943430">{t('manageSchedule.noUpcomingOverrides')}</div>
      ) : (
        <div className="si-b1691638">
          {upcomingOverrides.map(o => (
            <div key={o.id} className={`card ms-override-card ${o.overrideType === 'unavailable' ? 'type-unavailable' : 'type-custom'}`}>
              <div>
                <strong>{formatDate(o.overrideDate + 'T12:00:00', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                <span className="si-fddef076">
                  {o.overrideType === 'unavailable' ? `🚫 ${t('manageSchedule.dayOff')}` : `⚙️ ${t('manageSchedule.custom')}: ${formatSlotTime(o.startTime || '')}–${formatSlotTime(o.endTime || '')}`}
                </span>
                {o.reason && <span className="si-824a7a1e">({o.reason})</span>}
              </div>
              <button className="btn btn-sm btn-danger" onClick={() => onDeleteOverride(o.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CalendarTab
