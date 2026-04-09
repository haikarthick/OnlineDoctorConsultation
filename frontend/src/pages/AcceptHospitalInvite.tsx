import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import apiService from '../services/api'
import './AcceptHospitalInvite.css'

interface InviteInfo {
  email: string
  name: string
  position: string
  networkName: string
  hospitalName?: string
}

export default function AcceptHospitalInvite() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [step, setStep] = useState<'validating' | 'form' | 'success' | 'error'>('validating')
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', password: '', confirmPassword: '' })

  useEffect(() => {
    if (!token) {
      setErrorMsg('No invite token found. Please use the link from your invitation email.')
      setStep('error')
      return
    }
    apiService.getStaffInviteByToken(token)
      .then(res => {
        if (res.success && res.data) {
          setInviteInfo(res.data)
          const nameParts = (res.data.name || '').trim().split(' ')
          setForm(f => ({
            ...f,
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
          }))
          setStep('form')
        } else {
          setErrorMsg(res.message || 'Invalid or expired invite')
          setStep('error')
        }
      })
      .catch(e => {
        setErrorMsg(e.message || 'Failed to validate invite')
        setStep('error')
      })
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (form.password.length < 8) return setFormError('Password must be at least 8 characters')
    if (form.password !== form.confirmPassword) return setFormError('Passwords do not match')
    setSubmitting(true)
    try {
      const res = await apiService.acceptStaffInvite({
        token,
        first_name: form.firstName,
        last_name: form.lastName,
        phone: form.phone,
        password: form.password,
      })
      if (res.success) {
        setStep('success')
      } else {
        setFormError(res.message || 'Failed to create account')
      }
    } catch (e: any) {
      setFormError(e.message || 'Failed to create account')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'validating') {
    return (
      <div className="invite-page">
        <div className="invite-card">
          <div className="invite-logo">🐾 VetCare</div>
          <div className="loading-spinner" />
          <p>{t('hospitalStaff.validatingInvite')}</p>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="invite-page">
        <div className="invite-card">
          <div className="invite-logo">🐾 VetCare</div>
          <div className="invite-error-icon">⛔</div>
          <h2>{t('hospitalStaff.invalidInvite')}</h2>
          <p className="invite-error-msg">{errorMsg}</p>
          <p className="invite-hint">{t('hospitalStaff.contactAdmin')}</p>
          <button className="invite-btn" onClick={() => navigate('/login')}>{t('hospitalStaff.goToLogin')}</button>
        </div>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="invite-page">
        <div className="invite-card">
          <div className="invite-logo">🐾 VetCare</div>
          <div className="invite-success-icon">✅</div>
          <h2>{t('hospitalStaff.accountCreated')}</h2>
          <p>{t('hospitalStaff.accountCreatedDesc', { network: inviteInfo?.networkName })}</p>
          <button className="invite-btn" onClick={() => navigate('/login')}>{t('hospitalStaff.proceedToLogin')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="invite-page">
      <div className="invite-card">
        <div className="invite-logo">🐾 VetCare</div>
        <div className="invite-header">
          <h2>{t('hospitalStaff.acceptInviteTitle')}</h2>
          <p>{t('hospitalStaff.acceptInviteSubtitle', { network: inviteInfo?.networkName, hospital: inviteInfo?.hospitalName || inviteInfo?.networkName })}</p>
        </div>

        <div className="invite-info-box">
          <div className="invite-info-row">
            <span className="invite-info-label">{t('hospitalStaff.email')}</span>
            <span className="invite-info-val">{inviteInfo?.email}</span>
          </div>
          <div className="invite-info-row">
            <span className="invite-info-label">{t('hospitalStaff.position')}</span>
            <span className="invite-info-val">{inviteInfo?.position}</span>
          </div>
          <div className="invite-info-row">
            <span className="invite-info-label">{t('hospitalStaff.hospital')}</span>
            <span className="invite-info-val">{inviteInfo?.hospitalName || inviteInfo?.networkName}</span>
          </div>
        </div>

        <form className="invite-form" onSubmit={handleSubmit}>
          {formError && <div className="invite-form-error">{formError}</div>}

          <div className="invite-form-row">
            <div className="invite-form-group">
              <label>{t('hospitalStaff.firstName')}</label>
              <input type="text" required value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div className="invite-form-group">
              <label>{t('hospitalStaff.lastName')}</label>
              <input type="text" required value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
            </div>
          </div>

          <div className="invite-form-group">
            <label>{t('hospitalStaff.phone')}</label>
            <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 9876543210" />
          </div>

          <div className="invite-form-group">
            <label>{t('hospitalStaff.email')} <em>(pre-filled, cannot change)</em></label>
            <input type="email" value={inviteInfo?.email || ''} readOnly className="invite-input-readonly" />
          </div>

          <div className="invite-form-group">
            <label>{t('hospitalStaff.password')}</label>
            <input type="password" required minLength={8} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>

          <div className="invite-form-group">
            <label>{t('hospitalStaff.confirmPassword')}</label>
            <input type="password" required value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} />
          </div>

          <div className="invite-privacy-note">
            🔒 {t('hospitalStaff.privacyNote')}
          </div>

          <button type="submit" className="invite-btn" disabled={submitting}>
            {submitting ? t('hospitalStaff.creating') : t('hospitalStaff.createAccount')}
          </button>
        </form>
      </div>
    </div>
  )
}
