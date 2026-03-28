import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

interface LoginProps {
  onSwitchToRegister: () => void
  onGoHome?: () => void
}

export default function Login({ onSwitchToRegister, onGoHome }: LoginProps) {
  const { login } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      await login(email, password)
      setMessage('✓ Login successful! Redirecting...')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('login.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page login-page">
      <div className="login-wrapper">
        {/* Left brand panel */}
        <div className="login-brand">
          <div className="login-brand-inner">
            <div className="login-logo">🏥</div>
            <h2>VetCare</h2>
            <p className="login-tagline">{t('login.welcome')}</p>
            <div className="login-features">
              <div className="login-feat"><span className="login-feat-check">✓</span><span>{t('login.features.consultations')}</span></div>
              <div className="login-feat"><span className="login-feat-check">✓</span><span>{t('login.features.vets')}</span></div>
              <div className="login-feat"><span className="login-feat-check">✓</span><span>{t('login.features.response')}</span></div>
              <div className="login-feat"><span className="login-feat-check">✓</span><span>{t('login.features.security')}</span></div>
              <div className="login-feat"><span className="login-feat-check">✓</span><span>{t('login.features.records')}</span></div>
              <div className="login-feat"><span className="login-feat-check">✓</span><span>Vet Hospital Network</span></div>
            </div>
            <div className="login-trust">
              <span>Trusted by <strong>3,000+</strong> enterprises &amp; <strong>500+</strong> hospitals</span>
            </div>
          </div>
        </div>

        {/* Right form panel */}
        <div className="login-form-panel">
          <div className="login-topbar">
            {onGoHome && <button className="back-home-btn" onClick={onGoHome} title={t('login.backHome')}>{t('login.backHome')}</button>}
            <button className="browse-marketplace-link" onClick={() => navigate('/browse-marketplace')}>🏪 {t('publicMarketplace.homeCta.browseNow')}</button>
            <span className="login-topbar-register">{t('login.newHere')} <button className="link-btn" onClick={onSwitchToRegister}>{t('login.createAccount')}</button></span>
          </div>

          <div className="login-form-center">
            <div className="login-form-header">
              <h1>{t('login.title')}</h1>
              <p>{t('login.subtitle')}</p>
            </div>

            <div className="hospital-callout" role="note" style={{ marginBottom: '1rem' }}>
              <span className="hospital-callout-icon">🏥</span>
              <div className="hospital-callout-body">
                <strong>Hospital or Clinic Staff?</strong>
                <p>Login with your <em>Veterinarian</em> account — your hospital dashboard is inside.</p>
              </div>
            </div>

            {message && (
              <div
                className={`message ${message.includes('✓') ? 'success' : 'error'}`}
                role="status"
                aria-live="polite"
              >
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form" aria-label={t('login.signIn')}>
              <div className="form-group">
                <label htmlFor="login-email">{t('login.email')}</label>
                <input
                  id="login-email"
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  aria-required="true"
                />
              </div>

              <div className="form-group">
                <label htmlFor="login-password">{t('login.password')}</label>
                <input
                  id="login-password"
                  type="password"
                  placeholder={t('login.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  aria-required="true"
                />
              </div>

              <button type="submit" className="btn btn-primary login-submit" disabled={loading} aria-busy={loading}>
                {loading ? (
                  <span className="btn-loading"><span className="spinner" aria-hidden="true" /> {t('login.signingIn')}</span>
                ) : (
                  t('login.signIn')
                )}
              </button>
            </form>

            <div className="login-footer">
              <span>{t('login.noAccount')}</span>
              <button className="link-btn" onClick={onSwitchToRegister}>{t('login.createFree')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
