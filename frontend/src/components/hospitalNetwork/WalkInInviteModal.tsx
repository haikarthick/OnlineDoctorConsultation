import React from 'react'
import { WalkInInviteForm } from './hospitalNetworksShared'

export interface WalkInInviteModalProps {
  inviteForm: WalkInInviteForm
  setInviteForm: React.Dispatch<React.SetStateAction<WalkInInviteForm>>
  inviteLoading: boolean
  inviteSuccess: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  t: (key: string) => string
}

const WalkInInviteModal: React.FC<WalkInInviteModalProps> = ({
  inviteForm, setInviteForm, inviteLoading, inviteSuccess, onClose, onSubmit, t,
}) => {
  return (
    <div className="hn-modal-overlay" onClick={onClose}>
      <div className="hn-modal hn-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="hn-modal-header">
          <h2>{t('hospitalNetworks.patients.inviteTitle')}</h2>
          <button type="button" className="hn-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="hn-modal-body">
          {inviteSuccess ? (
            <div className="module-alert success">{t('hospitalNetworks.patients.inviteSuccess')}</div>
          ) : (
            <form onSubmit={onSubmit}>
              <div className="module-form-group">
                <label className="module-label">{t('hospitalNetworks.patients.invitePatientName')} <span className="hn-required">*</span></label>
                <input className="module-input" required value={inviteForm.patientName} onChange={e => setInviteForm(f => ({ ...f, patientName: e.target.value }))} />
              </div>
              <div className="module-form-group">
                <label className="module-label">{t('hospitalNetworks.patients.inviteEmail')} <span className="hn-required">*</span></label>
                <input className="module-input" type="email" required value={inviteForm.patientEmail} onChange={e => setInviteForm(f => ({ ...f, patientEmail: e.target.value }))} />
              </div>
              <div className="module-form-group">
                <label className="module-label">{t('hospitalNetworks.patients.invitePhone')}</label>
                <input className="module-input" value={inviteForm.patientPhone} onChange={e => setInviteForm(f => ({ ...f, patientPhone: e.target.value }))} />
              </div>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">{t('hospitalNetworks.patients.inviteAnimalName')}</label>
                  <input className="module-input" value={inviteForm.animalName} onChange={e => setInviteForm(f => ({ ...f, animalName: e.target.value }))} />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('hospitalNetworks.patients.inviteSpecies')}</label>
                  <select className="module-input" value={inviteForm.animalSpecies} onChange={e => setInviteForm(f => ({ ...f, animalSpecies: e.target.value }))}>
                    <option value="">-</option>
                    <option value="dog">Dog</option>
                    <option value="cat">Cat</option>
                    <option value="cattle">Cattle</option>
                    <option value="horse">Horse</option>
                    <option value="bird">Bird</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="module-form-group">
                <label className="module-label">{t('hospitalNetworks.patients.inviteMessage')}</label>
                <textarea className="module-input si-3f7753b6" rows={3} value={inviteForm.message} onChange={e => setInviteForm(f => ({ ...f, message: e.target.value }))} />
              </div>
              <div className="hn-modal-actions">
                <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
                <button type="submit" className="module-btn primary" disabled={inviteLoading}>
                  {inviteLoading ? t('common.saving') : t('hospitalNetworks.patients.inviteSend')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default WalkInInviteModal
