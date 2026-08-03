import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import '../../styles/modules.css'

interface CertificateSettingsProps {
  onNavigate: (path: string) => void
}

interface SettingField {
  key: string
  label: string
  description: string
  placeholder: string
  type?: 'text' | 'textarea' | 'url' | 'email' | 'tel'
  rows?: number
  isLogo?: boolean
  isToggle?: boolean
}

const FIELDS: SettingField[] = [
  {
    key: 'cert.clinicName',
    label: 'certificateSettings.clinicName',
    description: 'certificateSettings.clinicNameDesc',
    placeholder: 'e.g. VetCare Clinic',
    type: 'text',
  },
  {
    key: 'cert.clinicAddress',
    label: 'certificateSettings.clinicAddress',
    description: 'certificateSettings.clinicAddressDesc',
    placeholder: 'e.g. 123 Vet Avenue, Chennai, Tamil Nadu 600001',
    type: 'textarea',
    rows: 3,
  },
  {
    key: 'cert.clinicPhone',
    label: 'certificateSettings.clinicPhone',
    description: 'certificateSettings.clinicPhoneDesc',
    placeholder: 'e.g. +91 44 1234 5678',
    type: 'tel',
  },
  {
    key: 'cert.clinicEmail',
    label: 'certificateSettings.clinicEmail',
    description: 'certificateSettings.clinicEmailDesc',
    placeholder: 'e.g. care@vetcare.com',
    type: 'email',
  },
  {
    key: 'cert.clinicWebsite',
    label: 'certificateSettings.clinicWebsite',
    description: 'certificateSettings.clinicWebsiteDesc',
    placeholder: 'e.g. www.vetcareplatform.com',
    type: 'url',
  },
  {
    key: 'cert.registrationNumber',
    label: 'certificateSettings.regNumber',
    description: 'certificateSettings.regNumberDesc',
    placeholder: 'e.g. VET-REG-2024-001',
    type: 'text',
  },
  {
    key: 'cert.autoNumberPrefix',
    label: 'certificateSettings.autoNumberPrefix',
    description: 'certificateSettings.autoNumberPrefixDesc',
    placeholder: 'e.g. VC',
    type: 'text',
  },
  {
    key: 'cert.clinicLogo',
    label: 'certificateSettings.logoUrl',
    description: 'certificateSettings.logoUrlDesc',
    placeholder: 'https://... (leave blank for default icon)',
    type: 'url',
    isLogo: true,
  },
  {
    key: 'cert.footerText',
    label: 'certificateSettings.footerText',
    description: 'certificateSettings.footerTextDesc',
    placeholder: 'e.g. This certificate is digitally generated and valid until the date specified.',
    type: 'textarea',
    rows: 3,
  },
]

