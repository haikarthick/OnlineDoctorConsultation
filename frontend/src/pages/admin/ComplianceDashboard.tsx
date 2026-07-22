import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import '../../styles/modules.css'

interface ComplianceDashboardProps {
  onNavigate: (path: string) => void
}

const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
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
        <div className="si-197eafc3">
          <div className="spinner si-76b110ec" />
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
          <h1>🛡️ {t('complianceDashboard.title')}</h1>
          <p className="page-subtitle">{t('complianceDashboard.subtitle')}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={loadDashboard}>🔄 {t('complianceDashboard.refresh')}</button>
          <button className="btn btn-outline" onClick={() => onNavigate('/admin/audit-logs')}>📜 {t('complianceDashboard.fullAuditLogs')}</button>
          <button className="btn btn-outline" onClick={() => onNavigate('/admin/dashboard')}>← {t('complianceDashboard.dashboard')}</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="si-c14e3c71">
        {[
          { key: 'overview', label: '📊 ' + t('complianceDashboard.complianceOverview') },
          { key: 'phi', label: '🔐 ' + t('complianceDashboard.phiAccessLog') },
          { key: 'policies', label: '📋 ' + t('complianceDashboard.policiesAndChecklist') },
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
          <div className="module-card si-4adddfa4">
            <div className="si-3614ae83">
              <div>
                <h2 className="si-941c12ef">{t('complianceDashboard.hipaaComplianceScore')}</h2>
                <p className="si-213342dd">{t('complianceDashboard.basedOnControls', { count: complianceChecklist.length })}</p>
              </div>
              <div className="si-4072673b">{complianceScore}%</div>
            </div>
            <div className="si-5d39d5da">
              <div style={{ width: `${complianceScore}%`, height: '100%', borderRadius: 12, background: 'white', transition: 'width 0.5s' }} />
            </div>
          </div>

          {/* KPI Cards */}
          <div className="si-3b3f146b">
            {[
              { label: t('complianceDashboard.auditEvents30d'), value: d.totalAuditEvents || 0, icon: '📊', color: '#3b82f6' },
              { label: t('complianceDashboard.phiAccessEvents'), value: d.phiAccessEvents || 0, icon: '🔐', color: '#8b5cf6' },
              { label: t('complianceDashboard.failedLogins30d'), value: d.failedLoginAttempts || 0, icon: '⚠️', color: d.failedLoginAttempts > 10 ? '#dc2626' : '#f59e0b' },
              { label: t('complianceDashboard.activeSessions'), value: d.activeSessions || 0, icon: '🟢', color: '#059669' },
              { label: t('complianceDashboard.confidentialRecords'), value: d.confidentialRecords || 0, icon: '🔒', color: '#6366f1' },
            ].map((kpi, i) => (
              <div key={i} className="module-card si-4b6b7fbc">
                <div className="si-4b9a6e6e">{kpi.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: kpi.color, margin: '4px 0' }}>{kpi.value.toLocaleString()}</div>
                <div className="si-c3b93ebb">{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Users by Role + Events by Severity */}
          <div className="si-5323a0b9">
            <div className="module-card">
              <h3 className="si-33c1a83e">👥 {t('complianceDashboard.usersByRole')}</h3>
              {(d.usersByRole || []).map((r: any, i: number) => (
                <div key={i} className="si-ede367ae">
                  <span className="si-ecf1d5e5">{r.role?.replace('_', ' ')}</span>
                  <strong>{r.count}</strong>
                </div>
              ))}
            </div>
            <div className="module-card">
              <h3 className="si-33c1a83e">📊 {t('complianceDashboard.eventsBySeverity')}</h3>
              {(d.eventsBySeverity || []).map((s: any, i: number) => (
                <div key={i} className="si-ede367ae">
                  <span className="si-bab2d193">
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: severityColor(s.severity), display: 'inline-block' }} />
                    {s.severity?.toUpperCase()}
                  </span>
                  <strong>{s.count}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Events by Category */}
          <div className="module-card si-af65fe13">
            <h3 className="si-33c1a83e">📂 {t('complianceDashboard.eventsByCategory')}</h3>
            <div className="si-2e3e2cd3">
              {(d.eventsByCategory || []).map((c: any, i: number) => (
                <div key={i} className="si-f1238c28">
                  <span className="si-0a803082">{categoryLabel(c.category)}</span>
                  <strong className="si-29d6a2e6">{c.count}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Daily Trend */}
          <div className="module-card si-af65fe13">
            <h3 className="si-33c1a83e">📈 {t('complianceDashboard.dailyAuditActivity')}</h3>
            <div className="si-ca6ac88c">
              {(d.dailyTrend || []).map((day: any, i: number) => {
                const max = Math.max(...(d.dailyTrend || []).map((x: any) => parseInt(x.count) || 1))
                const h = Math.max(((parseInt(day.count) || 0) / max) * 100, 4)
                return (
                  <div key={i} className="si-0e4f2832">
                    <span className="si-5f543982">{day.count}</span>
                    <div style={{ width: '100%', height: h, background: '#667eea', borderRadius: 4, minWidth: 8 }} />
                    <span className="si-227aab77">{new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent High-Severity Events */}
          <div className="module-card">
            <h3 className="si-33c1a83e">🚨 {t('complianceDashboard.recentHighSeverity')}</h3>
            {(d.highSeverityEvents || []).length === 0 ? (
              <p className="si-e5391e22">✅ {t('complianceDashboard.noHighSeverity')}</p>
            ) : (
              <div className="si-9aa6c55f">
                <table className="si-ec76dd85">
                  <thead>
                    <tr className="si-eb4c1b26">
                      <th className="si-a3d77950">{t('complianceDashboard.when')}</th>
                      <th className="si-a3d77950">{t('complianceDashboard.user')}</th>
                      <th className="si-a3d77950">{t('complianceDashboard.action')}</th>
                      <th className="si-a3d77950">{t('complianceDashboard.category')}</th>
                      <th className="si-a3d77950">{t('complianceDashboard.ipHeader')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(d.highSeverityEvents || []).map((e: any) => (
                      <tr key={e.id} className="si-52e81842">
                        <td className="si-78a83654">{formatDateTime(e.createdAt)}</td>
                        <td className="si-78a83654">{e.userName || e.userEmail || '—'}</td>
                        <td className="si-78a83654"><code className="si-0c0c6ed2">{e.action}</code></td>
                        <td className="si-78a83654">{categoryLabel(e.details?.hipaaCategory)}</td>
                        <td className="si-5ef23e23">{e.ipAddress || '—'}</td>
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
          <div className="si-84ceb792">
            <h3 className="si-44087c4b">🔐 {t('complianceDashboard.phiAccessLogTitle')}</h3>
            <div className="si-bab2d193">
              <select value={phiEntityFilter} onChange={e => setPhiEntityFilter(e.target.value)}
                className="si-2e795caf">
                <option value="">{t('complianceDashboard.allPhiTypes')}</option>
                <option value="medical_record">{t('complianceDashboard.medicalRecords')}</option>
                <option value="prescription">{t('complianceDashboard.prescriptions')}</option>
                <option value="consultation">{t('complianceDashboard.consultations')}</option>
                <option value="vaccination">{t('complianceDashboard.vaccinations')}</option>
                <option value="lab_result">{t('complianceDashboard.labResults')}</option>
                <option value="scan_analysis">{t('complianceDashboard.scanAnalysis')}</option>
              </select>
              <span className="si-c3b93ebb">{phiTotal} {t('complianceDashboard.totalEvents')}</span>
            </div>
          </div>

          {phiLoading ? (
            <p className="si-ce2b8b2e">{t('complianceDashboard.loadingPhi')}</p>
          ) : phiLogs.length === 0 ? (
            <p className="si-3a65eb35">✅ {t('complianceDashboard.noPhiEvents')}</p>
          ) : (
            <div className="si-9aa6c55f">
              <table className="si-ec76dd85">
                <thead>
                  <tr className="si-5630f0f7">
                    <th className="si-13d2fa66">{t('complianceDashboard.timestamp')}</th>
                    <th className="si-13d2fa66">{t('complianceDashboard.user')}</th>
                    <th className="si-13d2fa66">{t('complianceDashboard.role')}</th>
                    <th className="si-13d2fa66">{t('complianceDashboard.action')}</th>
                    <th className="si-13d2fa66">{t('complianceDashboard.entity')}</th>
                    <th className="si-13d2fa66">{t('complianceDashboard.category')}</th>
                    <th className="si-13d2fa66">{t('complianceDashboard.ipHeader')}</th>
                    <th className="si-13d2fa66"></th>
                  </tr>
                </thead>
                <tbody>
                  {phiLogs.map((log: any) => (
                    <React.Fragment key={log.id}>
                      <tr className="si-1666bcf0"
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                        <td className="si-56ec6f14">{formatDateTime(log.createdAt)}</td>
                        <td className="si-56ec6f14">{log.userName || log.userEmail || '—'}</td>
                        <td className="si-56ec6f14">
                          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                            background: log.userRole === 'admin' ? '#fef3c7' : log.userRole === 'veterinarian' ? '#dbeafe' : '#f3e8ff',
                            color: log.userRole === 'admin' ? '#92400e' : log.userRole === 'veterinarian' ? '#1e40af' : '#6b21a8',
                          }}>{log.userRole}</span>
                        </td>
                        <td className="si-56ec6f14"><code className="si-756a9f21">{log.action}</code></td>
                        <td className="si-56ec6f14">{log.entityType}</td>
                        <td className="si-56ec6f14">{categoryLabel(log.details?.hipaaCategory)}</td>
                        <td className="si-a38bb09f">{log.ipAddress || '—'}</td>
                        <td className="si-56ec6f14">{expandedId === log.id ? '▲' : '▼'}</td>
                      </tr>
                      {expandedId === log.id && (
                        <tr>
                          <td colSpan={8} className="si-692de530">
                            <div className="si-fbb64b4e">
                              <div><strong>{t('complianceDashboard.entityId')}:</strong> <code className="si-6af9d82f">{log.entityId || '—'}</code></div>
                              <div><strong>{t('complianceDashboard.user')} Agent:</strong> <span className="si-b0271ccd">{log.userAgent || '—'}</span></div>
                              <div><strong>{t('complianceDashboard.severity')}:</strong> <span style={{ color: severityColor(log.details?.severity) }}>{log.details?.severity?.toUpperCase()}</span></div>
                              <div><strong>{t('complianceDashboard.user')} ID:</strong> <code className="si-6af9d82f">{log.userId || '—'}</code></div>
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
          <div className="module-card si-af65fe13">
            <h3 className="si-33c1a83e">📋 {t('complianceDashboard.hipaaChecklist')}</h3>
            <p className="si-9a3b1c05">
              {t('complianceDashboard.hipaaChecklistDesc')}
            </p>
            <table className="si-1a9c1a87">
              <thead>
                <tr className="si-eb4c1b26">
                  <th className="si-13d2fa66">{t('complianceDashboard.control')}</th>
                  <th className="si-ba3c0f86">{t('complianceDashboard.status')}</th>
                  <th className="si-13d2fa66">{t('complianceDashboard.detailsHeader')}</th>
                </tr>
              </thead>
              <tbody>
                {complianceChecklist.map((item, i) => (
                  <tr key={i} className="si-52e81842">
                    <td className="si-aeb654a8">{item.label}</td>
                    <td className="si-83bdeb6c">
                      <span style={{ color: statusColor(item.status), fontWeight: 700 }}>{statusIcon(item.status)}</span>
                    </td>
                    <td className="si-2c9458f5">{item.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Privacy Policies */}
          <div className="module-card si-af65fe13">
            <h3 className="si-33c1a83e">📜 {t('complianceDashboard.dataPrivacyPolicies')}</h3>
            <div className="si-e295240a">
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
                <div key={i} className="si-899e524c">
                  <h4 className="si-066ab342">
                    <span>{policy.icon}</span> {policy.title}
                  </h4>
                  <p className="si-d7cd5ceb">{policy.content}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Compliance Standards */}
          <div className="module-card">
            <h3 className="si-33c1a83e">🏛️ {t('complianceDashboard.regulatoryFramework')}</h3>
            <div className="si-72b40093">
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
                <div key={i} className="si-5f890618">
                  <div className="si-e00f2732">{std.icon}</div>
                  <h4 className="si-877afa48">{std.title}</h4>
                  <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: std.color + '15', color: std.color }}>{std.status}</span>
                  <p className="si-24ad9cc1">{std.desc}</p>
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
