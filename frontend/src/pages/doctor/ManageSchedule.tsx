import React, { useState, useEffect } from 'react'
import apiService from '../../services/api'
import { VetSchedule } from '../../types'
import '../../styles/modules.css'

interface ManageScheduleProps {
  onNavigate: (path: string) => void
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday'
}

const ManageSchedule: React.FC<ManageScheduleProps> = ({  }) => {
  const [schedules, setSchedules] = useState<VetSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    dayOfWeek: 'monday',
    startTime: '09:00',
    endTime: '17:00',
    slotDurationMinutes: 30,
    isAvailable: true
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadSchedules()
  }, [])

  const loadSchedules = async () => {
    try {
      setLoading(true)
      const result = await apiService.getMySchedules()
      setSchedules(result.data || [])
    } catch (err) {
      console.error('Failed to load schedules:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      if (editingId) {
        await apiService.updateSchedule(editingId, form)
      } else {
        await apiService.createSchedule(form)
      }
      setShowForm(false)
      setEditingId(null)
      resetForm()
      loadSchedules()
    } catch (err) {
      console.error('Failed to save schedule:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (sched: VetSchedule) => {
    setForm({
      dayOfWeek: sched.dayOfWeek,
      startTime: sched.startTime,
      endTime: sched.endTime,
      slotDurationMinutes: sched.slotDurationMinutes,
      isAvailable: sched.isAvailable
    })
    setEditingId(sched.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this schedule?')) return
    try {
      await apiService.deleteSchedule(id)
      loadSchedules()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const resetForm = () => {
    setForm({ dayOfWeek: 'monday', startTime: '09:00', endTime: '17:00', slotDurationMinutes: 30, isAvailable: true })
  }

  const getScheduleForDay = (day: string) => schedules.filter(s => s.dayOfWeek === day)

  if (loading) {
    return (
      <div className="module-page">
        <div className="loading-container"><div className="loading-spinner" /><p>Loading schedule...</p></div>
      </div>
    )
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>Manage Schedule</h1>
          <p className="page-subtitle">Set your availability for patient bookings</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => { resetForm(); setEditingId(null); setShowForm(true) }}>
            + Add Time Slot
          </button>
        </div>
      </div>

      {/* Schedule Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'Edit Schedule' : 'Add Schedule'}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Day of Week</label>
                  <select className="form-input" value={form.dayOfWeek} onChange={e => setForm({ ...form, dayOfWeek: e.target.value })}>
                    {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Start Time</label>
                    <input className="form-input" type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Time</label>
                    <input className="form-input" type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Slot Duration (minutes)</label>
                  <select className="form-input" value={form.slotDurationMinutes} onChange={e => setForm({ ...form, slotDurationMinutes: Number(e.target.value) })}>
                    <option value={15}>15 minutes</option>
                    <option value={20}>20 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.isAvailable} onChange={e => setForm({ ...form, isAvailable: e.target.checked })} style={{ width: 18, height: 18 }} />
                    <span>Available for bookings</span>
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Schedule Grid */}
      <div className="schedule-grid">
        {DAYS.map(day => {
          const daySched = getScheduleForDay(day)
          return (
            <div key={day} className="card" style={{ marginBottom: 12 }}>
              <div className="card-header" style={{ padding: '12px 16px' }}>
                <h3 style={{ margin: 0 }}>{DAY_LABELS[day]}</h3>
                {daySched.length > 0 && (
                  <span className="badge badge-active">{daySched.length} slot{daySched.length > 1 ? 's' : ''}</span>
                )}
              </div>
              <div className="card-body" style={{ padding: '12px 16px' }}>
                {daySched.length === 0 ? (
                  <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>No slots configured</p>
                ) : (
                  daySched.map(s => (
                    <div key={s.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', backgroundColor: s.isAvailable ? '#f0fdf4' : '#fef2f2',
                      borderRadius: 8, marginBottom: 8, border: `1px solid ${s.isAvailable ? '#bbf7d0' : '#fecaca'}`
                    }}>
                      <div>
                        <strong style={{ fontSize: 14 }}>{s.startTime} - {s.endTime}</strong>
                        <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                          {s.slotDurationMinutes}min slots • {s.isAvailable ? '✅ Available' : '❌ Unavailable'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-outline" onClick={() => handleEdit(s)}>✏️</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)}>🗑️</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ManageSchedule
