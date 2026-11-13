import React from 'react'

// ─── Invite-member modal (email + role) ───
export const InviteMemberModal: React.FC<{
  inviteEmail: string
  inviteRole: string
  inviteError: string
  inviteLoading: boolean
  onEmailChange: (v: string) => void
  onRoleChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}> = ({ inviteEmail, inviteRole, inviteError, inviteLoading, onEmailChange, onRoleChange, onSubmit, onClose }) => {
  return (
    <>
      <div className="edit-form-overlay" onClick={onClose} />
      <div className="edit-form-panel si-4b1b6758">
        <div className="si-c66b816b">
          <h2 className="si-44087c4b">Invite Member</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={onSubmit}>
          {inviteError && <div className="alert alert-error si-1cb81cae">{inviteError}</div>}
          <div className="form-group">
            <label>Email Address <span className="si-4fb20e94">*</span></label>
            <input
              type="email" required
              value={inviteEmail}
              onChange={e => onEmailChange(e.target.value)}
              placeholder="user@example.com"
              className="module-input"
            />
          </div>
          <div className="form-group">
            <label>Role <span className="si-4fb20e94">*</span></label>
            <select value={inviteRole} onChange={e => onRoleChange(e.target.value)} className="module-input">
              <option value="manager">Manager</option>
              <option value="supervisor">Supervisor</option>
              <option value="farm_vet">Farm Vet</option>
              <option value="worker">Worker</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          {!inviteEmail && <p className="si-6ea836c5">⚠️ Enter a registered user&apos;s email to proceed</p>}
          <p className="si-5047a40e">* Required field</p>
          <div className="si-7a8f2044">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!inviteEmail || inviteLoading}>
              {inviteLoading ? '⏳ Inviting...' : '+ Invite Member'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
