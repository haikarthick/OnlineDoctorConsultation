import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { vetHospitalApi } from '../../services/api/vetHospitalApi'
import apiService from '../../services/api'

const POSITIONS = [
  'veterinarian', 'senior_veterinarian', 'vet_technician', 'vet_nurse',
  'receptionist', 'lab_technician', 'radiology_tech', 'surgeon',
  'anesthesiologist', 'pharmacist', 'kennel_attendant', 'hospital_admin',
] as const

const DEPARTMENTS = [
  'Emergency', 'Surgery', 'Internal Medicine', 'Radiology', 'Laboratory',
  'Pharmacy', 'ICU', 'General Practice', 'Dermatology', 'Cardiology',
  'Rehabilitation', 'Boarding', 'Administration',
] as const

const POSITION_ICONS: Record<string, string> = {
  veterinarian: '👨‍⚕️', senior_veterinarian: '🏅', vet_technician: '🔬', vet_nurse: '👩‍⚕️',
  receptionist: '🖥️', lab_technician: '🧪', radiology_tech: '📡', surgeon: '🔪',
  anesthesiologist: '💉', pharmacist: '💊', kennel_attendant: '🐾', hospital_admin: '📊',
}

export default function StaffSettings() {
  const { t } = useTranslation()
  const [hospitalId, setHospitalId] = useState('')
  const [hospitals, setHospitals] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const [form, setForm] = useState({ userId: '', position: 'vet_technician', department: '', notes: '' })
  const [editForm, setEditForm] = useState({ position: '', department: '', notes: '', isActive: true })

  useEffect(() => {
    (async () => {
      try {
        const list = await vetHospitalApi.listMyHospitals()
        setHospitals(list || [])
        if (list.length > 0) setHospitalId(list[0].id)
      } catch { /* empty */ }
    })()
  }, [])

  const loadStaff = useCallback(async () => {
    if (!hospitalId) return
    setLoading(true)
    try {
      const res = await apiService.listStaffPositions(hospitalId)
      setStaff(res.data || [])
    } catch { /* empty */ }
    setLoading(false)
  }, [hospitalId])

  useEffect(() => { loadStaff() }, [loadStaff])

  async function handleAdd() {
    if (!hospitalId || !form.userId) return
    try {
      await apiService.addStaffPosition(hospitalId, form)
      setShowAdd(false)
      setForm({ userId: '', position: 'vet_technician', department: '', notes: '' })
      loadStaff()
    } catch { /* empty */ }
  }

  async function handleUpdate() {
    if (!editId) return
    try {
      await apiService.updateStaffPosition(editId, editForm)
      setEditId(null)
      loadStaff()
    } catch { /* empty */ }
  }

  async function handleRemove(id: string) {
    if (!confirm(t('staffSettings.removeConfirm'))) return
    try {
      await apiService.removeStaffPosition(id)
      loadStaff()
    } catch { /* empty */ }
  }

  const filteredStaff = staff.filter(s => {
    if (!filter) return true
    return s.position === filter
  })

  // Group by department
  const grouped = filteredStaff.reduce((acc: Record<string, any[]>, s) => {
    const dept = s.department || 'Unassigned'
    if (!acc[dept]) acc[dept] = []
    acc[dept].push(s)
    return acc
  }, {})

  // Stats
  const activeCount = staff.filter(s => s.is_active).length
  const positionCounts: Record<string, number> = {}
  staff.forEach(s => { positionCounts[s.position] = (positionCounts[s.position] || 0) + 1 })

  return (
    <div className="module-page" style={{ minHeight: 'calc(100vh - 64px)', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>👥 {t('staffSettings.title')}</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>{t('staffSettings.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hospitals.length > 1 && (
            <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}>
              {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          )}
          <button onClick={() => setShowAdd(true)} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>+ {t('staffSettings.addStaff')}</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', borderLeft: '4px solid #2563eb' }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>{t('staffSettings.totalStaff')}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2563eb' }}>{staff.length}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', borderLeft: '4px solid #059669' }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>{t('staffSettings.active')}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#059669' }}>{activeCount}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>{t('staffSettings.departments')}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}>{Object.keys(grouped).length}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>{t('staffSettings.positions')}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#8b5cf6' }}>{Object.keys(positionCounts).length}</div>
        </div>
      </div>

      {/* Position Filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, overflowX: 'auto', paddingBottom: 4, flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', background: filter === '' ? '#2563eb' : '#e2e8f0', color: filter === '' ? '#fff' : '#475569', fontWeight: 600, fontSize: 13 }}>{t('staffSettings.all')}</button>
        {POSITIONS.map(p => (
          <button key={p} onClick={() => setFilter(p)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', background: filter === p ? '#2563eb' : '#e2e8f0', color: filter === p ? '#fff' : '#475569', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
            {POSITION_ICONS[p] || '👤'} {p.replace(/_/g, ' ')} {positionCounts[p] ? `(${positionCounts[p]})` : ''}
          </button>
        ))}
      </div>

      {/* Staff grouped by department */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.keys(grouped).length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>{t('staffSettings.noStaff')}</p>}
          {Object.entries(grouped).map(([dept, members]) => (
            <div key={dept}>
              <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#334155' }}>🏢 {dept} <span style={{ fontSize: 13, fontWeight: 400, color: '#94a3b8' }}>({members.length})</span></h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 10 }}>
                {members.map((s: any) => (
                  <div key={s.id} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 12, opacity: s.is_active ? 1 : 0.5 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: s.avatar_url ? 'none' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      {s.avatar_url ? <img src={s.avatar_url} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} alt="" /> : POSITION_ICONS[s.position] || '👤'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{s.first_name} {s.last_name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{s.position.replace(/_/g, ' ')} • {s.email}</div>
                      {s.notes && <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.notes}</div>}
                    </div>
                    {!s.is_active && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: '#fecaca', color: '#991b1b' }}>{t('staffSettings.inactive')}</span>}
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => { setEditId(s.id); setEditForm({ position: s.position, department: s.department || '', notes: s.notes || '', isActive: s.is_active }) }} style={{ padding: '4px 8px', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>✏️</button>
                      <button onClick={() => handleRemove(s.id)} style={{ padding: '4px 8px', background: '#fef2f2', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Staff Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 440, maxWidth: '90vw' }}>
            <h3 style={{ marginTop: 0 }}>{t('staffSettings.addStaffPosition')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input placeholder={t('staffSettings.userIdPlaceholder')} value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }} />
              <select value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}>
                {POSITIONS.map(p => <option key={p} value={p}>{POSITION_ICONS[p]} {p.replace(/_/g, ' ')}</option>)}
              </select>
              <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}>
                <option value="">{t('staffSettings.selectDepartment')}</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <textarea placeholder={t('staffSettings.notesPlaceholder')} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowAdd(false)} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>{t('staffSettings.cancel')}</button>
                <button onClick={handleAdd} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>{t('staffSettings.add')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 440, maxWidth: '90vw' }}>
            <h3 style={{ marginTop: 0 }}>{t('staffSettings.editStaffPosition')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <select value={editForm.position} onChange={e => setEditForm(f => ({ ...f, position: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}>
                {POSITIONS.map(p => <option key={p} value={p}>{POSITION_ICONS[p]} {p.replace(/_/g, ' ')}</option>)}
              </select>
              <select value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}>
                <option value="">{t('staffSettings.selectDepartment')}</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <textarea placeholder={t('staffSettings.notesPlaceholder')} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical' }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm(f => ({ ...f, isActive: e.target.checked }))} /> {t('staffSettings.active')}
              </label>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setEditId(null)} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>{t('staffSettings.cancel')}</button>
                <button onClick={handleUpdate} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>{t('staffSettings.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
