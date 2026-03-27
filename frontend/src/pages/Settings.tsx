import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import apiService from '../services/api'
import './ModulePage.css'
import { useTranslation } from 'react-i18next'
import { VetProfile } from '../types'

const Settings: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { formatCurrency, formatDateTime } = useSettings()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isVet = user?.role === 'veterinarian'

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dataSummary, setDataSummary] = useState<any>(null)
  const [dataLoading, setDataLoading] = useState(false)

  // Basic profile
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })

  // Vet-specific profile
  const [vetForm, setVetForm] = useState({
    consultationFee: '',
    bio: '',
    specializations: '',
    qualifications: '',
    languages: '',
    clinicName: '',
    clinicAddress: '',
    licenseNumber: '',
    yearsOfExperience: '',
    availableDays: '',
    availableHoursStart: '',
    availableHoursEnd: '',
    isAvailable: true,
    acceptsEmergency: false,
    profileImage: '',
  })

  useEffect(() => {
    if (isVet) {
      loadVetProfile()
    }
  }, [isVet])

  const loadVetProfile = async () => {
    try {
      const result = await apiService.getMyVetProfile()
      const p = result.data as VetProfile
      setVetForm({
        consultationFee: p.consultationFee?.toString() || '',
        bio: p.bio || '',
        specializations: (p.specializations || []).join(', '),
        qualifications: (p.qualifications || []).join(', '),
        languages: (p.languages || []).join(', '),
        clinicName: p.clinicName || '',
        clinicAddress: p.clinicAddress || '',
        licenseNumber: p.licenseNumber || '',
        yearsOfExperience: p.yearsOfExperience?.toString() || '',
        availableDays: p.availableDays || '',
        availableHoursStart: p.availableHoursStart || '',
        availableHoursEnd: p.availableHoursEnd || '',
        isAvailable: p.isAvailable ?? true,
        acceptsEmergency: p.acceptsEmergency ?? false,
        profileImage: p.profileImage || '',
      })
    } catch {
      // No vet profile yet
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleVetChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setVetForm(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }))
    } else {
      setVetForm(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleSaveBasic = async () => {
    try {
      setSaving(true)
      await apiService.updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
      })
      showSaved('basic')
    } catch {
      alert(t('settings.alerts.failedUpdateProfile'))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveVet = async () => {
    try {
      setSaving(true)
      const payload: Record<string, unknown> = {
        consultationFee: parseFloat(vetForm.consultationFee) || 0,
        bio: vetForm.bio,
        specializations: vetForm.specializations.split(',').map(s => s.trim()).filter(Boolean),
        qualifications: vetForm.qualifications.split(',').map(s => s.trim()).filter(Boolean),
        languages: vetForm.languages.split(',').map(s => s.trim()).filter(Boolean),
        clinicName: vetForm.clinicName,
        clinicAddress: vetForm.clinicAddress,
        licenseNumber: vetForm.licenseNumber,
        yearsOfExperience: parseInt(vetForm.yearsOfExperience) || 0,
        availableDays: vetForm.availableDays,
        availableHoursStart: vetForm.availableHoursStart,
        availableHoursEnd: vetForm.availableHoursEnd,
        isAvailable: vetForm.isAvailable,
        acceptsEmergency: vetForm.acceptsEmergency,
        profileImage: vetForm.profileImage,
      }
      await apiService.updateVetProfile(payload)
      showSaved('vet')
    } catch {
      alert(t('settings.alerts.failedUpdateVetProfile'))
    } finally {
      setSaving(false)
    }
  }

  const showSaved = (section: string) => {
    setSaved(section)
    setTimeout(() => setSaved(''), 3000)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploading(true)
      const result = await apiService.uploadFile(file, 'profiles')
      const url = result.url || result.key
      setVetForm(prev => ({ ...prev, profileImage: url }))
    } catch {
      alert(t('settings.alerts.failedUploadPhoto'))
    } finally {
      setUploading(false)
    }
  }

  const profileImageUrl = vetForm.profileImage

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>{t('settings.pageTitle')}</h1>
      </div>

      <div className="module-content">
        <div className="settings-container">
          {/* Basic Profile */}
          <div className="settings-section">
            <h2>{t('settings.profile.title')}</h2>
            <div className="settings-form">
              <div className="form-group">
                <label>{t('settings.profile.firstName')}</label>
                <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>{t('settings.profile.lastName')}</label>
                <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>{t('settings.profile.email')}</label>
                <input type="email" name="email" value={formData.email} disabled />
              </div>
              <div className="form-group">
                <label>{t('settings.profile.phone')}</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} />
              </div>
              <button className="btn-primary" onClick={handleSaveBasic} disabled={saving}>
                {saving ? t('settings.saving') : t('settings.profile.saveChanges')}
              </button>
              {saved === 'basic' && <span style={{ color: '#16a34a', marginLeft: 12, fontSize: 13 }}>{t('settings.saved')}</span>}
            </div>
          </div>

          {/* Vet Professional Profile */}
          {isVet && (
            <>
              <div className="settings-section">
                <h2>{t('settings.professional.title')}</h2>

                {/* Photo Upload */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%', background: '#e0e7ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', border: '3px solid #667eea', flexShrink: 0
                  }}>
                    {profileImageUrl ? (
                      <img src={profileImageUrl} alt={t('settings.professional.profileAlt')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 32, color: '#667eea' }}>
                        {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                    <button className="btn-small" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? t('settings.professional.uploading') : t('settings.professional.changePhoto')}
                    </button>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>{t('settings.professional.maxFileSize')}</p>
                  </div>
                </div>

                <div className="settings-form">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="form-group">
                      <label>{t('settings.professional.licenseNumber')}</label>
                      <input type="text" name="licenseNumber" value={vetForm.licenseNumber} onChange={handleVetChange} placeholder={t('settings.professional.licensePlaceholder')} />
                    </div>
                    <div className="form-group">
                      <label>{t('settings.professional.yearsOfExperience')}</label>
                      <input type="number" name="yearsOfExperience" value={vetForm.yearsOfExperience} onChange={handleVetChange} min="0" max="80" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>{t('settings.professional.bio')}</label>
                    <textarea name="bio" value={vetForm.bio} onChange={handleVetChange} rows={3}
                      placeholder={t('settings.professional.bioPlaceholder')} 
                      style={{ padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 14, resize: 'vertical' }} />
                  </div>

                  <div className="form-group">
                    <label>{t('settings.professional.specializations')}</label>
                    <input type="text" name="specializations" value={vetForm.specializations} onChange={handleVetChange}
                      placeholder={t('settings.professional.specializationsPlaceholder')} />
                  </div>

                  <div className="form-group">
                    <label>{t('settings.professional.qualifications')}</label>
                    <input type="text" name="qualifications" value={vetForm.qualifications} onChange={handleVetChange}
                      placeholder={t('settings.professional.qualificationsPlaceholder')} />
                  </div>

                  <div className="form-group">
                    <label>{t('settings.professional.languages')}</label>
                    <input type="text" name="languages" value={vetForm.languages} onChange={handleVetChange}
                      placeholder={t('settings.professional.languagesPlaceholder')} />
                  </div>
                </div>
              </div>

              {/* Consultation & Rates */}
              <div className="settings-section">
                <h2>{t('settings.consultation.title')}</h2>
                <div className="settings-form">
                  <div className="form-group">
                    <label>{t('settings.consultation.fee')}</label>
                    <div style={{ position: 'relative' }}>
                      <input type="number" name="consultationFee" value={vetForm.consultationFee} onChange={handleVetChange}
                        min="0" step="0.01" placeholder="500" style={{ paddingLeft: 12 }} />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 13 }}>
                        {formatCurrency(parseFloat(vetForm.consultationFee) || 0).replace(/[\d,.\s]/g, '').trim() || '$'}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
                      {t('settings.consultation.preview')} {formatCurrency(parseFloat(vetForm.consultationFee) || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Clinic & Availability */}
              <div className="settings-section">
                <h2>{t('settings.clinic.title')}</h2>
                <div className="settings-form">
                  <div className="form-group">
                    <label>{t('settings.clinic.name')}</label>
                    <input type="text" name="clinicName" value={vetForm.clinicName} onChange={handleVetChange}
                      placeholder={t('settings.clinic.namePlaceholder')} />
                  </div>
                  <div className="form-group">
                    <label>{t('settings.clinic.address')}</label>
                    <input type="text" name="clinicAddress" value={vetForm.clinicAddress} onChange={handleVetChange}
                      placeholder={t('settings.clinic.addressPlaceholder')} />
                  </div>
                  <div className="form-group">
                    <label>{t('settings.clinic.availableDays')}</label>
                    <input type="text" name="availableDays" value={vetForm.availableDays} onChange={handleVetChange}
                      placeholder={t('settings.clinic.availableDaysPlaceholder')} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="form-group">
                      <label>{t('settings.clinic.hoursStart')}</label>
                      <input type="time" name="availableHoursStart" value={vetForm.availableHoursStart} onChange={handleVetChange} />
                    </div>
                    <div className="form-group">
                      <label>{t('settings.clinic.hoursEnd')}</label>
                      <input type="time" name="availableHoursEnd" value={vetForm.availableHoursEnd} onChange={handleVetChange} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 24, padding: '8px 0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" name="isAvailable" checked={vetForm.isAvailable} onChange={handleVetChange} />
                      <span>{t('settings.clinic.availableForConsultations')}</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" name="acceptsEmergency" checked={vetForm.acceptsEmergency} onChange={handleVetChange} />
                      <span>{t('settings.clinic.acceptEmergency')}</span>
                    </label>
                  </div>
                  <button className="btn-primary" onClick={handleSaveVet} disabled={saving}>
                    {saving ? t('settings.saving') : t('settings.professional.saveProfile')}
                  </button>
                  {saved === 'vet' && <span style={{ color: '#16a34a', marginLeft: 12, fontSize: 13 }}>{t('settings.professional.profileSaved')}</span>}
                </div>
              </div>
            </>
          )}

          {/* Preferences section */}
          <div className="settings-section">
            <h2>{t('settings.preferences.title')}</h2>
            <div className="preferences-list">
              <label className="preference-item">
                <input type="checkbox" defaultChecked />
                <span>{t('settings.preferences.emailNotifications')}</span>
              </label>
              <label className="preference-item">
                <input type="checkbox" defaultChecked />
                <span>{t('settings.preferences.smsReminders')}</span>
              </label>
              <label className="preference-item">
                <input type="checkbox" />
                <span>{t('settings.preferences.marketingEmails')}</span>
              </label>
              <label className="preference-item">
                <input type="checkbox" defaultChecked />
                <span>{t('settings.preferences.shareHealth')}</span>
              </label>
            </div>
          </div>

          {/* Privacy & Data section */}
          <div className="settings-section">
            <h2>{t('settings.privacy.title')}</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              {t('settings.privacy.description')}
            </p>

            {!dataSummary ? (
              <button className="btn btn-outline" onClick={async () => {
                setDataLoading(true)
                try {
                  const result = await apiService.getUserDataSummary()
                  setDataSummary(result.data || {})
                } catch { /* */ } finally { setDataLoading(false) }
              }} disabled={dataLoading}>
                {dataLoading ? t('settings.privacy.loading') : t('settings.privacy.viewDataSummary')}
              </button>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: t('settings.privacy.medicalRecords'), value: dataSummary.medicalRecords, icon: '📋' },
                    { label: t('settings.privacy.consultations'), value: dataSummary.consultations, icon: '🏥' },
                    { label: t('settings.privacy.prescriptions'), value: dataSummary.prescriptions, icon: '💊' },
                    { label: t('settings.privacy.animals'), value: dataSummary.animals, icon: '🐾' },
                    { label: t('settings.privacy.auditTrail'), value: dataSummary.auditEntries, icon: '📜' },
                    { label: t('settings.privacy.activeSessions'), value: dataSummary.activeSessions, icon: '🟢' },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: '12px 16px', borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <div style={{ fontSize: 20 }}>{item.icon}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#374151' }}>{item.value ?? 0}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{item.label}</div>
                    </div>
                  ))}
                </div>
                {dataSummary.lastLogin && (
                  <p style={{ fontSize: 12, color: '#6b7280' }}>{t('settings.privacy.lastLogin')} {formatDateTime(dataSummary.lastLogin)}</p>
                )}
              </div>
            )}

            <div style={{ marginTop: 16, padding: 16, borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>{t('settings.privacy.dataRightsTitle')}</h4>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#166534', lineHeight: 1.8 }}>
                <li><strong>{t('settings.privacy.rightToAccess')}</strong> {t('settings.privacy.rightToAccessDesc')}</li>
                <li><strong>{t('settings.privacy.rightToRectification')}</strong> {t('settings.privacy.rightToRectificationDesc')}</li>
                <li><strong>{t('settings.privacy.rightToPortability')}</strong> {t('settings.privacy.rightToPortabilityDesc')}</li>
                <li><strong>{t('settings.privacy.rightToErasure')}</strong> {t('settings.privacy.rightToErasureDesc')}</li>
                <li><strong>{t('settings.privacy.rightToRestrict')}</strong> {t('settings.privacy.rightToRestrictDesc')}</li>
              </ul>
            </div>

            <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 12, color: '#92400e' }}>
              {t('settings.privacy.retentionWarning')}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .settings-container {
          max-width: 700px;
        }

        .settings-section {
          margin-bottom: 32px;
          padding-bottom: 32px;
          border-bottom: 1px solid #e0e0e0;
        }

        .settings-section:last-child {
          border-bottom: none;
        }

        .settings-section h2 {
          font-size: 18px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0 0 16px 0;
        }

        .settings-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-weight: 600;
          font-size: 13px;
          color: #1a1a1a;
        }

        .form-group input,
        .form-group textarea {
          padding: 10px 12px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          font-size: 14px;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-group input:disabled {
          background: #f5f5f5;
          color: #999;
          cursor: not-allowed;
        }

        .preferences-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .preference-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 6px;
          background: #f9f9f9;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .preference-item:hover {
          background: #f0f0f0;
        }

        .preference-item input[type="checkbox"] {
          cursor: pointer;
          width: 18px;
          height: 18px;
        }

        .preference-item span {
          font-size: 14px;
          color: #1a1a1a;
        }

        @media (max-width: 768px) {
          .settings-container {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  )
}

export default Settings
