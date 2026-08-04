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
  const [userSearch, setUserSearch] = useState('')
  const [userIdFilter, setUserIdFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    loadLogs()
  }, [actionFilter, userIdFilter])

  const loadLogs = async () => {
    try {
      setLoading(true)
      const result = await apiService.adminGetAuditLogs({
        action: actionFilter || undefined,
        userId: userIdFilter || undefined,
      })
      setLogs(result.data?.items || (Array.isArray(result.data) ? result.data : []))
    } catch (err) {
    } finally {
      setLoading(false)
    }
  }

  const filteredLogs = userSearch.trim()
    ? logs.filter(log =>
        (log.userName || '').toLowerCase().includes(userSearch.toLowerCase()) ||
        (log.userEmail || '').toLowerCase().includes(userSearch.toLowerCase())
      )
    : logs

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
          <p className="page-subtitle">{t('auditLogs.subtitle')} • {filteredLogs.length} {t('auditLogs.entries')}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={loadLogs}>🔄 {t('auditLogs.refresh')}</button>
          <button className="btn btn-outline" onClick={() => onNavigate('/admin/dashboard')}>← {t('auditLogs.dashboard')}</button>
        </div>
      </div>

      {/* Filters */}
      <div className="search-filter-bar si-c2a8d72a">
        <div className="si-5af989ef">
          <input
            type="text"
            className="form-input si-6acd75e8"
            placeholder={t('auditLogs.searchUser')}
            value={userSearch}
            onChange={e => { setUserSearch(e.target.value); setUserIdFilter('') }}
           
          />
          {(userSearch || userIdFilter) && (
            <button className="btn btn-outline btn-sm" onClick={() => { setUserSearch(''); setUserIdFilter('') }}>
              {t('auditLogs.allUsers')}
            </button>
          )}
        </div>
        <select className="form-input si-a94a444e" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
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
      ) : filteredLogs.length === 0 ? (
        <div className="empty-state">
          <div className="si-353e617d">📋</div>
          <h3>{t('auditLogs.noLogsFound')}</h3>
          <p>{t('auditLogs.noLogsDescription')}</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-body si-159de68c">
            {filteredLogs.map((log, i) => (
              <div
                key={log.id}
                style={{
                  padding: '14px 20px',
                  borderBottom: i < filteredLogs.length - 1 ? '1px solid #f3f4f6' : 'none',
                  cursor: 'pointer',
                  background: expandedId === log.id ? '#f9fafb' : 'transparent'
                }}
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
              >
                <div className="si-0b20392f">
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
                  <div className="si-6acd75e8">
                    <div className="si-bab2d193">
                      <code style={{
                        fontSize: 12, padding: '2px 8px', borderRadius: 4,
                        background: `${getActionColor(log.action)}15`,
                        color: getActionColor(log.action),
                        fontWeight: 600
                      }}>
                        {log.action}
                      </code>
                      {log.resourceType && (
                        <span className="si-48a0b045">
                          {t('auditLogs.on')} {log.resourceType}
                        </span>
                      )}
                    </div>
                    {log.details && (
                      <p className="si-65fb0667">
                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                      </p>
                    )}
                  </div>

                  {/* Timestamp + user */}
                  <div className="si-d4499730">
                    <p className="si-baf5210b">
                      {formatDateTime(log.timestamp)}
                    </p>
                    <p
                      className="si-90658aed"
                      onClick={e => {
                        e.stopPropagation()
                        setUserIdFilter(log.userId)
                        setUserSearch(log.userName || log.userEmail || log.userId?.slice(0, 8) || '')
                      }}
                      title={t('auditLogs.filterByUser')}
                    >
                      {log.userName || log.userEmail || `User: ${log.userId?.slice(0, 8) || 'system'}`}
                    </p>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === log.id && (
                  <div className="si-660753ea">
                    <div className="si-1327446f">
                      <div><strong>{t('auditLogs.logId')}:</strong> {log.id}</div>
                      <div><strong>{t('auditLogs.user')}:</strong> {log.userName || log.userEmail || '-'}</div>
                      <div><strong>{t('auditLogs.userId')}:</strong> {log.userId || '-'}</div>
                      <div><strong>{t('auditLogs.resourceId')}:</strong> {log.resourceId || '-'}</div>
                      <div><strong>{t('auditLogs.resourceType')}:</strong> {log.resourceType || '-'}</div>
                      {log.ipAddress && <div><strong>{t('auditLogs.ip')}:</strong> {log.ipAddress}</div>}
                    </div>
                    {log.details && (
                      <div className="si-cbfb1eb8">
                        <strong>{t('auditLogs.details')}:</strong>
                        <pre className="si-35833f4d">
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
