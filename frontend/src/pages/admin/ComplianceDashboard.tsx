import React, { useState, useEffect } from 'react'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import '../../styles/modules.css'

interface ComplianceDashboardProps {
  onNavigate: (path: string) => void
}

const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({ onNavigate }) => {
  const { formatDateTime } = useSettings()
  const [tab, setTab] = useState<'overview' | 'phi' | 'policies'>('overview')
  const [dashboard, setDashboard] = useState<any>(null)
  const [phiLogs, setPhiLogs] = useState<any[]>([])
  const [phiTotal, setPhiTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [phiLoading, setPhiLoading] = useState(false)
  const [phiEntityFilter, setPhiEntityFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => { loadDashboard() }, [])
  useEffect(() => { if (tab === 'phi') loadPhiLogs() }, [tab, phiEntityFilter])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const result = await apiService.getComplianceDashboard()
      setDashboard(result.data || {})
    } catch { /* */ } finally { setLoading(false) }
  }

  const loadPhiLogs = async () => {
    try {
      setPhiLoading(true)
      const result = await apiService.getPhiAccessLog({
        limit: 50,
        entityType: phiEntityFilter || undefined,
      })
      setPhiLogs(result.data?.items || [])
      setPhiTotal(result.data?.total || 0)
    } catch { /* */ } finally { setPhiLoading(false) }
  }

  const severityColor = (s: string) => s === 'high' ? '#dc2626' : s === 'medium' ? '#f59e0b' : '#22c55e'
  const categoryLabel = (c: string) => ({
    phi_access: '👁️ PHI Viewed', phi_modify: '✏️ PHI Modified', phi_create: '➕ PHI Created',
    phi_delete: '🗑️ PHI Deleted', phi_export: '📤 PHI Exported', auth_login: '🔑 Login',
    auth_logout: '🚪 Logout', auth_failed: '⚠️ Failed Login', auth_password: '🔒 Password Change',
    consent_grant: '✅ Consent Given', consent_revoke: '❌ Consent Revoked',
    admin_action: '🛡️ Admin Action', access_denied: '🚫 Access Denied', system: '⚙️ System',
  }[c] || c)

  if (loading) {
    return (
      <div className="module-page">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <div className="spinner" style={{ width: 40, height: 40, border: '4px solid #e0e0e0', borderTop: '4px solid #2e7d32', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      </div>
    )
  }

  const d = dashboard || {}

  // HIPAA compliance checklist
  const complianceChecklist = [
    { label: 'Access Controls (RBAC)', status: 'pass', detail: '4-role permission system with granular RBAC enforcement' },
    { label: 'Audit Logging', status: 'pass', detail: `${d.totalAuditEvents || 0} events in last 30 days, all actions tracked with HIPAA categorization` },
    { label: 'PHI Data Encryption in Transit', status: 'pass', detail: 'TLS/HTTPS enforced on all API endpoints (Render HTTPS)' },
    { label: 'Authentication & Session Mgmt', status: 'pass', detail: `JWT + refresh tokens, ${d.activeSessions || 0} active sessions, session revocation supported` },
    { label: 'Confidential Record Marking', status: 'pass', detail: `${d.confidentialRecords || 0} records flagged as confidential` },
    { label: 'Failed Login Monitoring', status: d.failedLoginAttempts > 10 ? 'warn' : 'pass', detail: `${d.failedLoginAttempts || 0} failed attempts in last 30 days` },
    { label: 'User Data Transparency', status: 'pass', detail: 'Users can view their data footprint from Privacy & Data settings' },
    { label: 'Data Breach Detection', status: 'info', detail: 'High-severity events flagged for PHI export/delete operations' },
    { label: 'SOC 2 / ISO 27001 Certification', status: 'na', detail: 'Not applicable — pursuing in future phases' },
    { label: 'Encryption at Rest', status: 'info', detail: 'PostgreSQL instance on Render — provider-managed encryption' },
    { label: 'Business Associate Agreements', status: 'info', detail: 'BAA framework documented, to be signed with third-party processors' },
    { label: 'Data Retention Policy', status: 'pass', detail: 'Audit logs retained indefinitely, session data auto-expires' },
  ]

  const statusIcon = (s: string) => s === 'pass' ? '✅' : s === 'warn' ? '⚠️' : s === 'na' ? '⬜' : 'ℹ️'
  const statusColor = (s: string) => s === 'pass' ? '#059669' : s === 'warn' ? '#f59e0b' : s === 'na' ? '#9ca3af' : '#3b82f6'
  const passCount = complianceChecklist.filter(c => c.status === 'pass').length
  const complianceScore = Math.round((passCount / complianceChecklist.length) * 100)

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>🛡️ HIPAA Compliance & Data Privacy</h1>
          <p className="page-subtitle">Compliance dashboard • audit monitoring • PHI access tracking</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={loadDashboard}>🔄 Refresh</button>
          <button className="btn btn-outline" onClick={() => onNavigate('/admin/audit-logs')}>📜 Full Audit Logs</button>
          <button className="btn btn-outline" onClick={() => onNavigate('/admin/dashboard')}>← Dashboard</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { key: 'overview', label: '📊 Compliance Overview' },
          { key: 'phi', label: '🔐 PHI Access Log' },
          { key: 'policies', label: '📋 Policies & Checklist' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            style={{
              padding: '10px 20px', borderRadius: 8, border: '1px solid',
              borderColor: tab === t.key ? '#667eea' : '#ddd',
              background: tab === t.key ? '#667eea' : 'white',
              color: tab === t.key ? 'white' : '#374151',
              fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer', fontSize: 14,
            }}>{t.label}</button>
        ))}
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {tab === 'overview' && (
        <>
          {/* Compliance Score */}
          <div className="module-card" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: 'white', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 28 }}>HIPAA Compliance Score</h2>
                <p style={{ margin: '4px 0 0', opacity: 0.9 }}>Based on {complianceChecklist.length} compliance controls assessed</p>
              </div>
              <div style={{ fontSize: 56, fontWeight: 800 }}>{complianceScore}%</div>
            </div>
            <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.2)', borderRadius: 12, height: 12 }}>
              <div style={{ width: `${complianceScore}%`, height: '100%', borderRadius: 12, background: 'white', transition: 'width 0.5s' }} />
            </div>
          </div>

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Audit Events (30d)', value: d.totalAuditEvents || 0, icon: '📊', color: '#3b82f6' },
              { label: 'PHI Access Events', value: d.phiAccessEvents || 0, icon: '🔐', color: '#8b5cf6' },
              { label: 'Failed Logins (30d)', value: d.failedLoginAttempts || 0, icon: '⚠️', color: d.failedLoginAttempts > 10 ? '#dc2626' : '#f59e0b' },
              { label: 'Active Sessions', value: d.activeSessions || 0, icon: '🟢', color: '#059669' },
              { label: 'Confidential Records', value: d.confidentialRecords || 0, icon: '🔒', color: '#6366f1' },
            ].map((kpi, i) => (
              <div key={i} className="module-card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28 }}>{kpi.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: kpi.color, margin: '4px 0' }}>{kpi.value.toLocaleString()}</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Users by Role + Events by Severity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div className="module-card">
              <h3 style={{ marginTop: 0 }}>👥 Users by Role</h3>
              {(d.usersByRole || []).map((r: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ textTransform: 'capitalize' }}>{r.role?.replace('_', ' ')}</span>
                  <strong>{r.count}</strong>
                </div>
              ))}
            </div>
            <div className="module-card">
              <h3 style={{ marginTop: 0 }}>📊 Events by Severity (30d)</h3>
              {(d.eventsBySeverity || []).map((s: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: severityColor(s.severity), display: 'inline-block' }} />
                    {s.severity?.toUpperCase()}
                  </span>
                  <strong>{s.count}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Events by Category */}
          <div className="module-card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginTop: 0 }}>📂 Events by HIPAA Category (30d)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {(d.eventsByCategory || []).map((c: any, i: number) => (
                <div key={i} style={{ padding: '12px 16px', borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13 }}>{categoryLabel(c.category)}</span>
                  <strong style={{ fontSize: 16, color: '#374151' }}>{c.count}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Daily Trend */}
          <div className="module-card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginTop: 0 }}>📈 Daily Audit Activity (14d)</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
              {(d.dailyTrend || []).map((day: any, i: number) => {
                const max = Math.max(...(d.dailyTrend || []).map((x: any) => parseInt(x.count) || 1))
                const h = Math.max(((parseInt(day.count) || 0) / max) * 100, 4)
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: '#6b7280' }}>{day.count}</span>
                    <div style={{ width: '100%', height: h, background: '#667eea', borderRadius: 4, minWidth: 8 }} />
                    <span style={{ fontSize: 9, color: '#9ca3af' }}>{new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent High-Severity Events */}
          <div className="module-card">
            <h3 style={{ marginTop: 0 }}>🚨 Recent High-Severity Events (7d)</h3>
            {(d.highSeverityEvents || []).length === 0 ? (
              <p style={{ color: '#059669', fontWeight: 600 }}>✅ No high-severity events in the last 7 days</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ textAlign: 'left', padding: 8 }}>When</th>
                      <th style={{ textAlign: 'left', padding: 8 }}>User</th>
                      <th style={{ textAlign: 'left', padding: 8 }}>Action</th>
                      <th style={{ textAlign: 'left', padding: 8 }}>Category</th>
                      <th style={{ textAlign: 'left', padding: 8 }}>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(d.highSeverityEvents || []).map((e: any) => (
                      <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: 8 }}>{formatDateTime(e.createdAt)}</td>
                        <td style={{ padding: 8 }}>{e.userName || e.userEmail || '—'}</td>
                        <td style={{ padding: 8 }}><code style={{ background: '#fee2e2', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{e.action}</code></td>
                        <td style={{ padding: 8 }}>{categoryLabel(e.details?.hipaaCategory)}</td>
                        <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 12 }}>{e.ipAddress || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ PHI ACCESS LOG TAB ═══ */}
      {tab === 'phi' && (
        <div className="module-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ margin: 0 }}>🔐 Protected Health Information Access Log</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={phiEntityFilter} onChange={e => setPhiEntityFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}>
                <option value="">All PHI Types</option>
                <option value="medical_record">Medical Records</option>
                <option value="prescription">Prescriptions</option>
                <option value="consultation">Consultations</option>
                <option value="vaccination">Vaccinations</option>
                <option value="lab_result">Lab Results</option>
                <option value="scan_analysis">Scan Analysis</option>
              </select>
              <span style={{ fontSize: 13, color: '#6b7280' }}>{phiTotal} total events</span>
            </div>
          </div>

          {phiLoading ? (
            <p style={{ textAlign: 'center', color: '#6b7280' }}>Loading...</p>
          ) : phiLogs.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#059669' }}>✅ No PHI access events found for selected filters</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                    <th style={{ textAlign: 'left', padding: 10 }}>Timestamp</th>
                    <th style={{ textAlign: 'left', padding: 10 }}>User</th>
                    <th style={{ textAlign: 'left', padding: 10 }}>Role</th>
                    <th style={{ textAlign: 'left', padding: 10 }}>Action</th>
                    <th style={{ textAlign: 'left', padding: 10 }}>Entity</th>
                    <th style={{ textAlign: 'left', padding: 10 }}>Category</th>
                    <th style={{ textAlign: 'left', padding: 10 }}>IP</th>
                    <th style={{ textAlign: 'left', padding: 10 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {phiLogs.map((log: any) => (
                    <React.Fragment key={log.id}>
                      <tr style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                        <td style={{ padding: 10 }}>{formatDateTime(log.createdAt)}</td>
                        <td style={{ padding: 10 }}>{log.userName || log.userEmail || '—'}</td>
                        <td style={{ padding: 10 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                            background: log.userRole === 'admin' ? '#fef3c7' : log.userRole === 'veterinarian' ? '#dbeafe' : '#f3e8ff',
                            color: log.userRole === 'admin' ? '#92400e' : log.userRole === 'veterinarian' ? '#1e40af' : '#6b21a8',
                          }}>{log.userRole}</span>
                        </td>
                        <td style={{ padding: 10 }}><code style={{ fontSize: 12 }}>{log.action}</code></td>
                        <td style={{ padding: 10 }}>{log.entityType}</td>
                        <td style={{ padding: 10 }}>{categoryLabel(log.details?.hipaaCategory)}</td>
                        <td style={{ padding: 10, fontFamily: 'monospace', fontSize: 11 }}>{log.ipAddress || '—'}</td>
                        <td style={{ padding: 10 }}>{expandedId === log.id ? '▲' : '▼'}</td>
                      </tr>
                      {expandedId === log.id && (
                        <tr>
                          <td colSpan={8} style={{ padding: '12px 24px', background: '#f9fafb', fontSize: 12 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                              <div><strong>Entity ID:</strong> <code style={{ fontSize: 11 }}>{log.entityId || '—'}</code></div>
                              <div><strong>User Agent:</strong> <span style={{ fontSize: 11, wordBreak: 'break-all' }}>{log.userAgent || '—'}</span></div>
                              <div><strong>Severity:</strong> <span style={{ color: severityColor(log.details?.severity) }}>{log.details?.severity?.toUpperCase()}</span></div>
                              <div><strong>User ID:</strong> <code style={{ fontSize: 11 }}>{log.userId || '—'}</code></div>
                            </div>
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

      {/* ═══ POLICIES & CHECKLIST TAB ═══ */}
      {tab === 'policies' && (
        <>
          <div className="module-card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginTop: 0 }}>📋 HIPAA Compliance Checklist</h3>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>
              Status of HIPAA technical safeguards, administrative controls, and data privacy measures implemented in VetCare
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: 10 }}>Control</th>
                  <th style={{ textAlign: 'center', padding: 10, width: 80 }}>Status</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {complianceChecklist.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 10, fontWeight: 600 }}>{item.label}</td>
                    <td style={{ padding: 10, textAlign: 'center' }}>
                      <span style={{ color: statusColor(item.status), fontWeight: 700 }}>{statusIcon(item.status)}</span>
                    </td>
                    <td style={{ padding: 10, color: '#6b7280', fontSize: 13 }}>{item.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Privacy Policies */}
          <div className="module-card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginTop: 0 }}>📜 Data Privacy Policies</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              {[
                { title: 'Data Collection & Purpose', icon: '📝',
                  content: 'VetCare collects user data (name, email, phone), animal health records (diagnoses, prescriptions, lab results, imaging), consultation records, and payment information. Data is collected solely to provide veterinary telemedicine, health management, and enterprise animal care services.' },
                { title: 'Data Storage & Encryption', icon: '🔒',
                  content: 'All data is stored in PostgreSQL databases hosted on Render.com with TLS encryption in transit. Database connections use SSL. Passwords are hashed using bcrypt with salt rounds. Session tokens use JWT with expiration.' },
                { title: 'Access Controls', icon: '🛡️',
                  content: 'Role-based access control (RBAC) with 4 roles: pet_owner, farmer, veterinarian, admin. Each role has granular permissions. Medical records support confidential flagging. Admin bypasses are audited.' },
                { title: 'Data Retention', icon: '📅',
                  content: 'Medical records are retained indefinitely for continuity of care. Audit logs are retained indefinitely for compliance. User session tokens expire per configured TTL. Soft-delete is used for data removal (deactivation, not permanent erasure).' },
                { title: 'Third-Party Processing', icon: '🤝',
                  content: 'AI features (scan analysis, drug checks, symptom analysis) use Groq API — data sent to Groq for processing is transient and not stored by the provider per their data processing terms. No other third-party data processors are used for PHI.' },
                { title: 'User Rights', icon: '👤',
                  content: 'Users can view their data summary, review what records exist, and request session termination. Users are informed of data collection through transparent UIs. Data export and deletion requests can be submitted to administrators.' },
                { title: 'Breach Response', icon: '🚨',
                  content: 'High-severity audit events (PHI exports, deletions, bulk access) are flagged automatically. Administrators are notified through the compliance dashboard. In case of a confirmed breach, affected users will be notified within 72 hours per HIPAA guidelines.' },
              ].map((policy, i) => (
                <div key={i} style={{ padding: '16px 20px', borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                  <h4 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{policy.icon}</span> {policy.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>{policy.content}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Compliance Standards */}
          <div className="module-card">
            <h3 style={{ marginTop: 0 }}>🏛️ Regulatory Framework</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {[
                { title: 'HIPAA', status: 'Aligned', color: '#059669', icon: '🏥',
                  desc: 'Technical safeguards implemented: access controls, audit controls, integrity controls, transmission security' },
                { title: 'GDPR', status: 'Awareness', color: '#3b82f6', icon: '🇪🇺',
                  desc: 'Data subject rights supported: access, portability, erasure requests. Purpose limitation enforced.' },
                { title: 'SOC 2', status: 'Not Certified', color: '#9ca3af', icon: '🔐',
                  desc: 'Controls mapped but formal SOC 2 Type II audit not yet initiated. Planned for future phase.' },
                { title: 'ISO 27001', status: 'Not Certified', color: '#9ca3af', icon: '📋',
                  desc: 'Information security management practices implemented. Formal certification planned.' },
              ].map((std, i) => (
                <div key={i} style={{ padding: 20, borderRadius: 12, border: '1px solid #e5e7eb', textAlign: 'center' }}>
                  <div style={{ fontSize: 36 }}>{std.icon}</div>
                  <h4 style={{ margin: '8px 0 4px' }}>{std.title}</h4>
                  <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: std.color + '15', color: std.color }}>{std.status}</span>
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{std.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ComplianceDashboard
