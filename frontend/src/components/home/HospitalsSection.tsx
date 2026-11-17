import { useTranslation } from 'react-i18next'

interface HospitalsSectionProps {
  onGetStarted: () => void
}

export function HospitalsSection({ onGetStarted }: HospitalsSectionProps) {
  const { t } = useTranslation()

  return (
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
            <button className="btn btn-outline-inverse btn-large" onClick={onGetStarted}>
              🔍 {t('home.browseHospitals')}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
