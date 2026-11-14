import React from 'react'
import type { User } from './userManagementShared'

interface SuspendAccountModalProps {
  showSuspendModal: User | null
  setShowSuspendModal: (u: User | null) => void
  actionReason: string
  setActionReason: (v: string) => void
  processing: string | null
  onConfirm: () => void
}

const SuspendAccountModal: React.FC<SuspendAccountModalProps> = ({
  showSuspendModal, setShowSuspendModal, actionReason, setActionReason, processing, onConfirm,
}) => {
  if (!showSuspendModal) return null
  return (
    <div className="modal-overlay" onClick={() => setShowSuspendModal(null)}>
      <div className="modal si-3196bd33" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⛔ Suspend Account</h2>
          <button className="modal-close" onClick={() => setShowSuspendModal(null)}>✕</button>
        </div>
        <div className="modal-body">
          <p>Permanently suspend <strong>{showSuspendModal.firstName} {showSuspendModal.lastName}</strong>'s account.</p>
          <p className="si-5b64929a">The account will be disabled. The reason is stored for audit purposes. Use Reactivate to re-enable.</p>
          <div className="form-group si-66faea9d">
            <label className="form-label">Reason for Suspension *</label>
            <textarea className="form-input" rows={3} value={actionReason} onChange={e => setActionReason(e.target.value)} placeholder="e.g. Repeated policy violations" />
          </div>
          <div className="si-f5f9f5f6">
            <button className="btn btn-outline" onClick={() => setShowSuspendModal(null)}>Cancel</button>
            <button className="btn btn-danger" disabled={!actionReason.trim() || processing === showSuspendModal.id} onClick={onConfirm}>
              {processing === showSuspendModal.id ? 'Suspending...' : '⛔ Suspend Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SuspendAccountModal
