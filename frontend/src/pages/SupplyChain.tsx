import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, ProductBatch, TraceabilityEvent, QRCode as QRCodeType } from '../types'
import MapView from '../components/MapView'

const STATUS_COLORS: Record<string, string> = {
  in_production: '#3b82f6', quality_check: '#f59e0b', in_transit: '#8b5cf6', delivered: '#22c55e', recalled: '#ef4444'
}

const SupplyChainPage: React.FC = () => {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [batches, setBatches] = useState<ProductBatch[]>([])
  const [events, setEvents] = useState<TraceabilityEvent[]>([])
  const [qrCodes, setQrCodes] = useState<QRCodeType[]>([])
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'dashboard' | 'batches' | 'events' | 'qrcodes'>('dashboard')
  const [showForm, setShowForm] = useState(false)
  const [showEventForm, setShowEventForm] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [formData, setFormData] = useState({
    batchNumber: '', productType: '', description: '', quantity: '', unit: 'kg',
    productionDate: '', expiryDate: '', qualityGrade: '', currentHolder: ''
  })
  const [eventForm, setEventForm] = useState({
    batchId: '', eventType: 'production', title: '', description: '', location: '',
    gpsLat: '', gpsLng: ''
  })

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
      const [dashRes, batchRes, eventRes, qrRes] = await Promise.all([
        apiService.getSupplyChainDashboard(selectedEnterpriseId),
        apiService.listBatches(selectedEnterpriseId),
        apiService.listTraceabilityEvents(selectedEnterpriseId),
        apiService.listQRCodes(selectedEnterpriseId)
      ])
      setDashboard(dashRes.data || null)
      setBatches(batchRes.data?.items || [])
      setEvents(eventRes.data?.items || [])
      setQrCodes(qrRes.data?.items || [])
    } catch { /* fail silently */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [selectedEnterpriseId])

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    try {
      await apiService.createBatch(selectedEnterpriseId, {
        enterpriseId: selectedEnterpriseId, batchNumber: formData.batchNumber,
        productType: formData.productType, description: formData.description || undefined,
        quantity: parseFloat(formData.quantity) || 0, unit: formData.unit || 'kg',
        productionDate: formData.productionDate || undefined, expiryDate: formData.expiryDate || undefined,
        qualityGrade: formData.qualityGrade || undefined, currentHolder: formData.currentHolder || undefined,
      })
      setSuccessMsg('Batch created!')
      setShowForm(false)
      setFormData({ batchNumber: '', productType: '', description: '', quantity: '', unit: 'kg', productionDate: '', expiryDate: '', qualityGrade: '', currentHolder: '' })
      fetchData()
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed') }
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    try {
      await apiService.createTraceabilityEvent(selectedEnterpriseId, {
        enterpriseId: selectedEnterpriseId, batchId: eventForm.batchId || undefined,
        eventType: eventForm.eventType, title: eventForm.title,
        description: eventForm.description || undefined, location: eventForm.location || undefined,
        gpsLat: eventForm.gpsLat ? parseFloat(eventForm.gpsLat) : undefined,
        gpsLng: eventForm.gpsLng ? parseFloat(eventForm.gpsLng) : undefined,
      })
      setSuccessMsg('Traceability event logged!')
      setShowEventForm(false)
      setEventForm({ batchId: '', eventType: 'production', title: '', description: '', location: '', gpsLat: '', gpsLng: '' })
      fetchData()
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed') }
  }

  const handleVerifyEvent = async (id: string) => {
    try { await apiService.verifyTraceabilityEvent(id); setSuccessMsg('Event verified!'); fetchData() }
    catch { setError('Failed to verify') }
  }

  const handleGenerateQR = async (batchId: string) => {
    try {
      await apiService.generateQRCode(selectedEnterpriseId, {
        enterpriseId: selectedEnterpriseId, entityType: 'batch', entityId: batchId
      })
      setSuccessMsg('QR code generated!')
      fetchData()
    } catch { setError('Failed to generate QR') }
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>🔗 Supply Chain & Traceability (Farm-to-Fork)</h1>
        <p>Full birth-to-sale traceability, QR code generation, and blockchain-style audit trail</p>
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
        <div className="empty-state">Select an enterprise to view supply chain data</div>
      ) : loading ? (
        <div className="loading-spinner">Loading traceability data…</div>
      ) : (
        <>
          <div className="tab-bar">
            <button className={tab === 'dashboard' ? 'tab-active' : ''} onClick={() => setTab('dashboard')}>Dashboard</button>
            <button className={tab === 'batches' ? 'tab-active' : ''} onClick={() => setTab('batches')}>Product Batches</button>
            <button className={tab === 'events' ? 'tab-active' : ''} onClick={() => setTab('events')}>Traceability Events</button>
            <button className={tab === 'qrcodes' ? 'tab-active' : ''} onClick={() => setTab('qrcodes')}>QR Codes</button>
          </div>

          {tab === 'dashboard' && dashboard && (
            <div className="dashboard-grid">
              <div className="stat-card accent-blue">
                <div className="stat-value">{dashboard.summary?.totalBatches || 0}</div>
                <div className="stat-label">Total Batches</div>
              </div>
              <div className="stat-card accent-green">
                <div className="stat-value">{dashboard.summary?.activeBatches || 0}</div>
                <div className="stat-label">In Production</div>
              </div>
              <div className="stat-card accent-orange">
                <div className="stat-value">{dashboard.summary?.expiringBatches || 0}</div>
                <div className="stat-label">Expiring (30d)</div>
              </div>
              <div className="stat-card accent-purple">
                <div className="stat-value">{qrCodes.length}</div>
                <div className="stat-label">QR Codes</div>
              </div>

              {dashboard.batchStatusDistribution?.length > 0 && (
                <div className="card">
                  <h3>📦 Batch Status Distribution</h3>
                  <div className="mini-chart-bar">
                    {dashboard.batchStatusDistribution.map((s: any, i: number) => (
                      <div key={i} className="bar-row">
                        <span className="bar-label">{s.status.replace(/_/g, ' ')}</span>
                        <div className="bar-track"><div className="bar-fill" style={{ width: `${(+s.count / Math.max(1, ...dashboard.batchStatusDistribution.map((x: any) => +x.count))) * 100}%`, backgroundColor: STATUS_COLORS[s.status] || '#6b7280' }} /></div>
                        <span className="bar-value">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dashboard.eventTypeCounts?.length > 0 && (
                <div className="card">
                  <h3>📋 Event Types (90d)</h3>
                  <div className="mini-chart-bar">
                    {dashboard.eventTypeCounts.map((t: any, i: number) => (
                      <div key={i} className="bar-row">
                        <span className="bar-label">{t.event_type}</span>
                        <div className="bar-track"><div className="bar-fill" style={{ width: `${(+t.count / Math.max(1, ...dashboard.eventTypeCounts.map((x: any) => +x.count))) * 100}%` }} /></div>
                        <span className="bar-value">{t.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dashboard.expiringBatches?.length > 0 && (
                <div className="card full-width">
                  <h3>⏰ Expiring Soon</h3>
                  <table className="data-table">
                    <thead><tr><th>Batch #</th><th>Product</th><th>Expiry</th><th>Qty</th></tr></thead>
                    <tbody>{dashboard.expiringBatches.map((b: any, i: number) => (
                      <tr key={i}><td>{b.batch_number}</td><td>{b.product_type}</td>
                        <td style={{ color: '#f97316' }}>{b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : '–'}</td><td>{b.quantity} {b.unit}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'batches' && (
            <div>
              <div className="section-toolbar">
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Create Batch'}</button>
              </div>

              {showForm && (
                <form className="module-form" onSubmit={handleCreateBatch}>
                  <div className="form-grid">
                    <div className="form-group"><label>Batch Number *</label><input required value={formData.batchNumber} onChange={e => setFormData({ ...formData, batchNumber: e.target.value })} /></div>
                    <div className="form-group"><label>Product Type *</label>
                      <select value={formData.productType} onChange={e => setFormData({ ...formData, productType: e.target.value })}>
                        <option value="">-- Select --</option>
                        {['milk', 'meat', 'eggs', 'wool', 'honey', 'feed', 'medicine', 'semen', 'embryo', 'other'].map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group"><label>Quantity</label><input type="number" step="0.01" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} /></div>
                    <div className="form-group"><label>Unit</label><input value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} /></div>
                    <div className="form-group"><label>Production Date</label><input type="date" value={formData.productionDate} onChange={e => setFormData({ ...formData, productionDate: e.target.value })} /></div>
                    <div className="form-group"><label>Expiry Date</label><input type="date" value={formData.expiryDate} onChange={e => setFormData({ ...formData, expiryDate: e.target.value })} /></div>
                    <div className="form-group"><label>Quality Grade</label><input value={formData.qualityGrade} onChange={e => setFormData({ ...formData, qualityGrade: e.target.value })} /></div>
                    <div className="form-group"><label>Current Holder</label><input value={formData.currentHolder} onChange={e => setFormData({ ...formData, currentHolder: e.target.value })} /></div>
                    <div className="form-group full-width"><label>Description</label><textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
                  </div>
                  <button type="submit" className="btn-primary">Create Batch</button>
                </form>
              )}

              <table className="data-table">
                <thead><tr><th>Batch #</th><th>Product</th><th>Qty</th><th>Grade</th><th>Status</th><th>Expiry</th><th>Actions</th></tr></thead>
                <tbody>
                  {batches.map(b => (
                    <tr key={b.id}>
                      <td><strong>{b.batchNumber || (b as any).batch_number}</strong></td>
                      <td>{b.productType || (b as any).product_type}</td>
                      <td>{b.quantity} {b.unit}</td>
                      <td>{b.qualityGrade || (b as any).quality_grade || '—'}</td>
                      <td><span className="badge" style={{ backgroundColor: STATUS_COLORS[b.status] || '#6b7280' }}>{b.status?.replace(/_/g, ' ')}</span></td>
                      <td>{(b.expiryDate || (b as any).expiry_date) ? new Date(b.expiryDate || (b as any).expiry_date).toLocaleDateString() : '—'}</td>
                      <td><button className="btn-sm" onClick={() => handleGenerateQR(b.id)}>🔲 QR</button></td>
                    </tr>
                  ))}
                  {!batches.length && <tr><td colSpan={7} className="empty-cell">No batches</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'events' && (
            <div>
              <div className="section-toolbar">
                <button className="btn-primary" onClick={() => setShowEventForm(!showEventForm)}>{showEventForm ? 'Cancel' : '+ Log Event'}</button>
              </div>

              {showEventForm && (
                <form className="module-form" onSubmit={handleCreateEvent}>
                  <p style={{ fontSize: 13, color: '#888', margin: '0 0 12px' }}>💡 Click on the map below to set GPS location for this event</p>
                  <div className="form-grid">
                    <div className="form-group"><label>Batch</label>
                      <select value={eventForm.batchId} onChange={e => setEventForm({ ...eventForm, batchId: e.target.value })}>
                        <option value="">-- None --</option>
                        {batches.map(b => <option key={b.id} value={b.id}>{b.batchNumber || (b as any).batch_number}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label>Event Type *</label>
                      <select value={eventForm.eventType} onChange={e => setEventForm({ ...eventForm, eventType: e.target.value })}>
                        {['birth', 'vaccination', 'treatment', 'inspection', 'transfer', 'production', 'quality_check', 'packaging', 'shipment', 'delivery', 'recall', 'disposal'].map(t => (
                          <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group"><label>Title *</label><input required value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} /></div>
                    <div className="form-group"><label>Location (text)</label><input value={eventForm.location} onChange={e => setEventForm({ ...eventForm, location: e.target.value })} /></div>
                    <div className="form-group"><label>GPS Latitude</label><input type="number" step="0.000001" placeholder="Click map" value={eventForm.gpsLat} onChange={e => setEventForm({ ...eventForm, gpsLat: e.target.value })} /></div>
                    <div className="form-group"><label>GPS Longitude</label><input type="number" step="0.000001" placeholder="Click map" value={eventForm.gpsLng} onChange={e => setEventForm({ ...eventForm, gpsLng: e.target.value })} /></div>
                    <div className="form-group full-width"><label>Description</label><textarea value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} /></div>
                  </div>
                  <button type="submit" className="btn-primary">Log Event</button>
                </form>
              )}

              {/* Traceability Route Map */}
              {(() => {
                const geoEvents = events.filter(ev => (ev.gpsLat || (ev as any).gps_lat) && (ev.gpsLng || (ev as any).gps_lng))
                return geoEvents.length > 0 || showEventForm ? (
                  <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb', marginBottom: 20 }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>
                      <h3 style={{ margin: 0 }}>🗺️ Traceability Route Map</h3>
                      <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>
                        {geoEvents.length} event{geoEvents.length !== 1 ? 's' : ''} with GPS coordinates
                        {showEventForm && ' · Click map to set event location'}
                      </p>
                    </div>
                    <MapView
                      height={380}
                      markers={[
                        ...geoEvents.map((ev) => ({
                          id: ev.id,
                          lat: +(ev.gpsLat || (ev as any).gps_lat),
                          lng: +(ev.gpsLng || (ev as any).gps_lng),
                          color: ev.eventType === 'recall' || (ev as any).event_type === 'recall' ? '#ef4444'
                            : ev.eventType === 'delivery' || (ev as any).event_type === 'delivery' ? '#22c55e'
                            : ev.eventType === 'shipment' || (ev as any).event_type === 'shipment' ? '#8b5cf6'
                            : '#3b82f6',
                          popup: (
                            <div>
                              <strong>{ev.title}</strong><br />
                              <span style={{ fontSize: 12 }}>{ev.eventType || (ev as any).event_type}</span><br />
                              {ev.location && <span style={{ fontSize: 12 }}>{ev.location}</span>}
                              {ev.batchNumber && <><br /><span style={{ fontSize: 11 }}>Batch: {ev.batchNumber}</span></>}
                            </div>
                          ),
                        })),
                        ...(eventForm.gpsLat && eventForm.gpsLng && showEventForm ? [{
                          id: 'new-trace-event',
                          lat: +eventForm.gpsLat,
                          lng: +eventForm.gpsLng,
                          color: '#ec4899',
                          pulse: true,
                          popup: <div><strong>New Event Location</strong></div>,
                        }] : []),
                      ]}
                      polylines={geoEvents.length > 1 ? [{
                        id: 'trace-route',
                        positions: geoEvents.map(ev => [+(ev.gpsLat || (ev as any).gps_lat), +(ev.gpsLng || (ev as any).gps_lng)] as [number, number]),
                        color: '#3b82f6',
                        weight: 2,
                        dashArray: '6, 4',
                      }] : []}
                      onClick={(lat, lng) => {
                        if (showEventForm) {
                          setEventForm(f => ({ ...f, gpsLat: lat.toFixed(6), gpsLng: lng.toFixed(6) }))
                        }
                      }}
                      fitToData={geoEvents.length > 0}
                    />
                  </div>
                ) : null
              })()}

              <table className="data-table">
                <thead><tr><th>Title</th><th>Type</th><th>Batch</th><th>Location</th><th>Verified</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>
                  {events.map(ev => (
                    <tr key={ev.id}>
                      <td><strong>{ev.title}</strong></td>
                      <td><span className="badge">{ev.eventType || (ev as any).event_type}</span></td>
                      <td>{ev.batchNumber || (ev as any).batch_number || '—'}</td>
                      <td>{ev.location || '—'}</td>
                      <td>{(ev.verifiedBy || (ev as any).verified_by) ? <span className="badge badge-verified">✓ Verified</span> : <span className="badge badge-pending">Unverified</span>}</td>
                      <td>{(ev.eventDate || (ev as any).event_date) ? new Date(ev.eventDate || (ev as any).event_date).toLocaleDateString() : '–'}</td>
                      <td>{!(ev.verifiedBy || (ev as any).verified_by) && <button className="btn-sm" onClick={() => handleVerifyEvent(ev.id)}>Verify</button>}</td>
                    </tr>
                  ))}
                  {!events.length && <tr><td colSpan={7} className="empty-cell">No traceability events</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'qrcodes' && (
            <div>
              <div className="cards-grid">
                {qrCodes.map(qr => (
                  <div key={qr.id} className="card">
                    <h3>🔲 QR Code</h3>
                    <div className="card-stats">
                      <div>Type: <strong>{qr.entityType || (qr as any).entity_type}</strong></div>
                      <div>Scans: <strong>{qr.scanCount || (qr as any).scan_count || 0}</strong></div>
                    </div>
                    <div className="card-footer">
                      <small>Created {(qr.createdAt || (qr as any).created_at) ? new Date(qr.createdAt || (qr as any).created_at).toLocaleDateString() : '–'}</small>
                      <span className={`badge badge-${(qr.isActive || (qr as any).is_active) ? 'active' : 'inactive'}`}>
                        {(qr.isActive || (qr as any).is_active) ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                ))}
                {!qrCodes.length && <div className="empty-state">No QR codes generated yet — create one from a batch</div>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default SupplyChainPage
