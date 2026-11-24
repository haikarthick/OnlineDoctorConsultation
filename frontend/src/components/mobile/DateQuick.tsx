import React, { useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface DateQuickProps {
  label: string
  /** ISO date, YYYY-MM-DD. */
  value: string
  onChange: (isoDate: string) => void
  /** Latest date allowed; defaults to today (records are about what already happened). */
  max?: string
  /** Adds a Tomorrow chip (a vet starting a course tomorrow). Raise `max` too. */
  allowTomorrow?: boolean
  disabled?: boolean
}

/** Local calendar date as YYYY-MM-DD (not UTC - "today" must be the farmer's today). */
export function localIsoDate(offsetDays = 0, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offsetDays)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * A date that is almost always today: one tap for Today, one for Yesterday, and a calendar only
 * when it is neither. Never make someone open a calendar for the common case.
 */
export const DateQuick: React.FC<DateQuickProps> = ({ label, value, onChange, max, allowTomorrow, disabled }) => {
  const { t } = useTranslation()
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const today = localIsoDate(0)
  const yesterday = localIsoDate(-1)
  const tomorrow = localIsoDate(1)
  const isOther = value !== today && value !== yesterday && !(allowTomorrow && value === tomorrow)

  return (
    <fieldset className="date-quick" disabled={disabled}>
      <legend className="chip-select-label">{label}</legend>
      <div className="chip-select-segmented">
        <button type="button" className={`choice-chip ${value === today ? 'is-selected' : ''}`} aria-pressed={value === today} onClick={() => onChange(today)}>
          {t('mobileUi.date.today')}
        </button>
        <button type="button" className={`choice-chip ${value === yesterday ? 'is-selected' : ''}`} aria-pressed={value === yesterday} onClick={() => onChange(yesterday)}>
          {t('mobileUi.date.yesterday')}
        </button>
        {allowTomorrow && (
          <button type="button" className={`choice-chip ${value === tomorrow ? 'is-selected' : ''}`} aria-pressed={value === tomorrow} onClick={() => onChange(tomorrow)}>
            {t('mobileUi.date.tomorrow')}
          </button>
        )}
        <label htmlFor={id} className={`choice-chip date-quick-other ${isOther ? 'is-selected' : ''}`}>
          <span>{isOther && value ? value : t('mobileUi.date.other')}</span>
          <input
            ref={inputRef}
            id={id}
            className="date-quick-input"
            type="date"
            value={value}
            max={max || today}
            onClick={() => {
              // The input is invisible and sits over the chip. Desktop browsers only focus a date
              // segment on click, so nothing seemed to happen: open the calendar explicitly.
              try { inputRef.current?.showPicker?.() } catch { /* already open or not allowed: the segments still work */ }
            }}
            onChange={e => { if (e.target.value) onChange(e.target.value) }}
          />
        </label>
      </div>
    </fieldset>
  )
}
