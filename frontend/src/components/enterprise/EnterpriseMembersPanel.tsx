import React from 'react'
import { useTranslation } from 'react-i18next'
import { EnterpriseMember } from '../../types'
import { FarmRole, canChangeRoles, canInvite, canRemoveMember, rolesIMayAssign } from '../../utils/farmRoles'

// ─── Selected-enterprise members list, with inline role management ───
export const EnterpriseMembersPanel: React.FC<{
  members: EnterpriseMember[]
  membersLoading: boolean
  /** The signed-in person's role on this farm (null: none). Decides which buttons are offered. */
  actorRole: FarmRole | null
  updatingMemberId: string | null
  membersLabel: string
  onInviteClick: () => void
  onUpdateRole: (userId: string, newRole: string) => void
  onRemoveMember: (userId: string) => void
  /** Owner only: hand the farm to this manager. */
  onTransfer?: (userId: string) => void
}> = ({ members, membersLoading, actorRole, updatingMemberId, membersLabel, onInviteClick, onUpdateRole, onRemoveMember, onTransfer }) => {
  const { t } = useTranslation()
  const roleLabel = (r: string) => t(`farmTeam.roles.${r}`, { defaultValue: r })
  return (
    <div className="si-78b34307">
      <div className="si-c66b816b">
        <h3 className="si-1b87764a">👥 {membersLabel}</h3>
        {canInvite(actorRole) && (
          <button className="btn btn-sm btn-primary" onClick={onInviteClick}>{t('farmTeam.invite')}</button>
        )}
      </div>
      {membersLoading ? (
        <p className="si-62bd76f7">{t('farmRecords.loading')}</p>
      ) : members.length === 0 ? (
        <p className="si-62bd76f7">{t('farmTeam.noMembers')}</p>
      ) : (
        <div className="si-bbd60ea4">
          {members.map(m => (
            <div key={m.userId} className="si-e162b4a6">
              <div className="si-26d7edc3">
                <div className="si-2d596e02">{m.userName || m.userPhone || m.userEmail || m.userId.slice(0, 8)}</div>
                <div className="si-93f5e4c5">{m.userPhone || m.userEmail}</div>
              </div>
              {m.role !== 'owner' && canChangeRoles(actorRole) ? (
                <select
                  value={m.role}
                  disabled={updatingMemberId === m.userId}
                  className="si-9c640ad7"
                  onChange={e => onUpdateRole(m.userId, e.target.value)}
                >
                  {rolesIMayAssign(actorRole).map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </select>
              ) : (
                <span className="badge si-a517fcb0">{roleLabel(m.role)}</span>
              )}
              {actorRole === 'owner' && m.role === 'manager' && onTransfer && (
                <button className="btn btn-sm btn-secondary si-a517fcb0" onClick={() => onTransfer(m.userId)}>{t('farmTeam.makeOwner')}</button>
              )}
              {canRemoveMember(actorRole, m.role) && (
                <button className="btn btn-sm btn-danger si-a517fcb0" onClick={() => onRemoveMember(m.userId)} aria-label={t('farmTeam.remove')}>✗</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
