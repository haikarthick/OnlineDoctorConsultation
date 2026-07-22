import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { vetHospitalApi } from '../../services/api/vetHospitalApi'
import apiService from '../../services/api'
import SearchSelect, { SearchSelectOption } from '../../components/SearchSelect'

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
  const [userLabel, setUserLabel] = useState('')

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
      setUserLabel('')
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
    <div className="module-page si-5cec5e87">
      <div className="si-a307e2db">
        <div>
          <h1 className="si-1bc3a9fe">👥 {t('staffSettings.title')}</h1>
          <p className="si-d078dad1">{t('staffSettings.subtitle')}</p>
        </div>
        <div className="si-d223efb3">
          {hospitals.length > 1 && (
            <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} className="si-89cf1ca1">
              {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          )}
          <button onClick={() => setShowAdd(true)} className="si-880bdf60">+ {t('staffSettings.addStaff')}</button>
        </div>
      </div>

      {/* Stats */}
      <div className="si-cfa92bf8">
        <div className="si-8e371dd0">
          <div className="si-655cd763">{t('staffSettings.totalStaff')}</div>
          <div className="si-075b513e">{staff.length}</div>
        </div>
        <div className="si-e8d607cc">
          <div className="si-655cd763">{t('staffSettings.active')}</div>
          <div className="si-3ca1ce25">{activeCount}</div>
        </div>
        <div className="si-20ff762c">
          <div className="si-655cd763">{t('staffSettings.departments')}</div>
          <div className="si-724132a4">{Object.keys(grouped).length}</div>
        </div>
        <div className="si-e7273ea6">
          <div className="si-655cd763">{t('staffSettings.positions')}</div>
          <div className="si-8651386d">{Object.keys(positionCounts).length}</div>
        </div>
      </div>

      {/* Position Filter */}
      <div className="si-ce182cb4">
        <button onClick={() => setFilter('')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', background: filter === '' ? '#2563eb' : '#e2e8f0', color: filter === '' ? '#fff' : '#475569', fontWeight: 600, fontSize: 13 }}>{t('staffSettings.all')}</button>
        {POSITIONS.map(p => (
          <button key={p} onClick={() => setFilter(p)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', background: filter === p ? '#2563eb' : '#e2e8f0', color: filter === p ? '#fff' : '#475569', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
            {POSITION_ICONS[p] || '👤'} {p.replace(/_/g, ' ')} {positionCounts[p] ? `(${positionCounts[p]})` : ''}
          </button>
        ))}
      </div>

      {/* Staff grouped by department */}
      {loading ? (
        <div className="si-9fa8d292"><div className="spinner" /></div>
      ) : (
        <div className="si-0fa972fb">
          {Object.keys(grouped).length === 0 && <p className="si-d91f9779">{t('staffSettings.noStaff')}</p>}
          {Object.entries(grouped).map(([dept, members]) => (
            <div key={dept}>
              <h3 className="si-ffae4dd2">🏢 {dept} <span className="si-ec8e5c31">({members.length})</span></h3>
              <div className="si-53f32bc1">
                {members.map((s: any) => (
                  <div key={s.id} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 12, opacity: s.is_active ? 1 : 0.5 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: s.avatar_url ? 'none' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      {s.avatar_url ? <img src={s.avatar_url} className="si-23fd597f" alt="" /> : POSITION_ICONS[s.position] || '👤'}
                    </div>
                    <div className="si-26d7edc3">
                      <div className="si-a9b7f385">{s.first_name} {s.last_name}</div>
                      <div className="si-655cd763">{(s.position || '').replace(/_/g, ' ')} • {s.email}</div>
                      {s.notes && <div className="si-26b03e6b">{s.notes}</div>}
                    </div>
                    {!s.is_active && <span className="si-d85dcc04">{t('staffSettings.inactive')}</span>}
                    <div className="si-9f48dfc6">
                      <button onClick={() => { setEditId(s.id); setEditForm({ position: s.position, department: s.department || '', notes: s.notes || '', isActive: s.is_active }) }} className="si-581164d1">✏️</button>
                      <button onClick={() => handleRemove(s.id)} className="si-4c51bebe">🗑️</button>
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
        <div className="si-db8248e9">
          <div className="si-508dcb85">
            <h3 className="si-33c1a83e">{t('staffSettings.addStaffPosition')}</h3>
            <div className="si-d8480906">
              <SearchSelect
                placeholder={t('staffSettings.userIdPlaceholder')}
                value={form.userId}
                displayValue={userLabel}
                loadOnOpen={true}
                onSelect={(val, label) => { setForm(f => ({ ...f, userId: val })); setUserLabel(label) }}
                onClear={() => { setForm(f => ({ ...f, userId: '' })); setUserLabel('') }}
                onSearch={async (q: string): Promise<SearchSelectOption[]> => {
                  const res = await apiService.get('/network-user-search', { params: { q: q || 'a' } })
                  return (res.data?.data || []).map((u: any) => ({
                    value: u.id,
                    label: `${u.firstName} ${u.lastName}`,
                    sublabel: `${u.email} · ${u.role}`,
                  }))
                }}
              />
              <select value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className="si-3fc5634b">
                {POSITIONS.map(p => <option key={p} value={p}>{POSITION_ICONS[p]} {p.replace(/_/g, ' ')}</option>)}
              </select>
              <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className="si-3fc5634b">
                <option value="">{t('staffSettings.selectDepartment')}</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <textarea placeholder={t('staffSettings.notesPlaceholder')} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="si-361ccde4" />
              <div className="si-f0412db6">
                <button onClick={() => { setShowAdd(false); setUserLabel('') }} className="si-978a1643">{t('staffSettings.cancel')}</button>
                <button onClick={handleAdd} className="si-880bdf60">{t('staffSettings.add')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editId && (
        <div className="si-db8248e9">
          <div className="si-508dcb85">
            <h3 className="si-33c1a83e">{t('staffSettings.editStaffPosition')}</h3>
            <div className="si-d8480906">
              <select value={editForm.position} onChange={e => setEditForm(f => ({ ...f, position: e.target.value }))} className="si-3fc5634b">
                {POSITIONS.map(p => <option key={p} value={p}>{POSITION_ICONS[p]} {p.replace(/_/g, ' ')}</option>)}
              </select>
              <select value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))} className="si-3fc5634b">
                <option value="">{t('staffSettings.selectDepartment')}</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <textarea placeholder={t('staffSettings.notesPlaceholder')} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="si-361ccde4" />
              <label className="si-7797842f">
                <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm(f => ({ ...f, isActive: e.target.checked }))} /> {t('staffSettings.active')}
              </label>
              <div className="si-f0412db6">
                <button onClick={() => setEditId(null)} className="si-978a1643">{t('staffSettings.cancel')}</button>
                <button onClick={handleUpdate} className="si-880bdf60">{t('staffSettings.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
