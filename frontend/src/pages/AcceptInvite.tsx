import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { vetHospitalApi } from '../services/api/vetHospitalApi'
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
      <div className="module-page" style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
        <div className="hb-success-card">
          <div className="hb-success-icon">✓</div>
          <h2>{t('acceptInvite.successTitle')}</h2>
          <p>{t('acceptInvite.successMsg')}</p>
          <button className="btn-primary" onClick={() => navigate('/login')} style={{ marginTop: '1rem' }}>
            {t('acceptInvite.goToLogin')}
          </button>
        </div>
      </div>
    )
  }

  if (error && !invite) {
    return (
      <div className="module-page" style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
        <div className="hb-success-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2>{t('acceptInvite.inviteProblem')}</h2>
          <p style={{ color: '#666' }}>{error}</p>
          <Link to="/login" className="btn-secondary" style={{ display: 'inline-block', marginTop: '1rem', textDecoration: 'none' }}>
            {t('acceptInvite.goToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page" style={{ display: 'flex', justifyContent: 'center', paddingTop: '2rem' }}>
      <div style={{ maxWidth: 480, width: '100%' }}>
        <div className="hb-hospital-header" style={{ textAlign: 'center' }}>
          {invite?.hospital_logo_url
            ? <img src={invite.hospital_logo_url} alt="" style={{ width: 64, height: 64, borderRadius: 14, margin: '0 auto .75rem', display: 'block', objectFit: 'cover' }} />
            : <div style={{ width: 64, height: 64, borderRadius: 14, background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#fff', margin: '0 auto .75rem' }}>🏥</div>}
          <h2 style={{ margin: '0 0 .3rem' }}>{t('acceptInvite.joinTitle', { name: invite?.hospital_name })}</h2>
          <p style={{ color: '#666', margin: 0, fontSize: '.9rem' }}>
            You've been invited to join as <strong style={{ textTransform: 'capitalize' }}>{(invite?.hospital_role || 'staff').replace(/_/g, ' ')}</strong>
          </p>
          {invite?.hospital_city && <p style={{ color: '#888', fontSize: '.85rem', margin: '.15rem 0 0' }}>📍 {invite.hospital_city}</p>}
        </div>

        <div className="hb-step-content" style={{ marginTop: '1.25rem' }}>
          <h3 style={{ margin: '0 0 .75rem' }}>{t('acceptInvite.setUpAccount')}</h3>
          <p style={{ fontSize: '.88rem', color: '#666', margin: '0 0 1rem' }}>
            Your email: <strong>{invite?.email}</strong>
          </p>

          {error && <div className="modal-alert error" style={{ marginBottom: '1rem' }}>⚠ {error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
            <div className="hb-form-group">
              <label className="form-label">{t('acceptInvite.createPassword')}</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('acceptInvite.minChars')}
                minLength={8}
                required
              />
            </div>
            <div className="hb-form-group">
              <label className="form-label">{t('acceptInvite.confirmPassword')}</label>
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder={t('acceptInvite.reEnterPassword')}
                required
              />
            </div>
            <button type="submit" className="btn-primary" disabled={submitting} style={{ marginTop: '.5rem', width: '100%', padding: '.65rem' }}>
              {submitting ? t('acceptInvite.creatingAccount') : t('acceptInvite.acceptAndCreate')}
            </button>
          </form>

          <p style={{ fontSize: '.82rem', color: '#999', textAlign: 'center', marginTop: '1rem' }}>
            {t('acceptInvite.alreadyHaveAccount')} <Link to="/login" style={{ color: '#2563eb' }}>{t('acceptInvite.logIn')}</Link> {t('acceptInvite.instead')}
          </p>
        </div>
      </div>
    </div>
  )
}

export default AcceptInvite
