import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { WellnessScorecard, WellnessReminder } from '../types'

const SCORE_COLORS = (score: number) => score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444'
const PRIORITY_COLORS: Record<string, string> = { low: '#94a3b8', medium: '#3b82f6', high: '#f97316', urgent: '#ef4444' }
const REMINDER_TYPES = ['vaccination', 'checkup', 'dental', 'grooming', 'medication', 'nutrition', 'exercise', 'lab_test']

const WellnessPortal: React.FC = () => {
  const [dashboard, setDashboard] = useState<any>(null)
  const [scorecards, setScorecards] = useState<WellnessScorecard[]>([])
  const [reminders, setReminders] = useState<WellnessReminder[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'dashboard' | 'scorecards' | 'reminders'>('dashboard')
  const [showScorecardForm, setShowScorecardForm] = useState(false)
  const [showReminderForm, setShowReminderForm] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [animals, setAnimals] = useState<any[]>([])

  const [scorecardForm, setScorecardForm] = useState({
    animalId: '', nutritionScore: '75', activityScore: '75', vaccinationScore: '75',
    dentalScore: '75', weightStatus: 'normal', nextCheckup: '', recommendations: '', riskFlags: '',
  })
  const [reminderForm, setReminderForm] = useState({
    animalId: '', reminderType: 'vaccination', title: '', description: '', dueDate: '',
    priority: 'medium', recurrence: '', recurrenceInterval: '1',
  })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [dashRes, scRes, remRes, animRes] = await Promise.all([
        apiService.getWellnessDashboard(),
        apiService.listWellnessScorecards(),
        apiService.listWellnessReminders(),
        apiService.listAnimals({}),
      ])
      setDashboard(dashRes.data)
      setScorecards(scRes.data?.items || [])
      setReminders(remRes.data?.items || [])
      setAnimals(animRes.data?.items || animRes.data || [])
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  const createScorecard = async () => {
    if (!scorecardForm.animalId) return
    try {
      await apiService.createWellnessScorecard({
        ...scorecardForm,
        nutritionScore: +scorecardForm.nutritionScore, activityScore: +scorecardForm.activityScore,
        vaccinationScore: +scorecardForm.vaccinationScore, dentalScore: +scorecardForm.dentalScore,
        recommendations: scorecardForm.recommendations.split(',').map(r => r.trim()).filter(Boolean),
        riskFlags: scorecardForm.riskFlags.split(',').map(r => r.trim()).filter(Boolean),
      })
      setShowScorecardForm(false)
      setSuccessMsg('Scorecard created!')
      fetchAll()
    } catch (e: any) { setError(e.message) }
  }

  const createReminder = async () => {
    if (!reminderForm.animalId || !reminderForm.title || !reminderForm.dueDate) return
    try {
      await apiService.createWellnessReminder({
        ...reminderForm,
        recurrenceInterval: +reminderForm.recurrenceInterval || null,
        recurrence: reminderForm.recurrence || null,
      })
      setShowReminderForm(false)
      setSuccessMsg('Reminder created!')
      fetchAll()
    } catch (e: any) { setError(e.message) }
  }

  const completeReminder = async (id: string) => {
    try { await apiService.completeReminder(id); setSuccessMsg('Completed!'); fetchAll() } catch (e: any) { setError(e.message) }
  }

  const snoozeReminder = async (id: string) => {
    const until = new Date()
    until.setDate(until.getDate() + 3)
    try { await apiService.snoozeReminder(id, until.toISOString().split('T')[0]); setSuccessMsg('Snoozed 3 days'); fetchAll() } catch (e: any) { setError(e.message) }
  }

  const renderScoreGauge = (label: string, score: number, emoji: string) => (
    <div style={{ textAlign: 'center', flex: 1, minWidth: 80 }}>
      <div style={{ fontSize: 28, marginBottom: 4 }}>{emoji}</div>
      <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto' }}>
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="#e5e7eb" strokeWidth="4" />
          <circle cx="32" cy="32" r="28" fill="none" stroke={SCORE_COLORS(score)} strokeWidth="4"
            strokeDasharray={`${(score / 100) * 175.93} 175.93`} strokeLinecap="round"
            transform="rotate(-90 32 32)" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: SCORE_COLORS(score) }}>{score}</div>
      </div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{label}</div>
    </div>
  )

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>💚 Wellness Portal</h1>
          <p style={{ color: '#666', margin: '8px 0 0' }}>Pet health scorecards, vaccination reminders, and wellness tracking</p>
        </div>
      </div>

      {error && <div className="module-alert error">{error} <button onClick={() => setError('')}>✕</button></div>}
      {successMsg && <div className="module-alert success">{successMsg} <button onClick={() => setSuccessMsg('')}>✕</button></div>}

      <div className="module-tabs">
        {(['dashboard', 'scorecards', 'reminders'] as const).map(t => (
          <button key={t} className={`module-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'dashboard' ? '📊 Dashboard' : t === 'scorecards' ? '📋 Scorecards' : '⏰ Reminders'}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading...</div>}

      {!loading && tab === 'dashboard' && dashboard && (
        <div>
          <div className="module-stats">
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.totalAnimals || 0}</div><div className="stat-label">Animals</div></div>
            <div className="stat-card"><div className="stat-value" style={{ color: SCORE_COLORS(+dashboard.summary?.avgWellnessScore || 0) }}>{dashboard.summary?.avgWellnessScore || '—'}</div><div className="stat-label">Avg Wellness Score</div></div>
            <div className="stat-card"><div className="stat-value" style={{ color: '#ef4444' }}>{dashboard.summary?.overdueReminders || 0}</div><div className="stat-label">Overdue Reminders</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.upcomingReminders || 0}</div><div className="stat-label">Upcoming (14d)</div></div>
          </div>

          {dashboard.latestScorecards?.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3>Latest Wellness Scorecards</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {dashboard.latestScorecards.map((sc: any) => (
                  <div key={sc.id} className="module-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0 }}>{sc.animal_name}</h4>
                      <span style={{ fontSize: 24, fontWeight: 700, color: SCORE_COLORS(+sc.overall_score) }}>{(+sc.overall_score).toFixed(0)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#888' }}>{sc.species} · Weight: {sc.weight_status}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      {renderScoreGauge('Nutrition', +sc.nutrition_score, '🥩')}
                      {renderScoreGauge('Activity', +sc.activity_score, '🏃')}
                      {renderScoreGauge('Vaccines', +sc.vaccination_score, '💉')}
                      {renderScoreGauge('Dental', +sc.dental_score, '🦷')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dashboard.upcomingReminders?.length > 0 && (
            <div className="module-card" style={{ marginTop: 24 }}>
              <h3>⏰ Upcoming Reminders</h3>
              {dashboard.upcomingReminders.map((r: any) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0', gap: 12 }}>
                  <div style={{ width: 4, height: 40, borderRadius: 2, background: PRIORITY_COLORS[r.priority] || '#3b82f6' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{r.animal_name} · Due: {r.due_date?.slice(0, 10)} · {r.reminder_type}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="module-btn small" onClick={() => completeReminder(r.id)} style={{ color: '#22c55e' }}>✓</button>
                    <button className="module-btn small" onClick={() => snoozeReminder(r.id)} style={{ color: '#eab308' }}>💤</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'scorecards' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="module-btn primary" onClick={() => setShowScorecardForm(true)}>+ New Scorecard</button>
          </div>
          {showScorecardForm && (
            <div className="module-card" style={{ marginBottom: 20 }}>
              <h3>Create Wellness Scorecard</h3>
              <div className="module-form">
                <div><label className="module-label">Animal</label>
                  <select className="module-input" value={scorecardForm.animalId} onChange={e => setScorecardForm(f => ({ ...f, animalId: e.target.value }))}>
                    <option value="">Select animal...</option>
                    {animals.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({a.species})</option>)}
                  </select></div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {[['Nutrition', 'nutritionScore'], ['Activity', 'activityScore'], ['Vaccination', 'vaccinationScore'], ['Dental', 'dentalScore']].map(([label, field]) => (
                    <div key={field} style={{ flex: 1, minWidth: 120 }}>
                      <label className="module-label">{label} Score (0-100)</label>
                      <input className="module-input" type="number" min="0" max="100"
                        value={(scorecardForm as any)[field]}
                        onChange={e => setScorecardForm(f => ({ ...f, [field]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}><label className="module-label">Weight Status</label>
                    <select className="module-input" value={scorecardForm.weightStatus} onChange={e => setScorecardForm(f => ({ ...f, weightStatus: e.target.value }))}>
                      {['underweight', 'normal', 'overweight', 'obese'].map(w => <option key={w} value={w}>{w}</option>)}
                    </select></div>
                  <div style={{ flex: 1 }}><label className="module-label">Next Checkup</label>
                    <input className="module-input" type="date" value={scorecardForm.nextCheckup} onChange={e => setScorecardForm(f => ({ ...f, nextCheckup: e.target.value }))} /></div>
                </div>
                <div><label className="module-label">Recommendations (comma separated)</label><input className="module-input" value={scorecardForm.recommendations} onChange={e => setScorecardForm(f => ({ ...f, recommendations: e.target.value }))} placeholder="e.g. Increase exercise, Schedule dental cleaning" /></div>
                <div><label className="module-label">Risk Flags (comma separated)</label><input className="module-input" value={scorecardForm.riskFlags} onChange={e => setScorecardForm(f => ({ ...f, riskFlags: e.target.value }))} placeholder="e.g. Overdue vaccinations, Dental plaque" /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="module-btn primary" onClick={createScorecard}>Create Scorecard</button>
                <button className="module-btn" onClick={() => setShowScorecardForm(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {scorecards.map(sc => (
              <div key={sc.id} className="module-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <h4 style={{ margin: 0 }}>{sc.animalName}</h4>
                    <div style={{ fontSize: 12, color: '#888' }}>{sc.species} · {sc.weightStatus}</div>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: SCORE_COLORS(sc.overallScore) }}>{(+sc.overallScore).toFixed(0)}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {renderScoreGauge('Nutrition', +sc.nutritionScore, '🥩')}
                  {renderScoreGauge('Activity', +sc.activityScore, '🏃')}
                  {renderScoreGauge('Vaccines', +sc.vaccinationScore, '💉')}
                  {renderScoreGauge('Dental', +sc.dentalScore, '🦷')}
                </div>
                {sc.recommendations?.length > 0 && (
                  <div style={{ marginTop: 12 }}>{sc.recommendations.map((r: string, i: number) => <span key={i} className="module-badge" style={{ marginRight: 4, marginBottom: 4 }}>{r}</span>)}</div>
                )}
                {sc.riskFlags?.length > 0 && (
                  <div style={{ marginTop: 8 }}>{sc.riskFlags.map((f: string, i: number) => <span key={i} className="module-badge error" style={{ marginRight: 4 }}>⚠️ {f}</span>)}</div>
                )}
                {sc.nextCheckup && <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>Next checkup: {sc.nextCheckup.slice(0, 10)}</div>}
              </div>
            ))}
            {scorecards.length === 0 && <p style={{ color: '#888' }}>No scorecards yet. Create one for your pet!</p>}
          </div>
        </div>
      )}

      {!loading && tab === 'reminders' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="module-btn primary" onClick={() => setShowReminderForm(true)}>+ New Reminder</button>
          </div>
          {showReminderForm && (
            <div className="module-card" style={{ marginBottom: 20 }}>
              <h3>Create Reminder</h3>
              <div className="module-form">
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}><label className="module-label">Animal</label>
                    <select className="module-input" value={reminderForm.animalId} onChange={e => setReminderForm(f => ({ ...f, animalId: e.target.value }))}>
                      <option value="">Select animal...</option>
                      {animals.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({a.species})</option>)}
                    </select></div>
                  <div style={{ flex: 1 }}><label className="module-label">Type</label>
                    <select className="module-input" value={reminderForm.reminderType} onChange={e => setReminderForm(f => ({ ...f, reminderType: e.target.value }))}>
                      {REMINDER_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select></div>
                </div>
                <div><label className="module-label">Title</label><input className="module-input" value={reminderForm.title} onChange={e => setReminderForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Annual vaccination due" /></div>
                <div><label className="module-label">Description</label><textarea className="module-input" value={reminderForm.description} onChange={e => setReminderForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}><label className="module-label">Due Date</label><input className="module-input" type="date" value={reminderForm.dueDate} onChange={e => setReminderForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
                  <div style={{ flex: 1 }}><label className="module-label">Priority</label>
                    <select className="module-input" value={reminderForm.priority} onChange={e => setReminderForm(f => ({ ...f, priority: e.target.value }))}>
                      {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                  <div style={{ flex: 1 }}><label className="module-label">Recurrence</label>
                    <select className="module-input" value={reminderForm.recurrence} onChange={e => setReminderForm(f => ({ ...f, recurrence: e.target.value }))}>
                      <option value="">None</option>
                      {['daily', 'weekly', 'monthly', 'yearly'].map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="module-btn primary" onClick={createReminder}>Create Reminder</button>
                <button className="module-btn" onClick={() => setShowReminderForm(false)}>Cancel</button>
              </div>
            </div>
          )}

          {reminders.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: 16, background: 'white', borderRadius: 8, marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', gap: 12 }}>
              <div style={{ width: 4, height: 48, borderRadius: 2, background: PRIORITY_COLORS[r.priority] || '#3b82f6' }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{r.title}</span>
                  <span className={`module-badge ${r.status === 'completed' ? 'success' : r.status === 'snoozed' ? 'warning' : ''}`}>{r.status}</span>
                  <span className="module-badge">{r.reminderType}</span>
                </div>
                <div style={{ fontSize: 13, color: '#666' }}>{r.animalName} · Due: {r.dueDate?.slice(0, 10)}
                  {r.recurrence && <span style={{ marginLeft: 8 }}>🔄 {r.recurrence}</span>}</div>
              </div>
              {r.status === 'pending' && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="module-btn small" onClick={() => completeReminder(r.id)} style={{ color: '#22c55e' }}>✓ Done</button>
                  <button className="module-btn small" onClick={() => snoozeReminder(r.id)} style={{ color: '#eab308' }}>💤 Snooze</button>
                </div>
              )}
            </div>
          ))}
          {reminders.length === 0 && <p style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>No reminders yet</p>}
        </div>
      )}
    </div>
  )
}

export default WellnessPortal
