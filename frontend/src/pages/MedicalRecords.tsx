import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import { useMasterData } from '../context/MasterDataContext'
import apiService from '../services/api'
import './ModulePage.css'
import { useTranslation } from 'react-i18next'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import type { Tab } from '../components/medicalRecords/medicalRecordsShared'
import MedicalRecordsHeader from '../components/medicalRecords/MedicalRecordsHeader'
import TabsNav, { TabItem } from '../components/medicalRecords/TabsNav'
import OverviewTab from '../components/medicalRecords/OverviewTab'
import ConsultationsTab from '../components/medicalRecords/ConsultationsTab'
import PrescriptionsTab from '../components/medicalRecords/PrescriptionsTab'
import VaccinationsTab from '../components/medicalRecords/VaccinationsTab'
import LabResultsTab from '../components/medicalRecords/LabResultsTab'
import AllergiesTab from '../components/medicalRecords/AllergiesTab'
import WeightTab from '../components/medicalRecords/WeightTab'
import TimelineTab from '../components/medicalRecords/TimelineTab'
import RecordsTab from '../components/medicalRecords/RecordsTab'
import HospitalVisitsTab from '../components/medicalRecords/HospitalVisitsTab'
import CertificatesTab from '../components/medicalRecords/CertificatesTab'
import RecordModals from '../components/medicalRecords/RecordModals'

