import React, { useState, useEffect, useCallback } from 'react'
import apiService from '../services/api'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import AutocompleteInput from '../components/AutocompleteInput'
import './ModulePage.css'
import { useTranslation } from 'react-i18next'
import { useMasterData } from '../context/MasterDataContext'

interface Enterprise { id: string; name: string }
interface Animal { id: string; name: string; species: string; breed?: string; uniqueId?: string; groupName?: string; groupId?: string }
interface AnimalGroup { id: string; name: string; groupType: string }

type Tab = 'overview' | 'records' | 'vaccinations' | 'allergies' | 'lab_results'
type ModalType = null | 'add-record' | 'add-vaccination' | 'add-allergy' | 'add-lab' | 'view-record'

const SEVERITY_COLORS: Record<string, string> = {
  low: '#059669', normal: '#667eea', high: '#d97706', critical: '#dc2626',
}
const RECORD_TYPE_ICONS: Record<string, string> = {
  diagnosis: '\u{1FA7A}', prescription: '\u{1F48A}', lab_report: '\u{1F52C}', vaccination: '\u{1F489}',
  surgery: '\u{1F3E5}', imaging: '\u{1F4F7}', follow_up: '\u{1F4C5}', other: '\u{1F4CB}',
}
const RECORD_TYPES = [
  { value: 'diagnosis', label: 'Diagnosis' }, { value: 'prescription', label: 'Prescription' },
  { value: 'lab_report', label: 'Lab Report' }, { value: 'vaccination', label: 'Vaccination' },
  { value: 'surgery', label: 'Surgery' }, { value: 'imaging', label: 'Imaging' },
  { value: 'follow_up', label: 'Follow-up' }, { value: 'other', label: 'Other' },
]

