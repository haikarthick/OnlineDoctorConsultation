import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import '../../styles/modules.css'

interface PrescriptionSettingsProps {
  onNavigate: (path: string) => void
}

interface SettingField {
  key: string
  label: string
  description: string
  placeholder: string
  type?: 'text' | 'textarea' | 'url' | 'email' | 'tel'
  rows?: number
}

const FIELDS: SettingField[] = [
  {
    key: 'prescription.clinicName',
    label: 'prescriptionSettings.clinicName',
    description: 'prescriptionSettings.clinicNameDesc',
    placeholder: 'e.g. VetCare Clinic',
    type: 'text',
  },
  {
    key: 'prescription.clinicTagline',
    label: 'prescriptionSettings.clinicTagline',
    description: 'prescriptionSettings.clinicTaglineDesc',
    placeholder: 'e.g. Compassionate Care for Your Animals',
    type: 'text',
  },
  {
    key: 'prescription.clinicAddress',
    label: 'prescriptionSettings.clinicAddress',
    description: 'prescriptionSettings.clinicAddressDesc',
    placeholder: 'e.g. 123 Vet Avenue, Chennai, Tamil Nadu 600001',
    type: 'textarea',
    rows: 3,
  },
  {
    key: 'prescription.clinicPhone',
    label: 'prescriptionSettings.clinicPhone',
    description: 'prescriptionSettings.clinicPhoneDesc',
    placeholder: 'e.g. +91 44 1234 5678',
    type: 'tel',
  },
  {
    key: 'prescription.clinicEmail',
    label: 'prescriptionSettings.clinicEmail',
    description: 'prescriptionSettings.clinicEmailDesc',
    placeholder: 'e.g. care@vetcare.com',
    type: 'email',
  },
  {
    key: 'prescription.clinicWebsite',
    label: 'prescriptionSettings.clinicWebsite',
    description: 'prescriptionSettings.clinicWebsiteDesc',
    placeholder: 'e.g. www.vetcareplatform.com',
    type: 'url',
  },
  {
    key: 'prescription.registrationNumber',
    label: 'prescriptionSettings.regNumber',
    description: 'prescriptionSettings.regNumberDesc',
    placeholder: 'e.g. VET-REG-2024-001',
    type: 'text',
  },
  {
    key: 'prescription.clinicLogo',
    label: 'prescriptionSettings.logoUrl',
    description: 'prescriptionSettings.logoUrlDesc',
    placeholder: 'https://... (leave blank for default 🐾 icon)',
    type: 'url',
  },
  {
    key: 'prescription.footerText',
    label: 'prescriptionSettings.footerText',
    description: 'prescriptionSettings.footerTextDesc',
    placeholder: 'e.g. This prescription is digitally generated...',
    type: 'textarea',
    rows: 3,
  },
]

