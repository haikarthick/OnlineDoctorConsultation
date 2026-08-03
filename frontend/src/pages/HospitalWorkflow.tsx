import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../context/SettingsContext'
import { vetHospitalApi } from '../services/api/vetHospitalApi'
import apiService from '../services/api'
import AnimalSearchPicker from '../components/AnimalSearchPicker'
import VetSearchPicker from '../components/VetSearchPicker'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { useMasterData } from '../context/MasterDataContext'

const STAGES = ['triage', 'examination', 'treatment', 'observation', 'discharge'] as const
const PRIORITIES = ['emergency', 'urgent', 'high', 'normal', 'low'] as const

const PRIORITY_COLORS: Record<string, string> = {
  emergency: '#dc2626', urgent: '#ea580c', high: '#d97706', normal: '#2563eb', low: '#6b7280',
}

// Triage level 1-5 maps directly to a priority - these are the SAME concept.
// Never show both independently; derive priority from level automatically.
const TRIAGE_LEVELS: Record<number, { priority: string; label: string; description: string; color: string; bg: string; icon: string }> = {
  1: { priority: 'emergency', label: 'Critical',  description: 'Immediate life-threatening - act now',  color: '#dc2626', bg: '#fee2e2', icon: '🚨' },
  2: { priority: 'urgent',    label: 'Urgent',    description: 'Serious condition - seen within 15 min', color: '#ea580c', bg: '#ffedd5', icon: '⚠️' },
  3: { priority: 'high',      label: 'High',      description: 'Significant concern - monitor closely',  color: '#d97706', bg: '#fef3c7', icon: '🔶' },
  4: { priority: 'normal',    label: 'Moderate',  description: 'Stable - routine attention required',    color: '#2563eb', bg: '#dbeafe', icon: '🔵' },
  5: { priority: 'low',       label: 'Minor',     description: 'Non-urgent - can wait for treatment',    color: '#6b7280', bg: '#f1f5f9', icon: '🟢' },
}
const STAGE_ICONS: Record<string, string> = {
  triage: '🏥', examination: '🔍', treatment: '💊', observation: '👁️', discharge: '✅',
}

