import { useTranslation } from 'react-i18next'
import { featureIcons } from './homeContent'

/**
 * The five "advanced-features-section" bands (Advanced, Innovation, Intelligence,
 * Workflow, Compliance) kept together: same visual rhythm, same icon-grid pattern,
 * immediately adjacent in the original page. The `si-*` classNames are pre-existing
 * generated identifiers referenced by Home.css - reproduced verbatim, not renamed.
 */
export function AdvancedCapabilitiesSection() {
  const { t } = useTranslation()

  return (
    <>
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
    </>
  )
}
