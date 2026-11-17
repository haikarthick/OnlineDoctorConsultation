import React from 'react'
import type { TFunction } from 'i18next'
import { AuditEntry, AuditStats } from './hospitalNetworksShared'
import AuditAccessLogTable from './AuditAccessLogTable'
import SecurityAuditPanel from './SecurityAuditPanel'

export interface AuditTabProps {
  hasSelectedNetwork: boolean
  onGoToNetworks: () => void
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
  securityAuditLoading: boolean
  securityAuditError: string
  securityAudit: any[]
  t: TFunction
}

const AuditTab: React.FC<AuditTabProps> = (props) => {
  const { hasSelectedNetwork, onGoToNetworks, t } = props

  if (!hasSelectedNetwork) {
    return (
      <div className="hn-tab-content">
        <div className="hn-empty-state">
          <div className="hn-empty-icon">🔐</div>
          <div className="hn-empty-title">{t('hospitalNetworks.audit.selectNetwork')}</div>
          <button className="module-btn primary" onClick={onGoToNetworks}>
            {t('hospitalNetworks.audit.goToNetworks')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="hn-tab-content">
      <div className="hn-audit-header">
        <h2 className="hn-audit-section-title">{t('hospitalNetworks.audit.title')}</h2>
        <p className="hn-subtitle">{t('hospitalNetworks.audit.subtitle')}</p>
      </div>

      <AuditAccessLogTable
        auditStats={props.auditStats}
        auditRecordTypeFilter={props.auditRecordTypeFilter}
        setAuditRecordTypeFilter={props.setAuditRecordTypeFilter}
        auditGrantedFilter={props.auditGrantedFilter}
        setAuditGrantedFilter={props.setAuditGrantedFilter}
        auditSearch={props.auditSearch}
        setAuditSearch={props.setAuditSearch}
        onExportCsv={props.onExportCsv}
        onOpenComplianceModal={props.onOpenComplianceModal}
        auditLoading={props.auditLoading}
        filteredAuditLogs={props.filteredAuditLogs}
        formatDate={props.formatDate}
        auditTotal={props.auditTotal}
        auditPage={props.auditPage}
        setAuditPage={props.setAuditPage}
        t={t}
      />

      <SecurityAuditPanel
        securityAuditLoading={props.securityAuditLoading}
        securityAuditError={props.securityAuditError}
        securityAudit={props.securityAudit}
        t={t}
      />
    </div>
  )
}

export default AuditTab
