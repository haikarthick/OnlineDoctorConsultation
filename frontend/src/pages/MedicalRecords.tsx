import React, { useState, useEffect, useCallback } from 'react'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import apiService from '../services/api'
import './ModulePage.css'

type Tab = 'overview' | 'records' | 'vaccinations' | 'lab_results' | 'allergies' | 'weight' | 'timeline' | 'prescriptions'

const RECORD_TYPES = [
  { value: 'diagnosis', label: 'Diagnosis', icon: '🩺', color: '#667eea' },
  { value: 'prescription', label: 'Prescription', icon: '💊', color: '#059669' },
  { value: 'lab_report', label: 'Lab Report', icon: '🔬', color: '#d97706' },
  { value: 'vaccination', label: 'Vaccination', icon: '💉', color: '#7c3aed' },
  { value: 'surgery', label: 'Surgery', icon: '🏥', color: '#dc2626' },
  { value: 'imaging', label: 'Imaging', icon: '📷', color: '#0891b2' },
  { value: 'follow_up', label: 'Follow-up', icon: '📅', color: '#ea580c' },
  { value: 'other', label: 'Other', icon: '📋', color: '#6b7280' },
]

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#059669' },
  { value: 'normal', label: 'Normal', color: '#667eea' },
  { value: 'high', label: 'High', color: '#d97706' },
  { value: 'critical', label: 'Critical', color: '#dc2626' },
]

