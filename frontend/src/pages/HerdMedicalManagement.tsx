import React, { useState, useEffect, useCallback } from 'react'
import apiService from '../services/api'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import './ModulePage.css'
import { useTranslation } from 'react-i18next'
import { useMasterData } from '../context/MasterDataContext'
import OverviewTab from '../components/herdMedical/OverviewTab'
import RecordsTab from '../components/herdMedical/RecordsTab'
import VaccinationsTab from '../components/herdMedical/VaccinationsTab'
import AllergiesTab from '../components/herdMedical/AllergiesTab'
import LabResultsTab from '../components/herdMedical/LabResultsTab'
import RoleInfoBanner from '../components/herdMedical/RoleInfoBanner'
import AddRecordModal from '../components/herdMedical/AddRecordModal'
import AddVaccinationModal from '../components/herdMedical/AddVaccinationModal'
import AddAllergyModal from '../components/herdMedical/AddAllergyModal'
import AddLabResultModal from '../components/herdMedical/AddLabResultModal'
import ViewRecordModal from '../components/herdMedical/ViewRecordModal'
import type { Enterprise, Animal, AnimalGroup, Tab, ModalType } from '../components/herdMedical/herdMedicalShared'

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
  // subjectType decides whether this record belongs to ONE animal or to a whole group. A batch
  // group is treated as a single subject - a 5,000-bird flock produces one record, not 5,000.
  const [recordForm, setRecordForm] = useState({ subjectType: 'animal', animalId: '', groupId: '', recordType: 'diagnosis', title: '', content: '', severity: 'normal', followUpDate: '', medications: '', eventDate: new Date().toISOString().slice(0, 10), headCountTreated: '', affectedCount: '', mortalityCount: '' })
  const [vaccForm, setVaccForm] = useState({ subjectType: 'animal', animalId: '', groupId: '', vaccineName: '', vaccineType: '', dateAdministered: new Date().toISOString().slice(0, 10), nextDueDate: '', batchNumber: '', manufacturer: '', dosage: '', certificateNumber: '', headCountTreated: '' })
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
    const recSubjectOk = recordForm.subjectType === 'group' ? !!recordForm.groupId : !!recordForm.animalId
    if (!recSubjectOk || !recordForm.title || !recordForm.content) { setError(t('herdMedical.validation.recordRequired')); return }
    setModalSaving(true); clearMessages()
    try {
      const medsArray = recordForm.medications ? recordForm.medications.split(',').map(m => ({ name: m.trim() })) : undefined
      const isGroupRec = recordForm.subjectType === 'group'
      await apiService.createMedicalRecord({
        // Exactly one subject - the backend CHECK rejects both or neither.
        animalId: isGroupRec ? undefined : recordForm.animalId,
        groupId: isGroupRec ? recordForm.groupId : undefined,
        recordType: recordForm.recordType, title: recordForm.title,
        content: recordForm.content, severity: recordForm.severity,
        eventDate: recordForm.eventDate || undefined,
        followUpDate: recordForm.followUpDate || undefined, medications: medsArray,
        veterinarianId: isVet ? user?.id : undefined,
        ...(isGroupRec ? {
          headCountTreated: recordForm.headCountTreated ? Number(recordForm.headCountTreated) : undefined,
          affectedCount: recordForm.affectedCount ? Number(recordForm.affectedCount) : undefined,
          mortalityCount: recordForm.mortalityCount ? Number(recordForm.mortalityCount) : undefined,
        } : {}),
      })
      setSuccess(t('herdMedical.success.recordCreated')); setModal(null)
      setRecordForm({ subjectType: 'animal', animalId: '', groupId: '', recordType: 'diagnosis', title: '', content: '', severity: 'normal', followUpDate: '', medications: '', eventDate: new Date().toISOString().slice(0, 10), headCountTreated: '', affectedCount: '', mortalityCount: '' })
      loadRecords(); loadStats()
    } catch (err: any) { setError(err.response?.data?.error?.message || t('herdMedical.error.failedToCreateRecord')) }
    finally { setModalSaving(false) }
  }

  const handleCreateVaccination = async (e: React.FormEvent) => {
    e.preventDefault()
    const vaccSubjectOk = vaccForm.subjectType === 'group' ? !!vaccForm.groupId : !!vaccForm.animalId
    if (!vaccSubjectOk || !vaccForm.vaccineName || !vaccForm.dateAdministered) { setError(t('herdMedical.validation.vaccinationRequired')); return }
    setModalSaving(true); clearMessages()
    try {
      const isGroupVacc = vaccForm.subjectType === 'group'
      await apiService.createVaccination({
        animalId: isGroupVacc ? undefined : vaccForm.animalId,
        groupId: isGroupVacc ? vaccForm.groupId : undefined,
        headCountTreated: isGroupVacc && vaccForm.headCountTreated ? Number(vaccForm.headCountTreated) : undefined,
        vaccineName: vaccForm.vaccineName,
        vaccineType: vaccForm.vaccineType || undefined, dateAdministered: vaccForm.dateAdministered,
        nextDueDate: vaccForm.nextDueDate || undefined, batchNumber: vaccForm.batchNumber || undefined,
        manufacturer: vaccForm.manufacturer || undefined, dosage: vaccForm.dosage || undefined,
        certificateNumber: vaccForm.certificateNumber || undefined,
      })
      setSuccess(t('herdMedical.success.vaccinationRecorded')); setModal(null)
      setVaccForm({ subjectType: 'animal', animalId: '', groupId: '', vaccineName: '', vaccineType: '', dateAdministered: new Date().toISOString().slice(0, 10), nextDueDate: '', batchNumber: '', manufacturer: '', dosage: '', certificateNumber: '', headCountTreated: '' })
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

  // MAIN RENDER
  return (
    <div className="module-page">
      <div className="module-header">
        <h1>{t('herdMedical.pageTitle')}</h1>
        <p>{t('herdMedical.pageDescription')}</p>
      </div>

      <RoleInfoBanner role={role} />

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

          {tab === 'overview' && (
            <OverviewTab
              stats={stats} canCreate={canCreate} fmtDate={fmtDate} speciesLabel={speciesLabel}
              onAddRecord={() => { setRecordForm(f => ({ ...f, animalId: '' })); setModal('add-record') }}
              onAddVaccination={() => { setVaccForm(f => ({ ...f, animalId: '' })); setModal('add-vaccination') }}
              onAddAllergy={() => { setAllergyForm(f => ({ ...f, animalId: '' })); setModal('add-allergy') }}
              onAddLab={() => { setLabForm(f => ({ ...f, animalId: '' })); setModal('add-lab') }}
              onFilterByType={type => { setRecordTypeFilter(type); setTab('records') }}
              onViewRecord={handleViewRecord}
            />
          )}
          {tab === 'records' && (
            <RecordsTab
              records={records} recordsTotal={recordsTotal} animals={animals} groups={groups}
              recordTypeFilter={recordTypeFilter} severityFilter={severityFilter} groupFilter={groupFilter}
              searchQuery={searchQuery} page={page} canCreate={canCreate} canManage={canManage}
              fmtDate={fmtDate} speciesLabel={speciesLabel}
              onSearchChange={v => { setSearchQuery(v); setPage(0) }}
              onRecordTypeFilterChange={v => { setRecordTypeFilter(v); setPage(0) }}
              onSeverityFilterChange={v => { setSeverityFilter(v); setPage(0) }}
              onGroupFilterChange={v => { setGroupFilter(v); setPage(0) }}
              onPageChange={setPage}
              onAddRecord={() => { setRecordForm({ subjectType: 'animal', animalId: '', groupId: '', recordType: 'diagnosis', title: '', content: '', severity: 'normal', followUpDate: '', medications: '', eventDate: new Date().toISOString().slice(0, 10), headCountTreated: '', affectedCount: '', mortalityCount: '' }); setModal('add-record') }}
              onViewRecord={handleViewRecord}
              onDeleteRecord={handleDeleteRecord}
            />
          )}
          {tab === 'vaccinations' && (
            <VaccinationsTab
              vaccinations={vaccinations} vaccinationsTotal={vaccinationsTotal} animals={animals} groups={groups}
              vaccFilter={vaccFilter} groupFilter={groupFilter} canCreate={canCreate} fmtDate={fmtDate} speciesLabel={speciesLabel}
              onVaccFilterChange={setVaccFilter}
              onGroupFilterChange={setGroupFilter}
              onAddVaccination={() => { setVaccForm({ subjectType: 'animal', animalId: '', groupId: '', vaccineName: '', vaccineType: '', dateAdministered: new Date().toISOString().slice(0, 10), nextDueDate: '', batchNumber: '', manufacturer: '', dosage: '', certificateNumber: '', headCountTreated: '' }); setModal('add-vaccination') }}
            />
          )}
          {tab === 'allergies' && (
            <AllergiesTab
              allergies={allergies} animals={animals} canCreate={canCreate} fmtDate={fmtDate} speciesLabel={speciesLabel}
              onAddAllergy={() => { setAllergyForm({ animalId: '', allergen: '', reaction: '', severity: 'normal', notes: '' }); setModal('add-allergy') }}
            />
          )}
          {tab === 'lab_results' && (
            <LabResultsTab
              labResults={labResults} animals={animals} canCreate={canCreate} canManage={canManage} fmtDate={fmtDate} speciesLabel={speciesLabel}
              onAddLab={() => { setLabForm({ animalId: '', testName: '', testDate: new Date().toISOString().slice(0, 10), testCategory: '', resultValue: '', normalRange: '', unit: '', status: 'pending', interpretation: '', labName: '', notes: '' }); setModal('add-lab') }}
              onUpdateLabStatus={handleUpdateLabStatus}
            />
          )}
        </>
      )}

      {modal === 'add-record' && (
        <AddRecordModal
          recordForm={recordForm} setRecordForm={setRecordForm} onSubmit={handleCreateRecord} onClose={() => setModal(null)}
          saving={modalSaving} isVet={isVet} isAdmin={isAdmin} animals={animals} groups={groups} speciesLabel={speciesLabel}
        />
      )}
      {modal === 'add-vaccination' && (
        <AddVaccinationModal
          vaccForm={vaccForm} setVaccForm={setVaccForm} onSubmit={handleCreateVaccination} onClose={() => setModal(null)}
          saving={modalSaving} animals={animals} groups={groups} speciesLabel={speciesLabel}
          vaccineProtocols={vaccineProtocols} onVaccineProtocolSelect={handleVaccineProtocolSelect}
        />
      )}
      {modal === 'add-allergy' && (
        <AddAllergyModal
          allergyForm={allergyForm} setAllergyForm={setAllergyForm} onSubmit={handleCreateAllergy} onClose={() => setModal(null)}
          saving={modalSaving} animals={animals} speciesLabel={speciesLabel}
        />
      )}
      {modal === 'add-lab' && (
        <AddLabResultModal
          labForm={labForm} setLabForm={setLabForm} onSubmit={handleCreateLabResult} onClose={() => setModal(null)}
          saving={modalSaving} animals={animals} speciesLabel={speciesLabel}
        />
      )}
      {modal === 'view-record' && viewRecord && (
        <ViewRecordModal
          record={viewRecord} onClose={() => setModal(null)} canManage={canManage} fmtDate={fmtDate}
          onArchive={() => { handleDeleteRecord(viewRecord.id); setModal(null) }}
        />
      )}
    </div>
  )
}

export default HerdMedicalManagement
