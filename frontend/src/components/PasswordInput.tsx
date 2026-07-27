import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import './PasswordInput.css'

/**
 * Password field with the standard show/hide reveal toggle.
 *
 * Drop-in replacement for `<input type="password" …>` — every input prop is forwarded, so the
 * caller keeps its own id/name/placeholder/autoComplete/validation. `type` is owned by this
 * component and deliberately not accepted.
 *
 * Used across auth screens that sit in three different CSS contexts (Auth.css `.form-group`,
 * `.form-input`, `.invite-form-group`), so the reveal button is positioned by a wrapper of our
 * own rather than by the host page's styles.
 */
type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>

const EyeIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeOffIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

export const PasswordInput: React.FC<PasswordInputProps> = ({ className, ...inputProps }) => {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  const label = visible ? t('common.hidePassword') : t('common.showPassword')

  return (
    <div className="password-field">
      <input
        {...inputProps}
        type={visible ? 'text' : 'password'}
        className={className ? `password-field-input ${className}` : 'password-field-input'}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible(v => !v)}
        aria-pressed={visible}
        aria-label={label}
        title={label}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}

export default PasswordInput