const CertificateSettings: React.FC<CertificateSettingsProps> = ({ onNavigate }) => {
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
      const certSettings = allSettings.filter(s => s.key.startsWith('cert.'))
      const vals: Record<string, string> = {}
      for (const s of certSettings) {
        vals[s.key] = s.value || ''
      }
      for (const f of FIELDS) {
        if (!(f.key in vals)) vals[f.key] = ''
      }
      setValues(vals)
      setOriginal({ ...vals })
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || t('certificateSettings.failedToLoad'))
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
      setError(err?.response?.data?.error?.message || t('certificateSettings.failedToSave'))
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

    if (keysToSave.length === 0) { setSaving(null); return }

    let hadError = false
    for (const key of keysToSave) {
      try {
        await apiService.adminUpdateSetting(key, values[key] || '')
        setOriginal(prev => ({ ...prev, [key]: values[key] || '' }))
        setSavedKeys(prev => new Set(prev).add(key))
      } catch { hadError = true }
    }
    if (hadError) setError(t('certificateSettings.someFailed'))
    setSaving(null)
    setTimeout(() => setSavedKeys(new Set()), 3000)
  }

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 512 * 1024) {
      setError(t('certificateSettings.logoTooLarge'))
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string
      if (b64) handleChange('cert.clinicLogo', b64)
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

  const logoValue = values['cert.clinicLogo'] || ''

  return (
    <div className="module-page">
      {/* ── Header ── */}
      <div className="module-header">
        <div>
          <h1>📋 {t('certificateSettings.title')}</h1>
          <p>{t('certificateSettings.subtitle')}</p>
        </div>
        <div className="si-1f73e46e">
          <button className="module-btn" onClick={() => onNavigate('/admin/settings')}>
            ← {t('certificateSettings.backToSettings')}
          </button>
          <button
            className="module-btn si-e74c278d"
            onClick={() => setPreviewOpen(true)}
           
          >
            👁 {t('certificateSettings.preview')}
          </button>
          <button
            className="module-btn primary"
            onClick={handleSaveAll}
            disabled={dirtyCount === 0 || saving === '__all__'}
          >
            {saving === '__all__'
              ? t('common.saving')
              : `💾 ${t('certificateSettings.saveAll')}${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
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
          <strong>ℹ Certificate Number Format:</strong>{' '}
          <code className="si-12e63293">
            {values['cert.autoNumberPrefix'] || 'VC'}-{new Date().getFullYear()}-00001
          </code>
          {' '}- auto-assigned when a vet issues a certificate.
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
                    {t(field.label as any)}
                    {isDirty && (
                      <span className="si-0b1fc646">
                        ● {t('certificateSettings.unsaved')}
                      </span>
                    )}
                    {isSaved && (
                      <span className="si-55254f4a">
                        ✓ {t('certificateSettings.saved')}
                      </span>
                    )}
                  </label>
                  <p className="si-cae0e328">{t(field.description as any)}</p>
                </div>
                <button
                  className="module-btn small primary si-9c776b6c"
                  onClick={() => handleSave(field.key)}
                  disabled={!isDirty || isSavingThis}
                 
                >
                  {isSavingThis ? t('common.saving') : t('common.save')}
                </button>
              </div>

              {/* Logo field: upload button + preview */}
              {field.isLogo && (
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
                      📁 {t('certificateSettings.uploadLogo')}
                    </button>
                    <p className="si-107b2991">{t('certificateSettings.logoSizeHint')}</p>
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

      {/* ── Letterhead preview modal ── */}
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
            <h2 className="si-7d04053f">
              {t('certificateSettings.preview')} - Certificate Letterhead
            </h2>

            <div className="si-1c52eabb">
              <div className="si-82c77ef0">
                {logoValue ? (
                  <img src={logoValue} alt="logo" className="si-da66f361" />
                ) : (
                  <div className="si-a30bd7ff">🏥</div>
                )}
                <div className="si-6acd75e8">
                  <div className="si-71a6f790">
                    {values['cert.clinicName'] || 'VetCare Platform'}
                  </div>
                  <div className="si-2992a603">
                    {values['cert.clinicPhone'] && <span>📞 {values['cert.clinicPhone']}</span>}
                    {values['cert.clinicEmail'] && <span>✉ {values['cert.clinicEmail']}</span>}
                    {values['cert.clinicWebsite'] && <span>🌐 {values['cert.clinicWebsite']}</span>}
                  </div>
                  {values['cert.clinicAddress'] && (
                    <div className="si-a53c147b">📍 {values['cert.clinicAddress']}</div>
                  )}
                  {values['cert.registrationNumber'] && (
                    <div className="si-f5cf7f84">
                      Reg. No.: {values['cert.registrationNumber']}
                    </div>
                  )}
                </div>
              </div>
              <hr className="si-81828004" />
              <div className="si-fac16903">
                📜 VETERINARY CERTIFICATE 📜
              </div>
              <div className="si-8eace9a7">
                Cert No: <strong>{values['cert.autoNumberPrefix'] || 'VC'}-{new Date().getFullYear()}-00001</strong>
              </div>
              {values['cert.footerText'] && (
                <div className="si-4b4e5d0c">
                  {values['cert.footerText']}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CertificateSettings
