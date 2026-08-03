import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, DigitalTwin, SimulationRun } from '../types'
import { useTranslation } from 'react-i18next'

const SCENARIO_TYPES = [
  { value: 'disease_spread', label: '🦠 Disease Spread', desc: 'Model pathogen transmission through animal populations' },
  { value: 'resource_optimization', label: '⚙️ Resource Optimization', desc: 'Optimize workforce and feed allocation' },
  { value: 'financial_forecast', label: '💰 Financial Forecast', desc: 'Project revenue, costs and profitability' },
  { value: 'capacity_planning', label: '📊 Capacity Planning', desc: 'Plan facility expansion and growth' },
]

const TWIN_TYPES = ['farm', 'herd', 'facility', 'supply_chain']

const DigitalTwinPage: React.FC = () => {
  const { t } = useTranslation()

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
      setSuccessMsg(t('digitalTwin.twinCreated'))
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
      setSuccessMsg(t('digitalTwin.simulationCompleted'))
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
    if (!dashboard) return <p className="si-380a494b">{t('digitalTwin.selectForDashboard')}</p>
    return (
      <div>
        <div className="module-stats">
          <div className="stat-card"><div className="stat-value">{dashboard.summary?.totalTwins || 0}</div><div className="stat-label">{t('digitalTwin.stats.digitalTwins')}</div></div>
          <div className="stat-card"><div className="stat-value">{dashboard.summary?.totalSimulations || 0}</div><div className="stat-label">{t('digitalTwin.stats.simulationsRun')}</div></div>
          <div className="stat-card"><div className="stat-value">{dashboard.byScenarioType?.length || 0}</div><div className="stat-label">{t('digitalTwin.stats.scenarioTypes')}</div></div>
        </div>
        {dashboard.recentSimulations?.length > 0 && (
          <div className="module-card si-b4c2d096">
            <h3>{t('digitalTwin.recentSimulations')}</h3>
            <table className="module-table">
              <thead><tr><th>{t('common.name')}</th><th>{t('digitalTwin.twin')}</th><th>{t('digitalTwin.scenario')}</th><th>{t('common.status')}</th><th>{t('digitalTwin.duration')}</th><th>{t('common.actions')}</th></tr></thead>
              <tbody>{dashboard.recentSimulations.map((s: any) => (
                <tr key={s.id}>
                  <td>{s.name}</td><td>{s.twin_name}</td><td><span className="module-badge">{s.scenario_type}</span></td>
                  <td><span className="module-badge success">{s.status}</span></td><td>{s.duration_ms}ms</td>
                  <td><button className="module-btn small" onClick={() => viewSimResult(s)}>{t('common.view')}</button></td>
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
      <div className="si-0f14bb0a">
        <label className="module-label">{label}</label>
        <input className="module-input" type={type} value={(simForm as any)[field]}
          onChange={e => setSimForm(f => ({ ...f, [field]: e.target.value }))} />
      </div>
    )
    return (
      <div className="si-7e460960">
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
          <h1>{t('digitalTwin.pageTitle')}</h1>
          <p className="si-f80b783e">{t('digitalTwin.subtitle')}</p>
        </div>
        <select className="module-input si-9d41e9d7" value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)}>
          <option value="">{t('common.selectEnterprise')}</option>
          {enterprises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {error && <div className="module-alert error">{error} <button onClick={() => setError('')}>✕</button></div>}
      {successMsg && <div className="module-alert success">{successMsg} <button onClick={() => setSuccessMsg('')}>✕</button></div>}

      <div className="module-tabs">
        {(['dashboard', 'twins', 'simulate'] as const).map(tb => (
          <button key={tb} className={`module-tab ${tab === tb ? 'active' : ''}`} onClick={() => setTab(tb)}>
            {tb === 'dashboard' ? t('digitalTwin.tabs.dashboard') : tb === 'twins' ? t('digitalTwin.tabs.twins') : t('digitalTwin.tabs.simulate')}
          </button>
        ))}
      </div>

      {loading && <div className="si-6a429654">{t('common.loading')}</div>}

      {!loading && tab === 'dashboard' && renderDashboard()}

      {!loading && tab === 'twins' && (
        <div>
          <div className="si-01b12315">
            <button className="module-btn primary" onClick={() => setShowCreateTwin(true)} disabled={!selectedEnterpriseId}>{t('digitalTwin.createTwin')}</button>
          </div>
          {showCreateTwin && (
            <div className="module-card si-7e63ec4f">
              <h3>{t('digitalTwin.createDigitalTwin')}</h3>
              <div className="module-form">
                <div><label className="module-label">{t('common.name')}</label><input className="module-input" value={twinForm.name} onChange={e => setTwinForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><label className="module-label">{t('common.type')}</label><select className="module-input" value={twinForm.twinType} onChange={e => setTwinForm(f => ({ ...f, twinType: e.target.value }))}>{TWIN_TYPES.map(tt => <option key={tt} value={tt}>{tt}</option>)}</select></div>
                <div><label className="module-label">{t('common.description')}</label><textarea className="module-input" value={twinForm.description} onChange={e => setTwinForm(f => ({ ...f, description: e.target.value }))} /></div>
              </div>
              <div className="si-085d7dba">
                <button className="module-btn primary" onClick={createTwin}>{t('digitalTwin.create')}</button>
                <button className="module-btn" onClick={() => setShowCreateTwin(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          )}
          <div className="si-8ebf7d50">
            {twins.map(t => (
              <div key={t.id} className="module-card">
                <div className="si-9803f8d1">
                  <h4 className="si-44087c4b">{t.name}</h4>
                  <span className="module-badge">{t.twinType}</span>
                </div>
                {t.description && <p className="si-911d5ad5">{t.description}</p>}
                <div className="si-a3f3564c">Created: {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'}</div>
              </div>
            ))}
            {twins.length === 0 && <p className="si-40d2db53">{t('digitalTwin.noTwins')}</p>}
          </div>
        </div>
      )}

      {!loading && tab === 'simulate' && (
        <div>
          <div className="si-01b12315">
            <button className="module-btn primary" onClick={() => setShowSimForm(true)} disabled={twins.length === 0}>{t('digitalTwin.newSimulation')}</button>
          </div>
          {showSimForm && (
            <div className="module-card si-af65fe13">
              <h3>{t('digitalTwin.runSimulation')}</h3>
              <div className="module-form">
                <div className="si-c3866b40">
                  <div className="si-6acd75e8"><label className="module-label">{t('common.name')}</label><input className="module-input" value={simForm.name} onChange={e => setSimForm(f => ({ ...f, name: e.target.value }))} placeholder="Simulation name" /></div>
                  <div className="si-6acd75e8"><label className="module-label">{t('digitalTwin.twin')}</label><select className="module-input" value={simForm.twinId} onChange={e => setSimForm(f => ({ ...f, twinId: e.target.value }))}><option value="">{t('digitalTwin.selectTwin')}</option>{twins.map(tw => <option key={tw.id} value={tw.id}>{tw.name}</option>)}</select></div>
                </div>
                <div><label className="module-label">{t('digitalTwin.scenarioType')}</label>
                  <div className="si-8193f804">
                    {SCENARIO_TYPES.map(s => (
                      <div key={s.value} onClick={() => setSimForm(f => ({ ...f, scenarioType: s.value }))}
                        style={{ padding: 16, borderRadius: 8, border: `2px solid ${simForm.scenarioType === s.value ? '#667eea' : '#eee'}`,
                          cursor: 'pointer', background: simForm.scenarioType === s.value ? '#667eea08' : 'white' }}>
                        <div className="si-b2cfcbec">{s.label}</div>
                        <div className="si-a3f3564c">{s.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="si-b0aee75b"><label className="module-label">{t('digitalTwin.parameters')}</label>{renderSimParams()}</div>
              </div>
              <div className="si-085d7dba">
                <button className="module-btn primary" onClick={runSimulation}>▸ {t('digitalTwin.runSimulation')}</button>
                <button className="module-btn" onClick={() => setShowSimForm(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          )}

          {selectedSimulation && (
            <div className="module-card si-af65fe13">
              <div className="si-101fd1d0">
                <h3 className="si-44087c4b">Results: {selectedSimulation.name}</h3>
                <button className="module-btn small" onClick={() => setSelectedSimulation(null)}>{t('common.close')}</button>
              </div>
              <div className="module-stats">
                {Object.entries(selectedSimulation.outcomeSummary || selectedSimulation.resultData?.summary || {}).map(([k, v]) => (
                  <div key={k} className="stat-card"><div className="stat-value">{String(v)}</div><div className="stat-label">{k.replace(/([A-Z])/g, ' $1')}</div></div>
                ))}
              </div>
              {selectedSimulation.resultData?.rows && selectedSimulation.resultData.rows.length > 0 && (
                <div className="si-dc2fd41f">
                  <table className="module-table">
                    <thead><tr>{Object.keys(selectedSimulation.resultData.rows[0]).map(k => <th key={k}>{k}</th>)}</tr></thead>
                    <tbody>{selectedSimulation.resultData.rows.slice(0, 30).map((row: any, i: number) => (
                      <tr key={i}>{Object.values(row).map((v, j) => <td key={j}>{String(v)}</td>)}</tr>
                    ))}</tbody>
                  </table>
                  {selectedSimulation.resultData.rows.length > 30 && <p className="si-380a494b">Showing 30 of {selectedSimulation.resultData.rows.length} rows</p>}
                </div>
              )}
            </div>
          )}

          <table className="module-table">
            <thead><tr><th>{t('common.name')}</th><th>{t('digitalTwin.twin')}</th><th>{t('digitalTwin.scenario')}</th><th>{t('common.status')}</th><th>{t('digitalTwin.duration')}</th><th>{t('common.date')}</th><th>{t('common.actions')}</th></tr></thead>
            <tbody>
              {simulations.map(s => (
                <tr key={s.id}><td>{s.name}</td><td>{s.twinName}</td><td><span className="module-badge">{s.scenarioType}</span></td>
                <td><span className="module-badge success">{s.status}</span></td><td>{s.durationMs}ms</td>
                <td>{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '-'}</td>
                <td><button className="module-btn small" onClick={() => viewSimResult(s)}>{t('common.view')}</button></td></tr>
              ))}
            </tbody>
          </table>
          {simulations.length === 0 && <p className="si-3a7b9567">{t('digitalTwin.noSimulations')}</p>}
        </div>
      )}
    </div>
  )
}

export default DigitalTwinPage
