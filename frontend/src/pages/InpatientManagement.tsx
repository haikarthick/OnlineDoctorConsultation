import { useState, useEffect, useCallback } from 'react'
import { useSettings } from '../context/SettingsContext'
import { vetHospitalApi } from '../services/api/vetHospitalApi'
import apiService from '../services/api'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  admitted: { bg: '#dbeafe', color: '#1d4ed8' },
  in_treatment: { bg: '#fef3c7', color: '#92400e' },
  recovering: { bg: '#dcfce7', color: '#166534' },
  ready_to_discharge: { bg: '#f0fdf4', color: '#15803d' },
  discharged: { bg: '#f1f5f9', color: '#64748b' },
  icu: { bg: '#fecaca', color: '#991b1b' },
}
const ADMISSION_TYPES = ['general', 'surgery_recovery', 'icu', 'boarding', 'observation', 'quarantine'] as const

export default function InpatientManagement() {
  const { formatDateTime, formatCurrency } = useSettings()

  const [hospitalId, setHospitalId] = useState('')
  const [hospitals, setHospitals] = useState<any[]>([])
  const [patients, setPatients] = useState<any[]>([])
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAdmit, setShowAdmit] = useState(false)
  const [showVitals, setShowVitals] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState('')

  const [admitForm, setAdmitForm] = useState({
    animalId: '', ownerId: '', admissionType: 'general', roomNumber: '', bedNumber: '',
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
    if (!hospitalId) return
    try {
      await apiService.admitPatient(hospitalId, admitForm)
      setShowAdmit(false)
      setAdmitForm({ animalId: '', ownerId: '', admissionType: 'general', roomNumber: '', bedNumber: '', careInstructions: '', specialNeeds: '', estimatedDischarge: '', dailyRate: 0 })
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

  return (
    <div className="module-page" style={{ minHeight: 'calc(100vh - 64px)', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>🛏️ Inpatient & Boarding</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Manage admitted patients, ICU, surgery recovery, and boarding</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hospitals.length > 1 && (
            <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}>
              {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          )}
          <button onClick={() => setShowAdmit(true)} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>+ Admit Patient</button>
        </div>
      </div>

      {/* Dashboard Stats */}
      {dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Occupied', value: dashboard.total_occupied, color: '#2563eb', icon: '🛏️' },
            { label: 'Admitted', value: dashboard.admitted, color: '#f59e0b', icon: '📋' },
            { label: 'In Treatment', value: dashboard.in_treatment, color: '#dc2626', icon: '💊' },
            { label: 'Recovering', value: dashboard.recovering, color: '#059669', icon: '🩹' },
            { label: 'Ready to Discharge', value: dashboard.ready_to_discharge, color: '#0ea5e9', icon: '✅' },
            { label: 'ICU', value: dashboard.icu_count, color: '#991b1b', icon: '🚨' },
            { label: 'Discharged Today', value: dashboard.discharged_today, color: '#64748b', icon: '👋' },
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
            {s === '' ? 'Active' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Patient Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {patients.length === 0 && <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#94a3b8', padding: 40 }}>No inpatients found</p>}
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
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Owner: {p.owner_first_name} {p.owner_last_name}{p.owner_phone ? ` • ${p.owner_phone}` : ''}</div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>{p.status.replace(/_/g, ' ')}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13, marginBottom: 10 }}>
                  <div><strong>Type:</strong> {p.admission_type.replace(/_/g, ' ')}</div>
                  {p.room_number && <div><strong>Room:</strong> {p.room_number}{p.bed_number ? ` / Bed ${p.bed_number}` : ''}</div>}
                  <div><strong>Admitted:</strong> {formatDateTime(p.admitted_at)}</div>
                  {p.estimated_discharge && <div><strong>Est. Discharge:</strong> {formatDateTime(p.estimated_discharge)}</div>}
                  {p.daily_rate > 0 && <div><strong>Daily Rate:</strong> {formatCurrency(p.daily_rate)}</div>}
                </div>

                {/* Last Vitals */}
                {lastVitals && (
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px', marginBottom: 10, fontSize: 12 }}>
                    <strong>Last Vitals:</strong> {lastVitals.temperature && `🌡️ ${lastVitals.temperature}°F`} {lastVitals.heartRate && `❤️ ${lastVitals.heartRate}bpm`} {lastVitals.weight && `⚖️ ${lastVitals.weight}kg`}
                    <span style={{ color: '#94a3b8', marginLeft: 8 }}>{lastVitals.timestamp && formatDateTime(lastVitals.timestamp)}</span>
                  </div>
                )}

                {p.care_instructions && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}><strong>Care:</strong> {p.care_instructions}</div>}
                {meds.length > 0 && <div style={{ fontSize: 12, color: '#8b5cf6', marginBottom: 8 }}>💊 {meds.length} medication(s)</div>}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                  <button onClick={() => setShowVitals(p)} style={{ padding: '6px 10px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>📊 Vitals</button>
                  {p.status === 'admitted' && <button onClick={() => handleStatusChange(p.id, 'in_treatment')} style={{ padding: '6px 10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Start Treatment</button>}
                  {p.status === 'in_treatment' && <button onClick={() => handleStatusChange(p.id, 'recovering')} style={{ padding: '6px 10px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Recovering</button>}
                  {p.status === 'recovering' && <button onClick={() => handleStatusChange(p.id, 'ready_to_discharge')} style={{ padding: '6px 10px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Ready to Discharge</button>}
                  {(p.status === 'ready_to_discharge' || p.status === 'recovering') && <button onClick={() => handleStatusChange(p.id, 'discharged')} style={{ padding: '6px 10px', background: '#64748b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Discharge</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Admit Modal */}
      {showAdmit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 500, maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>Admit Patient</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <select value={admitForm.admissionType} onChange={e => setAdmitForm(f => ({ ...f, admissionType: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}>
                {ADMISSION_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input placeholder="Room Number" value={admitForm.roomNumber} onChange={e => setAdmitForm(f => ({ ...f, roomNumber: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }} />
                <input placeholder="Bed Number" value={admitForm.bedNumber} onChange={e => setAdmitForm(f => ({ ...f, bedNumber: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }} />
              </div>
              <textarea placeholder="Care instructions..." value={admitForm.careInstructions} onChange={e => setAdmitForm(f => ({ ...f, careInstructions: e.target.value }))} rows={2} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical' }} />
              <textarea placeholder="Special needs..." value={admitForm.specialNeeds} onChange={e => setAdmitForm(f => ({ ...f, specialNeeds: e.target.value }))} rows={2} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input type="datetime-local" placeholder="Est. Discharge" value={admitForm.estimatedDischarge} onChange={e => setAdmitForm(f => ({ ...f, estimatedDischarge: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }} />
                <input type="number" placeholder="Daily Rate" value={admitForm.dailyRate || ''} onChange={e => setAdmitForm(f => ({ ...f, dailyRate: parseFloat(e.target.value) || 0 }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowAdmit(false)} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleAdmit} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Admit</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vitals Modal */}
      {showVitals && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, maxWidth: '90vw' }}>
            <h3 style={{ marginTop: 0 }}>Record Vitals — {showVitals.animal_name}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="number" step="0.1" placeholder="Temperature (°F)" value={vitalsForm.temperature} onChange={e => setVitalsForm(f => ({ ...f, temperature: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }} />
              <input type="number" placeholder="Heart Rate (bpm)" value={vitalsForm.heartRate} onChange={e => setVitalsForm(f => ({ ...f, heartRate: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }} />
              <input type="number" step="0.1" placeholder="Weight (kg)" value={vitalsForm.weight} onChange={e => setVitalsForm(f => ({ ...f, weight: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }} />
              <textarea placeholder="Notes..." value={vitalsForm.notes} onChange={e => setVitalsForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowVitals(null)} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleVitalsSubmit} style={{ padding: '8px 16px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Save Vitals</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
