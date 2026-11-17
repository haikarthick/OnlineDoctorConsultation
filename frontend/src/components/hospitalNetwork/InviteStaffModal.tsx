import React from 'react'
import { NetworkHospital } from './hospitalNetworksShared'

export interface InviteStaffFormState { email: string; name: string; position: string; hospitalId: string }

export interface InviteStaffModalProps {
  networkHospitals: NetworkHospital[]
  customNetworkRoles: { role_key: string; display_name: string }[]
  inviteStaffForm: InviteStaffFormState
  setInviteStaffForm: React.Dispatch<React.SetStateAction<InviteStaffFormState>>
  inviteStaffLoading: boolean
  inviteStaffSuccess: string
  inviteStaffError: string
  inviteLink: string
  onClose: () => void
  onSendInvite: () => void
  t: (key: string) => string
}

const InviteStaffModal: React.FC<InviteStaffModalProps> = ({
  networkHospitals, customNetworkRoles, inviteStaffForm, setInviteStaffForm,
  inviteStaffLoading, inviteStaffSuccess, inviteStaffError, inviteLink,
  onClose, onSendInvite, t,
}) => {
  return (
    <div className="hn-modal-overlay" onClick={onClose}>
      <div className="hn-modal" onClick={e => e.stopPropagation()}>
        <div className="hn-modal-header">
          <h2>✉️ {t('hospitalNetworks.detail.inviteStaff')}</h2>
          <button type="button" className="hn-modal-close" onClick={onClose}>✕</button>
        </div>
        {inviteStaffSuccess ? (
          <div className="si-41acd90c">
            <div className="si-d32e5e44">✅</div>
            <p className="si-b2cfcbec">{inviteStaffSuccess}</p>
            <p className="si-c367a229">{t('hospitalStaff.inviteSentHint')}</p>
            {inviteLink && (
              <div className="si-58e4ada6">
                <p className="si-ddbe24a1">📋 Share this invite link if email is not configured:</p>
                <div className="si-bab2d193">
                  <input readOnly value={inviteLink} className="si-444032bb" />
                  <button type="button" className="si-69f59685"
                    onClick={() => { navigator.clipboard.writeText(inviteLink) }}>Copy</button>
                </div>
              </div>
            )}
            <button className="module-btn primary si-70453e1a" onClick={onClose}>
              {t('common.close')}
            </button>
          </div>
        ) : (
          <div className="hn-modal-body">
            {inviteStaffError && <div className="module-alert error si-bab8e8bc">{inviteStaffError}</div>}
            <p className="si-216e02a4">
              {t('hospitalNetworks.detail.inviteStaffDesc')}
            </p>
            <div className="module-form">
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">{t('hospitalStaff.inviteeEmail')} *</label>
                  <input type="email" className="module-input" value={inviteStaffForm.email}
                    onChange={e => setInviteStaffForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('hospitalStaff.inviteeName')}</label>
                  <input type="text" className="module-input" value={inviteStaffForm.name}
                    onChange={e => setInviteStaffForm(f => ({ ...f, name: e.target.value }))} />
                </div>
              </div>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">{t('hospitalStaff.staffPosition')} *</label>
                  <select className="module-input" value={inviteStaffForm.position}
                    onChange={e => setInviteStaffForm(f => ({ ...f, position: e.target.value }))}>
                    <option value="nurse">Nurse</option>
                    <option value="technician">Technician</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="lab_tech">Lab Technician</option>
                    <option value="radiologist">Radiologist</option>
                    <option value="anesthesiologist">Anesthesiologist</option>
                    <option value="pharmacist">Pharmacist</option>
                    <option value="intern">Intern</option>
                    <option value="admin_staff">Admin Staff</option>
                    {customNetworkRoles.length > 0 && (
                      <optgroup label="── Custom Roles ──">
                        {customNetworkRoles.map(r => (
                          <option key={r.role_key} value={r.role_key}>{r.display_name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('hospitalNetworks.detail.hospital')}</label>
                  <select className="module-input" value={inviteStaffForm.hospitalId}
                    onChange={e => setInviteStaffForm(f => ({ ...f, hospitalId: e.target.value }))}>
                    <option value="">{t('common.select')}...</option>
                    {networkHospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
              </div>
              <button className="module-btn primary" disabled={inviteStaffLoading || !inviteStaffForm.email || !inviteStaffForm.position}
                onClick={onSendInvite}>
                {inviteStaffLoading ? t('common.saving') : t('hospitalStaff.sendInvite')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default InviteStaffModal
