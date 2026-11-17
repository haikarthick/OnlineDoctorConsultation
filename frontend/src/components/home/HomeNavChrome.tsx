import { Dispatch, RefObject, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { supportedLanguages } from '../../i18n'
import { WayToVetLogo } from '../WayToVetLogo'

interface HomeNavChromeProps {
  navScrolled: boolean
  activeSection: string
  sectionIds: readonly string[]
  sectionLabel: (id: string) => string
  scrollToSection: (id: string) => void
  scrollToTop: () => void
  showBackToTop: boolean
  sectionsDropdownOpen: boolean
  setSectionsDropdownOpen: Dispatch<SetStateAction<boolean>>
  sectionsDropRef: RefObject<HTMLDivElement>
  langDropdownOpen: boolean
  setLangDropdownOpen: (open: boolean) => void
  langDropRef: RefObject<HTMLDivElement>
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
  onGetStarted: () => void
  onLogin?: () => void
  onBrowseMarketplace: () => void
}

export function HomeNavChrome({
  navScrolled, activeSection, sectionIds, sectionLabel, scrollToSection, scrollToTop, showBackToTop,
  sectionsDropdownOpen, setSectionsDropdownOpen, sectionsDropRef,
  langDropdownOpen, setLangDropdownOpen, langDropRef,
  mobileMenuOpen, setMobileMenuOpen, onGetStarted, onLogin, onBrowseMarketplace,
}: HomeNavChromeProps) {
  const { t, i18n } = useTranslation()
  const currentLang = supportedLanguages.find(l => l.code === i18n.language) || supportedLanguages[0]

  return (
    <>
      {/* Top Navigation Bar */}
      <nav className={`home-nav${navScrolled ? ' home-nav--scrolled' : ''}`}>
        <div className="home-nav-inner">
          <div className="home-nav-brand si-3c1f81b9" onClick={scrollToTop}>
            <WayToVetLogo size={30} variant="full" onDark title={t('common.brand')} />
            <span className="home-nav-badge">{t('common.enterprise')}</span>
          </div>
          <div className="home-nav-center" ref={sectionsDropRef}>
            <button
              className={`home-nav-sections-btn${activeSection !== 'hero' ? ' home-nav-sections-btn--active' : ''}`}
              onClick={() => setSectionsDropdownOpen(prev => !prev)}
              aria-haspopup="true"
              aria-expanded={sectionsDropdownOpen}
            >
              <span className="home-nav-sections-icon">☰</span>
              <span className="home-nav-sections-label">
                {activeSection !== 'hero' ? sectionLabel(activeSection) : t('home.nav.sections')}
              </span>
              <span className={`home-nav-sections-arrow${sectionsDropdownOpen ? ' home-nav-sections-arrow--open' : ''}`}>▾</span>
            </button>
            {sectionsDropdownOpen && (
              <div className="home-nav-sections-dropdown" role="menu">
                {sectionIds.filter(id => id !== 'hero').map(id => (
                  <button
                    key={id}
                    role="menuitem"
                    className={`home-nav-sections-option${activeSection === id ? ' home-nav-sections-option--active' : ''}`}
                    onClick={() => { scrollToSection(id); setSectionsDropdownOpen(false) }}
                  >
                    {activeSection === id && <span className="home-nav-sections-dot" />}
                    {sectionLabel(id)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="home-nav-actions">
            <button className="home-nav-browse" onClick={onBrowseMarketplace} title={t('publicMarketplace.homeCta.browseNow')}>
              🏪 {t('publicMarketplace.homeCta.browseNow')}
            </button>
            <button className="home-nav-signin" onClick={onLogin || (() => {})}>
              {t('home.signIn')}
            </button>
            <button className="home-nav-cta" onClick={onGetStarted} title={t('home.ctaPrimary')}>
              {t('home.ctaPrimary')}
            </button>
            <div className="home-nav-lang-wrapper" ref={langDropRef}>
              <button className="home-nav-lang" onClick={() => setLangDropdownOpen(!langDropdownOpen)}>
                {currentLang.flag} {currentLang.code.toUpperCase()} ▾
              </button>
              {langDropdownOpen && (
                <div className="home-nav-lang-dropdown">
                  {supportedLanguages.map(lang => (
                    <button
                      key={lang.code}
                      className={`home-nav-lang-option${lang.code === i18n.language ? ' home-nav-lang-option--active' : ''}`}
                      onClick={() => { i18n.changeLanguage(lang.code); setLangDropdownOpen(false) }}
                    >
                      {lang.flag} {lang.nativeLabel}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button className="home-nav-mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
            <span className={`nav-hamburger${mobileMenuOpen ? ' nav-hamburger--open' : ''}`} />
          </button>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="home-mobile-menu">
          <div className="home-mobile-menu-sections">
            {sectionIds.filter(id => id !== 'hero').map(id => (
              <button
                key={id}
                className={`home-mobile-menu-link${activeSection === id ? ' home-mobile-menu-link--active' : ''}`}
                onClick={() => { scrollToSection(id); setMobileMenuOpen(false) }}
              >
                {sectionLabel(id)}
              </button>
            ))}
          </div>
          <div className="home-mobile-menu-actions">
            <button className="home-mobile-menu-browse" onClick={() => { onBrowseMarketplace(); setMobileMenuOpen(false) }}>
              🏪 {t('publicMarketplace.homeCta.browseNow')}
            </button>
            <button className="home-mobile-menu-signin" onClick={() => { if (onLogin) onLogin(); setMobileMenuOpen(false) }}>
              {t('home.signIn')}
            </button>
            <button className="home-mobile-menu-cta" onClick={() => { onGetStarted(); setMobileMenuOpen(false) }}>
              {t('home.ctaPrimary')}
            </button>
          </div>
          <div className="home-mobile-menu-lang">
            {supportedLanguages.map(lang => (
              <button
                key={lang.code}
                className={`home-mobile-lang-btn${lang.code === i18n.language ? ' home-mobile-lang-btn--active' : ''}`}
                onClick={() => i18n.changeLanguage(lang.code)}
              >
                {lang.flag} {lang.nativeLabel}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Section Quick-Nav Dots */}
      <div className={`section-dots${showBackToTop ? ' section-dots--visible' : ''}`}>
        {sectionIds.map(id => (
          <button
            key={id}
            className={`section-dot${activeSection === id ? ' section-dot--active' : ''}`}
            onClick={() => scrollToSection(id)}
            title={sectionLabel(id)}
          >
            <span className="section-dot-tooltip">{sectionLabel(id)}</span>
          </button>
        ))}
      </div>

      {/* Back to Top */}
      <button
        className={`back-to-top${showBackToTop ? ' back-to-top--visible' : ''}`}
        onClick={scrollToTop}
        aria-label="Back to top"
        title="Back to top"
      >
        ↑
      </button>
    </>
  )
}
