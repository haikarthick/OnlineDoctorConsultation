import React, { useId } from 'react'
import { useTranslation } from 'react-i18next'

interface NumberStepperProps {
  label: string
  /** Kept as text so a half-typed "8." is not lost; parse with parseStepperValue(). */
  value: string
  onChange: (value: string) => void
  step?: number
  min?: number
  max?: number
  /** Shown after the number: "L", "kg", "eggs". */
  unit?: string
  /** One-tap values, e.g. yesterday's figure and its neighbours. */
  quickValues?: number[]
  /** Whole numbers only (counts) - opens the plain digit keypad instead of the decimal one. */
  integer?: boolean
  hint?: string
  disabled?: boolean
}

/** The number a stepper currently holds, or null when it is empty or not a number. */
export function parseStepperValue(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function format(n: number, integer: boolean): string {
  return integer ? String(Math.round(n)) : String(Math.round(n * 100) / 100)
}

/**
 * A quantity the farmer can set without typing: big minus / plus buttons, one-tap quick values,
 * and a field that opens the digit keypad when they do want to type. Use for litres, kilograms,
 * head counts - anything small and numeric entered standing next to the animal.
 */
export const NumberStepper: React.FC<NumberStepperProps> = ({
  label, value, onChange, step = 1, min = 0, max, unit, quickValues, integer = false, hint, disabled,
}) => {
  const { t } = useTranslation()
  const id = useId()
  const current = parseStepperValue(value)

  const clamp = (n: number) => Math.max(min, max === undefined ? n : Math.min(max, n))
  const bump = (direction: 1 | -1) => onChange(format(clamp((current ?? 0) + direction * step), integer))

  return (
    <div className="num-stepper">
      <label className="num-stepper-label" htmlFor={id}>{label}</label>
      <div className="num-stepper-row">
        <button type="button" className="num-stepper-btn" onClick={() => bump(-1)} disabled={disabled || (current ?? 0) <= min} aria-label={t('mobileUi.stepper.less')}>
          <span aria-hidden="true">−</span>
        </button>
        <div className="num-stepper-field">
          <input
            id={id}
            className="num-stepper-input"
            type="text"
            inputMode={integer ? 'numeric' : 'decimal'}
            autoComplete="off"
            value={value}
            disabled={disabled}
            onChange={e => {
              const next = e.target.value.replace(',', '.')
              if (integer ? /^\d*$/.test(next) : /^\d*\.?\d{0,2}$/.test(next)) onChange(next)
            }}
          />
          {unit && <span className="num-stepper-unit">{unit}</span>}
        </div>
        <button type="button" className="num-stepper-btn" onClick={() => bump(1)} disabled={disabled || (max !== undefined && (current ?? 0) >= max)} aria-label={t('mobileUi.stepper.more')}>
          <span aria-hidden="true">+</span>
        </button>
      </div>
      {hint && <p className="num-stepper-hint">{hint}</p>}
      {quickValues && quickValues.length > 0 && (
        <div className="num-stepper-quick">
          {quickValues.map(q => (
            <button key={q} type="button" className={`choice-chip ${current === q ? 'is-selected' : ''}`} aria-pressed={current === q} disabled={disabled} onClick={() => onChange(format(q, integer))}>
              {format(q, integer)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
