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
          <div className="si-5a54a33c">
            <div className="loading-spinner si-9ad92aa9" />
            <p className="si-98734f9a">{t('resetPassword.validating')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (pageState === 'invalid') {
    return (
      <div className="auth-page">
        <div style={cardStyle}>
          <div className="si-28dc275c">
            <div className="si-a5ea92fb">⚠️</div>
            <h1 className="si-7b1d1b94">
              {t('resetPassword.linkInvalidTitle')}
            </h1>
            <p className="si-6f3b9b7b">{invalidReason}</p>
          </div>
          <button
            className="btn btn-primary si-2f93d373"
           
            onClick={() => onGoToLogin()}
          >
            {t('resetPassword.requestNewLink')}
          </button>
          <button
            type="button"
            className="link-btn si-db073708"
           
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
          <div className="si-1425bff3">
            <div className="si-a5ea92fb">✅</div>
            <h1 className="si-fc510996">
              {t('resetPassword.successTitle')}
            </h1>
            <p className="si-83c162f4">
              {t('resetPassword.successBody')}
            </p>
          </div>
          <button
            className="btn btn-primary si-7d984748"
           
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
        <div className="si-28dc275c">
          <div className="si-a5ea92fb">🔒</div>
          <h1 className="si-2af23621">
            {t('resetPassword.title')}
          </h1>
          <p className="si-5cc08d30">
            {t('resetPassword.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="message error si-7e63ec4f">{error}</div>
          )}

          <div className="form-group si-7e63ec4f">
            <label htmlFor="rp-password" className="si-701dd00b">
              {t('resetPassword.newPasswordLabel')}
            </label>
            <div className="si-314cecae">
              <input
                id="rp-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input si-40bf6aa1"
               
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
                className="si-b1d82847"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {newPassword.length > 0 && (
              <div className="si-291ca0c2">
                <PasswordStrengthHint password={newPassword} t={t} />
              </div>
            )}
          </div>

          <div className="form-group si-af65fe13">
            <label htmlFor="rp-confirm" className="si-701dd00b">
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
              <p className="si-93a626a7">
                {t('resetPassword.passwordsMismatch')}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary si-9a254be0"
           
            disabled={!canSubmit}
            aria-busy={loading}
          >
            {loading ? (
              <span className="btn-loading">
                <span className="spinner si-d47171fc" aria-hidden="true" />
                {t('resetPassword.resetting')}
              </span>
            ) : t('resetPassword.resetBtn')}
          </button>

          <button
            type="button"
            className="link-btn si-db073708"
           
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
    <div className="si-6c006a30">
      {checks.map(c => (
        <span key={c.label} style={{ color: c.pass ? '#16a34a' : '#9ca3af', fontSize: 11 }}>
          {c.pass ? '✓' : '○'} {c.label}
        </span>
      ))}
    </div>
  )
}
