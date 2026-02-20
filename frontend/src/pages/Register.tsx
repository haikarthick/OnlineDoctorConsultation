import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

interface RegisterProps {
  onSwitchToLogin: () => void
  onGoHome?: () => void
}

export default function Register({ onSwitchToLogin, onGoHome }: RegisterProps) {
  const { register } = useAuth()
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
      setMessage('All fields are required')
      setLoading(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setMessage('Passwords do not match')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setMessage('Password must be at least 6 characters')
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
        confirmPassword: formData.password,
        role: formData.role as 'pet_owner' | 'farmer' | 'veterinarian'
      })
      setMessage('✓ Registration successful! Logging you in...')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const roleOptions = [
    { value: 'pet_owner', label: 'Pet Owner', icon: '🐕', desc: 'Manage pets & book consultations' },
    { value: 'farmer', label: 'Farmer', icon: '🐄', desc: 'Enterprise livestock management' },
    { value: 'veterinarian', label: 'Veterinarian', icon: '👨‍⚕️', desc: 'Provide consultations & care' },
  ]

  return (
    <div className="auth-page register-page">
      <div className="register-wrapper">
        {/* Left: Branding strip */}
        <div className="register-brand">
          <div className="register-brand-inner">
            <div className="register-logo">🏥</div>
            <h2>VetCare</h2>
            <p className="register-tagline">The Complete Animal Health Platform</p>
            <div className="register-features">
              <div className="register-feat"><span className="register-feat-icon">🩺</span><div><strong>Expert Care</strong><span>Licensed veterinarians</span></div></div>
              <div className="register-feat"><span className="register-feat-icon">⚡</span><div><strong>Instant Access</strong><span>24/7 availability</span></div></div>
              <div className="register-feat"><span className="register-feat-icon">🔒</span><div><strong>Secure</strong><span>HIPAA-grade privacy</span></div></div>
              <div className="register-feat"><span className="register-feat-icon">🏢</span><div><strong>Enterprise Ready</strong><span>Scale from 1 to 10,000+</span></div></div>
            </div>
            <div className="register-trust">
              <span>Trusted by <strong>3,000+</strong> enterprises</span>
            </div>
          </div>
        </div>

        {/* Right: Registration form */}
        <div className="register-form-panel">
          <div className="register-form-topbar">
            {onGoHome && <button className="back-home-btn" onClick={onGoHome} title="Back to Home">← Home</button>}
            <span className="register-topbar-login">Already a member? <button className="link-btn" onClick={onSwitchToLogin}>Sign in</button></span>
          </div>
          <div className="register-form-header">
            <h1>Create your account</h1>
            <p>Get started in under 2 minutes</p>
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
                <label htmlFor="reg-firstName">First Name</label>
                <input id="reg-firstName" type="text" name="firstName" placeholder="John" value={formData.firstName} onChange={handleChange} required autoComplete="given-name" aria-required="true" />
              </div>
              <div className="form-group">
                <label htmlFor="reg-lastName">Last Name</label>
                <input id="reg-lastName" type="text" name="lastName" placeholder="Doe" value={formData.lastName} onChange={handleChange} required autoComplete="family-name" aria-required="true" />
              </div>
            </div>

            {/* Email + Phone row */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="reg-email">Email</label>
                <input id="reg-email" type="email" name="email" placeholder="you@email.com" value={formData.email} onChange={handleChange} required autoComplete="email" aria-required="true" />
              </div>
              <div className="form-group">
                <label htmlFor="reg-phone">Phone</label>
                <input id="reg-phone" type="tel" name="phone" placeholder="+1 (555) 000-0000" value={formData.phone} onChange={handleChange} required autoComplete="tel" aria-required="true" />
              </div>
            </div>

            {/* Role selector cards */}
            <fieldset className="form-group" style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontWeight: 600, marginBottom: '8px' }}>I am a...</legend>
              <div className="role-selector" role="radiogroup" aria-label="Select your role">
                {roleOptions.map(opt => (
                  <label key={opt.value} className={`role-option ${formData.role === opt.value ? 'selected' : ''}`}>
                    <input type="radio" name="role" value={opt.value} checked={formData.role === opt.value} onChange={handleChange} aria-describedby={`role-desc-${opt.value}`} />
                    <span className="role-icon" aria-hidden="true">{opt.icon}</span>
                    <span className="role-label">{opt.label}</span>
                    <span className="role-desc" id={`role-desc-${opt.value}`}>{opt.desc}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Password row */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="reg-password">Password</label>
                <input id="reg-password" type="password" name="password" placeholder="Min 6 characters" value={formData.password} onChange={handleChange} required autoComplete="new-password" aria-required="true" aria-describedby="password-hint" />
                <span id="password-hint" className="sr-only">Must be at least 6 characters</span>
              </div>
              <div className="form-group">
                <label htmlFor="reg-confirmPassword">Confirm Password</label>
                <input id="reg-confirmPassword" type="password" name="confirmPassword" placeholder="Re-enter password" value={formData.confirmPassword} onChange={handleChange} required autoComplete="new-password" aria-required="true" />
              </div>
            </div>

            <button type="submit" className="btn btn-primary register-submit" disabled={loading} aria-busy={loading}>
              {loading ? (
                <span className="btn-loading"><span className="spinner" aria-hidden="true" /> Creating Account...</span>
              ) : (
                'Create Account'
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
