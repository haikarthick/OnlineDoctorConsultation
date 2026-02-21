import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, MovementRecord } from '../types'

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  transfer: 'Transfer', intake: 'Intake', discharge: 'Discharge',
  quarantine: 'Quarantine', sale: 'Sale', death: 'Death',
  birth: 'Birth', import: 'Import', export: 'Export'
}

const MOVEMENT_TYPE_ICONS: Record<string, string> = {
  transfer: '🔄', intake: '📥', discharge: '📤', quarantine: '⚠️',
  sale: '💰', death: '✝️', birth: '🐣', import: '🚛', export: '📦'
}

const MovementLog: React.FC = () => {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [movements, setMovements] = useState<MovementRecord[]>([])
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    movementType: 'transfer', animalId: '', groupId: '',
    fromLocationId: '', toLocationId: '', reason: '', notes: ''
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

  const fetchMovements = async () => {
    if (!selectedEnterpriseId) return
    try {
      setLoading(true)
      const [movRes, locRes, grpRes] = await Promise.all([
        apiService.listMovements(selectedEnterpriseId),
        apiService.listLocations(selectedEnterpriseId),
        apiService.listAnimalGroups(selectedEnterpriseId)
      ])
      setMovements(movRes.data?.items || [])
      setLocations((locRes.data?.items || []).map((l: any) => ({ id: l.id, name: l.name })))
      setGroups((grpRes.data?.items || []).map((g: any) => ({ id: g.id, name: g.name })))
    } catch { setMovements([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (selectedEnterpriseId) fetchMovements() }, [selectedEnterpriseId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!formData.movementType) { setError('Movement type required'); return }
    if (!formData.animalId && !formData.groupId) { setError('Select animal or group'); return }
    try {
      await apiService.createMovement({
        enterpriseId: selectedEnterpriseId,
        ...formData,
        animalId: formData.animalId || undefined,
        groupId: formData.groupId || undefined,
        fromLocationId: formData.fromLocationId || undefined,
        toLocationId: formData.toLocationId || undefined
      } as any)
      setSuccessMsg('Movement recorded')
      setShowForm(false)
      setFormData({ movementType: 'transfer', animalId: '', groupId: '', fromLocationId: '', toLocationId: '', reason: '', notes: '' })
      fetchMovements()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed') }
  }

  const formatDate = (d: string) => d ? new Date(d).toLocaleString() : '–'

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>🔄 Movement Log</h1>
          <p className="subtitle">Track animal transfers, births, sales, and more</p>
        </div>
        <div className="header-actions">
          {selectedEnterpriseId && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Record Movement</button>
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
          <div className="empty-icon">🔄</div>
          <h3>Select an Enterprise</h3>
          <p>Choose an enterprise to view movement history.</p>
        </div>
      ) : loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : movements.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔄</div>
          <h3>No Movements Recorded</h3>
          <p>Movement records track animal transfers, births, sales, and other events.</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Record Movement</button>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Type</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Animal/Group</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>From</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>To</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Reason</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {movements.map(mov => (
                <tr key={mov.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span>{MOVEMENT_TYPE_ICONS[mov.movementType] || '🔄'}</span>{' '}
                    <span className="badge">{MOVEMENT_TYPE_LABELS[mov.movementType] || mov.movementType}</span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {mov.animalName || mov.groupName || '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>{mov.fromLocationName || '—'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{mov.toLocationName || '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{mov.reason || '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{formatDate(mov.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2>Record Movement</h2>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label>Movement Type *</label>
                <select value={formData.movementType} onChange={e => setFormData(f => ({ ...f, movementType: e.target.value }))} required>
                  {Object.entries(MOVEMENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Animal ID</label>
                  <input type="text" placeholder="Enter animal ID" value={formData.animalId} onChange={e => setFormData(f => ({ ...f, animalId: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Or Group</label>
                  <select value={formData.groupId} onChange={e => setFormData(f => ({ ...f, groupId: e.target.value }))}>
                    <option value="">None</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>From Location</label>
                  <select value={formData.fromLocationId} onChange={e => setFormData(f => ({ ...f, fromLocationId: e.target.value }))}>
                    <option value="">—</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>To Location</label>
                  <select value={formData.toLocationId} onChange={e => setFormData(f => ({ ...f, toLocationId: e.target.value }))}>
                    <option value="">—</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Reason</label>
                <input type="text" value={formData.reason} onChange={e => setFormData(f => ({ ...f, reason: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea rows={2} value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Record Movement</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default MovementLog
