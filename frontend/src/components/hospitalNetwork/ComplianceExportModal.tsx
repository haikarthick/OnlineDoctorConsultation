import React from 'react'

export interface ComplianceExportModalProps {
  complianceFrom: string
  setComplianceFrom: (v: string) => void
  complianceTo: string
  setComplianceTo: (v: string) => void
  complianceGenerating: boolean
  complianceError: string
  onClose: () => void
  onExport: () => void
  t: (key: string) => string
}

const ComplianceExportModal: React.FC<ComplianceExportModalProps> = ({
  complianceFrom, setComplianceFrom, complianceTo, setComplianceTo,
  complianceGenerating, complianceError, onClose, onExport, t,
}) => {
  return (
    <div className="hn-modal-overlay" onClick={onClose}>
      <div className="hn-modal si-197ba518" onClick={e => e.stopPropagation()}>
        <div className="hn-modal-header">
          <h2>📋 {t('complianceExport.exportDateRange')}</h2>
          <button type="button" className="hn-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="hn-modal-body">
          {complianceError && <div className="module-alert error">{complianceError}</div>}
          <div className="module-form-row">
            <div className="module-form-group">
              <label className="module-label">{t('complianceExport.exportFrom')} <span className="hn-required">*</span></label>
              <input type="date" className="module-input" value={complianceFrom} onChange={e => setComplianceFrom(e.target.value)} />
            </div>
            <div className="module-form-group">
              <label className="module-label">{t('complianceExport.exportTo')} <span className="hn-required">*</span></label>
              <input type="date" className="module-input" value={complianceTo} onChange={e => setComplianceTo(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="hn-modal-actions">
          <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
          <button
            type="button"
            className="module-btn primary"
            disabled={!complianceFrom || !complianceTo || complianceGenerating}
            onClick={onExport}
          >
            {complianceGenerating ? `⏳ ${t('complianceExport.generating')}` : `⬇️ ${t('complianceExport.downloadReport')}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ComplianceExportModal
