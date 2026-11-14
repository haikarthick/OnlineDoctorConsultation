import React from 'react'
import type { TFunction } from 'i18next'
import { NetworkHospital } from './hospitalNetworksShared'

export interface WalkInRegisterFormState {
  patientName: string; patientPhone: string; patientEmail: string
  animalName: string; animalSpecies: string; animalBreed: string
  reasonForVisit: string; hospitalId: string; consentCollected: boolean
}

export interface WalkInRegisterModalProps {
  walkInForm: WalkInRegisterFormState
  setWalkInForm: React.Dispatch<React.SetStateAction<WalkInRegisterFormState>>
  walkInLoading: boolean
  walkInSuccess: string
  networkHospitals: NetworkHospital[]
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  t: TFunction
}

const WalkInRegisterModal: React.FC<WalkInRegisterModalProps> = ({
  walkInForm, setWalkInForm, walkInLoading, walkInSuccess, networkHospitals, onClose, onSubmit, t,
}) => {
  return (
    <div className="hn-modal-overlay" onClick={onClose}>
      <div className="hn-modal hn-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="hn-modal-header">
          <h2>🏥 {t('hospitalNetworks.patients.registerWalkInTitle', 'Register Walk-In Patient')}</h2>
          <button type="button" className="hn-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="hn-modal-body">
          {walkInSuccess ? (
            <div className="module-alert success">✅ {t('hospitalNetworks.patients.walkInSuccess', 'Patient registered!')} ID: {walkInSuccess}</div>
          ) : (
            <form onSubmit={onSubmit}>
              <p className="module-form-helper si-676930d7">
                {t('hospitalNetworks.patients.walkInHelperText', 'Register a walk-in patient for immediate treatment. No invite or account needed. Patient can be given online access later.')}
              </p>
              <div className="module-form-group">
                <label className="module-label">{t('hospitalNetworks.patients.invitePatientName', 'Patient Name')} <span className="hn-required">*</span></label>
                <input className="module-input" required value={walkInForm.patientName} onChange={e => setWalkInForm(f => ({ ...f, patientName: e.target.value }))} />
              </div>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">{t('hospitalNetworks.patients.invitePhone', 'Phone')}</label>
                  <input className="module-input" value={walkInForm.patientPhone} onChange={e => setWalkInForm(f => ({ ...f, patientPhone: e.target.value }))} />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('hospitalNetworks.patients.inviteEmail', 'Email')} ({t('common.optional', 'optional')})</label>
                  <input className="module-input" type="email" value={walkInForm.patientEmail} onChange={e => setWalkInForm(f => ({ ...f, patientEmail: e.target.value }))} />
                </div>
              </div>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">{t('hospitalNetworks.patients.inviteAnimalName', 'Animal Name')} <span className="hn-required">*</span></label>
                  <input className="module-input" required value={walkInForm.animalName} onChange={e => setWalkInForm(f => ({ ...f, animalName: e.target.value }))} />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('hospitalNetworks.patients.inviteSpecies', 'Species')} <span className="hn-required">*</span></label>
                  <select className="module-input" required value={walkInForm.animalSpecies} onChange={e => setWalkInForm(f => ({ ...f, animalSpecies: e.target.value }))}>
                    <option value="">{t('common.select', '- Select -')}</option>
                    <option value="dog">Dog</option><option value="cat">Cat</option>
                    <option value="cattle">Cattle</option><option value="horse">Horse</option>
                    <option value="bird">Bird</option><option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">{t('hospitalNetworks.patients.breed', 'Breed')} ({t('common.optional', 'optional')})</label>
                  <input className="module-input" value={walkInForm.animalBreed} onChange={e => setWalkInForm(f => ({ ...f, animalBreed: e.target.value }))} />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('hospitalNetworks.detail.hospital', 'Hospital')} <span className="hn-required">*</span></label>
                  <select className="module-input" required value={walkInForm.hospitalId} onChange={e => setWalkInForm(f => ({ ...f, hospitalId: e.target.value }))}>
                    <option value="">{t('common.select', '- Select -')}</option>
                    {networkHospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="module-form-group">
                <label className="module-label">{t('hospitalNetworks.patients.reasonForVisit', 'Reason for Visit')}</label>
                <textarea className="module-input si-3f7753b6" rows={2} value={walkInForm.reasonForVisit} onChange={e => setWalkInForm(f => ({ ...f, reasonForVisit: e.target.value }))} />
              </div>
              <div className="module-form-group si-66faea9d">
                <label className="si-901f8e47">
                  <input
                    type="checkbox"
                    checked={walkInForm.consentCollected}
                    onChange={e => setWalkInForm(f => ({ ...f, consentCollected: e.target.checked }))}
                    className="si-f9badade"
                  />
                  <span className="si-0c1df75e">
                    {t('hospitalNetworks.patients.consentCollected', 'Patient consent has been collected in person')}
                    <span className="si-3fb91c19">
                      ({t('hospitalNetworks.patients.consentCollectedHint', 'Check if owner signed consent form or gave verbal consent')})
                    </span>
                  </span>
                </label>
                {!walkInForm.consentCollected && (
                  <p className="si-513c70eb">
                    ⚠️ {t('hospitalNetworks.patients.consentPendingWarning', 'Without consent, the animal will be registered as "Pending Consent" and the owner must accept before full access is granted.')}
                  </p>
                )}
              </div>
              <div className="hn-modal-actions">
                <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel', 'Cancel')}</button>
                <button type="submit" className="module-btn primary" disabled={walkInLoading}>
                  {walkInLoading ? '⏳ ' + t('common.saving', 'Saving...') : t('hospitalNetworks.patients.registerNow', 'Register & Start Treatment')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default WalkInRegisterModal
