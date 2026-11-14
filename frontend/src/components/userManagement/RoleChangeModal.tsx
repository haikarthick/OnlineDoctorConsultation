import React from 'react'
import { useTranslation } from 'react-i18next'
import type { User } from './userManagementShared'

interface RoleChangeModalProps {
  showRoleModal: User | null
  setShowRoleModal: (u: User | null) => void
  newRole: string
  setNewRole: (v: string) => void
  roleVetLicense: string
  setRoleVetLicense: (v: string) => void
  roleVetFee: string
  setRoleVetFee: (v: string) => void
  processing: string | null
  onConfirm: () => void
}

const RoleChangeModal: React.FC<RoleChangeModalProps> = ({
  showRoleModal, setShowRoleModal, newRole, setNewRole,
  roleVetLicense, setRoleVetLicense, roleVetFee, setRoleVetFee, processing, onConfirm,
}) => {
  const { t } = useTranslation()
  if (!showRoleModal) return null
  return (
    <div className="modal-overlay" onClick={() => setShowRoleModal(null)}>
      <div className="modal si-0a161398" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('userManagement.changeRole')}</h2>
          <button className="modal-close" onClick={() => setShowRoleModal(null)}>✕</button>
        </div>
        <div className="modal-body">
          <p>{t('userManagement.changeRoleFor')} <strong>{showRoleModal.firstName} {showRoleModal.lastName}</strong></p>
          <p className="si-c3b93ebb">{t('userManagement.currentRole')}: {showRoleModal.role}</p>
          <div className="form-group">
            <label className="form-label">{t('userManagement.newRole')}</label>
            <select className="form-input" value={newRole} onChange={e => setNewRole(e.target.value)}>
              <option value="">{t('userManagement.selectRole')}</option>
              <option value="pet_owner">{t('userManagement.petOwner')}</option>
              <option value="veterinarian">{t('userManagement.veterinarian')}</option>
              <option value="farmer">Farmer</option>
              <option value="corporate_admin">Hospital Network Admin</option>
              <option value="admin">{t('userManagement.admin')}</option>
            </select>
          </div>
          {newRole === 'veterinarian' && (
            <div className="module-alert si-e120eda2">
              <p className="si-c3b93ebb">{t('userManagement.vetRoleHint')}</p>
              <div className="form-group">
                <label className="form-label">{t('settings.roleChange.vetLicense')}</label>
                <input className="form-input" type="text" value={roleVetLicense}
                  onChange={e => setRoleVetLicense(e.target.value)}
                  placeholder={t('settings.roleChange.vetLicensePlaceholder')} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('settings.roleChange.vetFee')}</label>
                <input className="form-input" type="number" min={0} value={roleVetFee}
                  onChange={e => setRoleVetFee(e.target.value)} placeholder="500" />
              </div>
            </div>
          )}
          <div className="si-f5f9f5f6">
            <button className="btn btn-outline" onClick={() => setShowRoleModal(null)}>{t('userManagement.cancel')}</button>
            <button className="btn btn-primary" disabled={!newRole || processing === showRoleModal.id} onClick={onConfirm}>
              {processing === showRoleModal.id ? t('userManagement.saving') : t('userManagement.changeRole')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RoleChangeModal
