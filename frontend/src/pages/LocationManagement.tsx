import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, FarmLocation, LocationType } from '../types'
import MapView from '../components/MapView'

const LOCATION_TYPE_LABELS: Record<string, string> = {
  barn: 'Barn', stable: 'Stable', pen: 'Pen', paddock: 'Paddock',
  field: 'Field', pasture: 'Pasture', quarantine: 'Quarantine', isolation: 'Isolation',
  aviary: 'Aviary', tank: 'Tank', pond: 'Pond', enclosure: 'Enclosure',
  kennel: 'Kennel', cattery: 'Cattery', warehouse: 'Warehouse', office: 'Office',
  treatment_area: 'Treatment Area', milking_parlor: 'Milking Parlor', feed_storage: 'Feed Storage', other: 'Other'
}

const LOCATION_TYPE_ICONS: Record<string, string> = {
  barn: '🏚️', stable: '🐴', pen: '🐷', paddock: '🌿', field: '🌾',
  pasture: '🌳', quarantine: '⚠️', isolation: '🔒', aviary: '🦜',
  tank: '🐟', pond: '🌊', enclosure: '🦁', kennel: '🐕', cattery: '🐈',
  warehouse: '🏭', office: '🏢', treatment_area: '🏥', milking_parlor: '🥛',
  feed_storage: '🌽', other: '📍'
}

