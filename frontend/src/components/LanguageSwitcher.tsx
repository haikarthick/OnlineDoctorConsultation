import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supportedLanguages } from '../i18n'
import './LanguageSwitcher.css'

interface LanguageSwitcherProps {
  collapsed?: boolean
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ collapsed }) => {
  const { i18n } = useTranslation()
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

  return (
    <div className="lang-switcher" ref={ref}>
      <button
        className="lang-switcher-btn"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={collapsed ? current.nativeLabel : undefined}
      >
        <span className="lang-flag" aria-hidden="true">{current.flag}</span>
        {!collapsed && <span className="lang-label">{current.nativeLabel}</span>}
        {!collapsed && <span className="lang-chevron" aria-hidden="true">{open ? '▴' : '▾'}</span>}
      </button>
      {open && (
        <ul className="lang-dropdown" role="listbox" aria-label="Select language">
          {supportedLanguages.map(lang => (
            <li key={lang.code} role="option" aria-selected={lang.code === i18n.language}>
              <button
                className={`lang-option ${lang.code === i18n.language ? 'lang-option-active' : ''}`}
                onClick={() => handleSelect(lang.code)}
              >
                <span className="lang-flag" aria-hidden="true">{lang.flag}</span>
                <span className="lang-option-label">{lang.nativeLabel}</span>
                <span className="lang-option-sub">{lang.label}</span>
                {lang.code === i18n.language && <span className="lang-check" aria-hidden="true">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
