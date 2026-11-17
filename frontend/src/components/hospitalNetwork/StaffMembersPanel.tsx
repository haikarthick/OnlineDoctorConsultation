import React from 'react'
import type { TFunction } from 'i18next'
import { NetworkMember, RoleBadge } from './hospitalNetworksShared'

export interface StaffMembersPanelProps {
  networkMembers: NetworkMember[]
  pendingInvites: any[]
  userNetworkRole?: string
  userRole?: string
  onInviteStaff: () => void
  onAddMember: () => void
  onEditMember: (member: NetworkMember) => void
  onRemoveMember: (member: NetworkMember) => void
  onCopyInviteLink: (invite: any) => void
  onRevokeInvite: (invite: any) => void
  t: TFunction
}

const StaffMembersPanel: React.FC<StaffMembersPanelProps> = ({
  networkMembers, pendingInvites, userNetworkRole, userRole,
  onInviteStaff, onAddMember, onEditMember, onRemoveMember, onCopyInviteLink, onRevokeInvite, t,
}) => {
  return (
    <div className="module-card">
      <div className="hn-panel-header">
        <h3>{t('hospitalNetworks.detail.staff')}</h3>
        {(userNetworkRole === 'corporate_admin' || userNetworkRole === 'hospital_director' || userRole === 'admin') && (
          <div className="si-fe667bdf">
            <button className="module-btn small" onClick={onInviteStaff}>
              ✉️ {t('hospitalNetworks.detail.inviteStaff')}
            </button>
            <button className="module-btn small primary" onClick={onAddMember}>
              + {t('hospitalNetworks.detail.addMember')}
            </button>
          </div>
        )}
      </div>
      <div className="card-body">
        {networkMembers.length === 0 ? (
          <div className="hn-panel-empty">👥 {t('hospitalNetworks.detail.noMembers')}</div>
        ) : (
          <div className="hn-member-list">
            {networkMembers.map(m => (
              <div key={m.id} className="hn-member-item">
                <div className="hn-member-avatar">{(m.userName ?? 'U').charAt(0).toUpperCase()}</div>
                <div className="hn-member-info">
                  <div className="hn-member-name">{m.userName ?? m.userEmail ?? 'Unknown'}</div>
                  {m.hospitalName && <div className="hn-member-hospital">{m.hospitalName}</div>}
                </div>
                <RoleBadge role={m.networkRole} />
                <button
                  className="hn-edit-btn"
                  title="Edit member"
                  onClick={() => onEditMember(m)}
                >✏️</button>
                <button
                  className="hn-remove-btn"
                  title="Remove member"
                  onClick={() => onRemoveMember(m)}
                >✕</button>
              </div>
            ))}
          </div>
        )}
        {/* Pending Invites Section */}
        {pendingInvites.length > 0 && (
          <div>
            <div className="hn-pending-invites-header">
              ⏳ {t('hospitalNetworks.detail.pendingInvitations', { count: pendingInvites.length })}
            </div>
            {pendingInvites.map((inv: any) => (
              <div key={inv.id} className="hn-pending-invite-item">
                <div className="hn-pending-invite-row1">
                  <span className="hn-pending-invite-email">{inv.inviteeEmail ?? inv.invitee_email}</span>
                  <span className="hn-pending-badge">PENDING</span>
                </div>
                <div className="hn-pending-invite-row2">
                  <span className="hn-pending-invite-position">{inv.staffPosition ?? inv.staff_position}</span>
                  <span className="hn-pending-invite-expiry">
                    {t('hospitalNetworks.detail.expires')} {new Date(inv.expiresAt ?? inv.expires_at).toLocaleDateString()}
                  </span>
                  <div className="hn-pending-invite-actions">
                    <button
                      className="hn-pending-invite-action copy"
                      title={t('hospitalNetworks.detail.copyInviteLink')}
                      onClick={() => onCopyInviteLink(inv)}
                    >📋 {t('common.copyLink')}</button>
                    <button
                      className="hn-pending-invite-action revoke"
                      title={t('hospitalNetworks.detail.revokeInvite')}
                      onClick={() => onRevokeInvite(inv)}
                    >✕ {t('common.revoke')}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default StaffMembersPanel
