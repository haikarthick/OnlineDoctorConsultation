import React, { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supportedLanguages } from '../i18n'
import './FloatingLanguageSelector.css'

const FloatingLanguageSelector: React.FC = () => {
  const { i18n } = useTranslation()
  const { user } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = supportedLanguages.find(l => l.code === i18n.language) || supportedLanguages[0]

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (code: string) => {
    i18n.changeLanguage(code)
    setOpen(false)
  }

  // Authenticated users have the language switcher in the sidebar
  if (user) return null
  // Home page has its own embedded language switcher in the nav bar
  if (location.pathname === '/') return null

  return (
    <div className="floating-lang" ref={ref}>
      <button
        className="floating-lang-btn"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Change language"
        title={current.nativeLabel}
      >
        <span className="floating-lang-flag">{current.flag}</span>
        <span className="floating-lang-code">{current.code.toUpperCase()}</span>
      </button>
      {open && (
        <ul className="floating-lang-dropdown" role="listbox" aria-label="Select language">
          {supportedLanguages.map(lang => (
            <li key={lang.code} role="option" aria-selected={lang.code === i18n.language}>
              <button
                className={`floating-lang-option${lang.code === i18n.language ? ' floating-lang-option--active' : ''}`}
                onClick={() => handleSelect(lang.code)}
              >
                <span className="floating-lang-option-flag">{lang.flag}</span>
                <span className="floating-lang-option-native">{lang.nativeLabel}</span>
                <span className="floating-lang-option-en">{lang.label}</span>
                {lang.code === i18n.language && <span className="floating-lang-check">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default FloatingLanguageSelector
