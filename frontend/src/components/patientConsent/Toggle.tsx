import React from 'react'

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  note?: string
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, note }) => (
  <div>
    <label className="consent-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="slider" />
      <span>{label}</span>
    </label>
    {note && <p className="pc-warning-note">⚠️ {note}</p>}
  </div>
)

export default Toggle
