import React from 'react'
import { useTranslation } from 'react-i18next'
import type { User, VetProfileData } from './userManagementShared'

interface VetProfileModalProps {
  showVetModal: User | null
  setShowVetModal: (u: User | null) => void
  vetLoading: boolean
  vetForm: VetProfileData
  onFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  vetSaving: boolean
  vetSaved: boolean
  onSave: () => void
  formatCurrency: (n: number) => string
}

const VetProfileModal: React.FC<VetProfileModalProps> = ({
  showVetModal, setShowVetModal, vetLoading, vetForm, onFormChange, vetSaving, vetSaved, onSave, formatCurrency,
}) => {
  const { t } = useTranslation()
  if (!showVetModal) return null
  return (
    <div className="modal-overlay" onClick={() => setShowVetModal(null)}>
      <div className="modal si-fd563096" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🩺 {t('userManagement.vetProfile')} - {showVetModal.firstName} {showVetModal.lastName}</h2>
          <button className="modal-close" onClick={() => setShowVetModal(null)}>✕</button>
        </div>
        <div className="modal-body">
          {vetLoading ? (
            <div className="loading-container"><div className="loading-spinner" /></div>
          ) : (
            <div className="si-7a28b1a9">
              <div className="si-fbb64b4e">
                <div className="form-group">
                  <label className="form-label">{t('userManagement.licenseNumber')}</label>
                  <input className="form-input" name="licenseNumber" value={vetForm.licenseNumber} onChange={onFormChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('userManagement.yearsExperience')}</label>
                  <input className="form-input" type="number" name="yearsOfExperience" value={vetForm.yearsOfExperience} onChange={onFormChange} min="0" max="80" />
                </div>
              </div>
              <div className="form-group">
                  <label className="form-label">{t('userManagement.bio')}</label>
                <textarea className="form-input si-3f7753b6" name="bio" value={vetForm.bio} onChange={onFormChange} rows={3} />
              </div>
              <div className="form-group">
                  <label className="form-label">{t('userManagement.consultationFee')}</label>
                <input className="form-input" type="number" name="consultationFee" value={vetForm.consultationFee} onChange={onFormChange} min="0" step="0.01" />
                {vetForm.consultationFee && <span className="si-48a0b045">Preview: {formatCurrency(parseFloat(vetForm.consultationFee) || 0)}</span>}
              </div>
              <div className="form-group">
                  <label className="form-label">{t('userManagement.specializations')}</label>
                <input className="form-input" name="specializations" value={vetForm.specializations} onChange={onFormChange} placeholder="Dermatology, Orthopedics" />
              </div>
              <div className="form-group">
                  <label className="form-label">{t('userManagement.qualifications')}</label>
                <input className="form-input" name="qualifications" value={vetForm.qualifications} onChange={onFormChange} placeholder="BVSc, MVSc" />
              </div>
              <div className="form-group">
                  <label className="form-label">{t('userManagement.languages')}</label>
                <input className="form-input" name="languages" value={vetForm.languages} onChange={onFormChange} placeholder="English, Hindi" />
              </div>
              <div className="si-fbb64b4e">
                <div className="form-group">
                  <label className="form-label">{t('userManagement.clinicName')}</label>
                  <input className="form-input" name="clinicName" value={vetForm.clinicName} onChange={onFormChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('userManagement.clinicAddress')}</label>
                  <input className="form-input" name="clinicAddress" value={vetForm.clinicAddress} onChange={onFormChange} />
                </div>
              </div>
              <div className="form-group">
                  <label className="form-label">{t('userManagement.availableDays')}</label>
                <input className="form-input" name="availableDays" value={vetForm.availableDays} onChange={onFormChange} placeholder="Mon-Fri" />
              </div>
              <div className="si-fbb64b4e">
                <div className="form-group">
                  <label className="form-label">{t('userManagement.hoursStart')}</label>
                  <input className="form-input" type="time" name="availableHoursStart" value={vetForm.availableHoursStart} onChange={onFormChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('userManagement.hoursEnd')}</label>
                  <input className="form-input" type="time" name="availableHoursEnd" value={vetForm.availableHoursEnd} onChange={onFormChange} />
                </div>
              </div>
              <div className="si-a65a6462">
                <label className="si-0c7e7279">
                  <input type="checkbox" name="isAvailable" checked={vetForm.isAvailable} onChange={onFormChange} />
                  <span>{t('userManagement.available')}</span>
                </label>
                <label className="si-0c7e7279">
                  <input type="checkbox" name="acceptsEmergency" checked={vetForm.acceptsEmergency} onChange={onFormChange} />
                  <span>{t('userManagement.acceptEmergencies')}</span>
                </label>
              </div>
              <div className="si-8d13495b">
                <button className="btn btn-outline" onClick={() => setShowVetModal(null)}>{t('userManagement.cancel')}</button>
                <button className="btn btn-primary" disabled={vetSaving} onClick={onSave}>
                  {vetSaving ? t('userManagement.saving') : t('userManagement.saveVetProfile')}
                </button>
                {vetSaved && <span className="si-fb870846">✓ {t('userManagement.saved')}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default VetProfileModal
