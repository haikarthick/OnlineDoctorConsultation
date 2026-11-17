import { useTranslation } from 'react-i18next'
import { WayToVetLogo } from '../WayToVetLogo'

interface ClosingSectionsProps {
  onGetStarted: () => void
  onViewForDoctors: () => void
  onLogin?: () => void
  groomingEnabled: boolean
}

export function ClosingSections({ onGetStarted, onViewForDoctors, onLogin, groomingEnabled }: ClosingSectionsProps) {
  const { t } = useTranslation()

  return (
    <>
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
            {groomingEnabled && (
              <button className="btn btn-grooming btn-large" onClick={onGetStarted}>
                💈 {t('home.ctaGrooming')}
              </button>
            )}
            <button className="btn btn-outline-inverse btn-large" onClick={onViewForDoctors}>
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
            <WayToVetLogo size={26} variant="full" onDark title={t('home.footer.brand')} />
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
    </>
  )
}
