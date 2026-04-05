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
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="module-btn" onClick={() => onNavigate('/admin/settings')}>
            ← {t('certificateSettings.backToSettings')}
          </button>
          <button
            className="module-btn"
            onClick={() => setPreviewOpen(true)}
            style={{ background: '#2b6cb0', color: '#fff' }}
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
        <div className="module-alert error" style={{ marginBottom: 16 }}>
          {error}
          <button className="module-alert-close" onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* ── Info card ── */}
      <div className="module-card" style={{ marginBottom: 24, padding: '14px 18px', background: '#ebf8ff', border: '1px solid #bee3f8' }}>
        <p style={{ margin: 0, fontSize: 14, color: '#2c5282' }}>
          <strong>ℹ Certificate Number Format:</strong>{' '}
          <code style={{ background: '#dbeafe', padding: '1px 6px', borderRadius: 3 }}>
            {values['cert.autoNumberPrefix'] || 'VC'}-{new Date().getFullYear()}-00001
          </code>
          {' '}— auto-assigned when a vet issues a certificate.
        </p>
      </div>

      {/* ── Settings grid ── */}
      <div style={{ display: 'grid', gap: 16 }}>
        {FIELDS.map(field => {
          const isSaved = savedKeys.has(field.key)
          const isDirty = (values[field.key] ?? '') !== (original[field.key] ?? '')
          const isSavingThis = saving === field.key
          return (
            <div key={field.key} className="module-card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <label className="module-label" style={{ marginBottom: 2 }}>
                    {t(field.label as any)}
                    {isDirty && (
                      <span style={{ marginLeft: 8, color: '#d97706', fontSize: 12, fontWeight: 600 }}>
                        ● {t('certificateSettings.unsaved')}
                      </span>
                    )}
                    {isSaved && (
                      <span style={{ marginLeft: 8, color: '#059669', fontSize: 12, fontWeight: 600 }}>
                        ✓ {t('certificateSettings.saved')}
                      </span>
                    )}
                  </label>
                  <p style={{ margin: 0, fontSize: 12, color: '#718096' }}>{t(field.description as any)}</p>
                </div>
                <button
                  className="module-btn small primary"
                  onClick={() => handleSave(field.key)}
                  disabled={!isDirty || isSavingThis}
                  style={{ minWidth: 72 }}
                >
                  {isSavingThis ? t('common.saving') : t('common.save')}
                </button>
              </div>

              {/* Logo field: upload button + preview */}
              {field.isLogo && (
                <div style={{ marginBottom: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {logoValue && (
                    <img
                      src={logoValue}
                      alt="logo preview"
                      style={{ width: 56, height: 56, objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: 6, background: '#f7fafc' }}
                    />
                  )}
                  <div>
                    <button
                      className="module-btn small"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ marginBottom: 4 }}
                    >
                      📁 {t('certificateSettings.uploadLogo')}
                    </button>
                    <p style={{ margin: 0, fontSize: 11, color: '#a0aec0' }}>{t('certificateSettings.logoSizeHint')}</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleLogoFileSelect}
                  />
                </div>
              )}

              {field.type === 'textarea' ? (
                <textarea
                  className="module-input"
                  value={values[field.key] || ''}
                  onChange={e => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={field.rows || 3}
                  style={{ resize: 'vertical', minHeight: 60 }}
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
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
            zIndex: 9990, display: 'flex', alignItems: 'flex-start',
            justifyContent: 'center', padding: 20, overflowY: 'auto',
          }}
          onClick={() => setPreviewOpen(false)}
        >
          <div
            style={{
              background: '#fff', width: 600, borderRadius: 8,
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)', padding: '24px 28px',
              margin: 'auto', position: 'relative',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewOpen(false)}
              style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#4a5568' }}
            >✕</button>
            <h2 style={{ margin: '0 0 16px', color: '#2d3748', fontSize: 16 }}>
              {t('certificateSettings.preview')} — Certificate Letterhead
            </h2>

            <div style={{ border: '2px solid #2d3748', borderRadius: 6, padding: '14px 16px', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {logoValue ? (
                  <img src={logoValue} alt="logo" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 4 }} />
                ) : (
                  <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #2d3748, #4a5568)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff', flexShrink: 0 }}>🏥</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#2d3748' }}>
                    {values['cert.clinicName'] || 'VetCare Platform'}
                  </div>
                  <div style={{ fontSize: 10, color: '#4a5568', display: 'flex', flexWrap: 'wrap', gap: '2px 10px', marginTop: 4 }}>
                    {values['cert.clinicPhone'] && <span>📞 {values['cert.clinicPhone']}</span>}
                    {values['cert.clinicEmail'] && <span>✉ {values['cert.clinicEmail']}</span>}
                    {values['cert.clinicWebsite'] && <span>🌐 {values['cert.clinicWebsite']}</span>}
                  </div>
                  {values['cert.clinicAddress'] && (
                    <div style={{ fontSize: 9, color: '#718096', marginTop: 2 }}>📍 {values['cert.clinicAddress']}</div>
                  )}
                  {values['cert.registrationNumber'] && (
                    <div style={{ fontSize: 8, color: '#a0aec0', marginTop: 2 }}>
                      Reg. No.: {values['cert.registrationNumber']}
                    </div>
                  )}
                </div>
              </div>
              <hr style={{ border: 'none', borderTop: '2px solid #2d3748', margin: '10px 0 4px' }} />
              <div style={{ background: '#2d3748', color: '#fff', textAlign: 'center', padding: '4px 0', fontSize: 10, fontWeight: 700, letterSpacing: 2, borderRadius: 2 }}>
                📜 VETERINARY CERTIFICATE 📜
              </div>
              <div style={{ textAlign: 'center', fontSize: 9, color: '#4a5568', marginTop: 4, fontFamily: 'Courier New, monospace' }}>
                Cert No: <strong>{values['cert.autoNumberPrefix'] || 'VC'}-{new Date().getFullYear()}-00001</strong>
              </div>
              {values['cert.footerText'] && (
                <div style={{ marginTop: 14, borderTop: '1px solid #e2e8f0', paddingTop: 8, fontSize: 8, color: '#718096', fontStyle: 'italic' }}>
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
