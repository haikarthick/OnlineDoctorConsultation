import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supportedLanguages } from '../i18n'
import './Home.css'

interface HomeProps {
  onGetStarted: () => void
  onViewForDoctors: () => void
  onLogin?: () => void
}

const SECTION_IDS = ['hero', 'enterprises', 'hospitals', 'features', 'workflow', 'compliance', 'how-it-works', 'testimonials'] as const

const NAV_KEY_MAP: Record<string, string> = {
  hero: 'home', enterprises: 'enterprises', hospitals: 'hospitals', features: 'features',
  workflow: 'workflow', compliance: 'compliance', 'how-it-works': 'howItWorks', testimonials: 'testimonials'
}

export default function Home({ onGetStarted, onViewForDoctors, onLogin }: HomeProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'owner' | 'enterprise' | 'vet' | 'hospital'>('owner')
  const [activeSection, setActiveSection] = useState('hero')
  const [scrollProgress, setScrollProgress] = useState(0)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [navScrolled, setNavScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [langDropdownOpen, setLangDropdownOpen] = useState(false)
  const [sectionsDropdownOpen, setSectionsDropdownOpen] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const langDropRef = useRef<HTMLDivElement>(null)
  const sectionsDropRef = useRef<HTMLDivElement>(null)
  const currentLang = supportedLanguages.find(l => l.code === i18n.language) || supportedLanguages[0]

  const sectionLabel = (id: string) => t(`home.nav.${NAV_KEY_MAP[id] || id}`)

  // Close lang + sections dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langDropRef.current && !langDropRef.current.contains(e.target as Node)) {
        setLangDropdownOpen(false)
      }
      if (sectionsDropRef.current && !sectionsDropRef.current.contains(e.target as Node)) {
        setSectionsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Scroll progress + back-to-top + nav shadow
  const handleScroll = useCallback(() => {
    const scrollTop = window.scrollY
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    setScrollProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0)
    setShowBackToTop(scrollTop > 500)
    setNavScrolled(scrollTop > 20)
  }, [])

  // IntersectionObserver for active section
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length > 0) {
          // Pick the one with the highest intersection ratio
          const best = visible.reduce((a, b) => a.intersectionRatio > b.intersectionRatio ? a : b)
          setActiveSection(best.target.id)
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5] }
    )

    // Observe all sections with IDs
    setTimeout(() => {
      SECTION_IDS.forEach(id => {
        const el = document.getElementById(id)
        if (el) observerRef.current?.observe(el)
      })
    }, 100)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      observerRef.current?.disconnect()
    }
  }, [handleScroll])

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  const benefitIcons = {
    owner: ['⏰', '🩺', '💬', '📋', '💰', '⚡'],
    enterprise: ['🏢', '🐄', '💉', '📊', '🔔', '🌐'],
    vet: ['👥', '📊', '💵', '🛡️', '📱', '🌍'],
    hospital: ['🏥', '👨‍⚕️', '🗂️', '📅', '🚨', '⭐'],
  }

  const benefitKeyMap: Record<string, string> = {
    owner: 'ownerBenefits', enterprise: 'enterpriseBenefits', vet: 'vetBenefits', hospital: 'hospitalBenefits'
  }

  const enterpriseTypes = [
    { icon: '🐄', key: 'dairyFarms' }, { icon: '🐔', key: 'poultry' }, { icon: '🐎', key: 'equestrian' },
    { icon: '🐟', key: 'aquaculture' }, { icon: '🦁', key: 'zoosWildlife' }, { icon: '🐕', key: 'kennels' },
    { icon: '🐈', key: 'catteries' }, { icon: '🏇', key: 'breeding' }, { icon: '🦜', key: 'aviaries' },
    { icon: '🐑', key: 'ranches' }, { icon: '🏥', key: 'vetClinics' }, { icon: '🌿', key: 'sanctuaries' }
  ]

  const statsData = [
    { number: '50K+', key: 'petOwners' }, { number: '3K+', key: 'enterprises' },
    { number: '500+', key: 'hospitals' }, { number: '2K+', key: 'verifiedVets' },
    { number: '2M+', key: 'animalsManaged' }, { number: '4.9★', key: 'avgRating' }
  ]

  const featureIcons = {
    advanced: ['📊', '🧬', '⚖️', '📡', '📜', '💹'],
    innovation: ['🧠', '🧬', '📡', '🔗', '👷', '📊'],
    intelligence: ['🤖', '🔮', '🏪', '🌱', '💚', '🗺️'],
    workflow: ['📋', '🔄', '🔀', '🛏️', '👥', '📊'],
    compliance: ['🛡️', '📜', '🔐', '🔒', '👁️', '📊']
  }

  const stepIcons = {
    owner: ['📝', '🐾', '📹', '💊'],
    enterprise: ['🏢', '📍', '🐄', '📊'],
    hospital: ['👨‍⚕️', '🏥', '👥', '📅'],
    vet: ['📋', '🕐', '🩺', '💹']
  }

  return (
    <div className="home-page">
      {/* Scroll Progress Bar */}
      <div className="scroll-progress" style={{ width: `${scrollProgress}%` }} />

      {/* Top Navigation Bar */}
      <nav className={`home-nav${navScrolled ? ' home-nav--scrolled' : ''}`}>
        <div className="home-nav-inner">
          <div className="home-nav-brand si-3c1f81b9" onClick={scrollToTop}>
            <span className="home-nav-logo">🏥</span>
            <span className="home-nav-title">{t('common.brand')}</span>
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
                {SECTION_IDS.filter(id => id !== 'hero').map(id => (
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
            <button className="home-nav-browse" onClick={() => navigate('/browse-marketplace')} title={t('publicMarketplace.homeCta.browseNow')}>
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
            {SECTION_IDS.filter(id => id !== 'hero').map(id => (
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
            <button className="home-mobile-menu-browse" onClick={() => { navigate('/browse-marketplace'); setMobileMenuOpen(false) }}>
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
        {SECTION_IDS.map(id => (
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

      {/* Hero Section */}
      <section className="hero-section" id="hero">
        <div className="hero-content">
          <div className="hero-text">
            <div className="hero-tag">{t('common.trustBadge')}</div>
            <h1 className="hero-title">
              {t('home.heroTitle')}
            </h1>
            <p className="hero-subtitle">
              {t('home.heroSubtitle')}
            </p>
            <div className="hero-buttons">
              <button className="btn btn-primary btn-large" onClick={onGetStarted}>
                {t('home.ctaPrimary')}
              </button>
              <button className="btn btn-enterprise btn-large" onClick={onGetStarted}>
                {t('home.ctaEnterprise')}
              </button>
              <button className="btn btn-hospital btn-large" onClick={() => { onGetStarted() }}>
                🏥 {t('home.registerHospital')}
              </button>
              <button className="btn btn-secondary-outline btn-large" onClick={onViewForDoctors}>
                {t('home.ctaVet')}
              </button>
              <button className="btn btn-marketplace btn-large" onClick={() => navigate('/browse-marketplace')}>
                🏪 {t('publicMarketplace.homeCta.browseNow')}
              </button>
            </div>
            <p className="hero-subtext">
              {t('home.guarantees')}
            </p>
            <div className="si-50ec4078">
              <span className="si-26d9a494">🛡️ {t('home.heroBadge1')}</span>
              <span className="si-4dee5e15">🔒 {t('home.heroBadge2')}</span>
              <span className="si-2b77bd57">📜 {t('home.heroBadge3')}</span>
            </div>
            <p className="hero-login-link">
              {t('home.signinLink').split('→')[0]} <button className="link-button" onClick={onLogin || (() => {})}>{t('home.signIn')} →</button>
            </p>
          </div>
          <div className="hero-visual">
            <div className="hero-card hero-card-1">
              <span className="hero-card-icon">🐄</span>
              <div className="hero-card-text">
                <strong>{t('home.heroCard1Title')}</strong>
                <small>{t('home.heroCard1Sub')}</small>
              </div>
            </div>
            <div className="hero-card hero-card-2">
              <span className="hero-card-icon">💉</span>
              <div className="hero-card-text">
                <strong>{t('home.heroCard2Title')}</strong>
                <small>{t('home.heroCard2Sub')}</small>
              </div>
            </div>
            <div className="hero-card hero-card-3">
              <span className="hero-card-icon">📹</span>
              <div className="hero-card-text">
                <strong>{t('home.heroCard3Title')}</strong>
                <small>{t('home.heroCard3Sub')}</small>
              </div>
            </div>
            <div className="hero-icon-large">🏥</div>
            <div className="hero-badge">{t('home.heroBadge')}</div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="stats-container">
          {statsData.map((stat, idx) => (
            <div key={idx} className="stat-item">
              <div className="stat-number">{stat.number}</div>
              <div className="stat-label">{t(`home.stats.${stat.key}`)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Enterprise Types */}
      <section className="enterprise-types-section" id="enterprises">
        <h2 className="section-title">{t('home.pageTitle')}</h2>
        <p className="section-subtitle">{t('home.enterpriseSubtitle')}</p>
        <div className="enterprise-types-grid">
          {enterpriseTypes.map((etype, idx) => (
            <div key={idx} className="enterprise-type-card">
              <span className="enterprise-type-icon">{etype.icon}</span>
              <span className="enterprise-type-label">{t(`home.enterpriseTypesGrid.${etype.key}`)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Vet Hospitals Section */}
      <section className="hospitals-section" id="hospitals">
        <h2 className="section-title">🏥 {t('home.hospitalTitle')}</h2>
        <p className="section-subtitle">{t('home.hospitalSubtitle')}</p>

        <div className="hospitals-stats-row">
          <div className="hosp-stat"><span className="hosp-stat-number">500+</span><span className="hosp-stat-label">{t('home.hospitalStats.hospitals')}</span></div>
          <div className="hosp-stat"><span className="hosp-stat-number">2,000+</span><span className="hosp-stat-label">{t('home.hospitalStats.doctorsNetworked')}</span></div>
          <div className="hosp-stat"><span className="hosp-stat-number">50+</span><span className="hosp-stat-label">{t('home.hospitalStats.specialties')}</span></div>
          <div className="hosp-stat"><span className="hosp-stat-number">4.8★</span><span className="hosp-stat-label">{t('home.hospitalStats.avgRating')}</span></div>
        </div>

        <div className="hospitals-content">
          <div className="hospitals-feature-grid">
            <div className="hosp-feat-card">
              <div className="hosp-feat-icon">🏥</div>
              <h3>{t('home.hospitalFeatures.profileTitle')}</h3>
              <p>{t('home.hospitalFeatures.profileDesc')}</p>
            </div>
            <div className="hosp-feat-card">
              <div className="hosp-feat-icon">👨‍⚕️</div>
              <h3>{t('home.hospitalFeatures.multiDoctorTitle')}</h3>
              <p>{t('home.hospitalFeatures.multiDoctorDesc')}</p>
            </div>
            <div className="hosp-feat-card">
              <div className="hosp-feat-icon">🗂️</div>
              <h3>{t('home.hospitalFeatures.departmentsTitle')}</h3>
              <p>{t('home.hospitalFeatures.departmentsDesc')}</p>
            </div>
            <div className="hosp-feat-card">
              <div className="hosp-feat-icon">🚨</div>
              <h3>{t('home.hospitalFeatures.emergencyTitle')}</h3>
              <p>{t('home.hospitalFeatures.emergencyDesc')}</p>
            </div>
            <div className="hosp-feat-card">
              <div className="hosp-feat-icon">📅</div>
              <h3>{t('home.hospitalFeatures.bookingTitle')}</h3>
              <p>{t('home.hospitalFeatures.bookingDesc')}</p>
            </div>
            <div className="hosp-feat-card">
              <div className="hosp-feat-icon">⭐</div>
              <h3>{t('home.hospitalFeatures.reviewsTitle')}</h3>
              <p>{t('home.hospitalFeatures.reviewsDesc')}</p>
            </div>
          </div>

          <div className="hospitals-cta-box">
            <div className="hosp-cta-info">
              <h3>{t('home.hospitalCta.title')}</h3>
              <p>{t('home.hospitalCta.desc')}</p>
              <div className="hosp-cta-steps">
                <span className="hosp-step-chip">1️⃣ {t('home.hospitalCta.step1')}</span>
                <span className="hosp-step-arrow">→</span>
                <span className="hosp-step-chip">2️⃣ {t('home.hospitalCta.step2')}</span>
                <span className="hosp-step-arrow">→</span>
                <span className="hosp-step-chip">3️⃣ {t('home.hospitalCta.step3')}</span>
                <span className="hosp-step-arrow">→</span>
                <span className="hosp-step-chip">4️⃣ {t('home.hospitalCta.step4')}</span>
              </div>
            </div>
            <div className="hosp-cta-buttons">
              <button className="btn btn-primary btn-large" onClick={onGetStarted}>
                🏥 {t('home.registerHospital')}
              </button>
              <button className="btn btn-secondary-outline btn-large" onClick={onGetStarted}>
                🔍 {t('home.browseHospitals')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Marketplace Browse CTA */}
      <section className="marketplace-cta-section">
        <div className="marketplace-cta-content">
          <div className="marketplace-cta-text">
            <h2 className="section-title">🏪 {t('publicMarketplace.homeCta.title')}</h2>
            <p className="section-subtitle">{t('publicMarketplace.homeCta.subtitle')}</p>
            <div className="marketplace-cta-features">
              <span className="marketplace-cta-chip">🐄 {t('publicMarketplace.homeCta.livestock')}</span>
              <span className="marketplace-cta-chip">🌾 {t('publicMarketplace.homeCta.feed')}</span>
              <span className="marketplace-cta-chip">🔧 {t('publicMarketplace.homeCta.equipment')}</span>
              <span className="marketplace-cta-chip">💊 {t('publicMarketplace.homeCta.medicine')}</span>
              <span className="marketplace-cta-chip">🧬 {t('publicMarketplace.homeCta.genetics')}</span>
              <span className="marketplace-cta-chip">🩺 {t('publicMarketplace.homeCta.services')}</span>
            </div>
          </div>
          <div className="marketplace-cta-buttons">
            <button className="btn btn-primary btn-large" onClick={() => navigate('/browse-marketplace')}>
              🛒 {t('publicMarketplace.homeCta.browseNow')}
            </button>
            <button className="btn btn-secondary-outline btn-large" onClick={onGetStarted}>
              📝 {t('publicMarketplace.homeCta.sellYours')}
            </button>
          </div>
        </div>
      </section>

      {/* Features Tabs Section */}
      <section className="features-section" id="features">
        <h2 className="section-title">{t('home.featuresTitle')}</h2>
        
        <div className="tabs-container">
          <button className={`tab-button ${activeTab === 'owner' ? 'active' : ''}`} onClick={() => setActiveTab('owner')}>
            🐕 {t('home.tabs.petOwners')}
          </button>
          <button className={`tab-button ${activeTab === 'enterprise' ? 'active' : ''}`} onClick={() => setActiveTab('enterprise')}>
            🏢 {t('home.tabs.enterprises')}
          </button>
          <button className={`tab-button ${activeTab === 'hospital' ? 'active' : ''}`} onClick={() => setActiveTab('hospital')}>
            🏥 {t('home.tabs.hospitals')}
          </button>
          <button className={`tab-button ${activeTab === 'vet' ? 'active' : ''}`} onClick={() => setActiveTab('vet')}>
            👨‍⚕️ {t('home.tabs.vets')}
          </button>
        </div>

        <div className="benefits-grid">
          {benefitIcons[activeTab].map((icon, idx) => (
            <div key={idx} className="benefit-card">
              <div className="benefit-icon">{icon}</div>
              <h3 className="benefit-title">{t(`home.${benefitKeyMap[activeTab]}.${idx}.title`)}</h3>
              <p className="benefit-description">{t(`home.${benefitKeyMap[activeTab]}.${idx}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Advanced Enterprise Capabilities */}
      <section className="advanced-features-section">
        <h2 className="section-title">{t('home.advancedTitle')}</h2>
        <p className="section-subtitle">{t('home.advancedSubtitle')}</p>
        <div className="advanced-grid">
          {featureIcons.advanced.map((icon, idx) => (
            <div key={idx} className="advanced-card">
              <div className="advanced-icon">{icon}</div>
              <h3>{t(`home.advancedFeatures.${idx}.title`)}</h3>
              <p>{t(`home.advancedFeatures.${idx}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Next-Generation Innovation */}
      <section className="advanced-features-section si-e41618a7">
        <h2 className="section-title si-f46f8eb4">🚀 {t('home.innovationTitle')}</h2>
        <p className="section-subtitle si-385f4f50">{t('home.innovationSubtitle')}</p>
        <div className="advanced-grid">
          {featureIcons.innovation.map((icon, idx) => (
            <div key={idx} className="advanced-card si-e5cef6dc">
              <div className="advanced-icon">{icon}</div>
              <h3 className="si-f46f8eb4">{t(`home.innovationFeatures.${idx}.title`)}</h3>
              <p className="si-385f4f50">{t(`home.innovationFeatures.${idx}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Futuristic Intelligence */}
      <section className="advanced-features-section si-50901860">
        <h2 className="section-title si-f46f8eb4">🔮 {t('home.intelligenceTitle')}</h2>
        <p className="section-subtitle si-212a770e">{t('home.intelligenceSubtitle')}</p>
        <div className="advanced-grid">
          {featureIcons.intelligence.map((icon, idx) => (
            <div key={idx} className="advanced-card si-b6538183">
              <div className="advanced-icon">{icon}</div>
              <h3 className="si-f46f8eb4">{t(`home.intelligenceFeatures.${idx}.title`)}</h3>
              <p className="si-212a770e">{t(`home.intelligenceFeatures.${idx}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Staff & Workflow Management */}
      <section className="advanced-features-section si-e35d7e85" id="workflow">
        <h2 className="section-title si-f46f8eb4">🏥 {t('home.workflowTitle')}</h2>
        <p className="section-subtitle si-5d8fd676">{t('home.workflowSubtitle')}</p>
        <div className="si-d0c03892">
          {[0, 1, 2, 3, 4].map(i => (
            <span key={i} className="si-cbb16502">{t(`home.workflowChips.${i}`)}</span>
          ))}
        </div>
        <div className="advanced-grid">
          {featureIcons.workflow.map((icon, idx) => (
            <div key={idx} className="advanced-card si-b6538183">
              <div className="advanced-icon">{icon}</div>
              <h3 className="si-f46f8eb4">{t(`home.workflowFeatures.${idx}.title`)}</h3>
              <p className="si-5d8fd676">{t(`home.workflowFeatures.${idx}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HIPAA Compliance & Data Privacy */}
      <section className="advanced-features-section si-042ced1c" id="compliance">
        <h2 className="section-title si-f46f8eb4">🛡️ {t('home.complianceTitle')}</h2>
        <p className="section-subtitle si-674d8d14">{t('home.complianceSubtitle')}</p>

        <div className="si-dc432d6d">
          {[
            { icon: '🏥', key: 0 },
            { icon: '🔐', key: 1 },
            { icon: '📜', key: 2 },
            { icon: '🔒', key: 3 },
          ].map((badge) => (
            <div key={badge.key} className="si-2accc4ba">
              <span>{badge.icon}</span> {t(`home.complianceBadges.${badge.key}`)}
            </div>
          ))}
        </div>

        <div className="advanced-grid">
          {featureIcons.compliance.map((icon, idx) => (
            <div key={idx} className="advanced-card si-b6538183">
              <div className="advanced-icon">{icon}</div>
              <h3 className="si-f46f8eb4">{t(`home.complianceFeatures.${idx}.title`)}</h3>
              <p className="si-674d8d14">{t(`home.complianceFeatures.${idx}.desc`)}</p>
            </div>
          ))}
        </div>

        <div className="si-74627804">
          <p className="si-590e8f62">
            <strong className="si-f46f8eb4">{t('home.dataPrivacyTitle')}</strong> {t('home.dataPrivacyText')}
          </p>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section" id="how-it-works">
        <h2 className="section-title">{t('home.howItWorksTitle')}</h2>
        
        <div className="tabs-container si-9f0a8269">
          <button className={`tab-button ${activeTab === 'owner' ? 'active' : ''}`} onClick={() => setActiveTab('owner')}>
            🐕 {t('home.tabs.petOwners')}
          </button>
          <button className={`tab-button ${activeTab === 'enterprise' ? 'active' : ''}`} onClick={() => setActiveTab('enterprise')}>
            🏢 {t('home.tabs.enterprises')}
          </button>
          <button className={`tab-button ${activeTab === 'hospital' ? 'active' : ''}`} onClick={() => setActiveTab('hospital')}>
            🏥 {t('home.tabs.hospitals')}
          </button>
          <button className={`tab-button ${activeTab === 'vet' ? 'active' : ''}`} onClick={() => setActiveTab('vet')}>
            👨‍⚕️ {t('home.tabs.vets')}
          </button>
        </div>

        <div className="steps-container">
          {stepIcons[activeTab].map((icon, idx) => {
            const tabKey = activeTab === 'owner' ? 'owner' : activeTab === 'enterprise' ? 'enterprise' : activeTab === 'hospital' ? 'hospital' : 'vet'
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <div className="step-arrow">→</div>}
                <div className="step-card">
                  <div className="step-number">{idx + 1}</div>
                  <h3>{t(`home.steps.${tabKey}.${idx}.title`)}</h3>
                  <p>{t(`home.steps.${tabKey}.${idx}.desc`)}</p>
                  <div className="step-icon">{icon}</div>
                </div>
              </React.Fragment>
            )
          })}
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="testimonials-section" id="testimonials">
        <h2 className="section-title">{t('home.testimonialsTitle')}</h2>
        <div className="testimonials-grid">
          {['👩', '👨‍🌾', '👨‍⚕️', '👩‍💼', '👩‍⚕️', '👨‍💼'].map((image, idx) => (
            <div key={idx} className="testimonial-card">
              <div className="testimonial-header">
                <div className="testimonial-avatar">{image}</div>
                <div className="testimonial-info">
                  <h4 className="testimonial-name">{t(`home.testimonials.${idx}.name`)}</h4>
                  <p className="testimonial-role">{t(`home.testimonials.${idx}.role`)}</p>
                </div>
              </div>
              <div className="testimonial-rating">{'⭐'.repeat(5)}</div>
              <p className="testimonial-text">"{t(`home.testimonials.${idx}.text`)}"</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>{t('home.ctaTitle')}</h2>
          <p>{t('home.ctaSubtitle')}</p>
          <div className="cta-buttons">
            <button className="btn btn-primary btn-large" onClick={onGetStarted}>
              {t('home.ctaPrimary')}
            </button>
            <button className="btn btn-enterprise btn-large" onClick={onGetStarted}>
              🏢 {t('home.enterpriseTrial')}
            </button>
            <button className="btn btn-hospital btn-large" onClick={onGetStarted}>
              🏥 {t('home.registerHospital')}
            </button>
            <button className="btn btn-secondary-outline btn-large" onClick={onViewForDoctors}>
              {t('home.ctaVet')}
            </button>
          </div>
          <p className="cta-login">
            {t('register.alreadyMember')} <button className="link-button" onClick={onLogin || (() => {})}>{t('home.signIn')} →</button>
          </p>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="home-footer" id="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span>🏥</span> <strong>{t('home.footer.brand')}</strong>
            <span className="si-3a41c16c">{t('home.footer.hipaa')}</span>
          </div>
          <p>{t('home.footer.copyright')}</p>
          <div className="footer-links">
            <a href="#privacy">{t('home.footer.privacy')}</a>
            <span className="divider">•</span>
            <a href="#terms">{t('home.footer.terms')}</a>
            <span className="divider">•</span>
            <a href="#compliance">{t('home.footer.compliance')}</a>
            <span className="divider">•</span>
            <a href="#contact">{t('home.footer.contact')}</a>
            <span className="divider">•</span>
            <button className="link-button" onClick={onLogin || (() => {})}>{t('home.footer.signIn')}</button>
          </div>
        </div>
      </footer>
    </div>
  )
}
