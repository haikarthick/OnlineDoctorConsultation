import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

interface LoginProps {
  onSwitchToRegister: () => void
}

export default function Login({ onSwitchToRegister }: LoginProps) {
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
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <h1>🔐 Login</h1>
          <p className="subtitle">Welcome back to Veterinary Consultation</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          {message && (
            <div className={`message ${message.includes('✓') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          <div className="auth-divider">Don't have an account?</div>

          <button className="btn btn-secondary" onClick={onSwitchToRegister}>
            Create Account
          </button>
        </div>

        <div className="auth-info">
          <h2>Welcome to VetCare</h2>
          <p>Connect with experienced veterinary doctors for professional consultations</p>
          <div className="features-list">
            <div className="feature">
              <span className="icon">✓</span>
              <span>24/7 Online Consultations</span>
            </div>
            <div className="feature">
              <span className="icon">✓</span>
              <span>Licensed Veterinarians</span>
            </div>
            <div className="feature">
              <span className="icon">✓</span>
              <span>Quick Response Time</span>
            </div>
            <div className="feature">
              <span className="icon">✓</span>
              <span>Affordable Services</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
