import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

interface RegisterProps {
  onSwitchToLogin: () => void
}

export default function Register({ onSwitchToLogin }: RegisterProps) {
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

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <h1>📝 Create Account</h1>
          <p className="subtitle">Join VetCare Community</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>First Name</label>
              <input
                type="text"
                name="firstName"
                placeholder="Your first name"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Last Name</label>
              <input
                type="text"
                name="lastName"
                placeholder="Your last name"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                name="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                name="phone"
                placeholder="+1 (555) 000-0000"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Role</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
              >
                <option value="pet_owner">Pet Owner</option>
                <option value="farmer">Farmer</option>
                <option value="veterinarian">Veterinarian</option>
              </select>
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                placeholder="Enter password (min 6 characters)"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating Account...' : 'Register'}
            </button>
          </form>

          {message && (
            <div className={`message ${message.includes('✓') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          <div className="auth-divider">Already have an account?</div>

          <button className="btn btn-secondary" onClick={onSwitchToLogin}>
            Login Here
          </button>
        </div>

        <div className="auth-info">
          <h2>Why Join VetCare?</h2>
          <p>Reliable veterinary care at your fingertips</p>
          <div className="features-list">
            <div className="feature">
              <span className="icon">🩺</span>
              <span>Expert Medical Advice</span>
            </div>
            <div className="feature">
              <span className="icon">⏱️</span>
              <span>Fast Response</span>
            </div>
            <div className="feature">
              <span className="icon">💰</span>
              <span>Affordable Rates</span>
            </div>
            <div className="feature">
              <span className="icon">🔒</span>
              <span>Secure & Private</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
