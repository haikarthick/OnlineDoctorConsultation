import { useTranslation } from 'react-i18next'
import { benefitIcons, benefitKeyMap, HomeTab } from './homeContent'

interface FeaturesTabsSectionProps {
  activeTab: HomeTab
  setActiveTab: (tab: HomeTab) => void
}

export function FeaturesTabsSection({ activeTab, setActiveTab }: FeaturesTabsSectionProps) {
  const { t } = useTranslation()

  return (
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
  )
}
