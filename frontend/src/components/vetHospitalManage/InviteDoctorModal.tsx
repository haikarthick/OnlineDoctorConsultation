import React from 'react'
import type { TFunction } from 'i18next'
import type { HospitalDepartment } from '../../types'
import { HOSPITAL_ROLES } from './vetHospitalManageShared'

interface InviteForm { email: string; firstName: string; lastName: string; phone: string; hospitalRole: string; departmentId: string }

interface Props {
  t: TFunction
  show: boolean
  onClose: () => void
  inviteForm: InviteForm
  setInviteForm: React.Dispatch<React.SetStateAction<InviteForm>>
  departments: HospitalDepartment[]
  modalMsg: { text: string; isError: boolean } | null
  inviteLink: string
  linkCopied: string
  onSubmit: (e: React.FormEvent) => void
  onCopyLink: () => void
  onInviteAnother: () => void
}

const InviteDoctorModal: React.FC<Props> = ({ t, show, onClose, inviteForm, setInviteForm, departments, modalMsg, inviteLink, linkCopied, onSubmit, onCopyLink, onInviteAnother }) => {
  if (!show) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content si-197ba518" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>{t('consultations.pageTitle')}</h2>
        <p className="si-35176fa1">
          Create an invitation for a new doctor to join your hospital. Share the invite link with them to set up their account.
        </p>

        {inviteLink ? (
          <div>
            <div className="modal-alert success">✅ Invitation created! Share this link with the doctor:</div>
            <div className="si-91a145cf">
              <input readOnly value={inviteLink} className="si-7ddfee34" onClick={e => (e.target as HTMLInputElement).select()} />
              <button type="button" className="btn-primary si-c3aee843" onClick={onCopyLink}>
                {linkCopied === 'modal' ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
            <p className="si-6c6d83b6">
              ⚠️ This link expires in 7 days. The doctor will use it to create their account and join the hospital automatically.
            </p>
            <div className="form-actions si-216c99b7">
              <button type="button" className="btn-secondary" onClick={onClose}>{t('common.close')}</button>
              <button type="button" className="btn-primary" onClick={onInviteAnother}>{t('vetHospitalManage.invite.inviteAnother')}</button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="vh-form">
            {modalMsg && <div className={`modal-alert ${modalMsg.isError ? 'error' : 'success'}`}>{modalMsg.text}</div>}
            <div className="form-group">
              <label>{t('vetHospitalManage.invite.emailAddress')}</label>
              <input type="email" required value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder="doctor@example.com" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>{t('vetHospitalManage.invite.firstName')}</label>
                <input value={inviteForm.firstName} onChange={e => setInviteForm(f => ({ ...f, firstName: e.target.value }))} placeholder="(optional)" />
              </div>
              <div className="form-group">
                <label>{t('vetHospitalManage.invite.lastName')}</label>
                <input value={inviteForm.lastName} onChange={e => setInviteForm(f => ({ ...f, lastName: e.target.value }))} placeholder="(optional)" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>{t('vetHospitals.form.phone')}</label>
                <input value={inviteForm.phone} onChange={e => setInviteForm(f => ({ ...f, phone: e.target.value }))} placeholder="(optional)" />
              </div>
              <div className="form-group">
                <label>{t('vetHospitalManage.modal.hospitalRole')}</label>
                <select value={inviteForm.hospitalRole} onChange={e => setInviteForm(f => ({ ...f, hospitalRole: e.target.value }))}>
                  {HOSPITAL_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
                </select>
              </div>
            </div>
            {departments.length > 0 && (
              <div className="form-group">
                <label>{t('vetHospitalManage.invite.department')}</label>
                <select value={inviteForm.departmentId} onChange={e => setInviteForm(f => ({ ...f, departmentId: e.target.value }))}>
                  <option value="">- None -</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
              <button type="submit" className="btn-primary">{t('vetHospitalManage.invite.createInvitation')}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default InviteDoctorModal
