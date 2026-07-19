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
      <div className="auth-card" style={{ maxWidth: 440, width: '100%', margin: '0 auto', background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: '40px 36px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔑</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
            {t('forgotPassword.title')}
          </h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
            {t('forgotPassword.subtitle')}
          </p>
        </div>

        {submitted ? (
          <div>
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
              padding: '20px 24px', textAlign: 'center', marginBottom: 24,
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✉️</div>
              <p style={{ color: '#166534', fontWeight: 600, margin: '0 0 6px' }}>
                {t('forgotPassword.successTitle')}
              </p>
              <p style={{ color: '#166534', fontSize: 13, margin: 0 }}>
                {t('forgotPassword.successBody')}
              </p>
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 20 }}>
              {t('forgotPassword.spamHint')}
            </p>
            <button
              className="btn btn-outline"
              style={{ width: '100%' }}
              onClick={onGoToLogin}
            >
              ← {t('forgotPassword.backToLogin')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="message error" style={{ marginBottom: 16 }}>{error}</div>
            )}
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label htmlFor="fp-email" style={{ display: 'block', marginBottom: 6, fontWeight: 500, color: '#374151', fontSize: 14 }}>
                {t('forgotPassword.emailLabel')}
              </label>
              <input
                id="fp-email"
                type="email"
                className="form-input"
                style={{ width: '100%', boxSizing: 'border-box' }}
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
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: 15, marginBottom: 16 }}
              disabled={loading || !email.trim()}
              aria-busy={loading}
            >
              {loading ? (
                <span className="btn-loading">
                  <span className="spinner" aria-hidden="true" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite', marginRight: 8 }} />
                  {t('forgotPassword.sending')}
                </span>
              ) : t('forgotPassword.sendLink')}
            </button>
            <button
              type="button"
              className="link-btn"
              style={{ width: '100%', textAlign: 'center', color: '#64748b', fontSize: 14 }}
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
