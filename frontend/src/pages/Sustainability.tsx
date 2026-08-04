import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, SustainabilityMetric, SustainabilityGoal } from '../types'
import { useTranslation } from 'react-i18next'
import { useMasterData } from '../context/MasterDataContext'

const METRIC_TYPES = [
  { value: 'carbon_emissions', label: '🏭 Carbon Emissions', unit: 'kg CO2e' },
  { value: 'water_usage', label: '💧 Water Usage', unit: 'liters' },
  { value: 'energy_consumption', label: '⚡ Energy Consumption', unit: 'kWh' },
  { value: 'waste_generated', label: '🗑️ Waste Generated', unit: 'kg' },
  { value: 'feed_waste', label: '🌾 Feed Waste', unit: 'kg' },
  { value: 'methane_output', label: '💨 Methane Output', unit: 'kg CH4' },
  { value: 'renewable_energy_pct', label: '☀️ Renewable Energy %', unit: '%' },
  { value: 'recycling_rate', label: '♻️ Recycling Rate', unit: '%' },
]

const SCOPE_LABELS: Record<string, string> = { scope_1: 'Direct Emissions', scope_2: 'Energy Indirect', scope_3: 'Value Chain' }

const Sustainability: React.FC = () => {
  const { t } = useTranslation()
  const { speciesLabel } = useMasterData()

  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [dashboard, setDashboard] = useState<any>(null)
  const [metrics, setMetrics] = useState<SustainabilityMetric[]>([])
  const [goals, setGoals] = useState<SustainabilityGoal[]>([])
  const [carbonEst, setCarbonEst] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'dashboard' | 'metrics' | 'goals' | 'carbon'>('dashboard')
  const [showMetricForm, setShowMetricForm] = useState(false)
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [metricForm, setMetricForm] = useState({
    metricType: 'carbon_emissions', metricName: '', value: '', unit: 'kg CO2e',
    periodStart: '', periodEnd: '', category: 'general', scope: 'scope_1', notes: '',
  })
  const [goalForm, setGoalForm] = useState({
    goalName: '', description: '', metricType: 'carbon_emissions', targetValue: '',
    currentValue: '0', unit: '', baselineValue: '', targetDate: '',
  })

  useEffect(() => {
    (async () => {
      try {
        const res = await apiService.listEnterprises({ limit: 100 })
        const items = res.data?.items || []
        setEnterprises(items)
        if (items.length === 1) setSelectedEnterpriseId(items[0].id)
      } catch { setEnterprises([]) }
    })()
  }, [])

  useEffect(() => { if (selectedEnterpriseId) fetchData() }, [selectedEnterpriseId])

  const fetchData = async () => {
    if (!selectedEnterpriseId) return
    setLoading(true)
    try {
      const [dashRes, metricsRes, goalsRes] = await Promise.all([
        apiService.getSustainabilityDashboard(selectedEnterpriseId),
        apiService.listSustainabilityMetrics(selectedEnterpriseId),
        apiService.listSustainabilityGoals(selectedEnterpriseId),
      ])
      setDashboard(dashRes.data)
      setMetrics(metricsRes.data?.items || [])
      setGoals(goalsRes.data?.items || [])
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  const fetchCarbon = async () => {
    if (!selectedEnterpriseId) return
    try {
      const res = await apiService.getCarbonFootprint(selectedEnterpriseId)
      setCarbonEst(res.data)
    } catch (e: any) { setError(e.message) }
  }

  const createMetric = async () => {
    if (!metricForm.metricName || !metricForm.value) return
    try {
      await apiService.createSustainabilityMetric(selectedEnterpriseId, { ...metricForm, value: +metricForm.value })
      setShowMetricForm(false)
      setSuccessMsg(t('sustainability.metricRecorded'))
      fetchData()
    } catch (e: any) { setError(e.message) }
  }

  const createGoal = async () => {
    if (!goalForm.goalName || !goalForm.targetValue) return
    try {
      await apiService.createSustainabilityGoal(selectedEnterpriseId, {
        ...goalForm, targetValue: +goalForm.targetValue, currentValue: +goalForm.currentValue || 0,
        baselineValue: +goalForm.baselineValue || null,
      })
      setShowGoalForm(false)
      setSuccessMsg(t('sustainability.goalCreated'))
      fetchData()
    } catch (e: any) { setError(e.message) }
  }

  const getProgressColor = (pct: number) => pct >= 75 ? '#22c55e' : pct >= 50 ? '#eab308' : pct >= 25 ? '#f97316' : '#ef4444'

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>{t('sustainability.pageTitle')}</h1>
          <p className="si-f80b783e">{t('sustainability.subtitle')}</p>
        </div>
        <select className="module-input si-9d41e9d7" value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)}>
          <option value="">{t('common.selectEnterprise')}</option>
          {enterprises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {error && <div className="module-alert error">{error} <button onClick={() => setError('')}>✕</button></div>}
      {successMsg && <div className="module-alert success">{successMsg} <button onClick={() => setSuccessMsg('')}>✕</button></div>}

      <div className="module-tabs">
        {(['dashboard', 'metrics', 'goals', 'carbon'] as const).map(tb => (
          <button key={tb} className={`module-tab ${tab === tb ? 'active' : ''}`}
            onClick={() => { setTab(tb); if (tb === 'carbon') fetchCarbon() }}>
            {tb === 'dashboard' ? t('sustainability.tabs.dashboard') : tb === 'metrics' ? t('sustainability.tabs.metrics') : tb === 'goals' ? t('sustainability.tabs.goals') : t('sustainability.tabs.carbon')}
          </button>
        ))}
      </div>

      {loading && <div className="si-6a429654">{t('common.loading')}</div>}

      {!loading && tab === 'dashboard' && dashboard && (
        <div>
          <div className="module-stats">
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.totalMetricEntries || 0}</div><div className="stat-label">{t('sustainability.stats.metricEntries')}</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.metricTypes || 0}</div><div className="stat-label">{t('sustainability.stats.metricTypes')}</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.activeGoals || 0}</div><div className="stat-label">{t('sustainability.stats.activeGoals')}</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.avgGoalProgress || 0}%</div><div className="stat-label">{t('sustainability.stats.avgGoalProgress')}</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.estimatedCO2tons || '-'}</div><div className="stat-label">{t('sustainability.stats.estCO2')}</div></div>
          </div>

          {dashboard.goals?.length > 0 && (
            <div className="module-card si-b4c2d096">
              <h3>🎯 {t('sustainability.goalProgress')}</h3>
              {dashboard.goals.map((g: any) => (
                <div key={g.id} className="si-fa408354">
                  <div className="si-ab49f661">
                    <span className="si-b2cfcbec">{g.goal_name}</span>
                    <span style={{ color: getProgressColor(+g.progress_pct) }}>{(+g.progress_pct).toFixed(1)}%</span>
                  </div>
                  <div className="si-f2f31521">
                    <div style={{ height: '100%', width: `${Math.min(100, +g.progress_pct)}%`, background: getProgressColor(+g.progress_pct), borderRadius: 4, transition: 'width 0.5s' }} />
                  </div>
                  <div className="si-5e4162e0">Target: {g.target_date} · {g.metric_type}</div>
                </div>
              ))}
            </div>
          )}

          {dashboard.byMetricType?.length > 0 && (
            <div className="module-card si-b4c2d096">
              <h3>📊 {t('sustainability.metricsSummary')}</h3>
              <table className="module-table">
                <thead><tr><th>{t('sustainability.metricType')}</th><th>{t('sustainability.entries')}</th><th>{t('sustainability.total')}</th><th>{t('sustainability.average')}</th><th>{t('sustainability.unit')}</th></tr></thead>
                <tbody>{dashboard.byMetricType.map((m: any) => (
                  <tr key={m.metric_type}><td>{m.metric_type}</td><td>{m.entries}</td><td>{(+m.total_value).toFixed(1)}</td><td>{(+m.avg_value).toFixed(2)}</td><td>{m.unit || '-'}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'metrics' && (
        <div>
          <div className="si-01b12315">
            <button className="module-btn primary" onClick={() => setShowMetricForm(true)} disabled={!selectedEnterpriseId}>{t('sustainability.recordMetric')}</button>
          </div>
          {showMetricForm && (
            <div className="module-card si-478be2e9">
              <h3>{t('sustainability.recordSustainabilityMetric')}</h3>
              <div className="module-form">
                <div className="si-c3866b40">
                  <div className="si-6acd75e8"><label className="module-label">{t('sustainability.metricType')}</label>
                    <select className="module-input" value={metricForm.metricType}
                      onChange={e => { const mt = METRIC_TYPES.find(m => m.value === e.target.value); setMetricForm(f => ({ ...f, metricType: e.target.value, unit: mt?.unit || f.unit })) }}>
                      {METRIC_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div className="si-6acd75e8"><label className="module-label">{t('common.name')}</label><input className="module-input" value={metricForm.metricName} onChange={e => setMetricForm(f => ({ ...f, metricName: e.target.value }))} placeholder="e.g. Monthly CO2 from livestock" /></div>
                </div>
                <div className="si-c3866b40">
                  <div className="si-6acd75e8"><label className="module-label">{t('sustainability.value')}</label><input className="module-input" type="number" value={metricForm.value} onChange={e => setMetricForm(f => ({ ...f, value: e.target.value }))} /></div>
                  <div className="si-6acd75e8"><label className="module-label">{t('sustainability.unit')}</label><input className="module-input" value={metricForm.unit} onChange={e => setMetricForm(f => ({ ...f, unit: e.target.value }))} /></div>
                  <div className="si-6acd75e8"><label className="module-label">{t('sustainability.scope')}</label><select className="module-input" value={metricForm.scope} onChange={e => setMetricForm(f => ({ ...f, scope: e.target.value }))}>
                    {Object.entries(SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select></div>
                </div>
                <div className="si-c3866b40">
                  <div className="si-6acd75e8"><label className="module-label">{t('sustainability.periodStart')}</label><input className="module-input" type="date" value={metricForm.periodStart} onChange={e => setMetricForm(f => ({ ...f, periodStart: e.target.value }))} /></div>
                  <div className="si-6acd75e8"><label className="module-label">{t('sustainability.periodEnd')}</label><input className="module-input" type="date" value={metricForm.periodEnd} onChange={e => setMetricForm(f => ({ ...f, periodEnd: e.target.value }))} /></div>
                </div>
                <div><label className="module-label">{t('common.notes')}</label><textarea className="module-input" value={metricForm.notes} onChange={e => setMetricForm(f => ({ ...f, notes: e.target.value }))} /></div>
              </div>
              <div className="si-085d7dba">
                <button className="module-btn primary" onClick={createMetric}>{t('sustainability.saveMetric')}</button>
                <button className="module-btn" onClick={() => setShowMetricForm(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          )}
          <table className="module-table">
            <thead><tr><th>{t('common.name')}</th><th>{t('common.type')}</th><th>{t('sustainability.value')}</th><th>{t('sustainability.unit')}</th><th>{t('sustainability.scope')}</th><th>{t('sustainability.period')}</th><th>{t('common.notes')}</th></tr></thead>
            <tbody>{metrics.map(m => (
              <tr key={m.id}><td>{m.metricName}</td><td><span className="module-badge">{m.metricType}</span></td>
              <td className="si-b2cfcbec">{m.value}</td><td>{m.unit}</td><td>{SCOPE_LABELS[m.scope] || m.scope}</td>
              <td>{m.periodStart?.slice(0, 10)} → {m.periodEnd?.slice(0, 10)}</td><td>{m.notes || '-'}</td></tr>
            ))}</tbody>
          </table>
          {metrics.length === 0 && <p className="si-3a7b9567">{t('sustainability.noMetrics')}</p>}
        </div>
      )}

      {!loading && tab === 'goals' && (
        <div>
          <div className="si-01b12315">
            <button className="module-btn primary" onClick={() => setShowGoalForm(true)} disabled={!selectedEnterpriseId}>{t('sustainability.addGoal')}</button>
          </div>
          {showGoalForm && (
            <div className="module-card si-478be2e9">
              <h3>{t('sustainability.createGoal')}</h3>
              <div className="module-form">
                <div><label className="module-label">{t('sustainability.goalName')}</label><input className="module-input" value={goalForm.goalName} onChange={e => setGoalForm(f => ({ ...f, goalName: e.target.value }))} placeholder="e.g. Reduce carbon emissions 30% by 2025" /></div>
                <div><label className="module-label">{t('common.description')}</label><textarea className="module-input" value={goalForm.description} onChange={e => setGoalForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div className="si-c3866b40">
                  <div className="si-6acd75e8"><label className="module-label">{t('sustainability.metricType')}</label><select className="module-input" value={goalForm.metricType} onChange={e => setGoalForm(f => ({ ...f, metricType: e.target.value }))}>
                    {METRIC_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select></div>
                  <div className="si-6acd75e8"><label className="module-label">{t('sustainability.targetDate')}</label><input className="module-input" type="date" value={goalForm.targetDate} onChange={e => setGoalForm(f => ({ ...f, targetDate: e.target.value }))} /></div>
                </div>
                <div className="si-c3866b40">
                  <div className="si-6acd75e8"><label className="module-label">{t('sustainability.targetValue')}</label><input className="module-input" type="number" value={goalForm.targetValue} onChange={e => setGoalForm(f => ({ ...f, targetValue: e.target.value }))} /></div>
                  <div className="si-6acd75e8"><label className="module-label">{t('sustainability.baselineValue')}</label><input className="module-input" type="number" value={goalForm.baselineValue} onChange={e => setGoalForm(f => ({ ...f, baselineValue: e.target.value }))} /></div>
                  <div className="si-6acd75e8"><label className="module-label">{t('sustainability.currentValue')}</label><input className="module-input" type="number" value={goalForm.currentValue} onChange={e => setGoalForm(f => ({ ...f, currentValue: e.target.value }))} /></div>
                </div>
              </div>
              <div className="si-085d7dba">
                <button className="module-btn primary" onClick={createGoal}>{t('sustainability.createGoal')}</button>
                <button className="module-btn" onClick={() => setShowGoalForm(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          )}
          <div className="si-2140361c">
            {goals.map(g => (
              <div key={g.id} className="module-card">
                <div className="si-9803f8d1">
                  <h4 className="si-44087c4b">{g.goalName}</h4>
                  <span className={`module-badge ${g.status === 'achieved' ? 'success' : g.status === 'missed' ? 'error' : ''}`}>{g.status}</span>
                </div>
                {g.description && <p className="si-911d5ad5">{g.description}</p>}
                <div className="si-66faea9d">
                  <div className="si-5f69f7aa">
                    <span>{g.currentValue} / {g.targetValue} {g.unit}</span>
                    <span style={{ fontWeight: 600, color: getProgressColor(g.progressPct) }}>{(+g.progressPct).toFixed(1)}%</span>
                  </div>
                  <div className="si-725dcd8b">
                    <div style={{ height: '100%', width: `${Math.min(100, g.progressPct)}%`, background: `linear-gradient(90deg, ${getProgressColor(g.progressPct)}, ${getProgressColor(g.progressPct)}dd)`, borderRadius: 5, transition: 'width 0.5s' }} />
                  </div>
                </div>
                <div className="si-80d0addd">
                  Target: {g.targetDate?.slice(0, 10)} · Type: {g.metricType}
                </div>
              </div>
            ))}
            {goals.length === 0 && <p className="si-40d2db53">{t('sustainability.noGoals')}</p>}
          </div>
        </div>
      )}

      {!loading && tab === 'carbon' && (
        <div>
          {carbonEst ? (
            <div>
              <div className="module-stats">
                <div className="stat-card"><div className="stat-value">{carbonEst.totalEstimatedCO2tons}</div><div className="stat-label">{t('sustainability.stats.totalCO2')}</div></div>
                <div className="stat-card"><div className="stat-value">{carbonEst.estimates?.length || 0}</div><div className="stat-label">{t('sustainability.stats.speciesGroups')}</div></div>
              </div>
              <div className="module-card si-b4c2d096">
                <h3>{t('sustainability.carbonBySpecies')}</h3>
                <table className="module-table">
                  <thead><tr><th>{t('sustainability.species')}</th><th>{t('sustainability.headCount')}</th><th>{t('sustainability.emissionFactor')}</th><th>{t('sustainability.annualCO2kg')}</th><th>{t('sustainability.annualCO2tons')}</th></tr></thead>
                  <tbody>{carbonEst.estimates?.map((e: any) => (
                    <tr key={e.species}><td className="si-b2cfcbec">{speciesLabel(e.species, t)}</td><td>{e.count}</td><td>{e.emissionFactor} kg CO₂e/head/yr</td>
                    <td>{Number(e.annualCO2kg ?? 0).toLocaleString()}</td><td>{(Number(e.annualCO2kg ?? 0) / 1000).toFixed(2)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="si-84e4de13">
                ℹ️ {carbonEst.methodology}
              </div>
            </div>
          ) : (
            <div className="si-86638a30">
              <p className="si-40d2db53">{selectedEnterpriseId ? t('sustainability.calculatingCarbon') : t('sustainability.selectForCarbon')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Sustainability
