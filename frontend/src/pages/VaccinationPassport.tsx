import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import apiService from '../services/api'
import { useTranslation } from 'react-i18next'
import '../styles/modules.css'
import './VaccinationPassport.css'
import { useMasterData } from '../context/MasterDataContext'

// ─── Types ───────────────────────────────────────────────────
interface PassportDose {
  scheduleId: string
  doseNumber: number
  dueDate: string
  administeredAt: string | null
  status: 'pending' | 'administered' | 'overdue' | 'skipped' | 'waived'
  reminderSent: boolean
  vaccinationRecordId: string | null
}

interface PassportProtocol {
  protocolId: string
  protocolName: string
  disease: string
  category: string
  isZoonotic: boolean
  assignedAt: string
  waived: boolean
  waiverReason: string | null
  compliancePercent: number
  lastAdministeredAt: string | null
  nextDueDate: string | null
  overdueCount: number
  doses: PassportDose[]
}

interface PassportAnimal {
  animalId: string
  animalName: string
  animalUniqueId?: string
  species: string
  breed: string | null
  gender: string | null
  dateOfBirth: string | null
  ownerName?: string | null
  overallCompliancePercent: number
  protocols: PassportProtocol[]
}

interface ComplianceSummaryRow {
  animalId: string
  animalName: string
  species: string
  ownerName: string | null
  totalProtocols: number
  administeredDoses: number
  totalDoses: number
  overdueDoses: number
  dueSoon: number
  compliancePercent: number
}

interface CertificateLog {
  id: string
  animalId: string
  animalName: string | null
  vaccinationRecordId: string | null
  certificateType: string
  fileName: string | null
  generatedByName: string | null
  generatedAt: string
}

interface VaccinationPassportProps {
  onNavigate: (path: string) => void
}

// ─── Status badge helper ─────────────────────────────────────
function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const map: Record<string, string> = {
    administered: 'badge-success',
    pending: 'badge-pending',
    overdue: 'badge-error',
    skipped: 'badge-pending',
    waived: 'badge-pending',
  }
  return <span className={`module-badge ${map[status] || 'badge-pending'}`}>{t(`vaccinationPassport.status.${status}`)}</span>
}

// ─── Compliance meter ─────────────────────────────────────────
function ComplianceMeter({ percent }: { percent: number }) {
  const color = percent >= 80 ? '#22c55e' : percent >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="vp-compliance-meter">
      <div className="vp-compliance-bar" style={{ width: `${percent}%`, backgroundColor: color }} />
      <span className="vp-compliance-label" style={{ color }}>{percent}%</span>
    </div>
  )
}

