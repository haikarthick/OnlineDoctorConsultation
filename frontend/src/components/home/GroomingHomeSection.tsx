import { useTranslation } from 'react-i18next'

interface GroomingHomeSectionProps {
  onGetStarted: () => void
  onNavigateToGroomerRegister: () => void
}

/**
 * Speaks to both sides of the marketplace: pet owners looking to book, and grooming
 * businesses looking to list. Every claim below maps to something the module actually
 * does - the safety-escalation and passport copy in particular reflects
 * GroomingCareService, where groomers ESCALATE and never diagnose.
 */
export function GroomingHomeSection({ onGetStarted, onNavigateToGroomerRegister }: GroomingHomeSectionProps) {
  const { t } = useTranslation()

  return (
    <section className="grooming-home-section" id="grooming">
      <h2 className="section-title">💈 {t('home.grooming.title')}</h2>
      <p className="section-subtitle">{t('home.grooming.subtitle')}</p>

      <div className="grooming-home-split">
        {/* For pet owners */}
        <div className="grooming-home-card grooming-home-card--owner">
          <div className="grooming-home-card-head">
            <span className="grooming-home-card-icon">🐕</span>
            <div>
              <h3>{t('home.grooming.owners.title')}</h3>
              <p className="grooming-home-card-lede">{t('home.grooming.owners.lede')}</p>
            </div>
          </div>
          <ul className="grooming-home-list">
            {['verified', 'mobile', 'slots', 'passport', 'escalation', 'money'].map(key => (
              <li key={key}>
                <span className="grooming-home-list-icon">{t(`home.grooming.owners.points.${key}.icon`)}</span>
                <span>
                  <strong>{t(`home.grooming.owners.points.${key}.title`)}</strong>
                  {' - '}
                  {t(`home.grooming.owners.points.${key}.desc`)}
                </span>
              </li>
            ))}
          </ul>
          <button className="btn btn-primary btn-large" onClick={onGetStarted}>
            💈 {t('home.grooming.owners.cta')}
          </button>
        </div>

        {/* For grooming & spa businesses */}
        <div className="grooming-home-card grooming-home-card--provider">
          <div className="grooming-home-card-head">
            <span className="grooming-home-card-icon">🏪</span>
            <div>
              <h3>{t('home.grooming.providers.title')}</h3>
              <p className="grooming-home-card-lede">{t('home.grooming.providers.lede')}</p>
            </div>
          </div>
          <ul className="grooming-home-list">
            {['listing', 'diary', 'acceptance', 'earnings', 'invoicing', 'disputes'].map(key => (
              <li key={key}>
                <span className="grooming-home-list-icon">{t(`home.grooming.providers.points.${key}.icon`)}</span>
                <span>
                  <strong>{t(`home.grooming.providers.points.${key}.title`)}</strong>
                  {' - '}
                  {t(`home.grooming.providers.points.${key}.desc`)}
                </span>
              </li>
            ))}
          </ul>
          <button className="btn btn-outline btn-large" onClick={onNavigateToGroomerRegister}>
            📝 {t('home.grooming.providers.cta')}
          </button>
          <p className="grooming-home-note">{t('home.grooming.providers.note')}</p>
        </div>
      </div>

      {/* The differentiator, stated plainly */}
      <div className="grooming-home-moat">
        <span className="grooming-home-moat-icon">🩺</span>
        <div>
          <h4>{t('home.grooming.moat.title')}</h4>
          <p>{t('home.grooming.moat.desc')}</p>
        </div>
      </div>
    </section>
  )
}
