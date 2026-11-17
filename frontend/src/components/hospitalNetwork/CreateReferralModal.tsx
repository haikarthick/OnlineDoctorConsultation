import React from 'react'
import type { TFunction } from 'i18next'

export interface ReferralFormState {
  networkId: string; fromHospitalId: string; toHospitalId: string; toVetId: string
  animalId: string; reason: string; priority: string; clinicalNotes: string
}

export interface CreateReferralModalProps {
  referralForm: ReferralFormState
  setReferralForm: React.Dispatch<React.SetStateAction<ReferralFormState>>
  referralNetworkHospitals: any[]
  referralError: string
  referralSubmitting: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  t: TFunction
}

const PRIORITY_LEVELS = ['low', 'normal', 'high', 'emergency'] as const

const CreateReferralModal: React.FC<CreateReferralModalProps> = ({
  referralForm, setReferralForm, referralNetworkHospitals, referralError,
  referralSubmitting, onClose, onSubmit, t,
}) => {
  return (
    <div className="si-2140be19" onClick={onClose}>
      <div className="si-b212c540" onClick={e => e.stopPropagation()}>
        <div className="si-fe2d5bfb">
          <h3 className="si-44087c4b">{t('networkReferrals.createTitle')}</h3>
          <button type="button" onClick={onClose} className="si-30be827b">✕</button>
        </div>
        {referralError && <div className="module-alert error si-bab8e8bc">{referralError}</div>}
        <form onSubmit={onSubmit}>
          <div className="module-form-group">
            <label className="module-label">{t('networkReferrals.toHospital')}</label>
            <select
              className="module-input"
              required
              value={referralForm.toHospitalId}
              onChange={e => setReferralForm(f => ({ ...f, toHospitalId: e.target.value }))}
            >
              <option value="">{t('networkReferrals.selectHospital')}</option>
              {referralNetworkHospitals.map((h: any) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
          <div className="module-form-group">
            <label className="module-label">
              {t('networkReferrals.reason')} <span className="si-f84f41a5">*</span>
            </label>
            <textarea
              className="module-input"
              required
              rows={3}
              placeholder={t('networkReferrals.reasonPlaceholder')}
              value={referralForm.reason}
              onChange={e => setReferralForm(f => ({ ...f, reason: e.target.value }))}
            />
          </div>
          <div className="module-form-row">
            <div className="module-form-group">
              <label className="module-label">{t('networkReferrals.priority')}</label>
              <select
                className="module-input"
                value={referralForm.priority}
                onChange={e => setReferralForm(f => ({ ...f, priority: e.target.value }))}
              >
                {PRIORITY_LEVELS.map(p => (
                  <option key={p} value={p}>{t(`networkReferrals.priority_levels.${p}`, p)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('networkReferrals.clinicalNotes')}</label>
            <textarea
              className="module-input"
              rows={4}
              placeholder={t('networkReferrals.clinicalNotesPlaceholder')}
              value={referralForm.clinicalNotes}
              onChange={e => setReferralForm(f => ({ ...f, clinicalNotes: e.target.value }))}
            />
          </div>
          <p className="si-b5cd343d">* {t('common.requiredField', 'Required field')}</p>
          <div className="si-961e4c67">
            <button type="button" className="module-btn" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="module-btn primary" disabled={referralSubmitting}>
              {referralSubmitting ? `⏳ ${t('networkReferrals.sending')}` : `🔄 ${t('networkReferrals.send')}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateReferralModal
