import React from 'react'
import { EnterpriseMember } from '../../types'

// ─── Selected-enterprise members list, with inline role management ───
export const EnterpriseMembersPanel: React.FC<{
  members: EnterpriseMember[]
  membersLoading: boolean
  canManage: boolean
  updatingMemberId: string | null
  membersLabel: string
  onInviteClick: () => void
  onUpdateRole: (userId: string, newRole: string) => void
  onRemoveMember: (userId: string) => void
}> = ({ members, membersLoading, canManage, updatingMemberId, membersLabel, onInviteClick, onUpdateRole, onRemoveMember }) => {
  return (
    <div className="si-78b34307">
      <div className="si-c66b816b">
        <h3 className="si-1b87764a">👥 {membersLabel}</h3>
        {canManage && (
          <button className="btn btn-sm btn-primary" onClick={onInviteClick}>+ Invite</button>
        )}
      </div>
      {membersLoading ? (
        <p className="si-62bd76f7">Loading...</p>
      ) : members.length === 0 ? (
        <p className="si-62bd76f7">No members yet</p>
      ) : (
        <div className="si-bbd60ea4">
          {members.map(m => (
            <div key={m.userId} className="si-e162b4a6">
              <div className="si-26d7edc3">
                <div className="si-2d596e02">{m.userName || m.userEmail || m.userId.slice(0, 8)}</div>
                <div className="si-93f5e4c5">{m.userEmail}</div>
              </div>
              {m.role !== 'owner' && canManage ? (
                <>
                  <select
                    value={m.role}
                    disabled={updatingMemberId === m.userId}
                    className="si-9c640ad7"
                    onChange={e => onUpdateRole(m.userId, e.target.value)}
                  >
                    <option value="manager">Manager</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="farm_vet">Farm Vet</option>
                    <option value="worker">Worker</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button className="btn btn-sm btn-danger si-a517fcb0" onClick={() => onRemoveMember(m.userId)}>✗</button>
                </>
              ) : (
                <span className="badge si-a517fcb0">{m.role}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
