import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

interface RegisterProps {
  onSwitchToLogin: () => void
  onGoHome?: () => void
}

export default function Register({ onSwitchToLogin, onGoHome }: RegisterProps) {
  const { register } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'pet_owner'
  })
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    // Validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
      setMessage(t('register.validation.allRequired'))
      setLoading(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setMessage(t('register.validation.passwordMismatch'))
      setLoading(false)
      return
    }

    if (formData.password.length < 8) {
      setMessage(t('register.validation.passwordLength'))
      setLoading(false)
      return
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      setMessage(t('register.validation.passwordComplexity'))
      setLoading(false)
      return
    }

    try {
      await register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        role: formData.role as 'pet_owner' | 'farmer' | 'veterinarian'
      })
      setMessage(t('register.success'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('register.error'))
    } finally {
      setLoading(false)
    }
  }

  const roleOptions = [
    { value: 'pet_owner', label: t('register.rolePetOwner'), icon: '🐕', desc: t('register.rolePetOwnerDesc') },
    { value: 'farmer', label: t('register.roleFarmer'), icon: '🐄', desc: t('register.roleFarmerDesc') },
    { value: 'veterinarian', label: t('register.roleVet'), icon: '👨‍⚕️', desc: t('register.roleVetDesc') },
  ]

  return (
    <div className="auth-page register-page">
      <div className="register-wrapper">
        {/* Left: Branding strip */}
        <div className="register-brand">
          <div className="register-brand-inner">
            <div className="register-logo">🏥</div>
            <h2>VetCare</h2>
            <p className="register-tagline">{t('register.tagline')}</p>
            <div className="register-features">
              <div className="register-feat"><span className="register-feat-icon">🩺</span><div><strong>{t('register.features.expertCare')}</strong><span>{t('register.features.expertCareDesc')}</span></div></div>
              <div className="register-feat"><span className="register-feat-icon">⚡</span><div><strong>{t('register.features.instantAccess')}</strong><span>{t('register.features.instantAccessDesc')}</span></div></div>
              <div className="register-feat"><span className="register-feat-icon">🔒</span><div><strong>{t('register.features.secure')}</strong><span>{t('register.features.secureDesc')}</span></div></div>
              <div className="register-feat"><span className="register-feat-icon">🏢</span><div><strong>{t('register.features.enterpriseReady')}</strong><span>{t('register.features.enterpriseReadyDesc')}</span></div></div>
              <div className="register-feat"><span className="register-feat-icon">🏥</span><div><strong>Hospital Network</strong><span>Create &amp; manage multi-doctor clinics</span></div></div>
            </div>
            <div className="register-trust">
              <span>Trusted by <strong>3,000+</strong> enterprises &amp; <strong>500+</strong> hospitals</span>
            </div>
          </div>
        </div>

        {/* Right: Registration form */}
        <div className="register-form-panel">
          <div className="register-form-topbar">
            {onGoHome && <button className="back-home-btn" onClick={onGoHome} title={t('login.backHome')}>{t('login.backHome')}</button>}
            <button className="browse-marketplace-link" onClick={() => navigate('/browse-marketplace')}>🏪 {t('publicMarketplace.homeCta.browseNow')}</button>
            <span className="register-topbar-login">{t('register.alreadyMember')} <button className="link-btn" onClick={onSwitchToLogin}>{t('register.signIn')}</button></span>
          </div>
          <div className="register-form-header">
            <h1>{t('register.title')}</h1>
            <p>{t('register.subtitle')}</p>
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

          <form onSubmit={handleSubmit} className="register-form" aria-label="Create account form">
            {/* Name row */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="reg-firstName">{t('register.firstName')}</label>
                <input id="reg-firstName" type="text" name="firstName" placeholder="John" value={formData.firstName} onChange={handleChange} required autoComplete="given-name" aria-required="true" />
              </div>
              <div className="form-group">
                <label htmlFor="reg-lastName">{t('register.lastName')}</label>
                <input id="reg-lastName" type="text" name="lastName" placeholder="Doe" value={formData.lastName} onChange={handleChange} required autoComplete="family-name" aria-required="true" />
              </div>
            </div>

            {/* Email + Phone row */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="reg-email">{t('register.email')}</label>
                <input id="reg-email" type="email" name="email" placeholder="you@email.com" value={formData.email} onChange={handleChange} required autoComplete="email" aria-required="true" />
              </div>
              <div className="form-group">
                <label htmlFor="reg-phone">{t('register.phone')}</label>
                <input id="reg-phone" type="tel" name="phone" placeholder="+1 (555) 000-0000" value={formData.phone} onChange={handleChange} required autoComplete="tel" aria-required="true" />
              </div>
            </div>

            {/* Role selector cards */}
            <fieldset className="form-group" style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontWeight: 600, marginBottom: '8px' }}>{t('register.roleTitle')}</legend>
              <div className="role-selector" role="radiogroup" aria-label="Select your role">
                {roleOptions.map(opt => (
                  <label key={opt.value} className={`role-option ${formData.role === opt.value ? 'selected' : ''}`}>
                    <input type="radio" name="role" value={opt.value} checked={formData.role === opt.value} onChange={handleChange} aria-describedby={`role-desc-${opt.value}`} />
                    <span className="role-icon" aria-hidden="true">{opt.icon}</span>
                    <span className="role-label">{opt.label}</span>
                    <span className="role-desc" id={`role-desc-${opt.value}`}>{opt.desc}</span>
                  </label>
                ))}
                {/* Hospital info card — not a selectable role, it's created after vet registration */}
                <div className="role-option role-option--info" aria-label="Vet Hospital info">
                  <span className="role-icon" aria-hidden="true">🏥</span>
                  <span className="role-label">Vet Hospital</span>
                  <span className="role-desc">Register as a Veterinarian, then create your hospital from the dashboard</span>
                </div>
              </div>
            </fieldset>

            {/* Hospital pathway callout */}
            <div className="hospital-callout" role="note">
              <span className="hospital-callout-icon">🏥</span>
              <div className="hospital-callout-body">
                <strong>Running a Vet Hospital or Multi-Doctor Clinic?</strong>
                <p>Register as a <em>Veterinarian</em> above. After signing in, you can <strong>create your hospital profile</strong>, add departments, staff, services and accept bookings — all from your dashboard. No separate account needed.</p>
              </div>
            </div>

            {/* Password row */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="reg-password">{t('register.password')}</label>
                <input id="reg-password" type="password" name="password" placeholder="Min 8 chars, A-Z, a-z, 0-9" value={formData.password} onChange={handleChange} required autoComplete="new-password" aria-required="true" aria-describedby="password-hint" />
                <span id="password-hint" className="sr-only">Must be at least 8 characters with uppercase, lowercase, and number</span>
              </div>
              <div className="form-group">
                <label htmlFor="reg-confirmPassword">{t('register.confirmPassword')}</label>
                <input id="reg-confirmPassword" type="password" name="confirmPassword" placeholder="Re-enter password" value={formData.confirmPassword} onChange={handleChange} required autoComplete="new-password" aria-required="true" />
              </div>
            </div>

            <button type="submit" className="btn btn-primary register-submit" disabled={loading} aria-busy={loading}>
              {loading ? (
                <span className="btn-loading"><span className="spinner" aria-hidden="true" /> {t('register.creatingAccount')}</span>
              ) : (
                t('register.createAccountBtn')
              )}
            </button>
          </form>

          <div className="register-footer">
            <span>By creating an account you agree to our Terms of Service</span>
          </div>
        </div>
      </div>
    </div>
  )
}
