import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import './ModulePage.css'
import { WellnessScorecard, WellnessReminder } from '../types'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useMasterData } from '../context/MasterDataContext'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

const SCORE_COLORS = (score: number) => score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444'
const PRIORITY_COLORS: Record<string, string> = { low: '#94a3b8', medium: '#3b82f6', high: '#f97316', urgent: '#ef4444' }

const PET_REMINDER_TYPES = ['vaccination', 'checkup', 'dental', 'grooming', 'medication', 'nutrition', 'exercise', 'lab_test']
const FARMER_REMINDER_TYPES = ['vaccination', 'checkup', 'deworming', 'dipping', 'heat_detection', 'pregnancy_check', 'medication', 'nutrition', 'lab_test', 'foot_trimming']

const WellnessPortal: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { formatDate } = useSettings()
  const { speciesLabel } = useMasterData()
  const navigate = useNavigate()
  const isFarmer = user?.role === 'farmer'
  const REMINDER_TYPES = isFarmer ? FARMER_REMINDER_TYPES : PET_REMINDER_TYPES

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
      setAnimals(animRes.data?.animals || animRes.data?.items || [])
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }
  useAutoRefresh('wellness', fetchAll)

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
      setSuccessMsg(t('wellnessPortal.toasts.scorecardCreated'))
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
      setSuccessMsg(t('wellnessPortal.toasts.reminderCreated'))
      fetchAll()
    } catch (e: any) { setError(e.message) }
  }

  const completeReminder = async (id: string) => {
    try { await apiService.completeReminder(id); setSuccessMsg(t('wellnessPortal.toasts.completed')); fetchAll() } catch (e: any) { setError(e.message) }
  }

  const snoozeReminder = async (id: string) => {
    const until = new Date()
    until.setDate(until.getDate() + 3)
    try { await apiService.snoozeReminder(id, until.toISOString().split('T')[0]); setSuccessMsg(t('wellnessPortal.toasts.snoozed')); fetchAll() } catch (e: any) { setError(e.message) }
  }

  const renderScoreGauge = (label: string, score: number, emoji: string) => (
    <div className="si-70983a36">
      <div className="si-3540f604">{emoji}</div>
      <div className="si-8a19fc04">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="#e5e7eb" strokeWidth="4" />
          <circle cx="32" cy="32" r="28" fill="none" stroke={SCORE_COLORS(score)} strokeWidth="4"
            strokeDasharray={`${(score / 100) * 175.93} 175.93`} strokeLinecap="round"
            transform="rotate(-90 32 32)" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: SCORE_COLORS(score) }}>{score}</div>
      </div>
      <div className="si-5e4162e0">{label}</div>
    </div>
  )

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>{t('wellnessPortal.pageTitle')}</h1>
          <p className="si-f80b783e">{t('wellnessPortal.subtitle')}</p>
        </div>
      </div>

      {error && <div className="module-alert error">{error} <button onClick={() => setError('')}>✕</button></div>}
      {successMsg && <div className="module-alert success">{successMsg} <button onClick={() => setSuccessMsg('')}>✕</button></div>}

      <div className="module-tabs">
        {(['dashboard', 'scorecards', 'reminders'] as const).map(tabKey => (
          <button key={tabKey} className={`module-tab ${tab === tabKey ? 'active' : ''}`} onClick={() => setTab(tabKey)}>
            {t(`wellnessPortal.tabs.${tabKey}`)}
          </button>
        ))}
      </div>

      {loading && <div className="si-6a429654">{t('common.loading')}</div>}

      {!loading && tab === 'dashboard' && dashboard && (
        <div>
          <div className="module-stats">
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.totalAnimals || 0}</div><div className="stat-label">{t('wellnessPortal.stats.animals')}</div></div>
            <div className="stat-card"><div className="stat-value" style={{ color: SCORE_COLORS(+dashboard.summary?.avgWellnessScore || 0) }}>{dashboard.summary?.avgWellnessScore || '-'}</div><div className="stat-label">{t('wellnessPortal.stats.avgScore')}</div></div>
            <div className="stat-card"><div className="stat-value si-4fb20e94">{dashboard.summary?.overdueReminders || 0}</div><div className="stat-label">{t('wellnessPortal.stats.overdueReminders')}</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.upcomingReminders || 0}</div><div className="stat-label">{t('wellnessPortal.stats.upcoming')}</div></div>
          </div>

          {dashboard.latestScorecards?.length > 0 && (
            <div className="si-b4c2d096">
              <h3>{t('wellnessPortal.latestScorecards')}</h3>
              <div className="si-8ebf7d50">
                {dashboard.latestScorecards.map((sc: any) => (
                  <div key={sc.id} className="module-card">
                    <div className="si-9803f8d1">
                      <h4 className="si-44087c4b">{sc.animal_name}</h4>
                      <span style={{ fontSize: 24, fontWeight: 700, color: SCORE_COLORS(+sc.overall_score) }}>{(+sc.overall_score).toFixed(0)}</span>
                    </div>
                    <div className="si-fb366e09">{speciesLabel(sc.species, t)} · {t('wellnessPortal.weight')} {sc.weight_status}</div>
                    <div className="si-319b7b12">
                      {renderScoreGauge(t('wellnessPortal.scoreLabels.nutrition'), +sc.nutrition_score, '🥩')}
                      {renderScoreGauge(t('wellnessPortal.scoreLabels.activity'), +sc.activity_score, '🏃')}
                      {renderScoreGauge(t('wellnessPortal.scoreLabels.vaccines'), +sc.vaccination_score, '💉')}
                      {renderScoreGauge(t('wellnessPortal.scoreLabels.dental'), +sc.dental_score, '🦷')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dashboard.upcomingReminders?.length > 0 && (
            <div className="module-card si-b4c2d096">
              <h3>{t('wellnessPortal.upcomingReminders')}</h3>
              {dashboard.upcomingReminders.map((r: any) => (
                <div key={r.id} className="si-dc027f42">
                  <div style={{ width: 4, height: 40, borderRadius: 2, background: PRIORITY_COLORS[r.priority] || '#3b82f6' }} />
                  <div className="si-6acd75e8">
                    <div className="si-b2cfcbec">{r.title}</div>
                    <div className="si-a3f3564c">{r.animal_name} · {t('wellnessPortal.due')} {r.due_date ? formatDate(r.due_date) : ''} · {r.reminder_type}</div>
                  </div>
                  <div className="si-9f48dfc6">
                    <button className="module-btn small si-095461d2" onClick={() => completeReminder(r.id)}>{t('wellnessPortal.completeBtn')}</button>
                    <button className="module-btn small si-fae2d7f8" onClick={() => snoozeReminder(r.id)}>{t('wellnessPortal.snoozeBtn')}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'scorecards' && (
        <div>
          <div className="si-01b12315">
            <button className="module-btn primary" onClick={() => setShowScorecardForm(true)}>{t('wellnessPortal.newScorecard')}</button>
          </div>
          {showScorecardForm && (
            <div className="module-card si-478be2e9">
              <h3>{t('wellnessPortal.createScorecard')}</h3>
              <div className="module-form">
                <div><label className="module-label">{t('wellnessPortal.labelAnimal')}</label>
                  <select className="module-input" value={scorecardForm.animalId} onChange={e => setScorecardForm(f => ({ ...f, animalId: e.target.value }))}>
                    <option value="">{t('wellnessPortal.selectAnimal')}</option>
                    {animals.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({speciesLabel(a.species, t)})</option>)}
                  </select></div>
                <div className="si-7e460960">
                  {[[t('wellnessPortal.scoreLabels.nutrition'), 'nutritionScore'], [t('wellnessPortal.scoreLabels.activity'), 'activityScore'], [t('wellnessPortal.scoreLabels.vaccines'), 'vaccinationScore'], [t('wellnessPortal.scoreLabels.dental'), 'dentalScore']].map(([label, field]) => (
                    <div key={field} className="si-42eae7d1">
                      <label className="module-label">{label} {t('wellnessPortal.scoreInputSuffix')}</label>
                      <input className="module-input" type="number" min="0" max="100"
                        value={(scorecardForm as any)[field]}
                        onChange={e => setScorecardForm(f => ({ ...f, [field]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <div className="si-c3866b40">
                  <div className="si-6acd75e8"><label className="module-label">{t('wellnessPortal.labelWeightStatus')}</label>
                    <select className="module-input" value={scorecardForm.weightStatus} onChange={e => setScorecardForm(f => ({ ...f, weightStatus: e.target.value }))}>
                      {['underweight', 'normal', 'overweight', 'obese'].map(w => <option key={w} value={w}>{w}</option>)}
                    </select></div>
                  <div className="si-6acd75e8"><label className="module-label">{t('wellnessPortal.labelNextCheckup')}</label>
                    <input className="module-input" type="date" value={scorecardForm.nextCheckup} onChange={e => setScorecardForm(f => ({ ...f, nextCheckup: e.target.value }))} /></div>
                </div>
                <div><label className="module-label">{t('wellnessPortal.labelRecommendations')}</label><input className="module-input" value={scorecardForm.recommendations} onChange={e => setScorecardForm(f => ({ ...f, recommendations: e.target.value }))} placeholder="e.g. Increase exercise, Schedule dental cleaning" /></div>
                <div><label className="module-label">{t('wellnessPortal.labelRiskFlags')}</label><input className="module-input" value={scorecardForm.riskFlags} onChange={e => setScorecardForm(f => ({ ...f, riskFlags: e.target.value }))} placeholder="e.g. Overdue vaccinations, Dental plaque" /></div>
              </div>
              <div className="si-085d7dba">
                <button className="module-btn primary" onClick={createScorecard}>{t('wellnessPortal.createScorecardBtn')}</button>
                <button className="module-btn" onClick={() => setShowScorecardForm(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          )}

          <div className="si-af8b7d7f">
            {scorecards.map(sc => (
              <div key={sc.id} className="module-card">
                <div className="si-eab13361">
                  <div>
                    <h4 className="si-44087c4b">{sc.animalName}</h4>
                    <div className="si-a3f3564c">{speciesLabel(sc.species, t)} · {sc.weightStatus}</div>
                  </div>
                </div>
                <div className="si-d4b9ebb0">
                  {renderScoreGauge(t('wellnessPortal.scoreLabels.nutrition'), +sc.nutritionScore, '🥩')}
                  {renderScoreGauge(t('wellnessPortal.scoreLabels.activity'), +sc.activityScore, '🏃')}
                  {renderScoreGauge(t('wellnessPortal.scoreLabels.vaccines'), +sc.vaccinationScore, '💉')}
                  {renderScoreGauge(t('wellnessPortal.scoreLabels.dental'), +sc.dentalScore, '🦷')}
                </div>
                {sc.recommendations?.length > 0 && (
                  <div className="si-66faea9d">{sc.recommendations.map((r: string, i: number) => <span key={i} className="module-badge si-24f24650">{r}</span>)}</div>
                )}
                {sc.riskFlags?.length > 0 && (
                  <div className="si-cbfb1eb8">{sc.riskFlags.map((f: string, i: number) => <span key={i} className="module-badge error si-a072da4e">⚠️ {f}</span>)}</div>
                )}
                {sc.nextCheckup && <div className="si-80d0addd">{t('wellnessPortal.nextCheckup')} {formatDate(sc.nextCheckup.slice(0, 10))}</div>}
              </div>
            ))}
            {scorecards.length === 0 && <p className="si-40d2db53">{t('wellnessPortal.emptyScorecards')}</p>}
          {animals.length === 0 && scorecards.length === 0 && (
            <div className="si-6574c0e8">
              <div className="si-fc4388e2">🐾</div>
              <h3 className="si-39cc04c3">{t('wellnessPortal.noAnimalsTitle')}</h3>
              <p className="si-b381c335">{t('wellnessPortal.noAnimalsHint')}</p>
              <button className="module-btn primary" onClick={() => navigate('/animals')}>+ {t('wellnessPortal.addAnimal')}</button>
            </div>
          )}
          </div>
        </div>
      )}

      {!loading && tab === 'reminders' && (
        <div>
          <div className="si-01b12315">
            <button className="module-btn primary" onClick={() => setShowReminderForm(true)}>{t('wellnessPortal.newReminder')}</button>
          </div>
          {showReminderForm && (
            <div className="module-card si-478be2e9">
              <h3>{t('wellnessPortal.createReminder')}</h3>
              <div className="module-form">
                <div className="si-c3866b40">
                  <div className="si-6acd75e8"><label className="module-label">{t('wellnessPortal.labelAnimal')}</label>
                    <select className="module-input" value={reminderForm.animalId} onChange={e => setReminderForm(f => ({ ...f, animalId: e.target.value }))}>
                      <option value="">{t('wellnessPortal.selectAnimal')}</option>
                      {animals.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({speciesLabel(a.species, t)})</option>)}
                    </select></div>
                  <div className="si-6acd75e8"><label className="module-label">{t('wellnessPortal.labelType')}</label>
                    <select className="module-input" value={reminderForm.reminderType} onChange={e => setReminderForm(f => ({ ...f, reminderType: e.target.value }))}>
                      {REMINDER_TYPES.map(rtype => <option key={rtype} value={rtype}>{rtype.replace('_', ' ')}</option>)}</select></div>
                </div>
                <div><label className="module-label">{t('wellnessPortal.labelTitle')}</label><input className="module-input" value={reminderForm.title} onChange={e => setReminderForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Annual vaccination due" /></div>
                <div><label className="module-label">{t('wellnessPortal.labelDescription')}</label><textarea className="module-input" value={reminderForm.description} onChange={e => setReminderForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div className="si-c3866b40">
                  <div className="si-6acd75e8"><label className="module-label">{t('wellnessPortal.labelDueDate')}</label><input className="module-input" type="date" value={reminderForm.dueDate} onChange={e => setReminderForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
                  <div className="si-6acd75e8"><label className="module-label">{t('wellnessPortal.labelPriority')}</label>
                    <select className="module-input" value={reminderForm.priority} onChange={e => setReminderForm(f => ({ ...f, priority: e.target.value }))}>
                      {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                  <div className="si-6acd75e8"><label className="module-label">{t('wellnessPortal.labelRecurrence')}</label>
                    <select className="module-input" value={reminderForm.recurrence} onChange={e => setReminderForm(f => ({ ...f, recurrence: e.target.value }))}>
                      <option value="">{t('wellnessPortal.recurrenceNone')}</option>
                      {['daily', 'weekly', 'monthly', 'yearly'].map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                </div>
              </div>
              <div className="si-085d7dba">
                <button className="module-btn primary" onClick={createReminder}>{t('wellnessPortal.createReminderBtn')}</button>
                <button className="module-btn" onClick={() => setShowReminderForm(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          )}

          {reminders.map(r => (
            <div key={r.id} className="si-1bc5740f">
              <div style={{ width: 4, height: 48, borderRadius: 2, background: PRIORITY_COLORS[r.priority] || '#3b82f6' }} />
              <div className="si-6acd75e8">
                <div className="si-bab2d193">
                  <span className="si-b2cfcbec">{r.title}</span>
                  <span className={`module-badge ${r.status === 'completed' ? 'success' : r.status === 'snoozed' ? 'warning' : ''}`}>{r.status}</span>
                  <span className="module-badge">{r.reminderType}</span>
                </div>
                <div className="si-d23d3f41">{r.animalName} · {t('wellnessPortal.due')} {r.dueDate ? formatDate(r.dueDate.slice(0, 10)) : ''}
                  {r.recurrence && <span className="si-7984dfbc">🔄 {r.recurrence}</span>}</div>
              </div>
              {r.status === 'pending' && (
                <div className="si-9f48dfc6">
                  <button className="module-btn small si-095461d2" onClick={() => completeReminder(r.id)}>{t('wellnessPortal.doneBtn')}</button>
                  <button className="module-btn small si-fae2d7f8" onClick={() => snoozeReminder(r.id)}>{t('wellnessPortal.snooze3d')}</button>
                </div>
              )}
            </div>
          ))}
          {reminders.length === 0 && animals.length === 0 && (
            <div className="si-6574c0e8">
              <div className="si-fc4388e2">🐾</div>
              <h3 className="si-39cc04c3">{t('wellnessPortal.noAnimalsTitle')}</h3>
              <p className="si-b381c335">{t('wellnessPortal.noAnimalsHint')}</p>
              <button className="module-btn primary" onClick={() => navigate('/animals')}>+ {t('wellnessPortal.addAnimal')}</button>
            </div>
          )}
          {reminders.length === 0 && animals.length > 0 && <p className="si-3a7b9567">{t('wellnessPortal.emptyReminders')}</p>}
        </div>
      )}
    </div>
  )
}

export default WellnessPortal
