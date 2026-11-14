import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../context/SettingsContext'
import { vetHospitalApi } from '../services/api/vetHospitalApi'
import apiService from '../services/api'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { useMasterData } from '../context/MasterDataContext'
import { TRIAGE_LEVELS } from '../components/hospitalWorkflow/hospitalWorkflowShared'
import QueueStatsTiles from '../components/hospitalWorkflow/QueueStatsTiles'
import QueueList from '../components/hospitalWorkflow/QueueList'
import CheckInModal from '../components/hospitalWorkflow/CheckInModal'
import TriageModal from '../components/hospitalWorkflow/TriageModal'
import WorkflowStatsGrid from '../components/hospitalWorkflow/WorkflowStatsGrid'
import StagePipelineFilter from '../components/hospitalWorkflow/StagePipelineFilter'
import CasesList from '../components/hospitalWorkflow/CasesList'
import CaseDetailModal from '../components/hospitalWorkflow/CaseDetailModal'
import TransitionModal from '../components/hospitalWorkflow/TransitionModal'
import NewCaseModal from '../components/hospitalWorkflow/NewCaseModal'
import ReferralsList from '../components/hospitalWorkflow/ReferralsList'
import NewReferralModal from '../components/hospitalWorkflow/NewReferralModal'

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
            className={`hw-tab-btn ${tab === tb ? 'is-active' : ''}`}>
            {tb === 'queue' ? `📋 ${t('hospitalWorkflow.queueAndTriage')}` : tb === 'workflow' ? `🔄 ${t('hospitalWorkflow.clinicalWorkflow')}` : `🔀 ${t('hospitalWorkflow.referrals')}`}
          </button>
        ))}
      </div>

      {/* ═══ QUEUE TAB ═══ */}
      {tab === 'queue' && (
        <div>
          <QueueStatsTiles queueStats={queueStats} queueStatusFilter={queueStatusFilter} setQueueStatusFilter={setQueueStatusFilter} t={t} />

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

          <QueueList
            queue={queue}
            queueStatusFilter={queueStatusFilter}
            t={t}
            speciesLabel={speciesLabel}
            formatDateTime={formatDateTime}
            onTriage={q => { setTriageTarget(q); setTriageForm({ triageLevel: 3, triageNotes: '' }) }}
            onStatusChange={handleQueueStatus}
          />

          {showCheckIn && (
            <CheckInModal
              checkInMode={checkInMode}
              setCheckInMode={setCheckInMode}
              checkInAnimal={checkInAnimal}
              setCheckInAnimal={setCheckInAnimal}
              checkInError={checkInError}
              setCheckInError={setCheckInError}
              checkInForm={checkInForm}
              setCheckInForm={setCheckInForm}
              checkInSubmitting={checkInSubmitting}
              handleCheckIn={handleCheckIn}
              closeCheckInModal={closeCheckInModal}
              openRegisterMode={openRegisterMode}
              hospitalId={hospitalId}
              t={t}
              walkInForm={walkInForm}
              setWalkInForm={setWalkInForm}
              walkInPhotoPreview={walkInPhotoPreview}
              setWalkInPhotoFile={setWalkInPhotoFile}
              setWalkInPhotoPreview={setWalkInPhotoPreview}
              walkInError={walkInError}
              setWalkInError={setWalkInError}
              walkInRegistering={walkInRegistering}
              walkInFormValid={walkInFormValid}
              handleWalkInRegister={handleWalkInRegister}
              speciesCategories={speciesCategories}
              breedsForSpecies={breedsForSpecies}
              breedLabel={breedLabel}
              classTermsForSpecies={classTermsForSpecies}
              findClassTerm={findClassTerm}
              earTagSpecies={earTagSpecies}
              speciesLabel={speciesLabel}
              resolveLabel={resolveLabel}
            />
          )}

          <TriageModal
            triageTarget={triageTarget}
            setTriageTarget={setTriageTarget}
            triageForm={triageForm}
            setTriageForm={setTriageForm}
            handleTriage={handleTriage}
            t={t}
          />
        </div>
      )}

      {/* ═══ WORKFLOW TAB ═══ */}
      {tab === 'workflow' && (
        <div>
          <WorkflowStatsGrid dashboard={dashboard} t={t} />

          <StagePipelineFilter stageFilter={stageFilter} setStageFilter={setStageFilter} t={t} />

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

          <CasesList cases={cases} t={t} speciesLabel={speciesLabel} onSelectCase={loadCaseDetail} />

          <CaseDetailModal
            selectedCase={selectedCase}
            setSelectedCase={setSelectedCase}
            caseMedicalSummary={caseMedicalSummary}
            t={t}
            formatDateTime={formatDateTime}
            onAdvanceStage={s => { setTransTarget(selectedCase); setTransStage(s) }}
          />

          <TransitionModal
            transTarget={transTarget}
            setTransTarget={setTransTarget}
            transStage={transStage}
            transNotes={transNotes}
            setTransNotes={setTransNotes}
            handleTransition={handleTransition}
            t={t}
          />

          <NewCaseModal
            showNewCase={showNewCase}
            setShowNewCase={setShowNewCase}
            caseAnimal={caseAnimal}
            setCaseAnimal={setCaseAnimal}
            caseForm={caseForm}
            setCaseForm={setCaseForm}
            handleCreateCase={handleCreateCase}
            hospitalId={hospitalId}
            t={t}
          />
        </div>
      )}

      {/* ═══ REFERRALS TAB ═══ */}
      {tab === 'referrals' && (
        <div>
          <div className="si-101fd1d0">
            <h2 className="si-670df8d2">{t('hospitalWorkflow.specialistReferrals')}</h2>
            <button onClick={() => setShowNewReferral(true)} className="si-880bdf60">+ {t('hospitalWorkflow.newReferral')}</button>
          </div>

          <ReferralsList referrals={referrals} t={t} speciesLabel={speciesLabel} onReferralAction={handleReferralAction} />

          <NewReferralModal
            showNewReferral={showNewReferral}
            setShowNewReferral={setShowNewReferral}
            selectedToVet={selectedToVet}
            setSelectedToVet={setSelectedToVet}
            referralAnimal={referralAnimal}
            setReferralAnimal={setReferralAnimal}
            referralForm={referralForm}
            setReferralForm={setReferralForm}
            referralError={referralError}
            setReferralError={setReferralError}
            referralSubmitting={referralSubmitting}
            handleCreateReferral={handleCreateReferral}
            hospitalId={hospitalId}
            t={t}
          />
        </div>
      )}
    </div>
  )
}
