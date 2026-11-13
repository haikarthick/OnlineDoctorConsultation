import React from 'react'
import { useTranslation } from 'react-i18next'
import { CERTIFICATE_TYPES } from './settingsShared'

interface CertificateServicesPanelProps {
  selectedCertTypes: string[]
  onToggle: (type: string) => void
  onSave: () => void
  saving: boolean
  saved: boolean
}

const CertificateServicesPanel: React.FC<CertificateServicesPanelProps> = ({
  selectedCertTypes, onToggle, onSave, saving, saved,
}) => {
  const { t } = useTranslation()
  return (
    <div className="settings-section">
      <h2>📜 {t('settings.certificateServices')}</h2>
      <div className="settings-form">
        <p className="si-b555c2ef">
          {t('settings.certificateServicesDesc')}
        </p>
        <div className="si-cb0f6283">
          {CERTIFICATE_TYPES.map(ct => (
            <label key={ct} className="si-db8d8b8b">
              <input
                type="checkbox"
                checked={selectedCertTypes.includes(ct)}
                onChange={() => onToggle(ct)}
              />
              <span>{t(`vetCertificates.certTypes.${ct}` as any)}</span>
            </label>
          ))}
        </div>
        <div className="si-265c889f">
          <button className="btn-primary" onClick={onSave} disabled={saving}>
            {saving ? t('settings.saving') : t('settings.saveCertificateTypes')}
          </button>
          {saved && <span className="si-628b19bf">✓ {t('settings.certificateTypesSaved')}</span>}
        </div>
      </div>
    </div>
  )
}

export default CertificateServicesPanel
