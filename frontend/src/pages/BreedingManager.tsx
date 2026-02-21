import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, BreedingRecord, BreedingStats } from '../types'

const STATUS_COLORS: Record<string, string> = {
  bred: '#3b82f6', confirmed_pregnant: '#22c55e', not_pregnant: '#94a3b8',
  delivered: '#8b5cf6', aborted: '#ef4444', reabsorbed: '#f97316'
}

const BreedingManager: React.FC = () => {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [records, setRecords] = useState<BreedingRecord[]>([])
  const [stats, setStats] = useState<BreedingStats | null>(null)
  const [upcomingDue, setUpcomingDue] = useState<BreedingRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [tab, setTab] = useState<'records' | 'upcoming' | 'stats'>('records')
  const [formData, setFormData] = useState({
    damId: '', sireId: '', breedingDate: '', breedingMethod: 'natural',
    notes: '', status: 'bred', offspringCount: '', liveOffspring: '', stillborn: ''
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
      const [recRes, statsRes, dueRes] = await Promise.all([
        apiService.listBreedingRecords(selectedEnterpriseId),
        apiService.getBreedingStats(selectedEnterpriseId),
        apiService.getUpcomingDueDates(selectedEnterpriseId, 60)
      ])
      setRecords(recRes.data?.items || [])
      setStats(statsRes.data || null)
      setUpcomingDue(dueRes.data || [])
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [selectedEnterpriseId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    const payload: Record<string, unknown> = {
      enterpriseId: selectedEnterpriseId,
      damId: formData.damId,
      sireId: formData.sireId || undefined,
      breedingDate: formData.breedingDate,
      breedingMethod: formData.breedingMethod,
      status: formData.status,
      notes: formData.notes || undefined,
      offspringCount: formData.offspringCount ? parseInt(formData.offspringCount) : undefined,
      liveOffspring: formData.liveOffspring ? parseInt(formData.liveOffspring) : undefined,
      stillborn: formData.stillborn ? parseInt(formData.stillborn) : undefined,
    }
    try {
      if (editingId) {
        await apiService.updateBreedingRecord(editingId, payload)
        setSuccessMsg('Breeding record updated!')
      } else {
        await apiService.createBreedingRecord(selectedEnterpriseId, payload)
        setSuccessMsg('Breeding record created!')
      }
      setShowForm(false); setEditingId(null)
      setFormData({ damId: '', sireId: '', breedingDate: '', breedingMethod: 'natural', notes: '', status: 'bred', offspringCount: '', liveOffspring: '', stillborn: '' })
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save breeding record')
    }
  }

  const startEdit = (rec: BreedingRecord) => {
    setEditingId(rec.id)
    setFormData({
      damId: rec.damId, sireId: rec.sireId || '', breedingDate: rec.breedingDate?.split('T')[0] || '',
      breedingMethod: rec.breedingMethod || 'natural', notes: rec.notes || '',
      status: rec.status, offspringCount: rec.offspringCount?.toString() || '',
      liveOffspring: rec.liveOffspring?.toString() || '', stillborn: rec.stillborn?.toString() || ''
    })
    setShowForm(true)
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>🧬 Breeding & Genetics Manager</h1>
        <p>Track breeding records, monitor pregnancies, and analyze reproductive performance</p>
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
            <button className={`tab-btn ${tab === 'records' ? 'active' : ''}`} onClick={() => setTab('records')}>📋 Records</button>
            <button className={`tab-btn ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>🍼 Upcoming Due ({upcomingDue.length})</button>
            <button className={`tab-btn ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>📊 Statistics</button>
            <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null) }}>+ New Record</button>
          </div>

          {showForm && (
            <form className="module-form" onSubmit={handleSubmit}>
              <h3>{editingId ? 'Edit Breeding Record' : 'New Breeding Record'}</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Dam (Mother) ID *</label>
                  <input required value={formData.damId} onChange={e => setFormData({ ...formData, damId: e.target.value })} placeholder="UUID of dam" />
                </div>
                <div className="form-group">
                  <label>Sire (Father) ID</label>
                  <input value={formData.sireId} onChange={e => setFormData({ ...formData, sireId: e.target.value })} placeholder="UUID of sire" />
                </div>
                <div className="form-group">
                  <label>Breeding Date *</label>
                  <input type="date" required value={formData.breedingDate} onChange={e => setFormData({ ...formData, breedingDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Method</label>
                  <select value={formData.breedingMethod} onChange={e => setFormData({ ...formData, breedingMethod: e.target.value })}>
                    {['natural', 'artificial_insemination', 'embryo_transfer', 'ivf'].map(m => <option key={m} value={m}>{m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                    {['bred', 'confirmed_pregnant', 'not_pregnant', 'delivered', 'aborted', 'reabsorbed'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Offspring Count</label>
                  <input type="number" value={formData.offspringCount} onChange={e => setFormData({ ...formData, offspringCount: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Live Offspring</label>
                  <input type="number" value={formData.liveOffspring} onChange={e => setFormData({ ...formData, liveOffspring: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Stillborn</label>
                  <input type="number" value={formData.stillborn} onChange={e => setFormData({ ...formData, stillborn: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Create'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null) }}>Cancel</button>
              </div>
            </form>
          )}

          {loading ? <p className="loading-text">Loading...</p> : tab === 'records' ? (
            <div className="card full-width">
              <h3>Breeding Records</h3>
              {records.length === 0 ? <p className="empty-text">No breeding records yet.</p> : (
                <table className="data-table">
                  <thead><tr><th>Dam</th><th>Sire</th><th>Date</th><th>Method</th><th>Status</th><th>Due Date</th><th>Offspring</th><th>Actions</th></tr></thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.id}>
                        <td>{r.damName || r.damId?.slice(0, 8)}</td>
                        <td>{r.sireName || r.sireId?.slice(0, 8) || '–'}</td>
                        <td>{r.breedingDate ? new Date(r.breedingDate).toLocaleDateString() : '–'}</td>
                        <td>{r.breedingMethod?.replace(/_/g, ' ')}</td>
                        <td><span className="badge" style={{ background: STATUS_COLORS[r.status] || '#888' }}>{r.status?.replace(/_/g, ' ')}</span></td>
                        <td>{r.expectedDueDate ? new Date(r.expectedDueDate).toLocaleDateString() : '–'}</td>
                        <td>{r.liveOffspring ?? '–'} / {r.offspringCount ?? '–'}</td>
                        <td><button className="btn btn-sm" onClick={() => startEdit(r)}>Edit</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : tab === 'upcoming' ? (
            <div className="card full-width">
              <h3>🍼 Upcoming Due Dates (next 60 days)</h3>
              {upcomingDue.length === 0 ? <p className="empty-text">No upcoming births expected.</p> : (
                <table className="data-table">
                  <thead><tr><th>Dam</th><th>Expected Due</th><th>Days Left</th><th>Status</th><th>Method</th></tr></thead>
                  <tbody>
                    {upcomingDue.map(r => {
                      const daysLeft = r.expectedDueDate ? Math.ceil((new Date(r.expectedDueDate).getTime() - Date.now()) / 86400000) : null
                      return (
                        <tr key={r.id}>
                          <td>{r.damName || r.damId?.slice(0, 8)}</td>
                          <td>{r.expectedDueDate ? new Date(r.expectedDueDate).toLocaleDateString() : '–'}</td>
                          <td><span className={`badge ${daysLeft && daysLeft <= 7 ? 'badge-danger' : daysLeft && daysLeft <= 14 ? 'badge-warning' : ''}`}>{daysLeft ?? '?'} days</span></td>
                          <td>{r.status?.replace(/_/g, ' ')}</td>
                          <td>{r.breedingMethod?.replace(/_/g, ' ')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ) : tab === 'stats' && stats ? (
            <div className="dashboard-grid">
              <div className="card"><h3>Total Records</h3><div className="big-stat">{stats.total}</div></div>
              <div className="card"><h3>Currently Bred</h3><div className="big-stat">{stats.bred}</div></div>
              <div className="card"><h3>Confirmed Pregnant</h3><div className="big-stat">{stats.confirmed}</div></div>
              <div className="card"><h3>Delivered</h3><div className="big-stat">{stats.delivered}</div></div>
              <div className="card"><h3>Live Births</h3><div className="big-stat success">{stats.live_births}</div></div>
              <div className="card"><h3>Stillbirths</h3><div className="big-stat danger">{stats.stillbirths}</div></div>
              <div className="card"><h3>Avg Gestation (days)</h3><div className="big-stat">{stats.avgGestation ? Number(stats.avgGestation).toFixed(0) : '–'}</div></div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default BreedingManager
