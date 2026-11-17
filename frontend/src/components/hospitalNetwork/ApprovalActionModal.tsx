import React from 'react'

export type ApprovalActionKind = 'info_requested' | 'approved' | 'rejected' | 'suspended' | 'reactivated'

export interface ApprovalActionModalProps {
  showApprovalModal: ApprovalActionKind
  approvalNotes: string
  setApprovalNotes: (v: string) => void
  approvalSaving: boolean
  onClose: () => void
  onConfirm: () => void
  t: (key: string) => string
}

const ApprovalActionModal: React.FC<ApprovalActionModalProps> = ({
  showApprovalModal, approvalNotes, setApprovalNotes, approvalSaving, onClose, onConfirm, t,
}) => {
  return (
    <div className="hn-modal-overlay" onClick={onClose}>
      <div className="hn-modal si-197ba518" onClick={e => e.stopPropagation()}>
        <div className="hn-modal-header">
          <h3>
            {showApprovalModal === 'info_requested' && ('❓ ' + t('networkApproval.requestInfo'))}
            {showApprovalModal === 'approved' && ('✅ ' + t('networkApproval.approveNetwork'))}
            {showApprovalModal === 'rejected' && ('❌ ' + t('networkApproval.rejectNetwork'))}
            {showApprovalModal === 'suspended' && '⏸ Suspend Network'}
            {showApprovalModal === 'reactivated' && '🔄 Reactivate Network'}
          </h3>
          <button type="button" className="hn-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="hn-modal-body">
          <div className="module-form-group">
            <label className="module-label">{t('networkApproval.addNotes')}</label>
            <textarea className="module-input" rows={4} value={approvalNotes}
              onChange={e => setApprovalNotes(e.target.value)}
              placeholder="Describe the reason or required changes..." />
          </div>
          <div className="hn-modal-actions">
            <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
            <button type="button" className="module-btn primary" disabled={approvalSaving} onClick={onConfirm}>
              {approvalSaving ? ('⏳ ' + t('common.saving')) : t('common.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ApprovalActionModal
