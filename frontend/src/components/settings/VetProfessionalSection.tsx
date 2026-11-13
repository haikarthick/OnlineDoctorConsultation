import React from 'react'
import { useTranslation } from 'react-i18next'
import { VetFormState } from './settingsShared'

interface VetProfessionalSectionProps {
  vetForm: VetFormState
  onVetChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  profileImageUrl: string
  uploading: boolean
  fileInputRef: React.RefObject<HTMLInputElement>
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  firstNameInitial?: string
  lastNameInitial?: string
}

const VetProfessionalSection: React.FC<VetProfessionalSectionProps> = ({
  vetForm, onVetChange, profileImageUrl, uploading, fileInputRef, onPhotoUpload,
  firstNameInitial, lastNameInitial,
}) => {
  const { t } = useTranslation()
  return (
    <div className="settings-section">
      <h2>{t('settings.professional.title')}</h2>

      <div className="si-d8ebb03c">
        <div className="si-8853e284">
          {profileImageUrl ? (
            <img src={profileImageUrl} alt={t('settings.professional.profileAlt')} className="si-0ece644a" />
          ) : (
            <span className="si-3fd90974">
              {firstNameInitial}{lastNameInitial}
            </span>
          )}
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" className="si-d6a2f871" onChange={onPhotoUpload} />
          <button className="btn-small" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? t('settings.professional.uploading') : t('settings.professional.changePhoto')}
          </button>
          <p className="si-ada3b9d6">{t('settings.professional.maxFileSize')}</p>
        </div>
      </div>

      <div className="settings-form">
        <div className="si-f23844fb">
          <div className="form-group">
            <label>{t('settings.professional.licenseNumber')}</label>
            <input type="text" name="licenseNumber" value={vetForm.licenseNumber} onChange={onVetChange} placeholder={t('settings.professional.licensePlaceholder')} />
          </div>
          <div className="form-group">
            <label>{t('settings.professional.yearsOfExperience')}</label>
            <input type="number" name="yearsOfExperience" value={vetForm.yearsOfExperience} onChange={onVetChange} min="0" max="80" />
          </div>
        </div>

        <div className="form-group">
          <label>{t('settings.professional.bio')}</label>
          <textarea name="bio" value={vetForm.bio} onChange={onVetChange} rows={3}
            placeholder={t('settings.professional.bioPlaceholder')}
            className="si-bc27eda8" />
        </div>

        <div className="form-group">
          <label>{t('settings.professional.specializations')}</label>
          <input type="text" name="specializations" value={vetForm.specializations} onChange={onVetChange}
            placeholder={t('settings.professional.specializationsPlaceholder')} />
        </div>

        <div className="form-group">
          <label>{t('settings.professional.qualifications')}</label>
          <input type="text" name="qualifications" value={vetForm.qualifications} onChange={onVetChange}
            placeholder={t('settings.professional.qualificationsPlaceholder')} />
        </div>

        <div className="form-group">
          <label>{t('settings.professional.languages')}</label>
          <input type="text" name="languages" value={vetForm.languages} onChange={onVetChange}
            placeholder={t('settings.professional.languagesPlaceholder')} />
        </div>
      </div>
    </div>
  )
}

export default VetProfessionalSection
