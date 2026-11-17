import { useTranslation } from 'react-i18next'
import { WayToVetLogo } from '../WayToVetLogo'
import { statsData } from './homeContent'

interface HeroSectionProps {
  onGetStarted: () => void
  onViewForDoctors: () => void
  onLogin?: () => void
  onBrowseMarketplace: () => void
  groomingEnabled: boolean
}

export function HeroSection({ onGetStarted, onViewForDoctors, onLogin, onBrowseMarketplace, groomingEnabled }: HeroSectionProps) {
  const { t } = useTranslation()

  return (
    <>
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
              <button className="btn btn-outline-inverse btn-large" onClick={onViewForDoctors}>
                {t('home.ctaVet')}
              </button>
              <button className="btn btn-marketplace btn-large" onClick={onBrowseMarketplace}>
                🏪 {t('publicMarketplace.homeCta.browseNow')}
              </button>
              {/* Gated on the same grooming.enabled probe as the section and the nav entry -
                  a hero CTA for a dark module would lead straight to a dead end. Uses
                  onGetStarted rather than /grooming/find because every grooming route is
                  behind RoleRoute, unlike the public /browse-marketplace. */}
              {groomingEnabled && (
                <button className="btn btn-grooming btn-large" onClick={onGetStarted}>
                  💈 {t('home.ctaGrooming')}
                </button>
              )}
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
            <div className="hero-icon-large">
              <WayToVetLogo size={140} variant="mark" title={t('common.brand')} />
            </div>
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
    </>
  )
}
