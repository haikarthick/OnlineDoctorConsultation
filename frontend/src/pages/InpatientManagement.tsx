import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../context/SettingsContext'
import { vetHospitalApi } from '../services/api/vetHospitalApi'
import apiService from '../services/api'
import AnimalSearchPicker from '../components/AnimalSearchPicker'

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
    <div className="module-page" style={{ minHeight: 'calc(100vh - 64px)', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>🛏️ {t('inpatientManagement.title')}</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>{t('inpatientManagement.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hospitals.length > 1 && (
            <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}>
              {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          )}
          <button onClick={() => setShowAdmit(true)} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>+ {t('inpatientManagement.admitPatient')}</button>
        </div>
      </div>

      {/* Dashboard Stats */}
      {dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
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
                {isActive && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>🔍 Filtered</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* Status Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
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
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {patients.length === 0 && <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#94a3b8', padding: 40 }}>{t('inpatientManagement.noInpatients')}</p>}
          {patients.map(p => {
            const sc = STATUS_COLORS[p.status] || STATUS_COLORS.admitted
            const meds = parseJsonbArray(p.medications)
            const vitals = parseJsonbArray(p.vitals_log)
            const lastVitals = vitals.length > 0 ? vitals[vitals.length - 1] : null
            return (
              <div key={p.id} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.07)', borderTop: `3px solid ${sc.color}`, borderLeft: `4px solid ${sc.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{p.animal_name}</div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>{p.animal_species}{p.animal_breed ? ` — ${p.animal_breed}` : ''}{p.animal_weight ? ` • ${p.animal_weight}kg` : ''}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('inpatientManagement.owner')}: {p.owner_first_name} {p.owner_last_name}{p.owner_phone ? ` • ${p.owner_phone}` : ''}</div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>{(p.status || '').replace(/_/g, ' ')}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13, marginBottom: 10 }}>
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
                    style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px', marginBottom: 10, fontSize: 12, border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                  >
                    <strong>{t('inpatientManagement.lastVitals')}:</strong>{' '}
                    {lastVitals.temperature && `🌡️ ${lastVitals.temperature}°F`}{' '}
                    {lastVitals.heartRate && `❤️ ${lastVitals.heartRate}bpm`}{' '}
                    {lastVitals.weight && `⚖️ ${lastVitals.weight}kg`}
                    <span style={{ color: '#94a3b8', marginLeft: 8 }}>{lastVitals.timestamp && formatDateTime(lastVitals.timestamp)}</span>
                    <span style={{ float: 'right', color: '#8b5cf6', fontWeight: 600, fontSize: 11 }}>📈 {t('inpatientManagement.viewVitalsHistory')} ({vitals.length})</span>
                  </button>
                )}

                {p.care_instructions && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}><strong>{t('inpatientManagement.care')}:</strong> {p.care_instructions}</div>}
                {meds.length > 0 && <div style={{ fontSize: 12, color: '#8b5cf6', marginBottom: 8 }}>💊 {meds.length} {t('inpatientManagement.medications')}</div>}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                  <button onClick={() => setShowVitals(p)} style={{ padding: '6px 10px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>📊 {t('inpatientManagement.vitals')}</button>
                  <button onClick={() => loadMedicalHistory(p)} style={{ padding: '6px 10px', background: '#0891b2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>📋 {t('inpatientManagement.history')}</button>
                  {p.status === 'admitted' && <button onClick={() => handleStatusChange(p.id, 'in_treatment')} style={{ padding: '6px 10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{t('inpatientManagement.startTreatment')}</button>}
                  {p.status === 'in_treatment' && <button onClick={() => handleStatusChange(p.id, 'recovering')} style={{ padding: '6px 10px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{t('inpatientManagement.recovering')}</button>}
                  {p.status === 'recovering' && <button onClick={() => handleStatusChange(p.id, 'ready_to_discharge')} style={{ padding: '6px 10px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{t('inpatientManagement.readyToDischarge')}</button>}
                  {(p.status === 'ready_to_discharge' || p.status === 'recovering') && <button onClick={() => handleStatusChange(p.id, 'discharged')} style={{ padding: '6px 10px', background: '#64748b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>{t('inpatientManagement.discharge')}</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Admit Modal */}
      {showAdmit && (
        <div onClick={e => { if (e.target === e.currentTarget) { setShowAdmit(false); setAdmitAnimal(null); setAdmitError('') } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 520, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🛏️ {t('inpatientManagement.admitPatient')}</h3>
              <button onClick={() => { setShowAdmit(false); setAdmitAnimal(null); setAdmitError('') }}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b', lineHeight: 1 }}>✕</button>
            </div>

            {/* API Error Banner */}
            {admitError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, fontWeight: 500 }}>
                ⚠️ {admitError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Animal Search — Required */}
              <div>
                <AnimalSearchPicker selectedAnimal={admitAnimal} onSelect={a => { setAdmitAnimal(a); setAdmitError('') }} label={`🔍 ${t('inpatientManagement.searchPatient')} *`} />
                {!admitAnimal && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#b45309', background: '#fef3c7', borderRadius: 6, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>⚠️</span>
                    <span><strong>Required:</strong> Type an animal name or owner name and select a patient from the dropdown to enable submission.</span>
                  </div>
                )}
              </div>

              {/* Admission Type */}
              <div>
                <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 6, display: 'block' }}>{t('inpatientManagement.admissionType')} <span style={{ color: '#dc2626' }}>*</span></label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ADMISSION_TYPES.map(at => (
                    <button key={at} onClick={() => setAdmitForm(f => ({ ...f, admissionType: at }))}
                      style={{ padding: '6px 12px', borderRadius: 8, border: admitForm.admissionType === at ? '2px solid #2563eb' : '1px solid #d1d5db', background: admitForm.admissionType === at ? '#eff6ff' : '#fff', color: admitForm.admissionType === at ? '#2563eb' : '#475569', cursor: 'pointer', fontSize: 12, fontWeight: admitForm.admissionType === at ? 700 : 400, textTransform: 'capitalize' }}>
                      {at.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Room & Bed */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('inpatientManagement.roomNumber')}</label>
                  <input placeholder="e.g. R101" value={admitForm.roomNumber} onChange={e => setAdmitForm(f => ({ ...f, roomNumber: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('inpatientManagement.bedNumber')}</label>
                  <input placeholder="e.g. B1" value={admitForm.bedNumber} onChange={e => setAdmitForm(f => ({ ...f, bedNumber: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: 14 }} />
                </div>
              </div>

              {/* Care Instructions */}
              <div>
                <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('inpatientManagement.careInstructions')} <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                <textarea placeholder={t('inpatientManagement.careInstructionsPlaceholder')} value={admitForm.careInstructions} onChange={e => setAdmitForm(f => ({ ...f, careInstructions: e.target.value }))} rows={2} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical', boxSizing: 'border-box', fontSize: 14 }} />
              </div>

              {/* Special Needs */}
              <div>
                <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('inpatientManagement.specialNeeds')} <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                <textarea placeholder={t('inpatientManagement.specialNeedsPlaceholder')} value={admitForm.specialNeeds} onChange={e => setAdmitForm(f => ({ ...f, specialNeeds: e.target.value }))} rows={2} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical', boxSizing: 'border-box', fontSize: 14 }} />
              </div>

              {/* Est. Discharge & Daily Rate */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('inpatientManagement.estDischarge')} <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                  <input type="datetime-local" value={admitForm.estimatedDischarge} onChange={e => setAdmitForm(f => ({ ...f, estimatedDischarge: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('inpatientManagement.dailyRateLabel')} <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                  <input type="number" min="0" placeholder="0.00" value={admitForm.dailyRate || ''} onChange={e => setAdmitForm(f => ({ ...f, dailyRate: parseFloat(e.target.value) || 0 }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: 14 }} />
                </div>
              </div>

              {/* Required fields legend */}
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                <span style={{ color: '#dc2626' }}>*</span> Required field
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid #f1f5f9' }}>
                <button onClick={() => { setShowAdmit(false); setAdmitAnimal(null); setAdmitError('') }}
                  style={{ padding: '10px 20px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }} onClick={() => { setShowVitals(null); setVitalsError('') }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>📊 {t('inpatientManagement.recordVitals')} — {showVitals.animal_name}</h3>
              <button onClick={() => { setShowVitals(null); setVitalsError('') }} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            {vitalsError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginBottom: 12, color: '#dc2626', fontSize: 13 }}>⚠️ {vitalsError}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', display: 'block', marginBottom: 4 }}>
                  🌡️ {t('inpatientManagement.temperatureLabel')}
                  <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6, fontSize: 12 }}>({t('inpatientManagement.normalTempHint')})</span>
                </label>
                <input
                  type="number" step="0.1" min="0" placeholder="e.g. 101.5"
                  value={vitalsForm.temperature}
                  onChange={e => setVitalsForm(f => ({ ...f, temperature: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', display: 'block', marginBottom: 4 }}>
                  ❤️ {t('inpatientManagement.heartRateLabel')}
                  <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6, fontSize: 12 }}>({t('inpatientManagement.normalHrHint')})</span>
                </label>
                <input
                  type="number" min="0" placeholder="e.g. 80"
                  value={vitalsForm.heartRate}
                  onChange={e => setVitalsForm(f => ({ ...f, heartRate: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', display: 'block', marginBottom: 4 }}>
                  ⚖️ {t('inpatientManagement.weightLabel')}
                  <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6, fontSize: 12 }}>({t('inpatientManagement.weightUnit')})</span>
                </label>
                <input
                  type="number" step="0.1" min="0" placeholder="e.g. 12.5"
                  value={vitalsForm.weight}
                  onChange={e => setVitalsForm(f => ({ ...f, weight: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', display: 'block', marginBottom: 4 }}>
                  📝 {t('inpatientManagement.notesLabel')}
                </label>
                <textarea
                  placeholder={t('inpatientManagement.notesPlaceholder')}
                  value={vitalsForm.notes}
                  onChange={e => setVitalsForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical', boxSizing: 'border-box', fontSize: 14 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowVitals(null); setVitalsError('') }} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>{t('inpatientManagement.cancel')}</button>
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
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }} onClick={() => setShowVitalsHistory(null)}>
            <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 520, maxWidth: '95vw', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>📈 {t('inpatientManagement.vitalsHistory')} — {showVitalsHistory.animal_name}</h3>
                <button onClick={() => setShowVitalsHistory(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
              {allVitals.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94a3b8', padding: 30 }}>{t('inpatientManagement.noVitalsHistory')}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...allVitals].reverse().map((v: any, i: number) => (
                    <div key={i} style={{ background: i === 0 ? '#f5f3ff' : '#f8fafc', borderRadius: 10, padding: '12px 16px', border: i === 0 ? '1px solid #ddd6fe' : '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: i === 0 ? '#7c3aed' : '#374151' }}>
                          {i === 0 ? `✨ ${t('inpatientManagement.latest')}` : `#${allVitals.length - i}`}
                        </span>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{v.timestamp ? formatDateTime(v.timestamp) : ''}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 13 }}>
                        {v.temperature != null && (
                          <div style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>🌡️ {t('inpatientManagement.temperatureLabel')}</div>
                            <div style={{ fontWeight: 700, color: '#374151' }}>{v.temperature}°F</div>
                          </div>
                        )}
                        {v.heartRate != null && (
                          <div style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>❤️ {t('inpatientManagement.heartRateLabel')}</div>
                            <div style={{ fontWeight: 700, color: '#374151' }}>{v.heartRate} bpm</div>
                          </div>
                        )}
                        {v.weight != null && (
                          <div style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>⚖️ {t('inpatientManagement.weightLabel')}</div>
                            <div style={{ fontWeight: 700, color: '#374151' }}>{v.weight} kg</div>
                          </div>
                        )}
                      </div>
                      {v.notes && <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>📝 {v.notes}</div>}
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 560, maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>📋 {t('inpatientManagement.medicalHistory')} — {viewHistory.animal_name}</h3>
              <button onClick={() => { setViewHistory(null); setMedicalHistory(null) }} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>

            {loadingHistory && <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>}

            {medicalHistory && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Animal Info */}
                {medicalHistory.animal && (
                  <div style={{ background: '#f0f9ff', borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#0c4a6e' }}>🐾 {medicalHistory.animal.name}</div>
                    <div style={{ fontSize: 13, color: '#0369a1' }}>{medicalHistory.animal.species}{medicalHistory.animal.breed ? ` — ${medicalHistory.animal.breed}` : ''}{medicalHistory.animal.weight ? ` • ${medicalHistory.animal.weight}kg` : ''}{medicalHistory.animal.age_years ? ` • ${medicalHistory.animal.age_years}y` : ''}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{t('inpatientManagement.owner')}: {medicalHistory.animal.owner_first_name} {medicalHistory.animal.owner_last_name}</div>
                  </div>
                )}

                {/* Allergies */}
                {medicalHistory.allergies?.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, color: '#dc2626' }}>⚠️ {t('inpatientManagement.allergies')}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {medicalHistory.allergies.map((a: any, i: number) => (
                        <span key={i} style={{ background: '#fef2f2', color: '#dc2626', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, border: '1px solid #fecaca' }}>
                          {a.allergen} {a.severity && `(${a.severity})`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Medical Records */}
                {medicalHistory.recentRecords?.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>🏥 {t('inpatientManagement.recentMedicalRecords')}</div>
                    {medicalHistory.recentRecords.slice(0, 5).map((r: any, i: number) => (
                      <div key={i} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px', marginBottom: 6, fontSize: 13 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600 }}>{r.title || r.record_type?.replace(/_/g, ' ')}</span>
                          <span style={{ color: '#94a3b8', fontSize: 11 }}>{r.created_at ? formatDateTime(r.created_at) : ''}</span>
                        </div>
                        {r.severity && r.severity !== 'normal' && <div style={{ color: '#475569', marginTop: 2 }}>Severity: {r.severity}</div>}
                        {r.content && <div style={{ color: '#059669', marginTop: 1, whiteSpace: 'pre-line' }}>{r.content.substring(0, 120)}{r.content.length > 120 ? '...' : ''}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Prescriptions */}
                {medicalHistory.recentPrescriptions?.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>💊 {t('inpatientManagement.recentPrescriptions')}</div>
                    {medicalHistory.recentPrescriptions.slice(0, 5).map((rx: any, i: number) => {
                      const meds = parseJsonbArray(typeof rx.medications === 'string' ? rx.medications : JSON.stringify(rx.medications || []))
                      return (
                        <div key={i} style={{ background: '#faf5ff', borderRadius: 8, padding: '8px 12px', marginBottom: 6, fontSize: 13 }}>
                          {meds.length > 0 ? meds.map((m: any, j: number) => (
                            <div key={j}><span style={{ fontWeight: 600, color: '#7c3aed' }}>{m.name || m.medication}</span>{m.dosage && <span style={{ color: '#64748b' }}> — {m.dosage}</span>}</div>
                          )) : <span style={{ fontWeight: 600, color: '#7c3aed' }}>{rx.instructions || 'Prescription'}</span>}
                          {rx.valid_until && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Valid until: {new Date(rx.valid_until).toLocaleDateString()}</div>}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Vaccinations */}
                {medicalHistory.recentVaccinations?.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>💉 {t('inpatientManagement.vaccinations')}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {medicalHistory.recentVaccinations.map((v: any, i: number) => (
                        <span key={i} style={{ background: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, border: '1px solid #a7f3d0' }}>
                          {v.vaccine_name} {v.date_administered ? `(${new Date(v.date_administered).toLocaleDateString()})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {!medicalHistory.recentRecords?.length && !medicalHistory.recentPrescriptions?.length && !medicalHistory.recentVaccinations?.length && !medicalHistory.allergies?.length && (
                  <p style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>{t('inpatientManagement.noMedicalHistory')}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
