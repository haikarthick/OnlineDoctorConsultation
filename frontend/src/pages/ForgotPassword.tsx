import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../services/api'
import './Auth.css'

interface ForgotPasswordProps {
  onGoToLogin: () => void
}

export default function ForgotPassword({ onGoToLogin }: ForgotPasswordProps) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await apiService.forgotPassword(email.trim().toLowerCase())
      setSubmitted(true)
    } catch {
      // Even on network error, show success to prevent enumeration.
      // The only case we show an error is a genuine client-side validation failure.
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card si-b7fe9f74">
        <div className="si-28dc275c">
          <div className="si-a5ea92fb">🔑</div>
          <h1 className="si-2af23621">
            {t('forgotPassword.title')}
          </h1>
          <p className="si-5cc08d30">
            {t('forgotPassword.subtitle')}
          </p>
        </div>

        {submitted ? (
          <div>
            <div className="si-9a2d5efa">
              <div className="si-d34c4c42">✉️</div>
              <p className="si-dde48169">
                {t('forgotPassword.successTitle')}
              </p>
              <p className="si-0f7f24f4">
                {t('forgotPassword.successBody')}
              </p>
            </div>
            <p className="si-a4246cfc">
              {t('forgotPassword.spamHint')}
            </p>
            <button
              className="btn btn-outline si-7d984748"
             
              onClick={onGoToLogin}
            >
              ← {t('forgotPassword.backToLogin')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="message error si-7e63ec4f">{error}</div>
            )}
            <div className="form-group si-478be2e9">
              <label htmlFor="fp-email" className="si-701dd00b">
                {t('forgotPassword.emailLabel')}
              </label>
              <input
                id="fp-email"
                type="email"
                className="form-input si-3ebd46a5"
               
                placeholder="you@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                aria-required="true"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary si-9a254be0"
             
              disabled={loading || !email.trim()}
              aria-busy={loading}
            >
              {loading ? (
                <span className="btn-loading">
                  <span className="spinner si-d47171fc" aria-hidden="true" />
                  {t('forgotPassword.sending')}
                </span>
              ) : t('forgotPassword.sendLink')}
            </button>
            <button
              type="button"
              className="link-btn si-db073708"
             
              onClick={onGoToLogin}
            >
              ← {t('forgotPassword.backToLogin')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
