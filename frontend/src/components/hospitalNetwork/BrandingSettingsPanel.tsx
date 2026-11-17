import React from 'react'
import type { TFunction } from 'i18next'

export interface BrandingFormState {
  logoUrl: string; contactEmail: string; contactPhone: string; websiteUrl: string
  operatingHours: Record<string, { open: string; close: string; closed: boolean }>
  specializations: string[]; emergencyServices: boolean
}

const BRANDING_SPECIALIZATIONS = ['Cardiology', 'Oncology', 'Orthopedics', 'Neurology', 'Dermatology', 'Ophthalmology', 'Dentistry', 'Surgery']
const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export interface BrandingSettingsPanelProps {
  userNetworkRole?: string
  userRole?: string
  brandingForm: BrandingFormState
  setBrandingForm: React.Dispatch<React.SetStateAction<BrandingFormState>>
  brandingSaving: boolean
  brandingSaved: boolean
  showBrandingPanel: boolean
  setShowBrandingPanel: React.Dispatch<React.SetStateAction<boolean>>
  onSave: () => void
  t: TFunction
}

const BrandingSettingsPanel: React.FC<BrandingSettingsPanelProps> = ({
  userNetworkRole, userRole, brandingForm, setBrandingForm, brandingSaving, brandingSaved,
  showBrandingPanel, setShowBrandingPanel, onSave, t,
}) => {
  if (!(userNetworkRole === 'corporate_admin' || userRole === 'admin')) return null

  return (
    <div className="module-card">
      <div className="hn-panel-header">
        <h3>⚙️ {t('networkSettings.title')}</h3>
        <button className="module-btn small" onClick={() => setShowBrandingPanel(p => !p)}>
          {showBrandingPanel ? '▲ Collapse' : '▼ Expand'}
        </button>
      </div>
      {showBrandingPanel && (
        <div className="card-body">
          {brandingSaved && <div className="module-alert success">✅ {t('networkSettings.settingsSaved')}</div>}
          <div className="hn-branding-section-title">{t('networkSettings.branding')}</div>
          <div className="module-form-group">
            <label className="module-label">{t('networkSettings.logoUpload')}</label>
            {brandingForm.logoUrl && (
              <div className="si-dab75309">
                <img src={brandingForm.logoUrl} alt="Network Logo" className="si-62661c53" />
              </div>
            )}
            <input type="file" accept="image/*" className="module-input"
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = ev => setBrandingForm(f => ({ ...f, logoUrl: (ev.target?.result as string) ?? '' }))
                reader.readAsDataURL(file)
              }}
            />
          </div>
          <div className="hn-branding-section-title">{t('networkSettings.contactInfo')}</div>
          <div className="module-form-row">
            <div className="module-form-group">
              <label className="module-label">{t('networkSettings.contactEmail')}</label>
              <input className="module-input" type="email" value={brandingForm.contactEmail}
                onChange={e => setBrandingForm(f => ({ ...f, contactEmail: e.target.value }))} />
            </div>
            <div className="module-form-group">
              <label className="module-label">{t('networkSettings.contactPhone')}</label>
              <input className="module-input" value={brandingForm.contactPhone}
                onChange={e => setBrandingForm(f => ({ ...f, contactPhone: e.target.value }))} />
            </div>
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('networkSettings.website')}</label>
            <input className="module-input" placeholder="https://" value={brandingForm.websiteUrl}
              onChange={e => setBrandingForm(f => ({ ...f, websiteUrl: e.target.value }))} />
          </div>
          <div className="hn-branding-section-title">{t('networkSettings.specializations')}</div>
          <div className="hn-spec-chips">
            {BRANDING_SPECIALIZATIONS.map(spec => (
              <button key={spec} type="button"
                className={`hn-spec-chip${brandingForm.specializations.includes(spec) ? ' active' : ''}`}
                onClick={() => setBrandingForm(f => ({
                  ...f,
                  specializations: f.specializations.includes(spec)
                    ? f.specializations.filter(s => s !== spec)
                    : [...f.specializations, spec]
                }))}>
                {spec}
              </button>
            ))}
          </div>
          <div className="module-form-group si-66faea9d">
            <label className="module-label si-98d3a741">
              <input type="checkbox" checked={brandingForm.emergencyServices}
                onChange={e => setBrandingForm(f => ({ ...f, emergencyServices: e.target.checked }))} />
              {t('networkSettings.emergencyServices')}
            </label>
          </div>
          <div className="hn-branding-section-title">{t('networkSettings.operatingHours')}</div>
          <div className="hn-hours-grid">
            {WEEK_DAYS.map(day => {
              const h = brandingForm.operatingHours[day] ?? { open: '09:00', close: '18:00', closed: false }
              return (
                <div key={day} className="hn-hours-row">
                  <span className="hn-hours-day">{day.charAt(0).toUpperCase() + day.slice(1)}</span>
                  <label className="hn-hours-closed-label">
                    <input type="checkbox" checked={!!h.closed}
                      onChange={e => setBrandingForm(f => ({ ...f, operatingHours: { ...f.operatingHours, [day]: { ...h, closed: e.target.checked } } }))} />
                    {t('networkSettings.closed')}
                  </label>
                  {!h.closed && (
                    <>
                      <input type="time" className="hn-hours-input" value={h.open}
                        onChange={e => setBrandingForm(f => ({ ...f, operatingHours: { ...f.operatingHours, [day]: { ...h, open: e.target.value } } }))} />
                      <span>-</span>
                      <input type="time" className="hn-hours-input" value={h.close}
                        onChange={e => setBrandingForm(f => ({ ...f, operatingHours: { ...f.operatingHours, [day]: { ...h, close: e.target.value } } }))} />
                    </>
                  )}
                </div>
              )
            })}
          </div>
          <div className="hn-modal-actions si-b0aee75b">
            <button className="module-btn primary" disabled={brandingSaving} onClick={onSave}>
              {brandingSaving ? `⏳ ${t('common.saving')}` : t('networkSettings.saveSettings')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default BrandingSettingsPanel