const HerdMedicalManagement: React.FC = () => {
  const { t } = useTranslation()
  const { formatDate } = useSettings()
  const { user } = useAuth()
  const { speciesLabel } = useMasterData()
  const role = user?.role || ''
  const isVet = role === 'veterinarian'
  const isAdmin = role === 'admin'
  const canCreate = isVet || isAdmin || role === 'farmer'
  const canManage = isVet || isAdmin

  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [tab, setTab] = useState<Tab>('overview')

  // Enterprise context data
  const [animals, setAnimals] = useState<Animal[]>([])
  const [groups, setGroups] = useState<AnimalGroup[]>([])

  // Data
  const [stats, setStats] = useState<any>(null)
  const [records, setRecords] = useState<any[]>([])
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [vaccinations, setVaccinations] = useState<any[]>([])
  const [vaccinationsTotal, setVaccinationsTotal] = useState(0)
  const [allergies, setAllergies] = useState<any[]>([])
  const [labResults, setLabResults] = useState<any[]>([])

  // Filters
  const [recordTypeFilter, setRecordTypeFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [vaccFilter, setVaccFilter] = useState<'all' | 'overdue' | 'upcoming'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(0)

  // Modal
  const [modal, setModal] = useState<ModalType>(null)
  const [modalSaving, setModalSaving] = useState(false)
  const [viewRecord, setViewRecord] = useState<any>(null)

  // Vaccine protocols (loaded when animal selected in vaccination modal)
  const [vaccineProtocols, setVaccineProtocols] = useState<any[]>([])

  // Form states
  const [recordForm, setRecordForm] = useState({ animalId: '', recordType: 'diagnosis', title: '', content: '', severity: 'normal', followUpDate: '', medications: '' })
  const [vaccForm, setVaccForm] = useState({ animalId: '', vaccineName: '', vaccineType: '', dateAdministered: new Date().toISOString().slice(0, 10), nextDueDate: '', batchNumber: '', manufacturer: '', dosage: '', certificateNumber: '' })
  const [allergyForm, setAllergyForm] = useState({ animalId: '', allergen: '', reaction: '', severity: 'normal', notes: '' })
  const [labForm, setLabForm] = useState({ animalId: '', testName: '', testDate: new Date().toISOString().slice(0, 10), testCategory: '', resultValue: '', normalRange: '', unit: '', status: 'pending', interpretation: '', labName: '', notes: '' })

  // Load protocols when vaccForm.animalId changes
  useEffect(() => {
    if (!vaccForm.animalId) { setVaccineProtocols([]); return }
    const animal = animals.find(a => a.id === vaccForm.animalId)
    if (!animal) return
    ;(apiService as any).client.get('/vaccine-protocols', { params: { species: animal.species, activeOnly: true } })
      .then((res: any) => setVaccineProtocols(res.data?.data || []))
      .catch(() => setVaccineProtocols([]))
  }, [vaccForm.animalId, animals])

  const handleVaccineProtocolSelect = (name: string) => {
    const proto = vaccineProtocols.find((p: any) => p.name === name)
    if (!proto) { setVaccForm(f => ({ ...f, vaccineName: name })); return }
    const adminDate = vaccForm.dateAdministered || new Date().toISOString().slice(0, 10)
    let nextDue = ''
    if (proto.boosterIntervalDays) {
      const d = new Date(adminDate)
      d.setDate(d.getDate() + proto.boosterIntervalDays)
      nextDue = d.toISOString().slice(0, 10)
    }
    setVaccForm(f => ({
      ...f,
      vaccineName: proto.name,
      vaccineType: proto.vaccineCategory || f.vaccineType,
      dosage: proto.dosageMl ? `${proto.dosageMl} mL` : f.dosage,
      nextDueDate: nextDue || f.nextDueDate,
    }))
  }

  const fmtDate = useCallback((d: string) => {
    if (!d) return 'N/A'
    try { return formatDate(d) } catch { return d?.slice(0, 10) || d }
  }, [formatDate])

  const clearMessages = () => { setError(''); setSuccess('') }

  // Load Enterprises
  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiService.listEnterprises({ limit: 100 })
        const items = res.data?.items || []
        setEnterprises(items)
        if (items.length === 1) setSelectedEnterpriseId(items[0].id)
      } catch { setEnterprises([]) }
    }
    load()
  }, [])

  // Load enterprise context (animals + groups)
  const loadContext = useCallback(async () => {
    if (!selectedEnterpriseId) return
    try {
      const [animalsRes, groupsRes] = await Promise.all([
        apiService.listEnterpriseAnimals(selectedEnterpriseId, { limit: 500 }),
        apiService.listAnimalGroups(selectedEnterpriseId, { limit: 200 }),
      ])
      setAnimals(animalsRes.data?.items || [])
      setGroups(groupsRes.data?.items || groupsRes.data || [])
    } catch { /* silent */ }
  }, [selectedEnterpriseId])

  // Load tab data
  const loadStats = useCallback(async () => {
    if (!selectedEnterpriseId) return
    try {
      const res = await apiService.getEnterpriseMedicalStats(selectedEnterpriseId)
      setStats(res.data || null)
    } catch { setStats(null) }
  }, [selectedEnterpriseId])

  const loadRecords = useCallback(async () => {
    if (!selectedEnterpriseId) return
    try {
      const params: any = { limit: 20, offset: page * 20 }
      if (recordTypeFilter) params.recordType = recordTypeFilter
      if (severityFilter) params.severity = severityFilter
      if (groupFilter) params.groupId = groupFilter
      if (searchQuery) params.search = searchQuery
      const res = await apiService.getEnterpriseMedicalRecords(selectedEnterpriseId, params)
      setRecords(res.data?.records || [])
      setRecordsTotal(res.data?.total || 0)
    } catch { setRecords([]) }
  }, [selectedEnterpriseId, page, recordTypeFilter, severityFilter, groupFilter, searchQuery])

  const loadVaccinations = useCallback(async () => {
    if (!selectedEnterpriseId) return
    try {
      const params: any = { limit: 100 }
      if (vaccFilter === 'overdue') params.overdueOnly = 'true'
      if (vaccFilter === 'upcoming') params.upcomingOnly = 'true'
      if (groupFilter) params.groupId = groupFilter
      const res = await apiService.getEnterpriseVaccinations(selectedEnterpriseId, params)
      setVaccinations(res.data?.vaccinations || [])
      setVaccinationsTotal(res.data?.total || 0)
    } catch { setVaccinations([]) }
  }, [selectedEnterpriseId, vaccFilter, groupFilter])

  const loadAllergies = useCallback(async () => {
    if (!selectedEnterpriseId || !animals.length) { setAllergies([]); return }
    try {
      const allAllergies: any[] = []
      const animalSubset = animals.slice(0, 50)
      const results = await Promise.allSettled(animalSubset.map(a => apiService.listAllergies(a.id)))
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const items = r.value?.data || []
          items.forEach((al: any) => { al.animalName = animalSubset[i].name; al.animalSpecies = animalSubset[i].species })
          allAllergies.push(...items)
        }
      })
      setAllergies(allAllergies)
    } catch { setAllergies([]) }
  }, [selectedEnterpriseId, animals])

  const loadLabResults = useCallback(async () => {
    if (!selectedEnterpriseId || !animals.length) { setLabResults([]); return }
    try {
      const allLabs: any[] = []
      const animalSubset = animals.slice(0, 50)
      const results = await Promise.allSettled(animalSubset.map(a => apiService.listLabResults(a.id, { limit: 20 })))
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const items = r.value?.data?.items || r.value?.data || []
          items.forEach((lb: any) => { lb.animalName = animalSubset[i].name; lb.animalSpecies = animalSubset[i].species })
          allLabs.push(...items)
        }
      })
      allLabs.sort((a: any, b: any) => new Date(b.testDate || b.createdAt).getTime() - new Date(a.testDate || a.createdAt).getTime())
      setLabResults(allLabs)
    } catch { setLabResults([]) }
  }, [selectedEnterpriseId, animals])

  // Effects
  useEffect(() => {
    if (!selectedEnterpriseId) return
    setLoading(true); clearMessages()
    Promise.all([loadContext(), loadStats(), loadRecords(), loadVaccinations()]).finally(() => setLoading(false))
  }, [selectedEnterpriseId])

  useEffect(() => {
    if (tab === 'allergies') loadAllergies()
    if (tab === 'lab_results') loadLabResults()
  }, [animals, tab])

  useEffect(() => { if (selectedEnterpriseId) loadRecords() }, [recordTypeFilter, severityFilter, groupFilter, searchQuery, page])
  useEffect(() => { if (selectedEnterpriseId) loadVaccinations() }, [vaccFilter, groupFilter])

  // Form handlers
  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recordForm.animalId || !recordForm.title || !recordForm.content) { setError(t('herdMedical.validation.recordRequired')); return }
    setModalSaving(true); clearMessages()
    try {
      const medsArray = recordForm.medications ? recordForm.medications.split(',').map(m => ({ name: m.trim() })) : undefined
      await apiService.createMedicalRecord({
        animalId: recordForm.animalId, recordType: recordForm.recordType, title: recordForm.title,
        content: recordForm.content, severity: recordForm.severity,
        followUpDate: recordForm.followUpDate || undefined, medications: medsArray,
        veterinarianId: isVet ? user?.id : undefined,
      })
      setSuccess(t('herdMedical.success.recordCreated')); setModal(null)
      setRecordForm({ animalId: '', recordType: 'diagnosis', title: '', content: '', severity: 'normal', followUpDate: '', medications: '' })
      loadRecords(); loadStats()
    } catch (err: any) { setError(err.response?.data?.error?.message || t('herdMedical.error.failedToCreateRecord')) }
    finally { setModalSaving(false) }
  }

  const handleCreateVaccination = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vaccForm.animalId || !vaccForm.vaccineName || !vaccForm.dateAdministered) { setError(t('herdMedical.validation.vaccinationRequired')); return }
    setModalSaving(true); clearMessages()
    try {
      await apiService.createVaccination({
        animalId: vaccForm.animalId, vaccineName: vaccForm.vaccineName,
        vaccineType: vaccForm.vaccineType || undefined, dateAdministered: vaccForm.dateAdministered,
        nextDueDate: vaccForm.nextDueDate || undefined, batchNumber: vaccForm.batchNumber || undefined,
        manufacturer: vaccForm.manufacturer || undefined, dosage: vaccForm.dosage || undefined,
        certificateNumber: vaccForm.certificateNumber || undefined,
      })
      setSuccess(t('herdMedical.success.vaccinationRecorded')); setModal(null)
      setVaccForm({ animalId: '', vaccineName: '', vaccineType: '', dateAdministered: new Date().toISOString().slice(0, 10), nextDueDate: '', batchNumber: '', manufacturer: '', dosage: '', certificateNumber: '' })
      loadVaccinations(); loadStats()
    } catch (err: any) { setError(err.response?.data?.error?.message || t('herdMedical.error.failedToRecordVaccination')) }
    finally { setModalSaving(false) }
  }

  const handleCreateAllergy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!allergyForm.animalId || !allergyForm.allergen) { setError(t('herdMedical.validation.allergyRequired')); return }
    setModalSaving(true); clearMessages()
    try {
      await apiService.createAllergy({
        animalId: allergyForm.animalId, allergen: allergyForm.allergen,
        reaction: allergyForm.reaction || undefined, severity: allergyForm.severity || undefined,
        notes: allergyForm.notes || undefined,
      })
      setSuccess(t('herdMedical.success.allergyRecorded')); setModal(null)
      setAllergyForm({ animalId: '', allergen: '', reaction: '', severity: 'normal', notes: '' })
      loadAllergies(); loadStats()
    } catch (err: any) { setError(err.response?.data?.error?.message || t('herdMedical.error.failedToRecordAllergy')) }
    finally { setModalSaving(false) }
  }

  const handleCreateLabResult = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!labForm.animalId || !labForm.testName || !labForm.testDate) { setError(t('herdMedical.validation.labRequired')); return }
    setModalSaving(true); clearMessages()
    try {
      await apiService.createLabResult({
        animalId: labForm.animalId, testName: labForm.testName, testDate: labForm.testDate,
        testCategory: labForm.testCategory || undefined, resultValue: labForm.resultValue || undefined,
        normalRange: labForm.normalRange || undefined, unit: labForm.unit || undefined,
        status: labForm.status as any || 'pending', interpretation: labForm.interpretation || undefined,
        labName: labForm.labName || undefined, notes: labForm.notes || undefined,
      })
      setSuccess(t('herdMedical.success.labRecorded')); setModal(null)
      setLabForm({ animalId: '', testName: '', testDate: new Date().toISOString().slice(0, 10), testCategory: '', resultValue: '', normalRange: '', unit: '', status: 'pending', interpretation: '', labName: '', notes: '' })
      loadLabResults(); loadStats()
    } catch (err: any) { setError(err.response?.data?.error?.message || t('herdMedical.error.failedToRecordLabResult')) }
    finally { setModalSaving(false) }
  }

  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm(t('herdMedical.confirm.archiveRecord'))) return
    clearMessages()
    try { await apiService.deleteMedicalRecord(id); setSuccess(t('herdMedical.success.recordArchived')); loadRecords(); loadStats() }
    catch (err: any) { setError(err.response?.data?.error?.message || t('herdMedical.error.failedToArchive')) }
  }

  const handleViewRecord = async (id: string) => {
    try { const res = await apiService.getMedicalRecord(id); setViewRecord(res.data || null); setModal('view-record') }
    catch { setError(t('herdMedical.error.failedToLoadDetails')) }
  }

  const handleUpdateLabStatus = async (id: string, status: string) => {
    clearMessages()
    try { await apiService.updateLabResult(id, { status }); setSuccess(t('herdMedical.success.labUpdated')); loadLabResults() }
    catch (err: any) { setError(err.response?.data?.error?.message || t('common.failedToUpdate')) }
  }

  // Animal Select component
  const AnimalSelect = ({ value, onChange, required }: { value: string; onChange: (v: string) => void; required?: boolean }) => (
    <select value={value} onChange={e => onChange(e.target.value)} className="search-input si-7d984748" required={required}>
      <option value="">{t('herdMedical.selectAnimal')}</option>
      {animals.map(a => (
        <option key={a.id} value={a.id}>
          {a.name} ({speciesLabel(a.species, t)}{a.breed ? ' - ' + a.breed : ''}{a.groupName ? ' | ' + a.groupName : ''})
        </option>
      ))}
    </select>
  )

  const GroupFilterSelect = () => (
    <select value={groupFilter} onChange={e => { setGroupFilter(e.target.value); setPage(0) }} className="search-input si-4979ce6f">
      <option value="">{t('herdMedical.allGroups')}</option>
      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
    </select>
  )

  // OVERVIEW TAB
  const renderOverview = () => {
    if (!stats) return <div className="empty-state">{t('herdMedical.overview.noStats')}</div>
    return (
      <div>
        <div className="dashboard-grid">
          <div className="stat-card"><div className="stat-icon">&#x1F404;</div><div className="stat-value">{stats.activeAnimals || 0}</div><div className="stat-label">{t('herdMedical.overview.activeAnimals')}</div></div>
          <div className="stat-card"><div className="stat-icon">&#x1F4CB;</div><div className="stat-value">{stats.totalRecords || 0}</div><div className="stat-label">{t('herdMedical.overview.medicalRecords')}</div></div>
          <div className="stat-card"><div className="stat-icon">&#x1F489;</div><div className="stat-value">{stats.vaccinations?.total || 0}</div><div className="stat-label">{t('herdMedical.overview.vaccinations')}</div></div>
          <div className="stat-card" style={{ borderColor: (stats.vaccinations?.overdue || 0) > 0 ? '#dc2626' : undefined }}>
            <div className="stat-icon">&#x26A0;&#xFE0F;</div>
            <div className="stat-value" style={{ color: (stats.vaccinations?.overdue || 0) > 0 ? '#dc2626' : undefined }}>{stats.vaccinations?.overdue || 0}</div>
            <div className="stat-label">{t('herdMedical.overview.overdueVaccinations')}</div>
          </div>
          <div className="stat-card"><div className="stat-icon">&#x1F52C;</div><div className="stat-value">{stats.labResults?.pending || 0}</div><div className="stat-label">{t('herdMedical.overview.pendingLabResults')}</div></div>
          <div className="stat-card"><div className="stat-icon">&#x1F927;</div><div className="stat-value">{stats.allergies?.active || 0}</div><div className="stat-label">{t('herdMedical.overview.activeAllergies')}</div></div>
          <div className="stat-card"><div className="stat-icon">&#x1F4C5;</div><div className="stat-value">{stats.upcomingFollowUps || 0}</div><div className="stat-label">{t('herdMedical.overview.followUps')}</div></div>
          <div className="stat-card"><div className="stat-icon">&#x1F4CA;</div><div className="stat-value">{stats.vaccinations?.upcomingDue || 0}</div><div className="stat-label">{t('herdMedical.overview.vaccinationsDue')}</div></div>
        </div>

        {canCreate && (
          <div className="si-81bfb3b5">
            <h3 className="si-a70422fe">{t('herdMedical.overview.quickActions')}</h3>
            <div className="si-11b3a707">
              <button className="btn btn-primary" onClick={() => { setRecordForm(f => ({ ...f, animalId: '' })); setModal('add-record') }}>{t('herdMedical.overview.addRecord')}</button>
              <button className="btn btn-primary" onClick={() => { setVaccForm(f => ({ ...f, animalId: '' })); setModal('add-vaccination') }}>{t('herdMedical.overview.addVaccination')}</button>
              <button className="btn btn-primary" onClick={() => { setAllergyForm(f => ({ ...f, animalId: '' })); setModal('add-allergy') }}>{t('herdMedical.overview.addAllergy')}</button>
              <button className="btn btn-primary" onClick={() => { setLabForm(f => ({ ...f, animalId: '' })); setModal('add-lab') }}>{t('herdMedical.overview.addLabResult')}</button>
            </div>
          </div>
        )}

        {stats.recordsByType && Object.keys(stats.recordsByType).length > 0 && (
          <div className="si-81bfb3b5">
            <h3 className="si-a70422fe">{t('herdMedical.overview.recordsByType')}</h3>
            <div className="dashboard-grid">
              {Object.entries(stats.recordsByType).map(([type, count]: any) => (
                <div key={type} className="stat-card si-3c1f81b9" onClick={() => { setRecordTypeFilter(type); setTab('records') }}>
                  <div className="stat-icon">{RECORD_TYPE_ICONS[type] || '&#x1F4CB;'}</div>
                  <div className="stat-value">{count}</div>
                  <div className="stat-label">{type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.groupHealth && stats.groupHealth.length > 0 && (
          <div className="si-81bfb3b5">
            <h3 className="si-a70422fe">{t('herdMedical.overview.groupHealth')}</h3>
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>{t('herdMedical.table.group')}</th><th>{t('common.type')}</th><th>{t('herdMedical.table.animals')}</th><th>{t('herdMedical.table.records')}</th><th>{t('herdMedical.table.overdueVaccinations')}</th></tr></thead>
                <tbody>
                  {stats.groupHealth.map((g: any) => (
                    <tr key={g.id}>
                      <td><strong>{g.name}</strong></td><td>{g.groupType || '-'}</td><td>{g.animalCount}</td><td>{g.recordCount}</td>
                      <td style={{ color: g.overdueVaccinations > 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>{g.overdueVaccinations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {stats.recentRecords && stats.recentRecords.length > 0 && (
          <div className="si-81bfb3b5">
            <h3 className="si-a70422fe">{t('herdMedical.overview.recentRecords')}</h3>
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>{t('common.date')}</th><th>{t('herdMedical.table.animal')}</th><th>{t('common.type')}</th><th>{t('herdMedical.table.title')}</th><th>{t('herdMedical.table.severity')}</th><th>{t('common.status')}</th><th>{t('common.actions')}</th></tr></thead>
                <tbody>
                  {stats.recentRecords.map((r: any) => (
                    <tr key={r.id}>
                      <td>{fmtDate(r.createdAt)}</td>
                      <td>{r.animalName} ({speciesLabel(r.animalSpecies, t)})</td>
                      <td>{RECORD_TYPE_ICONS[r.recordType] || ''} {r.recordType?.replace(/_/g, ' ')}</td>
                      <td>{r.title}</td>
                      <td><span style={{ backgroundColor: SEVERITY_COLORS[r.severity] || '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8em' }}>{r.severity}</span></td>
                      <td>{r.status}</td>
                      <td><button className="btn btn-secondary si-7579293e" onClick={() => handleViewRecord(r.id)}>{t('common.view')}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  // RECORDS TAB
  const renderRecords = () => (
    <div>
      <div className="si-0dba974a">
        <div className="si-87a4ff70">
          <AutocompleteInput
            value={searchQuery}
            onChange={v => { setSearchQuery(v); setPage(0) }}
            options={animals.map(a => a.name)}
            placeholder={t('herdMedical.records.searchPlaceholder')}
            className="herd-search"
          />
          <select value={recordTypeFilter} onChange={e => { setRecordTypeFilter(e.target.value); setPage(0) }} className="search-input si-28627afe">
            <option value="">{t('herdMedical.records.allTypes')}</option>{RECORD_TYPES.map(rt => <option key={rt.value} value={rt.value}>{t(`herdMedical.recordTypes.${rt.value}`)}</option>)}
          </select>
          <select value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); setPage(0) }} className="search-input si-4a1efd17">
            <option value="">{t('herdMedical.records.allSeverities')}</option><option value="low">{t('herdMedical.severity.low')}</option><option value="normal">{t('herdMedical.severity.normal')}</option><option value="high">{t('herdMedical.severity.high')}</option><option value="critical">{t('herdMedical.severity.critical')}</option>
          </select>
          <GroupFilterSelect />
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => { setRecordForm({ animalId: '', recordType: 'diagnosis', title: '', content: '', severity: 'normal', followUpDate: '', medications: '' }); setModal('add-record') }}>
            {t('herdMedical.records.addRecord')}
          </button>
        )}
      </div>
      {records.length === 0 ? (
        <div className="empty-state">{animals.length === 0 ? t('herdMedical.records.noAnimalsYet') : t('herdMedical.records.noRecords')}</div>
      ) : (
        <>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>{t('common.date')}</th><th>{t('herdMedical.table.animal')}</th><th>{t('herdMedical.table.group')}</th><th>{t('common.type')}</th><th>{t('herdMedical.table.title')}</th><th>{t('herdMedical.table.severity')}</th><th>{t('common.status')}</th><th>{t('herdMedical.table.vet')}</th><th>{t('common.actions')}</th></tr></thead>
              <tbody>
                {records.map((r: any) => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.createdAt)}</td>
                    <td><strong>{r.animalName}</strong><br /><small className="si-50edd4e9">{speciesLabel(r.animalSpecies, t)}{r.animalBreed ? ' - ' + r.animalBreed : ''}</small></td>
                    <td>{r.groupName || '-'}</td>
                    <td>{RECORD_TYPE_ICONS[r.recordType] || ''} {r.recordType?.replace(/_/g, ' ')}</td>
                    <td>{r.title}</td>
                    <td><span style={{ backgroundColor: SEVERITY_COLORS[r.severity] || '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8em' }}>{r.severity}</span></td>
                    <td>{r.status}</td>
                    <td>{r.veterinarianName || '-'}</td>
                    <td className="si-ba472c26">
                      <button className="btn btn-secondary si-74c81f79" onClick={() => handleViewRecord(r.id)}>{t('common.view')}</button>
                      {canManage && <button className="btn btn-secondary si-3941d76e" onClick={() => handleDeleteRecord(r.id)}>{t('herdMedical.records.archive')}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="si-80de668f">
            <span className="si-07b0717a">{t('herdMedical.records.showing', { from: page * 20 + 1, to: Math.min((page + 1) * 20, recordsTotal), total: recordsTotal })}</span>
            <div className="si-fe667bdf">
              <button className="btn btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>{t('herdMedical.records.prev')}</button>
              <button className="btn btn-secondary" disabled={(page + 1) * 20 >= recordsTotal} onClick={() => setPage(p => p + 1)}>{t('herdMedical.records.next')}</button>
            </div>
          </div>
        </>
      )}
    </div>
  )

  // VACCINATIONS TAB
  const renderVaccinations = () => (
    <div>
      <div className="si-0dba974a">
        <div className="si-dc4323dc">
          <select value={vaccFilter} onChange={e => setVaccFilter(e.target.value as any)} className="search-input si-172609b2">
            <option value="all">{t('herdMedical.vaccinations.all')}</option><option value="overdue">{t('herdMedical.vaccinations.overdueOnly')}</option><option value="upcoming">{t('herdMedical.vaccinations.upcoming')}</option>
          </select>
          <GroupFilterSelect />
          <span className="si-07b0717a">{t('herdMedical.vaccinations.totalCount', { count: vaccinationsTotal })}</span>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => { setVaccForm({ animalId: '', vaccineName: '', vaccineType: '', dateAdministered: new Date().toISOString().slice(0, 10), nextDueDate: '', batchNumber: '', manufacturer: '', dosage: '', certificateNumber: '' }); setModal('add-vaccination') }}>
            {t('herdMedical.vaccinations.addButton')}
          </button>
        )}
      </div>
      {vaccinations.length === 0 ? (
        <div className="empty-state">{animals.length === 0 ? t('herdMedical.records.noAnimalsYet') : t('herdMedical.vaccinations.noRecords')}</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>{t('herdMedical.table.animal')}</th><th>{t('herdMedical.table.group')}</th><th>{t('herdMedical.table.vaccine')}</th><th>{t('common.type')}</th><th>{t('herdMedical.table.dosage')}</th><th>{t('herdMedical.table.administered')}</th><th>{t('herdMedical.table.nextDue')}</th><th>{t('common.status')}</th></tr></thead>
            <tbody>
              {vaccinations.map((v: any) => (
                <tr key={v.id}>
                  <td><strong>{v.animalName}</strong><br /><small className="si-50edd4e9">{speciesLabel(v.animalSpecies, t)}</small></td>
                  <td>{v.groupName || '-'}</td>
                  <td><strong>{v.vaccineName}</strong></td>
                  <td>{v.vaccineType || '-'}</td>
                  <td>{v.dosage || '-'}</td>
                  <td>{fmtDate(v.dateAdministered)}</td>
                  <td>{v.nextDueDate ? fmtDate(v.nextDueDate) : 'N/A'}</td>
                  <td>
                    <span style={{
                      padding: '2px 10px', borderRadius: '4px', fontSize: '0.8em', fontWeight: 600,
                      backgroundColor: v.dueStatus === 'overdue' ? '#fef2f2' : v.dueStatus === 'upcoming' ? '#fffbeb' : '#f0fdf4',
                      color: v.dueStatus === 'overdue' ? '#dc2626' : v.dueStatus === 'upcoming' ? '#d97706' : '#059669',
                    }}>
                      {v.dueStatus === 'overdue' ? t('herdMedical.vaccinations.overdue') : v.dueStatus === 'upcoming' ? t('herdMedical.vaccinations.dueSoon') : t('herdMedical.vaccinations.current')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  // ALLERGIES TAB
  const renderAllergies = () => (
    <div>
      <div className="si-ff3206fd">
        <span className="si-50edd4e9">{t('herdMedical.allergies.countText', { count: allergies.length })}</span>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => { setAllergyForm({ animalId: '', allergen: '', reaction: '', severity: 'normal', notes: '' }); setModal('add-allergy') }}>
            {t('herdMedical.allergies.addButton')}
          </button>
        )}
      </div>
      {allergies.length === 0 ? (
        <div className="empty-state">{animals.length === 0 ? t('herdMedical.records.noAnimalsYet') : t('herdMedical.allergies.noRecords')}</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>{t('herdMedical.table.animal')}</th><th>{t('herdMedical.table.allergen')}</th><th>{t('herdMedical.table.reaction')}</th><th>{t('herdMedical.table.severity')}</th><th>{t('herdMedical.table.active')}</th><th>{t('herdMedical.table.identified')}</th></tr></thead>
            <tbody>
              {allergies.map((a: any, i: number) => (
                <tr key={a.id || i}>
                  <td><strong>{a.animalName}</strong> ({speciesLabel(a.animalSpecies, t)})</td>
                  <td><strong>{a.allergen}</strong></td>
                  <td>{a.reaction || '-'}</td>
                  <td><span style={{ backgroundColor: SEVERITY_COLORS[a.severity] || '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8em' }}>{a.severity || 'normal'}</span></td>
                  <td>{a.isActive === false ? t('herdMedical.allergies.inactive') : t('herdMedical.allergies.active')}</td>
                  <td>{a.identifiedDate ? fmtDate(a.identifiedDate) : fmtDate(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  // LAB RESULTS TAB
  const renderLabResults = () => (
    <div>
      <div className="si-ff3206fd">
        <span className="si-50edd4e9">{t('herdMedical.labResults.countText', { count: labResults.length })}</span>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => { setLabForm({ animalId: '', testName: '', testDate: new Date().toISOString().slice(0, 10), testCategory: '', resultValue: '', normalRange: '', unit: '', status: 'pending', interpretation: '', labName: '', notes: '' }); setModal('add-lab') }}>
            {t('herdMedical.labResults.addButton')}
          </button>
        )}
      </div>
      {labResults.length === 0 ? (
        <div className="empty-state">{animals.length === 0 ? t('herdMedical.records.noAnimalsYet') : t('herdMedical.labResults.noRecords')}</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>{t('common.date')}</th><th>{t('herdMedical.table.animal')}</th><th>{t('herdMedical.table.test')}</th><th>{t('herdMedical.table.category')}</th><th>{t('herdMedical.table.result')}</th><th>{t('herdMedical.table.normalRange')}</th><th>{t('common.status')}</th>{canManage && <th>{t('common.actions')}</th>}</tr></thead>
            <tbody>
              {labResults.map((l: any, i: number) => (
                <tr key={l.id || i}>
                  <td>{fmtDate(l.testDate || l.createdAt)}</td>
                  <td><strong>{l.animalName}</strong> ({speciesLabel(l.animalSpecies, t)})</td>
                  <td><strong>{l.testName}</strong></td>
                  <td>{l.testCategory || '-'}</td>
                  <td style={{ color: l.isAbnormal ? '#dc2626' : undefined, fontWeight: l.isAbnormal ? 600 : undefined }}>{l.resultValue || t('common.pending')} {l.unit || ''}</td>
                  <td>{l.normalRange || '-'}</td>
                  <td>
                    <span style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '0.8em', fontWeight: 600,
                      backgroundColor: l.status === 'completed' ? '#f0fdf4' : l.status === 'pending' ? '#fffbeb' : '#f0f4ff',
                      color: l.status === 'completed' ? '#059669' : l.status === 'pending' ? '#d97706' : '#667eea',
                    }}>{l.status || 'pending'}</span>
                  </td>
                  {canManage && (
                    <td className="si-ba472c26">
                      {l.status === 'pending' && <button className="btn btn-secondary si-7579293e" onClick={() => handleUpdateLabStatus(l.id, 'completed')}>{t('herdMedical.labResults.complete')}</button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  // MODAL STYLES
  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '60px', zIndex: 1000, overflowY: 'auto',
  }
  const modalStyle: React.CSSProperties = {
    background: '#fff', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '600px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)', marginBottom: '40px',
  }
  const fieldStyle: React.CSSProperties = { marginBottom: '14px' }
  const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, marginBottom: '4px', fontSize: '0.9em', color: '#374151' }

  // MODALS
  const renderModals = () => (
    <>
      {modal === 'add-record' && (
        <div style={modalOverlayStyle} onClick={() => setModal(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 className="si-d4411fdc">{t('medicalRecords.pageTitle')}</h2>
            <p className="si-a43648b0">
              {isVet ? t('herdMedical.modal.roleVet') : isAdmin ? t('herdMedical.modal.roleAdmin') : t('herdMedical.modal.roleFarmer')}
            </p>
            <form onSubmit={handleCreateRecord}>
              <div style={fieldStyle}><label style={labelStyle}>{t('herdMedical.modal.animal')} *</label><AnimalSelect value={recordForm.animalId} onChange={v => setRecordForm(f => ({ ...f, animalId: v }))} required /></div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div className="si-6acd75e8"><label style={labelStyle}>{t('herdMedical.modal.recordType')} *</label>
                  <select value={recordForm.recordType} onChange={e => setRecordForm(f => ({ ...f, recordType: e.target.value }))} className="search-input si-7d984748">
                    {RECORD_TYPES.map(rt => <option key={rt.value} value={rt.value}>{t(`herdMedical.recordTypes.${rt.value}`)}</option>)}
                  </select>
                </div>
                <div className="si-6acd75e8"><label style={labelStyle}>{t('herdMedical.table.severity')}</label>
                  <select value={recordForm.severity} onChange={e => setRecordForm(f => ({ ...f, severity: e.target.value }))} className="search-input si-7d984748">
                    <option value="low">{t('herdMedical.severity.low')}</option><option value="normal">{t('herdMedical.severity.normal')}</option><option value="high">{t('herdMedical.severity.high')}</option><option value="critical">{t('herdMedical.severity.critical')}</option>
                  </select>
                </div>
              </div>
              <div style={fieldStyle}><label style={labelStyle}>{t('herdMedical.table.title')} *</label><input type="text" className="search-input si-7d984748" value={recordForm.title} onChange={e => setRecordForm(f => ({ ...f, title: e.target.value }))} required placeholder={t('herdMedical.modal.titlePlaceholder')} /></div>
              <div style={fieldStyle}><label style={labelStyle}>{t('herdMedical.modal.contentNotes')} *</label><textarea className="search-input si-3973cbd1" value={recordForm.content} onChange={e => setRecordForm(f => ({ ...f, content: e.target.value }))} required placeholder={t('herdMedical.modal.contentPlaceholder')} /></div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div className="si-6acd75e8"><label style={labelStyle}>{t('herdMedical.modal.medications')}</label><input type="text" className="search-input si-7d984748" value={recordForm.medications} onChange={e => setRecordForm(f => ({ ...f, medications: e.target.value }))} placeholder={t('herdMedical.modal.medicationsPlaceholder')} /></div>
                <div className="si-6acd75e8"><label style={labelStyle}>{t('herdMedical.modal.followUpDate')}</label><input type="date" className="search-input si-7d984748" value={recordForm.followUpDate} onChange={e => setRecordForm(f => ({ ...f, followUpDate: e.target.value }))} /></div>
              </div>
              <div className="si-66181d73">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={modalSaving}>{modalSaving ? t('herdMedical.modal.saving') : t('herdMedical.modal.createRecord')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'add-vaccination' && (
        <div style={modalOverlayStyle} onClick={() => setModal(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 className="si-d4411fdc">{t('herdMedical.modal.recordVaccination')}</h2>
            <p className="si-a43648b0">{t('herdMedical.modal.vaccDescription')}</p>
            <form onSubmit={handleCreateVaccination}>
              <div style={fieldStyle}><label style={labelStyle}>{t('herdMedical.modal.animal')} *</label><AnimalSelect value={vaccForm.animalId} onChange={v => setVaccForm(f => ({ ...f, animalId: v, vaccineName: '', vaccineType: '', dosage: '', nextDueDate: '' }))} required /></div>
              {vaccineProtocols.length > 0 && (
                <div style={{ ...fieldStyle, padding: '8px 12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', marginBottom: '8px', fontSize: '0.85em', color: '#166534' }}>
                  💉 {t('herdMedical.modal.protocolsAvailable', { count: vaccineProtocols.length })}
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div className="si-6acd75e8">
                  <label style={labelStyle}>{t('herdMedical.modal.vaccineName')} *</label>
                  <input
                    type="text"
                    list="vaccine-protocol-datalist"
                    className="search-input si-7d984748"
                   
                    value={vaccForm.vaccineName}
                    onChange={e => handleVaccineProtocolSelect(e.target.value)}
                    required
                    placeholder={vaccineProtocols.length > 0 ? t('herdMedical.modal.vaccineNameSuggestPlaceholder') : t('herdMedical.modal.vaccineNamePlaceholder')}
                  />
                  <datalist id="vaccine-protocol-datalist">
                    {vaccineProtocols.map((p: any) => (
                      <option key={p.id} value={p.name}>{p.disease} ({p.vaccineCategory})</option>
                    ))}
                  </datalist>
                </div>
                <div className="si-6acd75e8"><label style={labelStyle}>{t('herdMedical.modal.vaccineType')}</label><input type="text" className="search-input si-7d984748" value={vaccForm.vaccineType} onChange={e => setVaccForm(f => ({ ...f, vaccineType: e.target.value }))} placeholder={t('herdMedical.modal.vaccineTypePlaceholder')} /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div className="si-6acd75e8"><label style={labelStyle}>{t('herdMedical.modal.dateAdministered')} *</label><input type="date" className="search-input si-7d984748" value={vaccForm.dateAdministered} onChange={e => setVaccForm(f => ({ ...f, dateAdministered: e.target.value }))} required /></div>
                <div className="si-6acd75e8"><label style={labelStyle}>{t('herdMedical.modal.nextDueDate')}</label><input type="date" className="search-input si-7d984748" value={vaccForm.nextDueDate} onChange={e => setVaccForm(f => ({ ...f, nextDueDate: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div className="si-6acd75e8"><label style={labelStyle}>{t('herdMedical.modal.batchNumber')}</label><input type="text" className="search-input si-7d984748" value={vaccForm.batchNumber} onChange={e => setVaccForm(f => ({ ...f, batchNumber: e.target.value }))} /></div>
                <div className="si-6acd75e8"><label style={labelStyle}>{t('herdMedical.modal.manufacturer')}</label><input type="text" className="search-input si-7d984748" value={vaccForm.manufacturer} onChange={e => setVaccForm(f => ({ ...f, manufacturer: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div className="si-6acd75e8"><label style={labelStyle}>{t('herdMedical.modal.dosage')}</label><input type="text" className="search-input si-7d984748" value={vaccForm.dosage} onChange={e => setVaccForm(f => ({ ...f, dosage: e.target.value }))} placeholder={t('herdMedical.modal.dosagePlaceholder')} /></div>
                <div className="si-6acd75e8"><label style={labelStyle}>{t('herdMedical.modal.certificateNumber')}</label><input type="text" className="search-input si-7d984748" value={vaccForm.certificateNumber} onChange={e => setVaccForm(f => ({ ...f, certificateNumber: e.target.value }))} /></div>
              </div>
              <div className="si-66181d73">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={modalSaving}>{modalSaving ? t('herdMedical.modal.saving') : t('herdMedical.modal.recordVaccination')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'add-allergy' && (
        <div style={modalOverlayStyle} onClick={() => setModal(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 className="si-d4411fdc">{t('herdMedical.modal.recordAllergy')}</h2>
            <form onSubmit={handleCreateAllergy}>
              <div style={fieldStyle}><label style={labelStyle}>{t('herdMedical.modal.animal')} *</label><AnimalSelect value={allergyForm.animalId} onChange={v => setAllergyForm(f => ({ ...f, animalId: v }))} required /></div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div className="si-6acd75e8"><label style={labelStyle}>{t('herdMedical.table.allergen')} *</label><input type="text" className="search-input si-7d984748" value={allergyForm.allergen} onChange={e => setAllergyForm(f => ({ ...f, allergen: e.target.value }))} required placeholder={t('herdMedical.modal.allergenPlaceholder')} /></div>
                <div className="si-6acd75e8"><label style={labelStyle}>{t('herdMedical.table.severity')}</label>
                  <select value={allergyForm.severity} onChange={e => setAllergyForm(f => ({ ...f, severity: e.target.value }))} className="search-input si-7d984748">
                    <option value="low">{t('herdMedical.severity.low')}</option><option value="normal">{t('herdMedical.severity.normal')}</option><option value="high">{t('herdMedical.severity.high')}</option><option value="critical">{t('herdMedical.severity.critical')}</option>
                  </select>
                </div>
              </div>
              <div style={fieldStyle}><label style={labelStyle}>{t('herdMedical.table.reaction')}</label><input type="text" className="search-input si-7d984748" value={allergyForm.reaction} onChange={e => setAllergyForm(f => ({ ...f, reaction: e.target.value }))} placeholder={t('herdMedical.modal.reactionPlaceholder')} /></div>
              <div style={fieldStyle}><label style={labelStyle}>{t('common.notes')}</label><textarea className="search-input si-51f96471" value={allergyForm.notes} onChange={e => setAllergyForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('herdMedical.modal.notesPlaceholder')} /></div>
              <div className="si-66181d73">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={modalSaving}>{modalSaving ? t('herdMedical.modal.saving') : t('herdMedical.modal.recordAllergy')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'add-lab' && (
        <div style={modalOverlayStyle} onClick={() => setModal(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 className="si-d4411fdc">{t('herdMedical.modal.addLabResult')}</h2>
            <form onSubmit={handleCreateLabResult}>
              <div style={fieldStyle}><label style={labelStyle}>{t('herdMedical.modal.animal')} *</label><AnimalSelect value={labForm.animalId} onChange={v => setLabForm(f => ({ ...f, animalId: v }))} required /></div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div className="si-6acd75e8"><label style={labelStyle}>{t('herdMedical.modal.testName')} *</label><input type="text" className="search-input si-7d984748" value={labForm.testName} onChange={e => setLabForm(f => ({ ...f, testName: e.target.value }))} required placeholder={t('herdMedical.modal.testNamePlaceholder')} /></div>
                <div className="si-6acd75e8"><label style={labelStyle}>{t('herdMedical.modal.testCategory')}</label><input type="text" className="search-input si-7d984748" value={labForm.testCategory} onChange={e => setLabForm(f => ({ ...f, testCategory: e.target.value }))} placeholder={t('herdMedical.modal.testCategoryPlaceholder')} /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div className="si-6acd75e8"><label style={labelStyle}>{t('herdMedical.modal.testDate')} *</label><input type="date" className="search-input si-7d984748" value={labForm.testDate} onChange={e => setLabForm(f => ({ ...f, testDate: e.target.value }))} required /></div>
                <div className="si-6acd75e8"><label style={labelStyle}>{t('herdMedical.modal.labName')}</label><input type="text" className="search-input si-7d984748" value={labForm.labName} onChange={e => setLabForm(f => ({ ...f, labName: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div className="si-6acd75e8"><label style={labelStyle}>{t('herdMedical.modal.resultValue')}</label><input type="text" className="search-input si-7d984748" value={labForm.resultValue} onChange={e => setLabForm(f => ({ ...f, resultValue: e.target.value }))} placeholder={t('herdMedical.modal.resultPlaceholder')} /></div>
                <div className="si-6acd75e8"><label style={labelStyle}>{t('herdMedical.modal.normalRange')}</label><input type="text" className="search-input si-7d984748" value={labForm.normalRange} onChange={e => setLabForm(f => ({ ...f, normalRange: e.target.value }))} placeholder={t('herdMedical.modal.normalRangePlaceholder')} /></div>
                <div className="si-e379d232"><label style={labelStyle}>{t('herdMedical.modal.unit')}</label><input type="text" className="search-input si-7d984748" value={labForm.unit} onChange={e => setLabForm(f => ({ ...f, unit: e.target.value }))} placeholder="mg/dL" /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div className="si-6acd75e8"><label style={labelStyle}>{t('common.status')}</label>
                  <select value={labForm.status} onChange={e => setLabForm(f => ({ ...f, status: e.target.value }))} className="search-input si-7d984748">
                    <option value="pending">{t('common.pending')}</option><option value="in_progress">{t('common.inProgress')}</option><option value="completed">{t('common.completed')}</option>
                  </select>
                </div>
                <div className="si-cd7f5466"><label style={labelStyle}>{t('herdMedical.modal.interpretation')}</label><input type="text" className="search-input si-7d984748" value={labForm.interpretation} onChange={e => setLabForm(f => ({ ...f, interpretation: e.target.value }))} placeholder={t('herdMedical.modal.interpretationPlaceholder')} /></div>
              </div>
              <div className="si-66181d73">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={modalSaving}>{modalSaving ? t('herdMedical.modal.saving') : t('herdMedical.modal.saveLabResult')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'view-record' && viewRecord && (
        <div style={modalOverlayStyle} onClick={() => setModal(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div className="si-b1549cde">
              <h2 className="si-d4411fdc">{RECORD_TYPE_ICONS[viewRecord.recordType] || ''} {t('herdMedical.modal.medicalRecord')}</h2>
              <span style={{ backgroundColor: SEVERITY_COLORS[viewRecord.severity] || '#6b7280', color: '#fff', padding: '4px 12px', borderRadius: '6px', fontSize: '0.85em', fontWeight: 600 }}>{viewRecord.severity}</span>
            </div>
            <div className="si-4edd7f5e">
              <div><strong className="si-46cf1b09">{t('herdMedical.modal.recordNumber')}</strong><br />{viewRecord.recordNumber || 'N/A'}</div>
              <div><strong className="si-46cf1b09">{t('common.status')}</strong><br />{viewRecord.status || 'active'}</div>
              <div><strong className="si-46cf1b09">{t('common.type')}</strong><br />{viewRecord.recordType?.replace(/_/g, ' ')}</div>
              <div><strong className="si-46cf1b09">{t('herdMedical.modal.created')}</strong><br />{fmtDate(viewRecord.createdAt)}</div>
              {viewRecord.followUpDate && <div><strong className="si-46cf1b09">{t('herdMedical.modal.followUp')}</strong><br />{fmtDate(viewRecord.followUpDate)}</div>}
            </div>
            <div className="si-d4411fdc">
              <strong className="si-c8844a87">{viewRecord.title}</strong>
              <div className="si-50865e53">{viewRecord.content}</div>
            </div>
            {viewRecord.medications && viewRecord.medications.length > 0 && (
              <div className="si-d4411fdc">
                <strong className="si-46cf1b09">{t('herdMedical.modal.medications')}</strong>
                <div className="si-1e849541">
                  {viewRecord.medications.map((m: any, i: number) => (
                    <span key={i} className="si-3024e94b">{m.name || m}</span>
                  ))}
                </div>
              </div>
            )}
            {viewRecord.tags && viewRecord.tags.length > 0 && (
              <div className="si-d4411fdc">
                <strong className="si-46cf1b09">{t('herdMedical.modal.tags')}</strong>
                <div className="si-1e849541">
                  {viewRecord.tags.map((tag: string, i: number) => (
                    <span key={i} className="si-37556a30">{tag}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="si-66181d73">
              {canManage && <button className="btn btn-secondary si-f84f41a5" onClick={() => { handleDeleteRecord(viewRecord.id); setModal(null) }}>{t('herdMedical.records.archive')}</button>}
              <button className="btn btn-primary" onClick={() => setModal(null)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  // Role info banner
  const renderRoleInfo = () => {
    // Emoji, not a word. These were the strings 'Admin'/'Vet'/'Farmer'/'Owner' rendered as
    // "[icon] label", which read as "[Farmer] Farmer" for a farmer and was redundant for every
    // other role too ("[Vet] Veterinarian"). Icons match the role icons used at registration.
    const roleInfo: Record<string, { icon: string; label: string; perms: string }> = {
      admin: { icon: '🛡️', label: t('herdMedical.role.admin'), perms: t('herdMedical.role.adminPerms') },
      veterinarian: { icon: '👨‍⚕️', label: t('herdMedical.role.vet'), perms: t('herdMedical.role.vetPerms') },
      farmer: { icon: '🐄', label: t('herdMedical.role.farmer'), perms: t('herdMedical.role.farmerPerms') },
      pet_owner: { icon: '🐕', label: t('herdMedical.role.petOwner'), perms: t('herdMedical.role.petOwnerPerms') },
    }
    const info = roleInfo[role] || roleInfo['pet_owner']
    return (
      <div className="si-c59d9a8b">
        <span className="si-655cbeba" aria-hidden="true">{info?.icon}</span>
        <div><strong>{info?.label}</strong> - {info?.perms}</div>
      </div>
    )
  }

  // MAIN RENDER
  return (
    <div className="module-page">
      <div className="module-header">
        <h1>{t('herdMedical.pageTitle')}</h1>
        <p>{t('herdMedical.pageDescription')}</p>
      </div>

      {renderRoleInfo()}

      {error && <div className="alert alert-error si-a70422fe">{error} <button onClick={() => setError('')} className="si-25c04def">X</button></div>}
      {success && <div className="alert alert-success si-a70422fe">{success} <button onClick={() => setSuccess('')} className="si-f49fa7f1">X</button></div>}

      <div className="enterprise-selector">
        <label>{t('herdMedical.selectEnterprise')}:</label>
        <select value={selectedEnterpriseId} onChange={e => { setSelectedEnterpriseId(e.target.value); setPage(0); setTab('overview') }}>
          <option value="">{t('herdMedical.selectEnterpriseOption')}</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
        {selectedEnterpriseId && <span className="si-d29aa743">{t('herdMedical.enterpriseContext', { animals: animals.length, groups: groups.length })}</span>}
      </div>

      {!selectedEnterpriseId ? (
        <div className="empty-state">{t('herdMedical.selectEnterprisePrompt')}</div>
      ) : loading ? (
        <div className="loading-spinner">{t('herdMedical.loading')}</div>
      ) : (
        <>
          <div className="tab-bar">
            <button className={tab === 'overview' ? 'tab-active' : ''} onClick={() => setTab('overview')}>{t('herdMedical.tabs.overview')}</button>
            <button className={tab === 'records' ? 'tab-active' : ''} onClick={() => setTab('records')}>{t('herdMedical.tabs.records')} ({recordsTotal})</button>
            <button className={tab === 'vaccinations' ? 'tab-active' : ''} onClick={() => setTab('vaccinations')}>{t('herdMedical.tabs.vaccinations')} ({vaccinationsTotal})</button>
            <button className={tab === 'allergies' ? 'tab-active' : ''} onClick={() => setTab('allergies')}>{t('herdMedical.tabs.allergies')} ({allergies.length})</button>
            <button className={tab === 'lab_results' ? 'tab-active' : ''} onClick={() => setTab('lab_results')}>{t('herdMedical.tabs.labResults')} ({labResults.length})</button>
          </div>

          {tab === 'overview' && renderOverview()}
          {tab === 'records' && renderRecords()}
          {tab === 'vaccinations' && renderVaccinations()}
          {tab === 'allergies' && renderAllergies()}
          {tab === 'lab_results' && renderLabResults()}
        </>
      )}

      {renderModals()}
    </div>
  )
}

export default HerdMedicalManagement
