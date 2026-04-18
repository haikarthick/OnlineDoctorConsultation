import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../context/SettingsContext'
import { vetHospitalApi } from '../services/api/vetHospitalApi'
import apiService from '../services/api'
import AnimalSearchPicker from '../components/AnimalSearchPicker'
import VetSearchPicker from '../components/VetSearchPicker'

const STAGES = ['triage', 'examination', 'treatment', 'observation', 'discharge'] as const
const PRIORITIES = ['emergency', 'urgent', 'high', 'normal', 'low'] as const
const PRIORITY_COLORS: Record<string, string> = {
  emergency: '#dc2626', urgent: '#ea580c', high: '#d97706', normal: '#2563eb', low: '#6b7280',
}

// Triage level 1–5 maps directly to a priority — these are the SAME concept.
// Never show both independently; derive priority from level automatically.
const TRIAGE_LEVELS: Record<number, { priority: string; label: string; description: string; color: string; bg: string; icon: string }> = {
  1: { priority: 'emergency', label: 'Critical',  description: 'Immediate life-threatening — act now',  color: '#dc2626', bg: '#fee2e2', icon: '🚨' },
  2: { priority: 'urgent',    label: 'Urgent',    description: 'Serious condition — seen within 15 min', color: '#ea580c', bg: '#ffedd5', icon: '⚠️' },
  3: { priority: 'high',      label: 'High',      description: 'Significant concern — monitor closely',  color: '#d97706', bg: '#fef3c7', icon: '🔶' },
  4: { priority: 'normal',    label: 'Moderate',  description: 'Stable — routine attention required',    color: '#2563eb', bg: '#dbeafe', icon: '🔵' },
  5: { priority: 'low',       label: 'Minor',     description: 'Non-urgent — can wait for treatment',    color: '#6b7280', bg: '#f1f5f9', icon: '🟢' },
}
const STAGE_ICONS: Record<string, string> = {
  triage: '🏥', examination: '🔍', treatment: '💊', observation: '👁️', discharge: '✅',
}

