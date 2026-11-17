import React from 'react'

export interface LeaveRequestModalProps {
  onClose: () => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  t: (key: string) => string
}

const LeaveRequestModal: React.FC<LeaveRequestModalProps> = ({ onClose, onSubmit, t }) => {
  return (
    <div className="hn-modal-overlay" onClick={onClose}>
      <div className="hn-modal-content" onClick={e => e.stopPropagation()}>
        <div className="hn-modal-header">
          <h3>🏖️ {t('hospitalNetworks.leave.requestLeave')}</h3>
          <button type="button" className="hn-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="module-form-group">
            <label className="module-label">{t('hospitalNetworks.leave.type')} *</label>
            <select name="leave_type" className="module-input" required>
              <option value="annual">{t('hospitalNetworks.leave.annualLeave')}</option>
              <option value="sick">{t('hospitalNetworks.leave.sickLeave')}</option>
              <option value="personal">{t('hospitalNetworks.leave.personalLeave')}</option>
              <option value="emergency">{t('hospitalNetworks.leave.emergencyLeave')}</option>
            </select>
          </div>
          <div className="module-form-row">
            <div className="module-form-group">
              <label className="module-label">{t('hospitalNetworks.leave.dates')} *</label>
              <input type="date" name="start_date" className="module-input" required />
            </div>
            <div className="module-form-group">
              <label className="module-label">&nbsp;</label>
              <input type="date" name="end_date" className="module-input" required />
            </div>
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('hospitalNetworks.transfers.reason')}</label>
            <textarea name="reason" className="module-input" rows={3} />
          </div>
          <div className="hn-modal-actions">
            <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="module-btn primary">{t('hospitalNetworks.leave.requestLeave')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LeaveRequestModal
