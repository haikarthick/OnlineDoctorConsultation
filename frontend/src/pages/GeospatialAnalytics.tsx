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
          <p className="si-f80b783e">{t('geospatialAnalytics.subtitle')}</p>
        </div>
        <select className="module-input si-1af35bc5" value={enterpriseId} onChange={e => setEnterpriseId(e.target.value)}>
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

      {loading && <div className="si-6a429654">{t('common.loading')}</div>}

      {!loading && tab === 'dashboard' && dashboard && (
        <div>
          <div className="module-stats">
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.totalZones || 0}</div><div className="stat-label">{t('geospatialAnalytics.stats.totalZones')}</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.activeZones || 0}</div><div className="stat-label">{t('geospatialAnalytics.stats.activeZones')}</div></div>
            <div className="stat-card"><div className="stat-value si-4fb20e94">{dashboard.summary?.restrictedZones || 0}</div><div className="stat-label">{t('geospatialAnalytics.stats.restricted')}</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.events24h || 0}</div><div className="stat-label">{t('geospatialAnalytics.stats.events24h')}</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.trackedAnimals || 0}</div><div className="stat-label">{t('geospatialAnalytics.stats.trackedAnimals')}</div></div>
          </div>

          {/* Interactive Overview Map */}
          <div className="module-card si-5e2e1af1">
            <div className="si-16ab549f">
              <h3 className="si-44087c4b">📍 {t('geospatialAnalytics.liveZoneEventMap')}</h3>
              <p className="si-7438976a">Zones shown as circles, recent events as markers</p>
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
                    <span className="si-756a9f21">{z.zone_type} · {z.radius_meters}m radius</span><br />
                    {z.is_restricted && <span className="si-a41d01e2">🚫 Restricted Zone</span>}
                    <div className="si-692258ce">Events: {z.event_count || 0}</div>
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
                    <span className={`module-badge ${ev.event_type === 'zone_breach' ? 'error' : ''} si-6af9d82f`}>{ev.event_type}</span><br />
                    {ev.zone_name && <span className="si-756a9f21">Zone: {ev.zone_name}</span>}<br />
                    <span className="si-dd67611c">{ev.recorded_at ? new Date(ev.recorded_at).toLocaleString() : ''}</span>
                  </div>
                ),
              }))}
            />
          </div>

          {dashboard.recentEvents?.length > 0 && (
            <div className="module-card si-138c678b">
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
          <div className="si-01b12315">
            <button className="module-btn primary" onClick={() => setShowZoneForm(true)}>{t('geospatialAnalytics.newZone')}</button>
          </div>
          {showZoneForm && (
            <div className="module-card si-478be2e9">
              <h3>{t('geospatialAnalytics.createZone')}</h3>
              <p className="si-a18d6d63">💡 Click on the map below to set the zone center coordinates</p>
              <div className="module-form">
                <div className="si-c3866b40">
                  <div className="si-cd7f5466"><label className="module-label">{t('geospatialAnalytics.zoneName')}</label><input className="module-input" value={zoneForm.name} onChange={e => setZoneForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. North Pasture" /></div>
                  <div className="si-6acd75e8"><label className="module-label">{t('common.type')}</label>
                    <select className="module-input" value={zoneForm.zoneType} onChange={e => setZoneForm(f => ({ ...f, zoneType: e.target.value, color: ZONE_COLORS[e.target.value] || '#3b82f6' }))}>
                      {ZONE_TYPES.map(zt => <option key={zt} value={zt}>{zt}</option>)}</select></div>
                </div>
                <div className="si-c3866b40">
                  <div className="si-6acd75e8"><label className="module-label">{t('geospatialAnalytics.centerLatitude')}</label><input className="module-input" type="number" step="0.0001" value={zoneForm.centerLat} onChange={e => setZoneForm(f => ({ ...f, centerLat: e.target.value }))} placeholder="Click map or type" /></div>
                  <div className="si-6acd75e8"><label className="module-label">{t('geospatialAnalytics.centerLongitude')}</label><input className="module-input" type="number" step="0.0001" value={zoneForm.centerLng} onChange={e => setZoneForm(f => ({ ...f, centerLng: e.target.value }))} placeholder="Click map or type" /></div>
                  <div className="si-6acd75e8"><label className="module-label">{t('geospatialAnalytics.radiusMeters')}</label><input className="module-input" type="number" value={zoneForm.radiusMeters} onChange={e => setZoneForm(f => ({ ...f, radiusMeters: e.target.value }))} /></div>
                </div>
                <div className="si-1d133837">
                  <div><label className="module-label">{t('geospatialAnalytics.color')}</label><input type="color" value={zoneForm.color} onChange={e => setZoneForm(f => ({ ...f, color: e.target.value }))} /></div>
                  <label className="si-c2db3694"><input type="checkbox" checked={zoneForm.alertOnEntry} onChange={e => setZoneForm(f => ({ ...f, alertOnEntry: e.target.checked }))} />{t('geospatialAnalytics.alertOnEntry')}</label>
                  <label className="si-c2db3694"><input type="checkbox" checked={zoneForm.alertOnExit} onChange={e => setZoneForm(f => ({ ...f, alertOnExit: e.target.checked }))} />{t('geospatialAnalytics.alertOnExit')}</label>
                  <label className="si-c2db3694"><input type="checkbox" checked={zoneForm.isRestricted} onChange={e => setZoneForm(f => ({ ...f, isRestricted: e.target.checked }))} />{t('geospatialAnalytics.restrictedZone')}</label>
                </div>
              </div>
              <div className="si-085d7dba">
                <button className="module-btn primary" onClick={createZone}>{t('geospatialAnalytics.createZone')}</button>
                <button className="module-btn" onClick={() => setShowZoneForm(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          )}

          {/* Interactive Zone Map */}
          <div className="module-card si-fd7717d4">
            <div className="si-16ab549f">
              <h3 className="si-44087c4b">📍 {t('geospatialAnalytics.geofenceZonesMap')}</h3>
              <p className="si-7438976a">
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
                    <span className="si-756a9f21">{z.zoneType} · {z.radiusMeters}m radius</span><br />
                    {z.isRestricted && <span className="si-a41d01e2">🚫 Restricted</span>}
                    {z.alertOnEntry && <span className="si-756a9f21"> · 🔔 Entry</span>}
                    {z.alertOnExit && <span className="si-756a9f21"> · 🔕 Exit</span>}
                  </div>
                ),
              }))}
              markers={zoneForm.centerLat && zoneForm.centerLng ? [{
                id: 'new-zone-center',
                lat: +zoneForm.centerLat,
                lng: +zoneForm.centerLng,
                color: zoneForm.color || '#ec4899',
                pulse: true,
                popup: <div><strong>New Zone Center</strong><br /><span className="si-756a9f21">{zoneForm.centerLat}, {zoneForm.centerLng}</span></div>,
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
          <div className="si-00515fb0">
            {zones.map(z => (
              <div key={z.id} className="module-card" style={{ borderLeft: `4px solid ${z.color || ZONE_COLORS[z.zoneType] || '#3b82f6'}` }}>
                <div className="si-9803f8d1">
                  <h4 className="si-44087c4b">{z.name}</h4>
                  <div className="si-9f48dfc6">
                    {z.isRestricted && <span className="module-badge error">🚫 Restricted</span>}
                    <span className={`module-badge ${z.status === 'active' ? 'success' : ''}`}>{z.status === 'active' ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
                <div className="si-372890a0">{z.zoneType} · {z.radiusMeters}m radius</div>
                <div className="si-46511ff4">📍 {(+(z.centerLat ?? 0)).toFixed(4)}, {(+(z.centerLng ?? 0)).toFixed(4)}</div>
                <div className="si-35725c93">
                  {z.alertOnEntry && <span>🔔 Entry Alerts</span>}
                  {z.alertOnExit && <span>🔕 Exit Alerts</span>}
                </div>
              </div>
            ))}
            {zones.length === 0 && <p className="si-40d2db53">{t('geospatialAnalytics.noZones')}</p>}
          </div>
        </div>
      )}

      {!loading && tab === 'events' && (
        <div>
          <div className="si-01b12315">
            <button className="module-btn primary" onClick={() => setShowEventForm(true)}>{t('geospatialAnalytics.recordEvent')}</button>
          </div>
          {showEventForm && (
            <div className="module-card si-478be2e9">
              <h3>{t('geospatialAnalytics.recordGeospatialEvent')}</h3>
              <p className="si-a18d6d63">💡 Click on the map below to set the event coordinates</p>
              <div className="module-form">
                <div className="si-c3866b40">
                  <div className="si-6acd75e8"><label className="module-label">{t('geospatialAnalytics.animalId')}</label>
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
                  <div className="si-6acd75e8"><label className="module-label">{t('geospatialAnalytics.eventType')}</label>
                    <select className="module-input" value={eventForm.eventType} onChange={e => setEventForm(f => ({ ...f, eventType: e.target.value }))}>
                      {EVENT_TYPES.map(et => <option key={et} value={et}>{et.replace(/_/g, ' ')}</option>)}</select></div>
                </div>
                <div className="si-c3866b40">
                  <div className="si-6acd75e8"><label className="module-label">{t('geospatialAnalytics.latitude')}</label><input className="module-input" type="number" step="0.0001" value={eventForm.latitude} onChange={e => setEventForm(f => ({ ...f, latitude: e.target.value }))} placeholder="Click map or type" /></div>
                  <div className="si-6acd75e8"><label className="module-label">{t('geospatialAnalytics.longitude')}</label><input className="module-input" type="number" step="0.0001" value={eventForm.longitude} onChange={e => setEventForm(f => ({ ...f, longitude: e.target.value }))} placeholder="Click map or type" /></div>
                </div>
                <div><label className="module-label">{t('geospatialAnalytics.metadata')}</label><input className="module-input" value={eventForm.metadata} onChange={e => setEventForm(f => ({ ...f, metadata: e.target.value }))} placeholder='{"speed": 5.2, "heading": 270}' /></div>
              </div>
              <div className="si-085d7dba">
                <button className="module-btn primary" onClick={createEvent}>{t('geospatialAnalytics.recordEvent')}</button>
                <button className="module-btn" onClick={() => setShowEventForm(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          )}

          {/* Interactive Events Map */}
          <div className="module-card si-fd7717d4">
            <div className="si-16ab549f">
              <h3 className="si-44087c4b">📡 {t('geospatialAnalytics.eventLocationsMap')}</h3>
              <p className="si-7438976a">
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
                      <span className={`module-badge ${et === 'boundary_breach' || et === 'zone_breach' ? 'error' : ''} si-6af9d82f`}
                       >{ev.eventType?.replace(/_/g, ' ')}</span><br />
                      {ev.zoneName && <span className="si-756a9f21">Zone: {ev.zoneName}</span>}
                      {ev.zoneName && <br />}
                      <span className="si-dd67611c">{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}</span>
                      {ev.metadata && <div className="si-7e00f8e2">{JSON.stringify(ev.metadata).slice(0, 80)}</div>}
                    </div>
                  ),
                }}),
                ...(eventForm.latitude && eventForm.longitude ? [{
                  id: 'new-event-point',
                  lat: +eventForm.latitude,
                  lng: +eventForm.longitude,
                  color: '#ec4899',
                  pulse: true,
                  popup: <div><strong>New Event Location</strong><br /><span className="si-756a9f21">{eventForm.latitude}, {eventForm.longitude}</span></div>,
                }] : []),
              ]}
              circles={zones.map(z => ({
                id: `zone-bg-${z.id}`,
                lat: +(z.centerLat ?? 0),
                lng: +(z.centerLng ?? 0),
                radius: +(z.radiusMeters ?? 100),
                color: z.color || ZONE_COLORS[z.zoneType] || '#3b82f6',
                fillOpacity: 0.08,
                popup: <span className="si-756a9f21">{z.name}</span>,
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
          <div className="si-92d1d3e8">
            <span><span className="si-d19ebc2f"></span>{t('geospatialAnalytics.legend.locationUpdate')}</span>
            <span><span className="si-66687b12"></span>{t('geospatialAnalytics.legend.zoneEntryExit')}</span>
            <span><span className="si-1f7cf318"></span>{t('geospatialAnalytics.legend.breach')}</span>
            <span><span className="si-33ea94d4"></span>{t('geospatialAnalytics.legend.sosAlert')}</span>
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
                    <td className="si-756a9f21">{(+(ev.latitude ?? 0)).toFixed(4)}, {(+(ev.longitude ?? 0)).toFixed(4)}</td>
                    <td className="si-756a9f21">{ev.metadata ? JSON.stringify(ev.metadata).slice(0, 60) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {events.length === 0 && <p className="si-380a494b">{t('geospatialAnalytics.noEvents')}</p>}
          </div>
        </div>
      )}

      {!loading && tab === 'heatmap' && (
        <div>
          {/* Interactive Heatmap */}
          <div className="module-card si-fcab6f48">
            <div className="si-16ab549f">
              <h3 className="si-44087c4b">🔥 {t('geospatialAnalytics.locationDensityHeatmap')}</h3>
              <p className="si-7438976a">
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
                popup: <span className="si-756a9f21">{z.name}</span>,
              }))}
              fitToData={heatmapData.length > 0}
            />
            {heatmapData.length === 0 && (
              <div className="si-e5375a70">
                {t('geospatialAnalytics.noLocationData')}
              </div>
            )}
          </div>

          {/* Movement Trail */}
          <div className="module-card">
            <h3>🐾 {t('geospatialAnalytics.movementTrail')}</h3>
            <p className="si-fb366e09">{t('geospatialAnalytics.trackAnimalMovement')}</p>
            <div className="si-319b7b12">
              <div className="si-6acd75e8">
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
              <div className="si-b0aee75b">
                <div className="module-stats">
                  <div className="stat-card"><div className="stat-value">{trailData.pointCount || 0}</div><div className="stat-label">{t('geospatialAnalytics.points')}</div></div>
                  <div className="stat-card"><div className="stat-value">{(+(trailData.totalDistanceKm ?? 0)).toFixed(2)}</div><div className="stat-label">{t('geospatialAnalytics.distanceKm')}</div></div>
                </div>

                {/* Trail Map */}
                {trailData.trail?.length > 0 && (
                  <div className="si-e2acd78d">
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
                              <span className="si-756a9f21">{trailData.trail[0].recorded_at ? new Date(trailData.trail[0].recorded_at).toLocaleString() : '—'}</span>
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
                              <span className="si-756a9f21">{trailData.trail[trailData.trail.length - 1].recorded_at ? new Date(trailData.trail[trailData.trail.length - 1].recorded_at).toLocaleString() : '—'}</span>
                            </div>
                          ),
                        }] : []),
                      ]}
                      fitToData
                    />
                  </div>
                )}

                {trailData.trail?.length > 0 && (
                  <div className="si-66faea9d">
                    <details>
                      <summary className="si-02314238">📋 Trail Points Table ({trailData.trail.length} points)</summary>
                      <table className="module-table si-cbfb1eb8">
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
