import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { useScrollToForm } from '../hooks/useScrollToForm'
import { Enterprise, ProductBatch, TraceabilityEvent, QRCode as QRCodeType } from '../types'
import MapView from '../components/MapView'
import { useTranslation } from 'react-i18next'

const STATUS_COLORS: Record<string, string> = {
  in_production: '#3b82f6', quality_check: '#f59e0b', in_transit: '#8b5cf6', delivered: '#22c55e', recalled: '#ef4444'
}

const SupplyChainPage: React.FC = () => {
  const { t } = useTranslation()

  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [batches, setBatches] = useState<ProductBatch[]>([])
  const [events, setEvents] = useState<TraceabilityEvent[]>([])
  const [qrCodes, setQrCodes] = useState<QRCodeType[]>([])
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'dashboard' | 'batches' | 'events' | 'qrcodes'>('dashboard')
  const [showForm, setShowForm] = useState(false)
  const formRef = useScrollToForm(showForm)
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
      setSuccessMsg(t('supplyChain.batchCreated'))
      setShowForm(false)
      setFormData({ batchNumber: '', productType: '', description: '', quantity: '', unit: 'kg', productionDate: '', expiryDate: '', qualityGrade: '', currentHolder: '' })
      fetchData()
    } catch (err: any) { setError(err.response?.data?.error?.message || t('common.failedToSave')) }
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
      setSuccessMsg(t('supplyChain.eventLogged'))
      setShowEventForm(false)
      setEventForm({ batchId: '', eventType: 'production', title: '', description: '', location: '', gpsLat: '', gpsLng: '' })
      fetchData()
    } catch (err: any) { setError(err.response?.data?.error?.message || t('common.failedToSave')) }
  }

  const handleVerifyEvent = async (id: string) => {
    try { await apiService.verifyTraceabilityEvent(id); setSuccessMsg(t('supplyChain.eventVerified')); fetchData() }
    catch { setError(t('supplyChain.failedVerify')) }
  }

  const handleGenerateQR = async (batchId: string) => {
    try {
      await apiService.generateQRCode(selectedEnterpriseId, {
        enterpriseId: selectedEnterpriseId, entityType: 'batch', entityId: batchId
      })
      setSuccessMsg(t('supplyChain.qrGenerated'))
      fetchData()
    } catch { setError(t('supplyChain.failedQR')) }
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>{t('supplyChain.pageTitle')}</h1>
        <p>{t('supplyChain.subtitle')}</p>
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
        <div className="empty-state">{t('supplyChain.selectEnterprise')}</div>
      ) : loading ? (
        <div className="loading-spinner">{t('supplyChain.loading')}</div>
      ) : (
        <>
          <div className="tab-bar">
            <button className={tab === 'dashboard' ? 'tab-active' : ''} onClick={() => setTab('dashboard')}>{t('supplyChain.tabs.dashboard')}</button>
            <button className={tab === 'batches' ? 'tab-active' : ''} onClick={() => setTab('batches')}>{t('supplyChain.tabs.batches')}</button>
            <button className={tab === 'events' ? 'tab-active' : ''} onClick={() => setTab('events')}>{t('supplyChain.tabs.events')}</button>
            <button className={tab === 'qrcodes' ? 'tab-active' : ''} onClick={() => setTab('qrcodes')}>{t('supplyChain.tabs.qrCodes')}</button>
          </div>

          {tab === 'dashboard' && dashboard && (
            <div className="dashboard-grid">
              <div className="stat-card accent-blue">
                <div className="stat-value">{dashboard.summary?.totalBatches || 0}</div>
                <div className="stat-label">{t('supplyChain.stats.totalBatches')}</div>
              </div>
              <div className="stat-card accent-green">
                <div className="stat-value">{dashboard.summary?.activeBatches || 0}</div>
                <div className="stat-label">{t('supplyChain.stats.inProduction')}</div>
              </div>
              <div className="stat-card accent-orange">
                <div className="stat-value">{dashboard.summary?.expiringBatches || 0}</div>
                <div className="stat-label">{t('supplyChain.stats.expiring30d')}</div>
              </div>
              <div className="stat-card accent-purple">
                <div className="stat-value">{qrCodes.length}</div>
                <div className="stat-label">{t('supplyChain.tabs.qrCodes')}</div>
              </div>

              {dashboard.batchStatusDistribution?.length > 0 && (
                <div className="card">
                  <h3>📦 {t('supplyChain.batchStatusDist')}</h3>
                  <div className="mini-chart-bar">
                    {dashboard.batchStatusDistribution.map((s: any, i: number) => (
                      <div key={i} className="bar-row">
                        <span className="bar-label">{(s.status || '').replace(/_/g, ' ')}</span>
                        <div className="bar-track"><div className="bar-fill" style={{ width: `${(+s.count / Math.max(1, ...dashboard.batchStatusDistribution.map((x: any) => +x.count))) * 100}%`, backgroundColor: STATUS_COLORS[s.status] || '#6b7280' }} /></div>
                        <span className="bar-value">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dashboard.eventTypeCounts?.length > 0 && (
                <div className="card">
                  <h3>📋 {t('supplyChain.eventTypes90d')}</h3>
                  <div className="mini-chart-bar">
                    {dashboard.eventTypeCounts.map((et: any, i: number) => (
                      <div key={i} className="bar-row">
                        <span className="bar-label">{et.event_type}</span>
                        <div className="bar-track"><div className="bar-fill" style={{ width: `${(+et.count / Math.max(1, ...dashboard.eventTypeCounts.map((x: any) => +x.count))) * 100}%` }} /></div>
                        <span className="bar-value">{et.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dashboard.expiringBatches?.length > 0 && (
                <div className="card full-width">
                  <h3>⏰ {t('supplyChain.expiringSoon')}</h3>
                  <table className="data-table">
                    <thead><tr><th>{t('supplyChain.batchNum')}</th><th>{t('supplyChain.product')}</th><th>{t('supplyChain.expiry')}</th><th>{t('supplyChain.qty')}</th></tr></thead>
                    <tbody>{dashboard.expiringBatches.map((b: any, i: number) => (
                      <tr key={i}><td>{b.batch_number}</td><td>{b.product_type}</td>
                        <td className="si-a80c554d">{b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : '-'}</td><td>{b.quantity} {b.unit}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'batches' && (
            <div>
              <div className="section-toolbar">
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? t('common.cancel') : t('supplyChain.createBatch')}</button>
              </div>

              {showForm && <div className="edit-form-overlay" onClick={() => { setShowForm(false) }} />}
              {showForm && (
                <div ref={formRef} className="edit-form-panel">
                <form className="module-form" onSubmit={handleCreateBatch}>
                  <div className="form-grid">
                    <div className="form-group"><label>{t('supplyChain.batchNumber')} *</label><input required value={formData.batchNumber} onChange={e => setFormData({ ...formData, batchNumber: e.target.value })} /></div>
                    <div className="form-group"><label>{t('supplyChain.productType')} *</label>
                      <select value={formData.productType} onChange={e => setFormData({ ...formData, productType: e.target.value })}>
                        <option value="">{t('common.selectOption')}</option>
                        {['milk', 'meat', 'eggs', 'wool', 'honey', 'feed', 'medicine', 'semen', 'embryo', 'other'].map(tt => (
                          <option key={tt} value={tt}>{tt}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group"><label>{t('supplyChain.quantity')}</label><input type="number" step="0.01" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} /></div>
                    <div className="form-group"><label>{t('sustainability.unit')}</label><input value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} /></div>
                    <div className="form-group"><label>{t('supplyChain.productionDate')}</label><input type="date" value={formData.productionDate} onChange={e => setFormData({ ...formData, productionDate: e.target.value })} /></div>
                    <div className="form-group"><label>{t('supplyChain.expiryDate')}</label><input type="date" value={formData.expiryDate} onChange={e => setFormData({ ...formData, expiryDate: e.target.value })} /></div>
                    <div className="form-group"><label>{t('supplyChain.qualityGrade')}</label><input value={formData.qualityGrade} onChange={e => setFormData({ ...formData, qualityGrade: e.target.value })} /></div>
                    <div className="form-group"><label>{t('supplyChain.currentHolder')}</label><input value={formData.currentHolder} onChange={e => setFormData({ ...formData, currentHolder: e.target.value })} /></div>
                    <div className="form-group full-width"><label>{t('common.description')}</label><textarea onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
                  </div>
                  <button type="submit" className="btn-primary">{t('supplyChain.createBatch')}</button>
                </form>
                </div>
              )}

              <table className="data-table">
                <thead><tr><th>{t('supplyChain.batchNum')}</th><th>{t('supplyChain.product')}</th><th>{t('supplyChain.qty')}</th><th>{t('supplyChain.grade')}</th><th>{t('common.status')}</th><th>{t('supplyChain.expiry')}</th><th>{t('common.actions')}</th></tr></thead>
                <tbody>
                  {batches.map(b => (
                    <tr key={b.id}>
                      <td><strong>{b.batchNumber || (b as any).batch_number}</strong></td>
                      <td>{b.productType || (b as any).product_type}</td>
                      <td>{b.quantity} {b.unit}</td>
                      <td>{b.qualityGrade || (b as any).quality_grade || '-'}</td>
                      <td><span className="badge" style={{ backgroundColor: STATUS_COLORS[b.status] || '#6b7280' }}>{b.status?.replace(/_/g, ' ')}</span></td>
                      <td>{(b.expiryDate || (b as any).expiry_date) ? new Date(b.expiryDate || (b as any).expiry_date).toLocaleDateString() : '-'}</td>
                      <td><button className="btn-sm" onClick={() => handleGenerateQR(b.id)}>🔲 QR</button></td>
                    </tr>
                  ))}
                  {!batches.length && <tr><td colSpan={7} className="empty-cell">{t('supplyChain.noBatches')}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'events' && (
            <div>
              <div className="section-toolbar">
                <button className="btn-primary" onClick={() => setShowEventForm(!showEventForm)}>{showEventForm ? t('common.cancel') : t('supplyChain.logEvent')}</button>
              </div>

              {showEventForm && (
                <form className="module-form" onSubmit={handleCreateEvent}>
                  <p className="si-f2fe0f46">💡 Click on the map below to set GPS location for this event</p>
                  <div className="form-grid">
                    <div className="form-group"><label>{t('supplyChain.batch')}</label>
                      <select value={eventForm.batchId} onChange={e => setEventForm({ ...eventForm, batchId: e.target.value })}>
                        <option value="">{t('common.selectOption')}</option>
                        {batches.map(b => <option key={b.id} value={b.id}>{b.batchNumber || (b as any).batch_number}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label>{t('supplyChain.eventType')} *</label>
                      <select value={eventForm.eventType} onChange={e => setEventForm({ ...eventForm, eventType: e.target.value })}>
                        {['birth', 'vaccination', 'treatment', 'inspection', 'transfer', 'production', 'quality_check', 'packaging', 'shipment', 'delivery', 'recall', 'disposal'].map(tt => (
                          <option key={tt} value={tt}>{tt.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group"><label>{t('workforce.form.title')} *</label><input required value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} /></div>
                    <div className="form-group"><label>{t('supplyChain.location')}</label><input value={eventForm.location} onChange={e => setEventForm({ ...eventForm, location: e.target.value })} /></div>
                    <div className="form-group"><label>{t('supplyChain.gpsLat')}</label><input type="number" step="0.000001" placeholder="Click map" value={eventForm.gpsLat} onChange={e => setEventForm({ ...eventForm, gpsLat: e.target.value })} /></div>
                    <div className="form-group"><label>{t('supplyChain.gpsLng')}</label><input type="number" step="0.000001" placeholder="Click map" value={eventForm.gpsLng} onChange={e => setEventForm({ ...eventForm, gpsLng: e.target.value })} /></div>
                    <div className="form-group full-width"><label>{t('common.description')}</label><textarea value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} /></div>
                  </div>
                  <button type="submit" className="btn-primary">{t('supplyChain.logEvent')}</button>
                </form>
              )}

              {/* Traceability Route Map */}
              {(() => {
                const geoEvents = events.filter(ev => (ev.gpsLat || (ev as any).gps_lat) && (ev.gpsLng || (ev as any).gps_lng))
                return geoEvents.length > 0 || showEventForm ? (
                  <div className="si-3f5b50f7">
                    <div className="si-be8ac8a2">
                      <h3 className="si-44087c4b">🗺️ Traceability Route Map</h3>
                      <p className="si-7438976a">
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
                              <span className="si-756a9f21">{ev.eventType || (ev as any).event_type}</span><br />
                              {ev.location && <span className="si-756a9f21">{ev.location}</span>}
                              {ev.batchNumber && <><br /><span className="si-6af9d82f">Batch: {ev.batchNumber}</span></>}
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
                <thead><tr><th>{t('workforce.form.title')}</th><th>{t('common.type')}</th><th>{t('supplyChain.batch')}</th><th>{t('supplyChain.location')}</th><th>{t('supplyChain.verified')}</th><th>{t('common.date')}</th><th>{t('common.actions')}</th></tr></thead>
                <tbody>
                  {events.map(ev => (
                    <tr key={ev.id}>
                      <td><strong>{ev.title}</strong></td>
                      <td><span className="badge">{ev.eventType || (ev as any).event_type}</span></td>
                      <td>{ev.batchNumber || (ev as any).batch_number || '-'}</td>
                      <td>{ev.location || '-'}</td>
                      <td>{(ev.verifiedBy || (ev as any).verified_by) ? <span className="badge badge-verified">✓ Verified</span> : <span className="badge badge-pending">Unverified</span>}</td>
                      <td>{(ev.eventDate || (ev as any).event_date) ? new Date(ev.eventDate || (ev as any).event_date).toLocaleDateString() : '-'}</td>
                      <td>{!(ev.verifiedBy || (ev as any).verified_by) && <button className="btn-sm" onClick={() => handleVerifyEvent(ev.id)}>{t('supplyChain.verify')}</button>}</td>
                    </tr>
                  ))}
                  {!events.length && <tr><td colSpan={7} className="empty-cell">{t('supplyChain.noEvents')}</td></tr>}
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
                      <small>Created {(qr.createdAt || (qr as any).created_at) ? new Date(qr.createdAt || (qr as any).created_at).toLocaleDateString() : '-'}</small>
                      <span className={`badge badge-${(qr.isActive || (qr as any).is_active) ? 'active' : 'inactive'}`}>
                        {(qr.isActive || (qr as any).is_active) ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                ))}
                {!qrCodes.length && <div className="empty-state">{t('supplyChain.noQRCodes')}</div>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default SupplyChainPage
