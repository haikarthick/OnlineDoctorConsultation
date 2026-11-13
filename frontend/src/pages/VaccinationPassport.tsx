import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import apiService from '../services/api'
import { useTranslation } from 'react-i18next'
import '../styles/modules.css'
import './VaccinationPassport.css'
import { useMasterData } from '../context/MasterDataContext'
import type { PassportAnimal, ComplianceSummaryRow, CertificateLog, GroupPassportData } from '../components/vaccinationPassport/vaccinationPassportShared'
import { PassportCard } from '../components/vaccinationPassport/PassportCard'
import { GroupPassportTab } from '../components/vaccinationPassport/GroupPassportTab'
import { ComplianceSummaryTab } from '../components/vaccinationPassport/ComplianceSummaryTab'
import { CertHistoryTab } from '../components/vaccinationPassport/CertHistoryTab'
import { PrintPreviewModal } from '../components/vaccinationPassport/PrintPreviewModal'

interface VaccinationPassportProps {
  onNavigate: (path: string) => void
}

const VaccinationPassport: React.FC<VaccinationPassportProps> = ({ onNavigate: _onNavigate }) => {
  const { t } = useTranslation()
  const { speciesIcon, speciesLabel } = useMasterData()
  const { user } = useAuth()
  const { formatDate } = useSettings()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'passport' | 'compliance' | 'history' | 'group'>('passport')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Passport data - keyed by animalId
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

  // Group vaccination passport (batch herd/flock) - farmer/vet/admin
  const [groupEnterprises, setGroupEnterprises] = useState<{ id: string; name: string }[]>([])
  const [groupEnterpriseId, setGroupEnterpriseId] = useState('')
  const [groupOptions, setGroupOptions] = useState<{ id: string; name: string; species?: string; groupType?: string; animalCount?: number }[]>([])
  const [groupPassport, setGroupPassport] = useState<GroupPassportData | null>(null)
  const [groupLoading, setGroupLoading] = useState(false)
  const [groupError, setGroupError] = useState('')
  const [groupSelectedId, setGroupSelectedId] = useState('')

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
      // Backend always returns { data: { animals: [], total: n } } - extract the animals array
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

  // ── Group vaccination passport loaders (batch herd/flock) ──
  useEffect(() => {
    if (activeTab !== 'group' || !(isAdmin || isVet || isFarmer)) return
    if (groupEnterprises.length === 0) {
      apiService.listEnterprises({ limit: 100 }).then(res => {
        const items = res.data?.items || res.data?.enterprises || (Array.isArray(res.data) ? res.data : [])
        setGroupEnterprises(items.map((e: any) => ({ id: e.id, name: e.name })))
      }).catch(() => setGroupError(t('vaccinationPassport.groupLoadEnterprisesFailed')))
    }
  }, [activeTab, isAdmin, isVet, isFarmer, t]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!groupEnterpriseId) { setGroupOptions([]); setGroupSelectedId(''); setGroupPassport(null); return }
    setGroupLoading(true)
    setGroupError('')
    apiService.listAnimalGroups(groupEnterpriseId, { limit: 200 }).then(res => {
      setGroupOptions((res.data?.items || []).map((g: any) => ({
        id: g.id, name: g.name, species: g.species, groupType: g.groupType, animalCount: g.animalCount || g.currentCount,
      })))
    }).catch(() => setGroupOptions([])).finally(() => setGroupLoading(false))
  }, [groupEnterpriseId, t])

  useEffect(() => {
    if (!groupSelectedId) { setGroupPassport(null); return }
    setGroupLoading(true)
    setGroupError('')
    apiService.getGroupVaccinationPassport(groupSelectedId).then(res => {
      setGroupPassport(res.data || null)
    }).catch(() => { setGroupPassport(null); setGroupError(t('vaccinationPassport.groupLoadFailed')) }).finally(() => setGroupLoading(false))
  }, [groupSelectedId, t])

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
  <title>Vaccination Passport — ${animal.animalName}</title>
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
  <div class="footer">Generated on ${new Date().toLocaleString()} &middot; Generated by: ${generatedByName} &middot; waytovet Platform</div>
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

  const handleCopyId = (id: string) => {
    navigator.clipboard?.writeText(id).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 1500)
    }).catch(() => setError(t('common.copyFailed')))
  }

  const handleSelectAnimalForHistory = (animalId: string) => {
    setSelectedAnimalForHistory(animalId)
    loadCertLogs(animalId)
  }

  // ── Passport stats (top) ─────────────────────────────────────
  const totalProtocols = passports.reduce((s, a) => s + a.protocols.length, 0)
  const overdueCount = passports.reduce(
    (s, a) => s + a.protocols.reduce((ps, p) => ps + (p.overdueCount ?? 0), 0),
    0
  )
  // Only average animals that actually have protocols - avoids misleading 100% when no protocols assigned
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
    <div className="module-page vp-page">
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
        {(isAdmin || isVet || isFarmer) && (
          <button
            className={`module-tab ${activeTab === 'group' ? 'active' : ''}`}
            onClick={() => setActiveTab('group')}
          >
            🐄 {t('vaccinationPassport.tabs.group')}
          </button>
        )}
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
              passports.map((animal) => (
                <PassportCard
                  key={animal.animalId}
                  animal={animal}
                  isExpanded={expandedAnimal === animal.animalId}
                  onToggleExpand={() => setExpandedAnimal(expandedAnimal === animal.animalId ? null : animal.animalId)}
                  expandedProtocolKey={expandedProtocol}
                  onToggleProtocol={(key) => setExpandedProtocol(expandedProtocol === key ? null : key)}
                  copiedId={copiedId}
                  onCopyId={handleCopyId}
                  downloadingAnimal={downloadingAnimal}
                  onPrintPassport={handlePrintPassport}
                  isAdmin={isAdmin}
                  isVet={isVet}
                  speciesIcon={speciesIcon}
                  speciesLabel={speciesLabel}
                  formatDate={formatDate}
                  t={t}
                />
              ))
            )}
          </div>
        )}
        {activeTab === 'compliance' && (
          <ComplianceSummaryTab
            summaryLoading={summaryLoading}
            complianceSummary={complianceSummary}
            speciesIcon={speciesIcon}
            speciesLabel={speciesLabel}
            t={t}
          />
        )}
        {activeTab === 'history' && (
          <CertHistoryTab
            selectedAnimalForHistory={selectedAnimalForHistory}
            onSelectAnimal={handleSelectAnimalForHistory}
            passports={passports}
            isAdmin={isAdmin}
            isVet={isVet}
            speciesIcon={speciesIcon}
            speciesLabel={speciesLabel}
            certLoading={certLoading}
            certLogs={certLogs}
            formatDate={formatDate}
            t={t}
          />
        )}
        {activeTab === 'group' && (
          <GroupPassportTab
            isAdmin={isAdmin}
            isVet={isVet}
            isFarmer={isFarmer}
            groupEnterprises={groupEnterprises}
            groupEnterpriseId={groupEnterpriseId}
            onGroupEnterpriseChange={setGroupEnterpriseId}
            groupOptions={groupOptions}
            groupSelectedId={groupSelectedId}
            onGroupSelectedChange={setGroupSelectedId}
            groupError={groupError}
            groupLoading={groupLoading}
            groupPassport={groupPassport}
            speciesLabel={speciesLabel}
            formatDate={formatDate}
            t={t}
          />
        )}
      </div>

      {/* ── Print/Preview Modal ────────────────────────────── */}
      <PrintPreviewModal printHtml={printHtml} onClose={() => setPrintHtml(null)} t={t} />
    </div>
  )
}

export default VaccinationPassport