const MedicalRecords: React.FC = () => {
  const { t } = useTranslation()

  const { formatDate } = useSettings()
  const { user } = useAuth()
  const { speciesLabel } = useMasterData()
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
  const [networkReferralHistory, setNetworkReferralHistory] = useState<any[]>([])
  const [medRecords, setMedRecords] = useState<any[]>([])
  const [recordTypeFilter, setRecordTypeFilter] = useState('')
  const [enterpriseFilter, setEnterpriseFilter] = useState('')
  const [certificates, setCertificates] = useState<any[]>([])
  const [certsLoading, setCertsLoading] = useState(false)
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
    } catch (err: any) {
      console.error('Failed to load animals:', err?.message)
      setError(err?.response?.data?.error?.message || err?.message || t('medicalRecords.failedToLoad'))
    }
  }, [selectedAnimal, deepLinkAnimalId])

  const loadStats = useCallback(async () => {
    try {
      const params: any = {};
      if (selectedAnimal) params.animalId = selectedAnimal;
      const res = await apiService.getMedicalStats(params)
      setStats(res.data)
    } catch (err: any) {
      console.error('Failed to load stats:', err?.message)
    }
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
    try {
      // P4-MED2: Use unified referral endpoint instead of network-only endpoint
      const refRes = await apiService.getAnimalReferrals(selectedAnimal)
      setNetworkReferralHistory(refRes.data?.referrals || [])
    } catch { setNetworkReferralHistory([]) }
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

  const loadMedRecords = useCallback(async (typeFilter?: string) => {
    if (!selectedAnimal) { setMedRecords([]); return }
    try {
      const params: any = { animalId: selectedAnimal, limit: 100 }
      if (typeFilter) params.recordType = typeFilter
      const res = await apiService.listMedicalRecords(params)
      setMedRecords(res.data?.records || res.data?.items || (Array.isArray(res.data) ? res.data : []))
    } catch { setMedRecords([]) }
  }, [selectedAnimal])

  const loadCertificates = useCallback(async () => {
    if (!selectedAnimal) { setCertificates([]); return }
    setCertsLoading(true)
    try {
      // `/vet-certificates` was never a registered route - this 404'd for every
      // animal and the catch below rendered it as "no certificates", so the panel
      // was permanently empty. The real route is /certificates/animal/:animalId.
      const res = await (apiService as any).get(`/certificates/animal/${selectedAnimal}`)
      const payload = res.data?.data ?? res.data
      // Only ever hand an array to setCertificates - `res.data || []` previously
      // could pass the whole { success, data } envelope through and blow up .map().
      setCertificates(
        Array.isArray(payload) ? payload
        : Array.isArray(payload?.certificates) ? payload.certificates
        : Array.isArray(payload?.items) ? payload.items
        : []
      )
    } catch { setCertificates([]) } finally { setCertsLoading(false) }
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
  useAutoRefresh(['animals', 'prescriptions'], loadAnimals)

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
      if (activeTab === 'records') loadMedRecords(recordTypeFilter)
      if (activeTab === 'certificates') loadCertificates()
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
      if (activeTab === 'records') loadMedRecords(recordTypeFilter)
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

  const TAB_ITEMS: TabItem[] = [
    { key: 'overview', icon: '📊', label: t('medicalRecords.tabs.overview') },
    { key: 'consultations', icon: '🩺', label: t('medicalRecords.tabs.consultations'), count: stats?.consultations?.total ?? consultationsTotal },
    { key: 'prescriptions', icon: '💊', label: t('medicalRecords.tabs.prescriptions'), count: stats?.prescriptions?.total ?? prescriptionsTotal },
    { key: 'vaccinations', icon: '💉', label: t('medicalRecords.tabs.vaccinations'), count: stats?.vaccinations?.total ?? vaccinations.length },
    { key: 'lab_results', icon: '🔬', label: t('medicalRecords.tabs.labResults'), count: stats?.labResults?.total ?? labResults.length },
    { key: 'allergies', icon: '⚠️', label: t('medicalRecords.tabs.allergies'), count: stats?.allergies?.total ?? allergies.length },
    { key: 'weight', icon: '⚖️', label: t('medicalRecords.tabs.weight'), count: weightHistory.length },
    { key: 'records', icon: '📋', label: t('medicalRecords.tabs.records'), count: stats?.totalRecords || undefined },
    { key: 'timeline', icon: '📅', label: t('medicalRecords.tabs.timeline') },
    { key: 'hospital_visits', icon: '🏥', label: t('medicalRecords.tabs.hospitalVisits'), count: (hospitalVisits.queueVisits.length + hospitalVisits.inpatientAdmissions.length) || undefined },
    { key: 'certificates', icon: '📜', label: t('certificates.title'), count: certificates.length || undefined },
  ]

  // ═══ RENDER ═══════════════════════════════════════════════

  if (loading) {
    return (
      <div className="module-page">
        <div className="module-header"><h1>{t('medicalRecords.pageTitle')}</h1></div>
        <div className="module-content si-9fa8d292">
          <div className="loading-spinner si-9ad92aa9" />
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
        <div className="si-7d3f112c">
          <div className="si-71a36f28">🐾</div>
          <h2 className="si-68be4326">{t('medicalRecords.noAnimalsTitle')}</h2>
          <p className="si-b399e78f">{t('medicalRecords.noAnimalsHint')}</p>
          <button className="module-btn primary" onClick={() => navigate('/animals')}>
            + {t('medicalRecords.registerAnimal')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page">
      <MedicalRecordsHeader
        t={t} isVet={isVet} isAdmin={isAdmin} isFarmer={isFarmer}
        enterprises={enterprises} enterpriseFilter={enterpriseFilter} setEnterpriseFilter={setEnterpriseFilter}
        selectedAnimal={selectedAnimal} setSelectedAnimal={setSelectedAnimal} filteredAnimals={filteredAnimals}
        speciesLabel={speciesLabel} error={error} setError={setError}
        selectedAnimalData={selectedAnimalData} fmtDate={fmtDate}
        onNewRecord={() => { setShowModal('record'); setModalData({ recordType: 'diagnosis', severity: 'normal' }) }}
      />

      {/* Tabs - responsive pill navigation */}
      <TabsNav tabs={TAB_ITEMS} activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="module-content">

        {activeTab === 'overview' && (
          <OverviewTab
            t={t} stats={stats} isVet={isVet} isAdmin={isAdmin} isFarmer={isFarmer} selectedAnimal={selectedAnimal}
            prescriptions={prescriptions} prescriptionsTotal={prescriptionsTotal} recordItemProps={recordItemProps}
            fmtDate={fmtDate} openVaccinationModal={openVaccinationModal} setShowModal={setShowModal}
            setModalData={setModalData} setRecordTypeFilter={setRecordTypeFilter} setActiveTab={setActiveTab}
            loadMedRecords={loadMedRecords}
          />
        )}

        {activeTab === 'consultations' && (
          <ConsultationsTab t={t} selectedAnimal={selectedAnimal} consultations={consultations} recordItemProps={recordItemProps} fmtDate={fmtDate} />
        )}

        {activeTab === 'prescriptions' && (
          <PrescriptionsTab t={t} isVet={isVet} isAdmin={isAdmin} selectedAnimal={selectedAnimal} prescriptions={prescriptions} recordItemProps={recordItemProps} fmtDate={fmtDate} />
        )}

        {activeTab === 'vaccinations' && (
          <VaccinationsTab t={t} isVet={isVet} isAdmin={isAdmin} isFarmer={isFarmer} selectedAnimal={selectedAnimal} vaccinations={vaccinations} recordItemProps={recordItemProps} fmtDate={fmtDate} openVaccinationModal={openVaccinationModal} />
        )}

        {activeTab === 'lab_results' && (
          <LabResultsTab t={t} isVet={isVet} isAdmin={isAdmin} isFarmer={isFarmer} selectedAnimal={selectedAnimal} labResults={labResults} recordItemProps={recordItemProps} fmtDate={fmtDate} setShowModal={setShowModal} setModalData={setModalData} />
        )}

        {activeTab === 'allergies' && (
          <AllergiesTab t={t} selectedAnimal={selectedAnimal} allergies={allergies} recordItemProps={recordItemProps} fmtDate={fmtDate} setShowModal={setShowModal} setModalData={setModalData} />
        )}

        {activeTab === 'weight' && (
          <WeightTab t={t} selectedAnimal={selectedAnimal} weightHistory={weightHistory} recordItemProps={recordItemProps} fmtDate={fmtDate} setShowModal={setShowModal} setModalData={setModalData} />
        )}

        {activeTab === 'timeline' && (
          <TimelineTab t={t} selectedAnimal={selectedAnimal} timeline={timeline} fmtDate={fmtDate} />
        )}

        {activeTab === 'records' && (
          <RecordsTab t={t} selectedAnimal={selectedAnimal} medRecords={medRecords} recordTypeFilter={recordTypeFilter} setRecordTypeFilter={setRecordTypeFilter} loadMedRecords={loadMedRecords} fmtDate={fmtDate} />
        )}

        {activeTab === 'hospital_visits' && (
          <HospitalVisitsTab t={t} selectedAnimal={selectedAnimal} loadingHospitalVisits={loadingHospitalVisits} hospitalVisits={hospitalVisits} networkReferralHistory={networkReferralHistory} fmtDate={fmtDate} />
        )}

        {activeTab === 'certificates' && (
          <CertificatesTab t={t} isVet={isVet} isAdmin={isAdmin} certsLoading={certsLoading} certificates={certificates} formatDate={formatDate} />
        )}

      </div>

      {/* ═══ CREATE MODALS ═══════════════════════════════════ */}
      <RecordModals
        t={t} showModal={showModal} modalData={modalData} setModalData={setModalData}
        modalError={modalError} setModalError={setModalError} saving={saving} closeModal={closeModal}
        handleSaveRecord={handleSaveRecord} handleSaveVaccination={handleSaveVaccination}
        handleSaveWeight={handleSaveWeight} handleSaveAllergy={handleSaveAllergy} handleSaveLabResult={handleSaveLabResult}
        vaccineProtocols={vaccineProtocols} loadingProtocols={loadingProtocols} handleProtocolSelect={handleProtocolSelect}
        selectedAnimalData={selectedAnimalData} speciesLabel={speciesLabel}
      />
    </div>
  )
}

export default MedicalRecords
