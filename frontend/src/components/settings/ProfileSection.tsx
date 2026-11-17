import React from 'react'
import { useTranslation } from 'react-i18next'

interface ProfileSectionProps {
  formData: { firstName: string; lastName: string; email: string; phone: string }
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onSave: () => void
  saving: boolean
  saved: boolean
}

const ProfileSection: React.FC<ProfileSectionProps> = ({ formData, onChange, onSave, saving, saved }) => {
  const { t } = useTranslation()
  return (
    <div className="settings-section">
      <h2>{t('settings.profile.title')}</h2>
      <div className="settings-form">
        <div className="form-group">
          <label>{t('settings.profile.firstName')}</label>
          <input type="text" name="firstName" value={formData.firstName} onChange={onChange} />
        </div>
        <div className="form-group">
          <label>{t('settings.profile.lastName')}</label>
          <input type="text" name="lastName" value={formData.lastName} onChange={onChange} />
        </div>
        <div className="form-group">
          <label>{t('settings.profile.email')}</label>
          <input type="email" name="email" value={formData.email} disabled />
        </div>
        <div className="form-group">
          <label>{t('settings.profile.phone')}</label>
          <input type="tel" name="phone" value={formData.phone} onChange={onChange} />
        </div>
        <button className="btn-primary" onClick={onSave} disabled={saving}>
          {saving ? t('settings.saving') : t('settings.profile.saveChanges')}
        </button>
        {saved && <span className="si-cff10492">{t('settings.saved')}</span>}
      </div>
    </div>
  )
}

export default ProfileSection
