import React from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  extraTipIcon?: string
}

const ProTipsPanel: React.FC<Props> = ({ extraTipIcon }) => {
  const { t } = useTranslation()

  return (
    <section className="dashboard-section tips-section">
      <div className="section-header">
        <h2 className="section-title">{t('dashboard.proTips')}</h2>
      </div>
      <div className="tips-grid">
        <div className="tip-card">
          <span className="tip-icon">💡</span>
          <div>
            <h4>{t('dashboard.tips.appointmentTitle')}</h4>
            <p>{t('dashboard.tips.appointmentDesc')}</p>
          </div>
        </div>
        <div className="tip-card">
          <span className="tip-icon">📱</span>
          <div>
            <h4>{t('dashboard.tips.healthTitle')}</h4>
            <p>{t('dashboard.tips.healthDesc')}</p>
          </div>
        </div>
        {extraTipIcon && (
          <div className="tip-card">
            <span className="tip-icon">{extraTipIcon}</span>
            <div>
              <h4>{t('dashboard.tips.communityTitle')}</h4>
              <p>{t('dashboard.tips.communityDesc')}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default ProTipsPanel
