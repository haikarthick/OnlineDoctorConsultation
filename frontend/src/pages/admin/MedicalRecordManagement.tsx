import React, { useState, useEffect, useCallback } from 'react'
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
      setAuditLogs(res.data?.logs || res.data || [])
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
          <h1>📋 Medical Record Management</h1>
          <p className="page-subtitle">Enterprise medical records administration • Compliance & audit</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => {
            if (activeTab === 'records') loadRecords()
            else if (activeTab === 'audit') loadAuditLogs()
            else loadStats()
          }}>🔄 Refresh</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #e5e7eb' }}>
        {tabBtn('records', `📄 All Records (${recordsTotal})`)}
        {tabBtn('audit', '📜 Audit Trail')}
        {tabBtn('stats', '📊 Statistics')}
      </div>

      {/* ═══ RECORDS TAB ═══════════════════════════════════ */}
      {activeTab === 'records' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="text" placeholder="Search by title, pet ID, owner ID..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, flex: 1, minWidth: 220 }} />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}>
              <option value="">All Types</option>
              {RECORD_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
              <p>Loading records...</p>
            </div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
              <p style={{ fontSize: 48 }}>📄</p>
              <p style={{ fontSize: 16, fontWeight: 500 }}>No records found</p>
            </div>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Record #</th>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Pet</th>
                    <th>Owner</th>
                    <th>Veterinarian</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(rec => {
                    const typeInfo = getTypeInfo(rec.recordType)
                    return (
                      <React.Fragment key={rec.id}>
                        <tr onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                          style={{ cursor: 'pointer', background: expandedId === rec.id ? '#f0f4ff' : undefined }}>
                          <td><code style={{ fontSize: 11, color: '#667eea' }}>{rec.recordNumber || '—'}</code></td>
                          <td><span title={typeInfo.label}>{typeInfo.icon} {typeInfo.label}</span></td>
                          <td style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.title}</td>
                          <td>
                            {rec.animalName || '—'}
                            {rec.animalUniqueId && <div style={{ fontSize: 10, color: '#667eea' }}>{rec.animalUniqueId}</div>}
                          </td>
                          <td>
                            {rec.ownerName || '—'}
                            {rec.ownerUniqueId && <div style={{ fontSize: 10, color: '#059669' }}>{rec.ownerUniqueId}</div>}
                          </td>
                          <td>{rec.veterinarianName || '—'}</td>
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
                          <td style={{ fontSize: 12 }}>{fmtDate(rec.createdAt)}</td>
                        </tr>
                        {expandedId === rec.id && (
                          <tr>
                            <td colSpan={9} style={{ padding: 16, background: '#f9fafb' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                                <div>
                                  <strong>Content:</strong>
                                  <div style={{ padding: 8, background: '#fff', borderRadius: 6, marginTop: 4, whiteSpace: 'pre-wrap' }}>
                                    {rec.content || 'No content'}
                                  </div>
                                </div>
                                <div>
                                  {rec.followUpDate && <p><strong>Follow-up:</strong> {fmtDate(rec.followUpDate)}</p>}
                                  {rec.isConfidential && <p><strong>🔒 Confidential Record</strong></p>}
                                  {rec.medications && rec.medications.length > 0 && (
                                    <div style={{ marginTop: 8 }}>
                                      <strong>Medications:</strong>
                                      {rec.medications.map((m: any, i: number) => (
                                        <div key={i} style={{ padding: 4, fontSize: 12 }}>
                                          • <strong>{m.name}</strong> {m.dosage || ''} {m.frequency || ''} {m.duration || ''}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {rec.tags && rec.tags.length > 0 && (
                                    <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                      {rec.tags.map((tag: string, i: number) => (
                                        <span key={i} style={{ padding: '2px 8px', background: '#e5e7eb', borderRadius: 12, fontSize: 10 }}>{tag}</span>
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
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
              <p>Loading audit trail...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
              <p style={{ fontSize: 48 }}>📜</p>
              <p style={{ fontSize: 16, fontWeight: 500 }}>No audit entries found</p>
              <p style={{ fontSize: 13 }}>Medical record changes will be tracked here</p>
            </div>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Action</th>
                    <th>Record Type</th>
                    <th>Record ID</th>
                    <th>Performed By</th>
                    <th>Date/Time</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log: any) => (
                    <React.Fragment key={log.id}>
                      <tr onClick={() => setExpandedId(expandedId === log.id ? null : log.id)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontSize: 16 }}>{getActionIcon(log.action)}</td>
                        <td>
                          <span style={{ fontWeight: 600, color: getActionColor(log.action), fontSize: 12 }}>
                            {log.action}
                          </span>
                        </td>
                        <td>{log.recordType || '—'}</td>
                        <td><code style={{ fontSize: 11 }}>{log.recordId ? log.recordId.substring(0, 8) + '...' : '—'}</code></td>
                        <td>{log.performedByName || log.performedBy || '—'}</td>
                        <td style={{ fontSize: 12 }}>{fmtDateTime(log.createdAt || log.performedAt)}</td>
                        <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.details ? (typeof log.details === 'string' ? log.details : JSON.stringify(log.details).substring(0, 80)) : '—'}
                        </td>
                      </tr>
                      {expandedId === log.id && log.details && (
                        <tr>
                          <td colSpan={7} style={{ padding: 16, background: '#f9fafb' }}>
                            <strong>Full Details:</strong>
                            <pre style={{ fontSize: 11, background: '#fff', padding: 12, borderRadius: 6, marginTop: 4, overflow: 'auto', maxHeight: 200 }}>
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
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
              <p>Loading statistics...</p>
            </div>
          ) : !stats ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
              <p style={{ fontSize: 48 }}>📊</p>
              <p style={{ fontSize: 16, fontWeight: 500 }}>No statistics available</p>
            </div>
          ) : (
            <div>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                <StatsCard icon="📋" label="Total Medical Records" value={stats.totalRecords || 0} color="#667eea" />
                <StatsCard icon="💉" label="Total Vaccinations" value={stats.vaccinations?.total || 0}
                  sub={stats.vaccinations?.upcomingDue ? `${stats.vaccinations.upcomingDue} due within 30 days` : undefined} color="#7c3aed" />
                <StatsCard icon="🔬" label="Lab Results" value={stats.labResults?.total || 0}
                  sub={stats.labResults?.pending ? `${stats.labResults.pending} pending` : undefined} color="#d97706" />
                <StatsCard icon="⚠️" label="Active Allergies" value={stats.allergies?.active || 0} color="#dc2626" />
                <StatsCard icon="📅" label="Follow-ups (7 days)" value={stats.upcomingFollowUps || 0} color="#ea580c" />
              </div>

              {/* Records by Type */}
              {stats.recordsByType && Object.keys(stats.recordsByType).length > 0 && (
                <div style={{ marginBottom: 24, padding: 20, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Records Distribution by Type</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(stats.recordsByType).map(([type, count]: [string, any]) => {
                      const info = getTypeInfo(type)
                      const total = stats.totalRecords || 1
                      const pct = Math.round((count / total) * 100)
                      return (
                        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ width: 120, fontSize: 13 }}>{info.icon} {info.label}</span>
                          <div style={{ flex: 1, height: 20, background: '#f3f4f6', borderRadius: 10, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: '#667eea', borderRadius: 10, minWidth: pct > 0 ? 20 : 0, transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ width: 60, fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{count} ({pct}%)</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Compliance note */}
              <div style={{ padding: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: '#059669', marginBottom: 8 }}>✅ Compliance Status</h4>
                <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>
                  All medical records are tracked with unique identifiers (MR-XXXXXX), audit trail logging, 
                  and role-based access controls. Records are soft-deleted (archived) to maintain data integrity.
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
    <div style={{ fontSize: 28, marginBottom: 4 }}>{icon}</div>
    <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: '#d97706', marginTop: 4 }}>⏱️ {sub}</div>}
  </div>
)

export default MedicalRecordManagement
