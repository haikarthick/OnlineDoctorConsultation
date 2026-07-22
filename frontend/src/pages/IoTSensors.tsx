import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { useScrollToForm } from '../hooks/useScrollToForm'
import { Enterprise, IoTSensor, SensorReading } from '../types'
import { useTranslation } from 'react-i18next'

const SENSOR_ICONS: Record<string, string> = {
  temperature: '🌡️', humidity: '💧', weight: '⚖️', activity: '🏃', air_quality: '🌬️',
  heart_rate: '💓', water_flow: '🚿', gps: '📍', camera: '📷', pressure: '🔵'
}

const IoTSensorPage: React.FC = () => {
  const { t } = useTranslation()

  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [sensors, setSensors] = useState<IoTSensor[]>([])
  const [dashboard, setDashboard] = useState<any>(null)
  const [readings, setReadings] = useState<SensorReading[]>([])
  const [selectedSensor, setSelectedSensor] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'dashboard' | 'sensors' | 'readings'>('dashboard')
  const [showForm, setShowForm] = useState(false)
  const formRef = useScrollToForm(showForm)
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
      setSuccessMsg(t('iotSensors.sensorRegistered'))
      setShowForm(false)
      setFormData({ sensorType: 'temperature', sensorName: '', serialNumber: '', manufacturer: '', unit: '°C', minThreshold: '', maxThreshold: '', readingIntervalSeconds: '300' })
      fetchData()
    } catch (err: any) { setError(err.response?.data?.error?.message || t('common.failedToSave')) }
  }

  const handleRecordReading = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    try {
      await apiService.recordSensorReading(selectedEnterpriseId, {
        enterpriseId: selectedEnterpriseId, sensorId: readingForm.sensorId,
        value: parseFloat(readingForm.value), unit: readingForm.unit || undefined,
      })
      setSuccessMsg(t('iotSensors.readingRecorded'))
      setShowReadingForm(false)
      if (selectedSensor) fetchReadings(selectedSensor)
      fetchData()
    } catch (err: any) { setError(err.response?.data?.error?.message || t('common.failedToSave')) }
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>{t('iotSensors.pageTitle')}</h1>
        <p>{t('iotSensors.subtitle')}</p>
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
        <div className="empty-state">{t('iotSensors.selectEnterprise')}</div>
      ) : loading ? (
        <div className="loading-spinner">{t('iotSensors.loading')}</div>
      ) : (
        <>
          <div className="tab-bar">
            <button className={tab === 'dashboard' ? 'tab-active' : ''} onClick={() => setTab('dashboard')}>{t('iotSensors.tabs.dashboard')}</button>
            <button className={tab === 'sensors' ? 'tab-active' : ''} onClick={() => setTab('sensors')}>{t('iotSensors.tabs.sensors')}</button>
            <button className={tab === 'readings' ? 'tab-active' : ''} onClick={() => setTab('readings')}>{t('iotSensors.tabs.readings')}</button>
          </div>

          {tab === 'dashboard' && dashboard && (
            <div className="dashboard-grid">
              <div className="stat-card accent-blue">
                <div className="stat-value">{dashboard.summary?.totalSensors || 0}</div>
                <div className="stat-label">{t('iotSensors.stats.totalSensors')}</div>
              </div>
              <div className="stat-card accent-green">
                <div className="stat-value">{dashboard.summary?.activeSensors || 0}</div>
                <div className="stat-label">{t('common.active')}</div>
              </div>
              <div className="stat-card accent-red">
                <div className="stat-value">{dashboard.summary?.anomaliesLast24h || 0}</div>
                <div className="stat-label">{t('iotSensors.stats.anomalies24h')}</div>
              </div>
              <div className="stat-card accent-orange">
                <div className="stat-value">{dashboard.lowBatterySensors?.length || 0}</div>
                <div className="stat-label">{t('iotSensors.stats.lowBattery')}</div>
              </div>

              {dashboard.byType?.length > 0 && (
                <div className="card">
                  <h3>📊 {t('iotSensors.sensorsByType')}</h3>
                  <div className="mini-chart-bar">
                    {dashboard.byType.map((st: any, i: number) => (
                      <div key={i} className="bar-row">
                        <span className="bar-label">{SENSOR_ICONS[st.sensor_type] || '📟'} {st.sensor_type}</span>
                        <div className="bar-track"><div className="bar-fill" style={{ width: `${(+st.count / Math.max(1, ...(dashboard.byType || []).map((x: any) => +x.count))) * 100}%` }} /></div>
                        <span className="bar-value">{st.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dashboard.avgReadings24h?.length > 0 && (
                <div className="card">
                  <h3>📈 {t('iotSensors.avgReadings24h')}</h3>
                  <table className="data-table compact">
                    <thead><tr><th>{t('common.type')}</th><th>{t('iotSensors.avg')}</th><th>{t('iotSensors.min')}</th><th>{t('iotSensors.max')}</th><th>{t('iotSensors.tabs.readings')}</th></tr></thead>
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
                  <h3>🚨 {t('iotSensors.recentAnomalies')}</h3>
                  <table className="data-table">
                    <thead><tr><th>{t('iotSensors.sensor')}</th><th>{t('common.type')}</th><th>{t('iotSensors.value')}</th><th>{t('iotSensors.anomaly')}</th><th>{t('iotSensors.time')}</th></tr></thead>
                    <tbody>{dashboard.recentAnomalies.slice(0, 10).map((a: any, i: number) => (
                      <tr key={i} className="si-cbcacd9b">
                        <td>{a.sensor_name}</td><td>{a.sensor_type}</td>
                        <td><strong>{(+a.value).toFixed(2)}</strong> {a.sensor_unit || a.unit}</td>
                        <td><span className="badge badge-critical">{a.anomaly_type}</span></td>
                        <td>{a.recorded_at ? new Date(a.recorded_at).toLocaleString() : '–'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}

              {dashboard.lowBatterySensors?.length > 0 && (
                <div className="card full-width">
                  <h3>🔋 {t('iotSensors.lowBatterySensors')}</h3>
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
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? t('common.cancel') : t('iotSensors.registerSensor')}</button>
                <button className="btn-secondary" onClick={() => setShowReadingForm(!showReadingForm)}>{showReadingForm ? t('common.cancel') : t('iotSensors.recordReading')}</button>
              </div>

              {showForm && <div className="edit-form-overlay" onClick={() => { setShowForm(false) }} />}
              {showForm && (
                <div ref={formRef} className="edit-form-panel">
                <form className="module-form" onSubmit={handleCreateSensor}>
                  <div className="form-grid">
                    <div className="form-group"><label>{t('iotSensors.sensorType')} *</label>
                      <select value={formData.sensorType} onChange={e => setFormData({ ...formData, sensorType: e.target.value })}>
                        {['temperature', 'humidity', 'weight', 'activity', 'air_quality', 'heart_rate', 'water_flow', 'gps', 'camera', 'pressure'].map(st => (
                          <option key={st} value={st}>{SENSOR_ICONS[st]} {st.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group"><label>{t('iotSensors.sensorName')} *</label><input required value={formData.sensorName} onChange={e => setFormData({ ...formData, sensorName: e.target.value })} /></div>
                    <div className="form-group"><label>{t('iotSensors.serialNumber')}</label><input value={formData.serialNumber} onChange={e => setFormData({ ...formData, serialNumber: e.target.value })} /></div>
                    <div className="form-group"><label>{t('iotSensors.manufacturer')}</label><input value={formData.manufacturer} onChange={e => setFormData({ ...formData, manufacturer: e.target.value })} /></div>
                    <div className="form-group"><label>{t('iotSensors.unit')}</label><input value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} /></div>
                    <div className="form-group"><label>{t('iotSensors.minThreshold')}</label><input type="number" step="0.01" value={formData.minThreshold} onChange={e => setFormData({ ...formData, minThreshold: e.target.value })} /></div>
                    <div className="form-group"><label>{t('iotSensors.maxThreshold')}</label><input type="number" step="0.01" value={formData.maxThreshold} onChange={e => setFormData({ ...formData, maxThreshold: e.target.value })} /></div>
                    <div className="form-group"><label>{t('iotSensors.readingInterval')}</label><input type="number" value={formData.readingIntervalSeconds} onChange={e => setFormData({ ...formData, readingIntervalSeconds: e.target.value })} /></div>
                  </div>
                  <button type="submit" className="btn-primary">{t('iotSensors.registerSensor')}</button>
                </form>
                </div>
              )}

              {showReadingForm && (
                <form className="module-form" onSubmit={handleRecordReading}>
                  <div className="form-grid">
                    <div className="form-group"><label>{t('iotSensors.sensor')} *</label>
                      <select required value={readingForm.sensorId} onChange={e => setReadingForm({ ...readingForm, sensorId: e.target.value })}>
                        <option value="">{t('iotSensors.selectSensor')}</option>
                        {sensors.map(s => <option key={s.id} value={s.id}>{(s as any).sensor_name || s.sensorName} ({(s as any).sensor_type || s.sensorType})</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label>{t('iotSensors.value')} *</label><input required type="number" step="0.01" value={readingForm.value} onChange={e => setReadingForm({ ...readingForm, value: e.target.value })} /></div>
                    <div className="form-group"><label>{t('iotSensors.unit')}</label><input value={readingForm.unit} onChange={e => setReadingForm({ ...readingForm, unit: e.target.value })} /></div>
                  </div>
                  <button type="submit" className="btn-primary">{t('iotSensors.recordReading')}</button>
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
                        <button className="btn-sm" onClick={() => fetchReadings(s.id)}>{t('iotSensors.viewReadings')}</button>
                      </div>
                    </div>
                  )
                })}
                {!sensors.length && <div className="empty-state">{t('iotSensors.noSensors')}</div>}
              </div>
            </div>
          )}

          {tab === 'readings' && (
            <div>
              <div className="section-toolbar">
                {sensors.length > 0 && (
                  <select value={selectedSensor} onChange={e => { if (e.target.value) fetchReadings(e.target.value) }}>
                    <option value="">{t('iotSensors.selectSensor')}</option>
                    {sensors.map(s => <option key={s.id} value={s.id}>{(s as any).sensor_name || s.sensorName}</option>)}
                  </select>
                )}
              </div>
              <table className="data-table">
                <thead><tr><th>{t('iotSensors.value')}</th><th>{t('iotSensors.unit')}</th><th>{t('iotSensors.anomaly')}</th><th>{t('common.type')}</th><th>{t('iotSensors.recordedAt')}</th></tr></thead>
                <tbody>
                  {readings.map(r => (
                    <tr key={r.id} style={{ backgroundColor: (r.isAnomaly || (r as any).is_anomaly) ? 'rgba(239,68,68,0.05)' : undefined }}>
                      <td><strong>{(+r.value).toFixed(2)}</strong></td>
                      <td>{r.unit}</td>
                      <td>{(r.isAnomaly || (r as any).is_anomaly) ? <span className="badge badge-critical">Yes</span> : '—'}</td>
                      <td>{(r.anomalyType || (r as any).anomaly_type) || '—'}</td>
                      <td>{(r.recordedAt || (r as any).recorded_at) ? new Date(r.recordedAt || (r as any).recorded_at).toLocaleString() : '–'}</td>
                    </tr>
                  ))}
                  {!readings.length && <tr><td colSpan={5} className="empty-cell">{t('iotSensors.noReadings')}</td></tr>}
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