const LocationManagement: React.FC = () => {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [locations, setLocations] = useState<FarmLocation[]>([])
  const [locationTree, setLocationTree] = useState<FarmLocation[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'tree' | 'map'>('grid')
  const [showForm, setShowForm] = useState(false)
  const [editingLocation, setEditingLocation] = useState<FarmLocation | null>(null)
  const [formData, setFormData] = useState({
    name: '', locationType: '' as LocationType, parentLocationId: '',
    capacity: '', area: '', areaUnit: 'sqft', description: '',
    gpsLatitude: '', gpsLongitude: ''
  })
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

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

  const fetchLocations = async () => {
    if (!selectedEnterpriseId) return
    try {
      setLoading(true)
      const [listRes, treeRes] = await Promise.all([
        apiService.listLocations(selectedEnterpriseId),
        apiService.getLocationTree(selectedEnterpriseId)
      ])
      setLocations(listRes.data?.items || [])
      setLocationTree(treeRes.data || [])
    } catch { setLocations([]); setLocationTree([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchLocations() }, [selectedEnterpriseId])

  const resetForm = () => {
    setFormData({ name: '', locationType: '' as LocationType, parentLocationId: '', capacity: '', area: '', areaUnit: 'sqft', description: '', gpsLatitude: '', gpsLongitude: '' })
    setEditingLocation(null); setError('')
  }

  const openEdit = (loc: FarmLocation) => {
    setEditingLocation(loc)
    setFormData({
      name: loc.name, locationType: loc.locationType as LocationType,
      parentLocationId: loc.parentLocationId || '', capacity: loc.capacity?.toString() || '',
      area: loc.area?.toString() || '', areaUnit: loc.areaUnit || 'sqft',
      description: loc.description || '',
      gpsLatitude: loc.gpsLatitude?.toString() || '', gpsLongitude: loc.gpsLongitude?.toString() || ''
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!formData.name || !formData.locationType) { setError('Name and type are required'); return }
    try {
      const payload: any = {
        ...formData, enterpriseId: selectedEnterpriseId,
        capacity: formData.capacity ? parseInt(formData.capacity) : 0,
        area: formData.area ? parseFloat(formData.area) : undefined,
        parentLocationId: formData.parentLocationId || undefined,
        gpsLatitude: formData.gpsLatitude ? parseFloat(formData.gpsLatitude) : undefined,
        gpsLongitude: formData.gpsLongitude ? parseFloat(formData.gpsLongitude) : undefined,
      }
      if (editingLocation) {
        await apiService.updateLocation(editingLocation.id, payload)
        setSuccessMsg('Location updated')
      } else {
        await apiService.createLocation(payload)
        setSuccessMsg('Location created')
      }
      resetForm(); setShowForm(false); fetchLocations()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed to save') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this location?')) return
    try {
      await apiService.deleteLocation(id)
      setSuccessMsg('Location deleted')
      fetchLocations()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed') }
  }

  const renderTreeNode = (loc: FarmLocation, depth = 0) => (
    <div key={loc.id} style={{ marginLeft: depth * 24, padding: '0.5rem', borderLeft: depth > 0 ? '2px solid var(--border)' : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>{LOCATION_TYPE_ICONS[loc.locationType] || '📍'}</span>
        <strong>{loc.name}</strong>
        <span className="badge" style={{ fontSize: '0.7rem' }}>{LOCATION_TYPE_LABELS[loc.locationType] || loc.locationType}</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {loc.currentOccupancy}/{loc.capacity} capacity
        </span>
        <button className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto', padding: '0.15rem 0.5rem' }} onClick={() => openEdit(loc)}>Edit</button>
        <button className="btn btn-sm btn-danger" style={{ padding: '0.15rem 0.5rem' }} onClick={() => handleDelete(loc.id)}>×</button>
      </div>
      {loc.children?.map(child => renderTreeNode(child, depth + 1))}
    </div>
  )

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>📍 Location Management</h1>
          <p className="subtitle">Manage barns, pens, paddocks, and facility locations</p>
        </div>
        <div className="header-actions">
          {selectedEnterpriseId && (
            <>
              <button className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('grid')}>Grid</button>
              <button className={`btn btn-sm ${viewMode === 'tree' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('tree')}>Tree</button>
              <button className={`btn btn-sm ${viewMode === 'map' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('map')}>🗺️ Map</button>
              <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>+ New Location</button>
            </>
          )}
        </div>
      </div>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="filters-bar">
        <select value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)} className="search-input" style={{ maxWidth: '350px' }}>
          <option value="">Select Enterprise...</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {!selectedEnterpriseId ? (
        <div className="empty-state">
          <div className="empty-icon">📍</div>
          <h3>Select an Enterprise</h3>
          <p>Choose an enterprise to manage locations.</p>
        </div>
      ) : loading ? (
        <div className="loading-spinner">Loading locations...</div>
      ) : locations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📍</div>
          <h3>No Locations Yet</h3>
          <p>Add your first location to track where animals are housed.</p>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>+ Create Location</button>
        </div>
      ) : viewMode === 'tree' ? (
        <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '1.25rem', border: '1px solid var(--border)' }}>
          {locationTree.map(loc => renderTreeNode(loc))}
        </div>
      ) : viewMode === 'map' ? (
        <div>
          {/* Interactive Location Map */}
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 20 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
              <h3 style={{ margin: 0 }}>🗺️ Farm Locations Map</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                {locations.filter(l => l.gpsLatitude && l.gpsLongitude).length} of {locations.length} locations have GPS coordinates
              </p>
            </div>
            <MapView
              height={500}
              markers={locations.filter(l => l.gpsLatitude && l.gpsLongitude).map(loc => ({
                id: loc.id,
                lat: +(loc.gpsLatitude || 0),
                lng: +(loc.gpsLongitude || 0),
                color: loc.locationType === 'quarantine' || loc.locationType === 'isolation' ? '#ef4444'
                  : loc.locationType === 'treatment_area' ? '#f97316'
                  : loc.locationType === 'barn' || loc.locationType === 'stable' ? '#8b5cf6'
                  : '#22c55e',
                popup: (
                  <div>
                    <strong>{LOCATION_TYPE_ICONS[loc.locationType] || '📍'} {loc.name}</strong><br />
                    <span style={{ fontSize: 12 }}>{LOCATION_TYPE_LABELS[loc.locationType] || loc.locationType}</span><br />
                    <span style={{ fontSize: 12 }}>Occupancy: {loc.currentOccupancy} / {loc.capacity}</span>
                    {loc.area && <><br /><span style={{ fontSize: 12 }}>Area: {loc.area} {loc.areaUnit}</span></>}
                    {loc.description && <><br /><span style={{ fontSize: 11, color: '#888' }}>{loc.description}</span></>}
                  </div>
                ),
              }))}
              onClick={(lat, lng) => {
                if (showForm) {
                  setFormData(f => ({ ...f, gpsLatitude: lat.toFixed(6), gpsLongitude: lng.toFixed(6) }))
                }
              }}
              fitToData={locations.filter(l => l.gpsLatitude && l.gpsLongitude).length > 0}
            />
          </div>
          {locations.filter(l => !l.gpsLatitude || !l.gpsLongitude).length > 0 && (
            <div style={{ padding: '12px 16px', background: '#fef3c7', borderRadius: 8, fontSize: 13, color: '#92400e', marginBottom: 16 }}>
              ⚠️ {locations.filter(l => !l.gpsLatitude || !l.gpsLongitude).length} location(s) don't have GPS coordinates: {locations.filter(l => !l.gpsLatitude || !l.gpsLongitude).map(l => l.name).join(', ')}. Edit them to add coordinates.
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {locations.map(loc => (
            <div key={loc.id} className="card" style={{ borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.75rem' }}>{LOCATION_TYPE_ICONS[loc.locationType] || '📍'}</span>
                <div>
                  <h3 style={{ margin: 0 }}>{loc.name}</h3>
                  <span className="badge" style={{ fontSize: '0.75rem' }}>{LOCATION_TYPE_LABELS[loc.locationType] || loc.locationType}</span>
                </div>
              </div>
              {loc.parentLocationName && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Inside: {loc.parentLocationName}</p>}
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>Occupancy</span>
                  <span style={{ fontWeight: 600 }}>{loc.currentOccupancy} / {loc.capacity}</span>
                </div>
                {loc.capacity > 0 && (
                  <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', marginTop: '0.25rem', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (loc.currentOccupancy / loc.capacity) * 100)}%`, background: loc.currentOccupancy >= loc.capacity ? 'var(--danger)' : 'var(--primary)', borderRadius: '3px' }} />
                  </div>
                )}
              </div>
              {loc.area && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Area: {loc.area} {loc.areaUnit}</p>}
              {loc.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{loc.description}</p>}
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(loc)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(loc.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); resetForm() }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2>{editingLocation ? 'Edit Location' : 'Create Location'}</h2>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label>Location Name *</label>
                <input type="text" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Location Type *</label>
                  <select value={formData.locationType} onChange={e => setFormData(f => ({ ...f, locationType: e.target.value as LocationType }))} required>
                    <option value="">Select...</option>
                    {Object.entries(LOCATION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Parent Location</label>
                  <select value={formData.parentLocationId} onChange={e => setFormData(f => ({ ...f, parentLocationId: e.target.value }))}>
                    <option value="">None (Top Level)</option>
                    {locations.filter(l => l.id !== editingLocation?.id).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Capacity</label>
                  <input type="number" value={formData.capacity} onChange={e => setFormData(f => ({ ...f, capacity: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Area</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="number" step="0.01" value={formData.area} onChange={e => setFormData(f => ({ ...f, area: e.target.value }))} style={{ flex: 1 }} />
                    <select value={formData.areaUnit} onChange={e => setFormData(f => ({ ...f, areaUnit: e.target.value }))} style={{ width: '80px' }}>
                      <option value="sqft">sqft</option><option value="sqm">sqm</option>
                      <option value="acres">acres</option><option value="hectares">ha</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows={2} value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>GPS Latitude</label>
                  <input type="number" step="0.000001" placeholder="Click map or type" value={formData.gpsLatitude} onChange={e => setFormData(f => ({ ...f, gpsLatitude: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>GPS Longitude</label>
                  <input type="number" step="0.000001" placeholder="Click map or type" value={formData.gpsLongitude} onChange={e => setFormData(f => ({ ...f, gpsLongitude: e.target.value }))} />
                </div>
              </div>
              {showForm && (
                <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '0.5rem' }}>
                  <div style={{ padding: '8px 12px', fontSize: 12, color: '#888', background: '#f9fafb', borderBottom: '1px solid var(--border)' }}>
                    💡 Click the map to set GPS coordinates
                  </div>
                  <MapView
                    height={220}
                    markers={formData.gpsLatitude && formData.gpsLongitude ? [{
                      id: 'form-location',
                      lat: +formData.gpsLatitude,
                      lng: +formData.gpsLongitude,
                      color: '#3b82f6',
                      pulse: true,
                      popup: <div><strong>{formData.name || 'New Location'}</strong></div>,
                    }] : []}
                    onClick={(lat, lng) => setFormData(f => ({ ...f, gpsLatitude: lat.toFixed(6), gpsLongitude: lng.toFixed(6) }))}
                    center={formData.gpsLatitude && formData.gpsLongitude ? [+formData.gpsLatitude, +formData.gpsLongitude] : undefined}
                    zoom={formData.gpsLatitude ? 14 : undefined}
                  />
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); resetForm() }}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingLocation ? 'Update' : 'Create'} Location</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default LocationManagement