export default function HospitalWorkflow() {
  const { t } = useTranslation()
  const { formatDateTime } = useSettings()

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
  const [walkInForm, setWalkInForm] = useState({ ownerName: '', ownerPhone: '', ownerEmail: '', animalName: '', animalSpecies: '', animalBreed: '' })
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

  // Actions
  function closeCheckInModal() {
    setShowCheckIn(false)
    setCheckInAnimal(null)
    setCheckInError('')
    setCheckInMode('search')
    setWalkInForm({ ownerName: '', ownerPhone: '', ownerEmail: '', animalName: '', animalSpecies: '', animalBreed: '' })
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
    if (!networkId || !hospitalId) return
    const { ownerName, animalName, animalSpecies } = walkInForm
    if (!ownerName.trim() || !animalName.trim() || !animalSpecies.trim()) {
      setWalkInError(t('hospitalWorkflow.walkIn.requiredFields'))
      return
    }
    setWalkInError('')
    setWalkInRegistering(true)
    try {
      const res = await apiService.registerWalkInPatientDirect(networkId, {
        hospitalId,
        patientName: walkInForm.ownerName.trim(),
        patientPhone: walkInForm.ownerPhone.trim() || undefined,
        patientEmail: walkInForm.ownerEmail.trim() || undefined,
        animalName: walkInForm.animalName.trim(),
        animalSpecies: walkInForm.animalSpecies.trim(),
        animalBreed: walkInForm.animalBreed.trim() || undefined,
        reasonForVisit: checkInForm.reason.trim() || undefined,
      })
      // Auto-select the newly registered animal for check-in
      const registered = res.data
      setCheckInAnimal({
        id: registered.animalId,
        owner_id: registered.patientId,
        name: walkInForm.animalName.trim(),
        species: walkInForm.animalSpecies.trim(),
        breed: walkInForm.animalBreed.trim() || '',
        owner_first_name: walkInForm.ownerName.trim().split(' ')[0],
        owner_last_name: walkInForm.ownerName.trim().split(' ').slice(1).join(' '),
        owner_phone: walkInForm.ownerPhone.trim() || '',
        networkPatientId: registered.networkPatientId,
      })
      setCheckInMode('search')
      setWalkInForm({ ownerName: '', ownerPhone: '', ownerEmail: '', animalName: '', animalSpecies: '', animalBreed: '' })
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
    return <div className="module-page" style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><div className="spinner" /></div>
  }

  if (!loading && hospitals.length === 0) {
    return (
      <div className="module-page" style={{ minHeight: 'calc(100vh - 64px)', padding: '24px' }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>🏥 {t('hospitalWorkflow.title')}</h1>
        <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: 14 }}>{t('hospitalWorkflow.subtitle')}</p>
        {loadError && (
          <div className="module-alert error" style={{ marginTop: 16 }}>
            <span>⚠️ {loadError}</span>
            <button onClick={() => setLoadError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
        )}
        <div style={{ marginTop: 48, textAlign: 'center', padding: 40, background: '#f8fafc', borderRadius: 12, border: '2px dashed #cbd5e1' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏥</div>
          <h2 style={{ margin: '0 0 8px', color: '#334155' }}>{t('hospitalWorkflow.noHospitals', 'No Hospital Assigned')}</h2>
          <p style={{ color: '#64748b', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
            {t('hospitalWorkflow.noHospitalsDesc', 'You are not currently assigned to any hospital. Please contact your network administrator to get assigned to a branch hospital.')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page" style={{ minHeight: 'calc(100vh - 64px)', padding: '24px' }}>
      {loadError && (
        <div className="module-alert error" style={{ marginBottom: 16 }}>
          <span>⚠️ {loadError}</span>
          <button onClick={() => setLoadError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>🏥 {t('hospitalWorkflow.title')}</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>{t('hospitalWorkflow.subtitle')}</p>
        </div>
        {hospitals.length > 1 && (
          <select value={hospitalId} onChange={e => setHospitalId(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}>
            {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        )}
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f1f5f9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
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
          {/* Stats Row — clickable tiles filter the queue below */}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
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
                      <div style={{ fontSize: 12, color: isActive ? '#fff' : '#64748b', marginBottom: 4 }}>{s.label} {isClickable && <span style={{ fontSize: 10, opacity: 0.7 }}>{isActive ? '▲' : '▼'}</span>}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: isActive ? '#fff' : s.color }}>{s.value ?? 0}</div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{t('hospitalWorkflow.patientQueue')}</h2>
              {queueStatusFilter && (
                <span style={{ fontSize: 13, color: '#64748b', background: '#f1f5f9', borderRadius: 20, padding: '3px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Filtered: <strong>{queueStatusFilter.replace(/_/g, ' ')}</strong>
                  <button onClick={() => setQueueStatusFilter('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>
                </span>
              )}
            </div>
            <button onClick={() => setShowCheckIn(true)} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              + {t('hospitalWorkflow.checkInPatient')}
            </button>
          </div>

          {/* Queue List — filtered by status or emergency priority if tile selected */}
          {(() => {
            // Apply filter
            let filtered = queue
            if (queueStatusFilter === 'emergency') {
              filtered = queue.filter(q => q.priority === 'emergency')
            } else if (queueStatusFilter) {
              filtered = queue.filter(q => q.status === queueStatusFilter)
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>{t('hospitalWorkflow.noPatients')}</p>}
                {filtered.map((q, idx) => (
                  <div key={q.id} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderLeft: `4px solid ${PRIORITY_COLORS[q.priority] || '#2563eb'}` }}>
                    {/* Queue position: per-status index when filtered, global number when unfiltered */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 36 }}>
                      <div style={{ fontWeight: 700, fontSize: 18, color: '#2563eb', lineHeight: 1 }}>
                        #{queueStatusFilter ? idx + 1 : q.queue_number}
                      </div>
                      {queueStatusFilter && (
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Q#{q.queue_number}</div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontWeight: 600 }}>{q.animal_name || t('hospitalWorkflow.unknownPatient')} <span style={{ fontSize: 12, color: '#94a3b8' }}>({q.animal_species}{q.animal_breed ? ` — ${q.animal_breed}` : ''})</span></div>
                      <div style={{ fontSize: 13, color: '#64748b' }}>{t('hospitalWorkflow.owner')}: {q.owner_first_name} {q.owner_last_name}</div>
                      {q.enterpriseName && (
                        <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600, marginTop: 2 }}>
                          🏢 {q.enterpriseName}{q.groupName ? ` › ${q.groupName}` : ''}
                        </div>
                      )}
                      {(q.referralId || (q as any).referral_id) && (
                        <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 600, marginTop: 2 }}>
                          🔄 Referred from Network
                        </div>
                      )}
                      {q.reason && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{q.reason}</div>}
                      {/* Check-in time */}
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>🕐 Checked in: {formatDateTime(q.checked_in_at)}</div>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: PRIORITY_COLORS[q.priority] + '20', color: PRIORITY_COLORS[q.priority] }}>{q.priority}</span>
                    <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#475569' }}>{(q.status || '').replace(/_/g, ' ')}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {q.status === 'waiting' && (
                        <button onClick={() => { setTriageTarget(q); setTriageForm({ triageLevel: 3, triageNotes: '' }); }} style={{ padding: '6px 12px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{t('hospitalWorkflow.triage')}</button>
                      )}
                      {['waiting', 'in_triage'].includes(q.status) && (
                        <button onClick={() => handleQueueStatus(q.id, 'in_examination')} style={{ padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{t('hospitalWorkflow.startExam')}</button>
                      )}
                      {q.status === 'in_examination' && (
                        <button onClick={() => handleQueueStatus(q.id, 'in_treatment')} style={{ padding: '6px 12px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{t('hospitalWorkflow.treat')}</button>
                      )}
                      {q.status !== 'discharged' && q.status !== 'no_show' && (
                        <button onClick={() => handleQueueStatus(q.id, 'discharged')} style={{ padding: '6px 12px', background: '#64748b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>{t('hospitalWorkflow.discharge')}</button>
                      )}
                      {q.status === 'waiting' && (
                        <button onClick={() => handleQueueStatus(q.id, 'no_show')} style={{ padding: '6px 10px', background: '#fecaca', color: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>{t('hospitalWorkflow.noShow')}</button>
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
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 520, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>🏥 {t('hospitalWorkflow.checkInPatient')}</h3>
                    {checkInMode === 'register' && (
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{t('hospitalWorkflow.walkIn.subtitle')}</div>
                    )}
                  </div>
                  <button onClick={closeCheckInModal} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
                </div>

                {checkInError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, fontWeight: 500 }}>
                    ⚠️ {checkInError}
                  </div>
                )}

                {checkInMode === 'search' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <AnimalSearchPicker
                        selectedAnimal={checkInAnimal}
                        onSelect={a => { setCheckInAnimal(a); setCheckInError('') }}
                        label={`🔍 ${t('hospitalWorkflow.searchPatient')} *`}
                        onRegisterNew={networkId ? () => { setCheckInMode('register'); setWalkInError('') } : undefined}
                      />
                      {!checkInAnimal && (
                        <div style={{ marginTop: 6, fontSize: 12, color: '#b45309', background: '#fef3c7', borderRadius: 6, padding: '6px 10px' }}>
                          ⚠️ <strong>{t('hospitalWorkflow.walkIn.searchRequired')}</strong>
                        </div>
                      )}
                    </div>
                    {networkId && !checkInAnimal && (
                      <div style={{ textAlign: 'center', padding: '4px 0' }}>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{t('hospitalWorkflow.walkIn.or')} </span>
                        <button onClick={() => { setCheckInMode('register'); setWalkInError('') }}
                          style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '2px 4px', textDecoration: 'underline' }}>
                          ➕ {t('hospitalWorkflow.walkIn.registerNew')}
                        </button>
                      </div>
                    )}
                    <div>
                      <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('hospitalWorkflow.reasonForVisit')} <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                      <input placeholder="e.g., Vaccination, Limping, Skin rash..." value={checkInForm.reason} onChange={e => setCheckInForm(f => ({ ...f, reason: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: 14 }} />
                    </div>
                    <div>
                      <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 6, display: 'block' }}>{t('hospitalWorkflow.priority')} <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {PRIORITIES.map(p => (
                          <button key={p} onClick={() => setCheckInForm(f => ({ ...f, priority: p }))}
                            style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: checkInForm.priority === p ? `2px solid ${PRIORITY_COLORS[p]}` : '1px solid #d1d5db', background: checkInForm.priority === p ? PRIORITY_COLORS[p] + '15' : '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 12, color: PRIORITY_COLORS[p], textTransform: 'capitalize' }}>{p}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}><span style={{ color: '#dc2626' }}>*</span> Required field</div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid #f1f5f9' }}>
                      <button onClick={closeCheckInModal} style={{ padding: '10px 20px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>{t('hospitalWorkflow.cancel')}</button>
                      <button onClick={handleCheckIn} disabled={!checkInAnimal || checkInSubmitting}
                        style={{ padding: '10px 20px', background: checkInAnimal && !checkInSubmitting ? '#2563eb' : '#94a3b8', color: '#fff', border: 'none', borderRadius: 8, cursor: checkInAnimal && !checkInSubmitting ? 'pointer' : 'not-allowed', fontWeight: 700, minWidth: 120 }}>
                        {checkInSubmitting ? `⏳ ${t('hospitalWorkflow.checkingIn')}` : `✅ ${t('hospitalWorkflow.checkIn')}`}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Walk-in Patient Registration Form */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#15803d' }}>
                      🐾 {t('hospitalWorkflow.walkIn.instructions')}
                    </div>

                    {walkInError && (
                      <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>
                        ⚠️ {walkInError}
                      </div>
                    )}

                    <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', marginBottom: 10, textTransform: 'uppercase' }}>👤 {t('hospitalWorkflow.walkIn.ownerDetails')}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('hospitalWorkflow.walkIn.ownerName')} <span style={{ color: '#dc2626' }}>*</span></label>
                          <input placeholder={t('hospitalWorkflow.walkIn.ownerNamePlaceholder')} value={walkInForm.ownerName} onChange={e => setWalkInForm(f => ({ ...f, ownerName: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: 14 }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div>
                            <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('hospitalWorkflow.walkIn.ownerPhone')} <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                            <input placeholder="+91 9876543210" value={walkInForm.ownerPhone} onChange={e => setWalkInForm(f => ({ ...f, ownerPhone: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: 14 }} />
                          </div>
                          <div>
                            <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('hospitalWorkflow.walkIn.ownerEmail')} <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                            <input placeholder="owner@email.com" type="email" value={walkInForm.ownerEmail} onChange={e => setWalkInForm(f => ({ ...f, ownerEmail: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: 14 }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', marginBottom: 10, textTransform: 'uppercase' }}>🐾 {t('hospitalWorkflow.walkIn.patientDetails')}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('hospitalWorkflow.walkIn.animalName')} <span style={{ color: '#dc2626' }}>*</span></label>
                          <input placeholder={t('hospitalWorkflow.walkIn.animalNamePlaceholder')} value={walkInForm.animalName} onChange={e => setWalkInForm(f => ({ ...f, animalName: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: 14 }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div>
                            <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('hospitalWorkflow.walkIn.species')} <span style={{ color: '#dc2626' }}>*</span></label>
                            <select value={walkInForm.animalSpecies} onChange={e => setWalkInForm(f => ({ ...f, animalSpecies: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: 14, background: '#fff' }}>
                              <option value="">{t('hospitalWorkflow.walkIn.selectSpecies')}</option>
                              <option value="dog">🐕 {t('common.species.dog')}</option>
                              <option value="cat">🐈 {t('common.species.cat')}</option>
                              <option value="bird">🐦 {t('common.species.bird')}</option>
                              <option value="rabbit">🐇 {t('common.species.rabbit')}</option>
                              <option value="horse">🐎 {t('common.species.horse')}</option>
                              <option value="cow">🐄 {t('common.species.cow')}</option>
                              <option value="goat">🐐 {t('common.species.goat')}</option>
                              <option value="sheep">🐑 {t('common.species.sheep')}</option>
                              <option value="pig">🐖 {t('common.species.pig')}</option>
                              <option value="other">{t('common.species.other')}</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('hospitalWorkflow.walkIn.breed')} <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                            <input placeholder={t('hospitalWorkflow.walkIn.breedPlaceholder')} value={walkInForm.animalBreed} onChange={e => setWalkInForm(f => ({ ...f, animalBreed: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: 14 }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: '#94a3b8' }}><span style={{ color: '#dc2626' }}>*</span> Required field</div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid #f1f5f9' }}>
                      <button onClick={() => { setCheckInMode('search'); setWalkInError('') }} style={{ padding: '10px 20px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>← {t('hospitalWorkflow.walkIn.backToSearch')}</button>
                      <button onClick={handleWalkInRegister}
                        disabled={!walkInForm.ownerName.trim() || !walkInForm.animalName.trim() || !walkInForm.animalSpecies.trim() || walkInRegistering}
                        style={{ padding: '10px 20px', background: (walkInForm.ownerName.trim() && walkInForm.animalName.trim() && walkInForm.animalSpecies.trim() && !walkInRegistering) ? '#15803d' : '#94a3b8', color: '#fff', border: 'none', borderRadius: 8, cursor: (walkInForm.ownerName.trim() && walkInForm.animalName.trim() && walkInForm.animalSpecies.trim() && !walkInRegistering) ? 'pointer' : 'not-allowed', fontWeight: 700, minWidth: 140 }}>
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
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 480, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>🏥 Triage — #{triageTarget.queue_number} {triageTarget.animal_name}</h3>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Select severity level — priority is derived automatically</div>
                  </div>
                  <button onClick={() => setTriageTarget(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Unified triage level selector — number + label + color all in one */}
                  <div>
                    <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 8, display: 'block' }}>
                      {t('hospitalWorkflow.triageLevel')} <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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

                  {/* Derived priority badge — confirmation that priority auto-matches level */}
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
                    <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>
                      {t('hospitalWorkflow.triageNotesPlaceholder')} <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span>
                    </label>
                    <textarea placeholder="Observed symptoms, vital signs, reason for triage level..." value={triageForm.triageNotes} onChange={e => setTriageForm(f => ({ ...f, triageNotes: e.target.value }))} rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical', boxSizing: 'border-box', fontSize: 14 }} />
                  </div>

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid #f1f5f9' }}>
                    <button onClick={() => setTriageTarget(null)} style={{ padding: '10px 20px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>{t('hospitalWorkflow.cancel')}</button>
                    <button onClick={handleTriage} style={{ padding: '10px 20px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>{t('hospitalWorkflow.saveTriage')}</button>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', borderLeft: '4px solid #2563eb' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>{t('hospitalWorkflow.activeCases')}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#2563eb' }}>{dashboard.today?.active_cases ?? 0}</div>
              </div>
              <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', borderLeft: '4px solid #059669' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>{t('hospitalWorkflow.completedToday')}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#059669' }}>{dashboard.today?.completed_today ?? 0}</div>
              </div>
              <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>{t('hospitalWorkflow.avgDuration')}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}>{dashboard.avgCaseDurationMinutes ?? 0}m</div>
              </div>
              {(dashboard.stageCounts || []).map((s: any) => (
                <div key={s.current_stage} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', borderLeft: '4px solid #94a3b8' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{STAGE_ICONS[s.current_stage]} {s.current_stage}</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{s.count}</div>
                </div>
              ))}
            </div>
          )}

          {/* Stage Pipeline View */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
            <button onClick={() => setStageFilter('')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', background: stageFilter === '' ? '#2563eb' : '#e2e8f0', color: stageFilter === '' ? '#fff' : '#475569', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>{t('hospitalWorkflow.allStages')}</button>
            {STAGES.map(s => (
              <button key={s} onClick={() => setStageFilter(s)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', background: stageFilter === s ? '#2563eb' : '#e2e8f0', color: stageFilter === s ? '#fff' : '#475569', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                {STAGE_ICONS[s]} {s}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>{t('hospitalWorkflow.clinicalCases')}</h2>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                📋 Tracks detailed clinical journey for each patient (triage → examination → treatment → observation → discharge).
                Cases are <strong>auto-created</strong> when you click <em>Start Exam</em> in Queue &amp; Triage.
              </p>
            </div>
            <button onClick={() => setShowNewCase(true)} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, alignSelf: 'flex-start' }}>+ {t('hospitalWorkflow.newCase')}</button>
          </div>

          {/* Cases List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cases.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>{t('hospitalWorkflow.noCases')}</p>}
            {cases.map(c => (
              <div key={c.id} onClick={() => loadCaseDetail(c.id)} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', cursor: 'pointer', borderLeft: `4px solid ${PRIORITY_COLORS[c.priority] || '#2563eb'}`, transition: 'box-shadow .2s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.12)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.06)')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 20 }}>{STAGE_ICONS[c.current_stage]}</span>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontWeight: 600 }}>{c.animal_name || t('hospitalWorkflow.unknown')} <span style={{ fontSize: 12, color: '#94a3b8' }}>({c.animal_species})</span></div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>{c.chief_complaint || t('hospitalWorkflow.noComplaintNoted')}</div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: PRIORITY_COLORS[c.priority] + '20', color: PRIORITY_COLORS[c.priority] }}>{c.priority}</span>
                  <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#dbeafe', color: '#1d4ed8' }}>{c.current_stage}</span>
                  <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: c.status === 'active' ? '#dcfce7' : '#f1f5f9', color: c.status === 'active' ? '#166534' : '#64748b' }}>{c.status}</span>
                  {c.vet_first_name && <span style={{ fontSize: 12, color: '#64748b' }}>Dr. {c.vet_first_name} {c.vet_last_name}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Case Detail Modal */}
          {selectedCase && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 600, maxWidth: '95vw', maxHeight: '80vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0 }}>{t('hospitalWorkflow.case')}: {selectedCase.animal_name || t('hospitalWorkflow.unknown')}</h3>
                  <button onClick={() => setSelectedCase(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
                </div>

                {/* Stage Pipeline */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 20, overflowX: 'auto' }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: 14 }}>
                  <div><strong>{t('hospitalWorkflow.priority')}:</strong> <span style={{ color: PRIORITY_COLORS[selectedCase.priority] }}>{selectedCase.priority}</span></div>
                  <div><strong>{t('hospitalWorkflow.status')}:</strong> {selectedCase.status}</div>
                  <div><strong>{t('hospitalWorkflow.owner')}:</strong> {selectedCase.owner_first_name} {selectedCase.owner_last_name}</div>
                  <div><strong>{t('hospitalWorkflow.vet')}:</strong> {selectedCase.vet_first_name ? `Dr. ${selectedCase.vet_first_name} ${selectedCase.vet_last_name}` : t('hospitalWorkflow.unassigned')}</div>
                  {selectedCase.chief_complaint && <div style={{ gridColumn: '1/3' }}><strong>{t('hospitalWorkflow.chiefComplaint')}:</strong> {selectedCase.chief_complaint}</div>}
                  {selectedCase.diagnosis && <div style={{ gridColumn: '1/3' }}><strong>{t('hospitalWorkflow.diagnosis')}:</strong> {selectedCase.diagnosis}</div>}
                  {selectedCase.treatment_plan && <div style={{ gridColumn: '1/3' }}><strong>{t('hospitalWorkflow.treatmentPlan')}:</strong> {selectedCase.treatment_plan}</div>}
                </div>

                {/* Transition History */}
                {selectedCase.transitions && selectedCase.transitions.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ margin: '0 0 8px' }}>{t('hospitalWorkflow.workflowHistory')}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {selectedCase.transitions.map((tr: any, i: number) => (
                        <div key={i} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontWeight: 600 }}>{tr.from_stage || '—'} → {tr.to_stage}</span>
                          <span style={{ color: '#64748b' }}>{t('hospitalWorkflow.by')} {tr.first_name} {tr.last_name}</span>
                          <span style={{ color: '#94a3b8', marginLeft: 'auto', fontSize: 12 }}>{formatDateTime(tr.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Medical History Panel */}
                {caseMedicalSummary && (
                  <div style={{ marginBottom: 16, border: '1px solid #e0e7ff', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ background: '#eef2ff', padding: '10px 14px', fontWeight: 700, fontSize: 14, color: '#3730a3' }}>📋 {t('hospitalWorkflow.medicalHistory')} — {caseMedicalSummary.animal?.name}</div>
                    <div style={{ padding: '12px 14px' }}>
                      {/* Allergies */}
                      {caseMedicalSummary.allergies?.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, color: '#dc2626', marginBottom: 4 }}>⚠️ {t('hospitalWorkflow.allergies')}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {caseMedicalSummary.allergies.map((a: any) => (
                              <span key={a.id} style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#fef2f2', color: '#991b1b' }}>{a.allergen} ({a.severity})</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Recent records */}
                      {caseMedicalSummary.recentRecords?.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 4 }}>{t('hospitalWorkflow.recentRecords')}</div>
                          {caseMedicalSummary.recentRecords.slice(0, 5).map((r: any) => (
                            <div key={r.id} style={{ padding: '6px 10px', borderRadius: 6, background: '#f9fafb', marginBottom: 4, fontSize: 12 }}>
                              <span style={{ fontWeight: 600 }}>{r.title || r.record_type}</span>
                              {r.diagnosis && <span style={{ color: '#6b7280' }}> — {r.diagnosis}</span>}
                              <span style={{ color: '#94a3b8', marginLeft: 8 }}>{formatDateTime(r.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Active prescriptions */}
                      {caseMedicalSummary.recentPrescriptions?.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 4 }}>💊 {t('hospitalWorkflow.recentPrescriptions')}</div>
                          {caseMedicalSummary.recentPrescriptions.slice(0, 3).map((p: any) => (
                            <div key={p.id} style={{ padding: '4px 10px', fontSize: 12, color: '#4b5563' }}>
                              {p.diagnosis || 'Prescription'} — Dr. {p.vet_first_name} {p.vet_last_name} <span style={{ color: '#94a3b8' }}>{formatDateTime(p.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Vaccinations */}
                      {caseMedicalSummary.recentVaccinations?.length > 0 && (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 4 }}>💉 {t('hospitalWorkflow.vaccinations')}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {caseMedicalSummary.recentVaccinations.map((v: any) => (
                              <span key={v.id} style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, background: '#dcfce7', color: '#166534' }}>{v.vaccine_name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {!caseMedicalSummary.recentRecords?.length && !caseMedicalSummary.allergies?.length && (
                        <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: 12 }}>{t('hospitalWorkflow.noMedicalHistory')}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Advance Stage */}
                {selectedCase.status === 'active' && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 400, maxWidth: '90vw' }}>
                <h3 style={{ marginTop: 0 }}>{t('hospitalWorkflow.moveTo')} {STAGE_ICONS[transStage]} {transStage}</h3>
                <textarea placeholder={t('hospitalWorkflow.notesOptional')} value={transNotes} onChange={e => setTransNotes(e.target.value)} rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', marginBottom: 12, resize: 'vertical', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setTransTarget(null)} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>{t('hospitalWorkflow.cancel')}</button>
                  <button onClick={handleTransition} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>{t('hospitalWorkflow.confirm')}</button>
                </div>
              </div>
            </div>
          )}

          {/* Create Case Modal */}
          {showNewCase && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 480, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }}>
                <h3 style={{ marginTop: 0 }}>🔄 {t('hospitalWorkflow.newClinicalCase')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <AnimalSearchPicker selectedAnimal={caseAnimal} onSelect={setCaseAnimal} />
                  <div>
                    <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('hospitalWorkflow.chiefComplaint')}</label>
                    <textarea placeholder={t('hospitalWorkflow.chiefComplaintPlaceholder')} value={caseForm.chiefComplaint} onChange={e => setCaseForm(f => ({ ...f, chiefComplaint: e.target.value }))} rows={2} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('hospitalWorkflow.priority')}</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {PRIORITIES.map(p => (
                        <button key={p} onClick={() => setCaseForm(f => ({ ...f, priority: p }))}
                          style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: caseForm.priority === p ? `2px solid ${PRIORITY_COLORS[p]}` : '1px solid #d1d5db', background: caseForm.priority === p ? PRIORITY_COLORS[p] + '15' : '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 12, color: PRIORITY_COLORS[p], textTransform: 'capitalize' }}>{p}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                    <button onClick={() => { setShowNewCase(false); setCaseAnimal(null) }} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>{t('hospitalWorkflow.cancel')}</button>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>{t('hospitalWorkflow.specialistReferrals')}</h2>
            <button onClick={() => setShowNewReferral(true)} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>+ {t('hospitalWorkflow.newReferral')}</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {referrals.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>{t('hospitalWorkflow.noReferrals')}</p>}
            {referrals.map(r => (
              <div key={r.id} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', borderLeft: `4px solid ${PRIORITY_COLORS[r.priority] || '#2563eb'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 600 }}>From Dr. {r.from_vet_first} {r.from_vet_last} → Dr. {r.to_vet_first} {r.to_vet_last}</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{r.reason}</div>
                    {r.specialty_needed && <div style={{ fontSize: 12, color: '#8b5cf6', marginTop: 2 }}>{t('hospitalWorkflow.specialty')}: {r.specialty_needed}</div>}
                    {r.animal_name && <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('hospitalWorkflow.patient')}: {r.animal_name} ({r.animal_species})</div>}
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: r.status === 'pending' ? '#fef3c7' : r.status === 'accepted' ? '#dcfce7' : r.status === 'completed' ? '#dbeafe' : '#fecaca', color: r.status === 'pending' ? '#92400e' : r.status === 'accepted' ? '#166534' : r.status === 'completed' ? '#1d4ed8' : '#991b1b' }}>{r.status}</span>
                  {r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleReferralAction(r.id, 'accepted')} style={{ padding: '6px 12px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{t('hospitalWorkflow.accept')}</button>
                      <button onClick={() => handleReferralAction(r.id, 'declined')} style={{ padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>{t('hospitalWorkflow.decline')}</button>
                    </div>
                  )}
                  {r.status === 'accepted' && (
                    <button onClick={() => handleReferralAction(r.id, 'completed')} style={{ padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{t('hospitalWorkflow.complete')}</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Create Referral Modal */}
          {showNewReferral && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}
              onClick={e => { if (e.target === e.currentTarget) { setShowNewReferral(false); setSelectedToVet(null); setReferralAnimal(null); setReferralError('') } }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 520, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto', position: 'relative' }}>
                <button onClick={() => { setShowNewReferral(false); setSelectedToVet(null); setReferralAnimal(null); setReferralError('') }}
                  style={{ position: 'absolute', top: 16, right: 16, background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 16 }}>✕</button>
                <h3 style={{ marginTop: 0, marginBottom: 16 }}>🔀 {t('hospitalWorkflow.newSpecialistReferral')}</h3>

                {referralError && (
                  <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
                    ⚠️ {referralError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Vet Search — required */}
                  <VetSearchPicker selectedVet={selectedToVet} onSelect={setSelectedToVet} required />
                  {!selectedToVet && (
                    <p style={{ margin: '-6px 0 0', fontSize: 12, color: '#d97706' }}>
                      ⚠️ Required: Search and select a veterinarian to enable submission
                    </p>
                  )}

                  {/* Patient — optional */}
                  <AnimalSearchPicker selectedAnimal={referralAnimal} onSelect={setReferralAnimal} label="🔍 Patient (optional)" />

                  {/* Reason — required */}
                  <div>
                    <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>
                      {t('hospitalWorkflow.reasonForReferral')} <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      placeholder="e.g., Complex orthopedic case requiring specialist evaluation"
                      value={referralForm.reason}
                      onChange={e => setReferralForm(f => ({ ...f, reason: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${!referralForm.reason.trim() ? '#fca5a5' : '#d1d5db'}`, boxSizing: 'border-box' }}
                    />
                    {!referralForm.reason.trim() && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#d97706' }}>
                        ⚠️ Required: Provide a reason for the referral
                      </p>
                    )}
                  </div>

                  {/* Specialty — optional */}
                  <div>
                    <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>
                      {t('hospitalWorkflow.specialtyNeeded')} <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 400 }}>(optional)</span>
                    </label>
                    <input
                      placeholder="e.g., Cardiology, Orthopedics, Surgery"
                      value={referralForm.specialtyNeeded}
                      onChange={e => setReferralForm(f => ({ ...f, specialtyNeeded: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Priority */}
                  <div>
                    <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>
                      {t('hospitalWorkflow.priority')} <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <select
                      value={referralForm.priority}
                      onChange={e => setReferralForm(f => ({ ...f, priority: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                    >
                      {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                    </select>
                  </div>

                  {/* Clinical Notes — optional */}
                  <div>
                    <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>
                      {t('hospitalWorkflow.clinicalNotes')} <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 400 }}>(optional)</span>
                    </label>
                    <textarea
                      placeholder={t('hospitalWorkflow.clinicalNotesPlaceholder')}
                      value={referralForm.clinicalNotes}
                      onChange={e => setReferralForm(f => ({ ...f, clinicalNotes: e.target.value }))}
                      rows={3}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>

                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
                    <span style={{ color: '#dc2626' }}>*</span> Required field
                  </p>

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                    <button
                      onClick={() => { setShowNewReferral(false); setSelectedToVet(null); setReferralAnimal(null); setReferralError('') }}
                      style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}
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
