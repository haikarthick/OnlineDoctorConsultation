import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, WorkforceTask, ShiftSchedule } from '../types'

const PRIORITY_COLORS: Record<string, string> = {
  low: '#6b7280', medium: '#3b82f6', high: '#f97316', critical: '#ef4444'
}

const WorkforcePage: React.FC = () => {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [tasks, setTasks] = useState<WorkforceTask[]>([])
  const [shifts, setShifts] = useState<ShiftSchedule[]>([])
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'dashboard' | 'tasks' | 'shifts'>('dashboard')
  const [showForm, setShowForm] = useState(false)
  const [showShiftForm, setShowShiftForm] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [formData, setFormData] = useState({
    title: '', description: '', taskType: 'general', priority: 'medium',
    assignedTo: '', dueDate: '', estimatedHours: ''
  })
  const [shiftForm, setShiftForm] = useState({
    userId: '', shiftDate: '', startTime: '08:00', endTime: '17:00', roleOnShift: '', notes: ''
  })

  useEffect(() => {
    const f = async () => {
      try {
        const res = await apiService.listEnterprises({ limit: 100 })
        const items = res.data?.items || []
        setEnterprises(items)
        if (items.length === 1) setSelectedEnterpriseId(items[0].id)
      } catch { setEnterprises([]) }
    }
    f()
  }, [])

  const fetchData = async () => {
    if (!selectedEnterpriseId) return
    try {
      setLoading(true)
      const [dashRes, taskRes, shiftRes] = await Promise.all([
        apiService.getWorkforceDashboard(selectedEnterpriseId),
        apiService.listWorkforceTasks(selectedEnterpriseId),
        apiService.listShifts(selectedEnterpriseId)
      ])
      setDashboard(dashRes.data || null)
      setTasks(taskRes.data?.items || [])
      setShifts(shiftRes.data?.items || [])
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [selectedEnterpriseId])

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    try {
      await apiService.createWorkforceTask(selectedEnterpriseId, {
        enterpriseId: selectedEnterpriseId, title: formData.title,
        description: formData.description || undefined, taskType: formData.taskType,
        priority: formData.priority, assignedTo: formData.assignedTo || undefined,
        dueDate: formData.dueDate || undefined,
        estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : undefined,
      })
      setSuccessMsg('Task created!')
      setShowForm(false)
      setFormData({ title: '', description: '', taskType: 'general', priority: 'medium', assignedTo: '', dueDate: '', estimatedHours: '' })
      fetchData()
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed') }
  }

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    try {
      await apiService.createShift(selectedEnterpriseId, {
        enterpriseId: selectedEnterpriseId, userId: shiftForm.userId,
        shiftDate: shiftForm.shiftDate, startTime: shiftForm.startTime,
        endTime: shiftForm.endTime, roleOnShift: shiftForm.roleOnShift || undefined,
        notes: shiftForm.notes || undefined,
      })
      setSuccessMsg('Shift scheduled!')
      setShowShiftForm(false)
      setShiftForm({ userId: '', shiftDate: '', startTime: '08:00', endTime: '17:00', roleOnShift: '', notes: '' })
      fetchData()
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed') }
  }

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await apiService.updateWorkforceTask(id, { status })
      setSuccessMsg(`Task ${status}!`)
      fetchData()
    } catch { setError('Failed to update') }
  }

  const handleCheckIn = async (id: string) => {
    try { await apiService.checkInShift(id); setSuccessMsg('Checked in!'); fetchData() }
    catch { setError('Failed to check in') }
  }

  const handleCheckOut = async (id: string) => {
    try { await apiService.checkOutShift(id); setSuccessMsg('Checked out!'); fetchData() }
    catch { setError('Failed to check out') }
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>👷 Workforce & Task Management</h1>
        <p>Shift scheduling, task boards with checklists, and performance analytics</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <div className="enterprise-selector">
        <label>Select Enterprise:</label>
        <select value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)}>
          <option value="">-- Select --</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {!selectedEnterpriseId ? (
        <div className="empty-state">Select an enterprise to manage workforce</div>
      ) : loading ? (
        <div className="loading-spinner">Loading workforce data…</div>
      ) : (
        <>
          <div className="tab-bar">
            <button className={tab === 'dashboard' ? 'tab-active' : ''} onClick={() => setTab('dashboard')}>Dashboard</button>
            <button className={tab === 'tasks' ? 'tab-active' : ''} onClick={() => setTab('tasks')}>Task Board</button>
            <button className={tab === 'shifts' ? 'tab-active' : ''} onClick={() => setTab('shifts')}>Shift Schedule</button>
          </div>

          {tab === 'dashboard' && dashboard && (
            <div className="dashboard-grid">
              <div className="stat-card accent-blue">
                <div className="stat-value">{dashboard.summary?.totalTasks || 0}</div>
                <div className="stat-label">Total Tasks</div>
              </div>
              <div className="stat-card accent-orange">
                <div className="stat-value">{dashboard.summary?.pendingTasks || 0}</div>
                <div className="stat-label">Pending</div>
              </div>
              <div className="stat-card accent-red">
                <div className="stat-value">{dashboard.summary?.overdue || 0}</div>
                <div className="stat-label">Overdue</div>
              </div>
              <div className="stat-card accent-green">
                <div className="stat-value">{dashboard.summary?.todayShiftCount || 0}</div>
                <div className="stat-label">Today&apos;s Shifts</div>
              </div>

              {dashboard.taskPriorityDistribution?.length > 0 && (
                <div className="card">
                  <h3>🏷️ Open Tasks by Priority</h3>
                  <div className="mini-chart-bar">
                    {dashboard.taskPriorityDistribution.map((p: any, i: number) => (
                      <div key={i} className="bar-row">
                        <span className="bar-label" style={{ color: PRIORITY_COLORS[p.priority] || '#6b7280' }}>{p.priority}</span>
                        <div className="bar-track"><div className="bar-fill" style={{ width: `${(+p.count / Math.max(1, ...dashboard.taskPriorityDistribution.map((x: any) => +x.count))) * 100}%`, backgroundColor: PRIORITY_COLORS[p.priority] }} /></div>
                        <span className="bar-value">{p.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dashboard.topWorkers?.length > 0 && (
                <div className="card">
                  <h3>🏆 Top Workers</h3>
                  <table className="data-table compact">
                    <thead><tr><th>Name</th><th>Completed</th><th>Active</th><th>Avg Hours</th></tr></thead>
                    <tbody>{dashboard.topWorkers.map((w: any, i: number) => (
                      <tr key={i}><td>{w.name}</td><td><strong>{w.completed}</strong></td><td>{w.active}</td><td>{w.avg_hours ? (+w.avg_hours).toFixed(1) : '—'}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}

              {dashboard.overdueTasks?.length > 0 && (
                <div className="card full-width">
                  <h3>🚨 Overdue Tasks</h3>
                  <table className="data-table">
                    <thead><tr><th>Task</th><th>Assigned To</th><th>Due</th><th>Priority</th></tr></thead>
                    <tbody>{dashboard.overdueTasks.map((t: any, i: number) => (
                      <tr key={i}><td>{t.title}</td><td>{t.assigned_to_name || '—'}</td>
                        <td style={{ color: '#ef4444' }}>{t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}</td>
                        <td><span className="badge" style={{ backgroundColor: PRIORITY_COLORS[t.priority] }}>{t.priority}</span></td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}

              {dashboard.todayShifts?.length > 0 && (
                <div className="card full-width">
                  <h3>📅 Today&apos;s Shifts</h3>
                  <table className="data-table">
                    <thead><tr><th>Worker</th><th>Time</th><th>Role</th><th>Status</th></tr></thead>
                    <tbody>{dashboard.todayShifts.map((s: any, i: number) => (
                      <tr key={i}><td>{s.user_name}</td><td>{s.start_time} – {s.end_time}</td>
                        <td>{s.role_on_shift || '—'}</td><td><span className={`badge badge-${s.status}`}>{s.status}</span></td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'tasks' && (
            <div>
              <div className="section-toolbar">
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Create Task'}</button>
              </div>

              {showForm && (
                <form className="module-form" onSubmit={handleCreateTask}>
                  <div className="form-grid">
                    <div className="form-group"><label>Title *</label><input required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} /></div>
                    <div className="form-group"><label>Task Type</label>
                      <select value={formData.taskType} onChange={e => setFormData({ ...formData, taskType: e.target.value })}>
                        {['general', 'feeding', 'cleaning', 'health_check', 'vaccination', 'milking', 'shearing', 'repair', 'inspection', 'transport'].map(t => (
                          <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group"><label>Priority</label>
                      <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}>
                        <option value="low">Low</option><option value="medium">Medium</option>
                        <option value="high">High</option><option value="critical">Critical</option>
                      </select>
                    </div>
                    <div className="form-group"><label>Due Date</label><input type="datetime-local" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} /></div>
                    <div className="form-group"><label>Estimated Hours</label><input type="number" step="0.5" value={formData.estimatedHours} onChange={e => setFormData({ ...formData, estimatedHours: e.target.value })} /></div>
                    <div className="form-group full-width"><label>Description</label><textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
                  </div>
                  <button type="submit" className="btn-primary">Create Task</button>
                </form>
              )}

              <div className="cards-grid">
                {tasks.map(t => (
                  <div key={t.id} className="card" style={{ borderLeft: `4px solid ${PRIORITY_COLORS[t.priority || (t as any).priority] || '#6b7280'}` }}>
                    <h3>{t.title}</h3>
                    <div className="card-meta">
                      <span className="badge" style={{ backgroundColor: PRIORITY_COLORS[t.priority || (t as any).priority] }}>{t.priority}</span>
                      <span className={`badge badge-${t.status}`}>{t.status?.replace(/_/g, ' ')}</span>
                      <span className="badge">{t.taskType || (t as any).task_type}</span>
                    </div>
                    {t.description && <p className="card-note">{t.description}</p>}
                    <div className="card-stats">
                      <div>Assigned: <strong>{t.assignedToName || (t as any).assigned_to_name || 'Unassigned'}</strong></div>
                      {(t.dueDate || (t as any).due_date) && <div>Due: {new Date(t.dueDate || (t as any).due_date).toLocaleDateString()}</div>}
                      {(t.estimatedHours || (t as any).estimated_hours) && <div>Est: {t.estimatedHours || (t as any).estimated_hours}h</div>}
                    </div>
                    <div className="card-footer">
                      {t.status === 'pending' && <button className="btn-sm" onClick={() => handleUpdateStatus(t.id, 'in_progress')}>▶ Start</button>}
                      {t.status === 'in_progress' && <button className="btn-sm btn-success" onClick={() => handleUpdateStatus(t.id, 'completed')}>✓ Complete</button>}
                    </div>
                  </div>
                ))}
                {!tasks.length && <div className="empty-state">No tasks yet</div>}
              </div>
            </div>
          )}

          {tab === 'shifts' && (
            <div>
              <div className="section-toolbar">
                <button className="btn-primary" onClick={() => setShowShiftForm(!showShiftForm)}>{showShiftForm ? 'Cancel' : '+ Schedule Shift'}</button>
              </div>

              {showShiftForm && (
                <form className="module-form" onSubmit={handleCreateShift}>
                  <div className="form-grid">
                    <div className="form-group"><label>User ID *</label><input required value={shiftForm.userId} onChange={e => setShiftForm({ ...shiftForm, userId: e.target.value })} /></div>
                    <div className="form-group"><label>Shift Date *</label><input required type="date" value={shiftForm.shiftDate} onChange={e => setShiftForm({ ...shiftForm, shiftDate: e.target.value })} /></div>
                    <div className="form-group"><label>Start Time *</label><input required type="time" value={shiftForm.startTime} onChange={e => setShiftForm({ ...shiftForm, startTime: e.target.value })} /></div>
                    <div className="form-group"><label>End Time *</label><input required type="time" value={shiftForm.endTime} onChange={e => setShiftForm({ ...shiftForm, endTime: e.target.value })} /></div>
                    <div className="form-group"><label>Role on Shift</label><input value={shiftForm.roleOnShift} onChange={e => setShiftForm({ ...shiftForm, roleOnShift: e.target.value })} /></div>
                    <div className="form-group"><label>Notes</label><input value={shiftForm.notes} onChange={e => setShiftForm({ ...shiftForm, notes: e.target.value })} /></div>
                  </div>
                  <button type="submit" className="btn-primary">Schedule Shift</button>
                </form>
              )}

              <table className="data-table">
                <thead><tr><th>Worker</th><th>Date</th><th>Start</th><th>End</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {shifts.map(s => (
                    <tr key={s.id}>
                      <td>{s.userName || (s as any).user_name || s.userId}</td>
                      <td>{(s.shiftDate || (s as any).shift_date) ? new Date(s.shiftDate || (s as any).shift_date).toLocaleDateString() : '–'}</td>
                      <td>{s.startTime || (s as any).start_time}</td>
                      <td>{s.endTime || (s as any).end_time}</td>
                      <td>{s.roleOnShift || (s as any).role_on_shift || '—'}</td>
                      <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                      <td>
                        {s.status === 'scheduled' && <button className="btn-sm" onClick={() => handleCheckIn(s.id)}>Check In</button>}
                        {s.status === 'active' && <button className="btn-sm btn-success" onClick={() => handleCheckOut(s.id)}>Check Out</button>}
                      </td>
                    </tr>
                  ))}
                  {!shifts.length && <tr><td colSpan={7} className="empty-cell">No shifts scheduled</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default WorkforcePage
