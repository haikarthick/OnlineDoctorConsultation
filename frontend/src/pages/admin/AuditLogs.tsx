import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import { AuditLog } from '../../types'
import '../../styles/modules.css'

interface AuditLogsProps {
  onNavigate: (path: string) => void
}

const AuditLogs: React.FC<AuditLogsProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { formatDateTime } = useSettings()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    loadLogs()
  }, [actionFilter])

  const loadLogs = async () => {
    try {
      setLoading(true)
      const result = await apiService.adminGetAuditLogs({ action: actionFilter || undefined })
      setLogs(result.data?.items || (Array.isArray(result.data) ? result.data : []))
    } catch (err) {
} finally {
      setLoading(false)
    }
  }

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('add')) return '#059669'
    if (action.includes('delete') || action.includes('remove')) return '#dc2626'
    if (action.includes('update') || action.includes('change') || action.includes('modify')) return '#f59e0b'
    if (action.includes('login') || action.includes('auth')) return '#3b82f6'
    return '#6b7280'
  }

  const getActionIcon = (action: string) => {
    if (action.includes('create') || action.includes('add')) return '➕'
    if (action.includes('delete') || action.includes('remove')) return '🗑️'
    if (action.includes('update') || action.includes('change')) return '✏️'
    if (action.includes('login')) return '🔐'
    if (action.includes('refund')) return '↩️'
    if (action.includes('moderate')) return '⚖️'
    return '📋'
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>{t('auditLogs.title')}</h1>
          <p className="page-subtitle">{t('auditLogs.subtitle')} • {logs.length} {t('auditLogs.entries')}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={loadLogs}>🔄 {t('auditLogs.refresh')}</button>
          <button className="btn btn-outline" onClick={() => onNavigate('/admin/dashboard')}>← {t('auditLogs.dashboard')}</button>
        </div>
      </div>

      {/* Filters */}
      <div className="search-filter-bar" style={{ marginBottom: 24 }}>
        <select className="form-input" value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ width: 200 }}>
          <option value="">{t('auditLogs.allActions')}</option>
          <option value="user.status_change">{t('auditLogs.userStatusChange')}</option>
          <option value="user.role_change">{t('auditLogs.userRoleChange')}</option>
          <option value="review.moderate">{t('auditLogs.reviewModeration')}</option>
          <option value="payment.refund">{t('auditLogs.paymentRefund')}</option>
          <option value="setting.update">{t('auditLogs.settingUpdate')}</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 48 }}>📋</div>
          <h3>{t('auditLogs.noLogsFound')}</h3>
          <p>{t('auditLogs.noLogsDescription')}</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {logs.map((log, i) => (
              <div
                key={log.id}
                style={{
                  padding: '14px 20px',
                  borderBottom: i < logs.length - 1 ? '1px solid #f3f4f6' : 'none',
                  cursor: 'pointer',
                  background: expandedId === log.id ? '#f9fafb' : 'transparent'
                }}
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Icon */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: `${getActionColor(log.action)}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0
                  }}>
                    {getActionIcon(log.action)}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <code style={{
                        fontSize: 12, padding: '2px 8px', borderRadius: 4,
                        background: `${getActionColor(log.action)}15`,
                        color: getActionColor(log.action),
                        fontWeight: 600
                      }}>
                        {log.action}
                      </code>
                      {log.resourceType && (
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                          {t('auditLogs.on')} {log.resourceType}
                        </span>
                      )}
                    </div>
                    {log.details && (
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#4b5563' }}>
                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                      </p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                      {formatDateTime(log.timestamp)}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
                      User: {log.userId?.slice(0, 8) || 'system'}
                    </p>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === log.id && (
                  <div style={{ marginTop: 12, padding: 12, background: '#f3f4f6', borderRadius: 8, fontSize: 13 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div><strong>{t('auditLogs.logId')}:</strong> {log.id}</div>
                      <div><strong>{t('auditLogs.userId')}:</strong> {log.userId || '—'}</div>
                      <div><strong>{t('auditLogs.resourceId')}:</strong> {log.resourceId || '—'}</div>
                      <div><strong>{t('auditLogs.resourceType')}:</strong> {log.resourceType || '—'}</div>
                      {log.ipAddress && <div><strong>{t('auditLogs.ip')}:</strong> {log.ipAddress}</div>}
                    </div>
                    {log.details && (
                      <div style={{ marginTop: 8 }}>
                        <strong>{t('auditLogs.details')}:</strong>
                        <pre style={{ margin: '4px 0 0', padding: 8, background: '#fff', borderRadius: 4, fontSize: 12, overflow: 'auto' }}>
                          {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default AuditLogs
