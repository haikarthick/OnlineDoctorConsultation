import { useState, useEffect, useCallback } from 'react'
import apiService from '../../services/api'

interface Holiday {
  id: string; holidayDate: string; name: string; holidayType: string;
  isFullDay: boolean; startTime?: string; endTime?: string; createdAt: string;
}

export default function HolidayManagement() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pageMsg, setPageMsg] = useState<{ text: string; isError: boolean } | null>(null)
  const [form, setForm] = useState({ holidayDate: '', name: '', holidayType: 'general', isFullDay: true, startTime: '09:00', endTime: '17:00' })

  const msg = (text: string, isError = false) => { setPageMsg({ text, isError }); setTimeout(() => setPageMsg(null), 3500) }

  const loadHolidays = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiService.listHolidays({ year })
      setHolidays(res.data || [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [year])

  useEffect(() => { loadHolidays() }, [loadHolidays])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      await apiService.createHoliday({
        holidayDate: form.holidayDate, name: form.name,
        holidayType: form.holidayType, isFullDay: form.isFullDay,
        ...(form.isFullDay ? {} : { startTime: form.startTime, endTime: form.endTime })
      })
      setShowForm(false); loadHolidays(); msg('Holiday added ✓')
    } catch (err: any) { msg(err?.response?.data?.message || 'Failed to add holiday', true) }
    finally { setSubmitting(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this holiday?')) return
    try { await apiService.deleteHoliday(id); loadHolidays(); msg('Holiday removed ✓') }
    catch { msg('Failed to remove', true) }
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const upcoming = holidays.filter(h => h.holidayDate >= todayStr)
  const past = holidays.filter(h => h.holidayDate < todayStr)

  if (loading) {
    return <div className="module-page"><div className="loading-container"><div className="loading-spinner" /><p>Loading holidays...</p></div></div>
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>🎉 Holiday Management</h1>
          <p className="page-subtitle">Manage system-wide and hospital-specific holidays. These dates will be blocked for all doctor bookings.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => { setForm({ holidayDate: '', name: '', holidayType: 'general', isFullDay: true, startTime: '09:00', endTime: '17:00' }); setShowForm(true) }}>
            + Add Holiday
          </button>
        </div>
      </div>

      {pageMsg && <div className={`modal-alert ${pageMsg.isError ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>{pageMsg.text}</div>}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Holidays', value: holidays.length, color: '#ca8a04', icon: '📅' },
          { label: 'Upcoming', value: upcoming.length, color: '#16a34a', icon: '🔜' },
          { label: 'General', value: holidays.filter(h => h.holidayType === 'general').length, color: '#2563eb', icon: '🌐' },
          { label: 'Emergency', value: holidays.filter(h => h.holidayType === 'emergency_closure').length, color: '#dc2626', icon: '🚨' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 24 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Year filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[year - 1, year, year + 1].map(y => (
          <button key={y} className={`btn btn-sm ${year === y ? 'btn-primary' : 'btn-outline'}`} onClick={() => setYear(y)}>{y}</button>
        ))}
      </div>

      {/* Upcoming */}
      <h3 style={{ fontSize: 15, marginBottom: 8, color: '#374151' }}>Upcoming Holidays ({upcoming.length})</h3>
      {upcoming.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: '#6b7280', marginBottom: 16 }}>No upcoming holidays for {year}.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
          {upcoming.map(h => (
            <div key={h.id} className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderLeft: `4px solid ${h.holidayType === 'emergency_closure' ? '#ef4444' : h.holidayType === 'hospital_specific' ? '#f97316' : '#eab308'}` }}>
              <div>
                <strong style={{ fontSize: 14 }}>{h.name}</strong>
                <span style={{ marginLeft: 10, fontSize: 13, color: '#6b7280' }}>
                  {new Date(h.holidayDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span style={{ marginLeft: 8 }} className={`badge ${h.holidayType === 'general' ? 'badge-active' : h.holidayType === 'emergency_closure' ? 'badge-danger' : 'badge-warning'}`}>
                  {h.holidayType.replace('_', ' ')}
                </span>
                {!h.isFullDay && <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>({h.startTime}–{h.endTime})</span>}
              </div>
              <button className="btn btn-sm btn-danger" onClick={() => handleDelete(h.id)}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <>
          <h3 style={{ fontSize: 15, marginBottom: 8, color: '#9ca3af' }}>Past Holidays ({past.length})</h3>
          <div style={{ display: 'grid', gap: 6, opacity: 0.6 }}>
            {past.map(h => (
              <div key={h.id} className="card" style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 13 }}>{h.name}</span>
                  <span style={{ marginLeft: 8, fontSize: 12, color: '#9ca3af' }}>
                    {new Date(h.holidayDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(h.id)}>✕</button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add Holiday Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🎉 Add Holiday</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Holiday Name</label>
                  <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., Christmas Day, New Year..." required />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={form.holidayDate}
                    onChange={e => setForm({ ...form, holidayDate: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-input" value={form.holidayType} onChange={e => setForm({ ...form, holidayType: e.target.value })}>
                    <option value="general">General Holiday</option>
                    <option value="hospital_specific">Hospital Specific</option>
                    <option value="emergency_closure">Emergency Closure</option>
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.isFullDay} onChange={e => setForm({ ...form, isFullDay: e.target.checked })} style={{ width: 18, height: 18 }} />
                    <span>Full day closure</span>
                  </label>
                </div>
                {!form.isFullDay && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label">Start</label>
                      <input className="form-input" type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">End</label>
                      <input className="form-input" type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Add Holiday'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
