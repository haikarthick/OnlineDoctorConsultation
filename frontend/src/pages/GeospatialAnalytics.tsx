import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { GeofenceZone, GeospatialEvent } from '../types'

const ZONE_TYPES = ['pasture', 'barn', 'medical', 'quarantine', 'feeding', 'water', 'boundary', 'custom']
const ZONE_COLORS: Record<string, string> = { pasture: '#22c55e', barn: '#a78bfa', medical: '#ef4444', quarantine: '#f97316', feeding: '#eab308', water: '#3b82f6', boundary: '#64748b', custom: '#ec4899' }
const EVENT_TYPES = ['location_update', 'zone_entry', 'zone_exit', 'zone_breach', 'sos_alert']

const GeospatialAnalytics: React.FC = () => {
  const [enterprises, setEnterprises] = useState<any[]>([])
  const [enterpriseId, setEnterpriseId] = useState('')
  const [tab, setTab] = useState<'dashboard' | 'zones' | 'events' | 'heatmap'>('dashboard')
  const [dashboard, setDashboard] = useState<any>(null)
  const [zones, setZones] = useState<GeofenceZone[]>([])
  const [events, setEvents] = useState<GeospatialEvent[]>([])
  const [heatmapData, setHeatmapData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [showZoneForm, setShowZoneForm] = useState(false)
  const [showEventForm, setShowEventForm] = useState(false)
  const [trailAnimalId, setTrailAnimalId] = useState('')
  const [trailData, setTrailData] = useState<any>(null)

  const [zoneForm, setZoneForm] = useState({
    name: '', zoneType: 'pasture', centerLat: '', centerLng: '', radiusMeters: '100',
    color: '#22c55e', alertOnEntry: true, alertOnExit: false, isRestricted: false,
  })
  const [eventForm, setEventForm] = useState({
    animalId: '', eventType: 'location_update', latitude: '', longitude: '', metadata: '',
  })

  useEffect(() => { apiService.listEnterprises().then(r => setEnterprises(r.data?.items || r.data || [])).catch(() => {}) }, [])

  useEffect(() => { if (enterpriseId) fetchAll() }, [enterpriseId])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [dRes, zRes, eRes, hRes] = await Promise.all([
        apiService.getGeospatialDashboard(enterpriseId),
        apiService.listGeofenceZones(enterpriseId),
        apiService.listGeospatialEvents(enterpriseId),
        apiService.getHeatmapData(enterpriseId),
      ])
      setDashboard(dRes.data)
      setZones(zRes.data?.items || [])
      setEvents(eRes.data?.items || [])
      setHeatmapData(hRes.data?.clusters || hRes.data || [])
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  const createZone = async () => {
    if (!zoneForm.name || !zoneForm.centerLat || !zoneForm.centerLng) return
    try {
      await apiService.createGeofenceZone(enterpriseId, {
        ...zoneForm, centerLat: +zoneForm.centerLat, centerLng: +zoneForm.centerLng, radiusMeters: +zoneForm.radiusMeters,
      })
      setShowZoneForm(false)
      setSuccessMsg('Zone created!')
      fetchAll()
    } catch (e: any) { setError(e.message) }
  }

  const createEvent = async () => {
    if (!eventForm.animalId || !eventForm.latitude || !eventForm.longitude) return
    try {
      await apiService.createGeospatialEvent(enterpriseId, {
        ...eventForm, latitude: +eventForm.latitude, longitude: +eventForm.longitude,
        metadata: eventForm.metadata ? JSON.parse(eventForm.metadata) : undefined,
      })
      setShowEventForm(false)
      setSuccessMsg('Event recorded!')
      fetchAll()
    } catch (e: any) { setError(e.message) }
  }

  const loadTrail = async () => {
    if (!trailAnimalId) return
    try {
      const r = await apiService.getMovementTrail(trailAnimalId)
      setTrailData(r.data)
    } catch (e: any) { setError(e.message) }
  }

  if (!enterpriseId) {
    return (
      <div className="module-page">
        <div className="module-header"><h1>🗺️ Geospatial Analytics</h1></div>
        <div className="module-card">
          <h3>Select Enterprise</h3>
          <select className="module-input" value="" onChange={e => setEnterpriseId(e.target.value)}>
            <option value="">Choose enterprise...</option>
            {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
          </select>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>🗺️ Geospatial Analytics</h1>
          <p style={{ color: '#666', margin: '8px 0 0' }}>Geofencing, location tracking, heatmaps, and movement trails</p>
        </div>
        <select className="module-input" style={{ width: 220 }} value={enterpriseId} onChange={e => setEnterpriseId(e.target.value)}>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {error && <div className="module-alert error">{error} <button onClick={() => setError('')}>✕</button></div>}
      {successMsg && <div className="module-alert success">{successMsg} <button onClick={() => setSuccessMsg('')}>✕</button></div>}

      <div className="module-tabs">
        {(['dashboard', 'zones', 'events', 'heatmap'] as const).map(t => (
          <button key={t} className={`module-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'dashboard' ? '📊 Dashboard' : t === 'zones' ? '📍 Zones' : t === 'events' ? '📡 Events' : '🔥 Heatmap & Trails'}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading...</div>}

      {!loading && tab === 'dashboard' && dashboard && (
        <div>
          <div className="module-stats">
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.totalZones || 0}</div><div className="stat-label">Total Zones</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.activeZones || 0}</div><div className="stat-label">Active Zones</div></div>
            <div className="stat-card"><div className="stat-value" style={{ color: '#ef4444' }}>{dashboard.summary?.restrictedZones || 0}</div><div className="stat-label">Restricted</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.events24h || 0}</div><div className="stat-label">Events (24h)</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.trackedAnimals || 0}</div><div className="stat-label">Tracked Animals</div></div>
          </div>

          {dashboard.zones?.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3>Zone Overview</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {dashboard.zones.map((z: any) => (
                  <div key={z.id} className="module-card" style={{ borderLeft: `4px solid ${ZONE_COLORS[z.zone_type] || '#3b82f6'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0 }}>{z.name}</h4>
                      <span className={`module-badge ${z.is_restricted ? 'error' : 'success'}`}>{z.is_restricted ? 'Restricted' : 'Open'}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{z.zone_type} · {z.radius_meters}m radius</div>
                    <div style={{ fontSize: 12, color: '#aaa' }}>📍 {(+z.center_lat).toFixed(4)}, {(+z.center_lng).toFixed(4)}</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>Events: {z.event_count || 0}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dashboard.recentEvents?.length > 0 && (
            <div className="module-card" style={{ marginTop: 20 }}>
              <h3>Recent Events</h3>
              <table className="module-table"><thead><tr><th>Time</th><th>Animal</th><th>Type</th><th>Zone</th><th>Location</th></tr></thead>
                <tbody>{dashboard.recentEvents.map((ev: any) => (
                  <tr key={ev.id}><td>{new Date(ev.recorded_at).toLocaleString()}</td><td>{ev.animal_name}</td>
                    <td><span className={`module-badge ${ev.event_type === 'zone_breach' ? 'error' : ''}`}>{ev.event_type}</span></td>
                    <td>{ev.zone_name || '—'}</td><td>{(+ev.latitude).toFixed(4)}, {(+ev.longitude).toFixed(4)}</td></tr>
                ))}</tbody></table>
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'zones' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="module-btn primary" onClick={() => setShowZoneForm(true)}>+ New Zone</button>
          </div>
          {showZoneForm && (
            <div className="module-card" style={{ marginBottom: 20 }}>
              <h3>Create Geofence Zone</h3>
              <div className="module-form">
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 2 }}><label className="module-label">Zone Name</label><input className="module-input" value={zoneForm.name} onChange={e => setZoneForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. North Pasture" /></div>
                  <div style={{ flex: 1 }}><label className="module-label">Type</label>
                    <select className="module-input" value={zoneForm.zoneType} onChange={e => setZoneForm(f => ({ ...f, zoneType: e.target.value, color: ZONE_COLORS[e.target.value] || '#3b82f6' }))}>
                      {ZONE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}><label className="module-label">Center Latitude</label><input className="module-input" type="number" step="0.0001" value={zoneForm.centerLat} onChange={e => setZoneForm(f => ({ ...f, centerLat: e.target.value }))} placeholder="e.g. 40.7128" /></div>
                  <div style={{ flex: 1 }}><label className="module-label">Center Longitude</label><input className="module-input" type="number" step="0.0001" value={zoneForm.centerLng} onChange={e => setZoneForm(f => ({ ...f, centerLng: e.target.value }))} placeholder="e.g. -74.0060" /></div>
                  <div style={{ flex: 1 }}><label className="module-label">Radius (meters)</label><input className="module-input" type="number" value={zoneForm.radiusMeters} onChange={e => setZoneForm(f => ({ ...f, radiusMeters: e.target.value }))} /></div>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div><label className="module-label">Color</label><input type="color" value={zoneForm.color} onChange={e => setZoneForm(f => ({ ...f, color: e.target.value }))} /></div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={zoneForm.alertOnEntry} onChange={e => setZoneForm(f => ({ ...f, alertOnEntry: e.target.checked }))} />Alert on Entry</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={zoneForm.alertOnExit} onChange={e => setZoneForm(f => ({ ...f, alertOnExit: e.target.checked }))} />Alert on Exit</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={zoneForm.isRestricted} onChange={e => setZoneForm(f => ({ ...f, isRestricted: e.target.checked }))} />Restricted Zone</label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="module-btn primary" onClick={createZone}>Create Zone</button>
                <button className="module-btn" onClick={() => setShowZoneForm(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {zones.map(z => (
              <div key={z.id} className="module-card" style={{ borderLeft: `4px solid ${z.color || ZONE_COLORS[z.zoneType] || '#3b82f6'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0 }}>{z.name}</h4>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {z.isRestricted && <span className="module-badge error">🚫 Restricted</span>}
                    <span className={`module-badge ${z.status === 'active' ? 'success' : ''}`}>{z.status === 'active' ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 6 }}>
                  {z.zoneType} · {z.radiusMeters}m radius
                </div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                  📍 {z.centerLat?.toFixed(4)}, {z.centerLng?.toFixed(4)}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12 }}>
                  {z.alertOnEntry && <span>🔔 Entry Alerts</span>}
                  {z.alertOnExit && <span>🔕 Exit Alerts</span>}
                </div>
              </div>
            ))}
            {zones.length === 0 && <p style={{ color: '#888' }}>No zones created yet</p>}
          </div>
        </div>
      )}

      {!loading && tab === 'events' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="module-btn primary" onClick={() => setShowEventForm(true)}>+ Record Event</button>
          </div>
          {showEventForm && (
            <div className="module-card" style={{ marginBottom: 20 }}>
              <h3>Record Geospatial Event</h3>
              <div className="module-form">
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}><label className="module-label">Animal ID</label><input className="module-input" value={eventForm.animalId} onChange={e => setEventForm(f => ({ ...f, animalId: e.target.value }))} placeholder="Enter animal UUID" /></div>
                  <div style={{ flex: 1 }}><label className="module-label">Event Type</label>
                    <select className="module-input" value={eventForm.eventType} onChange={e => setEventForm(f => ({ ...f, eventType: e.target.value }))}>
                      {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}><label className="module-label">Latitude</label><input className="module-input" type="number" step="0.0001" value={eventForm.latitude} onChange={e => setEventForm(f => ({ ...f, latitude: e.target.value }))} /></div>
                  <div style={{ flex: 1 }}><label className="module-label">Longitude</label><input className="module-input" type="number" step="0.0001" value={eventForm.longitude} onChange={e => setEventForm(f => ({ ...f, longitude: e.target.value }))} /></div>
                </div>
                <div><label className="module-label">Metadata (JSON, optional)</label><input className="module-input" value={eventForm.metadata} onChange={e => setEventForm(f => ({ ...f, metadata: e.target.value }))} placeholder='{"speed": 5.2, "heading": 270}' /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="module-btn primary" onClick={createEvent}>Record Event</button>
                <button className="module-btn" onClick={() => setShowEventForm(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div className="module-card">
            <table className="module-table">
              <thead><tr><th>Time</th><th>Animal</th><th>Type</th><th>Zone</th><th>Location</th><th>Details</th></tr></thead>
              <tbody>
                {events.map(ev => (
                  <tr key={ev.id}>
                    <td>{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '—'}</td>
                    <td>{ev.animalName || ev.animalId}</td>
                    <td><span className={`module-badge ${ev.eventType === 'boundary_breach' ? 'error' : ev.eventType === 'speed_alert' ? 'error' : ''}`}>{ev.eventType?.replace(/_/g, ' ')}</span></td>
                    <td>{ev.zoneName || '—'}</td>
                    <td style={{ fontSize: 12 }}>{ev.latitude?.toFixed(4)}, {ev.longitude?.toFixed(4)}</td>
                    <td style={{ fontSize: 12 }}>{ev.metadata ? JSON.stringify(ev.metadata).slice(0, 60) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {events.length === 0 && <p style={{ textAlign: 'center', color: '#888' }}>No events recorded yet</p>}
          </div>
        </div>
      )}

      {!loading && tab === 'heatmap' && (
        <div>
          <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
            <div className="module-card" style={{ flex: 1 }}>
              <h3>🔥 Location Heatmap Data</h3>
              <p style={{ fontSize: 13, color: '#888' }}>Clustered location density data (rounded to 3 decimal places)</p>
              {heatmapData.length > 0 ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginTop: 12 }}>
                    {heatmapData.slice(0, 50).map((c: any, i: number) => (
                      <div key={i} style={{ padding: 12, borderRadius: 8, textAlign: 'center',
                        background: `rgba(239,68,68,${Math.min(+c.intensity / 20, 1)})`, color: +c.intensity > 10 ? 'white' : '#333' }}>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>{c.intensity}</div>
                        <div style={{ fontSize: 11 }}>{c.lat}, {c.lng}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 12, color: '#888', marginTop: 8 }}>Showing {Math.min(heatmapData.length, 50)} of {heatmapData.length} clusters</div>
                </div>
              ) : <p style={{ color: '#888' }}>No location data available yet. Record events to build heatmap.</p>}
            </div>
          </div>

          <div className="module-card">
            <h3>🐾 Movement Trail</h3>
            <p style={{ fontSize: 13, color: '#888' }}>Track an animal's movement path over time</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input className="module-input" placeholder="Enter Animal ID" value={trailAnimalId}
                onChange={e => setTrailAnimalId(e.target.value)} style={{ flex: 1 }} />
              <button className="module-btn primary" onClick={loadTrail}>Load Trail</button>
            </div>

            {trailData && (
              <div style={{ marginTop: 16 }}>
                <div className="module-stats">
                  <div className="stat-card"><div className="stat-value">{trailData.pointCount || 0}</div><div className="stat-label">Points</div></div>
                  <div className="stat-card"><div className="stat-value">{trailData.totalDistanceKm?.toFixed(2) || 0}</div><div className="stat-label">Distance (km)</div></div>
                </div>
                {trailData.trail?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <h4>Trail Points</h4>
                    <table className="module-table">
                      <thead><tr><th>#</th><th>Time</th><th>Lat</th><th>Lng</th><th>Type</th></tr></thead>
                      <tbody>
                        {trailData.trail.slice(0, 50).map((p: any, i: number) => (
                          <tr key={i}><td>{i + 1}</td><td>{new Date(p.recorded_at).toLocaleString()}</td>
                            <td>{(+p.latitude).toFixed(5)}</td><td>{(+p.longitude).toFixed(5)}</td><td>{p.event_type}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default GeospatialAnalytics
