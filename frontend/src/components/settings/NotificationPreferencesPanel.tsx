import React from 'react'
import { useTranslation } from 'react-i18next'

interface NotificationPreferencesPanelProps {
  digestEnabled: boolean
  setDigestEnabled: (v: boolean) => void
  prefSaving: boolean
  prefSaved: boolean
  prefLoadError: string
  setPrefLoadError: (v: string) => void
  onSave: () => void
}

const NotificationPreferencesPanel: React.FC<NotificationPreferencesPanelProps> = ({
  digestEnabled, setDigestEnabled, prefSaving, prefSaved, prefLoadError, setPrefLoadError, onSave,
}) => {
  const { t } = useTranslation()
  return (
    <div className="settings-section">
      <h3 className="si-ce279a8c">🔔 {t('notificationPreferences.title')}</h3>
      {prefLoadError && (
        <div className="module-alert error si-bab8e8bc">
          ⚠️ {prefLoadError}
          <button onClick={() => setPrefLoadError('')} className="si-8e913916">{t('common.close')}</button>
        </div>
      )}
      {prefSaved && <div className="module-alert success si-bab8e8bc">✅ {t('notificationPreferences.preferenceSaved')}</div>}
      <div className="si-d8480906">
        <label className="si-c15e7777">
          <input type="checkbox" checked={digestEnabled} className="si-72c5bae2"
            onChange={e => setDigestEnabled(e.target.checked)} />
          <div>
            <div className="si-a9b7f385">{t('notificationPreferences.weeklyDigest')}</div>
            <div className="si-d93f66e1">{t('notificationPreferences.weeklyDigestDesc')}</div>
          </div>
        </label>
      </div>
      <button
        className="module-btn primary si-b0aee75b"
        disabled={prefSaving}
        onClick={onSave}
      >
        {prefSaving ? `⏳ ${t('common.saving')}` : t('common.save')}
      </button>
    </div>
  )
}

export default NotificationPreferencesPanel
