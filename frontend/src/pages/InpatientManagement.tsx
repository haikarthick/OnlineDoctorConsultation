import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../context/SettingsContext'
import { useMasterData } from '../context/MasterDataContext'
import { vetHospitalApi } from '../services/api/vetHospitalApi'
import apiService from '../services/api'
import AnimalSearchPicker from '../components/AnimalSearchPicker'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

// JSONB columns from PostgreSQL arrive as JS objects — handle both string and array
const parseJsonbArray = (val: any): any[] => {
  if (Array.isArray(val)) return val
  try { return JSON.parse(typeof val === 'string' ? val : '[]') } catch { return [] }
}

const STATUS_COLORS: Record<string, { bg: string; color: string; icon: string }> = {
  admitted:           { bg: '#dbeafe', color: '#1d4ed8', icon: '📋' },
  in_treatment:       { bg: '#fef3c7', color: '#b45309', icon: '💊' },
  recovering:         { bg: '#dcfce7', color: '#166534', icon: '🩹' },
  ready_to_discharge: { bg: '#ecfdf5', color: '#0ea5e9', icon: '✅' },
  discharged:         { bg: '#f1f5f9', color: '#64748b', icon: '👋' },
  icu:                { bg: '#fee2e2', color: '#991b1b', icon: '🚨' },
}
const ADMISSION_TYPES = ['surgery_recovery', 'overnight_observation', 'boarding', 'icu', 'post_treatment', 'quarantine'] as const

