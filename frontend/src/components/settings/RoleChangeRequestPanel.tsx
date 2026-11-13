import React from 'react'
import { useTranslation } from 'react-i18next'

interface RoleChangeRequestPanelProps {
  currentUserRole?: string
  approvedRequest: any
  pendingRequest: any
  rcLoading: boolean
  selectedNewRole: string
  setSelectedNewRole: (role: string) => void
  isVetRequest: boolean
  rcVetLicense: string
  setRcVetLicense: (v: string) => void
  rcVetFee: string
  setRcVetFee: (v: string) => void
  rcVetExperience: string
  setRcVetExperience: (v: string) => void
  rcVetClinic: string
  setRcVetClinic: (v: string) => void
  rcVetSpecializations: string
  setRcVetSpecializations: (v: string) => void
  rcReason: string
  setRcReason: (v: string) => void
  vetDetailsMissing: boolean
  rcSubmitting: boolean
  onSubmit: () => void
  onCancel: (id: string) => void
}

const RoleChangeRequestPanel: React.FC<RoleChangeRequestPanelProps> = ({
  currentUserRole, approvedRequest, pendingRequest, rcLoading, selectedNewRole, setSelectedNewRole,
  isVetRequest, rcVetLicense, setRcVetLicense, rcVetFee, setRcVetFee, rcVetExperience, setRcVetExperience,
  rcVetClinic, setRcVetClinic, rcVetSpecializations, setRcVetSpecializations, rcReason, setRcReason,
  vetDetailsMissing, rcSubmitting, onSubmit, onCancel,
}) => {
  const { t } = useTranslation()
  return (
    <>
      {/* Approved - need to re-login */}
      {approvedRequest && (
        <div className="module-alert success">
          <strong>{t('settings.roleChange.approvedTitle')}</strong>
          <p>{t('settings.roleChange.approvedDesc', { requestedRole: approvedRequest.requestedRole?.replace('_', ' ') })}</p>
          <button className="module-btn primary si-cbfb1eb8" onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.href = '/'; }}>
            {t('settings.roleChange.reLoginBtn')}
          </button>
        </div>
      )}

      {/* Pending request */}
      {!approvedRequest && pendingRequest && (
        <div className="module-alert si-e120eda2">
          <strong>{t('settings.roleChange.pendingTitle')}</strong>
          <p>{t('settings.roleChange.pendingDesc', { currentRole: pendingRequest.currentRole?.replace('_', ' '), requestedRole: pendingRequest.requestedRole?.replace('_', ' ') })}</p>
          <p className="si-322b324f">{t('settings.roleChange.submitted')}: {new Date(pendingRequest.createdAt).toLocaleDateString()}</p>
          <button className="module-btn si-cbfb1eb8" onClick={() => onCancel(pendingRequest.id)}>
            {t('settings.roleChange.cancelBtn')}
          </button>
        </div>
      )}

      {/* Request form (no pending) */}
      {!approvedRequest && !pendingRequest && !rcLoading && (
        <div>
          <h3 className="si-ff527946">{t('settings.roleChange.requestTitle')}</h3>
          <p className="si-676930d7">{t('settings.roleChange.requestDesc')}</p>
          <div className="module-form-row">
            <div className="module-form-group">
              <label className="module-label">{t('settings.roleChange.selectRole')}</label>
              <select className="module-input" value={selectedNewRole} onChange={e => setSelectedNewRole(e.target.value)}>
                <option value="">- {t('settings.roleChange.selectRole')} -</option>
                {(['pet_owner', 'farmer', 'veterinarian', 'corporate_admin'] as const)
                  .filter(r => r !== currentUserRole)
                  .map(r => (
                    <option key={r} value={r}>{r.replace('_', ' ')}</option>
                  ))}
              </select>
            </div>
          </div>
          {/* Vet-specific details - shown only when requesting the veterinarian role, so
              the admin can verify the license and provision the vet profile in one step. */}
          {isVetRequest && (
            <div className="module-alert si-e120eda2">
              <strong>{t('settings.roleChange.vetDetailsTitle')}</strong>
              <p className="si-676930d7">{t('settings.roleChange.vetDetailsDesc')}</p>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">{t('settings.roleChange.vetLicense')} *</label>
                  <input className="module-input" type="text" value={rcVetLicense}
                    onChange={e => setRcVetLicense(e.target.value)}
                    placeholder={t('settings.roleChange.vetLicensePlaceholder')} />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('settings.roleChange.vetFee')}</label>
                  <input className="module-input" type="number" min={0} value={rcVetFee}
                    onChange={e => setRcVetFee(e.target.value)} placeholder="500" />
                </div>
              </div>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">{t('settings.roleChange.vetExperience')}</label>
                  <input className="module-input" type="number" min={0} value={rcVetExperience}
                    onChange={e => setRcVetExperience(e.target.value)} placeholder="5" />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('settings.roleChange.vetClinic')}</label>
                  <input className="module-input" type="text" value={rcVetClinic}
                    onChange={e => setRcVetClinic(e.target.value)}
                    placeholder={t('settings.roleChange.vetClinicPlaceholder')} />
                </div>
              </div>
              <div className="module-form-group">
                <label className="module-label">{t('settings.roleChange.vetSpecializations')}</label>
                <input className="module-input" type="text" value={rcVetSpecializations}
                  onChange={e => setRcVetSpecializations(e.target.value)}
                  placeholder={t('settings.roleChange.vetSpecializationsPlaceholder')} />
              </div>
            </div>
          )}
          <div className="module-form-group">
            <label className="module-label">{t('settings.roleChange.reasonLabel')}</label>
            <textarea
              className="module-input si-3f7753b6"
              rows={3}
              value={rcReason}
              onChange={e => setRcReason(e.target.value)}
              placeholder={t('settings.roleChange.reasonPlaceholder')}

            />
          </div>
          <button
            className="module-btn primary"
            disabled={!selectedNewRole || rcReason.length < 10 || rcSubmitting || vetDetailsMissing}
            onClick={onSubmit}
          >
            {rcSubmitting ? t('settings.roleChange.submitting') : t('settings.roleChange.submitBtn')}
          </button>
        </div>
      )}
    </>
  )
}

export default RoleChangeRequestPanel
