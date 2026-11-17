import React from 'react'
import type { TFunction } from 'i18next'

export const ReportModal: React.FC<{
  reportModal: { listingId: string; title: string };
  reportReason: string; onReasonChange: (v: string) => void;
  reportDetails: string; onDetailsChange: (v: string) => void;
  onClose: () => void; onSubmit: () => void; t: TFunction;
}> = ({ reportModal, reportReason, onReasonChange, reportDetails, onDetailsChange, onClose, onSubmit, t }) => (
  <div className="mp-modal-overlay" onClick={onClose}>
    <div className="mp-modal" onClick={e => e.stopPropagation()}>
      <h3>🚩 {t('marketplace.report.reportListing')}</h3>
      <p className="mp-sell-step-desc">{t('marketplace.report.reportingWhat', { title: reportModal.title })}</p>
      <div className="module-form-group">
        <label className="module-label">{t('marketplace.report.reason')}</label>
        <select className="module-input" value={reportReason} onChange={e => onReasonChange(e.target.value)}>
          <option value="">{t('marketplace.report.selectReason')}</option>
          {['scam', 'welfare_concern', 'prohibited', 'miscategorized', 'offensive', 'wrong_info', 'other'].map(r => (
            <option key={r} value={r}>{t(`marketplace.report.reasons.${r}`)}</option>
          ))}
        </select>
      </div>
      <div className="module-form-group">
        <label className="module-label">{t('marketplace.report.details')}</label>
        <textarea className="module-input" rows={3} value={reportDetails} onChange={e => onDetailsChange(e.target.value)}
          placeholder={t('marketplace.report.detailsPlaceholder')} maxLength={1000} />
      </div>
      <div className="mp-modal-actions">
        <button className="module-btn" onClick={onClose}>{t('marketplace.monetization.cancel')}</button>
        <button className="module-btn primary" disabled={!reportReason} onClick={onSubmit}>{t('marketplace.report.submit')}</button>
      </div>
    </div>
  </div>
)
