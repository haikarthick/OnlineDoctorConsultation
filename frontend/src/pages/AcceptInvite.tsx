import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { vetHospitalApi } from '../services/api/vetHospitalApi'
import './ModulePage.css'
import './VetHospitals.css'

const AcceptInvite: React.FC = () => {
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
    if (!token) { setError('Invalid invitation link — no token provided'); setLoading(false); return }
    const load = async () => {
      try {
        const data = await vetHospitalApi.getInviteByToken(token)
        setInvite(data)
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.response?.data?.error?.message || 'Invalid or expired invitation')
      } finally { setLoading(false) }
    }
    load()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setSubmitting(true); setError('')
    try {
      await vetHospitalApi.acceptInvite(token, password)
      setSuccess(true)
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error?.message || 'Failed to accept invitation')
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="loading-container"><div className="loading-spinner" /></div>

  if (success) {
    return (
      <div className="module-page" style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
        <div className="hb-success-card">
          <div className="hb-success-icon">✓</div>
          <h2>Welcome Aboard!</h2>
          <p>Your account has been created and linked to the hospital. You can now log in to start managing patients and appointments.</p>
          <button className="btn-primary" onClick={() => navigate('/login')} style={{ marginTop: '1rem' }}>
            Go to Login
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
          <h2>Invitation Problem</h2>
          <p style={{ color: '#666' }}>{error}</p>
          <Link to="/login" className="btn-secondary" style={{ display: 'inline-block', marginTop: '1rem', textDecoration: 'none' }}>
            Go to Login
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
          <h2 style={{ margin: '0 0 .3rem' }}>Join {invite?.hospital_name}</h2>
          <p style={{ color: '#666', margin: 0, fontSize: '.9rem' }}>
            You've been invited to join as <strong style={{ textTransform: 'capitalize' }}>{(invite?.hospital_role || 'staff').replace(/_/g, ' ')}</strong>
          </p>
          {invite?.hospital_city && <p style={{ color: '#888', fontSize: '.85rem', margin: '.15rem 0 0' }}>📍 {invite.hospital_city}</p>}
        </div>

        <div className="hb-step-content" style={{ marginTop: '1.25rem' }}>
          <h3 style={{ margin: '0 0 .75rem' }}>Set Up Your Account</h3>
          <p style={{ fontSize: '.88rem', color: '#666', margin: '0 0 1rem' }}>
            Your email: <strong>{invite?.email}</strong>
          </p>

          {error && <div className="modal-alert error" style={{ marginBottom: '1rem' }}>⚠ {error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
            <div className="hb-form-group">
              <label className="form-label">Create Password *</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                minLength={8}
                required
              />
            </div>
            <div className="hb-form-group">
              <label className="form-label">Confirm Password *</label>
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
              />
            </div>
            <button type="submit" className="btn-primary" disabled={submitting} style={{ marginTop: '.5rem', width: '100%', padding: '.65rem' }}>
              {submitting ? 'Creating Account...' : '✓ Accept & Create Account'}
            </button>
          </form>

          <p style={{ fontSize: '.82rem', color: '#999', textAlign: 'center', marginTop: '1rem' }}>
            Already have an account? <Link to="/login" style={{ color: '#2563eb' }}>Log in</Link> instead
          </p>
        </div>
      </div>
    </div>
  )
}

export default AcceptInvite
