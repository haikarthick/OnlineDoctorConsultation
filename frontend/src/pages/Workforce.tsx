import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { useScrollToForm } from '../hooks/useScrollToForm'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { Enterprise, WorkforceTask, ShiftSchedule } from '../types'
import { useTranslation } from 'react-i18next'

const PRIORITY_COLORS: Record<string, string> = {
  low: '#6b7280', medium: '#3b82f6', high: '#f97316', critical: '#ef4444'
}

const WorkforcePage: React.FC = () => {
  const { t } = useTranslation()

  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [tasks, setTasks] = useState<WorkforceTask[]>([])
  const [shifts, setShifts] = useState<ShiftSchedule[]>([])
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'dashboard' | 'tasks' | 'shifts'>('dashboard')
  const [showForm, setShowForm] = useState(false)
  const formRef = useScrollToForm(showForm)
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
    } catch (err: any) {
      console.error('Failed to load workforce data:', err?.message)
      setError(err?.response?.data?.error || err?.message || 'Failed to load data')
    }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [selectedEnterpriseId])
  useAutoRefresh('workforce', fetchData)

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
      setSuccessMsg(t('workforce.taskCreated'))
      setShowForm(false)
      setFormData({ title: '', description: '', taskType: 'general', priority: 'medium', assignedTo: '', dueDate: '', estimatedHours: '' })
      fetchData()
    } catch (err: any) { setError(err.response?.data?.error?.message || t('common.failedToSave')) }
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
      setSuccessMsg(t('workforce.shiftScheduled'))
      setShowShiftForm(false)
      setShiftForm({ userId: '', shiftDate: '', startTime: '08:00', endTime: '17:00', roleOnShift: '', notes: '' })
      fetchData()
    } catch (err: any) { setError(err.response?.data?.error?.message || t('common.failedToSave')) }
  }

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await apiService.updateWorkforceTask(id, { status })
      setSuccessMsg(t('workforce.taskUpdated'))
      fetchData()
    } catch { setError(t('common.failedToUpdate')) }
  }

  const handleCheckIn = async (id: string) => {
    try { await apiService.checkInShift(id); setSuccessMsg(t('workforce.checkedIn')); fetchData() }
    catch { setError(t('workforce.failedCheckIn')) }
  }

  const handleCheckOut = async (id: string) => {
    try { await apiService.checkOutShift(id); setSuccessMsg(t('workforce.checkedOut')); fetchData() }
    catch { setError(t('workforce.failedCheckOut')) }
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>{t('workforce.pageTitle')}</h1>
        <p>{t('workforce.subtitle')}</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <div className="enterprise-selector">
        <label>{t('common.selectEnterprise')}:</label>
        <select value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)}>
          <option value="">{t('common.selectOption')}</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {!selectedEnterpriseId ? (
        <div className="empty-state">{t('workforce.selectEnterprise')}</div>
      ) : loading ? (
        <div className="loading-spinner">{t('workforce.loading')}</div>
      ) : (
        <>
          <div className="tab-bar">
            <button className={tab === 'dashboard' ? 'tab-active' : ''} onClick={() => setTab('dashboard')}>{t('workforce.tabs.dashboard')}</button>
            <button className={tab === 'tasks' ? 'tab-active' : ''} onClick={() => setTab('tasks')}>{t('workforce.tabs.taskBoard')}</button>
            <button className={tab === 'shifts' ? 'tab-active' : ''} onClick={() => setTab('shifts')}>{t('workforce.tabs.shiftSchedule')}</button>
          </div>

          {tab === 'dashboard' && dashboard && (
            <div className="dashboard-grid">
              <div className="stat-card accent-blue">
                <div className="stat-value">{dashboard.summary?.totalTasks || 0}</div>
                <div className="stat-label">{t('workforce.stats.totalTasks')}</div>
              </div>
              <div className="stat-card accent-orange">
                <div className="stat-value">{dashboard.summary?.pendingTasks || 0}</div>
                <div className="stat-label">{t('common.pending')}</div>
              </div>
              <div className="stat-card accent-red">
                <div className="stat-value">{dashboard.summary?.overdue || 0}</div>
                <div className="stat-label">{t('workforce.stats.overdue')}</div>
              </div>
              <div className="stat-card accent-green">
                <div className="stat-value">{dashboard.summary?.todayShiftCount || 0}</div>
                <div className="stat-label">{t('workforce.stats.todayShifts')}</div>
              </div>

              {dashboard.taskPriorityDistribution?.length > 0 && (
                <div className="card">
                  <h3>🏷️ {t('workforce.openTasksByPriority')}</h3>
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
                  <h3>🏆 {t('workforce.topWorkers')}</h3>
                  <table className="data-table compact">
                    <thead><tr><th>{t('common.name')}</th><th>{t('common.completed')}</th><th>{t('common.active')}</th><th>{t('workforce.avgHours')}</th></tr></thead>
                    <tbody>{dashboard.topWorkers.map((w: any, i: number) => (
                      <tr key={i}><td>{w.name}</td><td><strong>{w.completed}</strong></td><td>{w.active}</td><td>{w.avg_hours ? (+w.avg_hours).toFixed(1) : '—'}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}

              {dashboard.overdueTasks?.length > 0 && (
                <div className="card full-width">
                  <h3>🚨 {t('workforce.overdueTasks')}</h3>
                  <table className="data-table">
                    <thead><tr><th>{t('workforce.task')}</th><th>{t('workforce.assignedTo')}</th><th>{t('workforce.due')}</th><th>{t('workforce.priority')}</th></tr></thead>
                    <tbody>{dashboard.overdueTasks.map((ot: any, i: number) => (
                      <tr key={i}><td>{ot.title}</td><td>{ot.assigned_to_name || '—'}</td>
                        <td style={{ color: '#ef4444' }}>{ot.due_date ? new Date(ot.due_date).toLocaleDateString() : '—'}</td>
                        <td><span className="badge" style={{ backgroundColor: PRIORITY_COLORS[ot.priority] }}>{ot.priority}</span></td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}

              {dashboard.todayShifts?.length > 0 && (
                <div className="card full-width">
                  <h3>📅 {t('workforce.stats.todayShifts')}</h3>
                  <table className="data-table">
                    <thead><tr><th>{t('workforce.worker')}</th><th>{t('workforce.time')}</th><th>{t('workforce.role')}</th><th>{t('common.status')}</th></tr></thead>
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
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? t('common.cancel') : t('workforce.createTask')}</button>
              </div>

              {showForm && <div className="edit-form-overlay" onClick={() => { setShowForm(false) }} />}
              {showForm && (
                <div ref={formRef} className="edit-form-panel">
                <form className="module-form" onSubmit={handleCreateTask}>
                  <div className="form-grid">
                    <div className="form-group"><label>{t('workforce.form.title')} *</label><input required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} /></div>
                    <div className="form-group"><label>{t('workforce.form.taskType')}</label>
                      <select value={formData.taskType} onChange={e => setFormData({ ...formData, taskType: e.target.value })}>
                        {['general', 'feeding', 'cleaning', 'health_check', 'vaccination', 'milking', 'shearing', 'repair', 'inspection', 'transport'].map(tt => (
                          <option key={tt} value={tt}>{tt.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group"><label>{t('workforce.priority')}</label>
                      <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}>
                        <option value="low">{t('workforce.priorityLow')}</option><option value="medium">{t('workforce.priorityMedium')}</option>
                        <option value="high">{t('workforce.priorityHigh')}</option><option value="critical">{t('workforce.priorityCritical')}</option>
                      </select>
                    </div>
                    <div className="form-group"><label>{t('workforce.form.dueDate')}</label><input type="datetime-local" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} /></div>
                    <div className="form-group"><label>{t('workforce.form.estimatedHours')}</label><input type="number" step="0.5" value={formData.estimatedHours} onChange={e => setFormData({ ...formData, estimatedHours: e.target.value })} /></div>
                    <div className="form-group full-width"><label>{t('common.description')}</label><textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
                  </div>
                  <button type="submit" className="btn-primary">{t('workforce.createTask')}</button>
                </form>
                </div>
              )}

              <div className="cards-grid">
                {tasks.map(task => (
                  <div key={task.id} className="card" style={{ borderLeft: `4px solid ${PRIORITY_COLORS[task.priority || (task as any).priority] || '#6b7280'}` }}>
                    <h3>{task.title}</h3>
                    <div className="card-meta">
                      <span className="badge" style={{ backgroundColor: PRIORITY_COLORS[task.priority || (task as any).priority] }}>{task.priority}</span>
                      <span className={`badge badge-${task.status}`}>{task.status?.replace(/_/g, ' ')}</span>
                      <span className="badge">{task.taskType || (task as any).task_type}</span>
                    </div>
                    {task.description && <p className="card-note">{task.description}</p>}
                    <div className="card-stats">
                      <div>{t('workforce.assigned')}: <strong>{task.assignedToName || (task as any).assigned_to_name || t('workforce.unassigned')}</strong></div>
                      {(task.dueDate || (task as any).due_date) && <div>{t('workforce.due')}: {new Date(task.dueDate || (task as any).due_date).toLocaleDateString()}</div>}
                      {(task.estimatedHours || (task as any).estimated_hours) && <div>{t('workforce.est')}: {task.estimatedHours || (task as any).estimated_hours}h</div>}
                    </div>
                    <div className="card-footer">
                      {task.status === 'pending' && <button className="btn-sm" onClick={() => handleUpdateStatus(task.id, 'in_progress')}>▶ {t('workforce.start')}</button>}
                      {task.status === 'in_progress' && <button className="btn-sm btn-success" onClick={() => handleUpdateStatus(task.id, 'completed')}>✓ {t('workforce.complete')}</button>}
                    </div>
                  </div>
                ))}
                {!tasks.length && <div className="empty-state">{t('workforce.noTasks')}</div>}
              </div>
            </div>
          )}

          {tab === 'shifts' && (
            <div>
              <div className="section-toolbar">
                <button className="btn-primary" onClick={() => setShowShiftForm(!showShiftForm)}>{showShiftForm ? t('common.cancel') : t('workforce.scheduleShift')}</button>
              </div>

              {showShiftForm && (
                <form className="module-form" onSubmit={handleCreateShift}>
                  <div className="form-grid">
                    <div className="form-group"><label>{t('workforce.form.userId')} *</label><input required value={shiftForm.userId} onChange={e => setShiftForm({ ...shiftForm, userId: e.target.value })} /></div>
                    <div className="form-group"><label>{t('workforce.form.shiftDate')} *</label><input required type="date" value={shiftForm.shiftDate} onChange={e => setShiftForm({ ...shiftForm, shiftDate: e.target.value })} /></div>
                    <div className="form-group"><label>{t('workforce.form.startTime')} *</label><input required type="time" value={shiftForm.startTime} onChange={e => setShiftForm({ ...shiftForm, startTime: e.target.value })} /></div>
                    <div className="form-group"><label>{t('workforce.form.endTime')} *</label><input required type="time" value={shiftForm.endTime} onChange={e => setShiftForm({ ...shiftForm, endTime: e.target.value })} /></div>
                    <div className="form-group"><label>{t('workforce.form.roleOnShift')}</label><input value={shiftForm.roleOnShift} onChange={e => setShiftForm({ ...shiftForm, roleOnShift: e.target.value })} /></div>
                    <div className="form-group"><label>{t('common.notes')}</label><input value={shiftForm.notes} onChange={e => setShiftForm({ ...shiftForm, notes: e.target.value })} /></div>
                  </div>
                  <button type="submit" className="btn-primary">{t('workforce.scheduleShift')}</button>
                </form>
              )}

              <table className="data-table">
                <thead><tr><th>{t('workforce.worker')}</th><th>{t('common.date')}</th><th>{t('workforce.form.startTime')}</th><th>{t('workforce.form.endTime')}</th><th>{t('workforce.role')}</th><th>{t('common.status')}</th><th>{t('common.actions')}</th></tr></thead>
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
                        {s.status === 'scheduled' && <button className="btn-sm" onClick={() => handleCheckIn(s.id)}>{t('workforce.checkIn')}</button>}
                        {s.status === 'active' && <button className="btn-sm btn-success" onClick={() => handleCheckOut(s.id)}>{t('workforce.checkOut')}</button>}
                      </td>
                    </tr>
                  ))}
                  {!shifts.length && <tr><td colSpan={7} className="empty-cell">{t('workforce.noShifts')}</td></tr>}
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
