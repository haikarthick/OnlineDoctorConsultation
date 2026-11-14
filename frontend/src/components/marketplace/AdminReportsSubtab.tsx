import React from 'react'
import type { TFunction } from 'i18next'

export const AdminReportsSubtab: React.FC<{
  adminReportFilter: string; onFilterChange: (v: string) => void;
  adminReports: any[]; onViewListing: (listingId: string, title: string) => void;
  adminReportResolution: Record<string, string>; onResolutionChange: (id: string, v: string) => void;
  onResolve: (id: string, status: string) => void; t: TFunction;
}> = ({ adminReportFilter, onFilterChange, adminReports, onViewListing, adminReportResolution, onResolutionChange, onResolve, t }) => (
  <div className="mp-section">
    <div className="mp-admin-header">
      <h3 className="mp-section-title">🚩 {t('marketplace.report.adminTitle')}</h3>
      <select className="module-input" value={adminReportFilter} onChange={e => onFilterChange(e.target.value)}>
        <option value="open">{t('marketplace.report.filterOpen')}</option>
        <option value="reviewing">{t('marketplace.report.status.reviewing')}</option>
        <option value="actioned">{t('marketplace.report.status.actioned')}</option>
        <option value="dismissed">{t('marketplace.report.status.dismissed')}</option>
        <option value="">{t('marketplace.admin.allListings')}</option>
      </select>
    </div>
    {adminReports.length === 0 ? (
      <p className="mp-empty">{t('marketplace.report.noReports')}</p>
    ) : (
      <div className="mp-reports-list">
        {adminReports.map(r => (
          <div key={r.id} className="mp-report-card">
            <div className="mp-report-head">
              <span className="mp-title-link" onClick={() => onViewListing(r.listing_id, r.listing_title)}>{r.listing_title || '-'}</span>
              <span className={`module-badge ${r.status === 'open' ? 'error' : r.status === 'actioned' ? 'success' : ''}`}>{t(`marketplace.report.status.${r.status}`)}</span>
            </div>
            <div className="mp-report-meta">
              <span className="mp-report-reason">{t(`marketplace.report.reasons.${r.reason}`)}</span>
              <span>· {t('marketplace.report.by')} {r.reporter_name}</span>
              <span>· {new Date(r.created_at).toLocaleDateString()}</span>
            </div>
            {r.details && <div className="mp-report-details">{r.details}</div>}
            {['open', 'reviewing'].includes(r.status) && (
              <div className="mp-report-actions">
                <input className="module-input" placeholder={t('marketplace.report.resolutionPlaceholder')}
                  value={adminReportResolution[r.id] || ''} onChange={e => onResolutionChange(r.id, e.target.value)} />
                {r.status === 'open' && <button className="module-btn small" onClick={() => onResolve(r.id, 'reviewing')}>{t('marketplace.report.markReviewing')}</button>}
                <button className="module-btn small primary" onClick={() => onResolve(r.id, 'actioned')}>{t('marketplace.report.action')}</button>
                <button className="module-btn small" onClick={() => onResolve(r.id, 'dismissed')}>{t('marketplace.report.dismiss')}</button>
              </div>
            )}
            {r.resolution && <div className="mp-report-resolution">💬 {r.resolution}</div>}
          </div>
        ))}
      </div>
    )}
  </div>
)
