import React from 'react'
import type { TFunction } from 'i18next'
import { MEMBER_ROLES, NetworkHospital, NetworkMember } from './hospitalNetworksShared'

export interface EditMemberFormState { networkRole: string; hospitalId: string; department: string }

export interface EditMemberModalProps {
  editingMember: NetworkMember
  editMemberForm: EditMemberFormState
  setEditMemberForm: React.Dispatch<React.SetStateAction<EditMemberFormState>>
  editMemberLoading: boolean
  networkHospitals: NetworkHospital[]
  departments: string[]
  onClose: () => void
  onSave: () => void
  t: TFunction
}

const EditMemberModal: React.FC<EditMemberModalProps> = ({
  editingMember, editMemberForm, setEditMemberForm, editMemberLoading,
  networkHospitals, departments, onClose, onSave, t,
}) => {
  return (
    <div className="hn-modal-overlay" onClick={onClose}>
      <div className="hn-modal si-197ba518" onClick={e => e.stopPropagation()}>
        <div className="hn-modal-header">
          <h2>✏️ {t('hospitalNetworks.detail.editMember', 'Edit Member')}</h2>
          <button type="button" className="hn-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="hn-modal-body">
          <div className="module-form-group">
            <label className="module-label">{t('hospitalNetworks.memberName', 'Member')}</label>
            <input className="module-input" value={editingMember.userName || editingMember.userEmail || 'Unknown'} disabled />
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('hospitalNetworks.detail.memberEmail', 'Email')}</label>
            <input className="module-input" value={editingMember.userEmail || '-'} disabled />
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('hospitalNetworks.detail.networkRole', 'Role')} <span className="si-4fb20e94">*</span></label>
            <select className="module-input" value={editMemberForm.networkRole} onChange={e => setEditMemberForm(p => ({ ...p, networkRole: e.target.value }))}>
              {MEMBER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('hospitalNetworks.detail.hospital', 'Assigned Hospital')}</label>
            <select className="module-input" value={editMemberForm.hospitalId} onChange={e => setEditMemberForm(p => ({ ...p, hospitalId: e.target.value }))}>
              <option value="">{t('common.none', '- None (Corporate Level) -')}</option>
              {networkHospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('hospitalNetworks.department', 'Department')}</label>
            <select className="module-input" value={editMemberForm.department} onChange={e => setEditMemberForm(p => ({ ...p, department: e.target.value }))}>
              <option value="">{t('hospitalNetworks.noDepartment', '- No Department -')}</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="hn-modal-footer">
          <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel', 'Cancel')}</button>
          <button type="button" className="module-btn primary" disabled={editMemberLoading} onClick={onSave}>
            {editMemberLoading ? '⏳ ' + t('common.saving', 'Saving...') : t('common.save', 'Save Changes')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditMemberModal
