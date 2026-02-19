import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, IoTSensor, SensorReading } from '../types'

const SENSOR_ICONS: Record<string, string> = {
  temperature: '🌡️', humidity: '💧', weight: '⚖️', activity: '🏃', air_quality: '🌬️',
  heart_rate: '💓', water_flow: '🚿', gps: '📍', camera: '📷', pressure: '🔵'
}

const IoTSensorPage: React.FC = () => {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [sensors, setSensors] = useState<IoTSensor[]>([])
  const [dashboard, setDashboard] = useState<any>(null)
  const [readings, setReadings] = useState<SensorReading[]>([])
  const [selectedSensor, setSelectedSensor] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'dashboard' | 'sensors' | 'readings'>('dashboard')
  const [showForm, setShowForm] = useState(false)
  const [showReadingForm, setShowReadingForm] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [formData, setFormData] = useState({
    sensorType: 'temperature', sensorName: '', serialNumber: '', manufacturer: '',
    unit: '°C', minThreshold: '', maxThreshold: '', readingIntervalSeconds: '300'
  })
  const [readingForm, setReadingForm] = useState({ sensorId: '', value: '', unit: '' })

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
      const [dashRes, sensorRes] = await Promise.all([
        apiService.getSensorDashboard(selectedEnterpriseId),
        apiService.listSensors(selectedEnterpriseId)
      ])
      setDashboard(dashRes.data || null)
      setSensors(sensorRes.data?.items || [])
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [selectedEnterpriseId])

  const fetchReadings = async (sensorId: string) => {
    setSelectedSensor(sensorId)
    setTab('readings')
    try {
      const res = await apiService.listSensorReadings(sensorId)
      setReadings(res.data?.items || [])
    } catch { setReadings([]) }
  }

  const handleCreateSensor = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    try {
      await apiService.createSensor(selectedEnterpriseId, {
        enterpriseId: selectedEnterpriseId, sensorType: formData.sensorType,
        sensorName: formData.sensorName, serialNumber: formData.serialNumber || undefined,
        manufacturer: formData.manufacturer || undefined, unit: formData.unit || undefined,
        minThreshold: formData.minThreshold ? parseFloat(formData.minThreshold) : undefined,
        maxThreshold: formData.maxThreshold ? parseFloat(formData.maxThreshold) : undefined,
        readingIntervalSeconds: parseInt(formData.readingIntervalSeconds) || 300,
      })
      setSuccessMsg('Sensor registered!')
      setShowForm(false)
      setFormData({ sensorType: 'temperature', sensorName: '', serialNumber: '', manufacturer: '', unit: '°C', minThreshold: '', maxThreshold: '', readingIntervalSeconds: '300' })
      fetchData()
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed') }
  }

  const handleRecordReading = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    try {
      await apiService.recordSensorReading(selectedEnterpriseId, {
        enterpriseId: selectedEnterpriseId, sensorId: readingForm.sensorId,
        value: parseFloat(readingForm.value), unit: readingForm.unit || undefined,
      })
      setSuccessMsg('Reading recorded!')
      setShowReadingForm(false)
      if (selectedSensor) fetchReadings(selectedSensor)
      fetchData()
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed') }
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>📡 IoT Sensor Integration Dashboard</h1>
        <p>Real-time environmental monitoring, automated telemetry, and anomaly detection</p>
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
        <div className="empty-state">Select an enterprise to view IoT sensor data</div>
      ) : loading ? (
        <div className="loading-spinner">Connecting to sensor network…</div>
      ) : (
        <>
          <div className="tab-bar">
            <button className={tab === 'dashboard' ? 'tab-active' : ''} onClick={() => setTab('dashboard')}>Telemetry Dashboard</button>
            <button className={tab === 'sensors' ? 'tab-active' : ''} onClick={() => setTab('sensors')}>Sensors</button>
            <button className={tab === 'readings' ? 'tab-active' : ''} onClick={() => setTab('readings')}>Readings</button>
          </div>

          {tab === 'dashboard' && dashboard && (
            <div className="dashboard-grid">
              <div className="stat-card accent-blue">
                <div className="stat-value">{dashboard.summary?.totalSensors || 0}</div>
                <div className="stat-label">Total Sensors</div>
              </div>
              <div className="stat-card accent-green">
                <div className="stat-value">{dashboard.summary?.activeSensors || 0}</div>
                <div className="stat-label">Active</div>
              </div>
              <div className="stat-card accent-red">
                <div className="stat-value">{dashboard.summary?.anomaliesLast24h || 0}</div>
                <div className="stat-label">Anomalies (24h)</div>
              </div>
              <div className="stat-card accent-orange">
                <div className="stat-value">{dashboard.lowBatterySensors?.length || 0}</div>
                <div className="stat-label">Low Battery</div>
              </div>

              {dashboard.byType?.length > 0 && (
                <div className="card">
                  <h3>📊 Sensors by Type</h3>
                  <div className="mini-chart-bar">
                    {dashboard.byType.map((t: any, i: number) => (
                      <div key={i} className="bar-row">
                        <span className="bar-label">{SENSOR_ICONS[t.sensor_type] || '📟'} {t.sensor_type}</span>
                        <div className="bar-track"><div className="bar-fill" style={{ width: `${(+t.count / Math.max(...dashboard.byType.map((x: any) => +x.count))) * 100}%` }} /></div>
                        <span className="bar-value">{t.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dashboard.avgReadings24h?.length > 0 && (
                <div className="card">
                  <h3>📈 24h Average Readings</h3>
                  <table className="data-table compact">
                    <thead><tr><th>Type</th><th>Avg</th><th>Min</th><th>Max</th><th>Readings</th></tr></thead>
                    <tbody>{dashboard.avgReadings24h.map((r: any, i: number) => (
                      <tr key={i}>
                        <td>{SENSOR_ICONS[r.sensor_type] || ''} {r.sensor_type}</td>
                        <td>{(+r.avg_val).toFixed(1)}</td><td>{(+r.min_val).toFixed(1)}</td>
                        <td>{(+r.max_val).toFixed(1)}</td><td>{r.readings}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}

              {dashboard.recentAnomalies?.length > 0 && (
                <div className="card full-width">
                  <h3>🚨 Recent Anomalies</h3>
                  <table className="data-table">
                    <thead><tr><th>Sensor</th><th>Type</th><th>Value</th><th>Anomaly</th><th>Time</th></tr></thead>
                    <tbody>{dashboard.recentAnomalies.slice(0, 10).map((a: any, i: number) => (
                      <tr key={i} style={{ backgroundColor: 'rgba(239,68,68,0.05)' }}>
                        <td>{a.sensor_name}</td><td>{a.sensor_type}</td>
                        <td><strong>{(+a.value).toFixed(2)}</strong> {a.sensor_unit || a.unit}</td>
                        <td><span className="badge badge-critical">{a.anomaly_type}</span></td>
                        <td>{new Date(a.recorded_at).toLocaleString()}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}

              {dashboard.lowBatterySensors?.length > 0 && (
                <div className="card full-width">
                  <h3>🔋 Low Battery Sensors</h3>
                  <div className="cards-grid">
                    {dashboard.lowBatterySensors.map((s: any, i: number) => (
                      <div key={i} className="card" style={{ borderLeft: `4px solid ${+s.battery_level < 10 ? '#ef4444' : '#f97316'}` }}>
                        <h4>{s.sensor_name}</h4>
                        <div className="card-stats">
                          <div>{s.sensor_type}</div>
                          <div style={{ color: +s.battery_level < 10 ? '#ef4444' : '#f97316', fontWeight: 'bold' }}>{s.battery_level}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'sensors' && (
            <div>
              <div className="section-toolbar">
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Register Sensor'}</button>
                <button className="btn-secondary" onClick={() => setShowReadingForm(!showReadingForm)}>{showReadingForm ? 'Cancel' : '📊 Record Reading'}</button>
              </div>

              {showForm && (
                <form className="module-form" onSubmit={handleCreateSensor}>
                  <div className="form-grid">
                    <div className="form-group"><label>Sensor Type *</label>
                      <select value={formData.sensorType} onChange={e => setFormData({ ...formData, sensorType: e.target.value })}>
                        {['temperature', 'humidity', 'weight', 'activity', 'air_quality', 'heart_rate', 'water_flow', 'gps', 'camera', 'pressure'].map(t => (
                          <option key={t} value={t}>{SENSOR_ICONS[t]} {t.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group"><label>Sensor Name *</label><input required value={formData.sensorName} onChange={e => setFormData({ ...formData, sensorName: e.target.value })} /></div>
                    <div className="form-group"><label>Serial Number</label><input value={formData.serialNumber} onChange={e => setFormData({ ...formData, serialNumber: e.target.value })} /></div>
                    <div className="form-group"><label>Manufacturer</label><input value={formData.manufacturer} onChange={e => setFormData({ ...formData, manufacturer: e.target.value })} /></div>
                    <div className="form-group"><label>Unit</label><input value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} /></div>
                    <div className="form-group"><label>Min Threshold</label><input type="number" step="0.01" value={formData.minThreshold} onChange={e => setFormData({ ...formData, minThreshold: e.target.value })} /></div>
                    <div className="form-group"><label>Max Threshold</label><input type="number" step="0.01" value={formData.maxThreshold} onChange={e => setFormData({ ...formData, maxThreshold: e.target.value })} /></div>
                    <div className="form-group"><label>Reading Interval (sec)</label><input type="number" value={formData.readingIntervalSeconds} onChange={e => setFormData({ ...formData, readingIntervalSeconds: e.target.value })} /></div>
                  </div>
                  <button type="submit" className="btn-primary">Register Sensor</button>
                </form>
              )}

              {showReadingForm && (
                <form className="module-form" onSubmit={handleRecordReading}>
                  <div className="form-grid">
                    <div className="form-group"><label>Sensor *</label>
                      <select required value={readingForm.sensorId} onChange={e => setReadingForm({ ...readingForm, sensorId: e.target.value })}>
                        <option value="">-- Select Sensor --</option>
                        {sensors.map(s => <option key={s.id} value={s.id}>{(s as any).sensor_name || s.sensorName} ({(s as any).sensor_type || s.sensorType})</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label>Value *</label><input required type="number" step="0.01" value={readingForm.value} onChange={e => setReadingForm({ ...readingForm, value: e.target.value })} /></div>
                    <div className="form-group"><label>Unit</label><input value={readingForm.unit} onChange={e => setReadingForm({ ...readingForm, unit: e.target.value })} /></div>
                  </div>
                  <button type="submit" className="btn-primary">Record Reading</button>
                </form>
              )}

              <div className="cards-grid">
                {sensors.map(s => {
                  const sName = (s as any).sensor_name || s.sensorName
                  const sType = (s as any).sensor_type || s.sensorType
                  const sStat = s.status
                  const sBat = (s as any).battery_level ?? s.batteryLevel
                  return (
                    <div key={s.id} className="card" style={{ borderLeft: `4px solid ${sStat === 'active' ? '#22c55e' : sStat === 'maintenance' ? '#f97316' : '#6b7280'}` }}>
                      <h3>{SENSOR_ICONS[sType] || '📟'} {sName}</h3>
                      <div className="card-meta">
                        <span className={`badge badge-${sStat}`}>{sStat}</span>
                        <span className="badge">{sType}</span>
                      </div>
                      <div className="card-stats">
                        {(s as any).serial_number && <div>SN: {(s as any).serial_number}</div>}
                        {sBat != null && <div>🔋 {sBat}%</div>}
                        {((s as any).last_reading_at || s.lastReadingAt) && <div>Last: {new Date((s as any).last_reading_at || s.lastReadingAt!).toLocaleString()}</div>}
                      </div>
                      <div className="card-footer">
                        <button className="btn-sm" onClick={() => fetchReadings(s.id)}>View Readings</button>
                      </div>
                    </div>
                  )
                })}
                {!sensors.length && <div className="empty-state">No sensors registered yet</div>}
              </div>
            </div>
          )}

          {tab === 'readings' && (
            <div>
              <div className="section-toolbar">
                {sensors.length > 0 && (
                  <select value={selectedSensor} onChange={e => { if (e.target.value) fetchReadings(e.target.value) }}>
                    <option value="">-- Select Sensor --</option>
                    {sensors.map(s => <option key={s.id} value={s.id}>{(s as any).sensor_name || s.sensorName}</option>)}
                  </select>
                )}
              </div>
              <table className="data-table">
                <thead><tr><th>Value</th><th>Unit</th><th>Anomaly</th><th>Type</th><th>Recorded At</th></tr></thead>
                <tbody>
                  {readings.map(r => (
                    <tr key={r.id} style={{ backgroundColor: (r.isAnomaly || (r as any).is_anomaly) ? 'rgba(239,68,68,0.05)' : undefined }}>
                      <td><strong>{(+r.value).toFixed(2)}</strong></td>
                      <td>{r.unit}</td>
                      <td>{(r.isAnomaly || (r as any).is_anomaly) ? <span className="badge badge-critical">Yes</span> : '—'}</td>
                      <td>{(r.anomalyType || (r as any).anomaly_type) || '—'}</td>
                      <td>{new Date(r.recordedAt || (r as any).recorded_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {!readings.length && <tr><td colSpan={5} className="empty-cell">No readings — select a sensor above</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default IoTSensorPage
