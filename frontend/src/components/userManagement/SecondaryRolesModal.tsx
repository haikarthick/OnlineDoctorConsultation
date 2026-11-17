import React from 'react'
import { useTranslation } from 'react-i18next'
import type { User } from './userManagementShared'
import { getRoleBadge } from './userManagementShared'

interface SecondaryRolesModalProps {
  showSecondaryRolesModal: User | null
  setShowSecondaryRolesModal: (u: User | null) => void
  rolesActionMsg: string
  rolesActionErr: string
  setRolesActionErr: (v: string) => void
  secondaryRolesLoading: boolean
  secondaryRoles: any[]
  addRoleValue: string
  setAddRoleValue: (v: string) => void
  addRoleNotes: string
  setAddRoleNotes: (v: string) => void
  onAddRole: () => void
  onRemoveRole: (role: string) => void
}

const SecondaryRolesModal: React.FC<SecondaryRolesModalProps> = ({
  showSecondaryRolesModal, setShowSecondaryRolesModal, rolesActionMsg, rolesActionErr, setRolesActionErr,
  secondaryRolesLoading, secondaryRoles, addRoleValue, setAddRoleValue, addRoleNotes, setAddRoleNotes,
  onAddRole, onRemoveRole,
}) => {
  const { t } = useTranslation()
  if (!showSecondaryRolesModal) return null
  return (
    <div className="modal-overlay" onClick={() => setShowSecondaryRolesModal(null)}>
      <div className="modal si-f366f390" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔑 {t('userManagement.roles')} - {showSecondaryRolesModal.firstName} {showSecondaryRolesModal.lastName}</h2>
          <button className="modal-close" onClick={() => setShowSecondaryRolesModal(null)}>✕</button>
        </div>
        <div className="modal-body">
          {rolesActionMsg && <div className="module-alert success si-bab8e8bc">{rolesActionMsg}</div>}
          {rolesActionErr && <div className="module-alert error si-bab8e8bc">{rolesActionErr}<button className="si-c93d89f9" onClick={() => setRolesActionErr('')}>✕</button></div>}

          {secondaryRolesLoading ? (
            <div className="loading-container"><div className="loading-spinner" /></div>
          ) : (
            <>
              <div className="si-7e63ec4f">
                <h3 className="si-23235cf3">{t('userManagement.primaryRole')}</h3>
                {getRoleBadge(showSecondaryRolesModal.role)}
              </div>
              <div className="si-7e63ec4f">
                <h3 className="si-23235cf3">{t('userManagement.secondaryRoles')}</h3>
                {secondaryRoles.filter(r => !r.isPrimary).length === 0 ? (
                  <p className="si-c3b93ebb">No secondary roles assigned.</p>
                ) : (
                  <div className="si-b9eb5ec7">
                    {secondaryRoles.filter(r => !r.isPrimary).map((r: any) => (
                      <div key={r.role} className="si-1f4153fd">
                        {getRoleBadge(r.role)}
                        <button
                          className="si-e5a53ae5"
                          onClick={() => onRemoveRole(r.role)}
                          title={t('userManagement.removeRole')}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="si-04321f8b">
                <h3 className="si-23235cf3">{t('userManagement.addRole')}</h3>
                <div className="form-group">
                  <select className="form-input" value={addRoleValue} onChange={e => setAddRoleValue(e.target.value)}>
                    <option value="">{t('userManagement.selectRole')}</option>
                    {['pet_owner', 'farmer', 'veterinarian', 'admin', 'corporate_admin', 'hospital_staff']
                      .filter(r => r !== showSecondaryRolesModal.role && !secondaryRoles.some(sr => sr.role === r))
                      .map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <input className="form-input" placeholder="Notes (optional)" value={addRoleNotes} onChange={e => setAddRoleNotes(e.target.value)} />
                </div>
                <div className="si-f0412db6">
                  <button className="btn btn-outline" onClick={() => setShowSecondaryRolesModal(null)}>{t('userManagement.cancel')}</button>
                  <button className="btn btn-primary" disabled={!addRoleValue} onClick={onAddRole}>
                    {t('userManagement.addRole')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SecondaryRolesModal
