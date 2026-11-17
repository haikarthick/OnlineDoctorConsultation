import React from 'react'
import { useTranslation } from 'react-i18next'
import { VetFormState } from './settingsShared'

interface ClinicAvailabilitySectionProps {
  vetForm: VetFormState
  onVetChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onSave: () => void
  saving: boolean
  saved: boolean
}

const ClinicAvailabilitySection: React.FC<ClinicAvailabilitySectionProps> = ({
  vetForm, onVetChange, onSave, saving, saved,
}) => {
  const { t } = useTranslation()
  return (
    <div className="settings-section">
      <h2>{t('settings.clinic.title')}</h2>
      <div className="settings-form">
        <div className="form-group">
          <label>{t('settings.clinic.name')}</label>
          <input type="text" name="clinicName" value={vetForm.clinicName} onChange={onVetChange}
            placeholder={t('settings.clinic.namePlaceholder')} />
        </div>
        <div className="form-group">
          <label>{t('settings.clinic.address')}</label>
          <input type="text" name="clinicAddress" value={vetForm.clinicAddress} onChange={onVetChange}
            placeholder={t('settings.clinic.addressPlaceholder')} />
        </div>
        <div className="form-group">
          <label>{t('settings.clinic.availableDays')}</label>
          <input type="text" name="availableDays" value={vetForm.availableDays} onChange={onVetChange}
            placeholder={t('settings.clinic.availableDaysPlaceholder')} />
        </div>
        <div className="si-f23844fb">
          <div className="form-group">
            <label>{t('settings.clinic.hoursStart')}</label>
            <input type="time" name="availableHoursStart" value={vetForm.availableHoursStart} onChange={onVetChange} />
          </div>
          <div className="form-group">
            <label>{t('settings.clinic.hoursEnd')}</label>
            <input type="time" name="availableHoursEnd" value={vetForm.availableHoursEnd} onChange={onVetChange} />
          </div>
        </div>
        <div className="si-be731a69">
          <label className="si-0c7e7279">
            <input type="checkbox" name="isAvailable" checked={vetForm.isAvailable} onChange={onVetChange} />
            <span>{t('settings.clinic.availableForConsultations')}</span>
          </label>
          <label className="si-0c7e7279">
            <input type="checkbox" name="acceptsEmergency" checked={vetForm.acceptsEmergency} onChange={onVetChange} />
            <span>{t('settings.clinic.acceptEmergency')}</span>
          </label>
        </div>
        <button className="btn-primary" onClick={onSave} disabled={saving}>
          {saving ? t('settings.saving') : t('settings.professional.saveProfile')}
        </button>
        {saved && <span className="si-cff10492">{t('settings.professional.profileSaved')}</span>}
      </div>
    </div>
  )
}

export default ClinicAvailabilitySection
