import React from 'react'

export interface ReferralResponseModalProps {
  responseModal: { referral: any; action: 'accepted' | 'rejected' }
  responseNotes: string
  setResponseNotes: (v: string) => void
  respondingSubmitting: boolean
  onClose: () => void
  onConfirm: () => void
  t: (key: string) => string
}

const ReferralResponseModal: React.FC<ReferralResponseModalProps> = ({
  responseModal, responseNotes, setResponseNotes, respondingSubmitting, onClose, onConfirm, t,
}) => {
  return (
    <div className="si-2140be19" onClick={onClose}>
      <div className="si-083e3903" onClick={e => e.stopPropagation()}>
        <h3 className="si-3fd9d5d4">
          {responseModal.action === 'accepted' ? `✓ ${t('networkReferrals.accept')}` : `✗ ${t('networkReferrals.reject')}`}
        </h3>
        <p className="si-384c018a">
          {responseModal.action === 'accepted' ? t('networkReferrals.confirmAccept') : t('networkReferrals.confirmReject')}
        </p>
        <div className="module-form-group">
          <label className="module-label">{t('networkReferrals.responseNotes')}</label>
          <textarea
            className="module-input"
            rows={3}
            placeholder={t('networkReferrals.responseNotesPlaceholder')}
            value={responseNotes}
            onChange={e => setResponseNotes(e.target.value)}
          />
        </div>
        <div className="si-37b52067">
          <button className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className={`module-btn primary${responseModal.action === 'rejected' ? ' hn-btn-reject' : ''}`}
            disabled={respondingSubmitting}
            onClick={onConfirm}
          >
            {respondingSubmitting ? `⏳ ${t('common.saving')}` :
             responseModal.action === 'accepted' ? `✓ ${t('networkReferrals.accept')}` : `✗ ${t('networkReferrals.reject')}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReferralResponseModal
