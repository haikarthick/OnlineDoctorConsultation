import React from 'react'
import { useTranslation } from 'react-i18next'
import { NAV_SECTIONS } from './systemSettingsShared'

interface Props {
  searchQuery: string
  setSearchQuery: (q: string) => void
  activeSection: string | null
  scrollToSection: (id: string) => void
}

const SettingsNav: React.FC<Props> = ({ searchQuery, setSearchQuery, activeSection, scrollToSection }) => {
  const { t } = useTranslation()
  return (
    <div className="si-b825048d">
      <div className="si-560c8fdf">
        <span className="si-72d04014">🔍</span>
        <input
          type="text"
          placeholder={t('systemSettings.searchPlaceholder')}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="si-22e74dd3"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="si-8b4eab1a"
          >
            Clear
          </button>
        )}
      </div>

      {/* Quick nav pills */}
      <div className="si-9c6e20a7">
        {NAV_SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => scrollToSection(s.id)}
            className={`ss-nav-pill${activeSection === s.id ? ' is-active' : ''}`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default SettingsNav
