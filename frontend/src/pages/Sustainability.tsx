import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, SustainabilityMetric, SustainabilityGoal } from '../types'

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
      setSuccessMsg('Metric recorded!')
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
      setSuccessMsg('Goal created!')
      fetchData()
    } catch (e: any) { setError(e.message) }
  }

  const getProgressColor = (pct: number) => pct >= 75 ? '#22c55e' : pct >= 50 ? '#eab308' : pct >= 25 ? '#f97316' : '#ef4444'

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>🌱 Sustainability & Carbon</h1>
          <p style={{ color: '#666', margin: '8px 0 0' }}>ESG scoring, carbon footprint tracking, and sustainability goal management</p>
        </div>
        <select className="module-input" value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)} style={{ width: 260 }}>
          <option value="">Select Enterprise</option>
          {enterprises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {error && <div className="module-alert error">{error} <button onClick={() => setError('')}>✕</button></div>}
      {successMsg && <div className="module-alert success">{successMsg} <button onClick={() => setSuccessMsg('')}>✕</button></div>}

      <div className="module-tabs">
        {(['dashboard', 'metrics', 'goals', 'carbon'] as const).map(t => (
          <button key={t} className={`module-tab ${tab === t ? 'active' : ''}`}
            onClick={() => { setTab(t); if (t === 'carbon') fetchCarbon() }}>
            {t === 'dashboard' ? '📊 Dashboard' : t === 'metrics' ? '📈 Metrics' : t === 'goals' ? '🎯 Goals' : '🌍 Carbon Footprint'}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading...</div>}

      {!loading && tab === 'dashboard' && dashboard && (
        <div>
          <div className="module-stats">
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.totalMetricEntries || 0}</div><div className="stat-label">Metric Entries</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.metricTypes || 0}</div><div className="stat-label">Metric Types</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.activeGoals || 0}</div><div className="stat-label">Active Goals</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.avgGoalProgress || 0}%</div><div className="stat-label">Avg Goal Progress</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.estimatedCO2tons || '—'}</div><div className="stat-label">Est. CO₂ (tons/yr)</div></div>
          </div>

          {dashboard.goals?.length > 0 && (
            <div className="module-card" style={{ marginTop: 24 }}>
              <h3>🎯 Goal Progress</h3>
              {dashboard.goals.map((g: any) => (
                <div key={g.id} style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>{g.goal_name}</span>
                    <span style={{ color: getProgressColor(+g.progress_pct) }}>{(+g.progress_pct).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, +g.progress_pct)}%`, background: getProgressColor(+g.progress_pct), borderRadius: 4, transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Target: {g.target_date} · {g.metric_type}</div>
                </div>
              ))}
            </div>
          )}

          {dashboard.byMetricType?.length > 0 && (
            <div className="module-card" style={{ marginTop: 24 }}>
              <h3>📊 Metrics Summary</h3>
              <table className="module-table">
                <thead><tr><th>Metric Type</th><th>Entries</th><th>Total</th><th>Average</th><th>Unit</th></tr></thead>
                <tbody>{dashboard.byMetricType.map((m: any) => (
                  <tr key={m.metric_type}><td>{m.metric_type}</td><td>{m.entries}</td><td>{(+m.total_value).toFixed(1)}</td><td>{(+m.avg_value).toFixed(2)}</td><td>{m.unit || '—'}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'metrics' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="module-btn primary" onClick={() => setShowMetricForm(true)} disabled={!selectedEnterpriseId}>+ Record Metric</button>
          </div>
          {showMetricForm && (
            <div className="module-card" style={{ marginBottom: 20 }}>
              <h3>Record Sustainability Metric</h3>
              <div className="module-form">
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}><label className="module-label">Metric Type</label>
                    <select className="module-input" value={metricForm.metricType}
                      onChange={e => { const mt = METRIC_TYPES.find(m => m.value === e.target.value); setMetricForm(f => ({ ...f, metricType: e.target.value, unit: mt?.unit || f.unit })) }}>
                      {METRIC_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}><label className="module-label">Name</label><input className="module-input" value={metricForm.metricName} onChange={e => setMetricForm(f => ({ ...f, metricName: e.target.value }))} placeholder="e.g. Monthly CO2 from livestock" /></div>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}><label className="module-label">Value</label><input className="module-input" type="number" value={metricForm.value} onChange={e => setMetricForm(f => ({ ...f, value: e.target.value }))} /></div>
                  <div style={{ flex: 1 }}><label className="module-label">Unit</label><input className="module-input" value={metricForm.unit} onChange={e => setMetricForm(f => ({ ...f, unit: e.target.value }))} /></div>
                  <div style={{ flex: 1 }}><label className="module-label">Scope</label><select className="module-input" value={metricForm.scope} onChange={e => setMetricForm(f => ({ ...f, scope: e.target.value }))}>
                    {Object.entries(SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select></div>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}><label className="module-label">Period Start</label><input className="module-input" type="date" value={metricForm.periodStart} onChange={e => setMetricForm(f => ({ ...f, periodStart: e.target.value }))} /></div>
                  <div style={{ flex: 1 }}><label className="module-label">Period End</label><input className="module-input" type="date" value={metricForm.periodEnd} onChange={e => setMetricForm(f => ({ ...f, periodEnd: e.target.value }))} /></div>
                </div>
                <div><label className="module-label">Notes</label><textarea className="module-input" value={metricForm.notes} onChange={e => setMetricForm(f => ({ ...f, notes: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="module-btn primary" onClick={createMetric}>Save Metric</button>
                <button className="module-btn" onClick={() => setShowMetricForm(false)}>Cancel</button>
              </div>
            </div>
          )}
          <table className="module-table">
            <thead><tr><th>Name</th><th>Type</th><th>Value</th><th>Unit</th><th>Scope</th><th>Period</th><th>Notes</th></tr></thead>
            <tbody>{metrics.map(m => (
              <tr key={m.id}><td>{m.metricName}</td><td><span className="module-badge">{m.metricType}</span></td>
              <td style={{ fontWeight: 600 }}>{m.value}</td><td>{m.unit}</td><td>{SCOPE_LABELS[m.scope] || m.scope}</td>
              <td>{m.periodStart?.slice(0, 10)} → {m.periodEnd?.slice(0, 10)}</td><td>{m.notes || '—'}</td></tr>
            ))}</tbody>
          </table>
          {metrics.length === 0 && <p style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>No metrics recorded yet</p>}
        </div>
      )}

      {!loading && tab === 'goals' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="module-btn primary" onClick={() => setShowGoalForm(true)} disabled={!selectedEnterpriseId}>+ Add Goal</button>
          </div>
          {showGoalForm && (
            <div className="module-card" style={{ marginBottom: 20 }}>
              <h3>Create Sustainability Goal</h3>
              <div className="module-form">
                <div><label className="module-label">Goal Name</label><input className="module-input" value={goalForm.goalName} onChange={e => setGoalForm(f => ({ ...f, goalName: e.target.value }))} placeholder="e.g. Reduce carbon emissions 30% by 2025" /></div>
                <div><label className="module-label">Description</label><textarea className="module-input" value={goalForm.description} onChange={e => setGoalForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}><label className="module-label">Metric Type</label><select className="module-input" value={goalForm.metricType} onChange={e => setGoalForm(f => ({ ...f, metricType: e.target.value }))}>
                    {METRIC_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select></div>
                  <div style={{ flex: 1 }}><label className="module-label">Target Date</label><input className="module-input" type="date" value={goalForm.targetDate} onChange={e => setGoalForm(f => ({ ...f, targetDate: e.target.value }))} /></div>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}><label className="module-label">Target Value</label><input className="module-input" type="number" value={goalForm.targetValue} onChange={e => setGoalForm(f => ({ ...f, targetValue: e.target.value }))} /></div>
                  <div style={{ flex: 1 }}><label className="module-label">Baseline Value</label><input className="module-input" type="number" value={goalForm.baselineValue} onChange={e => setGoalForm(f => ({ ...f, baselineValue: e.target.value }))} /></div>
                  <div style={{ flex: 1 }}><label className="module-label">Current Value</label><input className="module-input" type="number" value={goalForm.currentValue} onChange={e => setGoalForm(f => ({ ...f, currentValue: e.target.value }))} /></div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="module-btn primary" onClick={createGoal}>Create Goal</button>
                <button className="module-btn" onClick={() => setShowGoalForm(false)}>Cancel</button>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
            {goals.map(g => (
              <div key={g.id} className="module-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0 }}>{g.goalName}</h4>
                  <span className={`module-badge ${g.status === 'achieved' ? 'success' : g.status === 'missed' ? 'error' : ''}`}>{g.status}</span>
                </div>
                {g.description && <p style={{ color: '#666', fontSize: 14, margin: '8px 0' }}>{g.description}</p>}
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>{g.currentValue} / {g.targetValue} {g.unit}</span>
                    <span style={{ fontWeight: 600, color: getProgressColor(g.progressPct) }}>{(+g.progressPct).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 10, background: '#e5e7eb', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, g.progressPct)}%`, background: `linear-gradient(90deg, ${getProgressColor(g.progressPct)}, ${getProgressColor(g.progressPct)}dd)`, borderRadius: 5, transition: 'width 0.5s' }} />
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
                  Target: {g.targetDate?.slice(0, 10)} · Type: {g.metricType}
                </div>
              </div>
            ))}
            {goals.length === 0 && <p style={{ color: '#888' }}>No goals set yet</p>}
          </div>
        </div>
      )}

      {!loading && tab === 'carbon' && (
        <div>
          {carbonEst ? (
            <div>
              <div className="module-stats">
                <div className="stat-card"><div className="stat-value">{carbonEst.totalEstimatedCO2tons}</div><div className="stat-label">Total CO₂ (tons/yr)</div></div>
                <div className="stat-card"><div className="stat-value">{carbonEst.estimates?.length || 0}</div><div className="stat-label">Species Groups</div></div>
              </div>
              <div className="module-card" style={{ marginTop: 24 }}>
                <h3>Carbon Emissions by Species</h3>
                <table className="module-table">
                  <thead><tr><th>Species</th><th>Head Count</th><th>Emission Factor</th><th>Annual CO₂ (kg)</th><th>Annual CO₂ (tons)</th></tr></thead>
                  <tbody>{carbonEst.estimates?.map((e: any) => (
                    <tr key={e.species}><td style={{ fontWeight: 600 }}>{e.species}</td><td>{e.count}</td><td>{e.emissionFactor} kg CO₂e/head/yr</td>
                    <td>{e.annualCO2kg.toLocaleString()}</td><td>{(e.annualCO2kg / 1000).toFixed(2)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
              <div style={{ padding: 16, borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', marginTop: 16, fontSize: 13, color: '#1e40af' }}>
                ℹ️ {carbonEst.methodology}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ color: '#888' }}>{selectedEnterpriseId ? 'Calculating carbon footprint...' : 'Select an enterprise to view carbon footprint'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Sustainability
