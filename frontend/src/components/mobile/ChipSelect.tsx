

export interface ChipOption<T extends string = string> {
  value: T
  label: string
  icon?: string
}

interface ChipSelectProps<T extends string = string> {
  /** Visible question, e.g. "Which animal?" - also names the group for screen readers. */
  label: string
  options: ChipOption<T>[]
  value: T | '' | null | undefined
  onChange: (value: T) => void
  /** 'chips' wraps freely (default); 'segmented' is an equal-width bar for 2-3 choices. */
  variant?: 'chips' | 'segmented'
  /** Tapping the selected chip again clears it (for optional questions). */
  allowClear?: boolean
  onClear?: () => void
  disabled?: boolean
}

/**
 * Tap-to-choose for a short list (about six options or fewer) - use this instead of a <select>
 * on any screen used on a phone: one tap, no dropdown, every option visible. For long lists
 * (breeds, animals) use a searchable picker instead.
 */
export function ChipSelect<T extends string = string>({
  label, options, value, onChange, variant = 'chips', allowClear, onClear, disabled,
}: ChipSelectProps<T>) {
  return (
    <fieldset className="chip-select" disabled={disabled}>
      <legend className="chip-select-label">{label}</legend>
      <div className={variant === 'segmented' ? 'chip-select-segmented' : 'chip-select-chips'}>
        {options.map(option => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              className={`choice-chip ${selected ? 'is-selected' : ''}`}
              aria-pressed={selected}
              onClick={() => (selected && allowClear && onClear ? onClear() : onChange(option.value))}
            >
              {option.icon && <span className="choice-chip-icon" aria-hidden="true">{option.icon}</span>}
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
