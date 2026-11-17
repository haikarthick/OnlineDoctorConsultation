import { TFunction } from 'i18next'
import { TimeOfDay, getDateChips, formatDateLabel } from './findDoctorShared'

interface AvailabilityPanelProps {
  selectedDate: string
  timeOfDay: TimeOfDay
  t: TFunction
  onSelectDate: (date: string) => void
  onSelectTimeOfDay: (timeOfDay: TimeOfDay) => void
  onClearDate: () => void
}

const TIME_OF_DAY_OPTIONS: { key: TimeOfDay; label: string; sub?: string }[] = [
  { key: '',          label: 'Any time' },
  { key: 'morning',   label: '🌅 Morning',   sub: '8am-12pm' },
  { key: 'afternoon', label: '☀️ Afternoon', sub: '12pm-5pm' },
  { key: 'evening',   label: '🌆 Evening',   sub: '5pm-8pm'  },
]

export default function AvailabilityPanel({ selectedDate, timeOfDay, t, onSelectDate, onSelectTimeOfDay, onClearDate }: AvailabilityPanelProps) {
  const dateChips = getDateChips()

  return (
    <div className="si-32fdb2f0">
      {/* Panel header */}
      <div className="si-eab13361">
        <div>
          <span className="si-135ec834">📅 {t('findDoctor.findByAvailability')}</span>
          <span className="si-98e040aa">
            {selectedDate ? t('findDoctor.filteringTo', { date: formatDateLabel(selectedDate) }) : t('findDoctor.pickDate')}
          </span>
        </div>
        {selectedDate && (
          <button onClick={onClearDate} className="si-030751bf">✕ {t('findDoctor.clearDate')}</button>
        )}
      </div>

      {/* Date chips */}
      <div className="si-8be018fb">
        {dateChips.map(({ dateStr, label }) => {
          const active = selectedDate === dateStr
          return (
            <button key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className={`fd-chip fd-chip-date ${active ? 'is-active' : ''}`}>
              {label}
            </button>
          )
        })}
        <input
          type="date"
          value={selectedDate}
          min={new Date().toISOString().split('T')[0]}
          onChange={e => onSelectDate(e.target.value)}
          className="si-4efb60c9"
        />
      </div>

      {/* Time-of-day filter */}
      <div className="si-c94c5bb2">
        <span className="si-c96f2222">🕐 Time:</span>
        {TIME_OF_DAY_OPTIONS.map(({ key, label, sub }) => {
          const active = timeOfDay === key
          return (
            <button key={key || 'any'} onClick={() => onSelectTimeOfDay(key)}
              className={`fd-chip fd-chip-time ${active ? 'is-active' : ''}`}>
              {label}{active && sub ? <span className="si-b23916fa">{sub}</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
