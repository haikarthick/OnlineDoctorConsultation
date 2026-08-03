import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import '../../styles/modules.css'

interface MedicalRecordManagementProps {
  onNavigate: (path: string) => void
}

const RECORD_TYPES = [
  { value: 'diagnosis', label: 'Diagnosis', icon: '🩺' },
  { value: 'prescription', label: 'Prescription', icon: '💊' },
  { value: 'lab_report', label: 'Lab Report', icon: '🔬' },
  { value: 'vaccination', label: 'Vaccination', icon: '💉' },
  { value: 'surgery', label: 'Surgery', icon: '🏥' },
  { value: 'imaging', label: 'Imaging', icon: '📷' },
  { value: 'follow_up', label: 'Follow-up', icon: '📅' },
  { value: 'other', label: 'Other', icon: '📋' },
]

const SEVERITY_COLORS: Record<string, string> = {
  low: '#059669', normal: '#667eea', high: '#d97706', critical: '#dc2626'
}

const MedicalRecordManagement: React.FC<MedicalRecordManagementProps> = ({ onNavigate: _onNavigate }) => {
  const { t } = useTranslation()
  const { formatDate, formatDateTime } = useSettings()
  const [activeTab, setActiveTab] = useState<'records' | 'audit' | 'stats'>('records')
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<any[]>([])
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fmtDate = useCallback((d: string) => {
    if (!d) return 'N/A'
    try { return formatDate(d) } catch { return d }
  }, [formatDate])

  const fmtDateTime = useCallback((d: string) => {
    if (!d) return 'N/A'
    try { return formatDateTime(d) } catch { return d }
  }, [formatDateTime])

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true)
      const params: any = { limit: 50, offset: 0, isAdmin: true }
      if (typeFilter) params.recordType = typeFilter
      if (searchQuery) params.search = searchQuery
      const res = await apiService.listMedicalRecords(params)
      setRecords(res.data?.records || [])
      setRecordsTotal(res.data?.total || 0)
    } catch (err) {
} finally { setLoading(false) }
  }, [typeFilter, searchQuery])

  const loadAuditLogs = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiService.getMedicalAuditLog({ limit: 100 })
      setAuditLogs(res.data?.entries || res.data?.logs || [])
    } catch (err) {
} finally { setLoading(false) }
  }, [])

  const loadStats = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiService.getMedicalStats()
      setStats(res.data)
    } catch (err) {
} finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (activeTab === 'records') loadRecords()
    else if (activeTab === 'audit') loadAuditLogs()
    else if (activeTab === 'stats') loadStats()
  }, [activeTab, typeFilter, searchQuery])

  const getTypeInfo = (type: string) => RECORD_TYPES.find(r => r.value === type) || RECORD_TYPES[7]

  const getActionIcon = (action: string) => {
    if (action.includes('create') || action.includes('add')) return '➕'
    if (action.includes('delete') || action.includes('remove')) return '🗑️'
    if (action.includes('update') || action.includes('change')) return '✏️'
    return '📋'
  }

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('add')) return '#059669'
    if (action.includes('delete') || action.includes('remove') || action.includes('archive')) return '#dc2626'
    if (action.includes('update') || action.includes('change')) return '#f59e0b'
    return '#6b7280'
  }

  const tabBtn = (tab: 'records' | 'audit' | 'stats', label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      style={{
        padding: '10px 24px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
        background: activeTab === tab ? '#fff' : 'transparent',
        color: activeTab === tab ? '#667eea' : '#6b7280',
        borderBottom: activeTab === tab ? '2px solid #667eea' : '2px solid transparent',
        marginBottom: -2
      }}>
      {label}
    </button>
  )

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>📋 {t('medicalRecordManagement.title')}</h1>
          <p className="page-subtitle">{t('medicalRecordManagement.subtitle')}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => {
            if (activeTab === 'records') loadRecords()
            else if (activeTab === 'audit') loadAuditLogs()
            else loadStats()
          }}>🔄 {t('medicalRecordManagement.refresh')}</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="si-49b00590">
        {tabBtn('records', `📄 ${t('medicalRecordManagement.allRecords')} (${recordsTotal})`)}
        {tabBtn('audit', '📜 ' + t('medicalRecordManagement.auditTrail'))}
        {tabBtn('stats', '📊 ' + t('medicalRecordManagement.statistics'))}
      </div>

      {/* ═══ RECORDS TAB ═══════════════════════════════════ */}
      {activeTab === 'records' && (
        <div>
          <div className="si-ad0381af">
            <input type="text" placeholder={t('medicalRecordManagement.searchPlaceholder')}
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="si-aa4a1d68" />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              className="si-5448b657">
              <option value="">{t('medicalRecordManagement.allTypes')}</option>
              {RECORD_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="si-86638a30">
              <div className="loading-spinner si-9ad92aa9" />
              <p>{t('medicalRecordManagement.loadingRecords')}</p>
            </div>
          ) : records.length === 0 ? (
            <div className="si-73dafd71">
              <p className="si-353e617d">📄</p>
              <p className="si-37a5ef01">{t('medicalRecordManagement.noRecordsFound')}</p>
            </div>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('medicalRecordManagement.recordNumber')}</th>
                    <th>{t('medicalRecordManagement.type')}</th>
                    <th>{t('medicalRecordManagement.titleHeader')}</th>
                    <th>{t('medicalRecordManagement.pet')}</th>
                    <th>{t('medicalRecordManagement.owner')}</th>
                    <th>{t('medicalRecordManagement.veterinarian')}</th>
                    <th>{t('medicalRecordManagement.severity')}</th>
                    <th>{t('medicalRecordManagement.status')}</th>
                    <th>{t('medicalRecordManagement.created')}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(rec => {
                    const typeInfo = getTypeInfo(rec.recordType)
                    return (
                      <React.Fragment key={rec.id}>
                        <tr onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                          style={{ cursor: 'pointer', background: expandedId === rec.id ? '#f0f4ff' : undefined }}>
                          <td><code className="si-0ca383e1">{rec.recordNumber || '-'}</code></td>
                          <td><span title={typeInfo.label}>{typeInfo.icon} {typeInfo.label}</span></td>
                          <td className="si-11b14278">{rec.title}</td>
                          <td>
                            {rec.animalName || '-'}
                            {rec.animalUniqueId && <div className="si-323dcf2c">{rec.animalUniqueId}</div>}
                          </td>
                          <td>
                            {rec.ownerName || '-'}
                            {rec.ownerUniqueId && <div className="si-95a3275e">{rec.ownerUniqueId}</div>}
                          </td>
                          <td>{rec.veterinarianName || '-'}</td>
                          <td>
                            {rec.severity && (
                              <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                                background: SEVERITY_COLORS[rec.severity] || '#6b7280', color: '#fff' }}>
                                {rec.severity}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={`badge badge-${rec.status === 'active' ? 'completed' : rec.status === 'archived' ? 'cancelled' : 'info'}`}>
                              {rec.status}
                            </span>
                          </td>
                          <td className="si-756a9f21">{fmtDate(rec.createdAt)}</td>
                        </tr>
                        {expandedId === rec.id && (
                          <tr>
                            <td colSpan={9} className="si-969e356e">
                              <div className="si-1908d30e">
                                <div>
                                  <strong>{t('medicalRecordManagement.content')}:</strong>
                                  <div className="si-e003ebb7">
                                    {rec.content || t('medicalRecordManagement.noContent')}
                                  </div>
                                </div>
                                <div>
                                  {rec.followUpDate && <p><strong>{t('medicalRecordManagement.followUp')}:</strong> {fmtDate(rec.followUpDate)}</p>}
                                  {rec.isConfidential && <p><strong>🔒 {t('medicalRecordManagement.confidentialRecord')}</strong></p>}
                                  {rec.medications && rec.medications.length > 0 && (
                                    <div className="si-cbfb1eb8">
                                      <strong>{t('medicalRecordManagement.medications')}:</strong>
                                      {rec.medications.map((m: any, i: number) => (
                                        <div key={i} className="si-189b37b6">
                                          • <strong>{m.name}</strong> {m.dosage || ''} {m.frequency || ''} {m.duration || ''}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {rec.tags && rec.tags.length > 0 && (
                                    <div className="si-d2dd2367">
                                      {rec.tags.map((tag: string, i: number) => (
                                        <span key={i} className="si-bcf9ed17">{tag}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ AUDIT TAB ═════════════════════════════════════ */}
      {activeTab === 'audit' && (
        <div>
          {loading ? (
            <div className="si-86638a30">
              <div className="loading-spinner si-9ad92aa9" />
              <p>{t('medicalRecordManagement.loadingAuditTrail')}</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="si-73dafd71">
              <p className="si-353e617d">📜</p>
              <p className="si-37a5ef01">{t('medicalRecordManagement.noAuditEntries')}</p>
              <p className="si-0a803082">{t('medicalRecordManagement.auditTrackingNote')}</p>
            </div>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>{t('medicalRecordManagement.actionHeader')}</th>
                    <th>{t('medicalRecordManagement.recordType')}</th>
                    <th>{t('medicalRecordManagement.recordId')}</th>
                    <th>{t('medicalRecordManagement.performedBy')}</th>
                    <th>{t('medicalRecordManagement.dateTime')}</th>
                    <th>{t('medicalRecordManagement.details')}</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log: any) => (
                    <React.Fragment key={log.id}>
                      <tr onClick={() => setExpandedId(expandedId === log.id ? null : log.id)} className="si-3c1f81b9">
                        <td className="si-5c854a6d">{getActionIcon(log.action)}</td>
                        <td>
                          <span style={{ fontWeight: 600, color: getActionColor(log.action), fontSize: 12 }}>
                            {log.action}
                          </span>
                        </td>
                        <td>{log.recordType || '-'}</td>
                        <td><code className="si-6af9d82f">{log.recordId ? log.recordId.substring(0, 8) + '...' : '-'}</code></td>
                        <td>{log.performedByName || log.performedBy || '-'}</td>
                        <td className="si-756a9f21">{fmtDateTime(log.createdAt || log.performedAt)}</td>
                        <td className="si-28a2a588">
                          {log.details ? (typeof log.details === 'string' ? log.details : JSON.stringify(log.details).substring(0, 80)) : '-'}
                        </td>
                      </tr>
                      {expandedId === log.id && log.details && (
                        <tr>
                          <td colSpan={7} className="si-969e356e">
                            <strong>{t('medicalRecordManagement.fullDetails')}:</strong>
                            <pre className="si-728b264e">
                              {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ STATS TAB ═════════════════════════════════════ */}
      {activeTab === 'stats' && (
        <div>
          {loading ? (
            <div className="si-86638a30">
              <div className="loading-spinner si-9ad92aa9" />
              <p>{t('medicalRecordManagement.loadingStatistics')}</p>
            </div>
          ) : !stats ? (
            <div className="si-73dafd71">
              <p className="si-353e617d">📊</p>
              <p className="si-37a5ef01">{t('medicalRecordManagement.noStatisticsAvailable')}</p>
            </div>
          ) : (
            <div>
              {/* Summary Cards */}
              <div className="si-3b3f146b">
                <StatsCard icon="📋" label={t('medicalRecordManagement.totalMedicalRecords')} value={stats.totalRecords || 0} color="#667eea" />
                <StatsCard icon="💉" label={t('medicalRecordManagement.totalVaccinations')} value={stats.vaccinations?.total || 0}
                  sub={stats.vaccinations?.upcomingDue ? `${stats.vaccinations.upcomingDue} ${t('medicalRecordManagement.dueWithin30Days')}` : undefined} color="#7c3aed" />
                <StatsCard icon="🔬" label={t('medicalRecordManagement.labResultsLabel')} value={stats.labResults?.total || 0}
                  sub={stats.labResults?.pending ? `${stats.labResults.pending} ${t('medicalRecordManagement.pending')}` : undefined} color="#d97706" />
                <StatsCard icon="⚠️" label={t('medicalRecordManagement.activeAllergies')} value={stats.allergies?.active || 0} color="#dc2626" />
                <StatsCard icon="📅" label={t('medicalRecordManagement.followUps7Days')} value={stats.upcomingFollowUps || 0} color="#ea580c" />
              </div>

              {/* Records by Type */}
              {stats.recordsByType && Object.keys(stats.recordsByType).length > 0 && (
                <div className="si-dd7d0d73">
                  <h3 className="si-6c6c1dcc">{t('medicalRecordManagement.recordsDistribution')}</h3>
                  <div className="si-977f8af1">
                    {Object.entries(stats.recordsByType).map(([type, count]: [string, any]) => {
                      const info = getTypeInfo(type)
                      const total = stats.totalRecords || 1
                      const pct = Math.round((count / total) * 100)
                      return (
                        <div key={type} className="si-0b20392f">
                          <span className="si-a12022e1">{info.icon} {info.label}</span>
                          <div className="si-f0c784e7">
                            <div style={{ width: `${pct}%`, height: '100%', background: '#667eea', borderRadius: 10, minWidth: pct > 0 ? 20 : 0, transition: 'width 0.3s' }} />
                          </div>
                          <span className="si-2ba20356">{count} ({pct}%)</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Compliance note */}
              <div className="si-d85b8bef">
                <h4 className="si-739c4b9c">✅ {t('medicalRecordManagement.complianceStatus')}</h4>
                <p className="si-3351d8ac">
                  {t('medicalRecordManagement.complianceNote')}
                  Pet owners ({stats.allergies?.active || 0} active allergy alerts) and veterinarians can access records
                  based on RBAC permissions.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const StatsCard: React.FC<{ icon: string; label: string; value: number; color: string; sub?: string }> = ({ icon, label, value, color, sub }) => (
  <div style={{ padding: 20, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, borderLeft: `4px solid ${color}` }}>
    <div className="si-3540f604">{icon}</div>
    <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
    <div className="si-73510eb6">{label}</div>
    {sub && <div className="si-4f20e511">⏱️ {sub}</div>}
  </div>
)

export default MedicalRecordManagement
