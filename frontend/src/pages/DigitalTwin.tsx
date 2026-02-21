import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, DigitalTwin, SimulationRun } from '../types'

const SCENARIO_TYPES = [
  { value: 'disease_spread', label: '🦠 Disease Spread', desc: 'Model pathogen transmission through animal populations' },
  { value: 'resource_optimization', label: '⚙️ Resource Optimization', desc: 'Optimize workforce and feed allocation' },
  { value: 'financial_forecast', label: '💰 Financial Forecast', desc: 'Project revenue, costs and profitability' },
  { value: 'capacity_planning', label: '📊 Capacity Planning', desc: 'Plan facility expansion and growth' },
]

const TWIN_TYPES = ['farm', 'herd', 'facility', 'supply_chain']

const DigitalTwinPage: React.FC = () => {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [twins, setTwins] = useState<DigitalTwin[]>([])
  const [simulations, setSimulations] = useState<SimulationRun[]>([])
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'dashboard' | 'twins' | 'simulate'>('dashboard')
  const [showCreateTwin, setShowCreateTwin] = useState(false)
  const [showSimForm, setShowSimForm] = useState(false)
  const [selectedSimulation, setSelectedSimulation] = useState<SimulationRun | null>(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [twinForm, setTwinForm] = useState({ name: '', twinType: 'farm', description: '' })
  const [simForm, setSimForm] = useState({
    twinId: '', name: '', scenarioType: 'disease_spread',
    infectionRate: '0.15', vaccinationRate: '0', simulationDays: '30', initialInfected: '1',
    workers: '10', animals: '500', feedBudgetPerDay: '1000',
    monthlyRevenue: '50000', monthlyCost: '35000', growthRate: '0.02', months: '12',
    currentAnimals: '200', maxCapacity: '500', growthPerMonth: '15',
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

  useEffect(() => {
    if (selectedEnterpriseId) fetchData()
  }, [selectedEnterpriseId])

  const fetchData = async () => {
    if (!selectedEnterpriseId) return
    setLoading(true)
    try {
      const [dashRes, twinsRes, simsRes] = await Promise.all([
        apiService.getDigitalTwinDashboard(selectedEnterpriseId),
        apiService.listDigitalTwins(selectedEnterpriseId),
        apiService.listSimulations(selectedEnterpriseId),
      ])
      setDashboard(dashRes.data)
      setTwins(twinsRes.data?.items || [])
      setSimulations(simsRes.data?.items || [])
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  const createTwin = async () => {
    try {
      await apiService.createDigitalTwin(selectedEnterpriseId, twinForm)
      setShowCreateTwin(false)
      setTwinForm({ name: '', twinType: 'farm', description: '' })
      setSuccessMsg('Digital twin created!')
      fetchData()
    } catch (e: any) { setError(e.message) }
  }

  const runSimulation = async () => {
    if (!simForm.twinId || !simForm.name) return
    const params: Record<string, any> = {}
    const st = simForm.scenarioType

    if (st === 'disease_spread') Object.assign(params, { infectionRate: +simForm.infectionRate, vaccinationRate: +simForm.vaccinationRate, simulationDays: +simForm.simulationDays, initialInfected: +simForm.initialInfected })
    else if (st === 'resource_optimization') Object.assign(params, { workers: +simForm.workers, animals: +simForm.animals, feedBudgetPerDay: +simForm.feedBudgetPerDay })
    else if (st === 'financial_forecast') Object.assign(params, { monthlyRevenue: +simForm.monthlyRevenue, monthlyCost: +simForm.monthlyCost, growthRate: +simForm.growthRate, months: +simForm.months })
    else if (st === 'capacity_planning') Object.assign(params, { currentAnimals: +simForm.currentAnimals, maxCapacity: +simForm.maxCapacity, growthPerMonth: +simForm.growthPerMonth, months: +simForm.months })

    try {
      const res = await apiService.runSimulation(selectedEnterpriseId, { twinId: simForm.twinId, name: simForm.name, scenarioType: st, parameters: params })
      setSelectedSimulation(res.data)
      setShowSimForm(false)
      setSuccessMsg('Simulation completed!')
      fetchData()
    } catch (e: any) { setError(e.message) }
  }

  const viewSimResult = async (sim: SimulationRun) => {
    try {
      const res = await apiService.getSimulation(sim.id)
      setSelectedSimulation(res.data)
    } catch (e: any) { setError(e.message) }
  }

  const renderDashboard = () => {
    if (!dashboard) return <p style={{ color: '#888', textAlign: 'center' }}>Select an enterprise to view dashboard</p>
    return (
      <div>
        <div className="module-stats">
          <div className="stat-card"><div className="stat-value">{dashboard.summary?.totalTwins || 0}</div><div className="stat-label">Digital Twins</div></div>
          <div className="stat-card"><div className="stat-value">{dashboard.summary?.totalSimulations || 0}</div><div className="stat-label">Simulations Run</div></div>
          <div className="stat-card"><div className="stat-value">{dashboard.byScenarioType?.length || 0}</div><div className="stat-label">Scenario Types Used</div></div>
        </div>
        {dashboard.recentSimulations?.length > 0 && (
          <div className="module-card" style={{ marginTop: 24 }}>
            <h3>Recent Simulations</h3>
            <table className="module-table">
              <thead><tr><th>Name</th><th>Twin</th><th>Scenario</th><th>Status</th><th>Duration</th><th>Actions</th></tr></thead>
              <tbody>{dashboard.recentSimulations.map((s: any) => (
                <tr key={s.id}>
                  <td>{s.name}</td><td>{s.twin_name}</td><td><span className="module-badge">{s.scenario_type}</span></td>
                  <td><span className="module-badge success">{s.status}</span></td><td>{s.duration_ms}ms</td>
                  <td><button className="module-btn small" onClick={() => viewSimResult(s)}>View</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  const renderSimParams = () => {
    const st = simForm.scenarioType
    const inp = (label: string, field: string, type = 'number') => (
      <div style={{ flex: 1, minWidth: 180 }}>
        <label className="module-label">{label}</label>
        <input className="module-input" type={type} value={(simForm as any)[field]}
          onChange={e => setSimForm(f => ({ ...f, [field]: e.target.value }))} />
      </div>
    )
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {st === 'disease_spread' && <>{inp('Infection Rate', 'infectionRate')}{inp('Vaccination Rate', 'vaccinationRate')}{inp('Days', 'simulationDays')}{inp('Initial Infected', 'initialInfected')}</>}
        {st === 'resource_optimization' && <>{inp('Workers', 'workers')}{inp('Animals', 'animals')}{inp('Feed Budget/Day', 'feedBudgetPerDay')}</>}
        {st === 'financial_forecast' && <>{inp('Monthly Revenue', 'monthlyRevenue')}{inp('Monthly Cost', 'monthlyCost')}{inp('Growth Rate', 'growthRate')}{inp('Months', 'months')}</>}
        {st === 'capacity_planning' && <>{inp('Current Animals', 'currentAnimals')}{inp('Max Capacity', 'maxCapacity')}{inp('Growth/Month', 'growthPerMonth')}{inp('Months', 'months')}</>}
      </div>
    )
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>🔮 Digital Twin & Simulator</h1>
          <p style={{ color: '#666', margin: '8px 0 0' }}>Virtual farm models with scenario simulation and predictive analysis</p>
        </div>
        <select className="module-input" value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)} style={{ width: 260 }}>
          <option value="">Select Enterprise</option>
          {enterprises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {error && <div className="module-alert error">{error} <button onClick={() => setError('')}>✕</button></div>}
      {successMsg && <div className="module-alert success">{successMsg} <button onClick={() => setSuccessMsg('')}>✕</button></div>}

      <div className="module-tabs">
        {(['dashboard', 'twins', 'simulate'] as const).map(t => (
          <button key={t} className={`module-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'dashboard' ? '📊 Dashboard' : t === 'twins' ? '🏗️ Digital Twins' : '🧪 Simulate'}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading...</div>}

      {!loading && tab === 'dashboard' && renderDashboard()}

      {!loading && tab === 'twins' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="module-btn primary" onClick={() => setShowCreateTwin(true)} disabled={!selectedEnterpriseId}>+ Create Twin</button>
          </div>
          {showCreateTwin && (
            <div className="module-card" style={{ marginBottom: 16 }}>
              <h3>Create Digital Twin</h3>
              <div className="module-form">
                <div><label className="module-label">Name</label><input className="module-input" value={twinForm.name} onChange={e => setTwinForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><label className="module-label">Type</label><select className="module-input" value={twinForm.twinType} onChange={e => setTwinForm(f => ({ ...f, twinType: e.target.value }))}>{TWIN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="module-label">Description</label><textarea className="module-input" value={twinForm.description} onChange={e => setTwinForm(f => ({ ...f, description: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="module-btn primary" onClick={createTwin}>Create</button>
                <button className="module-btn" onClick={() => setShowCreateTwin(false)}>Cancel</button>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {twins.map(t => (
              <div key={t.id} className="module-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0 }}>{t.name}</h4>
                  <span className="module-badge">{t.twinType}</span>
                </div>
                {t.description && <p style={{ color: '#666', fontSize: 14, margin: '8px 0' }}>{t.description}</p>}
                <div style={{ fontSize: 12, color: '#888' }}>Created: {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '–'}</div>
              </div>
            ))}
            {twins.length === 0 && <p style={{ color: '#888' }}>No digital twins yet</p>}
          </div>
        </div>
      )}

      {!loading && tab === 'simulate' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="module-btn primary" onClick={() => setShowSimForm(true)} disabled={twins.length === 0}>+ New Simulation</button>
          </div>
          {showSimForm && (
            <div className="module-card" style={{ marginBottom: 24 }}>
              <h3>Run Simulation</h3>
              <div className="module-form">
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}><label className="module-label">Name</label><input className="module-input" value={simForm.name} onChange={e => setSimForm(f => ({ ...f, name: e.target.value }))} placeholder="Simulation name" /></div>
                  <div style={{ flex: 1 }}><label className="module-label">Digital Twin</label><select className="module-input" value={simForm.twinId} onChange={e => setSimForm(f => ({ ...f, twinId: e.target.value }))}><option value="">Select twin...</option>{twins.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                </div>
                <div><label className="module-label">Scenario Type</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                    {SCENARIO_TYPES.map(s => (
                      <div key={s.value} onClick={() => setSimForm(f => ({ ...f, scenarioType: s.value }))}
                        style={{ padding: 16, borderRadius: 8, border: `2px solid ${simForm.scenarioType === s.value ? '#667eea' : '#eee'}`,
                          cursor: 'pointer', background: simForm.scenarioType === s.value ? '#667eea08' : 'white' }}>
                        <div style={{ fontWeight: 600 }}>{s.label}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>{s.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: 16 }}><label className="module-label">Parameters</label>{renderSimParams()}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="module-btn primary" onClick={runSimulation}>▸ Run Simulation</button>
                <button className="module-btn" onClick={() => setShowSimForm(false)}>Cancel</button>
              </div>
            </div>
          )}

          {selectedSimulation && (
            <div className="module-card" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>Results: {selectedSimulation.name}</h3>
                <button className="module-btn small" onClick={() => setSelectedSimulation(null)}>Close</button>
              </div>
              <div className="module-stats">
                {Object.entries(selectedSimulation.outcomeSummary || selectedSimulation.resultData?.summary || {}).map(([k, v]) => (
                  <div key={k} className="stat-card"><div className="stat-value">{String(v)}</div><div className="stat-label">{k.replace(/([A-Z])/g, ' $1')}</div></div>
                ))}
              </div>
              {selectedSimulation.resultData?.rows && selectedSimulation.resultData.rows.length > 0 && (
                <div style={{ marginTop: 16, maxHeight: 300, overflow: 'auto' }}>
                  <table className="module-table">
                    <thead><tr>{Object.keys(selectedSimulation.resultData.rows[0]).map(k => <th key={k}>{k}</th>)}</tr></thead>
                    <tbody>{selectedSimulation.resultData.rows.slice(0, 30).map((row: any, i: number) => (
                      <tr key={i}>{Object.values(row).map((v, j) => <td key={j}>{String(v)}</td>)}</tr>
                    ))}</tbody>
                  </table>
                  {selectedSimulation.resultData.rows.length > 30 && <p style={{ textAlign: 'center', color: '#888' }}>Showing 30 of {selectedSimulation.resultData.rows.length} rows</p>}
                </div>
              )}
            </div>
          )}

          <table className="module-table">
            <thead><tr><th>Name</th><th>Twin</th><th>Scenario</th><th>Status</th><th>Duration</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {simulations.map(s => (
                <tr key={s.id}><td>{s.name}</td><td>{s.twinName}</td><td><span className="module-badge">{s.scenarioType}</span></td>
                <td><span className="module-badge success">{s.status}</span></td><td>{s.durationMs}ms</td>
                <td>{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '–'}</td>
                <td><button className="module-btn small" onClick={() => viewSimResult(s)}>View</button></td></tr>
              ))}
            </tbody>
          </table>
          {simulations.length === 0 && <p style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>No simulations yet. Create a digital twin first, then run simulations.</p>}
        </div>
      )}
    </div>
  )
}

export default DigitalTwinPage
