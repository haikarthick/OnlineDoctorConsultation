import React, { useState, useEffect, useCallback } from 'react'
import apiService from '../services/api'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import './ModulePage.css'

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
  const { formatDate } = useSettings()
  const { user } = useAuth()
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

  // Form states
  const [recordForm, setRecordForm] = useState({ animalId: '', recordType: 'diagnosis', title: '', content: '', severity: 'normal', followUpDate: '', medications: '' })
  const [vaccForm, setVaccForm] = useState({ animalId: '', vaccineName: '', vaccineType: '', dateAdministered: new Date().toISOString().slice(0, 10), nextDueDate: '', batchNumber: '', manufacturer: '', dosage: '', certificateNumber: '' })
  const [allergyForm, setAllergyForm] = useState({ animalId: '', allergen: '', reaction: '', severity: 'normal', notes: '' })
  const [labForm, setLabForm] = useState({ animalId: '', testName: '', testDate: new Date().toISOString().slice(0, 10), testCategory: '', resultValue: '', normalRange: '', unit: '', status: 'pending', interpretation: '', labName: '', notes: '' })

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
    if (!recordForm.animalId || !recordForm.title || !recordForm.content) { setError('Animal, title, and content are required'); return }
    setModalSaving(true); clearMessages()
    try {
      const medsArray = recordForm.medications ? recordForm.medications.split(',').map(m => ({ name: m.trim() })) : undefined
      await apiService.createMedicalRecord({
        animalId: recordForm.animalId, recordType: recordForm.recordType, title: recordForm.title,
        content: recordForm.content, severity: recordForm.severity,
        followUpDate: recordForm.followUpDate || undefined, medications: medsArray,
        veterinarianId: isVet ? user?.id : undefined,
      })
      setSuccess('Medical record created successfully'); setModal(null)
      setRecordForm({ animalId: '', recordType: 'diagnosis', title: '', content: '', severity: 'normal', followUpDate: '', medications: '' })
      loadRecords(); loadStats()
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed to create record') }
    finally { setModalSaving(false) }
  }

  const handleCreateVaccination = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vaccForm.animalId || !vaccForm.vaccineName || !vaccForm.dateAdministered) { setError('Animal, vaccine name, and date are required'); return }
    setModalSaving(true); clearMessages()
    try {
      await apiService.createVaccination({
        animalId: vaccForm.animalId, vaccineName: vaccForm.vaccineName,
        vaccineType: vaccForm.vaccineType || undefined, dateAdministered: vaccForm.dateAdministered,
        nextDueDate: vaccForm.nextDueDate || undefined, batchNumber: vaccForm.batchNumber || undefined,
        manufacturer: vaccForm.manufacturer || undefined, dosage: vaccForm.dosage || undefined,
        certificateNumber: vaccForm.certificateNumber || undefined,
      })
      setSuccess('Vaccination recorded successfully'); setModal(null)
      setVaccForm({ animalId: '', vaccineName: '', vaccineType: '', dateAdministered: new Date().toISOString().slice(0, 10), nextDueDate: '', batchNumber: '', manufacturer: '', dosage: '', certificateNumber: '' })
      loadVaccinations(); loadStats()
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed to record vaccination') }
    finally { setModalSaving(false) }
  }

  const handleCreateAllergy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!allergyForm.animalId || !allergyForm.allergen) { setError('Animal and allergen are required'); return }
    setModalSaving(true); clearMessages()
    try {
      await apiService.createAllergy({
        animalId: allergyForm.animalId, allergen: allergyForm.allergen,
        reaction: allergyForm.reaction || undefined, severity: allergyForm.severity || undefined,
        notes: allergyForm.notes || undefined,
      })
      setSuccess('Allergy recorded successfully'); setModal(null)
      setAllergyForm({ animalId: '', allergen: '', reaction: '', severity: 'normal', notes: '' })
      loadAllergies(); loadStats()
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed to record allergy') }
    finally { setModalSaving(false) }
  }

  const handleCreateLabResult = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!labForm.animalId || !labForm.testName || !labForm.testDate) { setError('Animal, test name, and date are required'); return }
    setModalSaving(true); clearMessages()
    try {
      await apiService.createLabResult({
        animalId: labForm.animalId, testName: labForm.testName, testDate: labForm.testDate,
        testCategory: labForm.testCategory || undefined, resultValue: labForm.resultValue || undefined,
        normalRange: labForm.normalRange || undefined, unit: labForm.unit || undefined,
        status: labForm.status as any || 'pending', interpretation: labForm.interpretation || undefined,
        labName: labForm.labName || undefined, notes: labForm.notes || undefined,
      })
      setSuccess('Lab result recorded successfully'); setModal(null)
      setLabForm({ animalId: '', testName: '', testDate: new Date().toISOString().slice(0, 10), testCategory: '', resultValue: '', normalRange: '', unit: '', status: 'pending', interpretation: '', labName: '', notes: '' })
      loadLabResults(); loadStats()
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed to record lab result') }
    finally { setModalSaving(false) }
  }

  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm('Archive this medical record?')) return
    clearMessages()
    try { await apiService.deleteMedicalRecord(id); setSuccess('Record archived'); loadRecords(); loadStats() }
    catch (err: any) { setError(err.response?.data?.error?.message || 'Failed to archive') }
  }

  const handleViewRecord = async (id: string) => {
    try { const res = await apiService.getMedicalRecord(id); setViewRecord(res.data || null); setModal('view-record') }
    catch { setError('Failed to load record details') }
  }

  const handleUpdateLabStatus = async (id: string, status: string) => {
    clearMessages()
    try { await apiService.updateLabResult(id, { status }); setSuccess('Lab result updated'); loadLabResults() }
    catch (err: any) { setError(err.response?.data?.error?.message || 'Failed to update') }
  }

  // Animal Select component
  const AnimalSelect = ({ value, onChange, required }: { value: string; onChange: (v: string) => void; required?: boolean }) => (
    <select value={value} onChange={e => onChange(e.target.value)} className="search-input" required={required} style={{ width: '100%' }}>
      <option value="">-- Select Animal --</option>
      {animals.map(a => (
        <option key={a.id} value={a.id}>
          {a.name} ({a.species}{a.breed ? ' - ' + a.breed : ''}{a.groupName ? ' | ' + a.groupName : ''})
        </option>
      ))}
    </select>
  )

  const GroupFilterSelect = () => (
    <select value={groupFilter} onChange={e => { setGroupFilter(e.target.value); setPage(0) }} className="search-input" style={{ maxWidth: '220px' }}>
      <option value="">All Groups</option>
      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
    </select>
  )

  // OVERVIEW TAB
  const renderOverview = () => {
    if (!stats) return <div className="empty-state">No statistics available yet. Add animals and records to see health data.</div>
    return (
      <div>
        <div className="dashboard-grid">
          <div className="stat-card"><div className="stat-icon">&#x1F404;</div><div className="stat-value">{stats.activeAnimals || 0}</div><div className="stat-label">Active Animals</div></div>
          <div className="stat-card"><div className="stat-icon">&#x1F4CB;</div><div className="stat-value">{stats.totalRecords || 0}</div><div className="stat-label">Medical Records</div></div>
          <div className="stat-card"><div className="stat-icon">&#x1F489;</div><div className="stat-value">{stats.vaccinations?.total || 0}</div><div className="stat-label">Vaccinations</div></div>
          <div className="stat-card" style={{ borderColor: (stats.vaccinations?.overdue || 0) > 0 ? '#dc2626' : undefined }}>
            <div className="stat-icon">&#x26A0;&#xFE0F;</div>
            <div className="stat-value" style={{ color: (stats.vaccinations?.overdue || 0) > 0 ? '#dc2626' : undefined }}>{stats.vaccinations?.overdue || 0}</div>
            <div className="stat-label">Overdue Vaccinations</div>
          </div>
          <div className="stat-card"><div className="stat-icon">&#x1F52C;</div><div className="stat-value">{stats.labResults?.pending || 0}</div><div className="stat-label">Pending Lab Results</div></div>
          <div className="stat-card"><div className="stat-icon">&#x1F927;</div><div className="stat-value">{stats.allergies?.active || 0}</div><div className="stat-label">Active Allergies</div></div>
          <div className="stat-card"><div className="stat-icon">&#x1F4C5;</div><div className="stat-value">{stats.upcomingFollowUps || 0}</div><div className="stat-label">Follow-ups (7 days)</div></div>
          <div className="stat-card"><div className="stat-icon">&#x1F4CA;</div><div className="stat-value">{stats.vaccinations?.upcomingDue || 0}</div><div className="stat-label">Vaccinations Due (30d)</div></div>
        </div>

        {canCreate && (
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ marginBottom: '12px' }}>Quick Actions</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => { setRecordForm(f => ({ ...f, animalId: '' })); setModal('add-record') }}>+ Add Medical Record</button>
              <button className="btn btn-primary" onClick={() => { setVaccForm(f => ({ ...f, animalId: '' })); setModal('add-vaccination') }}>+ Record Vaccination</button>
              <button className="btn btn-primary" onClick={() => { setAllergyForm(f => ({ ...f, animalId: '' })); setModal('add-allergy') }}>+ Record Allergy</button>
              <button className="btn btn-primary" onClick={() => { setLabForm(f => ({ ...f, animalId: '' })); setModal('add-lab') }}>+ Add Lab Result</button>
            </div>
          </div>
        )}

        {stats.recordsByType && Object.keys(stats.recordsByType).length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ marginBottom: '12px' }}>Records by Type</h3>
            <div className="dashboard-grid">
              {Object.entries(stats.recordsByType).map(([type, count]: any) => (
                <div key={type} className="stat-card" style={{ cursor: 'pointer' }} onClick={() => { setRecordTypeFilter(type); setTab('records') }}>
                  <div className="stat-icon">{RECORD_TYPE_ICONS[type] || '&#x1F4CB;'}</div>
                  <div className="stat-value">{count}</div>
                  <div className="stat-label">{type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.groupHealth && stats.groupHealth.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ marginBottom: '12px' }}>Herd / Group Health</h3>
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>Group</th><th>Type</th><th>Animals</th><th>Records</th><th>Overdue Vaccinations</th></tr></thead>
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
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ marginBottom: '12px' }}>Recent Medical Records</h3>
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Animal</th><th>Type</th><th>Title</th><th>Severity</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {stats.recentRecords.map((r: any) => (
                    <tr key={r.id}>
                      <td>{fmtDate(r.createdAt)}</td>
                      <td>{r.animalName} ({r.animalSpecies})</td>
                      <td>{RECORD_TYPE_ICONS[r.recordType] || ''} {r.recordType?.replace(/_/g, ' ')}</td>
                      <td>{r.title}</td>
                      <td><span style={{ backgroundColor: SEVERITY_COLORS[r.severity] || '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8em' }}>{r.severity}</span></td>
                      <td>{r.status}</td>
                      <td><button className="btn btn-secondary" style={{ fontSize: '0.8em', padding: '2px 8px' }} onClick={() => handleViewRecord(r.id)}>View</button></td>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
          <input type="text" placeholder="Search records..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(0) }} className="search-input" style={{ flex: 1, minWidth: '200px' }} />
          <select value={recordTypeFilter} onChange={e => { setRecordTypeFilter(e.target.value); setPage(0) }} className="search-input" style={{ maxWidth: '170px' }}>
            <option value="">All Types</option>{RECORD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); setPage(0) }} className="search-input" style={{ maxWidth: '150px' }}>
            <option value="">All Severities</option><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option>
          </select>
          <GroupFilterSelect />
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => { setRecordForm({ animalId: '', recordType: 'diagnosis', title: '', content: '', severity: 'normal', followUpDate: '', medications: '' }); setModal('add-record') }}>
            + Add Record
          </button>
        )}
      </div>
      {records.length === 0 ? (
        <div className="empty-state">{animals.length === 0 ? 'No animals registered in this enterprise yet.' : 'No medical records found matching your filters.'}</div>
      ) : (
        <>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Animal</th><th>Group</th><th>Type</th><th>Title</th><th>Severity</th><th>Status</th><th>Vet</th><th>Actions</th></tr></thead>
              <tbody>
                {records.map((r: any) => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.createdAt)}</td>
                    <td><strong>{r.animalName}</strong><br /><small style={{ color: '#666' }}>{r.animalSpecies}{r.animalBreed ? ' - ' + r.animalBreed : ''}</small></td>
                    <td>{r.groupName || '-'}</td>
                    <td>{RECORD_TYPE_ICONS[r.recordType] || ''} {r.recordType?.replace(/_/g, ' ')}</td>
                    <td>{r.title}</td>
                    <td><span style={{ backgroundColor: SEVERITY_COLORS[r.severity] || '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8em' }}>{r.severity}</span></td>
                    <td>{r.status}</td>
                    <td>{r.veterinarianName || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-secondary" style={{ fontSize: '0.8em', padding: '2px 8px', marginRight: '4px' }} onClick={() => handleViewRecord(r.id)}>View</button>
                      {canManage && <button className="btn btn-secondary" style={{ fontSize: '0.8em', padding: '2px 8px', color: '#dc2626' }} onClick={() => handleDeleteRecord(r.id)}>Archive</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <span style={{ color: '#666', fontSize: '0.9em' }}>Showing {page * 20 + 1} - {Math.min((page + 1) * 20, recordsTotal)} of {recordsTotal}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
              <button className="btn btn-secondary" disabled={(page + 1) * 20 >= recordsTotal} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  )

  // VACCINATIONS TAB
  const renderVaccinations = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select value={vaccFilter} onChange={e => setVaccFilter(e.target.value as any)} className="search-input" style={{ maxWidth: '200px' }}>
            <option value="all">All Vaccinations</option><option value="overdue">Overdue Only</option><option value="upcoming">Upcoming (30 days)</option>
          </select>
          <GroupFilterSelect />
          <span style={{ color: '#666', fontSize: '0.9em' }}>{vaccinationsTotal} total</span>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => { setVaccForm({ animalId: '', vaccineName: '', vaccineType: '', dateAdministered: new Date().toISOString().slice(0, 10), nextDueDate: '', batchNumber: '', manufacturer: '', dosage: '', certificateNumber: '' }); setModal('add-vaccination') }}>
            + Record Vaccination
          </button>
        )}
      </div>
      {vaccinations.length === 0 ? (
        <div className="empty-state">{animals.length === 0 ? 'No animals registered yet.' : 'No vaccination records found.'}</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Animal</th><th>Group</th><th>Vaccine</th><th>Type</th><th>Dosage</th><th>Administered</th><th>Next Due</th><th>Status</th></tr></thead>
            <tbody>
              {vaccinations.map((v: any) => (
                <tr key={v.id}>
                  <td><strong>{v.animalName}</strong><br /><small style={{ color: '#666' }}>{v.animalSpecies}</small></td>
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
                      {v.dueStatus === 'overdue' ? 'Overdue' : v.dueStatus === 'upcoming' ? 'Due Soon' : 'Current'}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ color: '#666' }}>{allergies.length} allergy record(s) across enterprise animals</span>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => { setAllergyForm({ animalId: '', allergen: '', reaction: '', severity: 'normal', notes: '' }); setModal('add-allergy') }}>
            + Record Allergy
          </button>
        )}
      </div>
      {allergies.length === 0 ? (
        <div className="empty-state">{animals.length === 0 ? 'No animals registered yet.' : 'No allergy records found.'}</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Animal</th><th>Allergen</th><th>Reaction</th><th>Severity</th><th>Active</th><th>Identified</th></tr></thead>
            <tbody>
              {allergies.map((a: any, i: number) => (
                <tr key={a.id || i}>
                  <td><strong>{a.animalName}</strong> ({a.animalSpecies})</td>
                  <td><strong>{a.allergen}</strong></td>
                  <td>{a.reaction || '-'}</td>
                  <td><span style={{ backgroundColor: SEVERITY_COLORS[a.severity] || '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8em' }}>{a.severity || 'normal'}</span></td>
                  <td>{a.isActive === false ? 'Inactive' : 'Active'}</td>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ color: '#666' }}>{labResults.length} lab result(s) across enterprise animals</span>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => { setLabForm({ animalId: '', testName: '', testDate: new Date().toISOString().slice(0, 10), testCategory: '', resultValue: '', normalRange: '', unit: '', status: 'pending', interpretation: '', labName: '', notes: '' }); setModal('add-lab') }}>
            + Add Lab Result
          </button>
        )}
      </div>
      {labResults.length === 0 ? (
        <div className="empty-state">{animals.length === 0 ? 'No animals registered yet.' : 'No lab results found.'}</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Animal</th><th>Test</th><th>Category</th><th>Result</th><th>Normal Range</th><th>Status</th>{canManage && <th>Actions</th>}</tr></thead>
            <tbody>
              {labResults.map((l: any, i: number) => (
                <tr key={l.id || i}>
                  <td>{fmtDate(l.testDate || l.createdAt)}</td>
                  <td><strong>{l.animalName}</strong> ({l.animalSpecies})</td>
                  <td><strong>{l.testName}</strong></td>
                  <td>{l.testCategory || '-'}</td>
                  <td style={{ color: l.isAbnormal ? '#dc2626' : undefined, fontWeight: l.isAbnormal ? 600 : undefined }}>{l.resultValue || 'Pending'} {l.unit || ''}</td>
                  <td>{l.normalRange || '-'}</td>
                  <td>
                    <span style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '0.8em', fontWeight: 600,
                      backgroundColor: l.status === 'completed' ? '#f0fdf4' : l.status === 'pending' ? '#fffbeb' : '#f0f4ff',
                      color: l.status === 'completed' ? '#059669' : l.status === 'pending' ? '#d97706' : '#667eea',
                    }}>{l.status || 'pending'}</span>
                  </td>
                  {canManage && (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {l.status === 'pending' && <button className="btn btn-secondary" style={{ fontSize: '0.8em', padding: '2px 8px' }} onClick={() => handleUpdateLabStatus(l.id, 'completed')}>Complete</button>}
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
            <h2 style={{ marginBottom: '16px' }}>Add Medical Record</h2>
            <p style={{ color: '#666', fontSize: '0.9em', marginBottom: '16px' }}>
              {isVet ? 'Creating record as veterinarian - you will be recorded as the attending vet.' : isAdmin ? 'Creating record as admin.' : 'Creating record for your enterprise animal.'}
            </p>
            <form onSubmit={handleCreateRecord}>
              <div style={fieldStyle}><label style={labelStyle}>Animal *</label><AnimalSelect value={recordForm.animalId} onChange={v => setRecordForm(f => ({ ...f, animalId: v }))} required /></div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div style={{ flex: 1 }}><label style={labelStyle}>Record Type *</label>
                  <select value={recordForm.recordType} onChange={e => setRecordForm(f => ({ ...f, recordType: e.target.value }))} className="search-input" style={{ width: '100%' }}>
                    {RECORD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Severity</label>
                  <select value={recordForm.severity} onChange={e => setRecordForm(f => ({ ...f, severity: e.target.value }))} className="search-input" style={{ width: '100%' }}>
                    <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div style={fieldStyle}><label style={labelStyle}>Title *</label><input type="text" className="search-input" style={{ width: '100%' }} value={recordForm.title} onChange={e => setRecordForm(f => ({ ...f, title: e.target.value }))} required placeholder="Brief description of the condition" /></div>
              <div style={fieldStyle}><label style={labelStyle}>Content / Notes *</label><textarea className="search-input" style={{ width: '100%', minHeight: '100px', fontFamily: 'inherit' }} value={recordForm.content} onChange={e => setRecordForm(f => ({ ...f, content: e.target.value }))} required placeholder="Detailed notes, observations, diagnosis..." /></div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div style={{ flex: 1 }}><label style={labelStyle}>Medications (comma-separated)</label><input type="text" className="search-input" style={{ width: '100%' }} value={recordForm.medications} onChange={e => setRecordForm(f => ({ ...f, medications: e.target.value }))} placeholder="e.g. Amoxicillin, Ibuprofen" /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Follow-up Date</label><input type="date" className="search-input" style={{ width: '100%' }} value={recordForm.followUpDate} onChange={e => setRecordForm(f => ({ ...f, followUpDate: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={modalSaving}>{modalSaving ? 'Saving...' : 'Create Record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'add-vaccination' && (
        <div style={modalOverlayStyle} onClick={() => setModal(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '16px' }}>Record Vaccination</h2>
            <p style={{ color: '#666', fontSize: '0.9em', marginBottom: '16px' }}>Administering or recording a vaccine for an enterprise animal.</p>
            <form onSubmit={handleCreateVaccination}>
              <div style={fieldStyle}><label style={labelStyle}>Animal *</label><AnimalSelect value={vaccForm.animalId} onChange={v => setVaccForm(f => ({ ...f, animalId: v }))} required /></div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div style={{ flex: 1 }}><label style={labelStyle}>Vaccine Name *</label><input type="text" className="search-input" style={{ width: '100%' }} value={vaccForm.vaccineName} onChange={e => setVaccForm(f => ({ ...f, vaccineName: e.target.value }))} required placeholder="e.g. Rabies, FMD, BVD" /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Vaccine Type</label><input type="text" className="search-input" style={{ width: '100%' }} value={vaccForm.vaccineType} onChange={e => setVaccForm(f => ({ ...f, vaccineType: e.target.value }))} placeholder="e.g. Live, Inactivated" /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div style={{ flex: 1 }}><label style={labelStyle}>Date Administered *</label><input type="date" className="search-input" style={{ width: '100%' }} value={vaccForm.dateAdministered} onChange={e => setVaccForm(f => ({ ...f, dateAdministered: e.target.value }))} required /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Next Due Date</label><input type="date" className="search-input" style={{ width: '100%' }} value={vaccForm.nextDueDate} onChange={e => setVaccForm(f => ({ ...f, nextDueDate: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div style={{ flex: 1 }}><label style={labelStyle}>Batch Number</label><input type="text" className="search-input" style={{ width: '100%' }} value={vaccForm.batchNumber} onChange={e => setVaccForm(f => ({ ...f, batchNumber: e.target.value }))} /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Manufacturer</label><input type="text" className="search-input" style={{ width: '100%' }} value={vaccForm.manufacturer} onChange={e => setVaccForm(f => ({ ...f, manufacturer: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div style={{ flex: 1 }}><label style={labelStyle}>Dosage</label><input type="text" className="search-input" style={{ width: '100%' }} value={vaccForm.dosage} onChange={e => setVaccForm(f => ({ ...f, dosage: e.target.value }))} placeholder="e.g. 2ml" /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Certificate Number</label><input type="text" className="search-input" style={{ width: '100%' }} value={vaccForm.certificateNumber} onChange={e => setVaccForm(f => ({ ...f, certificateNumber: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={modalSaving}>{modalSaving ? 'Saving...' : 'Record Vaccination'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'add-allergy' && (
        <div style={modalOverlayStyle} onClick={() => setModal(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '16px' }}>Record Allergy</h2>
            <form onSubmit={handleCreateAllergy}>
              <div style={fieldStyle}><label style={labelStyle}>Animal *</label><AnimalSelect value={allergyForm.animalId} onChange={v => setAllergyForm(f => ({ ...f, animalId: v }))} required /></div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div style={{ flex: 1 }}><label style={labelStyle}>Allergen *</label><input type="text" className="search-input" style={{ width: '100%' }} value={allergyForm.allergen} onChange={e => setAllergyForm(f => ({ ...f, allergen: e.target.value }))} required placeholder="e.g. Penicillin, Dust, Pollen" /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Severity</label>
                  <select value={allergyForm.severity} onChange={e => setAllergyForm(f => ({ ...f, severity: e.target.value }))} className="search-input" style={{ width: '100%' }}>
                    <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div style={fieldStyle}><label style={labelStyle}>Reaction</label><input type="text" className="search-input" style={{ width: '100%' }} value={allergyForm.reaction} onChange={e => setAllergyForm(f => ({ ...f, reaction: e.target.value }))} placeholder="e.g. Skin rash, Swelling, Anaphylaxis" /></div>
              <div style={fieldStyle}><label style={labelStyle}>Notes</label><textarea className="search-input" style={{ width: '100%', minHeight: '60px', fontFamily: 'inherit' }} value={allergyForm.notes} onChange={e => setAllergyForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." /></div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={modalSaving}>{modalSaving ? 'Saving...' : 'Record Allergy'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'add-lab' && (
        <div style={modalOverlayStyle} onClick={() => setModal(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '16px' }}>Add Lab Result</h2>
            <form onSubmit={handleCreateLabResult}>
              <div style={fieldStyle}><label style={labelStyle}>Animal *</label><AnimalSelect value={labForm.animalId} onChange={v => setLabForm(f => ({ ...f, animalId: v }))} required /></div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div style={{ flex: 1 }}><label style={labelStyle}>Test Name *</label><input type="text" className="search-input" style={{ width: '100%' }} value={labForm.testName} onChange={e => setLabForm(f => ({ ...f, testName: e.target.value }))} required placeholder="e.g. CBC, Blood Chemistry" /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Test Category</label><input type="text" className="search-input" style={{ width: '100%' }} value={labForm.testCategory} onChange={e => setLabForm(f => ({ ...f, testCategory: e.target.value }))} placeholder="e.g. Hematology, Biochemistry" /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div style={{ flex: 1 }}><label style={labelStyle}>Test Date *</label><input type="date" className="search-input" style={{ width: '100%' }} value={labForm.testDate} onChange={e => setLabForm(f => ({ ...f, testDate: e.target.value }))} required /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Lab Name</label><input type="text" className="search-input" style={{ width: '100%' }} value={labForm.labName} onChange={e => setLabForm(f => ({ ...f, labName: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div style={{ flex: 1 }}><label style={labelStyle}>Result Value</label><input type="text" className="search-input" style={{ width: '100%' }} value={labForm.resultValue} onChange={e => setLabForm(f => ({ ...f, resultValue: e.target.value }))} placeholder="Leave empty if pending" /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Normal Range</label><input type="text" className="search-input" style={{ width: '100%' }} value={labForm.normalRange} onChange={e => setLabForm(f => ({ ...f, normalRange: e.target.value }))} placeholder="e.g. 5.0 - 10.0" /></div>
                <div style={{ maxWidth: '80px' }}><label style={labelStyle}>Unit</label><input type="text" className="search-input" style={{ width: '100%' }} value={labForm.unit} onChange={e => setLabForm(f => ({ ...f, unit: e.target.value }))} placeholder="mg/dL" /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
                <div style={{ flex: 1 }}><label style={labelStyle}>Status</label>
                  <select value={labForm.status} onChange={e => setLabForm(f => ({ ...f, status: e.target.value }))} className="search-input" style={{ width: '100%' }}>
                    <option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
                  </select>
                </div>
                <div style={{ flex: 2 }}><label style={labelStyle}>Interpretation</label><input type="text" className="search-input" style={{ width: '100%' }} value={labForm.interpretation} onChange={e => setLabForm(f => ({ ...f, interpretation: e.target.value }))} placeholder="Vet interpretation of results" /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={modalSaving}>{modalSaving ? 'Saving...' : 'Save Lab Result'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'view-record' && viewRecord && (
        <div style={modalOverlayStyle} onClick={() => setModal(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h2 style={{ marginBottom: '16px' }}>{RECORD_TYPE_ICONS[viewRecord.recordType] || ''} Medical Record</h2>
              <span style={{ backgroundColor: SEVERITY_COLORS[viewRecord.severity] || '#6b7280', color: '#fff', padding: '4px 12px', borderRadius: '6px', fontSize: '0.85em', fontWeight: 600 }}>{viewRecord.severity}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div><strong style={{ color: '#666', fontSize: '0.85em' }}>Record #</strong><br />{viewRecord.recordNumber || 'N/A'}</div>
              <div><strong style={{ color: '#666', fontSize: '0.85em' }}>Status</strong><br />{viewRecord.status || 'active'}</div>
              <div><strong style={{ color: '#666', fontSize: '0.85em' }}>Type</strong><br />{viewRecord.recordType?.replace(/_/g, ' ')}</div>
              <div><strong style={{ color: '#666', fontSize: '0.85em' }}>Created</strong><br />{fmtDate(viewRecord.createdAt)}</div>
              {viewRecord.followUpDate && <div><strong style={{ color: '#666', fontSize: '0.85em' }}>Follow-up</strong><br />{fmtDate(viewRecord.followUpDate)}</div>}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <strong style={{ fontSize: '1.1em' }}>{viewRecord.title}</strong>
              <div style={{ marginTop: '8px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{viewRecord.content}</div>
            </div>
            {viewRecord.medications && viewRecord.medications.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <strong style={{ color: '#666', fontSize: '0.85em' }}>Medications</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                  {viewRecord.medications.map((m: any, i: number) => (
                    <span key={i} style={{ background: '#ede9fe', color: '#5b21b6', padding: '2px 10px', borderRadius: '12px', fontSize: '0.85em' }}>{m.name || m}</span>
                  ))}
                </div>
              </div>
            )}
            {viewRecord.tags && viewRecord.tags.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <strong style={{ color: '#666', fontSize: '0.85em' }}>Tags</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                  {viewRecord.tags.map((t: string, i: number) => (
                    <span key={i} style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 10px', borderRadius: '12px', fontSize: '0.85em' }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              {canManage && <button className="btn btn-secondary" style={{ color: '#dc2626' }} onClick={() => { handleDeleteRecord(viewRecord.id); setModal(null) }}>Archive</button>}
              <button className="btn btn-primary" onClick={() => setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  // Role info banner
  const renderRoleInfo = () => {
    const roleInfo: Record<string, { icon: string; label: string; perms: string }> = {
      admin: { icon: 'Admin', label: 'Administrator', perms: 'Full access: view, create, update, and archive all medical records, vaccinations, allergies, and lab results.' },
      veterinarian: { icon: 'Vet', label: 'Veterinarian', perms: 'Clinical access: create diagnoses, prescriptions, and records. Manage vaccinations and lab results. Records auto-tag you as attending vet.' },
      farmer: { icon: 'Farmer', label: 'Farmer / Owner', perms: 'Owner access: view all herd health data. Create records, log vaccinations, and report allergies for your enterprise animals.' },
      pet_owner: { icon: 'Owner', label: 'Pet Owner', perms: 'View-only access for enterprise records. Create records for your own animals.' },
    }
    const info = roleInfo[role] || roleInfo['pet_owner']
    return (
      <div style={{ backgroundColor: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9em' }}>
        <span style={{ fontSize: '1.1em', fontWeight: 700 }}>[{info?.icon}]</span>
        <div><strong>{info?.label}</strong> - {info?.perms}</div>
      </div>
    )
  }

  // MAIN RENDER
  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Herd Medical Management</h1>
        <p>Enterprise-wide medical records, vaccination tracking, allergy management, and lab results across all herds and animal groups</p>
      </div>

      {renderRoleInfo()}

      {error && <div className="alert alert-error" style={{ marginBottom: '12px' }}>{error} <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>X</button></div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '12px' }}>{success} <button onClick={() => setSuccess('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>X</button></div>}

      <div className="enterprise-selector">
        <label>Select Enterprise:</label>
        <select value={selectedEnterpriseId} onChange={e => { setSelectedEnterpriseId(e.target.value); setPage(0); setTab('overview') }}>
          <option value="">-- Select Enterprise --</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
        {selectedEnterpriseId && <span style={{ marginLeft: '16px', color: '#666', fontSize: '0.9em' }}>{animals.length} animals | {groups.length} groups</span>}
      </div>

      {!selectedEnterpriseId ? (
        <div className="empty-state">Select an enterprise to manage herd medical records</div>
      ) : loading ? (
        <div className="loading-spinner">Loading medical data...</div>
      ) : (
        <>
          <div className="tab-bar">
            <button className={tab === 'overview' ? 'tab-active' : ''} onClick={() => setTab('overview')}>Overview</button>
            <button className={tab === 'records' ? 'tab-active' : ''} onClick={() => setTab('records')}>Records ({recordsTotal})</button>
            <button className={tab === 'vaccinations' ? 'tab-active' : ''} onClick={() => setTab('vaccinations')}>Vaccinations ({vaccinationsTotal})</button>
            <button className={tab === 'allergies' ? 'tab-active' : ''} onClick={() => setTab('allergies')}>Allergies ({allergies.length})</button>
            <button className={tab === 'lab_results' ? 'tab-active' : ''} onClick={() => setTab('lab_results')}>Lab Results ({labResults.length})</button>
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