export default function InpatientManagement() {
  const { t } = useTranslation()
  const { formatDateTime, formatCurrency } = useSettings()
  const { speciesLabel } = useMasterData()

  const [hospitalId, setHospitalId] = useState('')
  const [hospitals, setHospitals] = useState<any[]>([])
  const [patients, setPatients] = useState<any[]>([])
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAdmit, setShowAdmit] = useState(false)
  const [showVitals, setShowVitals] = useState<any>(null)
  const [vitalsError, setVitalsError] = useState('')
  const [vitalsSubmitting, setVitalsSubmitting] = useState(false)
  const [showVitalsHistory, setShowVitalsHistory] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [admitAnimal, setAdmitAnimal] = useState<any>(null)
  const [viewHistory, setViewHistory] = useState<any>(null)
  const [medicalHistory, setMedicalHistory] = useState<any>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [admitForm, setAdmitForm] = useState({
    admissionType: 'overnight_observation', roomNumber: '', bedNumber: '',
    careInstructions: '', specialNeeds: '', estimatedDischarge: '', dailyRate: 0,
  })
  const [admitError, setAdmitError] = useState('')
  const [admitSubmitting, setAdmitSubmitting] = useState(false)
  const [vitalsForm, setVitalsForm] = useState({ temperature: '', heartRate: '', weight: '', notes: '' })

  useEffect(() => {
    (async () => {
      try {
        const list = await vetHospitalApi.listMyHospitals()
        setHospitals(list || [])
        if (list.length > 0) setHospitalId(list[0].id)
      } catch { /* empty */ }
    })()
  }, [])

  const loadData = useCallback(async () => {
    if (!hospitalId) return
    setLoading(true)
    try {
      const [p, d] = await Promise.all([
        apiService.listInpatients(hospitalId, statusFilter || undefined),
        apiService.getInpatientDashboard(hospitalId),
      ])
      setPatients(p.data || [])
      setDashboard(d.data || null)
    } catch { /* empty */ }
    setLoading(false)
  }, [hospitalId, statusFilter])

  useEffect(() => { loadData() }, [loadData])
  useAutoRefresh('inpatients', loadData)

  async function handleAdmit() {
    if (!hospitalId || !admitAnimal) return
    setAdmitError('')
    setAdmitSubmitting(true)
    try {
      await apiService.admitPatient(hospitalId, {
        ...admitForm,
        animalId: admitAnimal.id,
        ownerId: admitAnimal.owner_id,
      })
      setShowAdmit(false)
      setAdmitAnimal(null)
      setAdmitError('')
      setAdmitForm({ admissionType: 'overnight_observation', roomNumber: '', bedNumber: '', careInstructions: '', specialNeeds: '', estimatedDischarge: '', dailyRate: 0 })
      loadData()
    } catch (err: any) {
      setAdmitError(err?.response?.data?.error || err?.message || 'Failed to admit patient. Please try again.')
    }
    setAdmitSubmitting(false)
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await apiService.updateInpatientStatus(id, status)
      loadData()
    } catch { /* empty */ }
  }

  async function handleVitalsSubmit() {
    if (!showVitals) return
    setVitalsError('')
    // Validate: no negative values
    const temp = vitalsForm.temperature ? parseFloat(vitalsForm.temperature) : null
    const hr = vitalsForm.heartRate ? parseInt(vitalsForm.heartRate) : null
    const wt = vitalsForm.weight ? parseFloat(vitalsForm.weight) : null
    if ((temp !== null && temp <= 0) || (hr !== null && hr <= 0) || (wt !== null && wt <= 0)) {
      setVitalsError(t('inpatientManagement.vitalsErrorNegative'))
      return
    }
    setVitalsSubmitting(true)
    try {
      const data: Record<string, unknown> = { notes: vitalsForm.notes }
      if (temp !== null) data.temperature = temp
      if (hr !== null) data.heartRate = hr
      if (wt !== null) data.weight = wt
      await apiService.addVitalsLog(showVitals.id, data)
      setShowVitals(null)
      setVitalsForm({ temperature: '', heartRate: '', weight: '', notes: '' })
      loadData()
    } catch (err: any) {
      setVitalsError(err?.response?.data?.error || err?.message || 'Failed to save vitals. Please try again.')
    }
    setVitalsSubmitting(false)
  }

  async function loadMedicalHistory(patient: any) {
    if (!patient.animal_id) return
    setViewHistory(patient)
    setLoadingHistory(true)
    setMedicalHistory(null)
    try {
      const res = await apiService.getAnimalMedicalSummary(patient.animal_id)
      setMedicalHistory(res.data || null)
    } catch { /* empty */ }
    setLoadingHistory(false)
  }

  return (
    <div className="module-page si-5cec5e87">
      <div className="si-a307e2db">
        <div>
          <h1 className="si-1bc3a9fe">🛏️ {t('inpatientManagement.title')}</h1>
          <p className="si-d078dad1">{t('inpatientManagement.subtitle')}</p>
        </div>
        <div className="si-d223efb3">
          {hospitals.length > 1 && (
            <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} className="si-89cf1ca1">
              {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          )}
          <button onClick={() => setShowAdmit(true)} className="si-880bdf60">+ {t('inpatientManagement.admitPatient')}</button>
        </div>
      </div>

      {/* Dashboard Stats */}
      {dashboard && (
        <div className="si-60815cf3">
          {[
            { label: t('inpatientManagement.totalOccupied'), value: dashboard.total_occupied,    statusKey: null,                 icon: '🛏️', color: '#2563eb' },
            { label: t('inpatientManagement.admitted'),      value: dashboard.admitted,           statusKey: 'admitted' },
            { label: t('inpatientManagement.inTreatment'),   value: dashboard.in_treatment,       statusKey: 'in_treatment' },
            { label: t('inpatientManagement.recovering'),    value: dashboard.recovering,         statusKey: 'recovering' },
            { label: t('inpatientManagement.readyToDischarge'), value: dashboard.ready_to_discharge, statusKey: 'ready_to_discharge' },
            { label: t('inpatientManagement.icu'),           value: dashboard.icu_count,          statusKey: 'icu' },
            { label: t('inpatientManagement.dischargedToday'), value: dashboard.discharged_today, statusKey: 'discharged' },
          ].map((s, i) => {
            const sc = s.statusKey ? STATUS_COLORS[s.statusKey] : null
            const color = sc ? sc.color : (s.color || '#2563eb')
            const icon  = sc ? sc.icon  : (s.icon || '🛏️')
            const isActive = s.statusKey === null ? statusFilter === '' : statusFilter === s.statusKey
            return (
              <div key={i}
                onClick={() => {
                  if (s.statusKey === null) setStatusFilter('')
                  else setStatusFilter(prev => prev === s.statusKey ? '' : s.statusKey as string)
                }}
                style={{
                  background: isActive ? color : '#fff',
                  borderRadius: 10, padding: '14px 16px',
                  boxShadow: isActive ? `0 2px 8px ${color}44` : '0 1px 3px rgba(0,0,0,.08)',
                  borderLeft: `4px solid ${color}`,
                  cursor: 'pointer', transition: 'all 0.15s',
                  outline: isActive ? `2px solid ${color}` : 'none',
                  outlineOffset: 2,
                }}>
                <div style={{ fontSize: 12, color: isActive ? 'rgba(255,255,255,0.85)' : '#64748b' }}>{icon} {s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: isActive ? '#fff' : color }}>{s.value ?? 0}</div>
                {isActive && <div className="si-0442ac3c">🔍 Filtered</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* Status Filters */}
      <div className="si-c5224945">
        {['', 'admitted', 'in_treatment', 'recovering', 'ready_to_discharge', 'discharged'].map(s => {
          const sc = s ? STATUS_COLORS[s] : null
          const isActive = statusFilter === s
          return (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', fontWeight: 600,
              border: isActive && sc ? `2px solid ${sc.color}` : '2px solid transparent',
              background: isActive ? (sc ? sc.color : '#2563eb') : (sc ? sc.bg : '#e2e8f0'),
              color: isActive ? '#fff' : (sc ? sc.color : '#475569'),
            }}>
              {s === '' ? t('inpatientManagement.active') : `${sc?.icon || ''} ${s.replace(/_/g, ' ')}`}
            </button>
          )
        })}
      </div>

      {/* Patient Cards */}
      {loading ? (
        <div className="si-9fa8d292"><div className="spinner" /></div>
      ) : (
        <div className="si-ce7dfd54">
          {patients.length === 0 && <p className="si-2128b2c3">{t('inpatientManagement.noInpatients')}</p>}
          {patients.map(p => {
            const sc = STATUS_COLORS[p.status] || STATUS_COLORS.admitted
            const meds = parseJsonbArray(p.medications)
            const vitals = parseJsonbArray(p.vitals_log)
            const lastVitals = vitals.length > 0 ? vitals[vitals.length - 1] : null
            return (
              <div key={p.id} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.07)', borderTop: `3px solid ${sc.color}`, borderLeft: `4px solid ${sc.color}` }}>
                <div className="si-7a981126">
                  <div>
                    <div className="si-9dd702ba">{p.animal_name}</div>
                    <div className="si-4801fc30">{speciesLabel(p.animal_species, t)}{p.animal_breed ? ` — ${p.animal_breed}` : ''}{p.animal_weight ? ` • ${p.animal_weight}kg` : ''}</div>
                    <div className="si-db3602ae">{t('inpatientManagement.owner')}: {p.owner_first_name} {p.owner_last_name}{p.owner_phone ? ` • ${p.owner_phone}` : ''}</div>
                    {p.enterpriseName && (
                      <div className="si-e893254c">
                        🏢 {p.enterpriseName}{p.groupName ? ` › ${p.groupName}` : ''}
                      </div>
                    )}
                    {((p as any).referralId || (p as any).referral_id) && (
                      <div className="si-fd4f18cf">
                        🔄 Referred from Network
                      </div>
                    )}
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>{(p.status || '').replace(/_/g, ' ')}</span>
                </div>

                <div className="si-339f6726">
                  <div><strong>{t('inpatientManagement.type')}:</strong> {(p.admission_type || '').replace(/_/g, ' ')}</div>
                  {p.room_number && <div><strong>{t('inpatientManagement.room')}:</strong> {p.room_number}{p.bed_number ? ` / ${t('inpatientManagement.bed')} ${p.bed_number}` : ''}</div>}
                  <div><strong>{t('inpatientManagement.admittedAt')}:</strong> {formatDateTime(p.admitted_at)}</div>
                  {p.estimated_discharge && <div><strong>{t('inpatientManagement.estDischarge')}:</strong> {formatDateTime(p.estimated_discharge)}</div>}
                  {p.daily_rate > 0 && <div><strong>{t('inpatientManagement.dailyRate')}:</strong> {formatCurrency(p.daily_rate)}</div>}
                </div>

                {/* Last Vitals — clickable to open full history */}
                {lastVitals && (
                  <button
                    onClick={() => setShowVitalsHistory(p)}
                    className="si-b25056d0"
                  >
                    <strong>{t('inpatientManagement.lastVitals')}:</strong>{' '}
                    {lastVitals.temperature && `🌡️ ${lastVitals.temperature}°F`}{' '}
                    {lastVitals.heartRate && `❤️ ${lastVitals.heartRate}bpm`}{' '}
                    {lastVitals.weight && `⚖️ ${lastVitals.weight}kg`}
                    <span className="si-68f18f88">{lastVitals.timestamp && formatDateTime(lastVitals.timestamp)}</span>
                    <span className="si-49160324">📈 {t('inpatientManagement.viewVitalsHistory')} ({vitals.length})</span>
                  </button>
                )}

                {p.care_instructions && <div className="si-0c383e3b"><strong>{t('inpatientManagement.care')}:</strong> {p.care_instructions}</div>}
                {meds.length > 0 && <div className="si-0d8c3802">💊 {meds.length} {t('inpatientManagement.medications')}</div>}

                {/* Actions */}
                <div className="si-d2dd2367">
                  <button onClick={() => setShowVitals(p)} className="si-c49f76ab">📊 {t('inpatientManagement.vitals')}</button>
                  <button onClick={() => loadMedicalHistory(p)} className="si-99c426a3">📋 {t('inpatientManagement.history')}</button>
                  {p.status === 'admitted' && <button onClick={() => handleStatusChange(p.id, 'in_treatment')} className="si-816667d0">{t('inpatientManagement.startTreatment')}</button>}
                  {p.status === 'in_treatment' && <button onClick={() => handleStatusChange(p.id, 'recovering')} className="si-9b0031b9">{t('inpatientManagement.recovering')}</button>}
                  {p.status === 'recovering' && <button onClick={() => handleStatusChange(p.id, 'ready_to_discharge')} className="si-255a19db">{t('inpatientManagement.readyToDischarge')}</button>}
                  {(p.status === 'ready_to_discharge' || p.status === 'recovering') && <button onClick={() => handleStatusChange(p.id, 'discharged')} className="si-4f5ef47c">{t('inpatientManagement.discharge')}</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Admit Modal */}
      {showAdmit && (
        <div onClick={e => { if (e.target === e.currentTarget) { setShowAdmit(false); setAdmitAnimal(null); setAdmitError('') } }}
          className="si-96206cf2">
          <div className="si-0715f1d7">

            {/* Header */}
            <div className="si-fe2d5bfb">
              <h3 className="si-949cd24d">🛏️ {t('inpatientManagement.admitPatient')}</h3>
              <button onClick={() => { setShowAdmit(false); setAdmitAnimal(null); setAdmitError('') }}
                className="si-b1489b52">✕</button>
            </div>

            {/* API Error Banner */}
            {admitError && (
              <div className="si-86aee441">
                ⚠️ {admitError}
              </div>
            )}

            <div className="si-58f59f7a">

              {/* Animal Search — Required */}
              <div>
                <AnimalSearchPicker selectedAnimal={admitAnimal} onSelect={a => { setAdmitAnimal(a); setAdmitError('') }} label={`🔍 ${t('inpatientManagement.searchPatient')} *`} />
                {!admitAnimal && (
                  <div className="si-ca69dd8f">
                    <span>⚠️</span>
                    <span><strong>Required:</strong> Type an animal name or owner name and select a patient from the dropdown to enable submission.</span>
                  </div>
                )}
              </div>

              {/* Admission Type */}
              <div>
                <label className="si-1e22ae90">{t('inpatientManagement.admissionType')} <span className="si-f84f41a5">*</span></label>
                <div className="si-50c82988">
                  {ADMISSION_TYPES.map(at => (
                    <button key={at} onClick={() => setAdmitForm(f => ({ ...f, admissionType: at }))}
                      style={{ padding: '6px 12px', borderRadius: 8, border: admitForm.admissionType === at ? '2px solid #2563eb' : '1px solid #d1d5db', background: admitForm.admissionType === at ? '#eff6ff' : '#fff', color: admitForm.admissionType === at ? '#2563eb' : '#475569', cursor: 'pointer', fontSize: 12, fontWeight: admitForm.admissionType === at ? 700 : 400, textTransform: 'capitalize' }}>
                      {at.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Room & Bed */}
              <div className="si-347df862">
                <div>
                  <label className="si-2561596d">{t('inpatientManagement.roomNumber')}</label>
                  <input placeholder="e.g. R101" value={admitForm.roomNumber} onChange={e => setAdmitForm(f => ({ ...f, roomNumber: e.target.value }))} className="si-d0e0df59" />
                </div>
                <div>
                  <label className="si-2561596d">{t('inpatientManagement.bedNumber')}</label>
                  <input placeholder="e.g. B1" value={admitForm.bedNumber} onChange={e => setAdmitForm(f => ({ ...f, bedNumber: e.target.value }))} className="si-d0e0df59" />
                </div>
              </div>

              {/* Care Instructions */}
              <div>
                <label className="si-2561596d">{t('inpatientManagement.careInstructions')} <span className="si-17788c1c">(optional)</span></label>
                <textarea placeholder={t('inpatientManagement.careInstructionsPlaceholder')} value={admitForm.careInstructions} onChange={e => setAdmitForm(f => ({ ...f, careInstructions: e.target.value }))} rows={2} className="si-0523a7a3" />
              </div>

              {/* Special Needs */}
              <div>
                <label className="si-2561596d">{t('inpatientManagement.specialNeeds')} <span className="si-17788c1c">(optional)</span></label>
                <textarea placeholder={t('inpatientManagement.specialNeedsPlaceholder')} value={admitForm.specialNeeds} onChange={e => setAdmitForm(f => ({ ...f, specialNeeds: e.target.value }))} rows={2} className="si-0523a7a3" />
              </div>

              {/* Est. Discharge & Daily Rate */}
              <div className="si-347df862">
                <div>
                  <label className="si-2561596d">{t('inpatientManagement.estDischarge')} <span className="si-17788c1c">(optional)</span></label>
                  <input type="datetime-local" value={admitForm.estimatedDischarge} onChange={e => setAdmitForm(f => ({ ...f, estimatedDischarge: e.target.value }))} className="si-9bb25fd1" />
                </div>
                <div>
                  <label className="si-2561596d">{t('inpatientManagement.dailyRateLabel')} <span className="si-17788c1c">(optional)</span></label>
                  <input type="number" min="0" placeholder="0.00" value={admitForm.dailyRate || ''} onChange={e => setAdmitForm(f => ({ ...f, dailyRate: parseFloat(e.target.value) || 0 }))} className="si-d0e0df59" />
                </div>
              </div>

              {/* Required fields legend */}
              <div className="si-db3602ae">
                <span className="si-f84f41a5">*</span> Required field
              </div>

              {/* Action Buttons */}
              <div className="si-81c39146">
                <button onClick={() => { setShowAdmit(false); setAdmitAnimal(null); setAdmitError('') }}
                  className="si-52d0e896">
                  {t('inpatientManagement.cancel')}
                </button>
                <button onClick={handleAdmit} disabled={!admitAnimal || admitSubmitting}
                  title={!admitAnimal ? 'Select a patient from the search above to enable this button' : ''}
                  style={{ padding: '10px 20px', background: admitAnimal && !admitSubmitting ? '#2563eb' : '#94a3b8', color: '#fff', border: 'none', borderRadius: 8, cursor: admitAnimal && !admitSubmitting ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 14, minWidth: 140 }}>
                  {admitSubmitting ? '⏳ Admitting...' : `🛏️ ${t('inpatientManagement.admitPatient')}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vitals Modal */}
      {showVitals && (
        <div className="si-db8248e9" onClick={() => { setShowVitals(null); setVitalsError('') }}>
          <div className="si-922743e0" onClick={e => e.stopPropagation()}>
            <div className="si-101fd1d0">
              <h3 className="si-44087c4b">📊 {t('inpatientManagement.recordVitals')} — {showVitals.animal_name}</h3>
              <button onClick={() => { setShowVitals(null); setVitalsError('') }} className="si-5e3e3c2e">✕</button>
            </div>
            {vitalsError && (
              <div className="si-3646c5ee">⚠️ {vitalsError}</div>
            )}
            <div className="si-7a28b1a9">
              <div>
                <label className="si-2561596d">
                  🌡️ {t('inpatientManagement.temperatureLabel')}
                  <span className="si-899e716c">({t('inpatientManagement.normalTempHint')})</span>
                </label>
                <input
                  type="number" step="0.1" min="0" placeholder="e.g. 101.5"
                  value={vitalsForm.temperature}
                  onChange={e => setVitalsForm(f => ({ ...f, temperature: e.target.value }))}
                  className="si-d0e0df59"
                />
              </div>
              <div>
                <label className="si-2561596d">
                  ❤️ {t('inpatientManagement.heartRateLabel')}
                  <span className="si-899e716c">({t('inpatientManagement.normalHrHint')})</span>
                </label>
                <input
                  type="number" min="0" placeholder="e.g. 80"
                  value={vitalsForm.heartRate}
                  onChange={e => setVitalsForm(f => ({ ...f, heartRate: e.target.value }))}
                  className="si-d0e0df59"
                />
              </div>
              <div>
                <label className="si-2561596d">
                  ⚖️ {t('inpatientManagement.weightLabel')}
                  <span className="si-899e716c">({t('inpatientManagement.weightUnit')})</span>
                </label>
                <input
                  type="number" step="0.1" min="0" placeholder="e.g. 12.5"
                  value={vitalsForm.weight}
                  onChange={e => setVitalsForm(f => ({ ...f, weight: e.target.value }))}
                  className="si-d0e0df59"
                />
              </div>
              <div>
                <label className="si-2561596d">
                  📝 {t('inpatientManagement.notesLabel')}
                </label>
                <textarea
                  placeholder={t('inpatientManagement.notesPlaceholder')}
                  value={vitalsForm.notes}
                  onChange={e => setVitalsForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="si-0523a7a3"
                />
              </div>
              <div className="si-f0412db6">
                <button onClick={() => { setShowVitals(null); setVitalsError('') }} className="si-978a1643">{t('inpatientManagement.cancel')}</button>
                <button onClick={handleVitalsSubmit} disabled={vitalsSubmitting} style={{ padding: '8px 16px', background: vitalsSubmitting ? '#94a3b8' : '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, cursor: vitalsSubmitting ? 'not-allowed' : 'pointer', fontWeight: 600, minWidth: 120 }}>{vitalsSubmitting ? '⏳ Saving...' : t('inpatientManagement.saveVitals')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vitals History Modal */}
      {showVitalsHistory && (() => {
        const allVitals: any[] = parseJsonbArray(showVitalsHistory.vitals_log)
        return (
          <div className="si-db8248e9" onClick={() => setShowVitalsHistory(null)}>
            <div className="si-8352c1ac" onClick={e => e.stopPropagation()}>
              <div className="si-101fd1d0">
                <h3 className="si-44087c4b">📈 {t('inpatientManagement.vitalsHistory')} — {showVitalsHistory.animal_name}</h3>
                <button onClick={() => setShowVitalsHistory(null)} className="si-5e3e3c2e">✕</button>
              </div>
              {allVitals.length === 0 ? (
                <p className="si-82a22425">{t('inpatientManagement.noVitalsHistory')}</p>
              ) : (
                <div className="si-51b511c9">
                  {[...allVitals].reverse().map((v: any, i: number) => (
                    <div key={i} style={{ background: i === 0 ? '#f5f3ff' : '#f8fafc', borderRadius: 10, padding: '12px 16px', border: i === 0 ? '1px solid #ddd6fe' : '1px solid #e2e8f0' }}>
                      <div className="si-670106c2">
                        <span style={{ fontWeight: 700, fontSize: 13, color: i === 0 ? '#7c3aed' : '#374151' }}>
                          {i === 0 ? `✨ ${t('inpatientManagement.latest')}` : `#${allVitals.length - i}`}
                        </span>
                        <span className="si-db3602ae">{v.timestamp ? formatDateTime(v.timestamp) : ''}</span>
                      </div>
                      <div className="si-eccb2a53">
                        {v.temperature != null && (
                          <div className="si-4af84499">
                            <div className="si-49a99517">🌡️ {t('inpatientManagement.temperatureLabel')}</div>
                            <div className="si-7cf7733e">{v.temperature}°F</div>
                          </div>
                        )}
                        {v.heartRate != null && (
                          <div className="si-4af84499">
                            <div className="si-49a99517">❤️ {t('inpatientManagement.heartRateLabel')}</div>
                            <div className="si-7cf7733e">{v.heartRate} bpm</div>
                          </div>
                        )}
                        {v.weight != null && (
                          <div className="si-4af84499">
                            <div className="si-49a99517">⚖️ {t('inpatientManagement.weightLabel')}</div>
                            <div className="si-7cf7733e">{v.weight} kg</div>
                          </div>
                        )}
                      </div>
                      {v.notes && <div className="si-82c00a4d">📝 {v.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Medical History Modal */}
      {viewHistory && (
        <div className="si-db8248e9">
          <div className="si-84e7f0b2">
            <div className="si-101fd1d0">
              <h3 className="si-44087c4b">📋 {t('inpatientManagement.medicalHistory')} — {viewHistory.animal_name}</h3>
              <button onClick={() => { setViewHistory(null); setMedicalHistory(null) }} className="si-e23655e2">✕</button>
            </div>

            {loadingHistory && <div className="si-86638a30"><div className="spinner" /></div>}

            {medicalHistory && (
              <div className="si-58f59f7a">
                {/* Animal Info */}
                {medicalHistory.animal && (
                  <div className="si-1a4f5caf">
                    <div className="si-8b3478d6">🐾 {medicalHistory.animal.name}</div>
                    <div className="si-c3e04596">{speciesLabel(medicalHistory.animal.species, t)}{medicalHistory.animal.breed ? ` — ${medicalHistory.animal.breed}` : ''}{medicalHistory.animal.weight ? ` • ${medicalHistory.animal.weight}kg` : ''}{medicalHistory.animal.age_years ? ` • ${medicalHistory.animal.age_years}y` : ''}</div>
                    <div className="si-f199afd6">{t('inpatientManagement.owner')}: {medicalHistory.animal.owner_first_name} {medicalHistory.animal.owner_last_name}</div>
                  </div>
                )}

                {/* Allergies */}
                {medicalHistory.allergies?.length > 0 && (
                  <div>
                    <div className="si-17ce82b6">⚠️ {t('inpatientManagement.allergies')}</div>
                    <div className="si-50c82988">
                      {medicalHistory.allergies.map((a: any, i: number) => (
                        <span key={i} className="si-904f6bc9">
                          {a.allergen} {a.severity && `(${a.severity})`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Medical Records */}
                {medicalHistory.recentRecords?.length > 0 && (
                  <div>
                    <div className="si-04114015">🏥 {t('inpatientManagement.recentMedicalRecords')}</div>
                    {medicalHistory.recentRecords.slice(0, 5).map((r: any, i: number) => (
                      <div key={i} className="si-c6735535">
                        <div className="si-34ec0bf0">
                          <span className="si-b2cfcbec">{r.title || r.record_type?.replace(/_/g, ' ')}</span>
                          <span className="si-26b03e6b">{r.created_at ? formatDateTime(r.created_at) : ''}</span>
                        </div>
                        {r.severity && r.severity !== 'normal' && <div className="si-df68402c">Severity: {r.severity}</div>}
                        {r.content && <div className="si-734144ea">{r.content.substring(0, 120)}{r.content.length > 120 ? '...' : ''}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Prescriptions */}
                {medicalHistory.recentPrescriptions?.length > 0 && (
                  <div>
                    <div className="si-04114015">💊 {t('inpatientManagement.recentPrescriptions')}</div>
                    {medicalHistory.recentPrescriptions.slice(0, 5).map((rx: any, i: number) => {
                      const meds = parseJsonbArray(typeof rx.medications === 'string' ? rx.medications : JSON.stringify(rx.medications || []))
                      return (
                        <div key={i} className="si-e1bc71cf">
                          {meds.length > 0 ? meds.map((m: any, j: number) => (
                            <div key={j}><span className="si-7d5d38b3">{m.name || m.medication}</span>{m.dosage && <span className="si-98734f9a"> — {m.dosage}</span>}</div>
                          )) : <span className="si-7d5d38b3">{rx.instructions || 'Prescription'}</span>}
                          {rx.valid_until && <div className="si-96a4ece3">Valid until: {new Date(rx.valid_until).toLocaleDateString()}</div>}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Vaccinations */}
                {medicalHistory.recentVaccinations?.length > 0 && (
                  <div>
                    <div className="si-04114015">💉 {t('inpatientManagement.vaccinations')}</div>
                    <div className="si-50c82988">
                      {medicalHistory.recentVaccinations.map((v: any, i: number) => (
                        <span key={i} className="si-8ca4e418">
                          {v.vaccine_name} {v.date_administered ? `(${new Date(v.date_administered).toLocaleDateString()})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {!medicalHistory.recentRecords?.length && !medicalHistory.recentPrescriptions?.length && !medicalHistory.recentVaccinations?.length && !medicalHistory.allergies?.length && (
                  <p className="si-08d38003">{t('inpatientManagement.noMedicalHistory')}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
