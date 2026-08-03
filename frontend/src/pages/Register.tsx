import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useGroomingEnabled } from '../hooks/useGroomingEnabled'
import PasswordInput from '../components/PasswordInput'
import './Auth.css'

interface RegisterProps {
  onSwitchToLogin: () => void
  onGoHome?: () => void
}

/**
 * Roles a landing page may preselect via ?role=. Deliberately a whitelist rather
 * than trusting the query string - the value goes straight into the role field,
 * and only self-registerable roles belong here.
 */
const PRESELECTABLE_ROLES = ['pet_owner', 'farmer', 'veterinarian', 'corporate_admin', 'groomer']

export default function Register({ onSwitchToLogin, onGoHome }: RegisterProps) {
  const { register } = useAuth()
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const requestedRole = searchParams.get('role')
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    // "List your business" on the home page links here as ?role=groomer, so the
    // visitor lands on the right form instead of having to find the role again.
    role: requestedRole && PRESELECTABLE_ROLES.includes(requestedRole) ? requestedRole : 'pet_owner',
    // Vet-specific
    licenseNumber: '',
    yearsOfExperience: '',
    specializations: '',
    qualifications: '',
    clinicName: '',
    consultationFee: '',
  })
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'pending'>('error')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)

  // Grooming & Spa is dark-launched behind `grooming.enabled`; only offer the role when the
  // module is actually live, otherwise the account would land on a workspace that 404s.
  const { enabled: groomingEnabled } = useGroomingEnabled()

  const isVet = formData.role === 'veterinarian'
  const isCorporate = formData.role === 'corporate_admin'
  const isGroomer = formData.role === 'groomer'
  // groomer self-registers ACTIVE - verification happens per business, not per account
  // (migration 030 + UserService.createUser's pendingRoles list).
  const isPendingRole = isVet || isCorporate

  // If the flag flips off (or the probe resolves late) while 'groomer' is selected, fall back to
  // the default role so the form can never submit a role the backend will reject.
  useEffect(() => {
    if (!groomingEnabled && formData.role === 'groomer') {
      setFormData(prev => ({ ...prev, role: 'pet_owner' }))
    }
  }, [groomingEnabled, formData.role])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
      setMessage(t('register.validation.allRequired'))
      setMessageType('error')
      setLoading(false)
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setMessage(t('register.validation.passwordMismatch'))
      setMessageType('error')
      setLoading(false)
      return
    }
    if (formData.password.length < 8) {
      setMessage(t('register.validation.passwordLength'))
      setMessageType('error')
      setLoading(false)
      return
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      setMessage(t('register.validation.passwordComplexity'))
      setMessageType('error')
      setLoading(false)
      return
    }
    if (isVet && !formData.licenseNumber.trim()) {
      setMessage('License number is required for veterinarian registration.')
      setMessageType('error')
      setLoading(false)
      return
    }
    if (!acceptTerms) {
      setMessage(t('register.validation.acceptTermsRequired'))
      setMessageType('error')
      setLoading(false)
      return
    }

    try {
      const payload: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        role: formData.role,
        acceptTerms: true,
      }
      if (isVet) {
        payload.licenseNumber = formData.licenseNumber.trim()
        if (formData.yearsOfExperience) payload.yearsOfExperience = Number(formData.yearsOfExperience)
        if (formData.specializations) payload.specializations = formData.specializations.split(',').map((s: string) => s.trim()).filter(Boolean)
        if (formData.qualifications) payload.qualifications = formData.qualifications.split(',').map((s: string) => s.trim()).filter(Boolean)
        if (formData.clinicName) payload.clinicName = formData.clinicName.trim()
        if (formData.consultationFee) payload.consultationFee = Number(formData.consultationFee)
      }

      const result = await register(payload)

      // Backend returns { pending: true } for roles needing admin approval
      if ((result as any)?.pending) {
        setSubmitted(true)
        setMessageType('pending')
        setMessage(
          (result as any).message ||
          'Your registration has been submitted and is currently under review. You will be notified by email once your credentials have been verified.'
        )
      } else {
        setMessageType('success')
        setMessage(t('register.success'))
      }
    } catch (error) {
      setMessageType('error')
      setMessage(error instanceof Error ? error.message : t('register.error'))
    } finally {
      setLoading(false)
    }
  }

  const roleOptions = [
    { value: 'pet_owner', label: t('register.rolePetOwner'), icon: '🐕', desc: t('register.rolePetOwnerDesc') },
    { value: 'farmer', label: t('register.roleFarmer'), icon: '🐄', desc: t('register.roleFarmerDesc') },
    { value: 'veterinarian', label: t('register.roleVet'), icon: '👨‍⚕️', desc: t('register.roleVetDesc') },
    { value: 'corporate_admin', label: t('register.roleCorporateAdmin'), icon: '🏥', desc: t('register.roleCorporateAdminDesc') },
    ...(groomingEnabled
      ? [{ value: 'groomer', label: t('register.roleGroomer'), icon: '💈', desc: t('register.roleGroomerDesc') }]
      : []),
  ]

  // After a pending-role submits successfully, show confirmation screen only
  if (submitted && isPendingRole) {
    return (
      <div className="auth-page register-page">
        <div className="register-wrapper si-9c74bdb1">
          <div className="register-form-panel si-63396e81">
            <div className="si-39f4be31">
              <div className="si-fa85da6a">📋</div>
              <h2 className="si-3917559d">Registration Submitted</h2>
              <p className="si-936668ca">{message}</p>
              <button className="btn btn-primary" onClick={onSwitchToLogin}>Back to Login</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

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
              <div className="register-feat"><span className="register-feat-icon">🏥</span><div><strong>{t('register.features.hospitalNetwork')}</strong><span>{t('register.features.hospitalNetworkDesc')}</span></div></div>
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
            <span className="register-topbar-login">{t('register.alreadyMember')} <button className="link-btn" onClick={onSwitchToLogin}>{t('register.signIn')}</button></span>
          </div>
          <div className="register-form-header">
            <h1>{t('register.title')}</h1>
            <p>{t('register.subtitle')}</p>
          </div>

          {message && (
            <div
              className={`message ${messageType === 'pending' ? 'info' : messageType === 'success' ? 'success' : 'error'}`}
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
                <input id="reg-firstName" type="text" name="firstName" placeholder="John" value={formData.firstName} onChange={handleChange} required autoComplete="given-name" />
              </div>
              <div className="form-group">
                <label htmlFor="reg-lastName">{t('register.lastName')}</label>
                <input id="reg-lastName" type="text" name="lastName" placeholder="Doe" value={formData.lastName} onChange={handleChange} required autoComplete="family-name" />
              </div>
            </div>

            {/* Email + Phone */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="reg-email">{t('register.email')}</label>
                <input id="reg-email" type="email" name="email" placeholder="you@email.com" value={formData.email} onChange={handleChange} required autoComplete="email" />
              </div>
              <div className="form-group">
                <label htmlFor="reg-phone">{t('register.phone')}</label>
                <input id="reg-phone" type="tel" name="phone" placeholder="+1 (555) 000-0000" value={formData.phone} onChange={handleChange} required autoComplete="tel" />
              </div>
            </div>

            {/* Role selector */}
            <fieldset className="form-group si-cb5809a5">
              <legend className="si-7d20e6f0">{t('register.roleTitle')}</legend>
              <div className="role-selector" role="radiogroup" aria-label="Select your role">
                {roleOptions.map(opt => (
                  <label key={opt.value} className={`role-option ${formData.role === opt.value ? 'selected' : ''}`}>
                    <input type="radio" name="role" value={opt.value} checked={formData.role === opt.value} onChange={handleChange} />
                    <span className="role-icon" aria-hidden="true">{opt.icon}</span>
                    <span className="role-label">{opt.label}</span>
                    <span className="role-desc">{opt.desc}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Pending-approval notice banner */}
            {isPendingRole && (
              <div className="hospital-callout" role="note">
                <span className="hospital-callout-icon">ℹ️</span>
                <div className="hospital-callout-body">
                  <strong>Account Review Required</strong>
                  <p>
                    {isVet
                      ? 'Veterinarian registrations are reviewed by our platform team to verify your license. You will receive an email confirmation once approved.'
                      : 'Corporate admin accounts are reviewed before activation. You will be notified by email once your account has been approved.'}
                  </p>
                </div>
              </div>
            )}

            {/* Groomer next-steps notice - the account is active immediately; it is the BUSINESS
                that needs admin verification before it becomes publicly searchable. */}
            {isGroomer && (
              <div className="hospital-callout" role="note">
                <span className="hospital-callout-icon">💈</span>
                <div className="hospital-callout-body">
                  <strong>{t('register.groomerNoticeTitle')}</strong>
                  <p>{t('register.groomerNoticeBody')}</p>
                </div>
              </div>
            )}

            {/* Vet-specific fields (shown only when role = veterinarian) */}
            {isVet && (
              <div className="vet-fields">
                <div className="form-group">
                  <label htmlFor="reg-license">License Number <span className="si-132ea2d7">*</span></label>
                  <input
                    id="reg-license" type="text" name="licenseNumber"
                    placeholder="e.g. VET-MH-2024-00123"
                    value={formData.licenseNumber} onChange={handleChange} required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="reg-experience">Years of Experience</label>
                    <input id="reg-experience" type="number" name="yearsOfExperience" min="0" max="60" placeholder="5" value={formData.yearsOfExperience} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="reg-fee">Consultation Fee (₹)</label>
                    <input id="reg-fee" type="number" name="consultationFee" min="0" placeholder="500" value={formData.consultationFee} onChange={handleChange} />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="reg-clinic">Clinic / Practice Name</label>
                  <input id="reg-clinic" type="text" name="clinicName" placeholder="City Animal Clinic" value={formData.clinicName} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label htmlFor="reg-specializations">Specializations <span className="si-dc842080">(comma separated)</span></label>
                  <input id="reg-specializations" type="text" name="specializations" placeholder="Small Animals, Surgery, Dentistry" value={formData.specializations} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label htmlFor="reg-qualifications">Qualifications <span className="si-dc842080">(comma separated)</span></label>
                  <input id="reg-qualifications" type="text" name="qualifications" placeholder="BVSc, MVSc, PhD" value={formData.qualifications} onChange={handleChange} />
                </div>
              </div>
            )}

            {/* Password row */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="reg-password">{t('register.password')}</label>
                <PasswordInput id="reg-password" name="password" placeholder="Min 8 chars, A-Z, a-z, 0-9" value={formData.password} onChange={handleChange} required autoComplete="new-password" />
              </div>
              <div className="form-group">
                <label htmlFor="reg-confirmPassword">{t('register.confirmPassword')}</label>
                <PasswordInput id="reg-confirmPassword" name="confirmPassword" placeholder="Re-enter password" value={formData.confirmPassword} onChange={handleChange} required autoComplete="new-password" />
              </div>
            </div>

            {/* §17.2: policy acknowledgement - required before account creation */}
            <label className="si-98a162b5">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="si-539810b1"
                aria-required="true"
              />
              <span>
                {t('register.acceptPrefix')}{' '}
                <a href="/policies/terms" target="_blank" rel="noopener noreferrer">{t('register.termsLink')}</a>
                {' '}{t('register.acceptAnd')}{' '}
                <a href="/policies/privacy" target="_blank" rel="noopener noreferrer">{t('register.privacyLink')}</a>
                {isVet && (
                  <>
                    {' '}{t('register.acceptAnd')}{' '}
                    <a href="/policies/doctor_agreement" target="_blank" rel="noopener noreferrer">{t('register.doctorAgreementLink')}</a>
                  </>
                )}
              </span>
            </label>

            <button type="submit" className="btn btn-primary register-submit" disabled={loading || !acceptTerms} aria-busy={loading}>
              {loading
                ? <span className="btn-loading"><span className="spinner" aria-hidden="true" /> {t('register.creatingAccount')}</span>
                : isPendingRole ? 'Submit for Review' : t('register.createAccountBtn')
              }
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
