import React from 'react'
import { useTranslation } from 'react-i18next'

interface PrivacyDataSectionProps {
  dataSummary: any
  dataLoading: boolean
  onLoadSummary: () => void
  formatDateTime: (date: string) => string
}

const PrivacyDataSection: React.FC<PrivacyDataSectionProps> = ({ dataSummary, dataLoading, onLoadSummary, formatDateTime }) => {
  const { t } = useTranslation()
  return (
    <div className="settings-section">
      <h2>{t('settings.privacy.title')}</h2>
      <p className="si-9a3b1c05">
        {t('settings.privacy.description')}
      </p>

      {!dataSummary ? (
        <button className="btn btn-outline" onClick={onLoadSummary} disabled={dataLoading}>
          {dataLoading ? t('settings.privacy.loading') : t('settings.privacy.viewDataSummary')}
        </button>
      ) : (
        <div>
          <div className="si-a148c368">
            {[
              { label: t('settings.privacy.medicalRecords'), value: dataSummary.medicalRecords, icon: '📋' },
              { label: t('settings.privacy.consultations'), value: dataSummary.consultations, icon: '🏥' },
              { label: t('settings.privacy.prescriptions'), value: dataSummary.prescriptions, icon: '💊' },
              { label: t('settings.privacy.animals'), value: dataSummary.animals, icon: '🐾' },
              { label: t('settings.privacy.auditTrail'), value: dataSummary.auditEntries, icon: '📜' },
              { label: t('settings.privacy.activeSessions'), value: dataSummary.activeSessions, icon: '🟢' },
            ].map((item, i) => (
              <div key={i} className="si-3d271bf3">
                <div className="si-7ff2b341">{item.icon}</div>
                <div className="si-bc63c0cb">{item.value ?? 0}</div>
                <div className="si-a213bf41">{item.label}</div>
              </div>
            ))}
          </div>
          {dataSummary.lastLogin && (
            <p className="si-48a0b045">{t('settings.privacy.lastLogin')} {formatDateTime(dataSummary.lastLogin)}</p>
          )}
        </div>
      )}

      <div className="si-4c7fdb19">
        <h4 className="si-9449bd55">{t('settings.privacy.dataRightsTitle')}</h4>
        <ul className="si-cfa0ca27">
          <li><strong>{t('settings.privacy.rightToAccess')}</strong> {t('settings.privacy.rightToAccessDesc')}</li>
          <li><strong>{t('settings.privacy.rightToRectification')}</strong> {t('settings.privacy.rightToRectificationDesc')}</li>
          <li><strong>{t('settings.privacy.rightToPortability')}</strong> {t('settings.privacy.rightToPortabilityDesc')}</li>
          <li><strong>{t('settings.privacy.rightToErasure')}</strong> {t('settings.privacy.rightToErasureDesc')}</li>
          <li><strong>{t('settings.privacy.rightToRestrict')}</strong> {t('settings.privacy.rightToRestrictDesc')}</li>
        </ul>
      </div>

      <div className="si-a3fafceb">
        {t('settings.privacy.retentionWarning')}
      </div>
    </div>
  )
}

export default PrivacyDataSection
