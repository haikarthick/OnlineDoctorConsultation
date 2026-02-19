import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, FeedItem, FeedAnalytics } from '../types'

const FeedInventory: React.FC = () => {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [feeds, setFeeds] = useState<FeedItem[]>([])
  const [analytics, setAnalytics] = useState<FeedAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'inventory' | 'analytics'>('inventory')
  const [showForm, setShowForm] = useState(false)
  const [showConsumptionForm, setShowConsumptionForm] = useState(false)
  const [restockId, setRestockId] = useState<string | null>(null)
  const [restockQty, setRestockQty] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    feedType: 'hay', name: '', brand: '', batchNumber: '',
    quantityInStock: '', unit: 'kg', minimumStockLevel: '50',
    costPerUnit: '', expiryDate: '', storageLocation: '', supplier: ''
  })
  const [consumptionData, setConsumptionData] = useState({
    feedId: '', quantityUsed: '', notes: ''
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

  const fetchData = async () => {
    if (!selectedEnterpriseId) return
    try {
      setLoading(true)
      const [feedRes, analyticsRes] = await Promise.all([
        apiService.listFeeds(selectedEnterpriseId),
        apiService.getFeedAnalytics(selectedEnterpriseId)
      ])
      setFeeds(feedRes.data || [])
      setAnalytics(analyticsRes.data || null)
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [selectedEnterpriseId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    const payload: Record<string, unknown> = {
      enterpriseId: selectedEnterpriseId,
      ...formData,
      quantityInStock: parseFloat(formData.quantityInStock),
      minimumStockLevel: parseFloat(formData.minimumStockLevel),
      costPerUnit: parseFloat(formData.costPerUnit),
      expiryDate: formData.expiryDate || undefined,
    }
    try {
      if (editingId) {
        await apiService.updateFeed(editingId, payload)
        setSuccessMsg('Feed updated!')
      } else {
        await apiService.createFeed(selectedEnterpriseId, payload)
        setSuccessMsg('Feed added!')
      }
      setShowForm(false); setEditingId(null)
      resetForm()
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save feed')
    }
  }

  const resetForm = () => setFormData({ feedType: 'hay', name: '', brand: '', batchNumber: '', quantityInStock: '', unit: 'kg', minimumStockLevel: '50', costPerUnit: '', expiryDate: '', storageLocation: '', supplier: '' })

  const handleRestock = async () => {
    if (!restockId || !restockQty) return
    try {
      await apiService.restockFeed(restockId, parseFloat(restockQty))
      setSuccessMsg('Feed restocked!')
      setRestockId(null); setRestockQty('')
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to restock')
    }
  }

  const handleLogConsumption = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    try {
      await apiService.logFeedConsumption(selectedEnterpriseId, {
        enterpriseId: selectedEnterpriseId,
        feedId: consumptionData.feedId,
        quantityUsed: parseFloat(consumptionData.quantityUsed),
        notes: consumptionData.notes || undefined,
      })
      setSuccessMsg('Consumption logged!')
      setShowConsumptionForm(false)
      setConsumptionData({ feedId: '', quantityUsed: '', notes: '' })
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to log consumption')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this feed item?')) return
    try {
      await apiService.deleteFeed(id)
      setSuccessMsg('Feed deleted!')
      fetchData()
    } catch { setError('Failed to delete') }
  }

  const startEdit = (feed: FeedItem) => {
    setEditingId(feed.id)
    setFormData({
      feedType: feed.feedType, name: feed.name, brand: feed.brand || '',
      batchNumber: feed.batchNumber || '', quantityInStock: feed.quantityInStock.toString(),
      unit: feed.unit, minimumStockLevel: feed.minimumStockLevel.toString(),
      costPerUnit: feed.costPerUnit.toString(), expiryDate: feed.expiryDate?.split('T')[0] || '',
      storageLocation: feed.storageLocation || '', supplier: feed.supplier || ''
    })
    setShowForm(true)
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>🌾 Feed & Inventory Management</h1>
        <p>Track feed stock levels, log consumption, and get low-stock alerts</p>
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

      {selectedEnterpriseId && (
        <>
          <div className="tab-bar">
            <button className={`tab-btn ${tab === 'inventory' ? 'active' : ''}`} onClick={() => setTab('inventory')}>📦 Inventory</button>
            <button className={`tab-btn ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>📊 Analytics</button>
            <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null); resetForm() }}>+ Add Feed</button>
            <button className="btn btn-secondary" onClick={() => setShowConsumptionForm(!showConsumptionForm)}>📝 Log Consumption</button>
          </div>

          {showForm && (
            <form className="module-form" onSubmit={handleSubmit}>
              <h3>{editingId ? 'Edit Feed Item' : 'Add New Feed'}</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Name *</label>
                  <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Feed Type</label>
                  <select value={formData.feedType} onChange={e => setFormData({ ...formData, feedType: e.target.value })}>
                    {['hay', 'grain', 'pellet', 'silage', 'mineral', 'supplement', 'concentrate', 'forage', 'medicated', 'other'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Brand</label>
                  <input value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Batch Number</label>
                  <input value={formData.batchNumber} onChange={e => setFormData({ ...formData, batchNumber: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Quantity in Stock *</label>
                  <input type="number" step="0.01" required value={formData.quantityInStock} onChange={e => setFormData({ ...formData, quantityInStock: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                    {['kg', 'lb', 'ton', 'bag', 'bale', 'liter', 'gallon'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Minimum Stock Level</label>
                  <input type="number" step="0.01" value={formData.minimumStockLevel} onChange={e => setFormData({ ...formData, minimumStockLevel: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Cost per Unit *</label>
                  <input type="number" step="0.01" required value={formData.costPerUnit} onChange={e => setFormData({ ...formData, costPerUnit: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Expiry Date</label>
                  <input type="date" value={formData.expiryDate} onChange={e => setFormData({ ...formData, expiryDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Storage Location</label>
                  <input value={formData.storageLocation} onChange={e => setFormData({ ...formData, storageLocation: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Supplier</label>
                  <input value={formData.supplier} onChange={e => setFormData({ ...formData, supplier: e.target.value })} />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Add Feed'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null) }}>Cancel</button>
              </div>
            </form>
          )}

          {showConsumptionForm && (
            <form className="module-form" onSubmit={handleLogConsumption}>
              <h3>Log Feed Consumption</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Feed *</label>
                  <select required value={consumptionData.feedId} onChange={e => setConsumptionData({ ...consumptionData, feedId: e.target.value })}>
                    <option value="">-- Select Feed --</option>
                    {feeds.map(f => <option key={f.id} value={f.id}>{f.name} ({f.quantityInStock} {f.unit})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantity Used *</label>
                  <input type="number" step="0.01" required value={consumptionData.quantityUsed} onChange={e => setConsumptionData({ ...consumptionData, quantityUsed: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <input value={consumptionData.notes} onChange={e => setConsumptionData({ ...consumptionData, notes: e.target.value })} />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">Log Consumption</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowConsumptionForm(false)}>Cancel</button>
              </div>
            </form>
          )}

          {loading ? <p className="loading-text">Loading...</p> : tab === 'inventory' ? (
            <div className="card full-width">
              <h3>Feed Inventory</h3>
              {feeds.length === 0 ? <p className="empty-text">No feed items in inventory.</p> : (
                <table className="data-table">
                  <thead><tr><th>Name</th><th>Type</th><th>Stock</th><th>Min Level</th><th>Cost/Unit</th><th>Expiry</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {feeds.map(f => {
                      const isLow = f.quantityInStock <= f.minimumStockLevel
                      return (
                        <tr key={f.id} className={isLow ? 'row-warning' : ''}>
                          <td><strong>{f.name}</strong>{f.brand && <small> ({f.brand})</small>}</td>
                          <td>{f.feedType}</td>
                          <td><span className={isLow ? 'text-danger' : 'text-success'}>{f.quantityInStock} {f.unit}</span></td>
                          <td>{f.minimumStockLevel} {f.unit}</td>
                          <td>${Number(f.costPerUnit).toFixed(2)}</td>
                          <td>{f.expiryDate ? new Date(f.expiryDate).toLocaleDateString() : '–'}</td>
                          <td>{f.storageLocation || '–'}</td>
                          <td>{isLow ? <span className="badge badge-danger">Low Stock</span> : <span className="badge badge-success">OK</span>}</td>
                          <td>
                            <button className="btn btn-sm" onClick={() => startEdit(f)}>Edit</button>
                            {restockId === f.id ? (
                              <span className="inline-form">
                                <input type="number" step="0.01" placeholder="Qty" value={restockQty} onChange={e => setRestockQty(e.target.value)} style={{ width: 80 }} />
                                <button className="btn btn-sm btn-success" onClick={handleRestock}>✓</button>
                                <button className="btn btn-sm" onClick={() => setRestockId(null)}>✗</button>
                              </span>
                            ) : (
                              <button className="btn btn-sm btn-secondary" onClick={() => setRestockId(f.id)}>Restock</button>
                            )}
                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(f.id)}>Del</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ) : analytics ? (
            <div className="dashboard-grid">
              <div className="card">
                <h3>Total Inventory Value</h3>
                <div className="big-stat">${Number(analytics.totalInventoryValue || 0).toFixed(2)}</div>
              </div>

              <div className="card">
                <h3>⚠️ Low Stock Alerts</h3>
                {(analytics.lowStockAlerts || []).length === 0 ? (
                  <p className="empty-text">All stock levels OK!</p>
                ) : (
                  <ul className="alert-list">
                    {analytics.lowStockAlerts.map(f => (
                      <li key={f.id} className="alert-item danger">
                        <strong>{f.name}</strong>: {f.quantityInStock} {f.unit} (min: {f.minimumStockLevel})
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="card">
                <h3>Consumption by Type (30 days)</h3>
                <table className="data-table compact">
                  <thead><tr><th>Type</th><th>Used</th><th>Cost</th></tr></thead>
                  <tbody>
                    {(analytics.consumptionByType || []).map(c => (
                      <tr key={c.feed_type}>
                        <td>{c.feed_type}</td>
                        <td>{Number(c.total_used).toFixed(1)}</td>
                        <td>${Number(c.total_cost).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <h3>Daily Consumption Trend</h3>
                <div className="mini-chart">
                  {(analytics.dailyConsumptionTrend || []).slice(-14).map((d, i) => (
                    <div key={i} className="chart-bar-wrapper">
                      <div className="chart-bar" style={{ height: `${Math.min(100, (Number(d.total_used) / Math.max(1, ...analytics.dailyConsumptionTrend.map(x => Number(x.total_used)))) * 100)}%` }}></div>
                      <span className="chart-label">{Number(d.total_used).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default FeedInventory
