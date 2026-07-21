import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { GeofenceZone, GeospatialEvent } from '../types'
import MapView from '../components/MapView'
import { useTranslation } from 'react-i18next'
import SearchSelect, { SearchSelectOption } from '../components/SearchSelect'

const ZONE_TYPES = ['pasture', 'barn', 'medical', 'quarantine', 'feeding', 'water', 'boundary', 'custom']
const ZONE_COLORS: Record<string, string> = { pasture: '#22c55e', barn: '#a78bfa', medical: '#ef4444', quarantine: '#f97316', feeding: '#eab308', water: '#3b82f6', boundary: '#64748b', custom: '#ec4899' }
const EVENT_TYPES = ['location_update', 'zone_entry', 'zone_exit', 'zone_breach', 'sos_alert']

const GeospatialAnalytics: React.FC = () => {
  const { t } = useTranslation()

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
  const [trailAnimalLabel, setTrailAnimalLabel] = useState('')
  const [eventAnimalLabel, setEventAnimalLabel] = useState('')
  const [trailData, setTrailData] = useState<any>(null)

  const [zoneForm, setZoneForm] = useState({
    name: '', zoneType: 'pasture', centerLat: '', centerLng: '', radiusMeters: '100',
    color: '#22c55e', alertOnEntry: true, alertOnExit: false, isRestricted: false,
  })
  const [eventForm, setEventForm] = useState({
    animalId: '', eventType: 'location_update', latitude: '', longitude: '', metadata: '',
  })

  useEffect(() => { apiService.listEnterprises().then(r => setEnterprises(r.data?.items || r.data || [])).catch(() => setError(t('geospatialAnalytics.enterprisesLoadFailed'))) }, [t])

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
      setHeatmapData(hRes.data?.points || hRes.data?.clusters || [])
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
      setSuccessMsg(t('geospatialAnalytics.zoneCreated'))
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
      setSuccessMsg(t('geospatialAnalytics.eventRecorded'))
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
        <div className="module-header"><h1>{t('geospatialAnalytics.pageTitle')}</h1></div>
        <div className="module-card">
          <h3>{t('common.selectEnterprise')}</h3>
          <select className="module-input" value="" onChange={e => setEnterpriseId(e.target.value)}>
            <option value="">{t('geospatialAnalytics.chooseEnterprise')}</option>
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
          <h1>{t('geospatialAnalytics.pageTitle')}</h1>
          <p style={{ color: '#666', margin: '8px 0 0' }}>{t('geospatialAnalytics.subtitle')}</p>
        </div>
        <select className="module-input" style={{ width: 220 }} value={enterpriseId} onChange={e => setEnterpriseId(e.target.value)}>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {error && <div className="module-alert error">{error} <button onClick={() => setError('')}>✕</button></div>}
      {successMsg && <div className="module-alert success">{successMsg} <button onClick={() => setSuccessMsg('')}>✕</button></div>}

      <div className="module-tabs">
        {(['dashboard', 'zones', 'events', 'heatmap'] as const).map(tb => (
          <button key={tb} className={`module-tab ${tab === tb ? 'active' : ''}`} onClick={() => setTab(tb)}>
            {tb === 'dashboard' ? t('geospatialAnalytics.tabs.dashboard') : tb === 'zones' ? t('geospatialAnalytics.tabs.zones') : tb === 'events' ? t('geospatialAnalytics.tabs.events') : t('geospatialAnalytics.tabs.heatmap')}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>{t('common.loading')}</div>}

      {!loading && tab === 'dashboard' && dashboard && (
        <div>
          <div className="module-stats">
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.totalZones || 0}</div><div className="stat-label">{t('geospatialAnalytics.stats.totalZones')}</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.activeZones || 0}</div><div className="stat-label">{t('geospatialAnalytics.stats.activeZones')}</div></div>
            <div className="stat-card"><div className="stat-value" style={{ color: '#ef4444' }}>{dashboard.summary?.restrictedZones || 0}</div><div className="stat-label">{t('geospatialAnalytics.stats.restricted')}</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.events24h || 0}</div><div className="stat-label">{t('geospatialAnalytics.stats.events24h')}</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.trackedAnimals || 0}</div><div className="stat-label">{t('geospatialAnalytics.stats.trackedAnimals')}</div></div>
          </div>

          {/* Interactive Overview Map */}
          <div className="module-card" style={{ marginTop: 20, padding: 0, overflow: 'hidden', borderRadius: 12 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0 }}>📍 {t('geospatialAnalytics.liveZoneEventMap')}</h3>
              <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>Zones shown as circles, recent events as markers</p>
            </div>
            <MapView
              height={480}
              circles={(dashboard.zones || []).map((z: any) => ({
                id: z.id,
                lat: +z.center_lat,
                lng: +z.center_lng,
                radius: +z.radius_meters,
                color: ZONE_COLORS[z.zone_type] || '#3b82f6',
                fillOpacity: z.is_restricted ? 0.35 : 0.15,
                popup: (
                  <div>
                    <strong>{z.name}</strong><br />
                    <span style={{ fontSize: 12 }}>{z.zone_type} · {z.radius_meters}m radius</span><br />
                    {z.is_restricted && <span style={{ color: '#ef4444', fontSize: 12 }}>🚫 Restricted Zone</span>}
                    <div style={{ fontSize: 12, marginTop: 4 }}>Events: {z.event_count || 0}</div>
                  </div>
                ),
              }))}
              markers={(dashboard.recentEvents || []).map((ev: any) => ({
                id: ev.id,
                lat: +ev.latitude,
                lng: +ev.longitude,
                color: ev.event_type === 'zone_breach' ? '#ef4444' : ev.event_type === 'sos_alert' ? '#f97316' : '#3b82f6',
                pulse: ev.event_type === 'zone_breach' || ev.event_type === 'sos_alert',
                popup: (
                  <div>
                    <strong>{ev.animal_name}</strong><br />
                    <span className={`module-badge ${ev.event_type === 'zone_breach' ? 'error' : ''}`} style={{ fontSize: 11 }}>{ev.event_type}</span><br />
                    {ev.zone_name && <span style={{ fontSize: 12 }}>Zone: {ev.zone_name}</span>}<br />
                    <span style={{ fontSize: 11, color: '#888' }}>{ev.recorded_at ? new Date(ev.recorded_at).toLocaleString() : ''}</span>
                  </div>
                ),
              }))}
            />
          </div>

          {dashboard.recentEvents?.length > 0 && (
            <div className="module-card" style={{ marginTop: 20 }}>
              <h3>{t('geospatialAnalytics.recentEvents')}</h3>
              <table className="module-table"><thead><tr><th>{t('iotSensors.time')}</th><th>{t('genomicLineage.animal')}</th><th>{t('common.type')}</th><th>{t('geospatialAnalytics.zone')}</th><th>{t('geospatialAnalytics.location')}</th></tr></thead>
                <tbody>{dashboard.recentEvents.map((ev: any) => (
                  <tr key={ev.id}><td>{ev.recorded_at ? new Date(ev.recorded_at).toLocaleString() : '–'}</td><td>{ev.animal_name}</td>
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
            <button className="module-btn primary" onClick={() => setShowZoneForm(true)}>{t('geospatialAnalytics.newZone')}</button>
          </div>
          {showZoneForm && (
            <div className="module-card" style={{ marginBottom: 20 }}>
              <h3>{t('geospatialAnalytics.createZone')}</h3>
              <p style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>💡 Click on the map below to set the zone center coordinates</p>
              <div className="module-form">
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 2 }}><label className="module-label">{t('geospatialAnalytics.zoneName')}</label><input className="module-input" value={zoneForm.name} onChange={e => setZoneForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. North Pasture" /></div>
                  <div style={{ flex: 1 }}><label className="module-label">{t('common.type')}</label>
                    <select className="module-input" value={zoneForm.zoneType} onChange={e => setZoneForm(f => ({ ...f, zoneType: e.target.value, color: ZONE_COLORS[e.target.value] || '#3b82f6' }))}>
                      {ZONE_TYPES.map(zt => <option key={zt} value={zt}>{zt}</option>)}</select></div>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}><label className="module-label">{t('geospatialAnalytics.centerLatitude')}</label><input className="module-input" type="number" step="0.0001" value={zoneForm.centerLat} onChange={e => setZoneForm(f => ({ ...f, centerLat: e.target.value }))} placeholder="Click map or type" /></div>
                  <div style={{ flex: 1 }}><label className="module-label">{t('geospatialAnalytics.centerLongitude')}</label><input className="module-input" type="number" step="0.0001" value={zoneForm.centerLng} onChange={e => setZoneForm(f => ({ ...f, centerLng: e.target.value }))} placeholder="Click map or type" /></div>
                  <div style={{ flex: 1 }}><label className="module-label">{t('geospatialAnalytics.radiusMeters')}</label><input className="module-input" type="number" value={zoneForm.radiusMeters} onChange={e => setZoneForm(f => ({ ...f, radiusMeters: e.target.value }))} /></div>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div><label className="module-label">{t('geospatialAnalytics.color')}</label><input type="color" value={zoneForm.color} onChange={e => setZoneForm(f => ({ ...f, color: e.target.value }))} /></div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={zoneForm.alertOnEntry} onChange={e => setZoneForm(f => ({ ...f, alertOnEntry: e.target.checked }))} />{t('geospatialAnalytics.alertOnEntry')}</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={zoneForm.alertOnExit} onChange={e => setZoneForm(f => ({ ...f, alertOnExit: e.target.checked }))} />{t('geospatialAnalytics.alertOnExit')}</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={zoneForm.isRestricted} onChange={e => setZoneForm(f => ({ ...f, isRestricted: e.target.checked }))} />{t('geospatialAnalytics.restrictedZone')}</label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="module-btn primary" onClick={createZone}>{t('geospatialAnalytics.createZone')}</button>
                <button className="module-btn" onClick={() => setShowZoneForm(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          )}

          {/* Interactive Zone Map */}
          <div className="module-card" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, marginBottom: 20 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0 }}>📍 {t('geospatialAnalytics.geofenceZonesMap')}</h3>
              <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>
                {zones.length} zone{zones.length !== 1 ? 's' : ''} · Click map to set new zone center
              </p>
            </div>
            <MapView
              height={450}
              circles={zones.map(z => ({
                id: z.id,
                lat: +(z.centerLat ?? 0),
                lng: +(z.centerLng ?? 0),
                radius: +(z.radiusMeters ?? 100),
                color: z.color || ZONE_COLORS[z.zoneType] || '#3b82f6',
                fillOpacity: z.isRestricted ? 0.35 : 0.15,
                popup: (
                  <div>
                    <strong>{z.name}</strong><br />
                    <span style={{ fontSize: 12 }}>{z.zoneType} · {z.radiusMeters}m radius</span><br />
                    {z.isRestricted && <span style={{ color: '#ef4444', fontSize: 12 }}>🚫 Restricted</span>}
                    {z.alertOnEntry && <span style={{ fontSize: 12 }}> · 🔔 Entry</span>}
                    {z.alertOnExit && <span style={{ fontSize: 12 }}> · 🔕 Exit</span>}
                  </div>
                ),
              }))}
              markers={zoneForm.centerLat && zoneForm.centerLng ? [{
                id: 'new-zone-center',
                lat: +zoneForm.centerLat,
                lng: +zoneForm.centerLng,
                color: zoneForm.color || '#ec4899',
                pulse: true,
                popup: <div><strong>New Zone Center</strong><br /><span style={{ fontSize: 12 }}>{zoneForm.centerLat}, {zoneForm.centerLng}</span></div>,
              }] : []}
              onClick={(lat, lng) => {
                if (showZoneForm) {
                  setZoneForm(f => ({ ...f, centerLat: lat.toFixed(6), centerLng: lng.toFixed(6) }))
                }
              }}
              fitToData={zones.length > 0}
            />
          </div>

          {/* Zone List */}
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
                <div style={{ fontSize: 13, color: '#888', marginTop: 6 }}>{z.zoneType} · {z.radiusMeters}m radius</div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>📍 {(+(z.centerLat ?? 0)).toFixed(4)}, {(+(z.centerLng ?? 0)).toFixed(4)}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12 }}>
                  {z.alertOnEntry && <span>🔔 Entry Alerts</span>}
                  {z.alertOnExit && <span>🔕 Exit Alerts</span>}
                </div>
              </div>
            ))}
            {zones.length === 0 && <p style={{ color: '#888' }}>{t('geospatialAnalytics.noZones')}</p>}
          </div>
        </div>
      )}

      {!loading && tab === 'events' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="module-btn primary" onClick={() => setShowEventForm(true)}>{t('geospatialAnalytics.recordEvent')}</button>
          </div>
          {showEventForm && (
            <div className="module-card" style={{ marginBottom: 20 }}>
              <h3>{t('geospatialAnalytics.recordGeospatialEvent')}</h3>
              <p style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>💡 Click on the map below to set the event coordinates</p>
              <div className="module-form">
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}><label className="module-label">{t('geospatialAnalytics.animalId')}</label>
                    <SearchSelect
                      placeholder="Search animal by name..."
                      value={eventForm.animalId}
                      displayValue={eventAnimalLabel}
                      loadOnOpen={true}
                      onSelect={(val, label) => { setEventForm(f => ({ ...f, animalId: val })); setEventAnimalLabel(label) }}
                      onClear={() => { setEventForm(f => ({ ...f, animalId: '' })); setEventAnimalLabel('') }}
                      onSearch={async (q: string): Promise<SearchSelectOption[]> => {
                        if (!enterpriseId) return []
                        const res = await apiService.get(`/enterprises/${enterpriseId}/animals`, { params: { search: q, limit: 20 } })
                        const items = res.data?.items || res.data?.animals || res.data || []
                        return items.map((a: any) => ({ value: a.id, label: a.name, sublabel: [a.species, a.breed].filter(Boolean).join(' · ') }))
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}><label className="module-label">{t('geospatialAnalytics.eventType')}</label>
                    <select className="module-input" value={eventForm.eventType} onChange={e => setEventForm(f => ({ ...f, eventType: e.target.value }))}>
                      {EVENT_TYPES.map(et => <option key={et} value={et}>{et.replace(/_/g, ' ')}</option>)}</select></div>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}><label className="module-label">{t('geospatialAnalytics.latitude')}</label><input className="module-input" type="number" step="0.0001" value={eventForm.latitude} onChange={e => setEventForm(f => ({ ...f, latitude: e.target.value }))} placeholder="Click map or type" /></div>
                  <div style={{ flex: 1 }}><label className="module-label">{t('geospatialAnalytics.longitude')}</label><input className="module-input" type="number" step="0.0001" value={eventForm.longitude} onChange={e => setEventForm(f => ({ ...f, longitude: e.target.value }))} placeholder="Click map or type" /></div>
                </div>
                <div><label className="module-label">{t('geospatialAnalytics.metadata')}</label><input className="module-input" value={eventForm.metadata} onChange={e => setEventForm(f => ({ ...f, metadata: e.target.value }))} placeholder='{"speed": 5.2, "heading": 270}' /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="module-btn primary" onClick={createEvent}>{t('geospatialAnalytics.recordEvent')}</button>
                <button className="module-btn" onClick={() => setShowEventForm(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          )}

          {/* Interactive Events Map */}
          <div className="module-card" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, marginBottom: 20 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0 }}>📡 {t('geospatialAnalytics.eventLocationsMap')}</h3>
              <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>
                {events.length} event{events.length !== 1 ? 's' : ''} · Click map to set event coordinates
              </p>
            </div>
            <MapView
              height={420}
              markers={[
                ...events.map(ev => {
                  const et = ev.eventType as string
                  return {
                  id: ev.id,
                  lat: +(ev.latitude ?? 0),
                  lng: +(ev.longitude ?? 0),
                  color: et === 'zone_breach' || et === 'boundary_breach' ? '#ef4444'
                    : et === 'sos_alert' || et === 'speed_alert' ? '#f97316'
                    : et === 'zone_entry' || et === 'zone_exit' ? '#8b5cf6'
                    : '#22c55e',
                  pulse: et === 'zone_breach' || et === 'sos_alert',
                  popup: (
                    <div>
                      <strong>{ev.animalName || ev.animalId}</strong><br />
                      <span className={`module-badge ${et === 'boundary_breach' || et === 'zone_breach' ? 'error' : ''}`}
                        style={{ fontSize: 11 }}>{ev.eventType?.replace(/_/g, ' ')}</span><br />
                      {ev.zoneName && <span style={{ fontSize: 12 }}>Zone: {ev.zoneName}</span>}
                      {ev.zoneName && <br />}
                      <span style={{ fontSize: 11, color: '#888' }}>{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}</span>
                      {ev.metadata && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{JSON.stringify(ev.metadata).slice(0, 80)}</div>}
                    </div>
                  ),
                }}),
                ...(eventForm.latitude && eventForm.longitude ? [{
                  id: 'new-event-point',
                  lat: +eventForm.latitude,
                  lng: +eventForm.longitude,
                  color: '#ec4899',
                  pulse: true,
                  popup: <div><strong>New Event Location</strong><br /><span style={{ fontSize: 12 }}>{eventForm.latitude}, {eventForm.longitude}</span></div>,
                }] : []),
              ]}
              circles={zones.map(z => ({
                id: `zone-bg-${z.id}`,
                lat: +(z.centerLat ?? 0),
                lng: +(z.centerLng ?? 0),
                radius: +(z.radiusMeters ?? 100),
                color: z.color || ZONE_COLORS[z.zoneType] || '#3b82f6',
                fillOpacity: 0.08,
                popup: <span style={{ fontSize: 12 }}>{z.name}</span>,
              }))}
              onClick={(lat, lng) => {
                if (showEventForm) {
                  setEventForm(f => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))
                }
              }}
              fitToData={events.length > 0}
            />
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', fontSize: 12 }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#22c55e', marginRight: 4 }}></span>{t('geospatialAnalytics.legend.locationUpdate')}</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6', marginRight: 4 }}></span>{t('geospatialAnalytics.legend.zoneEntryExit')}</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ef4444', marginRight: 4 }}></span>{t('geospatialAnalytics.legend.breach')}</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#f97316', marginRight: 4 }}></span>{t('geospatialAnalytics.legend.sosAlert')}</span>
          </div>

          <div className="module-card">
              <h3>{t('geospatialAnalytics.eventLog')}</h3>
            <table className="module-table">
              <thead><tr><th>{t('iotSensors.time')}</th><th>{t('genomicLineage.animal')}</th><th>{t('common.type')}</th><th>{t('geospatialAnalytics.zone')}</th><th>{t('geospatialAnalytics.location')}</th><th>{t('geospatialAnalytics.details')}</th></tr></thead>
              <tbody>
                {events.map(ev => (
                  <tr key={ev.id}>
                    <td>{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '—'}</td>
                    <td>{ev.animalName || ev.animalId}</td>
                    <td><span className={`module-badge ${ev.eventType === 'boundary_breach' ? 'error' : ev.eventType === 'speed_alert' ? 'error' : ''}`}>{ev.eventType?.replace(/_/g, ' ')}</span></td>
                    <td>{ev.zoneName || '—'}</td>
                    <td style={{ fontSize: 12 }}>{(+(ev.latitude ?? 0)).toFixed(4)}, {(+(ev.longitude ?? 0)).toFixed(4)}</td>
                    <td style={{ fontSize: 12 }}>{ev.metadata ? JSON.stringify(ev.metadata).slice(0, 60) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {events.length === 0 && <p style={{ textAlign: 'center', color: '#888' }}>{t('geospatialAnalytics.noEvents')}</p>}
          </div>
        </div>
      )}

      {!loading && tab === 'heatmap' && (
        <div>
          {/* Interactive Heatmap */}
          <div className="module-card" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, marginBottom: 24 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0 }}>🔥 {t('geospatialAnalytics.locationDensityHeatmap')}</h3>
              <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>
                {heatmapData.length} data point{heatmapData.length !== 1 ? 's' : ''} · Warmer colors indicate higher activity
              </p>
            </div>
            <MapView
              height={480}
              heatmap={heatmapData.map((c: any) => ({
                lat: +c.lat,
                lng: +c.lng,
                intensity: +(c.intensity || c.count || 1),
              }))}
              circles={zones.map(z => ({
                id: `hm-zone-${z.id}`,
                lat: +(z.centerLat ?? 0),
                lng: +(z.centerLng ?? 0),
                radius: +(z.radiusMeters ?? 100),
                color: '#64748b',
                fillOpacity: 0.05,
                popup: <span style={{ fontSize: 12 }}>{z.name}</span>,
              }))}
              fitToData={heatmapData.length > 0}
            />
            {heatmapData.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: '#888', borderTop: '1px solid #e5e7eb' }}>
                {t('geospatialAnalytics.noLocationData')}
              </div>
            )}
          </div>

          {/* Movement Trail */}
          <div className="module-card">
            <h3>🐾 {t('geospatialAnalytics.movementTrail')}</h3>
            <p style={{ fontSize: 13, color: '#888' }}>{t('geospatialAnalytics.trackAnimalMovement')}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <div style={{ flex: 1 }}>
                <SearchSelect
                  placeholder="Search animal by name..."
                  value={trailAnimalId}
                  displayValue={trailAnimalLabel}
                  loadOnOpen={true}
                  onSelect={(val, label) => { setTrailAnimalId(val); setTrailAnimalLabel(label) }}
                  onClear={() => { setTrailAnimalId(''); setTrailAnimalLabel(''); setTrailData(null) }}
                  onSearch={async (q: string): Promise<SearchSelectOption[]> => {
                    if (!enterpriseId) return []
                    const res = await apiService.get(`/enterprises/${enterpriseId}/animals`, { params: { search: q, limit: 20 } })
                    const items = res.data?.items || res.data?.animals || res.data || []
                    return items.map((a: any) => ({ value: a.id, label: a.name, sublabel: [a.species, a.breed].filter(Boolean).join(' · ') }))
                  }}
                />
              </div>
              <button className="module-btn primary" onClick={loadTrail}>{t('geospatialAnalytics.loadTrail')}</button>
            </div>

            {trailData && (
              <div style={{ marginTop: 16 }}>
                <div className="module-stats">
                  <div className="stat-card"><div className="stat-value">{trailData.pointCount || 0}</div><div className="stat-label">{t('geospatialAnalytics.points')}</div></div>
                  <div className="stat-card"><div className="stat-value">{(+(trailData.totalDistanceKm ?? 0)).toFixed(2)}</div><div className="stat-label">{t('geospatialAnalytics.distanceKm')}</div></div>
                </div>

                {/* Trail Map */}
                {trailData.trail?.length > 0 && (
                  <div style={{ marginTop: 16, borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                    <MapView
                      height={400}
                      polylines={[{
                        id: `trail-${trailAnimalId}`,
                        positions: trailData.trail.map((p: any) => [+p.latitude, +p.longitude] as [number, number]),
                        color: '#3b82f6',
                        weight: 3,
                        dashArray: '8, 6',
                      }]}
                      markers={[
                        ...(trailData.trail.length > 0 ? [{
                          id: 'trail-start',
                          lat: +trailData.trail[0].latitude,
                          lng: +trailData.trail[0].longitude,
                          color: '#22c55e',
                          popup: (
                            <div>
                              <strong>Start</strong><br />
                              <span style={{ fontSize: 12 }}>{trailData.trail[0].recorded_at ? new Date(trailData.trail[0].recorded_at).toLocaleString() : '—'}</span>
                            </div>
                          ),
                        }] : []),
                        ...(trailData.trail.length > 1 ? [{
                          id: 'trail-end',
                          lat: +trailData.trail[trailData.trail.length - 1].latitude,
                          lng: +trailData.trail[trailData.trail.length - 1].longitude,
                          color: '#ef4444',
                          pulse: true,
                          popup: (
                            <div>
                              <strong>Latest Position</strong><br />
                              <span style={{ fontSize: 12 }}>{trailData.trail[trailData.trail.length - 1].recorded_at ? new Date(trailData.trail[trailData.trail.length - 1].recorded_at).toLocaleString() : '—'}</span>
                            </div>
                          ),
                        }] : []),
                      ]}
                      fitToData
                    />
                  </div>
                )}

                {trailData.trail?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <details>
                      <summary style={{ cursor: 'pointer', fontSize: 13, color: '#666' }}>📋 Trail Points Table ({trailData.trail.length} points)</summary>
                      <table className="module-table" style={{ marginTop: 8 }}>
                        <thead><tr><th>#</th><th>{t('iotSensors.time')}</th><th>{t('geospatialAnalytics.lat')}</th><th>{t('geospatialAnalytics.lng')}</th><th>{t('common.type')}</th></tr></thead>
                        <tbody>
                          {trailData.trail.slice(0, 50).map((p: any, i: number) => (
                            <tr key={i}><td>{i + 1}</td><td>{p.recorded_at ? new Date(p.recorded_at).toLocaleString() : '–'}</td>
                              <td>{(+p.latitude).toFixed(5)}</td><td>{(+p.longitude).toFixed(5)}</td><td>{p.event_type}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
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
