import React from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  show: boolean
  maintenanceEnabled: boolean
  setMaintenanceEnabled: (v: boolean) => void
  maintenanceMessage: string
  setMaintenanceMessage: (v: string) => void
  savingMaintenance: boolean
  maintenanceSaved: boolean
  onSave: () => void
}

const MaintenanceCard: React.FC<Props> = ({
  show, maintenanceEnabled, setMaintenanceEnabled, maintenanceMessage, setMaintenanceMessage,
  savingMaintenance, maintenanceSaved, onSave,
}) => {
  const { t } = useTranslation()
  if (!show) return null
  return (
    <div id="settings-section-maintenance" className="card si-478be2e9">
      <div className="card-header si-9803f8d1">
        <h2 className="si-63c2680d">🚧 {t('systemSettings.maintenanceMode')}</h2>
        {maintenanceEnabled && (
          <span className="si-a324d557">
            🔴 ACTIVE
          </span>
        )}
      </div>
      <div className="card-body">
        <div className="si-ccc9b2e4">
          <div className="si-0c982175">
            <h3 className="si-3301c332">{t('systemSettings.maintenanceEnabled')}</h3>
            <p className="si-faa1c026">
              {t('systemSettings.maintenanceActive')}
            </p>
          </div>
          <div className="si-d223efb3">
            <button
              className={`btn btn-sm ${maintenanceEnabled ? 'btn-primary ss-maintenance-on' : 'btn-outline'}`}
              onClick={() => setMaintenanceEnabled(true)}>🔴 Enabled</button>
            <button
              className={`btn btn-sm ${!maintenanceEnabled ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setMaintenanceEnabled(false)}>✅ Disabled</button>
          </div>
        </div>
        <div className="si-50d6616f">
          <label className="module-label">{t('systemSettings.maintenanceMessage')}</label>
          <textarea
            className="module-input ss-field ss-mt-8"
            rows={3}
            value={maintenanceMessage}
            onChange={e => setMaintenanceMessage(e.target.value)}
            placeholder="Message shown to users during maintenance..."
          />
        </div>
        {maintenanceEnabled && (
          <div className="si-5fe8f7aa">
            ⚠️ <strong>Maintenance mode is ON.</strong> Non-admin users will see a maintenance page. {t('systemSettings.maintenanceBypass')}
          </div>
        )}
        <div className="si-7332b1a9">
          {maintenanceSaved && <span className="si-392ff007">✅ Saved!</span>}
          <button className="btn btn-primary" disabled={savingMaintenance} onClick={onSave}>
            {savingMaintenance ? t('systemSettings.saving') : '🚧 Save Maintenance Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default MaintenanceCard
