import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { vetHospitalApi } from '../services/api/vetHospitalApi'
import PasswordInput from '../components/PasswordInput'
import './ModulePage.css'
import './VetHospitals.css'
import { useTranslation } from 'react-i18next'

const AcceptInvite: React.FC = () => {
  const { t } = useTranslation()

  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [invite, setInvite] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) { setError(t('acceptInvite.noToken')); setLoading(false); return }
    const load = async () => {
      try {
        const data = await vetHospitalApi.getInviteByToken(token)
        setInvite(data)
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.response?.data?.error?.message || t('acceptInvite.invalidInvite'))
      } finally { setLoading(false) }
    }
    load()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError(t('acceptInvite.passwordMinLength')); return }
    if (password !== confirmPassword) { setError(t('acceptInvite.passwordsMismatch')); return }
    setSubmitting(true); setError('')
    try {
      await vetHospitalApi.acceptInvite(token, password)
      setSuccess(true)
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error?.message || t('acceptInvite.failedToAccept'))
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="loading-container"><div className="loading-spinner" /></div>

  if (success) {
    return (
      <div className="module-page si-933750c9">
        <div className="hb-success-card">
          <div className="hb-success-icon">✓</div>
          <h2>{t('acceptInvite.successTitle')}</h2>
          <p>{t('acceptInvite.successMsg')}</p>
          <button className="btn-primary si-216c99b7" onClick={() => navigate('/login')}>
            {t('acceptInvite.goToLogin')}
          </button>
        </div>
      </div>
    )
  }

  if (error && !invite) {
    return (
      <div className="module-page si-933750c9">
        <div className="hb-success-card si-4b6b7fbc">
          <div className="si-fa85da6a">⚠️</div>
          <h2>{t('acceptInvite.inviteProblem')}</h2>
          <p className="si-50edd4e9">{error}</p>
          <Link to="/login" className="btn-secondary si-efc6e1eb">
            {t('acceptInvite.goToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page si-8abe2a0f">
      <div className="si-e86e7760">
        <div className="hb-hospital-header si-4b6b7fbc">
          {invite?.hospital_logo_url
            ? <img src={invite.hospital_logo_url} alt="" className="si-8a8ea830" />
            : <div className="si-0da4ec20">🏥</div>}
          <h2 className="si-d5625334">{t('acceptInvite.joinTitle', { name: invite?.hospital_name })}</h2>
          <p className="si-21480c8e">
            You've been invited to join as <strong className="si-ecf1d5e5">{(invite?.hospital_role || 'staff').replace(/_/g, ' ')}</strong>
          </p>
          {invite?.hospital_city && <p className="si-5a75f861">📍 {invite.hospital_city}</p>}
        </div>

        <div className="hb-step-content si-6256dad9">
          <h3 className="si-ac75df06">{t('acceptInvite.setUpAccount')}</h3>
          <p className="si-2dd99463">
            Your email: <strong>{invite?.email}</strong>
          </p>

          {error && <div className="modal-alert error si-1cb81cae">⚠ {error}</div>}

          <form onSubmit={handleSubmit} className="si-7025369d">
            <div className="hb-form-group">
              <label className="form-label">{t('acceptInvite.createPassword')}</label>
              <PasswordInput
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('acceptInvite.minChars')}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="hb-form-group">
              <label className="form-label">{t('acceptInvite.confirmPassword')}</label>
              <PasswordInput
                className="form-input"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder={t('acceptInvite.reEnterPassword')}
                required
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="btn-primary si-32d8ba6d" disabled={submitting}>
              {submitting ? t('acceptInvite.creatingAccount') : t('acceptInvite.acceptAndCreate')}
            </button>
          </form>

          <p className="si-f7973469">
            {t('acceptInvite.alreadyHaveAccount')} <Link to="/login" className="si-8cec8808">{t('acceptInvite.logIn')}</Link> {t('acceptInvite.instead')}
          </p>
        </div>
      </div>
    </div>
  )
}

export default AcceptInvite
