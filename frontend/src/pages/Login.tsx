import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

interface LoginProps {
  onSwitchToRegister: () => void
  onGoHome?: () => void
}

export default function Login({ onSwitchToRegister, onGoHome }: LoginProps) {
  const { login } = useAuth()
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
      setMessage(error instanceof Error ? error.message : 'Login failed')
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
            <p className="login-tagline">Welcome back</p>
            <div className="login-features">
              <div className="login-feat"><span className="login-feat-check">✓</span><span>24/7 Online Consultations</span></div>
              <div className="login-feat"><span className="login-feat-check">✓</span><span>Licensed Veterinarians</span></div>
              <div className="login-feat"><span className="login-feat-check">✓</span><span>Quick Response Time</span></div>
              <div className="login-feat"><span className="login-feat-check">✓</span><span>Enterprise-Grade Security</span></div>
              <div className="login-feat"><span className="login-feat-check">✓</span><span>Complete Health Records</span></div>
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
            {onGoHome && <button className="back-home-btn" onClick={onGoHome} title="Back to Home">← Home</button>}
            <span className="login-topbar-register">New here? <button className="link-btn" onClick={onSwitchToRegister}>Create account</button></span>
          </div>

          <div className="login-form-center">
            <div className="login-form-header">
              <h1>Sign in to your account</h1>
              <p>Enter your credentials to continue</p>
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

            <form onSubmit={handleSubmit} className="login-form" aria-label="Sign in form">
              <div className="form-group">
                <label htmlFor="login-email">Email Address</label>
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
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  aria-required="true"
                />
              </div>

              <button type="submit" className="btn btn-primary login-submit" disabled={loading} aria-busy={loading}>
                {loading ? (
                  <span className="btn-loading"><span className="spinner" aria-hidden="true" /> Signing in...</span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="login-footer">
              <span>Don't have an account?</span>
              <button className="link-btn" onClick={onSwitchToRegister}>Create one free</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
