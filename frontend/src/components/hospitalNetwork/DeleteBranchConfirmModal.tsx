import React from 'react'
import { NetworkHospital } from './hospitalNetworksShared'

export interface DeleteBranchConfirmModalProps {
  deletingBranch: NetworkHospital
  onClose: () => void
  onConfirm: () => void
  t: (key: string) => string
}

const DeleteBranchConfirmModal: React.FC<DeleteBranchConfirmModalProps> = ({ deletingBranch, onClose, onConfirm, t }) => {
  return (
    <div className="hn-modal-overlay" onClick={onClose}>
      <div className="hn-modal hn-modal-sm si-0a161398" onClick={e => e.stopPropagation()}>
        <div className="hn-modal-header">
          <h3>🗑️ Remove Branch Hospital</h3>
          <button type="button" className="hn-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="hn-modal-body">
          <p>Are you sure you want to remove <strong>{deletingBranch.name}</strong> from this network?</p>
          <p className="si-c3b93ebb">The hospital record will be deactivated and removed from the network. This cannot be undone.</p>
        </div>
        <div className="hn-modal-actions">
          <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
          <button
            type="button"
            className="module-btn primary si-ada871e1"
            onClick={onConfirm}
          >
            🗑️ Remove
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteBranchConfirmModal
