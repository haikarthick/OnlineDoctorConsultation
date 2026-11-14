import React from 'react'
import type { TFunction } from 'i18next'

export interface SecurityAuditPanelProps {
  securityAuditLoading: boolean
  securityAuditError: string
  securityAudit: any[]
  t: TFunction
}

// The AUDIT table above is the patient-record ACCESS trail (who read what). This is
// the CONFIGURATION trail (who changed roles, members and settings) -
// /hospital-networks/:id/security-audit, which had no caller at all despite being the
// only record of privilege changes in a network.
const SecurityAuditPanel: React.FC<SecurityAuditPanelProps> = ({ securityAuditLoading, securityAuditError, securityAudit, t }) => {
  return (
    <div className="module-card si-af65fe13">
      <div className="hn-panel-header">
        <h3>🛡️ {t('hospitalNetworks.securityAudit.title')}</h3>
      </div>
      <div className="card-body">
        <p className="module-form-helper si-676930d7">{t('hospitalNetworks.securityAudit.subtitle')}</p>
        {securityAuditLoading ? (
          <div className="loading-container"><div className="loading-spinner" /></div>
        ) : securityAuditError ? (
          <div className="module-alert error">⚠ {securityAuditError}</div>
        ) : securityAudit.length === 0 ? (
          <p className="empty-state">{t('hospitalNetworks.securityAudit.empty')}</p>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead><tr>
                <th>{t('hospitalNetworks.securityAudit.when')}</th>
                <th>{t('hospitalNetworks.securityAudit.actor')}</th>
                <th>{t('hospitalNetworks.securityAudit.action')}</th>
                <th>{t('hospitalNetworks.securityAudit.target')}</th>
                <th>{t('hospitalNetworks.securityAudit.change')}</th>
                <th>{t('hospitalNetworks.securityAudit.ip')}</th>
              </tr></thead>
              <tbody>
                {securityAudit.map((a: any) => (
                  <tr key={a.id}>
                    <td>{a.createdAt ? new Date(a.createdAt).toLocaleString() : '-'}</td>
                    <td>{a.actorName || '-'}</td>
                    <td><span className="status-badge">{a.action}</span></td>
                    <td>{a.targetType || '-'}</td>
                    <td className="si-af971f42">
                      {a.oldValue || a.newValue
                        ? `${a.oldValue ?? '-'} → ${a.newValue ?? '-'}`
                        : '-'}
                    </td>
                    <td>{a.ipAddress || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default SecurityAuditPanel
