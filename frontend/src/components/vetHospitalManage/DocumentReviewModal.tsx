import React from 'react'
import type { TFunction } from 'i18next'

interface ReviewForm { docId: string; status: 'approved' | 'rejected'; reason: string }

interface Props {
  t: TFunction
  reviewForm: ReviewForm | null
  setReviewForm: React.Dispatch<React.SetStateAction<ReviewForm | null>>
  modalMsg: { text: string; isError: boolean } | null
  onClose: () => void
  onSubmit: () => void
}

const DocumentReviewModal: React.FC<Props> = ({ t, reviewForm, setReviewForm, modalMsg, onClose, onSubmit }) => {
  if (!reviewForm) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content si-3196bd33" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="si-33c1a83e">
          {reviewForm.status === 'approved' ? '✓ Approve Document' : '✗ Reject Document'}
        </h2>
        <p className="si-afed7db4">
          {reviewForm.status === 'approved'
            ? 'Are you sure you want to approve this document?'
            : 'Please provide a reason for rejection so the hospital owner can correct it.'}
        </p>
        {modalMsg && <div className={`modal-alert ${modalMsg.isError ? 'error' : 'success'}`}>{modalMsg.text}</div>}
        {reviewForm.status === 'rejected' && (
          <div className="form-group">
            <label>Rejection Reason *</label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Document is blurry / expired / incorrect format"
              value={reviewForm.reason}
              onChange={e => setReviewForm(f => f ? { ...f, reason: e.target.value } : null)}
            />
          </div>
        )}
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button
            type="button"
            className={reviewForm.status === 'approved' ? 'btn-primary' : 'btn-danger'}
            onClick={onSubmit}
            disabled={reviewForm.status === 'rejected' && !reviewForm.reason.trim()}
          >
            {reviewForm.status === 'approved' ? 'Approve' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DocumentReviewModal
