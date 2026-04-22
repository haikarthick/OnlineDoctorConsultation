import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { useScrollToForm } from '../hooks/useScrollToForm'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { Enterprise, HealthObservation, HealthDashboard } from '../types'
import { useTranslation } from 'react-i18next'
import SearchSelect, { SearchSelectOption } from '../components/SearchSelect'

const SEVERITY_COLORS: Record<string, string> = {
  low: '#22c55e', medium: '#eab308', high: '#f97316', critical: '#ef4444'
}

const HealthAnalytics: React.FC = () => {
  const { t } = useTranslation()

  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [dashboard, setDashboard] = useState<HealthDashboard | null>(null)
  const [observations, setObservations] = useState<HealthObservation[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const formRef = useScrollToForm(showForm)
  const [tab, setTab] = useState<'dashboard' | 'observations'>('dashboard')
  const [formData, setFormData] = useState({
    animalId: '', observationType: 'general', severity: 'low' as string,
    title: '', description: '', bodyTemperature: '', heartRate: '',
    respiratoryRate: '', weightAtObservation: ''
  })
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [animalLabel, setAnimalLabel] = useState('')

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
      const [dashRes, obsRes] = await Promise.all([
        apiService.getHealthDashboard(selectedEnterpriseId),
        apiService.listHealthObservations(selectedEnterpriseId)
      ])
      setDashboard(dashRes.data || null)
      setObservations(obsRes.data?.items || [])
    } catch (err: any) {
      console.error('Failed to load health analytics data:', err?.message)
      setError(err?.response?.data?.error || err?.message || 'Failed to load data')
    }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [selectedEnterpriseId])
  useAutoRefresh('health-analytics', fetchData)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    try {
      await apiService.createHealthObservation(selectedEnterpriseId, {
        enterpriseId: selectedEnterpriseId,
        ...formData,
        bodyTemperature: formData.bodyTemperature ? parseFloat(formData.bodyTemperature) : undefined,
        heartRate: formData.heartRate ? parseInt(formData.heartRate) : undefined,
        respiratoryRate: formData.respiratoryRate ? parseInt(formData.respiratoryRate) : undefined,
        weightAtObservation: formData.weightAtObservation ? parseFloat(formData.weightAtObservation) : undefined,
      })
      setSuccessMsg('Observation recorded!')
      setShowForm(false)
      setFormData({ animalId: '', observationType: 'general', severity: 'low', title: '', description: '', bodyTemperature: '', heartRate: '', respiratoryRate: '', weightAtObservation: '' })
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('common.failedToSave'))
    }
  }

  const handleResolve = async (id: string) => {
    try {
      await apiService.resolveHealthObservation(id)
      setSuccessMsg(t('common.resolved') + '!')
      fetchData()
    } catch { setError(t('healthAnalytics.errors.failedToResolve')) }
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>{t('healthAnalytics.pageTitle')}</h1>
        <p>{t('healthAnalytics.subtitle')}</p>
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

      {selectedEnterpriseId && (
        <>
          <div className="tab-bar">
            <button className={`tab-btn ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>📊 Dashboard</button>
            <button className={`tab-btn ${tab === 'observations' ? 'active' : ''}`} onClick={() => setTab('observations')}>📋 Observations</button>
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ New Observation</button>
          </div>

          {showForm && <div className="edit-form-overlay" onClick={() => { setShowForm(false) }} />}
          {showForm && (
            <div ref={formRef} className="edit-form-panel">
            <form className="module-form" onSubmit={handleSubmit}>
              <h3>Record Health Observation</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Title *</label>
                  <input required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Observation Type</label>
                  <select value={formData.observationType} onChange={e => setFormData({ ...formData, observationType: e.target.value })}>
                    {['general', 'illness', 'injury', 'behavioral', 'reproductive', 'nutritional', 'mortality', 'lameness'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Severity</label>
                  <select value={formData.severity} onChange={e => setFormData({ ...formData, severity: e.target.value })}>
                    {['low', 'medium', 'high', 'critical'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Animal (optional)</label>
                  <SearchSelect
                    placeholder="Search animal by name..."
                    value={formData.animalId}
                    displayValue={animalLabel}
                    loadOnOpen={true}
                    onSelect={(val, label) => { setFormData(f => ({ ...f, animalId: val })); setAnimalLabel(label) }}
                    onClear={() => { setFormData(f => ({ ...f, animalId: '' })); setAnimalLabel('') }}
                    onSearch={async (q: string): Promise<SearchSelectOption[]> => {
                      if (!selectedEnterpriseId) return []
                      const res = await apiService.get(`/enterprises/${selectedEnterpriseId}/animals`, { params: { search: q, limit: 20 } })
                      const items = res.data?.items || res.data?.animals || res.data || []
                      return items.map((a: any) => ({
                        value: a.id,
                        label: a.name,
                        sublabel: [a.species, a.breed].filter(Boolean).join(' · '),
                      }))
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Body Temperature</label>
                  <input type="number" step="0.1" value={formData.bodyTemperature} onChange={e => setFormData({ ...formData, bodyTemperature: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Heart Rate (bpm)</label>
                  <input type="number" value={formData.heartRate} onChange={e => setFormData({ ...formData, heartRate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Respiratory Rate</label>
                  <input type="number" value={formData.respiratoryRate} onChange={e => setFormData({ ...formData, respiratoryRate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Weight (kg)</label>
                  <input type="number" step="0.1" value={formData.weightAtObservation} onChange={e => setFormData({ ...formData, weightAtObservation: e.target.value })} />
                </div>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Description</label>
                <textarea rows={3} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">{t('healthAnalytics.form.saveBtn')}</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
              </div>
            </form>
            </div>
          )}

          {loading ? <p className="loading-text">{t('common.loading')}</p> : tab === 'dashboard' && dashboard ? (
            <div className="dashboard-grid">
              {/* Severity Distribution */}
              <div className="card">
                <h3>Severity Distribution (90 days)</h3>
                <div className="stats-row">
                  {(dashboard.severityDistribution || []).map(s => (
                    <div key={s.severity} className="stat-item" style={{ borderLeft: `4px solid ${SEVERITY_COLORS[s.severity] || '#888'}` }}>
                      <span className="stat-value">{s.count}</span>
                      <span className="stat-label">{s.severity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Health Score Distribution */}
              <div className="card">
                <h3>Health Score Distribution</h3>
                <div className="stats-row">
                  {(dashboard.healthScoreDistribution || []).map(s => (
                    <div key={s.range} className="stat-item">
                      <span className="stat-value">{s.count}</span>
                      <span className="stat-label">{s.range}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekly Timeline */}
              <div className="card">
                <h3>Observation Timeline (12 weeks)</h3>
                <div className="mini-chart">
                  {(dashboard.observationTimeline || []).map((w, i) => (
                    <div key={i} className="chart-bar-wrapper">
                      <div className="chart-bar" style={{ height: `${Math.min(100, (Number(w.count) / Math.max(1, ...(dashboard.observationTimeline || []).map(x => Number(x.count)))) * 100)}%` }}></div>
                      <span className="chart-label">{w.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Critical Observations */}
              <div className="card full-width">
                <h3>{t('healthAnalytics.critical')}</h3>
                {(dashboard.criticalObservations || []).length === 0 ? <p className="empty-text">{t('healthAnalytics.noCritical')}</p> : (
                  <table className="data-table">
                    <thead><tr><th>{t('common.name')}</th><th>{t('common.type')}</th><th>{t('healthAnalytics.form.severity')}</th><th>{t('common.animal')}</th><th>{t('common.date')}</th><th>{t('common.actions')}</th></tr></thead>
                    <tbody>
                      {dashboard.criticalObservations.map(o => (
                        <tr key={o.id}>
                          <td>{o.title}</td>
                          <td>{o.observationType}</td>
                          <td><span className="badge" style={{ background: SEVERITY_COLORS[o.severity] }}>{o.severity}</span></td>
                          <td>{o.animalName || '–'}</td>
                          <td>{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '–'}</td>
                          <td>{!o.isResolved && <button className="btn btn-sm btn-success" onClick={() => handleResolve(o.id)}>{t('healthAnalytics.resolve')}</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Mortality Trend */}
              <div className="card">
                <h3>{t('healthAnalytics.charts.mortalityTrend')}</h3>
                <div className="mini-chart">
                  {(dashboard.mortalityTrend || []).map((m, i) => (
                    <div key={i} className="chart-bar-wrapper">
                      <div className="chart-bar danger" style={{ height: `${Math.min(100, (Number(m.deaths) / Math.max(1, ...(dashboard.mortalityTrend || []).map(x => Number(x.deaths)))) * 100)}%` }}></div>
                      <span className="chart-label">{m.deaths}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Unresolved by Type */}
              <div className="card">
                <h3>{t('healthAnalytics.charts.unresolvedByType')}</h3>
                <div className="stats-row wrap">
                  {(dashboard.unresolvedByType || []).map(t => (
                    <div key={t.observation_type} className="stat-item">
                      <span className="stat-value">{t.count}</span>
                      <span className="stat-label">{t.observation_type}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : tab === 'observations' ? (
            <div className="card full-width">
              <h3>{t('healthAnalytics.allObservations')}</h3>
              {observations.length === 0 ? <p className="empty-text">{t('healthAnalytics.emptyObservations')}</p> : (
                <table className="data-table">
                  <thead><tr><th>{t('common.name')}</th><th>{t('common.type')}</th><th>{t('healthAnalytics.form.severity')}</th><th>{t('common.animal')}</th><th>{t('common.status')}</th><th>{t('common.date')}</th><th>{t('common.actions')}</th></tr></thead>
                  <tbody>
                    {observations.map(o => (
                      <tr key={o.id}>
                        <td>{o.title}</td>
                        <td>{o.observationType}</td>
                        <td><span className="badge" style={{ background: SEVERITY_COLORS[o.severity] }}>{o.severity}</span></td>
                        <td>{o.animalName || '–'}</td>
                        <td>{o.isResolved ? t('healthAnalytics.headers.resolved') : t('healthAnalytics.headers.open')}</td>
                        <td>{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '–'}</td>
                        <td>{!o.isResolved && <button className="btn btn-sm btn-success" onClick={() => handleResolve(o.id)}>{t('healthAnalytics.resolve')}</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default HealthAnalytics
