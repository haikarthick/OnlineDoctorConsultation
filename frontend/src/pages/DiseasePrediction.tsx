import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { useScrollToForm } from '../hooks/useScrollToForm'
import { Enterprise, DiseasePrediction, OutbreakZone, RiskDashboard } from '../types'
import MapView from '../components/MapView'
import { useTranslation } from 'react-i18next'
import { useMasterData } from '../context/MasterDataContext'

const SEVERITY_COLORS: Record<string, string> = {
  low: '#22c55e', medium: '#eab308', high: '#f97316', critical: '#ef4444'
}

const DiseasePredictionPage: React.FC = () => {
  const { t } = useTranslation()
  const { speciesLabel } = useMasterData()

  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [dashboard, setDashboard] = useState<RiskDashboard | null>(null)
  const [predictions, setPredictions] = useState<DiseasePrediction[]>([])
  const [outbreakZones, setOutbreakZones] = useState<OutbreakZone[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'dashboard' | 'predictions' | 'outbreaks'>('dashboard')
  const [showForm, setShowForm] = useState(false)
  const formRef = useScrollToForm(showForm)
  const [showOutbreakForm, setShowOutbreakForm] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [formData, setFormData] = useState({
    diseaseName: '', riskScore: '', confidence: '', predictedOnset: '',
    riskFactors: '', recommendedActions: '', animalId: '', enterpriseId: ''
  })

  const [outbreakForm, setOutbreakForm] = useState({
    diseaseName: '', severity: 'low', affectedCount: '', totalAtRisk: '',
    radiusKm: '', centerLat: '', centerLng: '', enterpriseId: ''
  })

  useEffect(() => {
    const fetchEnterprises = async () => {
      try {
        const res = await apiService.listEnterprises({ limit: 100 })
        const items = res.data?.items || []
        setEnterprises(items)
        if (items.length === 1) setSelectedEnterpriseId(items[0].id)
      } catch { setEnterprises([]) }
    }
    fetchEnterprises()
  }, [])

  const fetchData = async () => {
    if (!selectedEnterpriseId) return
    try {
      setLoading(true)
      const [dashRes, predRes, zoneRes] = await Promise.all([
        apiService.getRiskDashboard(selectedEnterpriseId),
        apiService.listPredictions(selectedEnterpriseId),
        apiService.listOutbreakZones(selectedEnterpriseId)
      ])
      setDashboard(dashRes.data || null)
      setPredictions(predRes.data?.items || [])
      setOutbreakZones(zoneRes.data?.items || [])
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [selectedEnterpriseId])

  const handleCreatePrediction = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    try {
      await apiService.createPrediction(selectedEnterpriseId, {
        enterpriseId: selectedEnterpriseId,
        diseaseName: formData.diseaseName,
        riskScore: parseFloat(formData.riskScore) || 0,
        confidence: parseFloat(formData.confidence) || 0,
        predictedOnset: formData.predictedOnset || undefined,
        riskFactors: formData.riskFactors ? formData.riskFactors.split(',').map(s => s.trim()) : [],
        recommendedActions: formData.recommendedActions ? formData.recommendedActions.split(',').map(s => s.trim()) : [],
        animalId: formData.animalId || undefined,
      })
      setSuccessMsg(t('diseasePrediction.predictionCreated'))
      setShowForm(false)
      setFormData({ diseaseName: '', riskScore: '', confidence: '', predictedOnset: '', riskFactors: '', recommendedActions: '', animalId: '', enterpriseId: '' })
      fetchData()
    } catch (err: any) { setError(err.response?.data?.error?.message || t('common.failedToSave')) }
  }

  const handleCreateOutbreak = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    try {
      await apiService.createOutbreakZone(selectedEnterpriseId, {
        enterpriseId: selectedEnterpriseId,
        diseaseName: outbreakForm.diseaseName,
        severity: outbreakForm.severity,
        affectedCount: parseInt(outbreakForm.affectedCount) || 0,
        totalAtRisk: parseInt(outbreakForm.totalAtRisk) || 0,
        radiusKm: parseFloat(outbreakForm.radiusKm) || undefined,
        centerLat: parseFloat(outbreakForm.centerLat) || undefined,
        centerLng: parseFloat(outbreakForm.centerLng) || undefined,
      })
      setSuccessMsg(t('diseasePrediction.outbreakCreated'))
      setShowOutbreakForm(false)
      setOutbreakForm({ diseaseName: '', severity: 'low', affectedCount: '', totalAtRisk: '', radiusKm: '', centerLat: '', centerLng: '', enterpriseId: '' })
      fetchData()
    } catch (err: any) { setError(err.response?.data?.error?.message || t('common.failedToSave')) }
  }

  const handleResolve = async (id: string) => {
    try { await apiService.resolvePrediction(id, 'resolved'); setSuccessMsg(t('diseasePrediction.resolved')); fetchData() }
    catch { setError(t('diseasePrediction.failedResolve')) }
  }

  const handleResolveOutbreak = async (id: string) => {
    try { await apiService.resolveOutbreakZone(id); setSuccessMsg(t('diseasePrediction.outbreakResolved')); fetchData() }
    catch { setError(t('diseasePrediction.failedResolve')) }
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>{t('diseasePrediction.pageTitle')}</h1>
        <p>{t('diseasePrediction.subtitle')}</p>
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
        <div className="empty-state">{t('diseasePrediction.selectEnterprise')}</div>
      ) : loading ? (
        <div className="loading-spinner">{t('diseasePrediction.loading')}</div>
      ) : (
        <>
          <div className="tab-bar">
            <button className={tab === 'dashboard' ? 'tab-active' : ''} onClick={() => setTab('dashboard')}>{t('diseasePrediction.tabs.dashboard')}</button>
            <button className={tab === 'predictions' ? 'tab-active' : ''} onClick={() => setTab('predictions')}>{t('diseasePrediction.tabs.predictions')}</button>
            <button className={tab === 'outbreaks' ? 'tab-active' : ''} onClick={() => setTab('outbreaks')}>{t('diseasePrediction.tabs.outbreaks')}</button>
          </div>

          {tab === 'dashboard' && dashboard && (
            <div className="dashboard-grid">
              <div className="stat-card accent-purple">
                <div className="stat-value">{dashboard.summary?.totalActive ?? 0}</div>
                <div className="stat-label">{t('diseasePrediction.stats.activePredictions')}</div>
              </div>
              <div className="stat-card accent-orange">
                <div className="stat-value">{dashboard.summary?.avgRisk ?? 0}%</div>
                <div className="stat-label">{t('diseasePrediction.stats.avgRiskScore')}</div>
              </div>
              <div className="stat-card accent-red">
                <div className="stat-value">{dashboard.summary?.diseases ?? 0}</div>
                <div className="stat-label">{t('diseasePrediction.stats.diseasesTracked')}</div>
              </div>
              <div className="stat-card accent-blue">
                <div className="stat-value">{outbreakZones.filter(z => z.containmentStatus !== 'resolved').length}</div>
                <div className="stat-label">{t('diseasePrediction.stats.activeOutbreaks')}</div>
              </div>

              {(dashboard.activePredictions || []).length > 0 && (
                <div className="card full-width">
                  <h3>🔬 {t('diseasePrediction.riskDistribution')}</h3>
                  <div className="mini-chart-bar">
                    {(dashboard.activePredictions || []).map((d, i) => (
                      <div key={i} className="bar-row">
                        <span className="bar-label">{d.disease_name}</span>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${Math.min(+d.avg_risk, 100)}%`, backgroundColor: +d.avg_risk > 70 ? '#ef4444' : +d.avg_risk > 40 ? '#f97316' : '#22c55e' }} />
                        </div>
                        <span className="bar-value">{(+d.avg_risk).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(dashboard.topRiskAnimals || []).length > 0 && (
                <div className="card full-width">
                  <h3>⚠️ {t('diseasePrediction.highRiskAnimals')}</h3>
                  <table className="data-table">
                    <thead><tr><th>{t('diseasePrediction.animal')}</th><th>{t('diseasePrediction.species')}</th><th>{t('diseasePrediction.breed')}</th><th>{t('diseasePrediction.riskScore')}</th><th>{t('diseasePrediction.tabs.predictions')}</th></tr></thead>
                    <tbody>
                      {(dashboard.topRiskAnimals || []).map((a, i) => (
                        <tr key={i}>
                          <td>{a.name}</td><td>{speciesLabel(a.species, t)}</td><td>{a.breed}</td>
                          <td><span className="badge" style={{ backgroundColor: +a.highest_risk > 70 ? '#ef4444' : +a.highest_risk > 40 ? '#f97316' : '#22c55e' }}>{(+a.highest_risk).toFixed(1)}%</span></td>
                          <td>{a.prediction_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'predictions' && (
            <div>
              <div className="section-toolbar">
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                  {showForm ? t('common.cancel') : t('diseasePrediction.newPrediction')}
                </button>
              </div>

              {showForm && <div className="edit-form-overlay" onClick={() => { setShowForm(false) }} />}
              {showForm && (
                <div ref={formRef} className="edit-form-panel">
                <form className="module-form" onSubmit={handleCreatePrediction}>
                  <div className="form-grid">
                    <div className="form-group"><label>{t('diseasePrediction.diseaseName')} *</label><input required value={formData.diseaseName} onChange={e => setFormData({ ...formData, diseaseName: e.target.value })} /></div>
                    <div className="form-group"><label>{t('diseasePrediction.riskScore')} (0-100)</label><input type="number" min="0" max="100" step="0.1" value={formData.riskScore} onChange={e => setFormData({ ...formData, riskScore: e.target.value })} /></div>
                    <div className="form-group"><label>{t('diseasePrediction.confidence')} (0-100)</label><input type="number" min="0" max="100" step="0.1" value={formData.confidence} onChange={e => setFormData({ ...formData, confidence: e.target.value })} /></div>
                    <div className="form-group"><label>{t('diseasePrediction.predictedOnset')}</label><input type="date" value={formData.predictedOnset} onChange={e => setFormData({ ...formData, predictedOnset: e.target.value })} /></div>
                    <div className="form-group full-width"><label>{t('diseasePrediction.riskFactors')}</label><input value={formData.riskFactors} onChange={e => setFormData({ ...formData, riskFactors: e.target.value })} placeholder="e.g., Overcrowding, Poor ventilation" /></div>
                    <div className="form-group full-width"><label>{t('diseasePrediction.recommendedActions')}</label><input value={formData.recommendedActions} onChange={e => setFormData({ ...formData, recommendedActions: e.target.value })} placeholder="e.g., Isolate affected animals, Increase ventilation" /></div>
                  </div>
                  <button type="submit" className="btn-primary">{t('diseasePrediction.submitPrediction')}</button>
                </form>
                </div>
              )}

              <table className="data-table">
                <thead><tr><th>{t('diseasePrediction.disease')}</th><th>{t('diseasePrediction.risk')}</th><th>{t('diseasePrediction.confidence')}</th><th>{t('diseasePrediction.onset')}</th><th>{t('common.status')}</th><th>{t('common.actions')}</th></tr></thead>
                <tbody>
                  {predictions.map(p => (
                    <tr key={p.id}>
                      <td><strong>{p.diseaseName || (p as any).disease_name}</strong><br /><small>{p.animalName || (p as any).animal_name || 'Enterprise-wide'}</small></td>
                      <td><span className="badge" style={{ backgroundColor: +(p.riskScore || (p as any).risk_score) > 70 ? '#ef4444' : +(p.riskScore || (p as any).risk_score) > 40 ? '#f97316' : '#22c55e' }}>{+(p.riskScore || (p as any).risk_score)}%</span></td>
                      <td>{+(p.confidence || 0)}%</td>
                      <td>{(p.predictedOnset || (p as any).predicted_onset) ? new Date(p.predictedOnset || (p as any).predicted_onset).toLocaleDateString() : '—'}</td>
                      <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                      <td>{p.status === 'active' && <button className="btn-sm" onClick={() => handleResolve(p.id)}>{t('diseasePrediction.resolve')}</button>}</td>
                    </tr>
                  ))}
                  {!predictions.length && <tr><td colSpan={6} className="empty-cell">{t('diseasePrediction.noPredictions')}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'outbreaks' && (
            <div>
              <div className="section-toolbar">
                <button className="btn-primary" onClick={() => setShowOutbreakForm(!showOutbreakForm)}>
                  {showOutbreakForm ? t('common.cancel') : t('diseasePrediction.reportOutbreak')}
                </button>
              </div>

              {showOutbreakForm && (
                <form className="module-form" onSubmit={handleCreateOutbreak}>
                  <p className="si-f2fe0f46">💡 Click on the map below to set the outbreak center location</p>
                  <div className="form-grid">
                    <div className="form-group"><label>{t('diseasePrediction.disease')} *</label><input required value={outbreakForm.diseaseName} onChange={e => setOutbreakForm({ ...outbreakForm, diseaseName: e.target.value })} /></div>
                    <div className="form-group"><label>{t('diseasePrediction.severity')}</label>
                      <select value={outbreakForm.severity} onChange={e => setOutbreakForm({ ...outbreakForm, severity: e.target.value })}>
                        <option value="low">Low</option><option value="medium">Medium</option>
                        <option value="high">High</option><option value="critical">Critical</option>
                      </select>
                    </div>
                    <div className="form-group"><label>{t('diseasePrediction.affectedCount')}</label><input type="number" value={outbreakForm.affectedCount} onChange={e => setOutbreakForm({ ...outbreakForm, affectedCount: e.target.value })} /></div>
                    <div className="form-group"><label>{t('diseasePrediction.totalAtRisk')}</label><input type="number" value={outbreakForm.totalAtRisk} onChange={e => setOutbreakForm({ ...outbreakForm, totalAtRisk: e.target.value })} /></div>
                    <div className="form-group"><label>{t('diseasePrediction.radiusKm')}</label><input type="number" step="0.1" value={outbreakForm.radiusKm} onChange={e => setOutbreakForm({ ...outbreakForm, radiusKm: e.target.value })} /></div>
                    <div className="form-group"><label>{t('diseasePrediction.centerLat')}</label><input type="number" step="0.0001" value={outbreakForm.centerLat} onChange={e => setOutbreakForm({ ...outbreakForm, centerLat: e.target.value })} placeholder="Click map or type" /></div>
                    <div className="form-group"><label>{t('diseasePrediction.centerLng')}</label><input type="number" step="0.0001" value={outbreakForm.centerLng} onChange={e => setOutbreakForm({ ...outbreakForm, centerLng: e.target.value })} placeholder="Click map or type" /></div>
                  </div>
                  <button type="submit" className="btn-primary">{t('diseasePrediction.createOutbreakZone')}</button>
                </form>
              )}

              {/* Interactive Outbreak Map */}
              <div className="si-3f5b50f7">
                <div className="si-be8ac8a2">
                  <h3 className="si-44087c4b">🗺️ {t('diseasePrediction.outbreakZoneMap')}</h3>
                  <p className="si-7438976a">
                    {outbreakZones.length} outbreak zone{outbreakZones.length !== 1 ? 's' : ''} · Circle size represents radius · Color represents severity
                  </p>
                </div>
                <MapView
                  height={420}
                  circles={[
                    ...outbreakZones.filter(z => (z.centerLat || (z as any).center_lat) && (z.centerLng || (z as any).center_lng)).map(z => ({
                      id: z.id,
                      lat: +(z.centerLat || (z as any).center_lat),
                      lng: +(z.centerLng || (z as any).center_lng),
                      radius: (+(z.radiusKm || (z as any).radius_km || 1)) * 1000,
                      color: SEVERITY_COLORS[z.severity] || '#6b7280',
                      fillOpacity: z.severity === 'critical' ? 0.35 : z.severity === 'high' ? 0.25 : 0.15,
                      popup: (
                        <div>
                          <strong>{z.diseaseName || (z as any).disease_name}</strong><br />
                          <span style={{ fontSize: 12, color: SEVERITY_COLORS[z.severity] }}>{(z.severity || '').toUpperCase()}</span><br />
                          <span className="si-756a9f21">Affected: {z.affectedCount || (z as any).affected_count} · At risk: {z.totalAtRisk || (z as any).total_at_risk}</span><br />
                          <span className="si-756a9f21">Radius: {z.radiusKm || (z as any).radius_km}km</span><br />
                          <span className="si-dd67611c">Status: {z.containmentStatus || (z as any).containment_status}</span>
                        </div>
                      ),
                    })),
                    ...(outbreakForm.centerLat && outbreakForm.centerLng && showOutbreakForm ? [{
                      id: 'new-outbreak',
                      lat: +outbreakForm.centerLat,
                      lng: +outbreakForm.centerLng,
                      radius: (+outbreakForm.radiusKm || 1) * 1000,
                      color: SEVERITY_COLORS[outbreakForm.severity] || '#ec4899',
                      fillOpacity: 0.3,
                      popup: <div><strong>New Outbreak Zone</strong><br /><span className="si-756a9f21">{outbreakForm.centerLat}, {outbreakForm.centerLng}</span></div>,
                    }] : []),
                  ]}
                  markers={outbreakForm.centerLat && outbreakForm.centerLng && showOutbreakForm ? [{
                    id: 'new-outbreak-center',
                    lat: +outbreakForm.centerLat,
                    lng: +outbreakForm.centerLng,
                    color: SEVERITY_COLORS[outbreakForm.severity] || '#ec4899',
                    pulse: true,
                    popup: <div><strong>New Outbreak Center</strong></div>,
                  }] : []}
                  onClick={(lat, lng) => {
                    if (showOutbreakForm) {
                      setOutbreakForm(f => ({ ...f, centerLat: lat.toFixed(6), centerLng: lng.toFixed(6) }))
                    }
                  }}
                  fitToData={outbreakZones.filter(z => (z.centerLat || (z as any).center_lat)).length > 0}
                />
              </div>

              {/* Severity Legend */}
              <div className="si-92d1d3e8">
                {Object.entries(SEVERITY_COLORS).map(([sev, color]) => (
                  <span key={sev}><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: color, marginRight: 4, opacity: 0.7 }}></span>{sev.charAt(0).toUpperCase() + sev.slice(1)}</span>
                ))}
              </div>

              <div className="cards-grid">
                {outbreakZones.map(z => (
                  <div key={z.id} className="card" style={{ borderLeft: `4px solid ${SEVERITY_COLORS[z.severity] || '#6b7280'}` }}>
                    <h3>{z.diseaseName || (z as any).disease_name}</h3>
                    <div className="card-meta">
                      <span className={`badge badge-${z.severity}`}>{z.severity}</span>
                      <span className={`badge badge-${z.containmentStatus || (z as any).containment_status}`}>{z.containmentStatus || (z as any).containment_status}</span>
                    </div>
                    <div className="card-stats">
                      <div><strong>{z.affectedCount || (z as any).affected_count}</strong> {t('diseasePrediction.affected')}</div>
                      <div><strong>{z.totalAtRisk || (z as any).total_at_risk}</strong> {t('diseasePrediction.atRisk')}</div>
                      {(z.radiusKm || (z as any).radius_km) && <div><strong>{z.radiusKm || (z as any).radius_km} km</strong> radius</div>}
                    </div>
                    {(z.centerLat || (z as any).center_lat) && (
                      <div className="si-5b3d984f">📍 {(+(z.centerLat || (z as any).center_lat)).toFixed(4)}, {(+(z.centerLng || (z as any).center_lng)).toFixed(4)}</div>
                    )}
                    <div className="card-footer">
                      <small>{t('diseasePrediction.started')} {(z.startedAt || (z as any).started_at) ? new Date(z.startedAt || (z as any).started_at).toLocaleDateString() : '–'}</small>
                      {(z.containmentStatus || (z as any).containment_status) !== 'resolved' && (
                        <button className="btn-sm" onClick={() => handleResolveOutbreak(z.id)}>{t('diseasePrediction.resolve')}</button>
                      )}
                    </div>
                  </div>
                ))}
                {!outbreakZones.length && <div className="empty-state">{t('diseasePrediction.noOutbreaks')}</div>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default DiseasePredictionPage