const VaccinationPassport: React.FC<VaccinationPassportProps> = ({ onNavigate: _onNavigate }) => {
  const { t } = useTranslation()
  const { speciesIcon } = useMasterData()
  const { user } = useAuth()
  const { formatDate } = useSettings()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'passport' | 'compliance' | 'history'>('passport')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Passport data — keyed by animalId
  const [passports, setPassports] = useState<PassportAnimal[]>([])
  const [expandedAnimal, setExpandedAnimal] = useState<string | null>(null)
  const [expandedProtocol, setExpandedProtocol] = useState<string | null>(null)

  // Compliance summary (vet / farmer / admin view)
  const [complianceSummary, setComplianceSummary] = useState<ComplianceSummaryRow[]>([])
  const [summaryLoading, setSummaryLoading] = useState(false)

  // Certificate log
  const [certLogs, setCertLogs] = useState<CertificateLog[]>([])
  const [_certAnimalId, setCertAnimalId] = useState<string>('')
  const [certLoading, setCertLoading] = useState(false)

  // Downloading state per animal
  const [downloadingAnimal, setDownloadingAnimal] = useState<string | null>(null)

  // Selected animal for certificate history dropdown
  const [selectedAnimalForHistory, setSelectedAnimalForHistory] = useState<string>('')

  const isAdmin = user?.role === 'admin'
  const isVet = user?.role === 'veterinarian'
  const isFarmer = user?.role === 'farmer'
  const isPetOwner = user?.role === 'pet_owner'

  // ── Load passports ──────────────────────────────────────────
  const loadPassports = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // For all roles: load animals first, then fetch passport for each
      const animalsResp = await (apiService as any).client.get('/animals', { params: { limit: 100 } })
      const rawData = animalsResp.data?.data
      // Backend always returns { data: { animals: [], total: n } } — extract the animals array
      const animals: { id: string }[] = Array.isArray(rawData?.animals)
        ? rawData.animals
        : Array.isArray(rawData?.items) ? rawData.items  // legacy fallback
        : Array.isArray(rawData) ? rawData : []
      if (animals.length === 0) {
        setPassports([])
        setLoading(false)
        return
      }
      const passportResults = await Promise.allSettled(
        animals.slice(0, 20).map((a) =>
          (apiService as any).client.get(`/vaccination-passport/animal/${a.id}`)
        )
      )
      const loaded: PassportAnimal[] = passportResults
        .filter((r) => r.status === 'fulfilled')
        .map((r) => (r as PromiseFulfilledResult<any>).value.data?.data)
        .filter(Boolean)
      setPassports(loaded)
      if (loaded.length > 0) {
        setExpandedAnimal(loaded[0].animalId)
        setCertAnimalId(loaded[0].animalId)
        setSelectedAnimalForHistory(loaded[0].animalId)
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || t('vaccinationPassport.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  // ── Load compliance summary ─────────────────────────────────
  const loadComplianceSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const resp = await (apiService as any).client.get('/vaccination-passport/compliance-summary')
      setComplianceSummary(resp.data?.data || [])
    } catch {
      // non-critical
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  // ── Load certificate logs ───────────────────────────────────
  const loadCertLogs = useCallback(async (animalId: string) => {
    if (!animalId) return
    setCertLoading(true)
    try {
      const resp = await (apiService as any).client.get(`/vaccine-certificate-log/animal/${animalId}`)
      setCertLogs(resp.data?.data || [])
    } catch {
      setCertLogs([])
    } finally {
      setCertLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPassports()
  }, [loadPassports])

  useEffect(() => {
    if (activeTab === 'compliance' && (isAdmin || isVet || isFarmer || isPetOwner)) {
      loadComplianceSummary()
    }
  }, [activeTab, isAdmin, isVet, isFarmer, isPetOwner, loadComplianceSummary])

  useEffect(() => {
    if (activeTab === 'history' && selectedAnimalForHistory) {
      loadCertLogs(selectedAnimalForHistory)
    }
  }, [activeTab, selectedAnimalForHistory, loadCertLogs])

  // ── Print modal state ──────────────────────────────────────
  const [printHtml, setPrintHtml] = useState<string | null>(null)

  // ── Print passport (in-app modal) ──────────────────────────
  const handlePrintPassport = async (animal: PassportAnimal) => {
    // Guard: never generate a passport when no protocols exist
    if (animal.protocols.length === 0) return
    setDownloadingAnimal(animal.animalId)
    try {
      const stamp = new Date().toISOString().slice(0, 10)
      const fileName = `VaxPassport_${animal.animalName}_${stamp}.html`

      const protocolRows = animal.protocols
        .map(
          (p) => `
        <tr>
          <td>${p.protocolName}</td>
          <td>${p.disease}</td>
          <td>${p.lastAdministeredAt ? new Date(p.lastAdministeredAt).toLocaleDateString() : '-'}</td>
          <td>${p.nextDueDate ? new Date(p.nextDueDate).toLocaleDateString() : '-'}</td>
          <td>${p.compliancePercent}%</td>
          <td>${p.waived ? 'Waived' : (p.overdueCount > 0 ? 'Overdue' : 'Current')}</td>
        </tr>`
        )
        .join('')

      const generatedByName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown' : 'Unknown'

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Vaccination Passport \u2014 ${animal.animalName}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #1a1a2e; }
    h1 { color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 8px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 16px 0; }
    .meta span { font-size: 14px; } .meta strong { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #6366f1; color: white; padding: 8px 12px; text-align: left; }
    td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) { background: #f9fafb; }
    .footer { margin-top: 32px; font-size: 12px; color: #9ca3af; text-align: center; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <h1>&#x1F43E; Vaccination Passport</h1>
  <div class="meta">
    <span><strong>Name:</strong> ${animal.animalName}</span>
    <span><strong>Animal ID:</strong> ${animal.animalUniqueId || '-'}</span>
    <span><strong>Species:</strong> ${animal.species}</span>
    <span><strong>Breed:</strong> ${animal.breed || '-'}</span>
    <span><strong>Gender:</strong> ${animal.gender || '-'}</span>
    <span><strong>Date of Birth:</strong> ${animal.dateOfBirth ? new Date(animal.dateOfBirth).toLocaleDateString() : '-'}</span>
    <span><strong>Overall Compliance:</strong> ${animal.overallCompliancePercent}%</span>
  </div>
  <table>
    <thead><tr><th>Vaccine</th><th>Disease</th><th>Last Administered</th><th>Next Due</th><th>Compliance</th><th>Status</th></tr></thead>
    <tbody>${protocolRows}</tbody>
  </table>
  <div class="footer">Generated on ${new Date().toLocaleString()} &middot; Generated by: ${generatedByName} &middot; VetCare Platform</div>
</body>
</html>`

      setPrintHtml(html)

      // Log certificate download
      await (apiService as any).client.post('/vaccine-certificate-log', {
        animalId: animal.animalId,
        certificateType: 'passport',
        fileName,
      })

      // Reload cert logs if on history tab
      if (activeTab === 'history') {
        loadCertLogs(animal.animalId)
      }
    } catch {
      // non-critical
    } finally {
      setDownloadingAnimal(null)
    }
  }

  // ── Render passport card ─────────────────────────────────────
  const renderPassportCard = (animal: PassportAnimal) => {
    const isExpanded = expandedAnimal === animal.animalId
    const icon = speciesIcon(animal.species)
    return (
      <div key={animal.animalId} className="vp-passport-card">
        {/* Card header */}
        <div
          className="vp-card-header"
          onClick={() => setExpandedAnimal(isExpanded ? null : animal.animalId)}
        >
          <div className="vp-card-identity">
            <span className="vp-species-icon">{icon}</span>
            <div>
              <div className="vp-animal-name">{animal.animalName}</div>
              {animal.animalUniqueId && (
                <div
                  className="vc-id-badge si-4af0b366"
                  title={`VetCare ID — click to copy`}
                  onClick={(e) => {
                    e.stopPropagation()
                    const id = animal.animalUniqueId!
                    navigator.clipboard?.writeText(id).then(() => {
                      setCopiedId(id)
                      setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 1500)
                    }).catch(() => setError(t('common.copyFailed')))
                  }}
                 
                >
                  {copiedId === animal.animalUniqueId ? `✅ ${t('common.copied')}` : `🏷️ ${animal.animalUniqueId}`}
                </div>
              )}
              <div className="vp-animal-meta">
                {animal.species}
                {animal.breed ? ` · ${animal.breed}` : ''}
                {animal.gender ? ` · ${animal.gender}` : ''}
                {animal.dateOfBirth
                  ? ` · ${t('vaccinationPassport.dob')}: ${formatDate(animal.dateOfBirth)}`
                  : ''}
                {(isAdmin || isVet) && animal.ownerName
                  ? ` · ${t('vaccinationPassport.owner')}: ${animal.ownerName}`
                  : ''}
              </div>
            </div>
          </div>
          <div className="vp-card-actions">
            {animal.protocols.length === 0 ? (
              <span className="vp-compliance-na">{t('vaccinationPassport.complianceNA')}</span>
            ) : (
              <ComplianceMeter percent={animal.overallCompliancePercent} />
            )}
            {animal.protocols.length === 0 ? (
              <div className="vp-no-protocols-action">
                {(isAdmin || isVet) ? (
                  <span className="vp-no-protocols-note">{t('vaccinationPassport.assignProtocolsFirst')}</span>
                ) : (
                  <span className="vp-no-protocols-note">{t('vaccinationPassport.contactVetForProtocols')}</span>
                )}
              </div>
            ) : (
              <button
                className="module-btn primary small"
                onClick={(e) => { e.stopPropagation(); handlePrintPassport(animal) }}
                disabled={downloadingAnimal === animal.animalId}
              >
                {downloadingAnimal === animal.animalId
                  ? t('vaccinationPassport.downloading')
                  : t('vaccinationPassport.downloadPassport')}
              </button>
            )}
            <span className={`vp-expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
          </div>
        </div>

        {/* Expanded protocol list */}
        {isExpanded && (
          <div className="vp-protocol-list">
            {animal.protocols.length === 0 ? (
              <div className="vp-empty-protocols">{t('vaccinationPassport.noProtocols')}</div>
            ) : (
              animal.protocols.map((proto) => {
                const protKey = `${animal.animalId}-${proto.protocolId}`
                const protExpanded = expandedProtocol === protKey
                return (
                  <div key={proto.protocolId} className={`vp-protocol-row ${proto.waived ? 'vp-waived' : ''}`}>
                    <div
                      className="vp-protocol-summary"
                      onClick={() => setExpandedProtocol(protExpanded ? null : protKey)}
                    >
                      <div className="vp-proto-name">
                        <span className="vp-proto-title">{proto.protocolName}</span>
                        {proto.isZoonotic && (
                          <span className="vp-zoonotic-chip">{t('vaccinationPassport.zoonotic')}</span>
                        )}
                        <span className={`module-badge badge-${proto.category === 'Mandatory' ? 'error' : proto.category === 'Core' ? 'success' : 'pending'}`}>
                          {proto.category}
                        </span>
                        {proto.waived && (
                          <span className="module-badge badge-pending">{t('vaccinationPassport.waived')}</span>
                        )}
                      </div>
                      <div className="vp-proto-stats">
                        <span>{t('vaccinationPassport.disease')}: <strong>{proto.disease}</strong></span>
                        <span>{t('vaccinationPassport.lastDose')}: <strong>{proto.lastAdministeredAt ? formatDate(proto.lastAdministeredAt) : '-'}</strong></span>
                        <span>{t('vaccinationPassport.nextDue')}: <strong>{proto.nextDueDate ? formatDate(proto.nextDueDate) : '-'}</strong></span>
                        {proto.overdueCount > 0 && (
                          <span className="vp-overdue-warning">⚠ {proto.overdueCount} {t('vaccinationPassport.overdueDoses')}</span>
                        )}
                      </div>
                      <div className="vp-proto-compliance">
                        <ComplianceMeter percent={proto.compliancePercent} />
                        <span className="vp-expand-icon-sm">{protExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Dose history */}
                    {protExpanded && (
                      <div className="vp-dose-table-wrap">
                        <table className="module-table vp-dose-table">
                          <thead>
                            <tr>
                              <th>{t('vaccinationPassport.dose')}</th>
                              <th>{t('vaccinationPassport.dueDate')}</th>
                              <th>{t('vaccinationPassport.administeredDate')}</th>
                              <th>{t('vaccinationPassport.doseStatus')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {proto.doses.map((dose) => (
                              <tr key={dose.scheduleId}>
                                <td>#{dose.doseNumber}</td>
                                <td>{formatDate(dose.dueDate)}</td>
                                <td>{dose.administeredAt ? formatDate(dose.administeredAt) : '—'}</td>
                                <td><StatusBadge status={dose.status} t={t} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Render compliance summary ───────────────────────────────
  const renderComplianceSummary = () => (
    <div>
      {summaryLoading ? (
        <div className="vp-loading">{t('vaccinationPassport.loading')}</div>
      ) : complianceSummary.length === 0 ? (
        <div className="vp-empty">{t('vaccinationPassport.noData')}</div>
      ) : (
        <div className="data-table-container">
          <table className="module-table">
            <thead>
              <tr>
                <th>{t('vaccinationPassport.animal')}</th>
                <th>{t('vaccinationPassport.species')}</th>
                <th>{t('vaccinationPassport.owner')}</th>
                <th>{t('vaccinationPassport.protocols')}</th>
                <th>{t('vaccinationPassport.compliance')}</th>
                <th>{t('vaccinationPassport.overdue')}</th>
                <th>{t('vaccinationPassport.dueSoon')}</th>
              </tr>
            </thead>
            <tbody>
              {complianceSummary.map((row) => (
                <tr key={row.animalId}>
                  <td>
                    <span className="vp-table-icon">{speciesIcon(row.species)}</span>
                    {row.animalName}
                  </td>
                  <td>{row.species}</td>
                  <td>{row.ownerName || '—'}</td>
                  <td>{row.totalProtocols}</td>
                  <td>
                    {row.totalProtocols === 0 ? (
                      <span className="vp-compliance-na">{t('vaccinationPassport.complianceNA')}</span>
                    ) : (
                      <ComplianceMeter percent={row.compliancePercent} />
                    )}
                  </td>
                  <td>
                    {row.overdueDoses > 0 ? (
                      <span className="module-badge badge-error">{row.overdueDoses}</span>
                    ) : (
                      <span className="module-badge badge-success">0</span>
                    )}
                  </td>
                  <td>
                    {row.dueSoon > 0 ? (
                      <span className="module-badge badge-pending">{row.dueSoon}</span>
                    ) : (
                      <span className="module-badge badge-success">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  // ── Render certificate history ──────────────────────────────
  const renderCertHistory = () => (
    <div className="vp-cert-history">
      <div className="vp-cert-filter">
        <select
          className="module-input"
          value={selectedAnimalForHistory}
          onChange={(e) => {
            setSelectedAnimalForHistory(e.target.value)
            loadCertLogs(e.target.value)
          }}
        >
          <option value="">{t('vaccinationPassport.selectAnimal')}</option>
          {passports.map((a) => (
            <option key={a.animalId} value={a.animalId}>
              {speciesIcon(a.species)} {a.animalName} ({a.species}){(isAdmin || isVet) && a.ownerName ? ` — ${a.ownerName}` : ''}
            </option>
          ))}
        </select>
      </div>
      {certLoading ? (
        <div className="vp-loading">{t('vaccinationPassport.loading')}</div>
      ) : certLogs.length === 0 ? (
        <div className="vp-empty">{t('vaccinationPassport.noCertLogs')}</div>
      ) : (
        <div className="vp-cert-timeline">
          {certLogs.map((log) => (
            <div key={log.id} className="vp-cert-entry">
              <div className="vp-cert-dot" />
              <div className="vp-cert-info">
                <div className="vp-cert-title">
                  <span className="vp-cert-type">{log.certificateType}</span>
                  {log.fileName && <span className="vp-cert-filename">{log.fileName}</span>}
                </div>
                <div className="vp-cert-meta">
                  {t('vaccinationPassport.generatedBy')}: <strong>{log.generatedByName || '—'}</strong>
                  &nbsp;·&nbsp;
                  {log.generatedAt ? formatDate(log.generatedAt) : '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ── Passport stats (top) ─────────────────────────────────────
  const totalProtocols = passports.reduce((s, a) => s + a.protocols.length, 0)
  const overdueCount = passports.reduce(
    (s, a) => s + a.protocols.reduce((ps, p) => ps + (p.overdueCount ?? 0), 0),
    0
  )
  // Only average animals that actually have protocols — avoids misleading 100% when no protocols assigned
  const animalsWithProtocols = passports.filter(a => a.protocols.length > 0)
  const avgCompliance =
    animalsWithProtocols.length > 0
      ? Math.round(animalsWithProtocols.reduce((s, a) => s + a.overallCompliancePercent, 0) / animalsWithProtocols.length)
      : null
  const dueSoonCount = passports.reduce(
    (s, a) =>
      s +
      a.protocols.reduce(
        (ps, p) =>
          ps +
          (p.doses ?? []).filter(
            (d) =>
              d.status === 'pending' &&
              d.dueDate &&
              new Date(d.dueDate) <= new Date(Date.now() + 30 * 86400000)
          ).length,
        0
      ),
    0
  )

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>{t('vaccinationPassport.title')}</h1>
        <p className="module-header-subtitle">{t('vaccinationPassport.subtitle')}</p>
      </div>

      {error && (
        <div className="module-alert error">
          <span>{error}</span>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Stats */}
      {!loading && passports.length > 0 && (
        <div className="module-stats">
          <div className="stat-card">
            <div className="stat-icon">🐾</div>
            <div className="stat-value">{passports.length}</div>
            <div className="stat-label">{t('vaccinationPassport.animals')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💉</div>
            <div className="stat-value">{totalProtocols}</div>
            <div className="stat-label">{t('vaccinationPassport.protocols')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-value">{avgCompliance !== null ? `${avgCompliance}%` : t('vaccinationPassport.complianceNA')}</div>
            <div className="stat-label">{t('vaccinationPassport.avgCompliance')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⚠️</div>
            <div className="stat-value">{overdueCount}</div>
            <div className="stat-label">{t('vaccinationPassport.overdueLabel')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-value">{dueSoonCount}</div>
            <div className="stat-label">{t('vaccinationPassport.dueSoon')}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="module-tabs">
        <button
          className={`module-tab ${activeTab === 'passport' ? 'active' : ''}`}
          onClick={() => setActiveTab('passport')}
        >
          {t('vaccinationPassport.tabs.passport')}
        </button>
        {(isAdmin || isVet || isFarmer || isPetOwner) && (
          <button
            className={`module-tab ${activeTab === 'compliance' ? 'active' : ''}`}
            onClick={() => setActiveTab('compliance')}
          >
            {t('vaccinationPassport.tabs.compliance')}
          </button>
        )}
        <button
          className={`module-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          {t('vaccinationPassport.tabs.history')}
        </button>
      </div>

      {/* Tab content */}
      <div className="module-card">
        {activeTab === 'passport' && (
          <div className="vp-passport-tab">
            {loading ? (
              <div className="vp-loading">{t('vaccinationPassport.loading')}</div>
            ) : passports.length === 0 ? (
              <div className="vp-empty">
                <div className="vp-empty-icon">🐾</div>
                <div>{t('vaccinationPassport.noAnimals')}</div>
              </div>
            ) : (
              passports.map(renderPassportCard)
            )}
          </div>
        )}
        {activeTab === 'compliance' && renderComplianceSummary()}
        {activeTab === 'history' && renderCertHistory()}
      </div>

      {/* ── Print/Preview Modal ────────────────────────────── */}
      {printHtml && (
        <div className="vp-print-overlay" onClick={() => setPrintHtml(null)}>
          <div className="vp-print-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vp-print-modal-header">
              <span>{t('vaccinationPassport.passportPreview')}</span>
              <div className="vp-print-modal-actions">
                <button
                  className="module-btn primary small"
                  onClick={() => {
                    const iframe = document.getElementById('vp-print-iframe') as HTMLIFrameElement
                    if (iframe?.contentWindow) {
                      iframe.contentWindow.focus()
                      iframe.contentWindow.print()
                    }
                  }}
                >
                  🖨️ {t('vaccinationPassport.printSavePdf')}
                </button>
                <button className="module-btn small" onClick={() => setPrintHtml(null)}>✕</button>
              </div>
            </div>
            <iframe
              id="vp-print-iframe"
              className="vp-print-iframe"
              srcDoc={printHtml}
              title="Vaccination Passport"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default VaccinationPassport
