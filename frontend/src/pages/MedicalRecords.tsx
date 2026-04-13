import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import apiService from '../services/api'
import './ModulePage.css'
import { useTranslation } from 'react-i18next'

type Tab = 'overview' | 'consultations' | 'prescriptions' | 'vaccinations' | 'lab_results' | 'allergies' | 'weight' | 'timeline' | 'hospital_visits'

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
  const { t } = useTranslation()

  const { formatDate } = useSettings()
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isVet = user?.role === 'veterinarian'
  const isAdmin = user?.role === 'admin'
  const isFarmer = user?.role === 'farmer'

  // Parse deep-link query params
  const queryParams = new URLSearchParams(location.search)
  const deepLinkAnimalId = queryParams.get('animalId') || ''
  const deepLinkTab = queryParams.get('tab') as Tab | ''
  const deepLinkRecordId = queryParams.get('recordId') || ''

  const [activeTab, setActiveTab] = useState<Tab>(deepLinkTab || 'overview')
  const [animals, setAnimals] = useState<any[]>([])
  const [selectedAnimal, setSelectedAnimal] = useState<string>(deepLinkAnimalId)
  const [highlightRecordId] = useState<string>(deepLinkRecordId)
  const highlightedRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Data states
  const [stats, setStats] = useState<any>(null)
  const [vaccinations, setVaccinations] = useState<any[]>([])
  const [labResults, setLabResults] = useState<any[]>([])
  const [allergies, setAllergies] = useState<any[]>([])
  const [weightHistory, setWeightHistory] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [prescriptions, setPrescriptions] = useState<any[]>([])
  const [consultations, setConsultations] = useState<any[]>([])
  const [consultationsTotal, setConsultationsTotal] = useState(0)
  const [prescriptionsTotal, setPrescriptionsTotal] = useState(0)
  const [hospitalVisits, setHospitalVisits] = useState<{ queueVisits: any[]; inpatientAdmissions: any[] }>({ queueVisits: [], inpatientAdmissions: [] })
  const [loadingHospitalVisits, setLoadingHospitalVisits] = useState(false)
  const [enterpriseFilter, setEnterpriseFilter] = useState('')
  // Modal states
  const [showModal, setShowModal] = useState<string | null>(null)
  const [modalData, setModalData] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')
  const [vaccineProtocols, setVaccineProtocols] = useState<any[]>([])
  const [loadingProtocols, setLoadingProtocols] = useState(false)

  const fmtDate = useCallback((d: string) => {
    if (!d) return 'N/A'
    try { return formatDate(d) } catch { return d }
  }, [formatDate])

  // ═══ DATA LOADING ═════════════════════════════════════════

  const loadAnimals = useCallback(async () => {
    try {
      const params: any = { limit: 100 }
      if (isVet) params.view = 'patients'
      const res = await apiService.listAnimals(params)
      const list = res.data?.animals || res.data?.items || (Array.isArray(res.data) ? res.data : [])
      setAnimals(list)
      if (list.length > 0 && !selectedAnimal) {
        // Use deep-linked animal if provided and exists in the list
        const target = deepLinkAnimalId && list.find((a: any) => a.id === deepLinkAnimalId)
        setSelectedAnimal(target ? target.id : list[0].id)
      }
    } catch { /* ignore */ }
  }, [selectedAnimal, deepLinkAnimalId])

  const loadStats = useCallback(async () => {
    try {
      const params: any = {};
      if (selectedAnimal) params.animalId = selectedAnimal;
      const res = await apiService.getMedicalStats(params)
      setStats(res.data)
    } catch { /* ignore */ }
  }, [selectedAnimal])

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
      if (selectedAnimal) {
        const res = await apiService.getPrescriptionsByAnimal(selectedAnimal, { limit: 50 })
        const data = res.data
        setPrescriptions(data?.prescriptions || [])
        setPrescriptionsTotal(data?.total || 0)
      } else {
        const res = await apiService.getMyPrescriptions({ limit: 50 })
        const data = res.data?.items || (Array.isArray(res.data) ? res.data : [])
        setPrescriptions(data)
        setPrescriptionsTotal(data.length)
      }
    } catch { setPrescriptions([]); setPrescriptionsTotal(0) }
  }, [selectedAnimal])

  const loadHospitalVisits = useCallback(async () => {
    if (!selectedAnimal) return
    setLoadingHospitalVisits(true)
    try {
      const res = await apiService.getAnimalHospitalVisits(selectedAnimal)
      setHospitalVisits(res.data || { queueVisits: [], inpatientAdmissions: [] })
    } catch { setHospitalVisits({ queueVisits: [], inpatientAdmissions: [] }) }
    setLoadingHospitalVisits(false)
  }, [selectedAnimal])

  const loadConsultations = useCallback(async () => {
    if (!selectedAnimal) { setConsultations([]); setConsultationsTotal(0); return }
    try {
      const res = await apiService.getConsultationsByAnimal(selectedAnimal, { limit: 50 })
      const data = res.data
      setConsultations(data?.consultations || [])
      setConsultationsTotal(data?.total || 0)
    } catch { setConsultations([]); setConsultationsTotal(0) }
  }, [selectedAnimal])

  const loadAllData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await Promise.all([loadAnimals(), loadStats(), loadPrescriptions(), loadConsultations()])
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || t('medicalRecords.failedToLoad'))
    } finally { setLoading(false) }
  }, [loadAnimals, loadStats, loadPrescriptions, loadConsultations])

  useEffect(() => { loadAllData() }, [])

  useEffect(() => {
    if (selectedAnimal) {
      loadPrescriptions()
      loadStats()
      loadConsultations()
      if (activeTab === 'vaccinations') loadVaccinations()
      if (activeTab === 'lab_results') loadLabResults()
      if (activeTab === 'allergies') loadAllergies()
      if (activeTab === 'weight') loadWeightHistory()
      if (activeTab === 'timeline') loadTimeline()
      if (activeTab === 'hospital_visits') loadHospitalVisits()
    } else {
      loadPrescriptions()
      loadStats()
    }
  }, [selectedAnimal, activeTab])

  // Scroll to highlighted record after data loads
  useEffect(() => {
    if (highlightRecordId && highlightedRef.current) {
      setTimeout(() => {
        highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    }
  }, [highlightRecordId, vaccinations, labResults, allergies, consultations, prescriptions, weightHistory, timeline, loading])

  // ═══ RECORD HIGHLIGHT HELPER ═══════════════════════════════

  const recordItemProps = (id: string) => {
    const isMatch = highlightRecordId && id === highlightRecordId
    return {
      className: `record-item${isMatch ? ' record-highlight' : ''}`,
      ref: isMatch ? highlightedRef : undefined,
    }
  }

  // ═══ CRUD HANDLERS ════════════════════════════════════════

  const handleSaveRecord = async () => {
    setSaving(true)
    setModalError('')
    try {
      await apiService.createMedicalRecord({
        ...modalData,
        animalId: selectedAnimal || undefined,
        veterinarianId: isVet ? user?.id : undefined,
      })
      setShowModal(null); setModalData({})
      loadStats()
    } catch (err: any) {
      setModalError(err?.response?.data?.message || err?.response?.data?.error?.message || t('medicalRecords.failedToSaveRecord'))
    } finally { setSaving(false) }
  }

  const handleSaveVaccination = async () => {
    setSaving(true)
    setModalError('')
    try {
      await apiService.createVaccination({ ...modalData, animalId: selectedAnimal })
      setShowModal(null); setModalData({})
      loadVaccinations()
    } catch (err: any) {
      setModalError(err?.response?.data?.message || err?.response?.data?.error?.message || t('medicalRecords.failedToSaveVaccination'))
    } finally { setSaving(false) }
  }

  const handleSaveWeight = async () => {
    setSaving(true)
    setModalError('')
    try {
      await apiService.addWeight({ animalId: selectedAnimal, weight: parseFloat(modalData.weight), unit: modalData.unit || 'kg', notes: modalData.notes })
      setShowModal(null); setModalData({})
      loadWeightHistory()
    } catch (err: any) {
      setModalError(err?.response?.data?.message || err?.response?.data?.error?.message || t('medicalRecords.failedToSaveWeight'))
    } finally { setSaving(false) }
  }

  const handleSaveAllergy = async () => {
    setSaving(true)
    setModalError('')
    try {
      await apiService.createAllergy({ ...modalData, animalId: selectedAnimal })
      setShowModal(null); setModalData({})
      loadAllergies()
    } catch (err: any) {
      setModalError(err?.response?.data?.message || err?.response?.data?.error?.message || t('medicalRecords.failedToSaveAllergy'))
    } finally { setSaving(false) }
  }

  const handleSaveLabResult = async () => {
    setSaving(true)
    setModalError('')
    try {
      await apiService.createLabResult({ ...modalData, animalId: selectedAnimal })
      setShowModal(null); setModalData({})
      loadLabResults()
    } catch (err: any) {
      setModalError(err?.response?.data?.message || err?.response?.data?.error?.message || t('medicalRecords.failedToSaveLabResult'))
    } finally { setSaving(false) }
  }

  // ═══ UI HELPERS ═══════════════════════════════════════════

  const closeModal = () => { setShowModal(null); setModalData({}); setModalError('') }

  const loadVaccineProtocolsForSpecies = useCallback(async (species: string) => {
    setLoadingProtocols(true)
    try {
      const res = await apiService.listVaccineProtocols({ species })
      const protocols = Array.isArray(res?.data) ? res.data : (res?.data?.protocols || res?.protocols || [])
      setVaccineProtocols(protocols)
    } catch {
      setVaccineProtocols([])
    } finally {
      setLoadingProtocols(false)
    }
  }, [])

  const openVaccinationModal = useCallback(() => {
    setShowModal('vaccination')
    setModalData({ dateAdministered: new Date().toISOString().split('T')[0] })
    setModalError('')
    const animalData = animals.find((a: any) => a.id === selectedAnimal)
    const species = animalData?.species
    if (species) loadVaccineProtocolsForSpecies(species)
  }, [animals, selectedAnimal, loadVaccineProtocolsForSpecies])

  const handleProtocolSelect = (protocolId: string) => {
    const proto = vaccineProtocols.find((p: any) => p.id === protocolId)
    if (!proto) { setModalData((prev: any) => ({ ...prev, protocolId: '', vaccineName: '', vaccineType: '', dosage: '', nextDueDate: '' })); return }
    const today = new Date()
    const nextDue = proto.boosterIntervalDays > 0
      ? new Date(today.getTime() + proto.boosterIntervalDays * 86400000).toISOString().split('T')[0]
      : ''
    setModalData((prev: any) => ({
      ...prev,
      protocolId: proto.id,
      vaccineName: proto.name,
      vaccineType: proto.vaccineCategory,
      dosage: proto.dosageMl || '',
      nextDueDate: nextDue,
    }))
  }
  const getRecordTypeInfo = (type: string) => RECORD_TYPES.find(r => r.value === type) || RECORD_TYPES[7]
  const getSeverityInfo = (sev: string) => SEVERITY_OPTIONS.find(s => s.value === sev) || SEVERITY_OPTIONS[1]

  const enterprises = useMemo(() => {
    const map = new Map<string, string>()
    animals.forEach((a: any) => { if (a.enterpriseId || a.enterprise_id) map.set(a.enterpriseId || a.enterprise_id, a.enterpriseName || a.enterprise_name || 'Unknown Farm') })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [animals])

  const filteredAnimals = useMemo(() => {
    if (!enterpriseFilter) return animals
    if (enterpriseFilter === '__enterprise__') return animals.filter((a: any) => a.enterpriseId || a.enterprise_id)
    return animals.filter((a: any) => (a.enterpriseId || a.enterprise_id) === enterpriseFilter)
  }, [animals, enterpriseFilter])

  const selectedAnimalData = animals.find((a: any) => a.id === selectedAnimal)

  const TAB_ITEMS: { key: Tab; icon: string; label: string; count?: number }[] = [
    { key: 'overview', icon: '📊', label: t('medicalRecords.tabs.overview') },
    { key: 'consultations', icon: '🩺', label: t('medicalRecords.tabs.consultations'), count: stats?.consultations?.total ?? consultationsTotal },
    { key: 'prescriptions', icon: '💊', label: t('medicalRecords.tabs.prescriptions'), count: stats?.prescriptions?.total ?? prescriptionsTotal },
    { key: 'vaccinations', icon: '💉', label: t('medicalRecords.tabs.vaccinations'), count: stats?.vaccinations?.total ?? vaccinations.length },
    { key: 'lab_results', icon: '🔬', label: t('medicalRecords.tabs.labResults'), count: stats?.labResults?.total ?? labResults.length },
    { key: 'allergies', icon: '⚠️', label: t('medicalRecords.tabs.allergies'), count: stats?.allergies?.total ?? allergies.length },
    { key: 'weight', icon: '⚖️', label: t('medicalRecords.tabs.weight'), count: weightHistory.length },
    { key: 'timeline', icon: '📅', label: t('medicalRecords.tabs.timeline') },
    { key: 'hospital_visits', icon: '🏥', label: t('medicalRecords.tabs.hospitalVisits'), count: (hospitalVisits.queueVisits.length + hospitalVisits.inpatientAdmissions.length) || undefined },
  ]

  // ═══ RENDER ═══════════════════════════════════════════════

  if (loading) {
    return (
      <div className="module-page">
        <div className="module-header"><h1>{t('medicalRecords.pageTitle')}</h1></div>
        <div className="module-content" style={{ textAlign: 'center', padding: 60 }}>
          <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
          <p>{t('medicalRecords.loading')}</p>
        </div>
      </div>
    )
  }

  // Pet owners / farmers with no animals: show prominent shortcut
  if (!isVet && !isAdmin && animals.length === 0) {
    return (
      <div className="module-page">
        <div className="module-header"><h1>{t('medicalRecords.pageTitle')}</h1></div>
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🐾</div>
          <h2 style={{ color: '#374151', marginBottom: 8 }}>{t('medicalRecords.noAnimalsTitle')}</h2>
          <p style={{ color: '#6b7280', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>{t('medicalRecords.noAnimalsHint')}</p>
          <button className="module-btn primary" onClick={() => navigate('/animals')}>
            + {t('medicalRecords.registerAnimal')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page">
      <div className="module-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1>{t('medicalRecords.pageTitle')}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Animal selector */}
          {enterprises.length > 0 && (isVet || isAdmin) && (
            <select
              className="module-input"
              value={enterpriseFilter}
              onChange={e => setEnterpriseFilter(e.target.value)}
              style={{ width: 'auto', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
            >
              <option value="">All Animals</option>
              <option value="__enterprise__">🏢 {t('medicalRecords.enterpriseFarmAnimals')}</option>
              {enterprises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          )}
          <select
            value={selectedAnimal}
            onChange={(e) => setSelectedAnimal(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, minWidth: 180 }}
          >
            <option value="">{t('medicalRecords.allAnimals')}</option>
            {filteredAnimals.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.uniqueId || a.unique_id || ''} {a.name} — {a.species}{a.breed ? ` / ${a.breed}` : ''}{(isAdmin || isVet) && a.ownerName ? ` · ${a.ownerName}` : ''}
              </option>
            ))}
          </select>
          {(isVet || isAdmin || isFarmer) && (
            <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}
              onClick={() => { setShowModal('record'); setModalData({ recordType: 'diagnosis', severity: 'normal' }) }}>
              {t('medicalRecords.newRecord')}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 18px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 12, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#dc2626' }}>✕</button>
        </div>
      )}

      {/* Selected Animal Info Bar */}
      {selectedAnimalData && (
        <div style={{ padding: '12px 16px', background: '#f0f4ff', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#667eea' }}>🐾 {selectedAnimalData.uniqueId || selectedAnimalData.unique_id || 'N/A'}</span>
            <span><strong>{selectedAnimalData.name}</strong> ({selectedAnimalData.species}{selectedAnimalData.breed ? ` / ${selectedAnimalData.breed}` : ''})</span>
            {selectedAnimalData.ownerName && <span>{t('medicalRecords.animalInfo.owner')} {selectedAnimalData.ownerName}</span>}
            {selectedAnimalData.gender && <span>{t('medicalRecords.animalInfo.gender')} {selectedAnimalData.gender === 'male' ? t('medicalRecords.animalInfo.maleSymbol') : t('medicalRecords.animalInfo.femaleSymbol')}</span>}
            {selectedAnimalData.weight && <span>{t('medicalRecords.animalInfo.weight')} {selectedAnimalData.weight} kg</span>}
            {selectedAnimalData.dateOfBirth && <span>{t('medicalRecords.animalInfo.dob')} {fmtDate(selectedAnimalData.dateOfBirth || selectedAnimalData.date_of_birth)}</span>}
            {selectedAnimalData.isNeutered && <span style={{ color: '#059669' }}>{t('medicalRecords.animalInfo.neutered')}</span>}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 6 }}>
            {selectedAnimalData.microchipId && <span>🏷️ {t('medicalRecords.animalInfo.microchip')} <strong style={{ fontFamily: 'monospace' }}>{selectedAnimalData.microchipId}</strong></span>}
            {selectedAnimalData.earTagId && <span>🏷️ {t('medicalRecords.animalInfo.earTag')} <strong style={{ fontFamily: 'monospace' }}>{selectedAnimalData.earTagId}</strong></span>}
            {selectedAnimalData.registrationNumber && <span>📋 {t('medicalRecords.animalInfo.regNumber')} <strong style={{ fontFamily: 'monospace' }}>{selectedAnimalData.registrationNumber}</strong></span>}
            {selectedAnimalData.insuranceProvider && <span>🛡️ {t('medicalRecords.animalInfo.insurance')} <strong>{selectedAnimalData.insuranceProvider}</strong>{selectedAnimalData.insurancePolicyNumber ? ` (${selectedAnimalData.insurancePolicyNumber})` : ''}</span>}
          </div>
        </div>
      )}

      {/* Tabs — responsive pill navigation */}
      <div className="med-tabs">
        {TAB_ITEMS.map(tab => (
          <button
            key={tab.key}
            className={`med-tab${activeTab === tab.key ? ' med-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="med-tab__icon">{tab.icon}</span>
            <span className="med-tab__label">{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className="med-tab__badge">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="module-content">

        {/* ═══ OVERVIEW TAB ══════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div>
            {/* Stats Cards */}
            {stats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
                <StatCard icon="🩺" label={t('medicalRecords.overview.stats.consultations')} value={stats.consultations?.total || 0}
                  sub={stats.consultations?.completed ? `${stats.consultations.completed} ${t('medicalRecords.overview.completed')}` : ''} color="#667eea" />
                <StatCard icon="💊" label={t('medicalRecords.overview.stats.prescriptions')} value={stats.prescriptions?.total || 0}
                  sub={stats.prescriptions?.active ? `${stats.prescriptions.active} ${t('medicalRecords.overview.active')}` : ''} color="#059669" />
                <StatCard icon="💉" label={t('medicalRecords.overview.stats.vaccinations')} value={stats.vaccinations?.total || 0}
                  sub={stats.vaccinations?.upcomingDue ? `${stats.vaccinations.upcomingDue} ${t('medicalRecords.overview.dueSoon')}` : ''} color="#7c3aed" />
                <StatCard icon="🔬" label={t('medicalRecords.overview.stats.labResults')} value={stats.labResults?.total || 0}
                  sub={stats.labResults?.pending ? `${stats.labResults.pending} ${t('medicalRecords.overview.pending')}` : ''} color="#d97706" />
                <StatCard icon="⚠️" label={t('medicalRecords.overview.stats.activeAllergies')} value={stats.allergies?.active || 0} color="#dc2626" />
                <StatCard icon="📋" label={t('medicalRecords.overview.stats.medicalRecords')} value={stats.totalRecords || 0} color="#6b7280" />
                <StatCard icon="📅" label={t('medicalRecords.overview.stats.followUps')} value={stats.upcomingFollowUps || 0} color="#ea580c" />
              </div>
            )}

            {/* Quick Actions */}
            {(isVet || isAdmin || isFarmer) && selectedAnimal && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#374151' }}>{t('medicalRecords.overview.quickActions')}</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <QuickBtn label={t('medicalRecords.overview.addVaccination')} onClick={openVaccinationModal} />
                  <QuickBtn label={t('medicalRecords.overview.addWeight')} onClick={() => { setShowModal('weight'); setModalData({ unit: 'kg' }) }} />
                  <QuickBtn label={t('medicalRecords.overview.addAllergy')} onClick={() => { setShowModal('allergy'); setModalData({ severity: 'mild' }) }} />
                  <QuickBtn label={t('medicalRecords.overview.addLabResult')} onClick={() => { setShowModal('lab_result'); setModalData({ status: 'pending' }) }} />
                </div>
              </div>
            )}

            {/* Recent Activity preview */}
            {prescriptions.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#374151' }}>{t('medicalRecords.overview.recentPrescriptions')}</h3>
                <div className="records-list">
                  {prescriptions.slice(0, 5).map((rx: any) => (
                    <div key={rx.id} {...recordItemProps(rx.id)} style={{ borderLeft: '4px solid #059669' }}>
                      <div className="record-icon">💊</div>
                      <div className="record-details">
                        <h4>{Array.isArray(rx.medications) ? rx.medications.map((m: any) => m.name).join(', ') : t('medicalRecords.overview.medication')}</h4>
                        {rx.diagnosis && <p style={{ color: '#667eea', fontSize: 12 }}><strong>{t('medicalRecords.overview.diagnosis')}</strong> {rx.diagnosis}</p>}
                        <p className="text-muted" style={{ fontSize: 11 }}>
                          {rx.veterinarianName && `👨‍⚕️ Dr. ${rx.veterinarianName} • `}
                          {fmtDate(rx.createdAt || rx.created_at || '')}
                        </p>
                      </div>
                      <div className="record-actions">
                        <span className="badge badge-completed">{rx.isActive || rx.is_active ? t('medicalRecords.prescriptionsTab.active') : t('medicalRecords.prescriptionsTab.expired')}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {prescriptions.length > 5 && (
                  <button onClick={() => setActiveTab('prescriptions')} style={{ marginTop: 8, color: '#059669', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                    {t('medicalRecords.overview.viewAllPrescriptions', { count: prescriptionsTotal })}
                  </button>
                )}
              </div>
            )}

          </div>
        )}

        {/* ═══ CONSULTATIONS TAB ════════════════════════════ */}
        {activeTab === 'consultations' && (
          <div>
            {!selectedAnimal ? (
              <EmptyState icon="🩺" title={t('medicalRecords.consultationsTab.selectPet')} subtitle={t('medicalRecords.consultationsTab.selectPetSubtitle')} />
            ) : consultations.length === 0 ? (
              <EmptyState icon="🩺" title={t('medicalRecords.consultationsTab.emptyTitle')} subtitle={t('medicalRecords.consultationsTab.emptySubtitle')} />
            ) : (
              <div className="records-list">
                {consultations.map((c: any) => {
                  const statusColors: Record<string, string> = { completed: '#059669', in_progress: '#667eea', scheduled: '#d97706', cancelled: '#dc2626', missed: '#9ca3af' }
                  return (
                    <div key={c.id} {...recordItemProps(c.id)} style={{ borderLeft: `4px solid ${statusColors[c.status] || '#6b7280'}` }}>
                      <div className="record-icon">🩺</div>
                      <div className="record-details">
                        <h4>
                          {t('medicalRecords.consultationsTab.consultWith', { name: c.veterinarianName || t('medicalRecords.consultationsTab.unknown') })}
                          {c.prescriptionCount > 0 && <span style={{ fontSize: 11, color: '#059669', marginLeft: 8 }}>💊 {t('medicalRecords.consultationsTab.prescriptionCount', { count: c.prescriptionCount })}</span>}
                        </h4>
                        {c.diagnosis && <p><strong>{t('medicalRecords.consultationsTab.diagnosis')}</strong> {c.diagnosis}</p>}
                        {c.notes && <p className="text-muted">📝 {(c.notes || '').substring(0, 150)}{(c.notes || '').length > 150 ? '...' : ''}</p>}
                        <p className="text-muted">
                          {t('medicalRecords.consultationsTab.date')} {fmtDate(c.startTime || c.createdAt)}
                          {c.ownerName && ` • ${t('medicalRecords.consultationsTab.owner')} ${c.ownerName}`}
                          {c.followUpDate && ` • ${t('medicalRecords.consultationsTab.followUp')} ${fmtDate(c.followUpDate)}`}
                        </p>
                      </div>
                      <div className="record-actions">
                        <span className={`badge badge-${c.status === 'completed' ? 'completed' : c.status === 'cancelled' ? 'cancelled' : 'pending'}`}>{t(c.status === 'in_progress' ? 'common.inProgress' : `common.${c.status}`)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ PRESCRIPTIONS TAB ═════════════════════════════ */}
        {activeTab === 'prescriptions' && (
          <div>
            {(isVet || isAdmin) && selectedAnimal && (
              <div style={{ marginBottom: 12 }}>
                <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}
                  onClick={() => navigate(`/doctor/prescriptions/new?animalId=${selectedAnimal}`)}>
                  💊 {t('medicalRecords.prescriptionsTab.addButton')}
                </button>
              </div>
            )}
            {prescriptions.length === 0 ? (
              <EmptyState icon="💊" title={t('medicalRecords.prescriptionsTab.emptyTitle')} subtitle={selectedAnimal ? t('medicalRecords.prescriptionsTab.emptySubtitle') : t('medicalRecords.prescriptionsTab.emptySubtitle')} />
            ) : (
              <div className="records-list">
                {prescriptions.map((rx: any) => (
                  <div key={rx.id} {...recordItemProps(rx.id)} style={{ borderLeft: '4px solid #059669' }}>
                    <div className="record-icon">💊</div>
                    <div className="record-details">
                      <h4>{Array.isArray(rx.medications) ? rx.medications.map((m: any) => m.name).join(', ') : t('medicalRecords.prescriptionsTab.medication')}</h4>
                      {Array.isArray(rx.medications) && rx.medications.map((med: any, mi: number) => (
                        <p key={mi}><strong>{med.name}</strong>{med.dosage ? ` — ${med.dosage}` : ''}{med.frequency ? `, ${med.frequency}` : ''}{med.duration ? ` for ${med.duration}` : ''}</p>
                      ))}
                      {rx.diagnosis && <p style={{ color: '#667eea' }}><strong>{t('medicalRecords.prescriptionsTab.diagnosis')}</strong> {rx.diagnosis}</p>}
                      {rx.instructions && <p className="text-muted">📝 {rx.instructions}</p>}
                      <p className="text-muted">
                        {rx.veterinarianName && `👨‍⚕️ Dr. ${rx.veterinarianName} • `}
                        {t('medicalRecords.prescriptionsTab.prescribed')} {fmtDate(rx.createdAt || rx.created_at || '')} • {t('medicalRecords.prescriptionsTab.validUntil')} {fmtDate(rx.validUntil || rx.valid_until || '')}
                      </p>
                    </div>
                    <div className="record-actions">
                      <span className="badge badge-completed">{rx.isActive || rx.is_active ? t('medicalRecords.prescriptionsTab.active') : t('medicalRecords.prescriptionsTab.expired')}</span>
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
              <EmptyState icon="💉" title={t('medicalRecords.vaccinationsTab.selectPet')} subtitle={t('medicalRecords.selectPetGenericSub')} />
            ) : (
              <>
                {(isVet || isAdmin || isFarmer) && (
                  <div style={{ marginBottom: 12 }}>
                    <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}
                      onClick={openVaccinationModal}>
                      {t('medicalRecords.vaccinationsTab.addButton')}
                    </button>
                  </div>
                )}
                {vaccinations.length === 0 ? (
                  <EmptyState icon="💉" title={t('medicalRecords.vaccinationsTab.emptyTitle')} subtitle={t('medicalRecords.vaccinationsTab.emptySubtitle')} />
                ) : (
                  <div className="records-list">
                    {vaccinations.map((v: any) => {
                      const isOverdue = v.nextDueDate && new Date(v.nextDueDate) < new Date()
                      return (
                        <div key={v.id} {...recordItemProps(v.id)} style={{ borderLeft: `4px solid ${isOverdue ? '#dc2626' : '#7c3aed'}` }}>
                          <div className="record-icon">💉</div>
                          <div className="record-details">
                            <h4>{v.vaccineName} {v.vaccineType ? `(${v.vaccineType})` : ''}</h4>
                            <p>{t('medicalRecords.vaccinationsTab.administered')} {fmtDate(v.dateAdministered)} {v.administeredByName ? `by ${v.administeredByName}` : ''}</p>
                            {v.dosage && <p className="text-muted">{t('medicalRecords.vaccinationsTab.dosage')} {v.dosage}</p>}
                            {v.batchNumber && <p className="text-muted">{t('medicalRecords.vaccinationsTab.batch')} {v.batchNumber} {v.manufacturer ? `| ${v.manufacturer}` : ''}</p>}
                            {v.nextDueDate && <p className="text-muted">{t('medicalRecords.vaccinationsTab.nextDue')} <strong style={{ color: isOverdue ? '#dc2626' : '#059669' }}>{fmtDate(v.nextDueDate)}{isOverdue ? ` ${t('medicalRecords.vaccinationsTab.overdue')}` : ''}</strong></p>}
                            {v.certificateNumber && <p className="text-muted">{t('medicalRecords.vaccinationsTab.certificate')} {v.certificateNumber}</p>}
                            {v.reactionNotes && <p className="text-muted">{t('medicalRecords.vaccinationsTab.reaction')} {v.reactionNotes}</p>}
                          </div>
                          <div className="record-actions">
                            <span className={`badge ${v.isValid ? 'badge-completed' : 'badge-cancelled'}`}>{v.isValid ? t('medicalRecords.vaccinationsTab.valid') : t('medicalRecords.vaccinationsTab.invalid')}</span>
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
              <EmptyState icon="🔬" title={t('medicalRecords.labResultsTab.selectPet')} subtitle={t('medicalRecords.selectPetGenericSub')} />
            ) : (
              <>
                {(isVet || isAdmin || isFarmer) && (
                  <div style={{ marginBottom: 12 }}>
                    <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}
                      onClick={() => { setShowModal('lab_result'); setModalData({ status: 'pending' }) }}>
                      {t('medicalRecords.labResultsTab.addButton')}
                    </button>
                  </div>
                )}
                {labResults.length === 0 ? (
                  <EmptyState icon="🔬" title={t('medicalRecords.labResultsTab.emptyTitle')} subtitle={t('medicalRecords.labResultsTab.emptySubtitle')} />
                ) : (
                  <div className="records-list">
                    {labResults.map((lr: any) => (
                      <div key={lr.id} {...recordItemProps(lr.id)} style={{ borderLeft: `4px solid ${lr.isAbnormal ? '#dc2626' : '#d97706'}` }}>
                        <div className="record-icon">🔬</div>
                        <div className="record-details">
                          <h4>{lr.testName} {lr.testCategory ? `(${lr.testCategory})` : ''}</h4>
                          <p>{t('medicalRecords.labResultsTab.testDate')} {fmtDate(lr.testDate)} {lr.orderedByName ? `| ${t('medicalRecords.labResultsTab.orderedBy')} ${lr.orderedByName}` : ''}</p>
                          {lr.resultValue && (
                            <p><strong>{t('medicalRecords.labResultsTab.result')}</strong> {lr.resultValue} {lr.unit || ''} {lr.normalRange ? <span className="text-muted">({t('medicalRecords.labResultsTab.normal')} {lr.normalRange})</span> : ''}</p>
                          )}
                          {lr.interpretation && <p className="text-muted">📝 {lr.interpretation}</p>}
                          {lr.labName && <p className="text-muted">{t('medicalRecords.labResultsTab.lab')} {lr.labName}</p>}
                        </div>
                        <div className="record-actions" style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                          <span className={`badge ${lr.status === 'completed' ? 'badge-completed' : lr.status === 'pending' ? 'badge-pending' : 'badge-info'}`}>{t(lr.status === 'in_progress' ? 'common.inProgress' : `common.${lr.status}`)}</span>
                          {lr.isAbnormal && <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', fontWeight: 700 }}>{t('medicalRecords.labResultsTab.abnormal')}</span>}
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
              <EmptyState icon="⚠️" title={t('medicalRecords.allergiesTab.selectPet')} subtitle={t('medicalRecords.selectPetGenericSub')} />
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}
                    onClick={() => { setShowModal('allergy'); setModalData({ severity: 'mild' }) }}>
                    {t('medicalRecords.allergiesTab.addButton')}
                  </button>
                </div>
                {allergies.length === 0 ? (
                  <EmptyState icon="✅" title={t('medicalRecords.allergiesTab.emptyTitle')} subtitle={t('medicalRecords.allergiesTab.emptySubtitle')} />
                ) : (
                  <div className="records-list">
                    {allergies.map((al: any) => {
                      const sevColor = al.severity === 'severe' ? '#dc2626' : al.severity === 'moderate' ? '#d97706' : '#059669'
                      return (
                        <div key={al.id} {...recordItemProps(al.id)} style={{ borderLeft: `4px solid ${sevColor}` }}>
                          <div className="record-icon">⚠️</div>
                          <div className="record-details">
                            <h4>{al.allergen}</h4>
                            {al.reaction && <p>{t('medicalRecords.allergiesTab.reaction')} {al.reaction}</p>}
                            <p className="text-muted">
                              {t('medicalRecords.allergiesTab.severity')} <strong style={{ color: sevColor }}>{al.severity}</strong>
                              {al.identifiedDate ? ` | ${t('medicalRecords.allergiesTab.identified')} ${fmtDate(al.identifiedDate)}` : ''}
                              {al.reportedByName ? ` | ${t('medicalRecords.allergiesTab.reportedBy')} ${al.reportedByName}` : ''}
                            </p>
                            {al.notes && <p className="text-muted">📝 {al.notes}</p>}
                          </div>
                          <div className="record-actions">
                            <span className={`badge ${al.isActive ? 'badge-cancelled' : 'badge-completed'}`}>{al.isActive ? t('medicalRecords.allergiesTab.active') : t('medicalRecords.allergiesTab.resolved')}</span>
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
              <EmptyState icon="⚖️" title={t('medicalRecords.weightTab.selectPet')} subtitle={t('medicalRecords.selectPetGenericSub')} />
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}
                    onClick={() => { setShowModal('weight'); setModalData({ unit: 'kg' }) }}>
                    {t('medicalRecords.weightTab.addButton')}
                  </button>
                </div>
                {weightHistory.length === 0 ? (
                  <EmptyState icon="⚖️" title={t('medicalRecords.weightTab.emptyTitle')} subtitle={t('medicalRecords.weightTab.emptySubtitle')} />
                ) : (
                  <>
                    {/* Weight Chart (simple text-based) */}
                    <div style={{ marginBottom: 20, padding: 16, background: '#f9fafb', borderRadius: 8 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{t('medicalRecords.weightTab.weightTrend')}</h4>
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
                        {t('medicalRecords.weightTab.latest')} <strong>{weightHistory[0]?.weight} {weightHistory[0]?.unit}</strong>
                        {weightHistory.length > 1 && (() => {
                          const diff = (parseFloat(weightHistory[0].weight) - parseFloat(weightHistory[1].weight)).toFixed(2)
                          const num = parseFloat(diff)
                          return ` (${num > 0 ? '+' : ''}${diff} ${weightHistory[0].unit} ${t('medicalRecords.weightTab.fromLast')})`
                        })()}
                      </p>
                    </div>
                    <div className="records-list">
                      {weightHistory.map((w: any) => (
                        <div key={w.id} {...recordItemProps(w.id)} style={{ borderLeft: '4px solid #667eea' }}>
                          <div className="record-icon">⚖️</div>
                          <div className="record-details">
                            <h4>{w.weight} {w.unit}</h4>
                            <p className="text-muted">{t('medicalRecords.weightTab.recorded')} {fmtDate(w.recordedAt)} {w.recordedByName ? `by ${w.recordedByName}` : ''}</p>
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
              <EmptyState icon="📅" title={t('medicalRecords.timelineTab.selectPet')} subtitle={t('medicalRecords.timelineTab.selectSubtitle')} />
            ) : timeline.length === 0 ? (
              <EmptyState icon="📅" title={t('medicalRecords.timelineTab.emptyTitle')} subtitle={t('medicalRecords.timelineTab.emptySubtitle')} />
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
                        {item.createdByName && <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{t('medicalRecords.timelineTab.by')} {item.createdByName}</p>}
                        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                          {item.status && <span className={`badge badge-${item.status === 'active' || item.status === 'valid' ? 'completed' : item.status === 'pending' ? 'pending' : 'info'}`} style={{ fontSize: 10 }}>{t(item.status === 'in_progress' ? 'common.inProgress' : `common.${item.status}`)}</span>}
                          {item.severity && item.severity !== 'normal' && <span className="badge" style={{ fontSize: 10, background: getSeverityInfo(item.severity).color, color: '#fff' }}>{t(`medicalRecords.severityLevels.${item.severity}`)}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ HOSPITAL VISITS TAB ══════════════════════════════ */}
        {activeTab === 'hospital_visits' && (
          <div>
            {!selectedAnimal ? (
              <EmptyState icon="🏥" title={t('medicalRecords.hospitalVisitsTab.selectPet')} subtitle={t('medicalRecords.hospitalVisitsTab.selectPetHint')} />
            ) : loadingHospitalVisits ? (
              <div style={{ textAlign: 'center', padding: 40 }}><div className="loading-spinner" style={{ margin: '0 auto' }} /></div>
            ) : (hospitalVisits.queueVisits.length === 0 && hospitalVisits.inpatientAdmissions.length === 0) ? (
              <EmptyState icon="🏥" title={t('medicalRecords.hospitalVisitsTab.emptyTitle')} subtitle={t('medicalRecords.hospitalVisitsTab.emptyHint')} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Queue / Walk-in Visits */}
                {hospitalVisits.queueVisits.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 10 }}>🚶 {t('medicalRecords.hospitalVisitsTab.queueVisits')} ({hospitalVisits.queueVisits.length})</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {hospitalVisits.queueVisits.map((v: any) => {
                        const statusColor: Record<string, string> = { waiting: '#f59e0b', in_triage: '#8b5cf6', in_examination: '#2563eb', in_treatment: '#059669', discharged: '#64748b', no_show: '#dc2626' }
                        const sc = statusColor[v.status] || '#64748b'
                        return (
                          <div key={v.id} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.07)', borderLeft: `4px solid ${sc}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>🏥 {v.hospital_name}</div>
                                {v.reason && <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>📋 {v.reason}</div>}
                                {v.chief_complaint && v.chief_complaint !== v.reason && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Case: {v.chief_complaint}</div>}
                                {v.diagnosis && <div style={{ fontSize: 12, color: '#059669', marginTop: 2 }}>🩺 {v.diagnosis}</div>}
                                {(v.vet_first_name || v.vet_last_name) && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>👨‍⚕️ Dr. {v.vet_first_name} {v.vet_last_name}</div>}
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: `${sc}20`, color: sc }}>#{v.queue_number} · {(v.status || '').replace(/_/g, ' ')}</span>
                                {v.priority !== 'normal' && <div style={{ fontSize: 11, color: '#b45309', marginTop: 4, fontWeight: 600 }}>⚡ {v.priority}</div>}
                                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{v.checked_in_at ? fmtDate(v.checked_in_at) : ''}</div>
                                {v.case_stage && <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>📊 Case: {v.case_stage}</div>}
                              </div>
                            </div>
                            {v.triage_notes && <div style={{ marginTop: 8, padding: '6px 10px', background: '#fef9c3', borderRadius: 6, fontSize: 12, color: '#92400e' }}>📝 Triage: {v.triage_notes}</div>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Inpatient Admissions */}
                {hospitalVisits.inpatientAdmissions.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 10 }}>🛏️ {t('medicalRecords.hospitalVisitsTab.inpatientAdmissions')} ({hospitalVisits.inpatientAdmissions.length})</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {hospitalVisits.inpatientAdmissions.map((a: any) => {
                        const statusColor: Record<string, string> = { admitted: '#2563eb', in_treatment: '#b45309', recovering: '#059669', ready_to_discharge: '#0ea5e9', discharged: '#64748b', icu: '#991b1b' }
                        const sc = statusColor[a.status] || '#64748b'
                        const vitals = Array.isArray(a.vitals_log) ? a.vitals_log : (() => { try { return JSON.parse(a.vitals_log || '[]') } catch { return [] } })()
                        return (
                          <div key={a.id} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.07)', borderLeft: `4px solid ${sc}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>🏥 {a.hospital_name}</div>
                                <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>🛏️ {(a.admission_type || '').replace(/_/g, ' ')}{a.room_number ? ` · Room ${a.room_number}` : ''}</div>
                                {a.care_instructions && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>💊 {a.care_instructions.substring(0, 80)}{a.care_instructions.length > 80 ? '...' : ''}</div>}
                                {a.discharge_notes && <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>📋 {a.discharge_notes.substring(0, 80)}</div>}
                                {(a.vet_first_name || a.vet_last_name) && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>👨‍⚕️ Dr. {a.vet_first_name} {a.vet_last_name}</div>}
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: `${sc}20`, color: sc }}>{(a.status || '').replace(/_/g, ' ')}</span>
                                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>In: {fmtDate(a.admitted_at)}</div>
                                {a.discharged_at && <div style={{ fontSize: 11, color: '#94a3b8' }}>Out: {fmtDate(a.discharged_at)}</div>}
                                {vitals.length > 0 && <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>📊 {vitals.length} vitals recorded</div>}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ═══ CREATE MODALS ═══════════════════════════════════ */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={closeModal}>
          <div style={{ background: '#fff', borderRadius: 12, maxWidth: 600, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }}
            onClick={(e) => e.stopPropagation()}>
            {modalError && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>⚠ {modalError}</span>
                <button onClick={() => setModalError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#b91c1c', padding: 0, marginLeft: 8 }}>✕</button>
              </div>
            )}

            {/* Medical Record Modal */}
            {showModal === 'record' && (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{t('medicalRecords.modals.newRecord')}</h2>
                <ModalField label={t('medicalRecords.modals.recordType')}>
                  <select value={modalData.recordType || ''} onChange={(e) => setModalData({ ...modalData, recordType: e.target.value })} style={inputStyle}>
                    {RECORD_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.icon} {t(`medicalRecords.recordTypes.${rt.value === 'lab_report' ? 'labReport' : rt.value === 'follow_up' ? 'followUp' : rt.value}`)}</option>)}
                  </select>
                </ModalField>
                <ModalField label={t('medicalRecords.modals.title')}><input value={modalData.title || ''} onChange={(e) => setModalData({ ...modalData, title: e.target.value })} style={inputStyle} placeholder={t('medicalRecords.modals.recordTitlePlaceholder')} /></ModalField>
                <ModalField label={t('medicalRecords.modals.content')}><textarea value={modalData.content || ''} onChange={(e) => setModalData({ ...modalData, content: e.target.value })} style={{ ...inputStyle, height: 100 }} placeholder={t('medicalRecords.modals.contentPlaceholder')} /></ModalField>
                <ModalField label={t('medicalRecords.modals.severity')}>
                  <select value={modalData.severity || 'normal'} onChange={(e) => setModalData({ ...modalData, severity: e.target.value })} style={inputStyle}>
                    {SEVERITY_OPTIONS.map(s => <option key={s.value} value={s.value}>{t(`medicalRecords.severityLevels.${s.value}`)}</option>)}
                  </select>
                </ModalField>
                <ModalField label={t('medicalRecords.modals.followUpDate')}>
                  <input type="date" value={modalData.followUpDate || ''} onChange={(e) => setModalData({ ...modalData, followUpDate: e.target.value })} style={inputStyle} />
                </ModalField>
                <ModalActions onCancel={closeModal} onSave={handleSaveRecord} saving={saving}
                  disabled={!modalData.recordType || !modalData.title || !modalData.content} />
              </>
            )}

            {/* Vaccination Modal */}
            {showModal === 'vaccination' && (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{t('medicalRecords.modals.addVaccination')}</h2>
                {selectedAnimalData && (
                  <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
                    {selectedAnimalData.name} &bull; {selectedAnimalData.species}{selectedAnimalData.breed ? ` / ${selectedAnimalData.breed}` : ''}
                  </p>
                )}

                {/* Protocol Selector — primary integration point */}
                <ModalField label={t('medicalRecords.modals.selectProtocol')}>
                  {loadingProtocols ? (
                    <div style={{ padding: '8px 0', fontSize: 13, color: '#6b7280' }}>{t('common.loading')}</div>
                  ) : vaccineProtocols.length > 0 ? (
                    <select
                      value={modalData.protocolId || ''}
                      onChange={(e) => handleProtocolSelect(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">{t('medicalRecords.modals.selectProtocolPlaceholder')}</option>
                      {vaccineProtocols.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} &mdash; {p.vaccineCategory?.replace('_', ' ')} ({p.disease})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0' }}>{t('medicalRecords.modals.noProtocolsForSpecies')}</p>
                  )}
                </ModalField>

                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 14, marginTop: 4 }}>
                  <ModalField label={t('medicalRecords.modals.vaccineName')}><input value={modalData.vaccineName || ''} onChange={(e) => setModalData({ ...modalData, vaccineName: e.target.value })} style={inputStyle} placeholder={t('medicalRecords.modals.vaccineNamePlaceholder')} /></ModalField>
                  <ModalField label={t('medicalRecords.modals.vaccineType')}><input value={modalData.vaccineType || ''} onChange={(e) => setModalData({ ...modalData, vaccineType: e.target.value })} style={inputStyle} placeholder={t('medicalRecords.modals.vaccineTypePlaceholder')} /></ModalField>
                  <ModalField label={t('medicalRecords.modals.dateAdministered')}><input type="date" value={modalData.dateAdministered || ''} onChange={(e) => setModalData({ ...modalData, dateAdministered: e.target.value })} style={inputStyle} /></ModalField>
                  <ModalField label={t('medicalRecords.modals.nextDueDate')}><input type="date" value={modalData.nextDueDate || ''} onChange={(e) => setModalData({ ...modalData, nextDueDate: e.target.value })} style={inputStyle} /></ModalField>
                  <ModalField label={t('medicalRecords.modals.dosage')}><input value={modalData.dosage || ''} onChange={(e) => setModalData({ ...modalData, dosage: e.target.value })} style={inputStyle} placeholder={t('medicalRecords.modals.dosagePlaceholder')} /></ModalField>
                  <ModalField label={t('medicalRecords.modals.batchNumber')}><input value={modalData.batchNumber || ''} onChange={(e) => setModalData({ ...modalData, batchNumber: e.target.value })} style={inputStyle} /></ModalField>
                  <ModalField label={t('medicalRecords.modals.manufacturer')}><input value={modalData.manufacturer || ''} onChange={(e) => setModalData({ ...modalData, manufacturer: e.target.value })} style={inputStyle} /></ModalField>
                  <ModalField label={t('medicalRecords.modals.certificateNumber')}><input value={modalData.certificateNumber || ''} onChange={(e) => setModalData({ ...modalData, certificateNumber: e.target.value })} style={inputStyle} /></ModalField>
                  <ModalField label={t('medicalRecords.modals.reactionNotes')}><textarea value={modalData.reactionNotes || ''} onChange={(e) => setModalData({ ...modalData, reactionNotes: e.target.value })} style={{ ...inputStyle, height: 60 }} placeholder={t('medicalRecords.modals.reactionPlaceholder')} /></ModalField>
                </div>

                <ModalActions onCancel={closeModal} onSave={handleSaveVaccination} saving={saving}
                  disabled={!modalData.vaccineName || !modalData.dateAdministered} />
              </>
            )}

            {/* Weight Modal */}
            {showModal === 'weight' && (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{t('medicalRecords.modals.recordWeight')}</h2>
                <ModalField label={t('medicalRecords.modals.weightValue')}><input type="number" step="0.01" value={modalData.weight || ''} onChange={(e) => setModalData({ ...modalData, weight: e.target.value })} style={inputStyle} placeholder={t('medicalRecords.modals.weightPlaceholder')} /></ModalField>
                <ModalField label={t('medicalRecords.modals.unit')}>
                  <select value={modalData.unit || 'kg'} onChange={(e) => setModalData({ ...modalData, unit: e.target.value })} style={inputStyle}>
                    <option value="kg">kg</option><option value="lbs">lbs</option><option value="g">g</option>
                  </select>
                </ModalField>
                <ModalField label={t('medicalRecords.modals.notes')}><textarea value={modalData.notes || ''} onChange={(e) => setModalData({ ...modalData, notes: e.target.value })} style={{ ...inputStyle, height: 60 }} placeholder={t('medicalRecords.modals.notesPlaceholder')} /></ModalField>
                <ModalActions onCancel={closeModal} onSave={handleSaveWeight} saving={saving}
                  disabled={!modalData.weight} />
              </>
            )}

            {/* Allergy Modal */}
            {showModal === 'allergy' && (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{t('medicalRecords.modals.reportAllergy')}</h2>
                <ModalField label={t('medicalRecords.modals.allergen')}><input value={modalData.allergen || ''} onChange={(e) => setModalData({ ...modalData, allergen: e.target.value })} style={inputStyle} placeholder={t('medicalRecords.modals.allergenPlaceholder')} /></ModalField>
                <ModalField label={t('medicalRecords.modals.reaction')}><textarea value={modalData.reaction || ''} onChange={(e) => setModalData({ ...modalData, reaction: e.target.value })} style={{ ...inputStyle, height: 60 }} placeholder={t('medicalRecords.modals.reactionDescPlaceholder')} /></ModalField>
                <ModalField label={t('medicalRecords.modals.severity')}>
                  <select value={modalData.severity || 'mild'} onChange={(e) => setModalData({ ...modalData, severity: e.target.value })} style={inputStyle}>
                    <option value="mild">{t('medicalRecords.modals.allergyMild')}</option><option value="moderate">{t('medicalRecords.modals.allergyModerate')}</option><option value="severe">{t('medicalRecords.modals.allergySevere')}</option>
                  </select>
                </ModalField>
                <ModalField label={t('medicalRecords.modals.dateIdentified')}><input type="date" value={modalData.identifiedDate || ''} onChange={(e) => setModalData({ ...modalData, identifiedDate: e.target.value })} style={inputStyle} /></ModalField>
                <ModalField label={t('medicalRecords.modals.notes')}><textarea value={modalData.notes || ''} onChange={(e) => setModalData({ ...modalData, notes: e.target.value })} style={{ ...inputStyle, height: 60 }} /></ModalField>
                <ModalActions onCancel={closeModal} onSave={handleSaveAllergy} saving={saving}
                  disabled={!modalData.allergen} />
              </>
            )}

            {/* Lab Result Modal */}
            {showModal === 'lab_result' && (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{t('medicalRecords.modals.addLabResult')}</h2>
                <ModalField label={t('medicalRecords.modals.testName')}><input value={modalData.testName || ''} onChange={(e) => setModalData({ ...modalData, testName: e.target.value })} style={inputStyle} placeholder={t('medicalRecords.modals.testNamePlaceholder')} /></ModalField>
                <ModalField label={t('medicalRecords.modals.testCategory')}><input value={modalData.testCategory || ''} onChange={(e) => setModalData({ ...modalData, testCategory: e.target.value })} style={inputStyle} placeholder={t('medicalRecords.modals.testCategoryPlaceholder')} /></ModalField>
                <ModalField label={t('medicalRecords.modals.testDate')}><input type="date" value={modalData.testDate || ''} onChange={(e) => setModalData({ ...modalData, testDate: e.target.value })} style={inputStyle} /></ModalField>
                <ModalField label={t('medicalRecords.modals.resultValue')}><input value={modalData.resultValue || ''} onChange={(e) => setModalData({ ...modalData, resultValue: e.target.value })} style={inputStyle} placeholder={t('medicalRecords.modals.resultPlaceholder')} /></ModalField>
                <ModalField label={t('medicalRecords.modals.normalRange')}><input value={modalData.normalRange || ''} onChange={(e) => setModalData({ ...modalData, normalRange: e.target.value })} style={inputStyle} placeholder={t('medicalRecords.modals.normalRangePlaceholder')} /></ModalField>
                <ModalField label={t('medicalRecords.modals.unit')}><input value={modalData.unit || ''} onChange={(e) => setModalData({ ...modalData, unit: e.target.value })} style={inputStyle} placeholder={t('medicalRecords.modals.unitPlaceholder')} /></ModalField>
                <ModalField label={t('medicalRecords.modals.status')}>
                  <select value={modalData.status || 'pending'} onChange={(e) => setModalData({ ...modalData, status: e.target.value })} style={inputStyle}>
                    <option value="pending">{t('medicalRecords.modals.statusPending')}</option><option value="in_progress">{t('medicalRecords.modals.statusInProgress')}</option><option value="completed">{t('medicalRecords.modals.statusCompleted')}</option>
                  </select>
                </ModalField>
                <ModalField label={t('medicalRecords.modals.labName')}><input value={modalData.labName || ''} onChange={(e) => setModalData({ ...modalData, labName: e.target.value })} style={inputStyle} /></ModalField>
                <ModalField label={t('medicalRecords.modals.abnormalLabel')}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={modalData.isAbnormal || false} onChange={(e) => setModalData({ ...modalData, isAbnormal: e.target.checked })} />
                    {t('medicalRecords.modals.abnormalLabel')}
                  </label>
                </ModalField>
                <ModalField label={t('medicalRecords.modals.interpretation')}><textarea value={modalData.interpretation || ''} onChange={(e) => setModalData({ ...modalData, interpretation: e.target.value })} style={{ ...inputStyle, height: 60 }} placeholder={t('medicalRecords.modals.interpretationPlaceholder')} /></ModalField>
                <ModalField label={t('medicalRecords.modals.notes')}><textarea value={modalData.notes || ''} onChange={(e) => setModalData({ ...modalData, notes: e.target.value })} style={{ ...inputStyle, height: 60 }} /></ModalField>
                <ModalActions onCancel={closeModal} onSave={handleSaveLabResult} saving={saving}
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

const ModalActions: React.FC<{ onCancel: () => void; onSave: () => void; saving: boolean; disabled: boolean }> = ({ onCancel, onSave, saving, disabled }) => {
  const { t } = useTranslation()
  return (
  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
    <button onClick={onCancel} style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151' }}>{t('medicalRecords.modals.cancel')}</button>
    <button onClick={onSave} disabled={disabled || saving} className="btn-primary" style={{ padding: '8px 20px', fontSize: 13, opacity: (disabled || saving) ? 0.5 : 1 }}>
      {saving ? t('medicalRecords.modals.saving') : t('medicalRecords.modals.save')}
    </button>
  </div>
  )
}

export default MedicalRecords
