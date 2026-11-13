import React from 'react'
import { useTranslation } from 'react-i18next'

const PreferencesSection: React.FC = () => {
  const { t } = useTranslation()
  return (
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
  )
}

export default PreferencesSection
