import { useTranslation } from 'react-i18next'
import { enterpriseTypes } from './homeContent'

export function EnterpriseTypesSection() {
  const { t } = useTranslation()

  return (
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
  )
}
