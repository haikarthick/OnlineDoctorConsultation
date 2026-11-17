import React from 'react'
import type { TFunction } from 'i18next'
import { AUDIT_RECORD_TYPE_LABELS, AuditEntry, AuditStats } from './hospitalNetworksShared'

const KNOWN_AUDIT_ROLES = new Set(['veterinarian', 'admin', 'farmer', 'pet_owner'])

export interface AuditAccessLogTableProps {
  auditStats: AuditStats
  auditRecordTypeFilter: string
  setAuditRecordTypeFilter: (v: string) => void
  auditGrantedFilter: 'all' | 'granted' | 'denied'
  setAuditGrantedFilter: (v: 'all' | 'granted' | 'denied') => void
  auditSearch: string
  setAuditSearch: (v: string) => void
  onExportCsv: () => void
  onOpenComplianceModal: () => void
  auditLoading: boolean
  filteredAuditLogs: AuditEntry[]
  formatDate: (d: string) => string
  auditTotal: number
  auditPage: number
  setAuditPage: (updater: (p: number) => number) => void
  t: TFunction
}

const AuditAccessLogTable: React.FC<AuditAccessLogTableProps> = ({
  auditStats, auditRecordTypeFilter, setAuditRecordTypeFilter, auditGrantedFilter, setAuditGrantedFilter,
  auditSearch, setAuditSearch, onExportCsv, onOpenComplianceModal, auditLoading, filteredAuditLogs,
  formatDate, auditTotal, auditPage, setAuditPage, t,
}) => {
  return (
    <>
      {/* Stats */}
      <div className="hn-audit-stats">
        <div className="hn-stat-card hn-stat-blue">
          <div className="hn-stat-value">{auditStats.total}</div>
          <div className="hn-stat-label">{t('hospitalNetworks.audit.stats.total')}</div>
        </div>
        <div className="hn-stat-card hn-stat-green">
          <div className="hn-stat-value">{auditStats.granted}</div>
          <div className="hn-stat-label">{t('hospitalNetworks.audit.stats.granted')}</div>
        </div>
        <div className="hn-stat-card hn-stat-orange">
          <div className="hn-stat-value">{auditStats.denied}</div>
          <div className="hn-stat-label">{t('hospitalNetworks.audit.stats.denied')}</div>
        </div>
        <div className="hn-stat-card hn-stat-teal">
          <div className="hn-stat-value">{auditStats.last7days}</div>
          <div className="hn-stat-label">{t('hospitalNetworks.audit.stats.last7days')}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="hn-audit-filter-bar">
        <select
          className="module-input hn-audit-filter-select"
          value={auditRecordTypeFilter}
          onChange={e => setAuditRecordTypeFilter(e.target.value)}
        >
          <option value="">{t('hospitalNetworks.audit.filters.allTypes')}</option>
          <option value="animal_profile">Animal Profile</option>
          <option value="consultations">Consultations</option>
          <option value="prescriptions">Prescriptions</option>
          <option value="vaccinations">Vaccinations</option>
        </select>
        <div className="hn-filter-toggle">
          {(['all', 'granted', 'denied'] as const).map(v => (
            <button
              key={v}
              className={`module-btn${auditGrantedFilter === v ? ' primary' : ''} small`}
              onClick={() => setAuditGrantedFilter(v)}
            >
              {t(`hospitalNetworks.audit.filters.${v === 'all' ? 'allResults' : v}`)}
            </button>
          ))}
        </div>
        <input
          className="module-input hn-search-input"
          placeholder={t('hospitalNetworks.audit.filters.search')}
          value={auditSearch}
          onChange={e => setAuditSearch(e.target.value)}
        />
        <button className="module-btn" onClick={onExportCsv}>
          {t('hospitalNetworks.audit.exportCsv')}
        </button>
        <button className="module-btn primary" onClick={onOpenComplianceModal}>
          📋 {t('complianceExport.exportReport')}
        </button>
      </div>

      {/* Table */}
      {auditLoading ? (
        <div className="hn-loading">⏳ Loading audit logs…</div>
      ) : filteredAuditLogs.length === 0 ? (
        <div className="hn-empty-state">
          <div className="hn-empty-icon">🔐</div>
          <div className="hn-empty-title">{t('hospitalNetworks.audit.noLogs')}</div>
          <div className="hn-empty-desc">{t('hospitalNetworks.audit.noLogsDesc')}</div>
        </div>
      ) : (
        <div className="module-card">
          <div className="hn-audit-table-wrapper data-table-container">
            <table className="module-table">
              <thead>
                <tr>
                  <th>{t('hospitalNetworks.audit.table.accessor')}</th>
                  <th>{t('hospitalNetworks.audit.table.role')}</th>
                  <th>{t('hospitalNetworks.audit.table.animal')}</th>
                  <th>{t('hospitalNetworks.audit.table.recordType')}</th>
                  <th>{t('hospitalNetworks.audit.table.accessType')}</th>
                  <th>{t('hospitalNetworks.audit.table.result')}</th>
                  <th>{t('hospitalNetworks.audit.table.dateTime')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.map(entry => {
                  const roleClass = KNOWN_AUDIT_ROLES.has(entry.accessorRole) ? entry.accessorRole : 'default'
                  return (
                    <tr key={entry.id}>
                      <td>
                        <div className="hn-accessor-cell">
                          <div className="hn-avatar-circle">
                            {(entry.accessorName ?? '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="hn-accessor-name">{entry.accessorName}</div>
                            <div className="hn-accessor-email">{entry.accessorEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`hn-role-badge hn-audit-role-${roleClass}`}>
                          {entry.accessorRole}
                        </span>
                      </td>
                      <td>
                        <div className="hn-animal-name">{entry.animalName || '-'}</div>
                        {entry.animalUniqueId && (
                          <div className="hn-animal-uid">{entry.animalUniqueId}</div>
                        )}
                      </td>
                      <td>
                        <span className="hn-record-type-badge">
                          {AUDIT_RECORD_TYPE_LABELS[entry.recordType] ?? entry.recordType}
                        </span>
                      </td>
                      <td>
                        <code className="hn-access-type">{entry.accessType}</code>
                      </td>
                      <td>
                        {entry.accessGranted ? (
                          <span className="hn-result-badge-granted">
                            ✓ {t('hospitalNetworks.audit.filters.granted')}
                          </span>
                        ) : (
                          <span
                            className="hn-result-badge-denied hn-denied-tooltip"
                            title={entry.denialReason || ''}
                          >
                            ✗ {t('hospitalNetworks.audit.filters.denied')}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="hn-audit-date">{formatDate(entry.accessedAt)}</div>
                        <div className="hn-audit-time">
                          {new Date(entry.accessedAt).toLocaleTimeString()}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {auditTotal > 50 && (
            <div className="hn-audit-pagination">
              <button
                className="module-btn small"
                onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                disabled={auditPage === 1}
              >
                ← Previous
              </button>
              <span className="hn-page-info">
                {t('hospitalNetworks.audit.pageOf', {
                  page: auditPage,
                  total: Math.ceil(auditTotal / 50),
                })}
              </span>
              <button
                className="module-btn small"
                onClick={() => setAuditPage(p => p + 1)}
                disabled={auditPage >= Math.ceil(auditTotal / 50)}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default AuditAccessLogTable
