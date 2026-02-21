import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, ENTERPRISE_TYPE_LABELS, EnterpriseType, EnterpriseStats } from '../types'
import MapView from '../components/MapView'

const EnterpriseManagement: React.FC = () => {
  const { user } = useAuth()
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEnterprise, setEditingEnterprise] = useState<Enterprise | null>(null)
  const [selectedEnterprise, setSelectedEnterprise] = useState<Enterprise | null>(null)
  const [stats, setStats] = useState<EnterpriseStats | null>(null)
  const [formData, setFormData] = useState({
    name: '', enterpriseType: '' as EnterpriseType, description: '',
    address: '', city: '', state: '', country: 'US', postalCode: '',
    totalArea: '', areaUnit: 'acres', licenseNumber: '', regulatoryId: '',
    taxId: '', phone: '', email: '', website: '',
    gpsLatitude: '', gpsLongitude: ''
  })
  const [showMapOverview, setShowMapOverview] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const isAdmin = user?.role === 'admin'

  const fetchEnterprises = async () => {
    try {
      setLoading(true)
      const res = await apiService.listEnterprises({ limit: 100 })
      setEnterprises(res.data?.items || [])
    } catch { setEnterprises([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchEnterprises() }, [])

  const fetchStats = async (id: string) => {
    try {
      const res = await apiService.getEnterpriseStats(id)
      setStats(res.data)
    } catch { setStats(null) }
  }

  const resetForm = () => {
    setFormData({
      name: '', enterpriseType: '' as EnterpriseType, description: '',
      address: '', city: '', state: '', country: 'US', postalCode: '',
      totalArea: '', areaUnit: 'acres', licenseNumber: '', regulatoryId: '',
      taxId: '', phone: '', email: '', website: '',
      gpsLatitude: '', gpsLongitude: ''
    })
    setEditingEnterprise(null)
    setError('')
  }

  const openEdit = (ent: Enterprise) => {
    setEditingEnterprise(ent)
    setFormData({
      name: ent.name, enterpriseType: ent.enterpriseType, description: ent.description || '',
      address: ent.address || '', city: ent.city || '', state: ent.state || '',
      country: ent.country || 'US', postalCode: ent.postalCode || '',
      totalArea: ent.totalArea?.toString() || '', areaUnit: ent.areaUnit || 'acres',
      licenseNumber: ent.licenseNumber || '', regulatoryId: ent.regulatoryId || '',
      taxId: ent.taxId || '', phone: ent.phone || '', email: ent.email || '', website: ent.website || '',
      gpsLatitude: ent.gpsLatitude?.toString() || '', gpsLongitude: ent.gpsLongitude?.toString() || ''
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!formData.name || !formData.enterpriseType) {
      setError('Name and enterprise type are required')
      return
    }
    try {
      const payload: any = {
        ...formData,
        totalArea: formData.totalArea ? parseFloat(formData.totalArea) : undefined,
        gpsLatitude: formData.gpsLatitude ? parseFloat(formData.gpsLatitude) : undefined,
        gpsLongitude: formData.gpsLongitude ? parseFloat(formData.gpsLongitude) : undefined,
      }
      if (editingEnterprise) {
        await apiService.updateEnterprise(editingEnterprise.id, payload)
        setSuccessMsg('Enterprise updated successfully')
      } else {
        await apiService.createEnterprise(payload)
        setSuccessMsg('Enterprise created successfully')
      }
      resetForm()
      setShowForm(false)
      fetchEnterprises()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save enterprise')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this enterprise?')) return
    try {
      await apiService.deleteEnterprise(id)
      setSuccessMsg('Enterprise deactivated')
      fetchEnterprises()
      if (selectedEnterprise?.id === id) setSelectedEnterprise(null)
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to deactivate')
    }
  }

  const selectEnterprise = (ent: Enterprise) => {
    setSelectedEnterprise(ent)
    fetchStats(ent.id)
  }

  const filtered = enterprises.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ENTERPRISE_TYPE_LABELS[e.enterpriseType] || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const typeIcon = (t: EnterpriseType) => {
    const icons: Record<string, string> = {
      dairy_farm: '🐄', poultry_farm: '🐔', cattle_ranch: '🐂', mixed_farm: '🌾',
      zoo: '🦁', breeding_facility: '🧬', pet_shop: '🐾', sanctuary: '🏔️',
      equestrian_center: '🐴', aquaculture: '🐟', wildlife_reserve: '🌿',
      veterinary_clinic: '🏥', kennel: '🐕', cattery: '🐈', aviary: '🦜', other: '🏢'
    }
    return icons[t] || '🏢'
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>🏢 Enterprise Management</h1>
          <p className="subtitle">Manage your farms, clinics, and animal enterprises</p>
        </div>
        <div className="header-actions">
          <button className={`btn ${showMapOverview ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowMapOverview(!showMapOverview)}>
            🗺️ {showMapOverview ? 'Hide Map' : 'Map View'}
          </button>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>
            + New Enterprise
          </button>
        </div>
      </div>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Search */}
      <div className="filters-bar">
        <input
          type="text" placeholder="Search enterprises..." className="search-input"
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Enterprise Map Overview */}
      {showMapOverview && (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
            <h3 style={{ margin: 0 }}>🗺️ Enterprise Locations</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              {enterprises.filter(e => e.gpsLatitude && e.gpsLongitude).length} of {enterprises.length} enterprises have GPS coordinates
            </p>
          </div>
          <MapView
            height={400}
            markers={enterprises.filter(e => e.gpsLatitude && e.gpsLongitude).map(ent => ({
              id: ent.id,
              lat: +(ent.gpsLatitude || 0),
              lng: +(ent.gpsLongitude || 0),
              color: selectedEnterprise?.id === ent.id ? '#3b82f6' : '#22c55e',
              pulse: selectedEnterprise?.id === ent.id,
              popup: (
                <div>
                  <strong>{typeIcon(ent.enterpriseType)} {ent.name}</strong><br />
                  <span style={{ fontSize: 12 }}>{ENTERPRISE_TYPE_LABELS[ent.enterpriseType] || ent.enterpriseType}</span><br />
                  {ent.city && <span style={{ fontSize: 12 }}>{ent.city}{ent.state ? `, ${ent.state}` : ''}</span>}
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    👥 {ent.memberCount || 0} members · 🐾 {ent.animalCount || 0} animals
                  </div>
                </div>
              ),
            }))}
            fitToData={enterprises.filter(e => e.gpsLatitude && e.gpsLongitude).length > 0}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        {/* Enterprise List */}
        <div style={{ flex: '1', minWidth: '300px' }}>
          {loading ? (
            <div className="loading-spinner">Loading enterprises...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏢</div>
              <h3>No Enterprises Yet</h3>
              <p>Create your first enterprise to start managing animals at scale.</p>
              <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>
                + Create Enterprise
              </button>
            </div>
          ) : (
            <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {filtered.map(ent => (
                <div key={ent.id}
                  className={`card ${selectedEnterprise?.id === ent.id ? 'card-selected' : ''}`}
                  style={{ cursor: 'pointer', border: selectedEnterprise?.id === ent.id ? '2px solid var(--primary)' : '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem' }}
                  onClick={() => selectEnterprise(ent)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '2rem' }}>{typeIcon(ent.enterpriseType)}</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{ent.name}</h3>
                      <span className="badge" style={{ fontSize: '0.75rem' }}>{ENTERPRISE_TYPE_LABELS[ent.enterpriseType] || ent.enterpriseType}</span>
                    </div>
                  </div>
                  {ent.address && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0' }}>📍 {ent.city ? `${ent.city}, ${ent.state || ''}` : ent.address}</p>}
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                    <span>👥 {ent.memberCount || 0} members</span>
                    <span>🐾 {ent.animalCount || 0} animals</span>
                  </div>
                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-sm btn-secondary" onClick={e => { e.stopPropagation(); openEdit(ent) }}>Edit</button>
                    {(isAdmin || ent.ownerId === user?.id) && (
                      <button className="btn btn-sm btn-danger" onClick={e => { e.stopPropagation(); handleDelete(ent.id) }}>Delete</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats Panel */}
        {selectedEnterprise && stats && (
          <div style={{ width: '320px', background: 'var(--surface)', borderRadius: '12px', padding: '1.25rem', border: '1px solid var(--border)', alignSelf: 'flex-start' }}>
            <h3 style={{ margin: '0 0 1rem' }}>{selectedEnterprise.name} — Overview</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ background: 'var(--background)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.totalAnimals}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Animals</div>
              </div>
              <div style={{ background: 'var(--background)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.totalGroups}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Groups</div>
              </div>
              <div style={{ background: 'var(--background)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.totalLocations}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Locations</div>
              </div>
              <div style={{ background: 'var(--background)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.totalMembers}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Members</div>
              </div>
            </div>
            {stats.animalsBySpecies.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>Animals by Species</h4>
                {stats.animalsBySpecies.map(s => (
                  <div key={s.species} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', fontSize: '0.85rem' }}>
                    <span>{s.species}</span>
                    <span style={{ fontWeight: 600 }}>{s.count}</span>
                  </div>
                ))}
              </div>
            )}
            {selectedEnterprise.licenseNumber && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                📋 License: {selectedEnterprise.licenseNumber}
              </div>
            )}
            {selectedEnterprise.regulatoryId && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                🏛️ Regulatory ID: {selectedEnterprise.regulatoryId}
              </div>
            )}
            {selectedEnterprise.gpsLatitude && selectedEnterprise.gpsLongitude && (
              <div style={{ marginTop: '0.75rem', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <MapView
                  height={180}
                  center={[+(selectedEnterprise.gpsLatitude), +(selectedEnterprise.gpsLongitude)]}
                  zoom={14}
                  markers={[{
                    id: 'selected-ent',
                    lat: +(selectedEnterprise.gpsLatitude),
                    lng: +(selectedEnterprise.gpsLongitude),
                    color: '#3b82f6',
                    popup: <div><strong>{selectedEnterprise.name}</strong></div>,
                  }]}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); resetForm() }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '85vh', overflow: 'auto' }}>
            <h2>{editingEnterprise ? 'Edit Enterprise' : 'Create New Enterprise'}</h2>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Enterprise Name *</label>
                  <input type="text" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} required />
                </div>

                <div className="form-group">
                  <label>Enterprise Type *</label>
                  <select value={formData.enterpriseType} onChange={e => setFormData(f => ({ ...f, enterpriseType: e.target.value as EnterpriseType }))} required>
                    <option value="">Select type...</option>
                    {Object.entries(ENTERPRISE_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Phone</label>
                  <input type="tel" value={formData.phone} onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))} />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Description</label>
                  <textarea rows={2} value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Address</label>
                  <input type="text" value={formData.address} onChange={e => setFormData(f => ({ ...f, address: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>City</label>
                  <input type="text" value={formData.city} onChange={e => setFormData(f => ({ ...f, city: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>State</label>
                  <input type="text" value={formData.state} onChange={e => setFormData(f => ({ ...f, state: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>Country</label>
                  <input type="text" value={formData.country} onChange={e => setFormData(f => ({ ...f, country: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>Postal Code</label>
                  <input type="text" value={formData.postalCode} onChange={e => setFormData(f => ({ ...f, postalCode: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>Total Area</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="number" step="0.01" value={formData.totalArea} onChange={e => setFormData(f => ({ ...f, totalArea: e.target.value }))} style={{ flex: 1 }} />
                    <select value={formData.areaUnit} onChange={e => setFormData(f => ({ ...f, areaUnit: e.target.value }))} style={{ width: '100px' }}>
                      <option value="acres">Acres</option>
                      <option value="hectares">Hectares</option>
                      <option value="sqft">Sq Ft</option>
                      <option value="sqm">Sq M</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>License Number</label>
                  <input type="text" value={formData.licenseNumber} onChange={e => setFormData(f => ({ ...f, licenseNumber: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>Regulatory ID</label>
                  <input type="text" value={formData.regulatoryId} onChange={e => setFormData(f => ({ ...f, regulatoryId: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>Tax ID</label>
                  <input type="text" value={formData.taxId} onChange={e => setFormData(f => ({ ...f, taxId: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>Website</label>
                  <input type="url" value={formData.website} onChange={e => setFormData(f => ({ ...f, website: e.target.value }))} placeholder="https://" />
                </div>

                <div className="form-group">
                  <label>GPS Latitude</label>
                  <input type="number" step="0.000001" placeholder="Click map below" value={formData.gpsLatitude} onChange={e => setFormData(f => ({ ...f, gpsLatitude: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>GPS Longitude</label>
                  <input type="number" step="0.000001" placeholder="Click map below" value={formData.gpsLongitude} onChange={e => setFormData(f => ({ ...f, gpsLongitude: e.target.value }))} />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>📍 Set Location on Map</label>
                  <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <MapView
                      height={200}
                      markers={formData.gpsLatitude && formData.gpsLongitude ? [{
                        id: 'ent-form-loc',
                        lat: +formData.gpsLatitude,
                        lng: +formData.gpsLongitude,
                        color: '#3b82f6',
                        pulse: true,
                        popup: <div><strong>{formData.name || 'Enterprise'}</strong></div>,
                      }] : []}
                      onClick={(lat, lng) => setFormData(f => ({ ...f, gpsLatitude: lat.toFixed(6), gpsLongitude: lng.toFixed(6) }))}
                      center={formData.gpsLatitude && formData.gpsLongitude ? [+formData.gpsLatitude, +formData.gpsLongitude] : undefined}
                      zoom={formData.gpsLatitude ? 13 : undefined}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); resetForm() }}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingEnterprise ? 'Update' : 'Create'} Enterprise</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default EnterpriseManagement