export default function HospitalWorkflow() {
  const { t } = useTranslation()
  const { formatDateTime } = useSettings()
  const { speciesCategories, breedsForSpecies, breedLabel, classTermsForSpecies, findClassTerm, earTagSpecies, speciesLabel, resolveLabel } = useMasterData()

  const [tab, setTab] = useState<'queue' | 'workflow' | 'referrals'>('queue')
  const [hospitalId, setHospitalId] = useState('')
  const [hospitals, setHospitals] = useState<any[]>([])

  // Queue state
  const [queue, setQueue] = useState<any[]>([])
  const [queueStats, setQueueStats] = useState<any>(null)
  const [showCheckIn, setShowCheckIn] = useState(false)
  const [checkInForm, setCheckInForm] = useState({ reason: '', priority: 'normal', animalId: '', ownerId: '' })
  const [checkInError, setCheckInError] = useState('')
  const [checkInSubmitting, setCheckInSubmitting] = useState(false)
  const [queueStatusFilter, setQueueStatusFilter] = useState<string>('')  // for clickable stat tiles

  // Workflow state
  const [cases, setCases] = useState<any[]>([])
  const [dashboard, setDashboard] = useState<any>(null)
  const [stageFilter, setStageFilter] = useState('')
  const [selectedCase, setSelectedCase] = useState<any>(null)
  const [showNewCase, setShowNewCase] = useState(false)
  const [caseForm, setCaseForm] = useState({ chiefComplaint: '', priority: 'normal', animalId: '', ownerId: '' })

  // Referral state
  const [referrals, setReferrals] = useState<any[]>([])
  const [showNewReferral, setShowNewReferral] = useState(false)
  const [referralForm, setReferralForm] = useState({ reason: '', specialtyNeeded: '', priority: 'normal', clinicalNotes: '' })
  const [selectedToVet, setSelectedToVet] = useState<any>(null)
  const [referralError, setReferralError] = useState('')
  const [referralSubmitting, setReferralSubmitting] = useState(false)

  // Triage modal
  const [triageTarget, setTriageTarget] = useState<any>(null)
  const [triageForm, setTriageForm] = useState({ triageLevel: 3, triageNotes: '' })

  // Transition modal 
  const [transTarget, setTransTarget] = useState<any>(null)
  const [transStage, setTransStage] = useState('')
  const [transNotes, setTransNotes] = useState('')

  // Animal selections for modals
  const [checkInAnimal, setCheckInAnimal] = useState<any>(null)
  const [caseAnimal, setCaseAnimal] = useState<any>(null)
  const [referralAnimal, setReferralAnimal] = useState<any>(null)
  // Medical summary for case detail
  const [caseMedicalSummary, setCaseMedicalSummary] = useState<any>(null)

  // Walk-in patient registration (within check-in modal)
  const [checkInMode, setCheckInMode] = useState<'search' | 'register'>('search')
  const [walkInForm, setWalkInForm] = useState({
    ownerName: '', ownerPhone: '', ownerEmail: '', ownerAddress: '',
    animalName: '', animalSpecies: '', animalBreed: '',
    animalGender: '', animalClass: '', animalDob: '', animalWeight: '',
    animalColor: '', animalMicrochipId: '', animalRegistrationNumber: '',
    animalIsNeutered: false, animalMedicalNotes: '',
    animalInsuranceProvider: '', animalInsurancePolicyNumber: '', animalInsuranceExpiry: '',
    animalEarTagId: '', animalCustomBreed: '',
  })
  const [walkInPhotoFile, setWalkInPhotoFile] = useState<File | null>(null)
  const [walkInPhotoPreview, setWalkInPhotoPreview] = useState<string>('')
  const [walkInRegistering, setWalkInRegistering] = useState(false)
  const [walkInError, setWalkInError] = useState('')

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Derived: current hospital's network ID (for walk-in registration)
  const currentHospital = hospitals.find(h => h.id === hospitalId)
  const networkId: string | null = currentHospital?.branchNetworkId || null

  // Load hospitals
  useEffect(() => {
    (async () => {
      try {
        const list = await vetHospitalApi.listMyHospitals()
        setHospitals(list || [])
        if (list.length > 0) setHospitalId(list[0].id)
      } catch (err: any) {
        console.error('Failed to load hospitals:', err)
        setLoadError(err?.response?.data?.message || err?.message || 'Failed to load hospitals')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Load data when hospital changes
  const loadQueue = useCallback(async () => {
    if (!hospitalId) return
    try {
      const [q, s] = await Promise.all([
        apiService.getQueue(hospitalId),
        apiService.getQueueStats(hospitalId),
      ])
      setQueue(q.data || [])
      setQueueStats(s.data || null)
    } catch (err: any) {
      console.error('Failed to load queue:', err)
      setLoadError(err?.response?.data?.message || 'Failed to load queue data')
    }
  }, [hospitalId])

  const loadWorkflow = useCallback(async () => {
    if (!hospitalId) return
    try {
      const [c, d] = await Promise.all([
        apiService.listWorkflowCases(hospitalId, stageFilter ? { stage: stageFilter } : undefined),
        apiService.getWorkflowDashboard(hospitalId),
      ])
      setCases(c.data || [])
      setDashboard(d.data || null)
    } catch (err: any) {
      console.error('Failed to load workflow:', err)
    }
  }, [hospitalId, stageFilter])

  const loadReferrals = useCallback(async () => {
    if (!hospitalId) return
    try {
      const r = await apiService.listReferrals(hospitalId)
      setReferrals(r.data || [])
    } catch (err: any) {
      console.error('Failed to load referrals:', err)
    }
  }, [hospitalId])

  useEffect(() => {
    if (!hospitalId) return
    setLoading(true)
    Promise.all([loadQueue(), loadWorkflow(), loadReferrals()]).finally(() => setLoading(false))
  }, [hospitalId, loadQueue, loadWorkflow, loadReferrals])

  const refreshWorkflow = useCallback(() => { Promise.all([loadQueue(), loadWorkflow(), loadReferrals()]) }, [loadQueue, loadWorkflow, loadReferrals])
  useAutoRefresh('workflow', refreshWorkflow)

  // Actions
  function closeCheckInModal() {
    setShowCheckIn(false)
    setCheckInAnimal(null)
    setCheckInError('')
    setCheckInMode('search')
    setWalkInForm({ ownerName: '', ownerPhone: '', ownerEmail: '', ownerAddress: '', animalName: '', animalSpecies: '', animalBreed: '', animalCustomBreed: '', animalGender: '', animalClass: '', animalDob: '', animalWeight: '', animalColor: '', animalMicrochipId: '', animalRegistrationNumber: '', animalIsNeutered: false, animalMedicalNotes: '', animalInsuranceProvider: '', animalInsurancePolicyNumber: '', animalInsuranceExpiry: '', animalEarTagId: '' })
    setWalkInPhotoFile(null)
    setWalkInPhotoPreview('')
    setWalkInError('')
  }

  async function handleCheckIn() {
    if (!hospitalId || !checkInAnimal) return
    setCheckInError('')
    setCheckInSubmitting(true)
    try {
      await apiService.checkInToQueue(hospitalId, {
        ...checkInForm,
        animalId: checkInAnimal.id,
        ownerId: checkInAnimal.owner_id,
      })
      closeCheckInModal()
      setCheckInForm({ reason: '', priority: 'normal', animalId: '', ownerId: '' })
      loadQueue()
    } catch (err: any) {
      setCheckInError(err?.response?.data?.message || err?.message || 'Check-in failed. Please try again.')
    }
    setCheckInSubmitting(false)
  }

  async function handleWalkInRegister() {
    if (!hospitalId) return
    const { ownerName, animalName, animalSpecies } = walkInForm
    if (!ownerName.trim() || !animalName.trim() || !animalSpecies.trim()) {
      setWalkInError(t('hospitalWorkflow.walkIn.requiredFields'))
      return
    }
    setWalkInError('')
    setWalkInRegistering(true)
    try {
      // Convert photo to base64 if provided
      let animalAvatarUrl: string | undefined
      if (walkInPhotoFile) {
        animalAvatarUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(walkInPhotoFile)
        })
      }

      const commonAnimalData = {
        animalName: walkInForm.animalName.trim(),
        animalSpecies: walkInForm.animalSpecies.trim(),
        animalBreed: (walkInForm.animalBreed === 'Other' ? walkInForm.animalCustomBreed.trim() : walkInForm.animalBreed.trim()) || undefined,
        animalGender: walkInForm.animalGender || undefined,
        animalClass: walkInForm.animalClass || undefined,
        animalDob: walkInForm.animalDob || undefined,
        animalWeight: walkInForm.animalWeight ? parseFloat(walkInForm.animalWeight) : undefined,
        animalColor: walkInForm.animalColor.trim() || undefined,
        animalMicrochipId: walkInForm.animalMicrochipId.trim() || undefined,
        animalRegistrationNumber: walkInForm.animalRegistrationNumber.trim() || undefined,
        animalIsNeutered: walkInForm.animalIsNeutered,
        animalMedicalNotes: walkInForm.animalMedicalNotes.trim() || undefined,
        animalAvatarUrl,
        animalInsuranceProvider: walkInForm.animalInsuranceProvider.trim() || undefined,
        animalInsurancePolicyNumber: walkInForm.animalInsurancePolicyNumber.trim() || undefined,
        animalInsuranceExpiry: walkInForm.animalInsuranceExpiry || undefined,
        animalEarTagId: walkInForm.animalEarTagId.trim() || undefined,
      }

      let registered: { animalId: string; ownerId?: string; patientId?: string; networkPatientId?: string }
      if (networkId) {
        const res = await apiService.registerWalkInPatientDirect(networkId, {
          hospitalId,
          patientName: walkInForm.ownerName.trim(),
          patientPhone: walkInForm.ownerPhone.trim() || undefined,
          patientEmail: walkInForm.ownerEmail.trim() || undefined,
          patientAddress: walkInForm.ownerAddress.trim() || undefined,
          reasonForVisit: checkInForm.reason.trim() || undefined,
          ...commonAnimalData,
        })
        registered = res.data
      } else {
        const res = await apiService.registerWalkInStandalone(hospitalId, {
          patientName: walkInForm.ownerName.trim(),
          patientPhone: walkInForm.ownerPhone.trim() || undefined,
          patientEmail: walkInForm.ownerEmail.trim() || undefined,
          patientAddress: walkInForm.ownerAddress.trim() || undefined,
          ...commonAnimalData,
        })
        registered = res.data
      }
      // Auto-select the newly registered animal for check-in
      const nameParts = walkInForm.ownerName.trim().split(/\s+/)
      setCheckInAnimal({
        id: registered.animalId,
        owner_id: registered.ownerId || registered.patientId || '',
        name: walkInForm.animalName.trim(),
        species: walkInForm.animalSpecies.trim(),
        breed: walkInForm.animalBreed.trim() || '',
        owner_first_name: nameParts[0],
        owner_last_name: nameParts.length > 1 ? nameParts.slice(1).join(' ') : '',
        owner_phone: walkInForm.ownerPhone.trim() || '',
        networkPatientId: registered.networkPatientId,
        avatar_url: animalAvatarUrl,
      })
      setCheckInMode('search')
      setWalkInForm({ ownerName: '', ownerPhone: '', ownerEmail: '', ownerAddress: '', animalName: '', animalSpecies: '', animalBreed: '', animalCustomBreed: '', animalGender: '', animalClass: '', animalDob: '', animalWeight: '', animalColor: '', animalMicrochipId: '', animalRegistrationNumber: '', animalIsNeutered: false, animalMedicalNotes: '', animalInsuranceProvider: '', animalInsurancePolicyNumber: '', animalInsuranceExpiry: '', animalEarTagId: '' })
      setWalkInPhotoFile(null)
      setWalkInPhotoPreview('')
    } catch (err: any) {
      setWalkInError(err?.response?.data?.message || err?.message || t('hospitalWorkflow.walkIn.registerFailed'))
    }
    setWalkInRegistering(false)
  }

  async function handleTriage() {
    if (!triageTarget) return
    try {
      const priority = TRIAGE_LEVELS[triageForm.triageLevel]?.priority || 'normal'
      await apiService.triagePatient(triageTarget.id, { ...triageForm, priority })
      setTriageTarget(null)
      setTriageForm({ triageLevel: 3, triageNotes: '' })
      loadQueue()
    } catch { /* empty */ }
  }

  async function handleQueueStatus(id: string, status: string) {
    try {
      await apiService.updateQueueStatus(id, status)
      loadQueue()
    } catch { /* empty */ }
  }

  async function handleCreateCase() {
    if (!hospitalId || !caseAnimal) return
    try {
      await apiService.createWorkflowCase(hospitalId, {
        ...caseForm,
        animalId: caseAnimal.id,
        ownerId: caseAnimal.owner_id,
      })
      setShowNewCase(false)
      setCaseForm({ chiefComplaint: '', priority: 'normal', animalId: '', ownerId: '' })
      setCaseAnimal(null)
      loadWorkflow()
    } catch { /* empty */ }
  }

  async function handleTransition() {
    if (!transTarget) return
    try {
      await apiService.transitionWorkflowStage(transTarget.id, transStage, transNotes)
      setTransTarget(null)
      setTransNotes('')
      setSelectedCase(null)
      loadWorkflow()
    } catch { /* empty */ }
  }

  async function handleCreateReferral() {
    if (!hospitalId || !selectedToVet || !referralForm.reason.trim()) return
    setReferralError('')
    setReferralSubmitting(true)
    try {
      await apiService.createReferral(hospitalId, {
        toVetId: selectedToVet.id,
        ...referralForm,
        ...(referralAnimal ? { animalId: referralAnimal.id } : {}),
      })
      setShowNewReferral(false)
      setReferralForm({ reason: '', specialtyNeeded: '', priority: 'normal', clinicalNotes: '' })
      setSelectedToVet(null)
      setReferralAnimal(null)
      loadReferrals()
    } catch (err: any) {
      setReferralError(err?.response?.data?.error || err?.message || 'Failed to create referral')
    }
    setReferralSubmitting(false)
  }

  async function handleReferralAction(id: string, status: string) {
    try {
      await apiService.updateReferralStatus(id, status)
      loadReferrals()
    } catch { /* empty */ }
  }

  async function loadCaseDetail(id: string) {
    try {
      const res = await apiService.getWorkflowCaseDetail(id)
      const caseData = res.data || null
      setSelectedCase(caseData)
      // Load medical summary for the linked animal
      if (caseData?.animal_id) {
        try {
          const medRes = await apiService.getAnimalMedicalSummary(caseData.animal_id)
          setCaseMedicalSummary(medRes.data || null)
        } catch { setCaseMedicalSummary(null) }
      } else {
        setCaseMedicalSummary(null)
      }
    } catch { /* empty */ }
  }

  if (loading && !hospitalId) {
    return <div className="module-page si-102b95ff"><div className="spinner" /></div>
  }

  // Derived helpers for walk-in form (extracted to avoid duplication)
  const walkInFormValid = walkInForm.ownerName.trim() !== '' && walkInForm.animalName.trim() !== '' && walkInForm.animalSpecies.trim() !== ''
  function openRegisterMode() { setCheckInMode('register'); setWalkInError('') }

  if (!loading && hospitals.length === 0) {
    return (
      <div className="module-page si-5cec5e87">
        <h1 className="si-1bc3a9fe">🏥 {t('hospitalWorkflow.title')}</h1>
        <p className="si-1b6d639e">{t('hospitalWorkflow.subtitle')}</p>
        {loadError && (
          <div className="module-alert error si-b0aee75b">
            <span>⚠️ {loadError}</span>
            <button onClick={() => setLoadError('')} className="si-7b1cae98">✕</button>
          </div>
        )}
        <div className="si-9b5ce7ea">
          <div className="si-aea35a6f">🏥</div>
          <h2 className="si-f16caa7b">{t('hospitalWorkflow.noHospitals', 'No Hospital Assigned')}</h2>
          <p className="si-8160408e">
            {t('hospitalWorkflow.noHospitalsDesc', 'You are not currently assigned to any hospital. Please contact your network administrator to get assigned to a branch hospital.')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page si-5cec5e87">
      {loadError && (
        <div className="module-alert error si-7e63ec4f">
          <span>⚠️ {loadError}</span>
          <button onClick={() => setLoadError('')} className="si-7b1cae98">✕</button>
        </div>
      )}
      <div className="si-a307e2db">
        <div>
          <h1 className="si-1bc3a9fe">🏥 {t('hospitalWorkflow.title')}</h1>
          <p className="si-d078dad1">{t('hospitalWorkflow.subtitle')}</p>
        </div>
        {hospitals.length > 1 && (
          <select value={hospitalId} onChange={e => setHospitalId(e.target.value)}
            className="si-89cf1ca1">
            {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="si-7b57eef9">
        {(['queue', 'workflow', 'referrals'] as const).map(tb => (
          <button key={tb} onClick={() => setTab(tb)}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === tb ? '#2563eb' : 'transparent', color: tab === tb ? '#fff' : '#64748b',
              fontWeight: tab === tb ? 600 : 400, fontSize: 14, transition: 'all .2s',
            }}>
            {tb === 'queue' ? `📋 ${t('hospitalWorkflow.queueAndTriage')}` : tb === 'workflow' ? `🔄 ${t('hospitalWorkflow.clinicalWorkflow')}` : `🔀 ${t('hospitalWorkflow.referrals')}`}
          </button>
        ))}
      </div>

      {/* ═══ QUEUE TAB ═══ */}
      {tab === 'queue' && (
        <div>
          {/* Stats Row - clickable tiles filter the queue below */}
          {queueStats && (() => {
            const tiles = [
              { label: t('hospitalWorkflow.waiting'),     value: queueStats.waiting_count,    color: '#f59e0b', filter: 'waiting' },
              { label: t('hospitalWorkflow.inTriage'),    value: queueStats.in_triage_count,  color: '#8b5cf6', filter: 'in_triage' },
              { label: t('hospitalWorkflow.inExam'),      value: queueStats.in_exam_count,    color: '#2563eb', filter: 'in_examination' },
              { label: t('hospitalWorkflow.inTreatment'),value: queueStats.in_treatment_count,color: '#059669', filter: 'in_treatment' },
              { label: t('hospitalWorkflow.emergencies'), value: queueStats.emergency_count,  color: '#dc2626', filter: 'emergency' },
              { label: t('hospitalWorkflow.avgWait'),     value: `${Math.round(queueStats.avg_wait_minutes || 0)}m`, color: '#64748b', filter: null },
              { label: t('hospitalWorkflow.todayTotal'), value: queueStats.today_total,       color: '#0ea5e9', filter: null },
            ]
            return (
              <div className="si-60815cf3">
                {tiles.map((s, i) => {
                  const isActive = s.filter && queueStatusFilter === s.filter
                  const isClickable = s.filter !== null
                  return (
                    <div key={i}
                      onClick={() => {
                        if (!isClickable) return
                        setQueueStatusFilter(prev => prev === s.filter ? '' : s.filter!)
                      }}
                      style={{
                        background: isActive ? s.color : '#fff',
                        borderRadius: 10, padding: '14px 16px',
                        boxShadow: isActive ? `0 4px 12px ${s.color}40` : '0 1px 3px rgba(0,0,0,.08)',
                        borderLeft: `4px solid ${s.color}`,
                        cursor: isClickable ? 'pointer' : 'default',
                        transition: 'all .15s',
                        outline: isActive ? `2px solid ${s.color}` : 'none',
                      }}>
                      <div style={{ fontSize: 12, color: isActive ? '#fff' : '#64748b', marginBottom: 4 }}>{s.label} {isClickable && <span className="si-5672d952">{isActive ? '▲' : '▼'}</span>}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: isActive ? '#fff' : s.color }}>{s.value ?? 0}</div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          <div className="si-101fd1d0">
            <div className="si-0b20392f">
              <h2 className="si-670df8d2">{t('hospitalWorkflow.patientQueue')}</h2>
              {queueStatusFilter && (
                <span className="si-9d452bc4">
                  Filtered: <strong>{queueStatusFilter.replace(/_/g, ' ')}</strong>
                  <button onClick={() => setQueueStatusFilter('')} className="si-dff28099">✕</button>
                </span>
              )}
            </div>
            <button onClick={() => setShowCheckIn(true)} className="si-880bdf60">
              + {t('hospitalWorkflow.checkInPatient')}
            </button>
          </div>

          {/* Queue List - filtered by status or emergency priority if tile selected */}
          {(() => {
            // Apply filter
            let filtered = queue
            if (queueStatusFilter === 'emergency') {
              filtered = queue.filter(q => q.priority === 'emergency')
            } else if (queueStatusFilter) {
              filtered = queue.filter(q => q.status === queueStatusFilter)
            }
            return (
              <div className="si-977f8af1">
                {filtered.length === 0 && <p className="si-d91f9779">{t('hospitalWorkflow.noPatients')}</p>}
                {filtered.map((q, idx) => (
                  <div key={q.id} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderLeft: `4px solid ${PRIORITY_COLORS[q.priority] || '#2563eb'}` }}>
                    {/* Queue position: per-status index when filtered, global number when unfiltered */}
                    <div className="si-88c652ba">
                      <div className="si-2602e7d1">
                        #{queueStatusFilter ? idx + 1 : q.queue_number}
                      </div>
                      {queueStatusFilter && (
                        <div className="si-0de1dca7">Q#{q.queue_number}</div>
                      )}
                    </div>
                    <div className="si-42eae7d1">
                      <div className="si-b2cfcbec">{q.animal_name || t('hospitalWorkflow.unknownPatient')} <span className="si-db3602ae">({speciesLabel(q.animal_species, t)}{q.animal_breed ? ` - ${q.animal_breed}` : ''})</span></div>
                      <div className="si-4801fc30">{t('hospitalWorkflow.owner')}: {q.owner_first_name} {q.owner_last_name}</div>
                      {q.enterpriseName && (
                        <div className="si-e893254c">
                          🏢 {q.enterpriseName}{q.groupName ? ` › ${q.groupName}` : ''}
                        </div>
                      )}
                      {(q.referralId || (q as any).referral_id) && (
                        <div className="si-fd4f18cf">
                          🔄 Referred from Network
                        </div>
                      )}
                      {q.reason && <div className="si-aff656fd">{q.reason}</div>}
                      {/* Check-in time */}
                      <div className="si-c992365a">🕐 Checked in: {formatDateTime(q.checked_in_at)}</div>
                      {(q as any).medication_status && (() => {
                        const ms = (q as any).medication_status
                        const dot = ms.dispensingStatus ? '#6b7280' : (ms.reviewStatus === 'approved_for_dispensing' ? '#15803d' : '#b45309')
                        const label = ms.dispensingStatus
                          ? t('hospitalWorkflow.medicationDispensed')
                          : ms.reviewStatus === 'approved_for_dispensing'
                            ? t('hospitalWorkflow.medicationReady')
                            : t('hospitalWorkflow.medicationPendingReview')
                        return (
                          <div style={{ fontSize: 11, color: dot, marginTop: 2 }}>
                            💊 {label}{ms.pharmacyName ? ` - ${ms.pharmacyName}` : ''}
                          </div>
                        )
                      })()}
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: PRIORITY_COLORS[q.priority] + '20', color: PRIORITY_COLORS[q.priority] }}>{q.priority}</span>
                    <span className="si-9e05cc79">{(q.status || '').replace(/_/g, ' ')}</span>
                    <div className="si-9f48dfc6">
                      {q.status === 'waiting' && (
                        <button onClick={() => { setTriageTarget(q); setTriageForm({ triageLevel: 3, triageNotes: '' }); }} className="si-ac0a504f">{t('hospitalWorkflow.triage')}</button>
                      )}
                      {['waiting', 'in_triage'].includes(q.status) && (
                        <button onClick={() => handleQueueStatus(q.id, 'in_examination')} className="si-6a421f43">{t('hospitalWorkflow.startExam')}</button>
                      )}
                      {q.status === 'in_examination' && (
                        <button onClick={() => handleQueueStatus(q.id, 'in_treatment')} className="si-d903510c">{t('hospitalWorkflow.treat')}</button>
                      )}
                      {q.status !== 'discharged' && q.status !== 'no_show' && (
                        <button onClick={() => handleQueueStatus(q.id, 'discharged')} className="si-cf604be4">{t('hospitalWorkflow.discharge')}</button>
                      )}
                      {q.status === 'waiting' && (
                        <button onClick={() => handleQueueStatus(q.id, 'no_show')} className="si-487fb5c6">{t('hospitalWorkflow.noShow')}</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Check-in Modal */}
          {showCheckIn && (
            <div onClick={e => { if (e.target === e.currentTarget) closeCheckInModal() }}
              className="si-6d1caf37">
              <div className="si-57f9eac3">
                <div className="si-fe2d5bfb">
                  <div>
                    <h3 className="si-3fe3cab8">🏥 {t('hospitalWorkflow.checkInPatient')}</h3>
                    {checkInMode === 'register' && (
                      <div className="si-f199afd6">{t('hospitalWorkflow.walkIn.subtitle')}</div>
                    )}
                  </div>
                  <button onClick={closeCheckInModal} className="si-034e37c2">✕</button>
                </div>

                {checkInError && (
                  <div className="si-86aee441">
                    ⚠️ {checkInError}
                  </div>
                )}

                {checkInMode === 'search' ? (
                  <div className="si-7a28b1a9">
                    <div>
                      <AnimalSearchPicker
                        selectedAnimal={checkInAnimal}
                        onSelect={a => { setCheckInAnimal(a); setCheckInError('') }}
                        label={`🔍 ${t('hospitalWorkflow.searchPatient')} *`}
                        onRegisterNew={openRegisterMode}
                        hospitalId={hospitalId || undefined}
                      />
                      {!checkInAnimal && (
                        <div className="si-80df77c2">
                          ⚠️ <strong>{t('hospitalWorkflow.walkIn.searchRequired')}</strong>
                        </div>
                      )}
                    </div>
                    {!checkInAnimal && (
                      <div className="si-20547c1e">
                        <span className="si-db3602ae">{t('hospitalWorkflow.walkIn.or')} </span>
                        <button onClick={openRegisterMode}
                          className="si-fa312d0d">
                          ➕ {t('hospitalWorkflow.walkIn.registerNew')}
                        </button>
                      </div>
                    )}
                    <div>
                      <label className="si-2561596d">{t('hospitalWorkflow.reasonForVisit')} <span className="si-17788c1c">(optional)</span></label>
                      <input placeholder="e.g., Vaccination, Limping, Skin rash..." value={checkInForm.reason} onChange={e => setCheckInForm(f => ({ ...f, reason: e.target.value }))} className="si-d0e0df59" />
                    </div>
                    <div>
                      <label className="si-1e22ae90">{t('hospitalWorkflow.priority')} <span className="si-17788c1c">(optional)</span></label>
                      <div className="si-9f20fe5e">
                        {PRIORITIES.map(p => (
                          <button key={p} onClick={() => setCheckInForm(f => ({ ...f, priority: p }))}
                            style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: checkInForm.priority === p ? `2px solid ${PRIORITY_COLORS[p]}` : '1px solid #d1d5db', background: checkInForm.priority === p ? PRIORITY_COLORS[p] + '15' : '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 12, color: PRIORITY_COLORS[p], textTransform: 'capitalize' }}>{p}</button>
                        ))}
                      </div>
                    </div>
                    <div className="si-db3602ae"><span className="si-f84f41a5">*</span> Required field</div>
                    <div className="si-81c39146">
                      <button onClick={closeCheckInModal} className="si-db673962">{t('hospitalWorkflow.cancel')}</button>
                      <button onClick={handleCheckIn} disabled={!checkInAnimal || checkInSubmitting}
                        style={{ padding: '10px 20px', background: checkInAnimal && !checkInSubmitting ? '#2563eb' : '#94a3b8', color: '#fff', border: 'none', borderRadius: 8, cursor: checkInAnimal && !checkInSubmitting ? 'pointer' : 'not-allowed', fontWeight: 700, minWidth: 120 }}>
                        {checkInSubmitting ? `⏳ ${t('hospitalWorkflow.checkingIn')}` : `✅ ${t('hospitalWorkflow.checkIn')}`}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Walk-in Patient Registration Form */
                  <div className="si-7a28b1a9">
                    <div className="si-223e4798">
                      🐾 {t('hospitalWorkflow.walkIn.instructions')}
                    </div>

                    {walkInError && (
                      <div className="si-dfe9e95d">
                        ⚠️ {walkInError}
                      </div>
                    )}

                    {/* Photo upload */}
                    <div className="si-1d133837">
                      <div
                        onClick={() => document.getElementById('walkInPhotoInput')?.click()}
                        style={{ width: 80, height: 80, borderRadius: '50%', border: '2px dashed #d1d5db', background: walkInPhotoPreview ? 'transparent' : '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, position: 'relative' }}
                      >
                        {walkInPhotoPreview
                          ? <img src={walkInPhotoPreview} alt="preview" className="si-0ece644a" />
                          : <span className="si-db109633">🐾</span>
                        }
                      </div>
                      <div>
                        <div className="si-2fed5332">{t('hospitalWorkflow.walkIn.animalPhoto')} <span className="si-17788c1c">(optional)</span></div>
                        <div className="si-aff656fd">{walkInPhotoPreview ? t('hospitalWorkflow.walkIn.photoChangeHint') : t('hospitalWorkflow.walkIn.photoUploadHint')}</div>
                        {walkInPhotoPreview && <button onClick={() => { setWalkInPhotoFile(null); setWalkInPhotoPreview('') }} className="si-8cb303c0">✕ {t('hospitalWorkflow.walkIn.removePhoto')}</button>}
                      </div>
                      <input id="walkInPhotoInput" type="file" accept="image/*" className="si-d6a2f871" onChange={e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setWalkInPhotoFile(file)
                        const reader = new FileReader()
                        reader.onload = () => setWalkInPhotoPreview(reader.result as string)
                        reader.readAsDataURL(file)
                        e.target.value = ''
                      }} />
                    </div>

                    {/* Owner Details */}
                    <div className="si-9a250e84">
                      <div className="si-27da07a6">👤 {t('hospitalWorkflow.walkIn.ownerDetails')}</div>
                      <div className="si-51b511c9">
                        <div>
                          <label className="si-2561596d">{t('hospitalWorkflow.walkIn.ownerName')} <span className="si-f84f41a5">*</span></label>
                          <input placeholder={t('hospitalWorkflow.walkIn.ownerNamePlaceholder')} value={walkInForm.ownerName} onChange={e => setWalkInForm(f => ({ ...f, ownerName: e.target.value }))} className="si-d0e0df59" />
                        </div>
                        <div className="si-347df862">
                          <div>
                            <label className="si-2561596d">{t('hospitalWorkflow.walkIn.ownerPhone')} <span className="si-17788c1c">(optional)</span></label>
                            <input placeholder="+91 9876543210" value={walkInForm.ownerPhone} onChange={e => setWalkInForm(f => ({ ...f, ownerPhone: e.target.value }))} className="si-d0e0df59" />
                          </div>
                          <div>
                            <label className="si-2561596d">{t('hospitalWorkflow.walkIn.ownerEmail')} <span className="si-17788c1c">(optional)</span></label>
                            <input placeholder="owner@email.com" type="email" value={walkInForm.ownerEmail} onChange={e => setWalkInForm(f => ({ ...f, ownerEmail: e.target.value }))} className="si-d0e0df59" />
                          </div>
                        </div>
                        <div>
                          <label className="si-2561596d">{t('hospitalWorkflow.walkIn.ownerAddress')} <span className="si-17788c1c">(optional)</span></label>
                          <input placeholder={t('hospitalWorkflow.walkIn.ownerAddressPlaceholder')} value={walkInForm.ownerAddress} onChange={e => setWalkInForm(f => ({ ...f, ownerAddress: e.target.value }))} className="si-d0e0df59" />
                        </div>
                      </div>
                    </div>

                    {/* Patient Details - core */}
                    <div className="si-9a250e84">
                      <div className="si-27da07a6">🐾 {t('hospitalWorkflow.walkIn.patientDetails')}</div>
                      <div className="si-51b511c9">
                        <div>
                          <label className="si-2561596d">{t('hospitalWorkflow.walkIn.animalName')} <span className="si-f84f41a5">*</span></label>
                          <input placeholder={t('hospitalWorkflow.walkIn.animalNamePlaceholder')} value={walkInForm.animalName} onChange={e => setWalkInForm(f => ({ ...f, animalName: e.target.value }))} className="si-d0e0df59" />
                        </div>
                        <div className="si-347df862">
                          <div>
                            <label className="si-2561596d">{t('hospitalWorkflow.walkIn.species')} <span className="si-f84f41a5">*</span></label>
                            <select value={walkInForm.animalSpecies} onChange={e => setWalkInForm(f => ({ ...f, animalSpecies: e.target.value, animalBreed: '', animalCustomBreed: '' }))} className="si-f3740d1a">
                              <option value="">{t('hospitalWorkflow.walkIn.selectSpecies')}</option>
                              {speciesCategories.map(cat => (
                                <optgroup key={cat.label} label={cat.label}>
                                  {cat.species.map(sp => <option key={sp} value={sp}>{speciesLabel(sp, t)}</option>)}
                                </optgroup>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="si-2561596d">{t('hospitalWorkflow.walkIn.breed')} <span className="si-17788c1c">(optional)</span></label>
                            {breedsForSpecies(walkInForm.animalSpecies).length > 0 ? (
                              <select value={walkInForm.animalBreed} onChange={e => setWalkInForm(f => ({ ...f, animalBreed: e.target.value, animalCustomBreed: '' }))} className="si-f3740d1a">
                                <option value="">{t('hospitalWorkflow.walkIn.selectBreed')}</option>
                                {breedsForSpecies(walkInForm.animalSpecies).map(b => <option key={b} value={b}>{breedLabel(walkInForm.animalSpecies, b)}</option>)}
                              </select>
                            ) : (
                              <input placeholder={t('hospitalWorkflow.walkIn.breedPlaceholder')} value={walkInForm.animalBreed} onChange={e => setWalkInForm(f => ({ ...f, animalBreed: e.target.value }))} className="si-d0e0df59" />
                            )}
                          </div>
                        </div>
                        {walkInForm.animalBreed === 'Other' && (
                          <div>
                            <label className="si-2561596d">{t('hospitalWorkflow.walkIn.customBreed')} <span className="si-17788c1c">(optional)</span></label>
                            <input placeholder={t('hospitalWorkflow.walkIn.customBreedPlaceholder')} value={walkInForm.animalCustomBreed} onChange={e => setWalkInForm(f => ({ ...f, animalCustomBreed: e.target.value }))} className="si-d0e0df59" />
                          </div>
                        )}
                        <div className="si-347df862">
                          <div>
                            {classTermsForSpecies(walkInForm.animalSpecies).length > 0 ? (
                              <>
                                <label className="si-2561596d">{t('animalClass.fieldLabel')} <span className="si-17788c1c">(optional)</span></label>
                                <select value={walkInForm.animalClass} onChange={e => {
                                  const term = findClassTerm(walkInForm.animalSpecies, e.target.value)
                                  setWalkInForm(f => ({ ...f, animalClass: e.target.value, animalGender: term?.impliedGender || f.animalGender }))
                                }} className="si-f3740d1a">
                                  <option value="">{t('animalClass.selectClass')}</option>
                                  {classTermsForSpecies(walkInForm.animalSpecies).map(c => <option key={c.value} value={c.value}>{resolveLabel(c, t)}</option>)}
                                </select>
                              </>
                            ) : (
                              <>
                                <label className="si-2561596d">{t('hospitalWorkflow.walkIn.animalGender')} <span className="si-17788c1c">(optional)</span></label>
                                <select value={walkInForm.animalGender} onChange={e => setWalkInForm(f => ({ ...f, animalGender: e.target.value }))} className="si-f3740d1a">
                                  <option value="">{t('hospitalWorkflow.walkIn.selectGender')}</option>
                                  <option value="male">{t('hospitalWorkflow.walkIn.male')}</option>
                                  <option value="female">{t('hospitalWorkflow.walkIn.female')}</option>
                                  <option value="unknown">{t('hospitalWorkflow.walkIn.genderUnknown')}</option>
                                </select>
                              </>
                            )}
                          </div>
                          <div>
                            <label className="si-2561596d">{t('hospitalWorkflow.walkIn.animalDob')} <span className="si-17788c1c">(optional)</span></label>
                            <input type="date" value={walkInForm.animalDob} onChange={e => setWalkInForm(f => ({ ...f, animalDob: e.target.value }))} max={new Date().toISOString().split('T')[0]} className="si-d0e0df59" />
                          </div>
                        </div>
                        <div className="si-347df862">
                          <div>
                            <label className="si-2561596d">{t('hospitalWorkflow.walkIn.animalWeight')} <span className="si-17788c1c">(optional)</span></label>
                            <input type="number" step="0.1" min="0" placeholder="e.g., 12.5" value={walkInForm.animalWeight} onChange={e => setWalkInForm(f => ({ ...f, animalWeight: e.target.value }))} className="si-d0e0df59" />
                          </div>
                          <div>
                            <label className="si-2561596d">{t('hospitalWorkflow.walkIn.animalColor')} <span className="si-17788c1c">(optional)</span></label>
                            <input placeholder={t('hospitalWorkflow.walkIn.animalColorPlaceholder')} value={walkInForm.animalColor} onChange={e => setWalkInForm(f => ({ ...f, animalColor: e.target.value }))} className="si-d0e0df59" />
                          </div>
                        </div>
                        <div className="si-a8fa078e">
                          <input type="checkbox" id="walkInNeutered" checked={walkInForm.animalIsNeutered} onChange={e => setWalkInForm(f => ({ ...f, animalIsNeutered: e.target.checked }))} className="si-f9badade" />
                          <label htmlFor="walkInNeutered" className="si-e6d76076">{t('hospitalWorkflow.walkIn.animalIsNeutered')}</label>
                        </div>
                      </div>
                    </div>

                    {/* Identification */}
                    <div className="si-9a250e84">
                      <div className="si-27da07a6">🔖 {t('hospitalWorkflow.walkIn.identificationDetails')}</div>
                      <div className="si-347df862">
                        <div>
                          <label className="si-2561596d">{t('hospitalWorkflow.walkIn.animalMicrochipId')} <span className="si-17788c1c">(optional)</span></label>
                          <input placeholder={t('hospitalWorkflow.walkIn.animalMicrochipPlaceholder')} value={walkInForm.animalMicrochipId} onChange={e => setWalkInForm(f => ({ ...f, animalMicrochipId: e.target.value }))} className="si-d0e0df59" />
                        </div>
                        <div>
                          <label className="si-2561596d">{t('hospitalWorkflow.walkIn.animalRegistrationNumber')} <span className="si-17788c1c">(optional)</span></label>
                          <input placeholder={t('hospitalWorkflow.walkIn.animalRegistrationPlaceholder')} value={walkInForm.animalRegistrationNumber} onChange={e => setWalkInForm(f => ({ ...f, animalRegistrationNumber: e.target.value }))} className="si-d0e0df59" />
                        </div>
                        {earTagSpecies.includes(walkInForm.animalSpecies) && (
                          <div className="si-06af062a">
                            <label className="si-2561596d">{t('hospitalWorkflow.walkIn.animalEarTagId')} <span className="si-17788c1c">(optional)</span></label>
                            <input placeholder={t('hospitalWorkflow.walkIn.animalEarTagPlaceholder')} value={walkInForm.animalEarTagId} onChange={e => setWalkInForm(f => ({ ...f, animalEarTagId: e.target.value }))} className="si-d0e0df59" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Medical Notes */}
                    <div>
                      <label className="si-2561596d">📋 {t('hospitalWorkflow.walkIn.animalMedicalNotes')} <span className="si-17788c1c">(optional)</span></label>
                      <textarea
                        placeholder={t('hospitalWorkflow.walkIn.animalMedicalNotesPlaceholder')}
                        value={walkInForm.animalMedicalNotes}
                        onChange={e => setWalkInForm(f => ({ ...f, animalMedicalNotes: e.target.value }))}
                        rows={3}
                        className="si-0523a7a3"
                      />
                    </div>

                    {/* Insurance Details */}
                    <div className="si-27da07a6">🛡️ {t('hospitalWorkflow.walkIn.insuranceSection')}</div>
                    <div className="si-fbb64b4e">
                      <div>
                        <label className="si-2561596d">{t('hospitalWorkflow.walkIn.insuranceProvider')} <span className="si-17788c1c">(optional)</span></label>
                        <input placeholder={t('hospitalWorkflow.walkIn.insuranceProviderPlaceholder')} value={walkInForm.animalInsuranceProvider} onChange={e => setWalkInForm(f => ({ ...f, animalInsuranceProvider: e.target.value }))} className="si-d0e0df59" />
                      </div>
                      <div>
                        <label className="si-2561596d">{t('hospitalWorkflow.walkIn.insurancePolicyNumber')} <span className="si-17788c1c">(optional)</span></label>
                        <input placeholder={t('hospitalWorkflow.walkIn.insurancePolicyPlaceholder')} value={walkInForm.animalInsurancePolicyNumber} onChange={e => setWalkInForm(f => ({ ...f, animalInsurancePolicyNumber: e.target.value }))} className="si-d0e0df59" />
                      </div>
                    </div>
                    <div>
                      <label className="si-2561596d">{t('hospitalWorkflow.walkIn.insuranceExpiry')} <span className="si-17788c1c">(optional)</span></label>
                      <input type="date" value={walkInForm.animalInsuranceExpiry} onChange={e => setWalkInForm(f => ({ ...f, animalInsuranceExpiry: e.target.value }))} className="si-d0e0df59" />
                      {walkInForm.animalInsuranceExpiry && new Date(walkInForm.animalInsuranceExpiry) < new Date() && (
                        <div className="si-9e7b17f4">⚠️ {t('hospitalWorkflow.walkIn.insuranceExpired')}</div>
                      )}
                    </div>

                    <div className="si-db3602ae"><span className="si-f84f41a5">*</span> Required field</div>
                    <div className="si-81c39146">
                      <button onClick={() => { setCheckInMode('search'); setWalkInError('') }} className="si-db673962">← {t('hospitalWorkflow.walkIn.backToSearch')}</button>
                      <button onClick={handleWalkInRegister}
                        disabled={!walkInFormValid || walkInRegistering}
                        style={{ padding: '10px 20px', background: walkInFormValid && !walkInRegistering ? '#15803d' : '#94a3b8', color: '#fff', border: 'none', borderRadius: 8, cursor: walkInFormValid && !walkInRegistering ? 'pointer' : 'not-allowed', fontWeight: 700, minWidth: 140 }}>
                        {walkInRegistering ? `⏳ ${t('hospitalWorkflow.walkIn.registering')}` : `✅ ${t('hospitalWorkflow.walkIn.registerAndContinue')}`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Triage Modal */}
          {triageTarget && (
            <div onClick={e => { if (e.target === e.currentTarget) setTriageTarget(null) }}
              className="si-6d1caf37">
              <div className="si-37f24010">
                {/* Header */}
                <div className="si-fe2d5bfb">
                  <div>
                    <h3 className="si-3fe3cab8">🏥 Triage - #{triageTarget.queue_number} {triageTarget.animal_name}</h3>
                    <div className="si-aff656fd">Select severity level - priority is derived automatically</div>
                  </div>
                  <button onClick={() => setTriageTarget(null)} className="si-034e37c2">✕</button>
                </div>

                <div className="si-7a28b1a9">
                  {/* Unified triage level selector - number + label + color all in one */}
                  <div>
                    <label className="si-1cac7fac">
                      {t('hospitalWorkflow.triageLevel')} <span className="si-f84f41a5">*</span>
                    </label>
                    <div className="si-85143a6f">
                      {([1, 2, 3, 4, 5] as const).map(n => {
                        const tl = TRIAGE_LEVELS[n]
                        const isSelected = triageForm.triageLevel === n
                        return (
                          <button key={n} onClick={() => setTriageForm(f => ({ ...f, triageLevel: n }))}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                              border: isSelected ? `2px solid ${tl.color}` : '2px solid #e5e7eb',
                              background: isSelected ? tl.bg : '#fafafa',
                              transition: 'all .15s',
                            }}>
                            <span style={{ width: 32, height: 32, borderRadius: 8, background: isSelected ? tl.color : '#e5e7eb', color: isSelected ? '#fff' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{n}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: isSelected ? tl.color : '#374151', minWidth: 70 }}>{tl.icon} {tl.label}</span>
                            <span style={{ fontSize: 12, color: isSelected ? tl.color : '#94a3b8' }}>{tl.description}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Derived priority badge - confirmation that priority auto-matches level */}
                  {(() => {
                    const tl = TRIAGE_LEVELS[triageForm.triageLevel]
                    return (
                      <div style={{ background: tl.bg, border: `1px solid ${tl.color}40`, borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: tl.color, fontWeight: 600 }}>Priority assigned automatically:</span>
                        <span style={{ padding: '2px 10px', borderRadius: 10, background: tl.color, color: '#fff', fontWeight: 700, fontSize: 12, textTransform: 'uppercase' }}>{tl.priority}</span>
                      </div>
                    )
                  })()}

                  {/* Notes */}
                  <div>
                    <label className="si-2561596d">
                      {t('hospitalWorkflow.triageNotesPlaceholder')} <span className="si-17788c1c">(optional)</span>
                    </label>
                    <textarea placeholder="Observed symptoms, vital signs, reason for triage level..." value={triageForm.triageNotes} onChange={e => setTriageForm(f => ({ ...f, triageNotes: e.target.value }))} rows={3} className="si-0523a7a3" />
                  </div>

                  <div className="si-cfc4497e">
                    <button onClick={() => setTriageTarget(null)} className="si-db673962">{t('hospitalWorkflow.cancel')}</button>
                    <button onClick={handleTriage} className="si-afdd074e">{t('hospitalWorkflow.saveTriage')}</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ WORKFLOW TAB ═══ */}
      {tab === 'workflow' && (
        <div>
          {/* Workflow Dashboard */}
          {dashboard && (
            <div className="si-7186a6b3">
              <div className="si-8e371dd0">
                <div className="si-655cd763">{t('hospitalWorkflow.activeCases')}</div>
                <div className="si-075b513e">{dashboard.today?.active_cases ?? 0}</div>
              </div>
              <div className="si-e8d607cc">
                <div className="si-655cd763">{t('hospitalWorkflow.completedToday')}</div>
                <div className="si-3ca1ce25">{dashboard.today?.completed_today ?? 0}</div>
              </div>
              <div className="si-20ff762c">
                <div className="si-655cd763">{t('hospitalWorkflow.avgDuration')}</div>
                <div className="si-724132a4">{dashboard.avgCaseDurationMinutes ?? 0}m</div>
              </div>
              {(dashboard.stageCounts || []).map((s: any) => (
                <div key={s.current_stage} className="si-974475c5">
                  <div className="si-655cd763">{STAGE_ICONS[s.current_stage]} {s.current_stage}</div>
                  <div className="si-f0920f33">{s.count}</div>
                </div>
              ))}
            </div>
          )}

          {/* Stage Pipeline View */}
          <div className="si-c5224945">
            <button onClick={() => setStageFilter('')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', background: stageFilter === '' ? '#2563eb' : '#e2e8f0', color: stageFilter === '' ? '#fff' : '#475569', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>{t('hospitalWorkflow.allStages')}</button>
            {STAGES.map(s => (
              <button key={s} onClick={() => setStageFilter(s)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', background: stageFilter === s ? '#2563eb' : '#e2e8f0', color: stageFilter === s ? '#fff' : '#475569', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                {STAGE_ICONS[s]} {s}
              </button>
            ))}
          </div>

          <div className="si-4c5f81c0">
            <div>
              <h2 className="si-670df8d2">{t('hospitalWorkflow.clinicalCases')}</h2>
              <p className="si-f03d86de">
                📋 Tracks detailed clinical journey for each patient (triage → examination → treatment → observation → discharge).
                Cases are <strong>auto-created</strong> when you click <em>Start Exam</em> in Queue &amp; Triage.
              </p>
            </div>
            <button onClick={() => setShowNewCase(true)} className="si-41d90713">+ {t('hospitalWorkflow.newCase')}</button>
          </div>

          {/* Cases List */}
          <div className="si-977f8af1">
            {cases.length === 0 && <p className="si-d91f9779">{t('hospitalWorkflow.noCases')}</p>}
            {cases.map(c => (
              <div key={c.id} onClick={() => loadCaseDetail(c.id)} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', cursor: 'pointer', borderLeft: `4px solid ${PRIORITY_COLORS[c.priority] || '#2563eb'}`, transition: 'box-shadow .2s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.12)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.06)')}>
                <div className="si-588e32ac">
                  <span className="si-7ff2b341">{STAGE_ICONS[c.current_stage]}</span>
                  <div className="si-42eae7d1">
                    <div className="si-b2cfcbec">{c.animal_name || t('hospitalWorkflow.unknown')} <span className="si-db3602ae">({speciesLabel(c.animal_species, t)})</span></div>
                    <div className="si-4801fc30">{c.chief_complaint || t('hospitalWorkflow.noComplaintNoted')}</div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: PRIORITY_COLORS[c.priority] + '20', color: PRIORITY_COLORS[c.priority] }}>{c.priority}</span>
                  <span className="si-138fd2c9">{c.current_stage}</span>
                  <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: c.status === 'active' ? '#dcfce7' : '#f1f5f9', color: c.status === 'active' ? '#166534' : '#64748b' }}>{c.status}</span>
                  {c.vet_first_name && <span className="si-655cd763">Dr. {c.vet_first_name} {c.vet_last_name}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Case Detail Modal */}
          {selectedCase && (
            <div className="si-db8248e9">
              <div className="si-0eebe146">
                <div className="si-101fd1d0">
                  <h3 className="si-44087c4b">{t('hospitalWorkflow.case')}: {selectedCase.animal_name || t('hospitalWorkflow.unknown')}</h3>
                  <button onClick={() => setSelectedCase(null)} className="si-30be827b">✕</button>
                </div>

                {/* Stage Pipeline */}
                <div className="si-41235f19">
                  {STAGES.map((s, i) => {
                    const isActive = s === selectedCase.current_stage
                    const isPast = STAGES.indexOf(selectedCase.current_stage) > i
                    return (
                      <div key={s} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: isActive ? '#2563eb' : isPast ? '#dcfce7' : '#f1f5f9', color: isActive ? '#fff' : isPast ? '#166534' : '#94a3b8', fontWeight: isActive ? 700 : 500, fontSize: 12 }}>
                        {STAGE_ICONS[s]} {s}
                      </div>
                    )
                  })}
                </div>

                <div className="si-0c1c8326">
                  <div><strong>{t('hospitalWorkflow.priority')}:</strong> <span style={{ color: PRIORITY_COLORS[selectedCase.priority] }}>{selectedCase.priority}</span></div>
                  <div><strong>{t('hospitalWorkflow.status')}:</strong> {selectedCase.status}</div>
                  <div><strong>{t('hospitalWorkflow.owner')}:</strong> {selectedCase.owner_first_name} {selectedCase.owner_last_name}</div>
                  <div><strong>{t('hospitalWorkflow.vet')}:</strong> {selectedCase.vet_first_name ? `Dr. ${selectedCase.vet_first_name} ${selectedCase.vet_last_name}` : t('hospitalWorkflow.unassigned')}</div>
                  {selectedCase.chief_complaint && <div className="si-0defe487"><strong>{t('hospitalWorkflow.chiefComplaint')}:</strong> {selectedCase.chief_complaint}</div>}
                  {selectedCase.diagnosis && <div className="si-0defe487"><strong>{t('hospitalWorkflow.diagnosis')}:</strong> {selectedCase.diagnosis}</div>}
                  {selectedCase.treatment_plan && <div className="si-0defe487"><strong>{t('hospitalWorkflow.treatmentPlan')}:</strong> {selectedCase.treatment_plan}</div>}
                </div>

                {/* Transition History */}
                {selectedCase.transitions && selectedCase.transitions.length > 0 && (
                  <div className="si-7e63ec4f">
                    <h4 className="si-24d15068">{t('hospitalWorkflow.workflowHistory')}</h4>
                    <div className="si-85143a6f">
                      {selectedCase.transitions.map((tr: any, i: number) => (
                        <div key={i} className="si-72912216">
                          <span className="si-b2cfcbec">{tr.from_stage || '-'} → {tr.to_stage}</span>
                          <span className="si-98734f9a">{t('hospitalWorkflow.by')} {tr.first_name} {tr.last_name}</span>
                          <span className="si-bd94d1af">{formatDateTime(tr.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Medical History Panel */}
                {caseMedicalSummary && (
                  <div className="si-3d341eca">
                    <div className="si-db20e0d4">📋 {t('hospitalWorkflow.medicalHistory')} - {caseMedicalSummary.animal?.name}</div>
                    <div className="si-933bc6a9">
                      {/* Allergies */}
                      {caseMedicalSummary.allergies?.length > 0 && (
                        <div className="si-170de209">
                          <div className="si-17b5a0dc">⚠️ {t('hospitalWorkflow.allergies')}</div>
                          <div className="si-50c82988">
                            {caseMedicalSummary.allergies.map((a: any) => (
                              <span key={a.id} className="si-8edb907a">{a.allergen} ({a.severity})</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Recent records */}
                      {caseMedicalSummary.recentRecords?.length > 0 && (
                        <div className="si-170de209">
                          <div className="si-47ae2048">{t('hospitalWorkflow.recentRecords')}</div>
                          {caseMedicalSummary.recentRecords.slice(0, 5).map((r: any) => (
                            <div key={r.id} className="si-6804a5dc">
                              <span className="si-b2cfcbec">{r.title || r.record_type}</span>
                              {r.diagnosis && <span className="si-23033f05"> - {r.diagnosis}</span>}
                              <span className="si-68f18f88">{formatDateTime(r.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Active prescriptions */}
                      {caseMedicalSummary.recentPrescriptions?.length > 0 && (
                        <div className="si-170de209">
                          <div className="si-47ae2048">💊 {t('hospitalWorkflow.recentPrescriptions')}</div>
                          {caseMedicalSummary.recentPrescriptions.slice(0, 3).map((p: any) => (
                            <div key={p.id} className="si-05aae049">
                              {p.diagnosis || 'Prescription'} - Dr. {p.vet_first_name} {p.vet_last_name} <span className="si-385f4f50">{formatDateTime(p.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Vaccinations */}
                      {caseMedicalSummary.recentVaccinations?.length > 0 && (
                        <div>
                          <div className="si-47ae2048">💉 {t('hospitalWorkflow.vaccinations')}</div>
                          <div className="si-50c82988">
                            {caseMedicalSummary.recentVaccinations.map((v: any) => (
                              <span key={v.id} className="si-657d89a1">{v.vaccine_name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {!caseMedicalSummary.recentRecords?.length && !caseMedicalSummary.allergies?.length && (
                        <div className="si-72381c27">{t('hospitalWorkflow.noMedicalHistory')}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Advance Stage */}
                {selectedCase.status === 'active' && (
                  <div className="si-b9eb5ec7">
                    {STAGES.filter(s => STAGES.indexOf(s) > STAGES.indexOf(selectedCase.current_stage)).map(s => (
                      <button key={s} onClick={() => { setTransTarget(selectedCase); setTransStage(s); }}
                        style={{ padding: '8px 14px', background: s === 'discharge' ? '#059669' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                        → {STAGE_ICONS[s]} {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Transition Notes Modal */}
          {transTarget && (
            <div className="si-1c4649c0">
              <div className="si-dc0fea35">
                <h3 className="si-33c1a83e">{t('hospitalWorkflow.moveTo')} {STAGE_ICONS[transStage]} {transStage}</h3>
                <textarea placeholder={t('hospitalWorkflow.notesOptional')} value={transNotes} onChange={e => setTransNotes(e.target.value)} rows={3} className="si-2a364628" />
                <div className="si-f0412db6">
                  <button onClick={() => setTransTarget(null)} className="si-978a1643">{t('hospitalWorkflow.cancel')}</button>
                  <button onClick={handleTransition} className="si-880bdf60">{t('hospitalWorkflow.confirm')}</button>
                </div>
              </div>
            </div>
          )}

          {/* Create Case Modal */}
          {showNewCase && (
            <div className="si-db8248e9">
              <div className="si-7f17206a">
                <h3 className="si-33c1a83e">🔄 {t('hospitalWorkflow.newClinicalCase')}</h3>
                <div className="si-d8480906">
                  <AnimalSearchPicker selectedAnimal={caseAnimal} onSelect={setCaseAnimal} hospitalId={hospitalId || undefined} />
                  <div>
                    <label className="si-1d2216db">{t('hospitalWorkflow.chiefComplaint')}</label>
                    <textarea placeholder={t('hospitalWorkflow.chiefComplaintPlaceholder')} value={caseForm.chiefComplaint} onChange={e => setCaseForm(f => ({ ...f, chiefComplaint: e.target.value }))} rows={2} className="si-dc3839a2" />
                  </div>
                  <div>
                    <label className="si-1d2216db">{t('hospitalWorkflow.priority')}</label>
                    <div className="si-9f20fe5e">
                      {PRIORITIES.map(p => (
                        <button key={p} onClick={() => setCaseForm(f => ({ ...f, priority: p }))}
                          style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: caseForm.priority === p ? `2px solid ${PRIORITY_COLORS[p]}` : '1px solid #d1d5db', background: caseForm.priority === p ? PRIORITY_COLORS[p] + '15' : '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 12, color: PRIORITY_COLORS[p], textTransform: 'capitalize' }}>{p}</button>
                      ))}
                    </div>
                  </div>
                  <div className="si-8d13495b">
                    <button onClick={() => { setShowNewCase(false); setCaseAnimal(null) }} className="si-978a1643">{t('hospitalWorkflow.cancel')}</button>
                    <button onClick={handleCreateCase} disabled={!caseAnimal} style={{ padding: '8px 16px', background: caseAnimal ? '#2563eb' : '#94a3b8', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>{t('hospitalWorkflow.createCase')}</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ REFERRALS TAB ═══ */}
      {tab === 'referrals' && (
        <div>
          <div className="si-101fd1d0">
            <h2 className="si-670df8d2">{t('hospitalWorkflow.specialistReferrals')}</h2>
            <button onClick={() => setShowNewReferral(true)} className="si-880bdf60">+ {t('hospitalWorkflow.newReferral')}</button>
          </div>

          <div className="si-977f8af1">
            {referrals.length === 0 && <p className="si-d91f9779">{t('hospitalWorkflow.noReferrals')}</p>}
            {referrals.map(r => (
              <div key={r.id} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', borderLeft: `4px solid ${PRIORITY_COLORS[r.priority] || '#2563eb'}` }}>
                <div className="si-588e32ac">
                  <div className="si-aa342140">
                    <div className="si-b2cfcbec">From Dr. {r.from_vet_first} {r.from_vet_last} → Dr. {r.to_vet_first} {r.to_vet_last}</div>
                    <div className="si-7eadb7a8">{r.reason}</div>
                    {r.specialty_needed && <div className="si-029cdd46">{t('hospitalWorkflow.specialty')}: {r.specialty_needed}</div>}
                    {r.animal_name && <div className="si-db3602ae">{t('hospitalWorkflow.patient')}: {r.animal_name} ({speciesLabel(r.animal_species, t)})</div>}
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: r.status === 'pending' ? '#fef3c7' : r.status === 'accepted' ? '#dcfce7' : r.status === 'completed' ? '#dbeafe' : '#fecaca', color: r.status === 'pending' ? '#92400e' : r.status === 'accepted' ? '#166534' : r.status === 'completed' ? '#1d4ed8' : '#991b1b' }}>{r.status}</span>
                  {r.status === 'pending' && (
                    <div className="si-9f48dfc6">
                      <button onClick={() => handleReferralAction(r.id, 'accepted')} className="si-d903510c">{t('hospitalWorkflow.accept')}</button>
                      <button onClick={() => handleReferralAction(r.id, 'declined')} className="si-ad808723">{t('hospitalWorkflow.decline')}</button>
                    </div>
                  )}
                  {r.status === 'accepted' && (
                    <button onClick={() => handleReferralAction(r.id, 'completed')} className="si-6a421f43">{t('hospitalWorkflow.complete')}</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Create Referral Modal */}
          {showNewReferral && (
            <div className="si-db8248e9"
              onClick={e => { if (e.target === e.currentTarget) { setShowNewReferral(false); setSelectedToVet(null); setReferralAnimal(null); setReferralError('') } }}>
              <div className="si-b011d727">
                <button onClick={() => { setShowNewReferral(false); setSelectedToVet(null); setReferralAnimal(null); setReferralError('') }}
                  className="si-9142cad1">✕</button>
                <h3 className="si-f522c581">🔀 {t('hospitalWorkflow.newSpecialistReferral')}</h3>

                {referralError && (
                  <div className="si-ebc0428a">
                    ⚠️ {referralError}
                  </div>
                )}

                <div className="si-d8480906">
                  {/* Vet Search - required */}
                  <VetSearchPicker selectedVet={selectedToVet} onSelect={setSelectedToVet} required />
                  {!selectedToVet && (
                    <p className="si-7bdf7b77">
                      ⚠️ Required: Search and select a veterinarian to enable submission
                    </p>
                  )}

                  {/* Patient - optional */}
                  <AnimalSearchPicker selectedAnimal={referralAnimal} onSelect={setReferralAnimal} label="🔍 Patient (optional)" hospitalId={hospitalId || undefined} />

                  {/* Reason - required */}
                  <div>
                    <label className="si-1d2216db">
                      {t('hospitalWorkflow.reasonForReferral')} <span className="si-f84f41a5">*</span>
                    </label>
                    <input
                      placeholder="e.g., Complex orthopedic case requiring specialist evaluation"
                      value={referralForm.reason}
                      onChange={e => setReferralForm(f => ({ ...f, reason: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${!referralForm.reason.trim() ? '#fca5a5' : '#d1d5db'}`, boxSizing: 'border-box' }}
                    />
                    {!referralForm.reason.trim() && (
                      <p className="si-c4e6ca6a">
                        ⚠️ Required: Provide a reason for the referral
                      </p>
                    )}
                  </div>

                  {/* Specialty - optional */}
                  <div>
                    <label className="si-1d2216db">
                      {t('hospitalWorkflow.specialtyNeeded')} <span className="si-fe954780">(optional)</span>
                    </label>
                    <input
                      placeholder="e.g., Cardiology, Orthopedics, Surgery"
                      value={referralForm.specialtyNeeded}
                      onChange={e => setReferralForm(f => ({ ...f, specialtyNeeded: e.target.value }))}
                      className="si-0c92c61f"
                    />
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="si-1d2216db">
                      {t('hospitalWorkflow.priority')} <span className="si-f84f41a5">*</span>
                    </label>
                    <select
                      value={referralForm.priority}
                      onChange={e => setReferralForm(f => ({ ...f, priority: e.target.value }))}
                      className="si-0c92c61f"
                    >
                      {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                    </select>
                  </div>

                  {/* Clinical Notes - optional */}
                  <div>
                    <label className="si-1d2216db">
                      {t('hospitalWorkflow.clinicalNotes')} <span className="si-fe954780">(optional)</span>
                    </label>
                    <textarea
                      placeholder={t('hospitalWorkflow.clinicalNotesPlaceholder')}
                      value={referralForm.clinicalNotes}
                      onChange={e => setReferralForm(f => ({ ...f, clinicalNotes: e.target.value }))}
                      rows={3}
                      className="si-dc3839a2"
                    />
                  </div>

                  <p className="si-ada3b9d6">
                    <span className="si-f84f41a5">*</span> Required field
                  </p>

                  <div className="si-8d13495b">
                    <button
                      onClick={() => { setShowNewReferral(false); setSelectedToVet(null); setReferralAnimal(null); setReferralError('') }}
                      className="si-978a1643"
                    >{t('hospitalWorkflow.cancel')}</button>
                    <button
                      onClick={handleCreateReferral}
                      disabled={!selectedToVet || !referralForm.reason.trim() || referralSubmitting}
                      style={{ padding: '8px 16px', background: (!selectedToVet || !referralForm.reason.trim() || referralSubmitting) ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: (!selectedToVet || !referralForm.reason.trim() || referralSubmitting) ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                    >
                      {referralSubmitting ? '⏳ Creating...' : t('hospitalWorkflow.createReferral')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
