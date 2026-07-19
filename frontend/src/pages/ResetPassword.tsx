import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import apiService from '../services/api'
import './Auth.css'

interface ResetPasswordProps {
  onGoToLogin: () => void
}

type PageState = 'validating' | 'invalid' | 'form' | 'success'

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

export default function ResetPassword({ onGoToLogin }: ResetPasswordProps) {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [pageState, setPageState] = useState<PageState>('validating')
  const [invalidReason, setInvalidReason] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || token.length !== 64 || !/^[0-9a-fA-F]+$/.test(token)) {
      setInvalidReason(t('resetPassword.invalidToken'))
      setPageState('invalid')
      return
    }
    apiService.validateResetToken(token)
      .then(res => {
        if (res.valid) {
          setPageState('form')
        } else {
          const reasons: Record<string, string> = {
            expired: t('resetPassword.reasonExpired'),
            already_used: t('resetPassword.reasonUsed'),
            not_found: t('resetPassword.reasonInvalid'),
          }
          setInvalidReason(reasons[res.reason] || t('resetPassword.reasonInvalid'))
          setPageState('invalid')
        }
      })
      .catch(() => {
        setInvalidReason(t('resetPassword.reasonInvalid'))
        setPageState('invalid')
      })
  }, [token, t])

  const passwordsMatch = newPassword === confirmPassword
  const passwordStrong = PASSWORD_REGEX.test(newPassword)
  const canSubmit = newPassword.length >= 8 && passwordsMatch && passwordStrong && !loading

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!passwordsMatch) { setError(t('resetPassword.passwordsMismatch')); return }
    if (!passwordStrong) { setError(t('resetPassword.passwordWeak')); return }
    setLoading(true)
    try {
      await apiService.resetPassword(token, newPassword)
      setPageState('success')
    } catch (err: any) {
      setError(err?.response?.data?.message || t('resetPassword.genericError'))
    } finally {
      setLoading(false)
    }
  }

  const cardStyle: React.CSSProperties = {
    maxWidth: 440, width: '100%', margin: '0 auto',
    background: '#fff', borderRadius: 16,
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: '40px 36px',
  }

  if (pageState === 'validating') {
    return (
      <div className="auth-page">
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: '#64748b' }}>{t('resetPassword.validating')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (pageState === 'invalid') {
    return (
      <div className="auth-page">
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>⚠️</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
              {t('resetPassword.linkInvalidTitle')}
            </h1>
            <p style={{ color: '#ef4444', fontSize: 14, margin: 0 }}>{invalidReason}</p>
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: 12 }}
            onClick={() => onGoToLogin()}
          >
            {t('resetPassword.requestNewLink')}
          </button>
          <button
            type="button"
            className="link-btn"
            style={{ width: '100%', textAlign: 'center', color: '#64748b', fontSize: 14 }}
            onClick={onGoToLogin}
          >
            ← {t('resetPassword.backToLogin')}
          </button>
        </div>
      </div>
    )
  }

  if (pageState === 'success') {
    return (
      <div className="auth-page">
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#166534', marginBottom: 8 }}>
              {t('resetPassword.successTitle')}
            </h1>
            <p style={{ color: '#166534', fontSize: 14, margin: 0 }}>
              {t('resetPassword.successBody')}
            </p>
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={onGoToLogin}
          >
            {t('resetPassword.goToLogin')}
          </button>
        </div>
      </div>
    )
  }

  // pageState === 'form'
  return (
    <div className="auth-page">
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔒</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
            {t('resetPassword.title')}
          </h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
            {t('resetPassword.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="message error" style={{ marginBottom: 16 }}>{error}</div>
          )}

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label htmlFor="rp-password" style={{ display: 'block', marginBottom: 6, fontWeight: 500, color: '#374151', fontSize: 14 }}>
              {t('resetPassword.newPasswordLabel')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="rp-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                style={{ width: '100%', boxSizing: 'border-box', paddingRight: 40 }}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                autoFocus
                autoComplete="new-password"
                aria-required="true"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {newPassword.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12 }}>
                <PasswordStrengthHint password={newPassword} t={t} />
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 24 }}>
            <label htmlFor="rp-confirm" style={{ display: 'block', marginBottom: 6, fontWeight: 500, color: '#374151', fontSize: 14 }}>
              {t('resetPassword.confirmPasswordLabel')}
            </label>
            <input
              id="rp-confirm"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              style={{
                width: '100%', boxSizing: 'border-box',
                borderColor: confirmPassword.length > 0 && !passwordsMatch ? '#ef4444' : undefined,
              }}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              aria-required="true"
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                {t('resetPassword.passwordsMismatch')}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: 15, marginBottom: 16 }}
            disabled={!canSubmit}
            aria-busy={loading}
          >
            {loading ? (
              <span className="btn-loading">
                <span className="spinner" aria-hidden="true" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite', marginRight: 8 }} />
                {t('resetPassword.resetting')}
              </span>
            ) : t('resetPassword.resetBtn')}
          </button>

          <button
            type="button"
            className="link-btn"
            style={{ width: '100%', textAlign: 'center', color: '#64748b', fontSize: 14 }}
            onClick={onGoToLogin}
          >
            ← {t('resetPassword.backToLogin')}
          </button>
        </form>
      </div>
    </div>
  )
}

function PasswordStrengthHint({ password, t }: { password: string; t: (k: string) => string }) {
  const checks = [
    { label: t('resetPassword.hint.length'), pass: password.length >= 8 },
    { label: t('resetPassword.hint.upper'), pass: /[A-Z]/.test(password) },
    { label: t('resetPassword.hint.lower'), pass: /[a-z]/.test(password) },
    { label: t('resetPassword.hint.number'), pass: /\d/.test(password) },
  ]
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
      {checks.map(c => (
        <span key={c.label} style={{ color: c.pass ? '#16a34a' : '#9ca3af', fontSize: 11 }}>
          {c.pass ? '✓' : '○'} {c.label}
        </span>
      ))}
    </div>
  )
}