const PrescriptionSettings: React.FC<PrescriptionSettingsProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const [values, setValues] = useState<Record<string, string>>({})
  const [original, setOriginal] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await apiService.adminGetSettings()
      const allSettings: { key: string; value: string }[] = res.data?.settings || res.data || []
      const prescriptionSettings = allSettings.filter((s) => s.key.startsWith('prescription.'))
      const vals: Record<string, string> = {}
      for (const s of prescriptionSettings) {
        vals[s.key] = s.value || ''
      }
      // Ensure all field keys exist (with empty default)
      for (const f of FIELDS) {
        if (!(f.key in vals)) vals[f.key] = ''
      }
      setValues(vals)
      setOriginal({ ...vals })
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || t('prescriptionSettings.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { loadSettings() }, [loadSettings])

  const handleChange = (key: string, val: string) => {
    setValues(prev => ({ ...prev, [key]: val }))
  }

  const handleSave = async (key: string) => {
    try {
      setSaving(key)
      setError('')
      await apiService.adminUpdateSetting(key, values[key] || '')
      setOriginal(prev => ({ ...prev, [key]: values[key] || '' }))
      setSavedKeys(prev => new Set(prev).add(key))
      setTimeout(() => setSavedKeys(prev => {
        const n = new Set(prev); n.delete(key); return n
      }), 2500)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || t('prescriptionSettings.failedToSave'))
    } finally {
      setSaving(null)
    }
  }

  const handleSaveAll = async () => {
    setSaving('__all__')
    setError('')
    const keysToSave = FIELDS
      .map(f => f.key)
      .filter(k => (values[k] ?? '') !== (original[k] ?? ''))

    if (keysToSave.length === 0) {
      setSaving(null)
      return
    }

    let hadError = false
    for (const key of keysToSave) {
      try {
        await apiService.adminUpdateSetting(key, values[key] || '')
        setOriginal(prev => ({ ...prev, [key]: values[key] || '' }))
        setSavedKeys(prev => new Set(prev).add(key))
      } catch {
        hadError = true
      }
    }
    if (hadError) setError(t('prescriptionSettings.someFailed'))
    setSaving(null)
    setTimeout(() => setSavedKeys(new Set()), 3000)
  }

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 512 * 1024) {
      setError(t('prescriptionSettings.logoTooLarge'))
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string
      if (b64) handleChange('prescription.clinicLogo', b64)
    }
    reader.readAsDataURL(file)
  }

  const dirtyCount = FIELDS.filter(f => (values[f.key] ?? '') !== (original[f.key] ?? '')).length

  if (loading) {
    return (
      <div className="module-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  const logoValue = values['prescription.clinicLogo'] || ''
  const previewTemplate = {
    clinicName: values['prescription.clinicName'] || 'VetCare Platform',
    clinicTagline: values['prescription.clinicTagline'] || '',
    clinicAddress: values['prescription.clinicAddress'] || '',
    clinicPhone: values['prescription.clinicPhone'] || '',
    clinicEmail: values['prescription.clinicEmail'] || '',
    clinicWebsite: values['prescription.clinicWebsite'] || '',
    registrationNumber: values['prescription.registrationNumber'] || '',
    clinicLogo: logoValue,
    footerText: values['prescription.footerText'] || '',
  }

  return (
    <div className="module-page">
      {/* ── Header ── */}
      <div className="module-header">
        <div>
          <h1>📄 {t('prescriptionSettings.title')}</h1>
          <p>{t('prescriptionSettings.subtitle')}</p>
        </div>
        <div className="si-1f73e46e">
          <button className="module-btn" onClick={() => onNavigate('/admin/settings')}>
            ← {t('prescriptionSettings.backToSettings')}
          </button>
          <button
            className="module-btn si-e74c278d"
            onClick={() => setPreviewOpen(true)}
           
          >
            👁 {t('prescriptionSettings.preview')}
          </button>
          <button
            className="module-btn primary"
            onClick={handleSaveAll}
            disabled={dirtyCount === 0 || saving === '__all__'}
          >
            {saving === '__all__' ? t('common.saving') : `💾 ${t('prescriptionSettings.saveAll')}${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
          </button>
        </div>
      </div>

      {error && (
        <div className="module-alert error si-7e63ec4f">
          {error}
          <button className="module-alert-close" onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* ── Info card ── */}
      <div className="module-card si-7323c815">
        <p className="si-c325fe02">
          <strong>ℹ {t('prescriptionSettings.infoTitle')}</strong><br />
          {t('prescriptionSettings.infoBody')}
        </p>
      </div>

      {/* ── Settings grid ── */}
      <div className="si-e295240a">
        {FIELDS.map(field => {
          const isSaved = savedKeys.has(field.key)
          const isDirty = (values[field.key] ?? '') !== (original[field.key] ?? '')
          const isSavingThis = saving === field.key
          return (
            <div key={field.key} className="module-card si-c1cf531d">
              <div className="si-b4e0b8ef">
                <div className="si-6acd75e8">
                  <label className="module-label si-5590bd39">
                    {t(field.label)}
                    {isDirty && <span className="si-0b1fc646">● {t('prescriptionSettings.unsaved')}</span>}
                    {isSaved && <span className="si-55254f4a">✓ {t('prescriptionSettings.saved')}</span>}
                  </label>
                  <p className="si-cae0e328">{t(field.description)}</p>
                </div>
                <button
                  className="module-btn small primary si-9c776b6c"
                  onClick={() => handleSave(field.key)}
                  disabled={!isDirty || isSavingThis}
                 
                >
                  {isSavingThis ? t('common.saving') : t('common.save')}
                </button>
              </div>

              {/* Logo field gets a special upload option */}
              {field.key === 'prescription.clinicLogo' && (
                <div className="si-73ddb51a">
                  {logoValue && (
                    <img
                      src={logoValue}
                      alt="logo preview"
                      className="si-97bf0235"
                    />
                  )}
                  <div>
                    <button
                      className="module-btn small si-e57614ee"
                      onClick={() => fileInputRef.current?.click()}
                     
                    >
                      📁 {t('prescriptionSettings.uploadLogo')}
                    </button>
                    <p className="si-107b2991">{t('prescriptionSettings.logoSizeHint')}</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="si-d6a2f871"
                    onChange={handleLogoFileSelect}
                  />
                </div>
              )}

              {field.type === 'textarea' ? (
                <textarea
                  className="module-input si-3d14eb54"
                  value={values[field.key] || ''}
                  onChange={e => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={field.rows || 3}
                 
                />
              ) : (
                <input
                  className="module-input"
                  type={field.type || 'text'}
                  value={values[field.key] || ''}
                  onChange={e => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* ── Preview modal (letterhead preview only) ── */}
      {previewOpen && (
        <div
          className="si-e4d19b82"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="si-099182d8"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewOpen(false)}
              className="si-4e0924aa"
            >✕</button>
            <h2 className="si-eefdbd81">
              {t('prescriptionSettings.letterheadPreview')}
            </h2>

            {/* Letterhead preview */}
            <div className="si-320a01a0">
              <div className="si-82c77ef0">
                {previewTemplate.clinicLogo ? (
                  <img src={previewTemplate.clinicLogo} alt="logo"
                    className="si-da66f361" />
                ) : (
                  <div className="si-dbafcb6e">🐾</div>
                )}
                <div className="si-6acd75e8">
                  <div className="si-9a37d6b6">
                    {previewTemplate.clinicName}
                  </div>
                  {previewTemplate.clinicTagline && (
                    <div className="si-8c492035">
                      {previewTemplate.clinicTagline}
                    </div>
                  )}
                  <div className="si-782ddda2">
                    {previewTemplate.clinicPhone && <span>📞 {previewTemplate.clinicPhone}</span>}
                    {previewTemplate.clinicEmail && <span>✉ {previewTemplate.clinicEmail}</span>}
                    {previewTemplate.clinicWebsite && <span>🌐 {previewTemplate.clinicWebsite}</span>}
                  </div>
                  {previewTemplate.clinicAddress && (
                    <div className="si-a53c147b">
                      📍 {previewTemplate.clinicAddress}
                    </div>
                  )}
                  {previewTemplate.registrationNumber && (
                    <div className="si-c4d06922">
                      {t('prescriptionPrint.regNo')}: {previewTemplate.registrationNumber}
                    </div>
                  )}
                </div>
              </div>
              <div className="si-d6351209" />
              <div className="si-e47cd326">
                ⚕ PRESCRIPTION ⚕
              </div>
              <div className="si-bdc34173">
                {previewTemplate.footerText}
              </div>
            </div>

            <p className="si-1480138f">
              {t('prescriptionSettings.previewNote')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default PrescriptionSettings
