import React from 'react'
import { useTranslation } from 'react-i18next'

interface NewSetting {
  key: string
  value: string
  description: string
}

interface Props {
  show: boolean
  onClose: () => void
  newSetting: NewSetting
  setNewSetting: (s: NewSetting) => void
  saving: boolean
  onAdd: () => void
}

const AddSettingModal: React.FC<Props> = ({ show, onClose, newSetting, setNewSetting, saving, onAdd }) => {
  const { t } = useTranslation()
  if (!show) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal si-197ba518" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="si-63c2680d">{t('systemSettings.addSetting')}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">{t('systemSettings.key')}</label>
            <input className="form-input ss-field" placeholder="e.g. system.maintenance_mode" value={newSetting.key}
              onChange={e => setNewSetting({ ...newSetting, key: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('systemSettings.value')}</label>
            <input className="form-input ss-field" placeholder={t('systemSettings.settingValuePlaceholder')} value={newSetting.value}
              onChange={e => setNewSetting({ ...newSetting, value: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('systemSettings.description')}</label>
            <input className="form-input ss-field" placeholder={t('systemSettings.descriptionPlaceholder')} value={newSetting.description}
              onChange={e => setNewSetting({ ...newSetting, description: e.target.value })} />
          </div>
          <div className="si-f5f9f5f6">
            <button className="btn btn-outline" onClick={onClose}>{t('systemSettings.cancel')}</button>
            <button className="btn btn-primary" disabled={saving} onClick={onAdd}>
              {saving ? t('systemSettings.saving') : t('systemSettings.addSetting')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddSettingModal
