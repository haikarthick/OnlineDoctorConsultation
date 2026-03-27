import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../context/SettingsContext'
import { vetHospitalApi } from '../services/api/vetHospitalApi'
import apiService from '../services/api'
import AnimalSearchPicker from '../components/AnimalSearchPicker'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  admitted: { bg: '#dbeafe', color: '#1d4ed8' },
  in_treatment: { bg: '#fef3c7', color: '#92400e' },
  recovering: { bg: '#dcfce7', color: '#166534' },
  ready_to_discharge: { bg: '#f0fdf4', color: '#15803d' },
  discharged: { bg: '#f1f5f9', color: '#64748b' },
  icu: { bg: '#fecaca', color: '#991b1b' },
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
  const [statusFilter, setStatusFilter] = useState('')
  const [admitAnimal, setAdmitAnimal] = useState<any>(null)
  const [viewHistory, setViewHistory] = useState<any>(null)
  const [medicalHistory, setMedicalHistory] = useState<any>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [admitForm, setAdmitForm] = useState({
    admissionType: 'overnight_observation', roomNumber: '', bedNumber: '',
    careInstructions: '', specialNeeds: '', estimatedDischarge: '', dailyRate: 0,
  })
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
    try {
      await apiService.admitPatient(hospitalId, {
        ...admitForm,
        animalId: admitAnimal.id,
        ownerId: admitAnimal.owner_id,
      })
      setShowAdmit(false)
      setAdmitAnimal(null)
      setAdmitForm({ admissionType: 'overnight_observation', roomNumber: '', bedNumber: '', careInstructions: '', specialNeeds: '', estimatedDischarge: '', dailyRate: 0 })
      loadData()
    } catch { /* empty */ }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await apiService.updateInpatientStatus(id, status)
      loadData()
    } catch { /* empty */ }
  }

  async function handleVitalsSubmit() {
    if (!showVitals) return
    try {
      const data: Record<string, unknown> = { notes: vitalsForm.notes }
      if (vitalsForm.temperature) data.temperature = parseFloat(vitalsForm.temperature)
      if (vitalsForm.heartRate) data.heartRate = parseInt(vitalsForm.heartRate)
      if (vitalsForm.weight) data.weight = parseFloat(vitalsForm.weight)
      await apiService.addVitalsLog(showVitals.id, data)
      setShowVitals(null)
      setVitalsForm({ temperature: '', heartRate: '', weight: '', notes: '' })
      loadData()
    } catch { /* empty */ }
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
            { label: t('inpatientManagement.totalOccupied'), value: dashboard.total_occupied, color: '#2563eb', icon: '🛏️' },
            { label: t('inpatientManagement.admitted'), value: dashboard.admitted, color: '#f59e0b', icon: '📋' },
            { label: t('inpatientManagement.inTreatment'), value: dashboard.in_treatment, color: '#dc2626', icon: '💊' },
            { label: t('inpatientManagement.recovering'), value: dashboard.recovering, color: '#059669', icon: '🩹' },
            { label: t('inpatientManagement.readyToDischarge'), value: dashboard.ready_to_discharge, color: '#0ea5e9', icon: '✅' },
            { label: t('inpatientManagement.icu'), value: dashboard.icu_count, color: '#991b1b', icon: '🚨' },
            { label: t('inpatientManagement.dischargedToday'), value: dashboard.discharged_today, color: '#64748b', icon: '👋' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', borderLeft: `4px solid ${s.color}` }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>{s.icon} {s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value ?? 0}</div>
            </div>
          ))}
        </div>
      )}

      {/* Status Filters */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {['', 'admitted', 'in_treatment', 'recovering', 'ready_to_discharge', 'discharged'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', background: statusFilter === s ? '#2563eb' : '#e2e8f0', color: statusFilter === s ? '#fff' : '#475569', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
            {s === '' ? t('inpatientManagement.active') : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Patient Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {patients.length === 0 && <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#94a3b8', padding: 40 }}>{t('inpatientManagement.noInpatients')}</p>}
          {patients.map(p => {
            const sc = STATUS_COLORS[p.status] || STATUS_COLORS.admitted
            const meds = (() => { try { return JSON.parse(p.medications || '[]') } catch { return [] } })()
            const vitals = (() => { try { return JSON.parse(p.vitals_log || '[]') } catch { return [] } })()
            const lastVitals = vitals.length > 0 ? vitals[vitals.length - 1] : null
            return (
              <div key={p.id} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.07)', borderTop: `3px solid ${sc.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{p.animal_name}</div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>{p.animal_species}{p.animal_breed ? ` — ${p.animal_breed}` : ''}{p.animal_weight ? ` • ${p.animal_weight}kg` : ''}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('inpatientManagement.owner')}: {p.owner_first_name} {p.owner_last_name}{p.owner_phone ? ` • ${p.owner_phone}` : ''}</div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>{p.status.replace(/_/g, ' ')}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13, marginBottom: 10 }}>
                  <div><strong>{t('inpatientManagement.type')}:</strong> {p.admission_type.replace(/_/g, ' ')}</div>
                  {p.room_number && <div><strong>{t('inpatientManagement.room')}:</strong> {p.room_number}{p.bed_number ? ` / ${t('inpatientManagement.bed')} ${p.bed_number}` : ''}</div>}
                  <div><strong>{t('inpatientManagement.admittedAt')}:</strong> {formatDateTime(p.admitted_at)}</div>
                  {p.estimated_discharge && <div><strong>{t('inpatientManagement.estDischarge')}:</strong> {formatDateTime(p.estimated_discharge)}</div>}
                  {p.daily_rate > 0 && <div><strong>{t('inpatientManagement.dailyRate')}:</strong> {formatCurrency(p.daily_rate)}</div>}
                </div>

                {/* Last Vitals */}
                {lastVitals && (
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px', marginBottom: 10, fontSize: 12 }}>
                    <strong>{t('inpatientManagement.lastVitals')}:</strong> {lastVitals.temperature && `🌡️ ${lastVitals.temperature}°F`} {lastVitals.heartRate && `❤️ ${lastVitals.heartRate}bpm`} {lastVitals.weight && `⚖️ ${lastVitals.weight}kg`}
                    <span style={{ color: '#94a3b8', marginLeft: 8 }}>{lastVitals.timestamp && formatDateTime(lastVitals.timestamp)}</span>
                  </div>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 520, maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>🛏️ {t('inpatientManagement.admitPatient')}</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Animal Search */}
              <AnimalSearchPicker selectedAnimal={admitAnimal} onSelect={setAdmitAnimal} label="🔍 Search Patient to Admit" />

              {/* Admission Type */}
              <div>
                <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('inpatientManagement.admissionType')}</label>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('inpatientManagement.roomNumber')}</label>
                  <input placeholder="e.g. R101" value={admitForm.roomNumber} onChange={e => setAdmitForm(f => ({ ...f, roomNumber: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('inpatientManagement.bedNumber')}</label>
                  <input placeholder="e.g. B1" value={admitForm.bedNumber} onChange={e => setAdmitForm(f => ({ ...f, bedNumber: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* Care Instructions */}
              <div>
                <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('inpatientManagement.careInstructions')}</label>
                <textarea placeholder={t('inpatientManagement.careInstructionsPlaceholder')} value={admitForm.careInstructions} onChange={e => setAdmitForm(f => ({ ...f, careInstructions: e.target.value }))} rows={2} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              {/* Special Needs */}
              <div>
                <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('inpatientManagement.specialNeeds')}</label>
                <textarea placeholder={t('inpatientManagement.specialNeedsPlaceholder')} value={admitForm.specialNeeds} onChange={e => setAdmitForm(f => ({ ...f, specialNeeds: e.target.value }))} rows={2} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              {/* Discharge & Rate */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('inpatientManagement.estDischarge')}</label>
                  <input type="datetime-local" value={admitForm.estimatedDischarge} onChange={e => setAdmitForm(f => ({ ...f, estimatedDischarge: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{t('inpatientManagement.dailyRateLabel')}</label>
                  <input type="number" placeholder="0.00" value={admitForm.dailyRate || ''} onChange={e => setAdmitForm(f => ({ ...f, dailyRate: parseFloat(e.target.value) || 0 }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => { setShowAdmit(false); setAdmitAnimal(null) }} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>{t('inpatientManagement.cancel')}</button>
                <button onClick={handleAdmit} disabled={!admitAnimal}
                  style={{ padding: '8px 16px', background: admitAnimal ? '#2563eb' : '#94a3b8', color: '#fff', border: 'none', borderRadius: 8, cursor: admitAnimal ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
                  {t('inpatientManagement.admitPatient')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vitals Modal */}
      {showVitals && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, maxWidth: '90vw' }}>
            <h3 style={{ marginTop: 0 }}>{t('inpatientManagement.recordVitals')} — {showVitals.animal_name}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="number" step="0.1" placeholder={t('inpatientManagement.temperaturePlaceholder')} value={vitalsForm.temperature} onChange={e => setVitalsForm(f => ({ ...f, temperature: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }} />
              <input type="number" placeholder={t('inpatientManagement.heartRatePlaceholder')} value={vitalsForm.heartRate} onChange={e => setVitalsForm(f => ({ ...f, heartRate: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }} />
              <input type="number" step="0.1" placeholder={t('inpatientManagement.weightPlaceholder')} value={vitalsForm.weight} onChange={e => setVitalsForm(f => ({ ...f, weight: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }} />
              <textarea placeholder={t('inpatientManagement.notesPlaceholder')} value={vitalsForm.notes} onChange={e => setVitalsForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowVitals(null)} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>{t('inpatientManagement.cancel')}</button>
                <button onClick={handleVitalsSubmit} style={{ padding: '8px 16px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>{t('inpatientManagement.saveVitals')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                {medicalHistory.records?.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>🏥 {t('inpatientManagement.recentMedicalRecords')}</div>
                    {medicalHistory.records.slice(0, 5).map((r: any, i: number) => (
                      <div key={i} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px', marginBottom: 6, fontSize: 13 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600 }}>{r.record_type?.replace(/_/g, ' ')}</span>
                          <span style={{ color: '#94a3b8', fontSize: 11 }}>{r.visit_date ? formatDateTime(r.visit_date) : ''}</span>
                        </div>
                        {r.diagnosis && <div style={{ color: '#475569', marginTop: 2 }}>Dx: {r.diagnosis}</div>}
                        {r.treatment && <div style={{ color: '#059669', marginTop: 1 }}>Tx: {r.treatment}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Prescriptions */}
                {medicalHistory.prescriptions?.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>💊 {t('inpatientManagement.recentPrescriptions')}</div>
                    {medicalHistory.prescriptions.slice(0, 5).map((rx: any, i: number) => (
                      <div key={i} style={{ background: '#faf5ff', borderRadius: 8, padding: '8px 12px', marginBottom: 6, fontSize: 13 }}>
                        <span style={{ fontWeight: 600, color: '#7c3aed' }}>{rx.medication_name}</span>
                        {rx.dosage && <span style={{ color: '#64748b' }}> — {rx.dosage}</span>}
                        {rx.status && <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 6px', borderRadius: 8, background: rx.status === 'active' ? '#dcfce7' : '#f1f5f9', color: rx.status === 'active' ? '#166534' : '#64748b' }}>{rx.status}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Vaccinations */}
                {medicalHistory.vaccinations?.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>💉 {t('inpatientManagement.vaccinations')}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {medicalHistory.vaccinations.map((v: any, i: number) => (
                        <span key={i} style={{ background: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, border: '1px solid #a7f3d0' }}>
                          {v.vaccine_name} {v.vaccination_date ? `(${new Date(v.vaccination_date).toLocaleDateString()})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {!medicalHistory.records?.length && !medicalHistory.prescriptions?.length && !medicalHistory.vaccinations?.length && !medicalHistory.allergies?.length && (
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
