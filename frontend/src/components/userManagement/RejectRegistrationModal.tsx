import React from 'react'
import type { PendingUser } from './userManagementShared'

interface RejectRegistrationModalProps {
  showRejectRegistrationModal: PendingUser | null
  setShowRejectRegistrationModal: (u: PendingUser | null) => void
  rejectRegistrationReason: string
  setRejectRegistrationReason: (v: string) => void
  onRejectConfirm: () => void
  processing: string | null
}

const RejectRegistrationModal: React.FC<RejectRegistrationModalProps> = ({
  showRejectRegistrationModal, setShowRejectRegistrationModal,
  rejectRegistrationReason, setRejectRegistrationReason, onRejectConfirm, processing,
}) => {
  if (!showRejectRegistrationModal) return null
  return (
    <div className="modal-overlay" onClick={() => setShowRejectRegistrationModal(null)}>
      <div className="modal si-3196bd33" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Reject Registration</h2>
          <button className="modal-close" onClick={() => setShowRejectRegistrationModal(null)}>✕</button>
        </div>
        <div className="modal-body">
          <p>Rejecting <strong>{showRejectRegistrationModal.firstName} {showRejectRegistrationModal.lastName}</strong>'s application.</p>
          <p className="si-c3b93ebb">The applicant will be notified by email. This action will suspend their account.</p>
          <div className="form-group si-66faea9d">
            <label className="form-label">Reason for Rejection *</label>
            <textarea
              className="form-input"
              rows={3}
              value={rejectRegistrationReason}
              onChange={e => setRejectRegistrationReason(e.target.value)}
              placeholder="e.g. License could not be verified. Please re-apply with a valid license number."
            />
          </div>
          <div className="si-f5f9f5f6">
            <button className="btn btn-outline" onClick={() => setShowRejectRegistrationModal(null)}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={!rejectRegistrationReason.trim() || processing === showRejectRegistrationModal.id}
              onClick={onRejectConfirm}
            >
              {processing === showRejectRegistrationModal.id ? 'Rejecting...' : 'Reject Registration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RejectRegistrationModal
