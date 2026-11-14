import React from 'react'
import { useTranslation } from 'react-i18next'
import type { User } from './userManagementShared'
import { getRoleBadge } from './userManagementShared'

interface UsersSearchAndTableProps {
  search: string
  setSearch: (v: string) => void
  roleFilter: string
  setRoleFilter: (v: string) => void
  loading: boolean
  users: User[]
  processing: string | null
  formatDate: (d: string) => string
  onOpenRoleModal: (u: User) => void
  onOpenVetProfile: (u: User) => void
  onOpenSecondaryRoles: (u: User) => void
  onOpenResetPassword: (u: User) => void
  onApproveRegistration: (id: string) => void
  onOpenRejectRegistration: (u: User) => void
  onUnfreeze: (u: User) => void
  onReactivate: (u: User) => void
  onOpenFreeze: (u: User) => void
  onOpenSuspend: (u: User) => void
}

const UsersSearchAndTable: React.FC<UsersSearchAndTableProps> = ({
  search, setSearch, roleFilter, setRoleFilter, loading, users, processing, formatDate,
  onOpenRoleModal, onOpenVetProfile, onOpenSecondaryRoles, onOpenResetPassword,
  onApproveRegistration, onOpenRejectRegistration, onUnfreeze, onReactivate, onOpenFreeze, onOpenSuspend,
}) => {
  const { t } = useTranslation()
  return (
    <>
      <div className="search-filter-bar si-af65fe13">
        <input
          className="form-input si-6acd75e8"
          placeholder={t('userManagement.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="form-input si-549dd079" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">{t('userManagement.allRoles')}</option>
          <option value="pet_owner">{t('userManagement.petOwners')}</option>
          <option value="veterinarian">{t('userManagement.veterinarians')}</option>
          <option value="farmer">Farmers</option>
          <option value="corporate_admin">Hospital Network</option>
          <option value="admin">{t('userManagement.admins')}</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : users.length === 0 ? (
        <div className="empty-state">
          <div className="si-353e617d">👥</div>
          <h3>{t('userManagement.noUsers')}</h3>
          <p>{t('userManagement.adjustSearch')}</p>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('userManagement.user')}</th>
                <th>{t('userManagement.email')}</th>
                <th>{t('userManagement.role')}</th>
                <th>{t('userManagement.status')}</th>
                <th>{t('userManagement.joined')}</th>
                <th>{t('userManagement.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="si-98d3a741">
                      <div className="si-92c7add1">
                        {u.firstName?.charAt(0)}{u.lastName?.charAt(0)}
                      </div>
                      <span>{u.firstName} {u.lastName}</span>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>{getRoleBadge(u.role)}</td>
                  <td>
                    {(() => {
                      const s = u.accountStatus || (u.isActive ? 'active' : 'suspended')
                      const map: Record<string, string> = { active: 'active', pending_approval: 'pending', frozen: 'warning', suspended: 'danger' }
                      const label: Record<string, string> = { active: 'Active', pending_approval: 'Pending', frozen: 'Frozen', suspended: 'Suspended' }
                      return <span className={`badge badge-${map[s] || 'inactive'}`}>{label[s] || s}</span>
                    })()}
                    {u.freezeReason && <div className="si-ba379b86" title={u.freezeReason}>⚠ {u.freezeReason.substring(0, 40)}</div>}
                  </td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>
                    <div className="si-50c82988">
                      {/* Role button */}
                      <button className="btn btn-sm btn-outline" onClick={() => onOpenRoleModal(u)}>
                        {t('userManagement.role')}
                      </button>
                      {/* Vet profile button */}
                      {u.role === 'veterinarian' && (
                        <button className="btn btn-sm btn-primary" onClick={() => onOpenVetProfile(u)}>🩺 Profile</button>
                      )}
                      {/* Secondary roles */}
                      <button className="btn btn-sm btn-outline" onClick={() => onOpenSecondaryRoles(u)}>🔑 {t('userManagement.roles')}</button>
                      {/* Reset password */}
                      <button className="btn btn-sm btn-outline" onClick={() => onOpenResetPassword(u)}>
                        🔒 {t('userManagement.resetPasswordBtn')}
                      </button>
                      {/* Account status actions - context-sensitive */}
                      {u.accountStatus === 'pending_approval' ? (
                        <>
                          <button className="btn btn-sm btn-success" disabled={processing === u.id} onClick={() => onApproveRegistration(u.id)}>
                            {processing === u.id ? '...' : '✓ Approve'}
                          </button>
                          <button className="btn btn-sm btn-outline" disabled={processing === u.id} onClick={() => onOpenRejectRegistration(u)}>
                            ✕ Reject
                          </button>
                        </>
                      ) : (u.accountStatus === 'frozen') ? (
                        <button className="btn btn-sm btn-success" disabled={processing === u.id} onClick={() => onUnfreeze(u)}>
                          {processing === u.id ? '...' : '❄ Unfreeze'}
                        </button>
                      ) : (u.accountStatus === 'suspended') ? (
                        <button className="btn btn-sm btn-success" disabled={processing === u.id} onClick={() => onReactivate(u)}>
                          {processing === u.id ? '...' : '↩ Reactivate'}
                        </button>
                      ) : u.accountStatus === 'active' ? (
                        <>
                          <button className="btn btn-sm btn-warning" disabled={processing === u.id} onClick={() => onOpenFreeze(u)}>❄ Freeze</button>
                          <button className="btn btn-sm btn-danger" disabled={processing === u.id} onClick={() => onOpenSuspend(u)}>⛔ Suspend</button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export default UsersSearchAndTable
