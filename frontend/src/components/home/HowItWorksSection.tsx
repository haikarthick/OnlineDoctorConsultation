import React from 'react'
import { useTranslation } from 'react-i18next'
import { stepIcons, HomeTab } from './homeContent'

interface HowItWorksSectionProps {
  activeTab: HomeTab
  setActiveTab: (tab: HomeTab) => void
}

export function HowItWorksSection({ activeTab, setActiveTab }: HowItWorksSectionProps) {
  const { t } = useTranslation()

  return (
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
  )
}
