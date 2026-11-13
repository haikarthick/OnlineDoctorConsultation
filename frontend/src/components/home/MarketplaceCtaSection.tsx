import { useTranslation } from 'react-i18next'

interface MarketplaceCtaSectionProps {
  onBrowseMarketplace: () => void
  onGetStarted: () => void
}

export function MarketplaceCtaSection({ onBrowseMarketplace, onGetStarted }: MarketplaceCtaSectionProps) {
  const { t } = useTranslation()

  return (
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
          <button className="btn btn-primary btn-large" onClick={onBrowseMarketplace}>
            🛒 {t('publicMarketplace.homeCta.browseNow')}
          </button>
          <button className="btn btn-outline btn-large" onClick={onGetStarted}>
            📝 {t('publicMarketplace.homeCta.sellYours')}
          </button>
        </div>
      </div>
    </section>
  )
}
