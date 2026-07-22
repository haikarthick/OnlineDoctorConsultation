import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { useScrollToForm } from '../hooks/useScrollToForm'
import { Enterprise, FarmLocation, LocationType } from '../types'
import MapView from '../components/MapView'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()

  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [locations, setLocations] = useState<FarmLocation[]>([])
  const [locationTree, setLocationTree] = useState<FarmLocation[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'tree' | 'map'>('grid')
  const [showForm, setShowForm] = useState(false)
  const formRef = useScrollToForm(showForm)
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
    if (!formData.name || !formData.locationType) { setError(t('locationManagement.modal.validation')); return }
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
        setSuccessMsg(t('locationManagement.toasts.updated'))
      } else {
        await apiService.createLocation(payload)
        setSuccessMsg(t('locationManagement.toasts.created'))
      }
      resetForm(); setShowForm(false); fetchLocations()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) { setError(err.response?.data?.error?.message || t('common.failedToSave')) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('locationManagement.toasts.deleteConfirm'))) return
    try {
      await apiService.deleteLocation(id)
      setSuccessMsg(t('locationManagement.toasts.deleted'))
      fetchLocations()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) { setError(err.response?.data?.error?.message || t('common.failedToDelete')) }
  }

  const renderTreeNode = (loc: FarmLocation, depth = 0) => (
    <div key={loc.id} style={{ marginLeft: depth * 24, padding: '0.5rem', borderLeft: depth > 0 ? '2px solid var(--border)' : 'none' }}>
      <div className="si-0dd04361">
        <span>{LOCATION_TYPE_ICONS[loc.locationType] || '📍'}</span>
        <strong>{loc.name}</strong>
        <span className="badge si-cf3f332c">{LOCATION_TYPE_LABELS[loc.locationType] || loc.locationType}</span>
        <span className="si-93f5e4c5">
          {loc.currentOccupancy}/{loc.capacity} {t('locationManagement.occupancy').toLowerCase()}
        </span>
        <button className="btn btn-sm btn-secondary si-bad86510" onClick={() => openEdit(loc)}>{t('common.edit')}</button>
        <button className="btn btn-sm btn-danger si-e712fc62" onClick={() => handleDelete(loc.id)}>×</button>
      </div>
      {loc.children?.map(child => renderTreeNode(child, depth + 1))}
    </div>
  )

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>{t('locationManagement.pageTitle')}</h1>
          <p className="subtitle">{t('locationManagement.subtitle')}</p>
        </div>
        <div className="header-actions">
          {selectedEnterpriseId && (
            <>
              <button className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('grid')}>{t('locationManagement.viewGrid')}</button>
              <button className={`btn btn-sm ${viewMode === 'tree' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('tree')}>{t('locationManagement.viewTree')}</button>
              <button className={`btn btn-sm ${viewMode === 'map' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('map')}>{t('locationManagement.viewMap')}</button>
              <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>{t('locationManagement.newLocation')}</button>
            </>
          )}
        </div>
      </div>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      {error && !showForm && <div className="alert alert-error">{error}</div>}

      <div className="filters-bar">
        <select value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)} className="search-input si-58fb376a">
          <option value="">{t('locationManagement.selectEnterprise')}</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {!selectedEnterpriseId ? (
        <div className="empty-state">
          <div className="empty-icon">📍</div>
          <h3>{t('locationManagement.emptyEnterprise')}</h3>
          <p>{t('locationManagement.emptyEnterpriseSubtitle')}</p>
        </div>
      ) : loading ? (
        <div className="loading-spinner">{t('locationManagement.loading')}</div>
      ) : locations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📍</div>
          <h3>{t('locationManagement.emptyTitle')}</h3>
          <p>{t('locationManagement.emptySubtitle')}</p>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>{t('locationManagement.createBtn')}</button>
        </div>
      ) : viewMode === 'tree' ? (
        <div className="si-478f1da8">
          {locationTree.map(loc => renderTreeNode(loc))}
        </div>
      ) : viewMode === 'map' ? (
        <div>
          {/* Interactive Location Map */}
          <div className="si-a87c8813">
            <div className="si-5214c8b8">
              <h3 className="si-44087c4b">{t('locationManagement.mapTitle')}</h3>
              <p className="si-29492778">
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
                    <span className="si-756a9f21">{LOCATION_TYPE_LABELS[loc.locationType] || loc.locationType}</span><br />
                    <span className="si-756a9f21">{t('locationManagement.occupancy')}: {loc.currentOccupancy} / {loc.capacity}</span>
                    {loc.area && <><br /><span className="si-756a9f21">Area: {loc.area} {loc.areaUnit}</span></>}
                    {loc.description && <><br /><span className="si-dd67611c">{loc.description}</span></>}
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
            <div className="si-ef04e5fd">
              ⚠️ {locations.filter(l => !l.gpsLatitude || !l.gpsLongitude).length} location(s) don't have GPS coordinates: {locations.filter(l => !l.gpsLatitude || !l.gpsLongitude).map(l => l.name).join(', ')}. Edit them to add coordinates.
            </div>
          )}
        </div>
      ) : (
        <div className="si-a1694610">
          {locations.map(loc => (
            <div key={loc.id} className="card si-a43a6b11">
              <div className="si-99f8abcc">
                <span className="si-91db75dc">{LOCATION_TYPE_ICONS[loc.locationType] || '📍'}</span>
                <div>
                  <h3 className="si-44087c4b">{loc.name}</h3>
                  <span className="badge si-8c23064b">{LOCATION_TYPE_LABELS[loc.locationType] || loc.locationType}</span>
                </div>
              </div>
              {loc.parentLocationName && <p className="si-93f5e4c5">{t('locationManagement.inside')} {loc.parentLocationName}</p>}
              <div className="si-60e2e250">
                <div className="si-89c2f30f">
                  <span>{t('locationManagement.occupancy')}</span>
                  <span className="si-b2cfcbec">{loc.currentOccupancy} / {loc.capacity}</span>
                </div>
                {loc.capacity > 0 && (
                  <div className="si-ade9e368">
                    <div style={{ height: '100%', width: `${Math.min(100, (loc.currentOccupancy / loc.capacity) * 100)}%`, background: loc.currentOccupancy >= loc.capacity ? 'var(--danger)' : 'var(--primary)', borderRadius: '3px' }} />
                  </div>
                )}
              </div>
              {loc.area && <p className="si-9cbc3f5c">{t('locationManagement.area')} {loc.area} {loc.areaUnit}</p>}
              {loc.description && <p className="si-93f5e4c5">{loc.description}</p>}
              <div className="si-3429dc13">
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(loc)}>{t('common.edit')}</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(loc.id)}>{t('common.delete')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && <div className="edit-form-overlay" onClick={() => { setShowForm(false); resetForm() }} />}
      {showForm && (
        <div ref={formRef} className="edit-form-panel">
            <h2>{editingLocation ? t('locationManagement.modal.editTitle') : t('locationManagement.modal.createTitle')}</h2>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label>{t('locationManagement.form.name')}</label>
                <input type="text" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="si-ec24da01">
                <div className="form-group">
                  <label>{t('locationManagement.form.type')}</label>
                  <select value={formData.locationType} onChange={e => setFormData(f => ({ ...f, locationType: e.target.value as LocationType }))} required>
                    <option value="">Select...</option>
                    {Object.entries(LOCATION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('locationManagement.form.parentLocation')}</label>
                  <select value={formData.parentLocationId} onChange={e => setFormData(f => ({ ...f, parentLocationId: e.target.value }))}>
                    <option value="">{t('locationManagement.modal.parentDefault')}</option>
                    {locations.filter(l => l.id !== editingLocation?.id).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('locationManagement.form.capacity')}</label>
                  <input type="number" value={formData.capacity} onChange={e => setFormData(f => ({ ...f, capacity: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>{t('locationManagement.form.area')}</label>
                  <div className="si-6fdaaf49">
                    <input type="number" step="0.01" value={formData.area} onChange={e => setFormData(f => ({ ...f, area: e.target.value }))} className="si-6acd75e8" />
                    <select value={formData.areaUnit} onChange={e => setFormData(f => ({ ...f, areaUnit: e.target.value }))} className="si-4706e1bb">
                      <option value="sqft">sqft</option><option value="sqm">sqm</option>
                      <option value="acres">acres</option><option value="hectares">ha</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>{t('common.description')}</label>
                <textarea rows={2} value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="si-ec24da01">
                <div className="form-group">
                  <label>{t('locationManagement.form.gpsLatitude')}</label>
                  <input type="number" step="0.000001" placeholder="Click map or type" value={formData.gpsLatitude} onChange={e => setFormData(f => ({ ...f, gpsLatitude: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>{t('locationManagement.form.gpsLongitude')}</label>
                  <input type="number" step="0.000001" placeholder="Click map or type" value={formData.gpsLongitude} onChange={e => setFormData(f => ({ ...f, gpsLongitude: e.target.value }))} />
                </div>
              </div>
              {showForm && (
                <div className="si-78f76e08">
                  <div className="si-45536f4a">
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
              <div className="si-5af10afb">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); resetForm() }}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{editingLocation ? t('locationManagement.modal.updateBtn') : t('locationManagement.modal.createBtn')}</button>
              </div>
            </form>
        </div>
      )}
    </div>
  )
}

export default LocationManagement