const MedicalRecords: React.FC = () => {
  const { formatDate } = useSettings()
  const { user } = useAuth()
  const isVet = user?.role === 'veterinarian'
  const isAdmin = user?.role === 'admin'

  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [animals, setAnimals] = useState<any[]>([])
  const [selectedAnimal, setSelectedAnimal] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Data states
  const [stats, setStats] = useState<any>(null)
  const [records, setRecords] = useState<any[]>([])
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [vaccinations, setVaccinations] = useState<any[]>([])
  const [labResults, setLabResults] = useState<any[]>([])
  const [allergies, setAllergies] = useState<any[]>([])
  const [weightHistory, setWeightHistory] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [prescriptions, setPrescriptions] = useState<any[]>([])

  // Filters
  const [recordTypeFilter, setRecordTypeFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal states
  const [showModal, setShowModal] = useState<string | null>(null)
  const [modalData, setModalData] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [detailRecord, setDetailRecord] = useState<any>(null)

  const fmtDate = useCallback((d: string) => {
    if (!d) return 'N/A'
    try { return formatDate(d) } catch { return d }
  }, [formatDate])

  // ═══ DATA LOADING ═════════════════════════════════════════

  const loadAnimals = useCallback(async () => {
    try {
      const res = await apiService.listAnimals({ limit: 100 })
      const list = res.data?.animals || res.data?.items || (Array.isArray(res.data) ? res.data : [])
      setAnimals(list)
      if (list.length > 0 && !selectedAnimal) {
        setSelectedAnimal(list[0].id)
      }
    } catch { /* ignore */ }
  }, [selectedAnimal])

  const loadStats = useCallback(async () => {
    try {
      const res = await apiService.getMedicalStats()
      setStats(res.data)
    } catch { /* ignore */ }
  }, [])

  const loadRecords = useCallback(async () => {
    try {
      const params: any = { limit: 50, offset: 0 }
      if (selectedAnimal) params.animalId = selectedAnimal
      if (recordTypeFilter) params.recordType = recordTypeFilter
      if (searchQuery) params.search = searchQuery
      const res = await apiService.listMedicalRecords(params)
      const data = res.data
      setRecords(data?.records || [])
      setRecordsTotal(data?.total || 0)
    } catch { setRecords([]); setRecordsTotal(0) }
  }, [selectedAnimal, recordTypeFilter, searchQuery])

  const loadVaccinations = useCallback(async () => {
    if (!selectedAnimal) return
    try {
      const res = await apiService.listVaccinations(selectedAnimal)
      setVaccinations(res.data?.records || [])
    } catch { setVaccinations([]) }
  }, [selectedAnimal])

  const loadLabResults = useCallback(async () => {
    if (!selectedAnimal) return
    try {
      const res = await apiService.listLabResults(selectedAnimal)
      setLabResults(res.data?.records || [])
    } catch { setLabResults([]) }
  }, [selectedAnimal])

  const loadAllergies = useCallback(async () => {
    if (!selectedAnimal) return
    try {
      const res = await apiService.listAllergies(selectedAnimal)
      setAllergies(res.data || [])
    } catch { setAllergies([]) }
  }, [selectedAnimal])

  const loadWeightHistory = useCallback(async () => {
    if (!selectedAnimal) return
    try {
      const res = await apiService.listWeightHistory(selectedAnimal)
      setWeightHistory(res.data || [])
    } catch { setWeightHistory([]) }
  }, [selectedAnimal])

  const loadTimeline = useCallback(async () => {
    if (!selectedAnimal) return
    try {
      const res = await apiService.getAnimalTimeline(selectedAnimal)
      setTimeline(res.data || [])
    } catch { setTimeline([]) }
  }, [selectedAnimal])

  const loadPrescriptions = useCallback(async () => {
    try {
      const res = await apiService.getMyPrescriptions({ limit: 50 })
      const data = res.data?.items || (Array.isArray(res.data) ? res.data : [])
      setPrescriptions(data)
    } catch { setPrescriptions([]) }
  }, [])

  const loadAllData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await Promise.all([loadAnimals(), loadStats(), loadPrescriptions()])
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to load data')
    } finally { setLoading(false) }
  }, [loadAnimals, loadStats, loadPrescriptions])

  useEffect(() => { loadAllData() }, [])

  useEffect(() => {
    if (selectedAnimal) {
      loadRecords()
      if (activeTab === 'vaccinations') loadVaccinations()
      if (activeTab === 'lab_results') loadLabResults()
      if (activeTab === 'allergies') loadAllergies()
      if (activeTab === 'weight') loadWeightHistory()
      if (activeTab === 'timeline') loadTimeline()
    } else {
      loadRecords()
    }
  }, [selectedAnimal, activeTab, recordTypeFilter, searchQuery])

  // ═══ CRUD HANDLERS ════════════════════════════════════════

  const handleSaveRecord = async () => {
    setSaving(true)
    try {
      await apiService.createMedicalRecord({
        ...modalData,
        animalId: selectedAnimal || undefined,
        veterinarianId: isVet ? user?.id : undefined,
      })
      setShowModal(null); setModalData({})
      loadRecords(); loadStats()
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to save record')
    } finally { setSaving(false) }
  }

  const handleSaveVaccination = async () => {
    setSaving(true)
    try {
      await apiService.createVaccination({ ...modalData, animalId: selectedAnimal })
      setShowModal(null); setModalData({})
      loadVaccinations()
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to save vaccination')
    } finally { setSaving(false) }
  }

  const handleSaveWeight = async () => {
    setSaving(true)
    try {
      await apiService.addWeight({ animalId: selectedAnimal, weight: parseFloat(modalData.weight), unit: modalData.unit || 'kg', notes: modalData.notes })
      setShowModal(null); setModalData({})
      loadWeightHistory()
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to save weight')
    } finally { setSaving(false) }
  }

  const handleSaveAllergy = async () => {
    setSaving(true)
    try {
      await apiService.createAllergy({ ...modalData, animalId: selectedAnimal })
      setShowModal(null); setModalData({})
      loadAllergies()
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to save allergy')
    } finally { setSaving(false) }
  }

  const handleSaveLabResult = async () => {
    setSaving(true)
    try {
      await apiService.createLabResult({ ...modalData, animalId: selectedAnimal })
      setShowModal(null); setModalData({})
      loadLabResults()
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to save lab result')
    } finally { setSaving(false) }
  }

  // ═══ UI HELPERS ═══════════════════════════════════════════

  const getRecordTypeInfo = (type: string) => RECORD_TYPES.find(r => r.value === type) || RECORD_TYPES[7]
  const getSeverityInfo = (sev: string) => SEVERITY_OPTIONS.find(s => s.value === sev) || SEVERITY_OPTIONS[1]
  const selectedAnimalData = animals.find((a: any) => a.id === selectedAnimal)

  const tabStyle = (tab: Tab) => ({
    padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    background: activeTab === tab ? '#fff' : 'transparent',
    color: activeTab === tab ? '#667eea' : '#6b7280',
    borderBottom: activeTab === tab ? '2px solid #667eea' : '2px solid transparent',
    marginBottom: -2, whiteSpace: 'nowrap' as const
  })

  // ═══ RENDER ═══════════════════════════════════════════════

  if (loading) {
    return (
      <div className="module-page">
        <div className="module-header"><h1>📋 Medical Records</h1></div>
        <div className="module-content" style={{ textAlign: 'center', padding: 60 }}>
          <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
          <p>Loading medical records...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page">
      <div className="module-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1>📋 Medical Records</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Animal selector */}
          <select
            value={selectedAnimal}
            onChange={(e) => setSelectedAnimal(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, minWidth: 180 }}
          >
            <option value="">All Animals</option>
            {animals.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.uniqueId || a.unique_id || ''} {a.name} ({a.species})
              </option>
            ))}
          </select>
          {(isVet || isAdmin) && (
            <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}
              onClick={() => { setShowModal('record'); setModalData({ recordType: 'diagnosis', severity: 'normal' }) }}>
              + New Record
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 18px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 12, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Selected Animal Info Bar */}
      {selectedAnimalData && (
        <div style={{ display: 'flex', gap: 16, padding: '12px 16px', background: '#f0f4ff', borderRadius: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
          <span style={{ fontWeight: 700, color: '#667eea' }}>🐾 {selectedAnimalData.uniqueId || selectedAnimalData.unique_id || 'N/A'}</span>
          <span><strong>{selectedAnimalData.name}</strong> ({selectedAnimalData.species}{selectedAnimalData.breed ? ` / ${selectedAnimalData.breed}` : ''})</span>
          {selectedAnimalData.gender && <span>Gender: {selectedAnimalData.gender}</span>}
          {selectedAnimalData.weight && <span>Weight: {selectedAnimalData.weight} kg</span>}
          {selectedAnimalData.dateOfBirth && <span>DOB: {fmtDate(selectedAnimalData.dateOfBirth || selectedAnimalData.date_of_birth)}</span>}
          {selectedAnimalData.microchipId && <span>Microchip: {selectedAnimalData.microchipId}</span>}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid #e5e7eb', overflowX: 'auto' }}>
        <button onClick={() => setActiveTab('overview')} style={tabStyle('overview')}>📊 Overview</button>
        <button onClick={() => setActiveTab('records')} style={tabStyle('records')}>📄 Records ({recordsTotal})</button>
        <button onClick={() => setActiveTab('prescriptions')} style={tabStyle('prescriptions')}>💊 Prescriptions ({prescriptions.length})</button>
        <button onClick={() => setActiveTab('vaccinations')} style={tabStyle('vaccinations')}>💉 Vaccinations ({vaccinations.length})</button>
        <button onClick={() => setActiveTab('lab_results')} style={tabStyle('lab_results')}>🔬 Lab Results ({labResults.length})</button>
        <button onClick={() => setActiveTab('allergies')} style={tabStyle('allergies')}>⚠️ Allergies ({allergies.length})</button>
        <button onClick={() => setActiveTab('weight')} style={tabStyle('weight')}>⚖️ Weight ({weightHistory.length})</button>
        <button onClick={() => setActiveTab('timeline')} style={tabStyle('timeline')}>📅 Timeline</button>
      </div>

      <div className="module-content">

        {/* ═══ OVERVIEW TAB ══════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div>
            {/* Stats Cards */}
            {stats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
                <StatCard icon="📋" label="Total Records" value={stats.totalRecords || 0} color="#667eea" />
                <StatCard icon="💉" label="Vaccinations" value={stats.vaccinations?.total || 0}
                  sub={stats.vaccinations?.upcomingDue ? `${stats.vaccinations.upcomingDue} due soon` : ''} color="#7c3aed" />
                <StatCard icon="🔬" label="Lab Results" value={stats.labResults?.total || 0}
                  sub={stats.labResults?.pending ? `${stats.labResults.pending} pending` : ''} color="#d97706" />
                <StatCard icon="⚠️" label="Active Allergies" value={stats.allergies?.active || 0} color="#dc2626" />
                <StatCard icon="📅" label="Follow-ups (7d)" value={stats.upcomingFollowUps || 0} color="#ea580c" />
              </div>
            )}

            {/* Records by Type */}
            {stats?.recordsByType && Object.keys(stats.recordsByType).length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#374151' }}>Records by Type</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(stats.recordsByType).map(([type, count]: [string, any]) => {
                    const info = getRecordTypeInfo(type)
                    return (
                      <div key={type} style={{
                        padding: '8px 14px', borderRadius: 8, background: '#fff', border: '1px solid #e5e7eb',
                        display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                      }} onClick={() => { setRecordTypeFilter(type); setActiveTab('records') }}>
                        <span>{info.icon}</span>
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{info.label}</span>
                        <span style={{ background: info.color, color: '#fff', borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            {(isVet || isAdmin) && selectedAnimal && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#374151' }}>Quick Actions</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <QuickBtn label="+ Record" onClick={() => { setShowModal('record'); setModalData({ recordType: 'diagnosis', severity: 'normal' }) }} />
                  <QuickBtn label="+ Vaccination" onClick={() => { setShowModal('vaccination'); setModalData({}) }} />
                  <QuickBtn label="+ Weight" onClick={() => { setShowModal('weight'); setModalData({ unit: 'kg' }) }} />
                  <QuickBtn label="+ Allergy" onClick={() => { setShowModal('allergy'); setModalData({ severity: 'mild' }) }} />
                  <QuickBtn label="+ Lab Result" onClick={() => { setShowModal('lab_result'); setModalData({ status: 'pending' }) }} />
                </div>
              </div>
            )}

            {/* Recent Activity preview */}
            {records.length > 0 && (
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#374151' }}>Recent Records</h3>
                <div className="records-list">
                  {records.slice(0, 5).map((rec: any) => (
                    <RecordRow key={rec.id} rec={rec} fmtDate={fmtDate} getRecordTypeInfo={getRecordTypeInfo} getSeverityInfo={getSeverityInfo} onView={() => setDetailRecord(rec)} />
                  ))}
                </div>
                {records.length > 5 && (
                  <button onClick={() => setActiveTab('records')} style={{ marginTop: 8, color: '#667eea', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                    View all {recordsTotal} records →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ RECORDS TAB ═══════════════════════════════════ */}
        {activeTab === 'records' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="text" placeholder="Search records..."
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, flex: 1, minWidth: 200 }} />
              <select value={recordTypeFilter} onChange={(e) => setRecordTypeFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}>
                <option value="">All Types</option>
                {RECORD_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            {records.length === 0 ? (
              <EmptyState icon="📄" title="No medical records found" subtitle="Records created by veterinarians during consultations will appear here" />
            ) : (
              <div className="records-list">
                {records.map((rec: any) => (
                  <RecordRow key={rec.id} rec={rec} fmtDate={fmtDate} getRecordTypeInfo={getRecordTypeInfo} getSeverityInfo={getSeverityInfo} onView={() => setDetailRecord(rec)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ PRESCRIPTIONS TAB ═════════════════════════════ */}
        {activeTab === 'prescriptions' && (
          <div>
            {prescriptions.length === 0 ? (
              <EmptyState icon="💊" title="No prescriptions yet" subtitle="Prescriptions from your consultations will appear here" />
            ) : (
              <div className="records-list">
                {prescriptions.map((rx: any) => (
                  <div key={rx.id} className="record-item" style={{ borderLeft: '4px solid #059669' }}>
                    <div className="record-icon">💊</div>
                    <div className="record-details">
                      <h4>{Array.isArray(rx.medications) ? rx.medications.map((m: any) => m.name).join(', ') : 'Medication'}</h4>
                      {Array.isArray(rx.medications) && rx.medications.map((med: any, mi: number) => (
                        <p key={mi}><strong>{med.name}</strong>{med.dosage ? ` — ${med.dosage}` : ''}{med.frequency ? `, ${med.frequency}` : ''}{med.duration ? ` for ${med.duration}` : ''}</p>
                      ))}
                      {rx.instructions && <p className="text-muted">📝 {rx.instructions}</p>}
                      <p className="text-muted">
                        Prescribed: {fmtDate(rx.createdAt || rx.created_at || '')} • Valid until: {fmtDate(rx.validUntil || rx.valid_until || '')}
                      </p>
                    </div>
                    <div className="record-actions">
                      <span className="badge badge-completed">{rx.isActive || rx.is_active ? 'active' : 'expired'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ VACCINATIONS TAB ══════════════════════════════ */}
        {activeTab === 'vaccinations' && (
          <div>
            {!selectedAnimal ? (
              <EmptyState icon="💉" title="Select a pet" subtitle="Choose a pet from the dropdown above to view vaccination records" />
            ) : (
              <>
                {(isVet || isAdmin) && (
                  <div style={{ marginBottom: 12 }}>
                    <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}
                      onClick={() => { setShowModal('vaccination'); setModalData({}) }}>
                      + Add Vaccination
                    </button>
                  </div>
                )}
                {vaccinations.length === 0 ? (
                  <EmptyState icon="💉" title="No vaccination records" subtitle="Vaccination records will appear here once added" />
                ) : (
                  <div className="records-list">
                    {vaccinations.map((v: any) => {
                      const isOverdue = v.nextDueDate && new Date(v.nextDueDate) < new Date()
                      return (
                        <div key={v.id} className="record-item" style={{ borderLeft: `4px solid ${isOverdue ? '#dc2626' : '#7c3aed'}` }}>
                          <div className="record-icon">💉</div>
                          <div className="record-details">
                            <h4>{v.vaccineName} {v.vaccineType ? `(${v.vaccineType})` : ''}</h4>
                            <p>Administered: {fmtDate(v.dateAdministered)} {v.administeredByName ? `by ${v.administeredByName}` : ''}</p>
                            {v.dosage && <p className="text-muted">Dosage: {v.dosage}</p>}
                            {v.batchNumber && <p className="text-muted">Batch: {v.batchNumber} {v.manufacturer ? `| ${v.manufacturer}` : ''}</p>}
                            {v.nextDueDate && <p className="text-muted">Next due: <strong style={{ color: isOverdue ? '#dc2626' : '#059669' }}>{fmtDate(v.nextDueDate)}{isOverdue ? ' (OVERDUE)' : ''}</strong></p>}
                            {v.certificateNumber && <p className="text-muted">Certificate: {v.certificateNumber}</p>}
                            {v.reactionNotes && <p className="text-muted">⚠️ Reaction: {v.reactionNotes}</p>}
                          </div>
                          <div className="record-actions">
                            <span className={`badge ${v.isValid ? 'badge-completed' : 'badge-cancelled'}`}>{v.isValid ? 'Valid' : 'Invalid'}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══ LAB RESULTS TAB ═══════════════════════════════ */}
        {activeTab === 'lab_results' && (
          <div>
            {!selectedAnimal ? (
              <EmptyState icon="🔬" title="Select a pet" subtitle="Choose a pet from the dropdown above to view lab results" />
            ) : (
              <>
                {(isVet || isAdmin) && (
                  <div style={{ marginBottom: 12 }}>
                    <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}
                      onClick={() => { setShowModal('lab_result'); setModalData({ status: 'pending' }) }}>
                      + Add Lab Result
                    </button>
                  </div>
                )}
                {labResults.length === 0 ? (
                  <EmptyState icon="🔬" title="No lab results" subtitle="Lab test results will appear here once added" />
                ) : (
                  <div className="records-list">
                    {labResults.map((lr: any) => (
                      <div key={lr.id} className="record-item" style={{ borderLeft: `4px solid ${lr.isAbnormal ? '#dc2626' : '#d97706'}` }}>
                        <div className="record-icon">🔬</div>
                        <div className="record-details">
                          <h4>{lr.testName} {lr.testCategory ? `(${lr.testCategory})` : ''}</h4>
                          <p>Test Date: {fmtDate(lr.testDate)} {lr.orderedByName ? `| Ordered by: ${lr.orderedByName}` : ''}</p>
                          {lr.resultValue && (
                            <p><strong>Result:</strong> {lr.resultValue} {lr.unit || ''} {lr.normalRange ? <span className="text-muted">(Normal: {lr.normalRange})</span> : ''}</p>
                          )}
                          {lr.interpretation && <p className="text-muted">📝 {lr.interpretation}</p>}
                          {lr.labName && <p className="text-muted">Lab: {lr.labName}</p>}
                        </div>
                        <div className="record-actions" style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                          <span className={`badge ${lr.status === 'completed' ? 'badge-completed' : lr.status === 'pending' ? 'badge-pending' : 'badge-info'}`}>{lr.status}</span>
                          {lr.isAbnormal && <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', fontWeight: 700 }}>⚠️ Abnormal</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══ ALLERGIES TAB ═════════════════════════════════ */}
        {activeTab === 'allergies' && (
          <div>
            {!selectedAnimal ? (
              <EmptyState icon="⚠️" title="Select a pet" subtitle="Choose a pet from the dropdown above to view allergies" />
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}
                    onClick={() => { setShowModal('allergy'); setModalData({ severity: 'mild' }) }}>
                    + Report Allergy
                  </button>
                </div>
                {allergies.length === 0 ? (
                  <EmptyState icon="✅" title="No known allergies" subtitle="No allergies have been recorded for this pet" />
                ) : (
                  <div className="records-list">
                    {allergies.map((al: any) => {
                      const sevColor = al.severity === 'severe' ? '#dc2626' : al.severity === 'moderate' ? '#d97706' : '#059669'
                      return (
                        <div key={al.id} className="record-item" style={{ borderLeft: `4px solid ${sevColor}` }}>
                          <div className="record-icon">⚠️</div>
                          <div className="record-details">
                            <h4>{al.allergen}</h4>
                            {al.reaction && <p>Reaction: {al.reaction}</p>}
                            <p className="text-muted">
                              Severity: <strong style={{ color: sevColor }}>{al.severity}</strong>
                              {al.identifiedDate ? ` | Identified: ${fmtDate(al.identifiedDate)}` : ''}
                              {al.reportedByName ? ` | Reported by: ${al.reportedByName}` : ''}
                            </p>
                            {al.notes && <p className="text-muted">📝 {al.notes}</p>}
                          </div>
                          <div className="record-actions">
                            <span className={`badge ${al.isActive ? 'badge-cancelled' : 'badge-completed'}`}>{al.isActive ? '⚠️ Active' : 'Resolved'}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══ WEIGHT TAB ════════════════════════════════════ */}
        {activeTab === 'weight' && (
          <div>
            {!selectedAnimal ? (
              <EmptyState icon="⚖️" title="Select a pet" subtitle="Choose a pet from the dropdown above to view weight history" />
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}
                    onClick={() => { setShowModal('weight'); setModalData({ unit: 'kg' }) }}>
                    + Record Weight
                  </button>
                </div>
                {weightHistory.length === 0 ? (
                  <EmptyState icon="⚖️" title="No weight records" subtitle="Weight measurements will appear here once added" />
                ) : (
                  <>
                    {/* Weight Chart (simple text-based) */}
                    <div style={{ marginBottom: 20, padding: 16, background: '#f9fafb', borderRadius: 8 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Weight Trend</h4>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 100 }}>
                        {weightHistory.slice().reverse().slice(-20).map((w: any, i: number) => {
                          const max = Math.max(...weightHistory.map((x: any) => parseFloat(x.weight)))
                          const min = Math.min(...weightHistory.map((x: any) => parseFloat(x.weight)))
                          const range = max - min || 1
                          const pct = ((parseFloat(w.weight) - min) / range) * 80 + 20
                          return (
                            <div key={i} title={`${w.weight} ${w.unit} - ${fmtDate(w.recordedAt)}`}
                              style={{ flex: 1, height: `${pct}%`, background: '#667eea', borderRadius: '4px 4px 0 0', minWidth: 8, maxWidth: 30 }} />
                          )
                        })}
                      </div>
                      <p className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
                        Latest: <strong>{weightHistory[0]?.weight} {weightHistory[0]?.unit}</strong>
                        {weightHistory.length > 1 && (() => {
                          const diff = (parseFloat(weightHistory[0].weight) - parseFloat(weightHistory[1].weight)).toFixed(2)
                          const num = parseFloat(diff)
                          return ` (${num > 0 ? '+' : ''}${diff} ${weightHistory[0].unit} from last)`
                        })()}
                      </p>
                    </div>
                    <div className="records-list">
                      {weightHistory.map((w: any) => (
                        <div key={w.id} className="record-item" style={{ borderLeft: '4px solid #667eea' }}>
                          <div className="record-icon">⚖️</div>
                          <div className="record-details">
                            <h4>{w.weight} {w.unit}</h4>
                            <p className="text-muted">Recorded: {fmtDate(w.recordedAt)} {w.recordedByName ? `by ${w.recordedByName}` : ''}</p>
                            {w.notes && <p className="text-muted">📝 {w.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══ TIMELINE TAB ══════════════════════════════════ */}
        {activeTab === 'timeline' && (
          <div>
            {!selectedAnimal ? (
              <EmptyState icon="📅" title="Select a pet" subtitle="Choose a pet from the dropdown above to view its complete medical timeline" />
            ) : timeline.length === 0 ? (
              <EmptyState icon="📅" title="No medical history" subtitle="Medical events will appear here as records are created" />
            ) : (
              <div style={{ position: 'relative', paddingLeft: 32 }}>
                <div style={{ position: 'absolute', left: 12, top: 0, bottom: 0, width: 2, background: '#e5e7eb' }} />
                {timeline.map((item: any, i: number) => {
                  const typeIcon = item.type.startsWith('record_') ? getRecordTypeInfo(item.type.replace('record_', '')).icon
                    : item.type === 'vaccination' ? '💉' : item.type === 'lab_result' ? '🔬'
                    : item.type === 'prescription' ? '💊' : item.type === 'weight' ? '⚖️' : '📋'
                  const typeColor = item.type.startsWith('record_') ? getRecordTypeInfo(item.type.replace('record_', '')).color
                    : item.type === 'vaccination' ? '#7c3aed' : item.type === 'lab_result' ? '#d97706'
                    : item.type === 'prescription' ? '#059669' : '#667eea'
                  return (
                    <div key={`${item.id}-${i}`} style={{ position: 'relative', marginBottom: 16, paddingBottom: 8 }}>
                      <div style={{
                        position: 'absolute', left: -26, top: 4, width: 24, height: 24, borderRadius: '50%',
                        background: typeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, zIndex: 1
                      }}>{typeIcon}</div>
                      <div style={{ padding: '10px 16px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginLeft: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <strong style={{ fontSize: 13 }}>{item.title}</strong>
                          <span className="text-muted" style={{ fontSize: 11 }}>{fmtDate(item.date)}</span>
                        </div>
                        {item.description && <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>{item.description}</p>}
                        {item.createdByName && <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>By: {item.createdByName}</p>}
                        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                          {item.status && <span className={`badge badge-${item.status === 'active' || item.status === 'valid' ? 'completed' : item.status === 'pending' ? 'pending' : 'info'}`} style={{ fontSize: 10 }}>{item.status}</span>}
                          {item.severity && item.severity !== 'normal' && <span className="badge" style={{ fontSize: 10, background: getSeverityInfo(item.severity).color, color: '#fff' }}>{item.severity}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ DETAIL MODAL ════════════════════════════════════ */}
      {detailRecord && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setDetailRecord(null)}>
          <div style={{ background: '#fff', borderRadius: 12, maxWidth: 700, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{getRecordTypeInfo(detailRecord.recordType).icon} {detailRecord.title}</h2>
              <button onClick={() => setDetailRecord(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, fontSize: 13 }}>
              <div><strong>Record #:</strong> {detailRecord.recordNumber || 'N/A'}</div>
              <div><strong>Type:</strong> {getRecordTypeInfo(detailRecord.recordType).label}</div>
              <div><strong>Severity:</strong> <span style={{ color: getSeverityInfo(detailRecord.severity).color }}>{detailRecord.severity}</span></div>
              <div><strong>Status:</strong> {detailRecord.status}</div>
              <div><strong>Pet:</strong> {detailRecord.animalName || 'N/A'} {detailRecord.animalUniqueId ? `(${detailRecord.animalUniqueId})` : ''}</div>
              <div><strong>Owner:</strong> {detailRecord.ownerName || 'N/A'} {detailRecord.ownerUniqueId ? `(${detailRecord.ownerUniqueId})` : ''}</div>
              <div><strong>Veterinarian:</strong> {detailRecord.veterinarianName || 'N/A'}</div>
              <div><strong>Created:</strong> {fmtDate(detailRecord.createdAt)}</div>
              {detailRecord.followUpDate && <div><strong>Follow-up:</strong> {fmtDate(detailRecord.followUpDate)}</div>}
              {detailRecord.isConfidential && <div><strong>🔒 Confidential</strong></div>}
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>Content:</strong>
              <div style={{ padding: 12, background: '#f9fafb', borderRadius: 6, marginTop: 4, whiteSpace: 'pre-wrap', fontSize: 13 }}>{detailRecord.content}</div>
            </div>
            {detailRecord.medications && detailRecord.medications.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <strong>Medications:</strong>
                {detailRecord.medications.map((m: any, i: number) => (
                  <div key={i} style={{ padding: 8, background: '#f0fdf4', borderRadius: 6, marginTop: 4, fontSize: 13 }}>
                    <strong>{m.name}</strong> {m.dosage ? `— ${m.dosage}` : ''} {m.frequency ? `, ${m.frequency}` : ''} {m.duration ? `for ${m.duration}` : ''}
                    {m.instructions && <div className="text-muted" style={{ marginTop: 2 }}>📝 {m.instructions}</div>}
                  </div>
                ))}
              </div>
            )}
            {detailRecord.tags && detailRecord.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {detailRecord.tags.map((tag: string, i: number) => (
                  <span key={i} style={{ padding: '2px 8px', background: '#e5e7eb', borderRadius: 12, fontSize: 11 }}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ CREATE MODALS ═══════════════════════════════════ */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => { setShowModal(null); setModalData({}) }}>
          <div style={{ background: '#fff', borderRadius: 12, maxWidth: 600, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }}
            onClick={(e) => e.stopPropagation()}>

            {/* Medical Record Modal */}
            {showModal === 'record' && (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>📄 New Medical Record</h2>
                <ModalField label="Record Type">
                  <select value={modalData.recordType || ''} onChange={(e) => setModalData({ ...modalData, recordType: e.target.value })} style={inputStyle}>
                    {RECORD_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                  </select>
                </ModalField>
                <ModalField label="Title"><input value={modalData.title || ''} onChange={(e) => setModalData({ ...modalData, title: e.target.value })} style={inputStyle} placeholder="Record title..." /></ModalField>
                <ModalField label="Content"><textarea value={modalData.content || ''} onChange={(e) => setModalData({ ...modalData, content: e.target.value })} style={{ ...inputStyle, height: 100 }} placeholder="Detailed description..." /></ModalField>
                <ModalField label="Severity">
                  <select value={modalData.severity || 'normal'} onChange={(e) => setModalData({ ...modalData, severity: e.target.value })} style={inputStyle}>
                    {SEVERITY_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </ModalField>
                <ModalField label="Follow-up Date (optional)">
                  <input type="date" value={modalData.followUpDate || ''} onChange={(e) => setModalData({ ...modalData, followUpDate: e.target.value })} style={inputStyle} />
                </ModalField>
                <ModalActions onCancel={() => { setShowModal(null); setModalData({}) }} onSave={handleSaveRecord} saving={saving}
                  disabled={!modalData.recordType || !modalData.title || !modalData.content} />
              </>
            )}

            {/* Vaccination Modal */}
            {showModal === 'vaccination' && (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>💉 Add Vaccination</h2>
                <ModalField label="Vaccine Name *"><input value={modalData.vaccineName || ''} onChange={(e) => setModalData({ ...modalData, vaccineName: e.target.value })} style={inputStyle} placeholder="e.g., Rabies, DHPP..." /></ModalField>
                <ModalField label="Vaccine Type"><input value={modalData.vaccineType || ''} onChange={(e) => setModalData({ ...modalData, vaccineType: e.target.value })} style={inputStyle} placeholder="e.g., Core, Non-core..." /></ModalField>
                <ModalField label="Date Administered *"><input type="date" value={modalData.dateAdministered || ''} onChange={(e) => setModalData({ ...modalData, dateAdministered: e.target.value })} style={inputStyle} /></ModalField>
                <ModalField label="Next Due Date"><input type="date" value={modalData.nextDueDate || ''} onChange={(e) => setModalData({ ...modalData, nextDueDate: e.target.value })} style={inputStyle} /></ModalField>
                <ModalField label="Dosage"><input value={modalData.dosage || ''} onChange={(e) => setModalData({ ...modalData, dosage: e.target.value })} style={inputStyle} placeholder="e.g., 1ml" /></ModalField>
                <ModalField label="Batch Number"><input value={modalData.batchNumber || ''} onChange={(e) => setModalData({ ...modalData, batchNumber: e.target.value })} style={inputStyle} /></ModalField>
                <ModalField label="Manufacturer"><input value={modalData.manufacturer || ''} onChange={(e) => setModalData({ ...modalData, manufacturer: e.target.value })} style={inputStyle} /></ModalField>
                <ModalField label="Certificate Number"><input value={modalData.certificateNumber || ''} onChange={(e) => setModalData({ ...modalData, certificateNumber: e.target.value })} style={inputStyle} /></ModalField>
                <ModalField label="Reaction Notes"><textarea value={modalData.reactionNotes || ''} onChange={(e) => setModalData({ ...modalData, reactionNotes: e.target.value })} style={{ ...inputStyle, height: 60 }} placeholder="Any adverse reactions..." /></ModalField>
                <ModalActions onCancel={() => { setShowModal(null); setModalData({}) }} onSave={handleSaveVaccination} saving={saving}
                  disabled={!modalData.vaccineName || !modalData.dateAdministered} />
              </>
            )}

            {/* Weight Modal */}
            {showModal === 'weight' && (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>⚖️ Record Weight</h2>
                <ModalField label="Weight *"><input type="number" step="0.01" value={modalData.weight || ''} onChange={(e) => setModalData({ ...modalData, weight: e.target.value })} style={inputStyle} placeholder="Enter weight..." /></ModalField>
                <ModalField label="Unit">
                  <select value={modalData.unit || 'kg'} onChange={(e) => setModalData({ ...modalData, unit: e.target.value })} style={inputStyle}>
                    <option value="kg">kg</option><option value="lbs">lbs</option><option value="g">g</option>
                  </select>
                </ModalField>
                <ModalField label="Notes"><textarea value={modalData.notes || ''} onChange={(e) => setModalData({ ...modalData, notes: e.target.value })} style={{ ...inputStyle, height: 60 }} placeholder="Any notes..." /></ModalField>
                <ModalActions onCancel={() => { setShowModal(null); setModalData({}) }} onSave={handleSaveWeight} saving={saving}
                  disabled={!modalData.weight} />
              </>
            )}

            {/* Allergy Modal */}
            {showModal === 'allergy' && (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>⚠️ Report Allergy</h2>
                <ModalField label="Allergen *"><input value={modalData.allergen || ''} onChange={(e) => setModalData({ ...modalData, allergen: e.target.value })} style={inputStyle} placeholder="e.g., Chicken, Penicillin..." /></ModalField>
                <ModalField label="Reaction"><textarea value={modalData.reaction || ''} onChange={(e) => setModalData({ ...modalData, reaction: e.target.value })} style={{ ...inputStyle, height: 60 }} placeholder="Describe the reaction..." /></ModalField>
                <ModalField label="Severity">
                  <select value={modalData.severity || 'mild'} onChange={(e) => setModalData({ ...modalData, severity: e.target.value })} style={inputStyle}>
                    <option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option>
                  </select>
                </ModalField>
                <ModalField label="Date Identified"><input type="date" value={modalData.identifiedDate || ''} onChange={(e) => setModalData({ ...modalData, identifiedDate: e.target.value })} style={inputStyle} /></ModalField>
                <ModalField label="Notes"><textarea value={modalData.notes || ''} onChange={(e) => setModalData({ ...modalData, notes: e.target.value })} style={{ ...inputStyle, height: 60 }} /></ModalField>
                <ModalActions onCancel={() => { setShowModal(null); setModalData({}) }} onSave={handleSaveAllergy} saving={saving}
                  disabled={!modalData.allergen} />
              </>
            )}

            {/* Lab Result Modal */}
            {showModal === 'lab_result' && (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>🔬 Add Lab Result</h2>
                <ModalField label="Test Name *"><input value={modalData.testName || ''} onChange={(e) => setModalData({ ...modalData, testName: e.target.value })} style={inputStyle} placeholder="e.g., Complete Blood Count..." /></ModalField>
                <ModalField label="Test Category"><input value={modalData.testCategory || ''} onChange={(e) => setModalData({ ...modalData, testCategory: e.target.value })} style={inputStyle} placeholder="e.g., Hematology, Biochemistry..." /></ModalField>
                <ModalField label="Test Date *"><input type="date" value={modalData.testDate || ''} onChange={(e) => setModalData({ ...modalData, testDate: e.target.value })} style={inputStyle} /></ModalField>
                <ModalField label="Result Value"><input value={modalData.resultValue || ''} onChange={(e) => setModalData({ ...modalData, resultValue: e.target.value })} style={inputStyle} placeholder="Test result..." /></ModalField>
                <ModalField label="Normal Range"><input value={modalData.normalRange || ''} onChange={(e) => setModalData({ ...modalData, normalRange: e.target.value })} style={inputStyle} placeholder="e.g., 5.5-8.5" /></ModalField>
                <ModalField label="Unit"><input value={modalData.unit || ''} onChange={(e) => setModalData({ ...modalData, unit: e.target.value })} style={inputStyle} placeholder="e.g., mg/dL, mmol/L..." /></ModalField>
                <ModalField label="Status">
                  <select value={modalData.status || 'pending'} onChange={(e) => setModalData({ ...modalData, status: e.target.value })} style={inputStyle}>
                    <option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
                  </select>
                </ModalField>
                <ModalField label="Lab Name"><input value={modalData.labName || ''} onChange={(e) => setModalData({ ...modalData, labName: e.target.value })} style={inputStyle} /></ModalField>
                <ModalField label="Abnormal?">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={modalData.isAbnormal || false} onChange={(e) => setModalData({ ...modalData, isAbnormal: e.target.checked })} />
                    Result is abnormal
                  </label>
                </ModalField>
                <ModalField label="Interpretation"><textarea value={modalData.interpretation || ''} onChange={(e) => setModalData({ ...modalData, interpretation: e.target.value })} style={{ ...inputStyle, height: 60 }} placeholder="Clinical interpretation..." /></ModalField>
                <ModalField label="Notes"><textarea value={modalData.notes || ''} onChange={(e) => setModalData({ ...modalData, notes: e.target.value })} style={{ ...inputStyle, height: 60 }} /></ModalField>
                <ModalActions onCancel={() => { setShowModal(null); setModalData({}) }} onSave={handleSaveLabResult} saving={saving}
                  disabled={!modalData.testName || !modalData.testDate} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══ SUB-COMPONENTS ═════════════════════════════════════════

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }

const StatCard: React.FC<{ icon: string; label: string; value: number; color: string; sub?: string }> = ({ icon, label, value, color, sub }) => (
  <div style={{ padding: 16, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, borderLeft: `4px solid ${color}` }}>
    <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
    <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: '#d97706', marginTop: 4 }}>{sub}</div>}
  </div>
)

const EmptyState: React.FC<{ icon: string; title: string; subtitle: string }> = ({ icon, title, subtitle }) => (
  <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
    <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
    <p style={{ fontSize: 16, fontWeight: 500 }}>{title}</p>
    <p style={{ fontSize: 13 }}>{subtitle}</p>
  </div>
)

const QuickBtn: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button onClick={onClick} style={{
    padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff',
    cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#374151'
  }}>{label}</button>
)

const ModalField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: 12 }}>
    <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 600, color: '#374151' }}>{label}</label>
    {children}
  </div>
)

const ModalActions: React.FC<{ onCancel: () => void; onSave: () => void; saving: boolean; disabled: boolean }> = ({ onCancel, onSave, saving, disabled }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
    <button onClick={onCancel} style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
    <button onClick={onSave} disabled={disabled || saving} className="btn-primary" style={{ padding: '8px 20px', fontSize: 13, opacity: (disabled || saving) ? 0.5 : 1 }}>
      {saving ? 'Saving...' : 'Save'}
    </button>
  </div>
)

const RecordRow: React.FC<{ rec: any; fmtDate: (d: string) => string; getRecordTypeInfo: (type: string) => any; getSeverityInfo: (sev: string) => any; onView: () => void }> = ({ rec, fmtDate, getRecordTypeInfo, getSeverityInfo, onView }) => {
  const typeInfo = getRecordTypeInfo(rec.recordType)
  const sevInfo = getSeverityInfo(rec.severity || 'normal')
  return (
    <div className="record-item" style={{ borderLeft: `4px solid ${typeInfo.color}`, cursor: 'pointer' }} onClick={onView}>
      <div className="record-icon">{typeInfo.icon}</div>
      <div className="record-details">
        <h4>
          {rec.title}
          {rec.recordNumber && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>{rec.recordNumber}</span>}
        </h4>
        <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{(rec.content || '').substring(0, 120)}{(rec.content || '').length > 120 ? '...' : ''}</p>
        <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
          {rec.animalName && `🐾 ${rec.animalName}`}
          {rec.animalUniqueId && ` (${rec.animalUniqueId})`}
          {rec.veterinarianName && ` • 👨‍⚕️ ${rec.veterinarianName}`}
          {' • '}{fmtDate(rec.createdAt)}
        </p>
      </div>
      <div className="record-actions" style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
        <span className={`badge ${rec.status === 'active' ? 'badge-completed' : rec.status === 'archived' ? 'badge-cancelled' : 'badge-info'}`}>{rec.status || 'active'}</span>
        {rec.severity && rec.severity !== 'normal' && (
          <span className="badge" style={{ background: sevInfo.color, color: '#fff', fontSize: 10 }}>{rec.severity}</span>
        )}
        {rec.isConfidential && <span style={{ fontSize: 10, color: '#d97706' }}>🔒</span>}
      </div>
    </div>
  )
}

export default MedicalRecords
