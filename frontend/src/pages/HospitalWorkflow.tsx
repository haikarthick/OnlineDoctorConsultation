import { useState, useEffect, useCallback } from 'react'
import { useSettings } from '../context/SettingsContext'
import { vetHospitalApi } from '../services/api/vetHospitalApi'
import apiService from '../services/api'
import AnimalSearchPicker from '../components/AnimalSearchPicker'

const STAGES = ['triage', 'examination', 'treatment', 'observation', 'discharge'] as const
const PRIORITIES = ['emergency', 'urgent', 'high', 'normal', 'low'] as const
const PRIORITY_COLORS: Record<string, string> = {
  emergency: '#dc2626', urgent: '#ea580c', high: '#d97706', normal: '#2563eb', low: '#6b7280',
}
const STAGE_ICONS: Record<string, string> = {
  triage: '🏥', examination: '🔍', treatment: '💊', observation: '👁️', discharge: '✅',
}

export default function HospitalWorkflow() {
  const { formatDateTime } = useSettings()

  const [tab, setTab] = useState<'queue' | 'workflow' | 'referrals'>('queue')
  const [hospitalId, setHospitalId] = useState('')
  const [hospitals, setHospitals] = useState<any[]>([])

  // Queue state
  const [queue, setQueue] = useState<any[]>([])
  const [queueStats, setQueueStats] = useState<any>(null)
  const [showCheckIn, setShowCheckIn] = useState(false)
  const [checkInForm, setCheckInForm] = useState({ reason: '', priority: 'normal', animalId: '', ownerId: '' })

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
  const [referralForm, setReferralForm] = useState({ toVetId: '', reason: '', specialtyNeeded: '', priority: 'normal', clinicalNotes: '' })

  // Triage modal
  const [triageTarget, setTriageTarget] = useState<any>(null)
  const [triageForm, setTriageForm] = useState({ triageLevel: 3, triageNotes: '', priority: 'normal' })

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

  const [loading, setLoading] = useState(true)

  // Load hospitals
  useEffect(() => {
    (async () => {
      try {
        const list = await vetHospitalApi.listMyHospitals()
        setHospitals(list || [])
        if (list.length > 0) setHospitalId(list[0].id)
      } catch { /* empty */ }
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
    } catch { /* empty */ }
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
    } catch { /* empty */ }
  }, [hospitalId, stageFilter])

  const loadReferrals = useCallback(async () => {
    if (!hospitalId) return
    try {
      const r = await apiService.listReferrals(hospitalId)
      setReferrals(r.data || [])
    } catch { /* empty */ }
  }, [hospitalId])

  useEffect(() => {
    if (!hospitalId) return
    setLoading(true)
    Promise.all([loadQueue(), loadWorkflow(), loadReferrals()]).finally(() => setLoading(false))
  }, [hospitalId, loadQueue, loadWorkflow, loadReferrals])

  // Actions
  async function handleCheckIn() {
    if (!hospitalId || !checkInAnimal) return
    try {
      await apiService.checkInToQueue(hospitalId, {
        ...checkInForm,
        animalId: checkInAnimal.id,
        ownerId: checkInAnimal.owner_id,
      })
      setShowCheckIn(false)
      setCheckInForm({ reason: '', priority: 'normal', animalId: '', ownerId: '' })
      setCheckInAnimal(null)
      loadQueue()
    } catch { /* empty */ }
  }

  async function handleTriage() {
    if (!triageTarget) return
    try {
      await apiService.triagePatient(triageTarget.id, triageForm)
      setTriageTarget(null)
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
    if (!hospitalId) return
    try {
      await apiService.createReferral(hospitalId, {
        ...referralForm,
        ...(referralAnimal ? { animalId: referralAnimal.id } : {}),
      })
      setShowNewReferral(false)
      setReferralForm({ toVetId: '', reason: '', specialtyNeeded: '', priority: 'normal', clinicalNotes: '' })
      setReferralAnimal(null)
      loadReferrals()
    } catch { /* empty */ }
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

  return (
    <div className="module-page" style={{ minHeight: 'calc(100vh - 64px)', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>🏥 Hospital Workflow</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Queue management, clinical workflow, and specialist referrals</p>
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
        {(['queue', 'workflow', 'referrals'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === t ? '#2563eb' : 'transparent', color: tab === t ? '#fff' : '#64748b',
              fontWeight: tab === t ? 600 : 400, fontSize: 14, transition: 'all .2s',
            }}>
            {t === 'queue' ? '📋 Queue & Triage' : t === 'workflow' ? '🔄 Clinical Workflow' : '🔀 Referrals'}
          </button>
        ))}
      </div>

      {/* ═══ QUEUE TAB ═══ */}
      {tab === 'queue' && (
        <div>
          {/* Stats Row */}
          {queueStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Waiting', value: queueStats.waiting_count, color: '#f59e0b' },
                { label: 'In Triage', value: queueStats.in_triage_count, color: '#8b5cf6' },
                { label: 'In Exam', value: queueStats.in_exam_count, color: '#2563eb' },
                { label: 'In Treatment', value: queueStats.in_treatment_count, color: '#059669' },
                { label: 'Emergencies', value: queueStats.emergency_count, color: '#dc2626' },
                { label: 'Avg Wait', value: `${Math.round(queueStats.avg_wait_minutes || 0)}m`, color: '#64748b' },
                { label: 'Today Total', value: queueStats.today_total, color: '#0ea5e9' },
              ].map((s, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', borderLeft: `4px solid ${s.color}` }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value ?? 0}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Patient Queue</h2>
            <button onClick={() => setShowCheckIn(true)} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              + Check In Patient
            </button>
          </div>

          {/* Queue List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {queue.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>No patients in queue</p>}
            {queue.map(q => (
              <div key={q.id} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderLeft: `4px solid ${PRIORITY_COLORS[q.priority] || '#2563eb'}` }}>
                <div style={{ fontWeight: 700, fontSize: 18, color: '#2563eb', minWidth: 32 }}>#{q.queue_number}</div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontWeight: 600 }}>{q.animal_name || 'Unknown Patient'} <span style={{ fontSize: 12, color: '#94a3b8' }}>({q.animal_species}{q.animal_breed ? ` — ${q.animal_breed}` : ''})</span></div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>Owner: {q.owner_first_name} {q.owner_last_name}</div>
                  {q.reason && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{q.reason}</div>}
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: PRIORITY_COLORS[q.priority] + '20', color: PRIORITY_COLORS[q.priority] }}>{q.priority}</span>
                <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#475569' }}>{q.status.replace(/_/g, ' ')}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {q.status === 'waiting' && (
                    <button onClick={() => { setTriageTarget(q); setTriageForm({ triageLevel: 3, triageNotes: '', priority: q.priority }); }} style={{ padding: '6px 12px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Triage</button>
                  )}
                  {['waiting', 'in_triage'].includes(q.status) && (
                    <button onClick={() => handleQueueStatus(q.id, 'in_examination')} style={{ padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Start Exam</button>
                  )}
                  {q.status === 'in_examination' && (
                    <button onClick={() => handleQueueStatus(q.id, 'in_treatment')} style={{ padding: '6px 12px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Treat</button>
                  )}
                  {q.status !== 'discharged' && q.status !== 'no_show' && (
                    <>
                      <button onClick={() => handleQueueStatus(q.id, 'discharged')} style={{ padding: '6px 12px', background: '#64748b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Discharge</button>
                      <button onClick={() => handleQueueStatus(q.id, 'no_show')} style={{ padding: '6px 10px', background: '#fecaca', color: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>No Show</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Check-in Modal */}
          {showCheckIn && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 480, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }}>
                <h3 style={{ marginTop: 0 }}>🏥 Check In Patient</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <AnimalSearchPicker selectedAnimal={checkInAnimal} onSelect={setCheckInAnimal} />
                  <div>
                    <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>Reason for Visit</label>
                    <input placeholder="e.g., Vaccination, Limping, Skin rash..." value={checkInForm.reason} onChange={e => setCheckInForm(f => ({ ...f, reason: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>Priority</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {PRIORITIES.map(p => (
                        <button key={p} onClick={() => setCheckInForm(f => ({ ...f, priority: p }))}
                          style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: checkInForm.priority === p ? `2px solid ${PRIORITY_COLORS[p]}` : '1px solid #d1d5db', background: checkInForm.priority === p ? PRIORITY_COLORS[p] + '15' : '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 12, color: PRIORITY_COLORS[p], textTransform: 'capitalize' }}>{p}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                    <button onClick={() => { setShowCheckIn(false); setCheckInAnimal(null) }} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleCheckIn} disabled={!checkInAnimal} style={{ padding: '8px 16px', background: checkInAnimal ? '#2563eb' : '#94a3b8', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Check In</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Triage Modal */}
          {triageTarget && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, maxWidth: '90vw' }}>
                <h3 style={{ marginTop: 0 }}>Triage — #{triageTarget.queue_number} {triageTarget.animal_name}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ fontWeight: 500, fontSize: 14 }}>Triage Level (1=Critical, 5=Minor)</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => setTriageForm(f => ({ ...f, triageLevel: n }))}
                        style={{ width: 42, height: 42, borderRadius: 8, border: triageForm.triageLevel === n ? '2px solid #2563eb' : '1px solid #d1d5db', background: triageForm.triageLevel === n ? '#dbeafe' : '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 16 }}>{n}</button>
                    ))}
                  </div>
                  <select value={triageForm.priority} onChange={e => setTriageForm(f => ({ ...f, priority: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <textarea placeholder="Triage notes..." value={triageForm.triageNotes} onChange={e => setTriageForm(f => ({ ...f, triageNotes: e.target.value }))} rows={3} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setTriageTarget(null)} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleTriage} style={{ padding: '8px 16px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Save Triage</button>
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
                <div style={{ fontSize: 12, color: '#64748b' }}>Active Cases</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#2563eb' }}>{dashboard.today?.active_cases ?? 0}</div>
              </div>
              <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', borderLeft: '4px solid #059669' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Completed Today</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#059669' }}>{dashboard.today?.completed_today ?? 0}</div>
              </div>
              <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Avg Duration</div>
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
            <button onClick={() => setStageFilter('')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', background: stageFilter === '' ? '#2563eb' : '#e2e8f0', color: stageFilter === '' ? '#fff' : '#475569', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>All Stages</button>
            {STAGES.map(s => (
              <button key={s} onClick={() => setStageFilter(s)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', background: stageFilter === s ? '#2563eb' : '#e2e8f0', color: stageFilter === s ? '#fff' : '#475569', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                {STAGE_ICONS[s]} {s}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Clinical Cases</h2>
            <button onClick={() => setShowNewCase(true)} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>+ New Case</button>
          </div>

          {/* Cases List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cases.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>No cases found</p>}
            {cases.map(c => (
              <div key={c.id} onClick={() => loadCaseDetail(c.id)} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', cursor: 'pointer', borderLeft: `4px solid ${PRIORITY_COLORS[c.priority] || '#2563eb'}`, transition: 'box-shadow .2s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.12)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.06)')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 20 }}>{STAGE_ICONS[c.current_stage]}</span>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontWeight: 600 }}>{c.animal_name || 'Unknown'} <span style={{ fontSize: 12, color: '#94a3b8' }}>({c.animal_species})</span></div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>{c.chief_complaint || 'No complaint noted'}</div>
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
                  <h3 style={{ margin: 0 }}>Case: {selectedCase.animal_name || 'Unknown'}</h3>
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
                  <div><strong>Priority:</strong> <span style={{ color: PRIORITY_COLORS[selectedCase.priority] }}>{selectedCase.priority}</span></div>
                  <div><strong>Status:</strong> {selectedCase.status}</div>
                  <div><strong>Owner:</strong> {selectedCase.owner_first_name} {selectedCase.owner_last_name}</div>
                  <div><strong>Vet:</strong> {selectedCase.vet_first_name ? `Dr. ${selectedCase.vet_first_name} ${selectedCase.vet_last_name}` : 'Unassigned'}</div>
                  {selectedCase.chief_complaint && <div style={{ gridColumn: '1/3' }}><strong>Chief Complaint:</strong> {selectedCase.chief_complaint}</div>}
                  {selectedCase.diagnosis && <div style={{ gridColumn: '1/3' }}><strong>Diagnosis:</strong> {selectedCase.diagnosis}</div>}
                  {selectedCase.treatment_plan && <div style={{ gridColumn: '1/3' }}><strong>Treatment Plan:</strong> {selectedCase.treatment_plan}</div>}
                </div>

                {/* Transition History */}
                {selectedCase.transitions && selectedCase.transitions.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ margin: '0 0 8px' }}>Workflow History</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {selectedCase.transitions.map((t: any, i: number) => (
                        <div key={i} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontWeight: 600 }}>{t.from_stage || '—'} → {t.to_stage}</span>
                          <span style={{ color: '#64748b' }}>by {t.first_name} {t.last_name}</span>
                          <span style={{ color: '#94a3b8', marginLeft: 'auto', fontSize: 12 }}>{formatDateTime(t.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Medical History Panel */}
                {caseMedicalSummary && (
                  <div style={{ marginBottom: 16, border: '1px solid #e0e7ff', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ background: '#eef2ff', padding: '10px 14px', fontWeight: 700, fontSize: 14, color: '#3730a3' }}>📋 Medical History — {caseMedicalSummary.animal?.name}</div>
                    <div style={{ padding: '12px 14px' }}>
                      {/* Allergies */}
                      {caseMedicalSummary.allergies?.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, color: '#dc2626', marginBottom: 4 }}>⚠️ ALLERGIES</div>
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
                          <div style={{ fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 4 }}>Recent Records</div>
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
                          <div style={{ fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 4 }}>💊 Recent Prescriptions</div>
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
                          <div style={{ fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 4 }}>💉 Vaccinations</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {caseMedicalSummary.recentVaccinations.map((v: any) => (
                              <span key={v.id} style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, background: '#dcfce7', color: '#166534' }}>{v.vaccine_name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {!caseMedicalSummary.recentRecords?.length && !caseMedicalSummary.allergies?.length && (
                        <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: 12 }}>No medical history available</div>
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
                <h3 style={{ marginTop: 0 }}>Move to {STAGE_ICONS[transStage]} {transStage}</h3>
                <textarea placeholder="Notes (optional)..." value={transNotes} onChange={e => setTransNotes(e.target.value)} rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', marginBottom: 12, resize: 'vertical', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setTransTarget(null)} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleTransition} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Confirm</button>
                </div>
              </div>
            </div>
          )}

          {/* Create Case Modal */}
          {showNewCase && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 480, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }}>
                <h3 style={{ marginTop: 0 }}>🔄 New Clinical Case</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <AnimalSearchPicker selectedAnimal={caseAnimal} onSelect={setCaseAnimal} />
                  <div>
                    <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>Chief Complaint</label>
                    <textarea placeholder="Describe chief complaint or symptoms..." value={caseForm.chiefComplaint} onChange={e => setCaseForm(f => ({ ...f, chiefComplaint: e.target.value }))} rows={2} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>Priority</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {PRIORITIES.map(p => (
                        <button key={p} onClick={() => setCaseForm(f => ({ ...f, priority: p }))}
                          style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: caseForm.priority === p ? `2px solid ${PRIORITY_COLORS[p]}` : '1px solid #d1d5db', background: caseForm.priority === p ? PRIORITY_COLORS[p] + '15' : '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 12, color: PRIORITY_COLORS[p], textTransform: 'capitalize' }}>{p}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                    <button onClick={() => { setShowNewCase(false); setCaseAnimal(null) }} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleCreateCase} disabled={!caseAnimal} style={{ padding: '8px 16px', background: caseAnimal ? '#2563eb' : '#94a3b8', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Create Case</button>
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
            <h2 style={{ margin: 0, fontSize: 18 }}>Specialist Referrals</h2>
            <button onClick={() => setShowNewReferral(true)} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>+ New Referral</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {referrals.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>No referrals yet</p>}
            {referrals.map(r => (
              <div key={r.id} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', borderLeft: `4px solid ${PRIORITY_COLORS[r.priority] || '#2563eb'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 600 }}>From Dr. {r.from_vet_first} {r.from_vet_last} → Dr. {r.to_vet_first} {r.to_vet_last}</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{r.reason}</div>
                    {r.specialty_needed && <div style={{ fontSize: 12, color: '#8b5cf6', marginTop: 2 }}>Specialty: {r.specialty_needed}</div>}
                    {r.animal_name && <div style={{ fontSize: 12, color: '#94a3b8' }}>Patient: {r.animal_name} ({r.animal_species})</div>}
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: r.status === 'pending' ? '#fef3c7' : r.status === 'accepted' ? '#dcfce7' : r.status === 'completed' ? '#dbeafe' : '#fecaca', color: r.status === 'pending' ? '#92400e' : r.status === 'accepted' ? '#166534' : r.status === 'completed' ? '#1d4ed8' : '#991b1b' }}>{r.status}</span>
                  {r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleReferralAction(r.id, 'accepted')} style={{ padding: '6px 12px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Accept</button>
                      <button onClick={() => handleReferralAction(r.id, 'declined')} style={{ padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Decline</button>
                    </div>
                  )}
                  {r.status === 'accepted' && (
                    <button onClick={() => handleReferralAction(r.id, 'completed')} style={{ padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Complete</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Create Referral Modal */}
          {showNewReferral && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 500, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }}>
                <h3 style={{ marginTop: 0 }}>🔀 New Specialist Referral</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <AnimalSearchPicker selectedAnimal={referralAnimal} onSelect={setReferralAnimal} label="🔍 Patient (optional)" />
                  <div>
                    <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>Referring To (Vet ID)</label>
                    <input placeholder="Vet user ID" value={referralForm.toVetId} onChange={e => setReferralForm(f => ({ ...f, toVetId: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>Reason for Referral</label>
                    <input placeholder="e.g., Complex orthopedic case" value={referralForm.reason} onChange={e => setReferralForm(f => ({ ...f, reason: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>Specialty Needed</label>
                    <input placeholder="e.g., Cardiology, Orthopedics, Surgery" value={referralForm.specialtyNeeded} onChange={e => setReferralForm(f => ({ ...f, specialtyNeeded: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>Priority</label>
                    <select value={referralForm.priority} onChange={e => setReferralForm(f => ({ ...f, priority: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box' }}>
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>Clinical Notes</label>
                    <textarea placeholder="Clinical notes and observations..." value={referralForm.clinicalNotes} onChange={e => setReferralForm(f => ({ ...f, clinicalNotes: e.target.value }))} rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                    <button onClick={() => { setShowNewReferral(false); setReferralAnimal(null) }} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleCreateReferral} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Create Referral</button>
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
