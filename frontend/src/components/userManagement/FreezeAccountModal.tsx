import React from 'react'
import type { User } from './userManagementShared'

interface FreezeAccountModalProps {
  showFreezeModal: User | null
  setShowFreezeModal: (u: User | null) => void
  actionReason: string
  setActionReason: (v: string) => void
  processing: string | null
  onConfirm: () => void
}

const FreezeAccountModal: React.FC<FreezeAccountModalProps> = ({
  showFreezeModal, setShowFreezeModal, actionReason, setActionReason, processing, onConfirm,
}) => {
  if (!showFreezeModal) return null
  return (
    <div className="modal-overlay" onClick={() => setShowFreezeModal(null)}>
      <div className="modal si-3196bd33" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>❄ Freeze Account</h2>
          <button className="modal-close" onClick={() => setShowFreezeModal(null)}>✕</button>
        </div>
        <div className="modal-body">
          <p>Temporarily freeze <strong>{showFreezeModal.firstName} {showFreezeModal.lastName}</strong>'s account.</p>
          <p className="si-c3b93ebb">The user will not be able to log in while frozen. They will see a polite notice to contact the platform team.</p>
          <div className="form-group si-66faea9d">
            <label className="form-label">Reason (shown to support team) *</label>
            <textarea className="form-input" rows={3} value={actionReason} onChange={e => setActionReason(e.target.value)} placeholder="e.g. Pending investigation into activity" />
          </div>
          <div className="si-f5f9f5f6">
            <button className="btn btn-outline" onClick={() => setShowFreezeModal(null)}>Cancel</button>
            <button className="btn btn-warning" disabled={!actionReason.trim() || processing === showFreezeModal.id} onClick={onConfirm}>
              {processing === showFreezeModal.id ? 'Freezing...' : '❄ Freeze Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FreezeAccountModal
