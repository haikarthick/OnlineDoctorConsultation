import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, AnimalGroup, GROUP_TYPE_LABELS, AnimalGroupType } from '../types'

const PURPOSE_OPTIONS = [
  { value: 'dairy', label: 'Dairy' }, { value: 'meat', label: 'Meat' },
  { value: 'breeding', label: 'Breeding' }, { value: 'layer', label: 'Layer' },
  { value: 'broiler', label: 'Broiler' }, { value: 'companion', label: 'Companion' },
  { value: 'exhibition', label: 'Exhibition' }, { value: 'conservation', label: 'Conservation' },
  { value: 'racing', label: 'Racing' }, { value: 'working', label: 'Working' },
  { value: 'research', label: 'Research' }, { value: 'rehabilitation', label: 'Rehabilitation' },
  { value: 'sale', label: 'Sale' }, { value: 'other', label: 'Other' },
]

const AnimalGroups: React.FC = () => {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [groups, setGroups] = useState<AnimalGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<AnimalGroup | null>(null)
  const [formData, setFormData] = useState({
    name: '', groupType: '' as AnimalGroupType, species: '', breed: '',
    purpose: '', targetCount: '', description: '', colorCode: '#4F46E5'
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

  const fetchGroups = async () => {
    if (!selectedEnterpriseId) return
    try {
      setLoading(true)
      const res = await apiService.listAnimalGroups(selectedEnterpriseId)
      setGroups(res.data?.items || [])
    } catch { setGroups([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchGroups() }, [selectedEnterpriseId])

  const resetForm = () => {
    setFormData({ name: '', groupType: '' as AnimalGroupType, species: '', breed: '', purpose: '', targetCount: '', description: '', colorCode: '#4F46E5' })
    setEditingGroup(null); setError('')
  }

  const openEdit = (g: AnimalGroup) => {
    setEditingGroup(g)
    setFormData({
      name: g.name, groupType: g.groupType as AnimalGroupType, species: g.species || '', breed: g.breed || '',
      purpose: g.purpose || '', targetCount: g.targetCount?.toString() || '', description: g.description || '',
      colorCode: g.colorCode || '#4F46E5'
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!formData.name || !formData.groupType) { setError('Name and group type are required'); return }
    try {
      const payload: any = { ...formData, enterpriseId: selectedEnterpriseId, targetCount: formData.targetCount ? parseInt(formData.targetCount) : 0 }
      if (editingGroup) {
        await apiService.updateAnimalGroup(editingGroup.id, payload)
        setSuccessMsg('Group updated')
      } else {
        await apiService.createAnimalGroup(payload)
        setSuccessMsg('Group created')
      }
      resetForm(); setShowForm(false); fetchGroups()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed to save group') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this group? Animals will be unlinked.')) return
    try {
      await apiService.deleteAnimalGroup(id)
      setSuccessMsg('Group deleted')
      fetchGroups()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed to delete') }
  }

  const groupIcon = (t: AnimalGroupType) => {
    const icons: Record<string, string> = {
      herd: '🐄', flock: '🐔', pen: '🐷', paddock: '🐴', enclosure: '🦁',
      tank: '🐟', aviary: '🦜', kennel_group: '🐕', breeding_group: '🧬',
      quarantine: '⚠️', nursery: '🍼', production: '🏭', other: '📦'
    }
    return icons[t] || '📦'
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>🐾 Animal Groups</h1>
          <p className="subtitle">Manage herds, flocks, pens, and animal groups</p>
        </div>
        <div className="header-actions">
          {selectedEnterpriseId && (
            <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>+ New Group</button>
          )}
        </div>
      </div>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Enterprise Selector */}
      <div className="filters-bar">
        <select value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)} className="search-input" style={{ maxWidth: '350px' }}>
          <option value="">Select Enterprise...</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {!selectedEnterpriseId ? (
        <div className="empty-state">
          <div className="empty-icon">🐾</div>
          <h3>Select an Enterprise</h3>
          <p>Choose an enterprise above to manage its animal groups.</p>
        </div>
      ) : loading ? (
        <div className="loading-spinner">Loading groups...</div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🐾</div>
          <h3>No Groups Yet</h3>
          <p>Create your first animal group for this enterprise.</p>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>+ Create Group</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {groups.map(g => (
            <div key={g.id} className="card" style={{ borderRadius: '12px', padding: '1.25rem', borderLeft: `4px solid ${g.colorCode || 'var(--primary)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.75rem' }}>{groupIcon(g.groupType as AnimalGroupType)}</span>
                <div>
                  <h3 style={{ margin: 0 }}>{g.name}</h3>
                  <span className="badge" style={{ fontSize: '0.75rem' }}>{GROUP_TYPE_LABELS[g.groupType as AnimalGroupType] || g.groupType}</span>
                </div>
              </div>
              {g.species && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0' }}>Species: {g.species} {g.breed ? `(${g.breed})` : ''}</p>}
              {g.purpose && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0' }}>Purpose: {g.purpose}</p>}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
                <span>🐾 {g.currentCount} animals</span>
                {g.targetCount > 0 && <span style={{ color: 'var(--text-secondary)' }}>/ {g.targetCount} target</span>}
              </div>
              {g.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{g.description}</p>}
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(g)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(g.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); resetForm() }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <h2>{editingGroup ? 'Edit Group' : 'Create Animal Group'}</h2>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label>Group Name *</label>
                <input type="text" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Group Type *</label>
                  <select value={formData.groupType} onChange={e => setFormData(f => ({ ...f, groupType: e.target.value as AnimalGroupType }))} required>
                    <option value="">Select...</option>
                    {Object.entries(GROUP_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Purpose</label>
                  <select value={formData.purpose} onChange={e => setFormData(f => ({ ...f, purpose: e.target.value }))}>
                    <option value="">Select...</option>
                    {PURPOSE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Species</label>
                  <input type="text" value={formData.species} onChange={e => setFormData(f => ({ ...f, species: e.target.value }))} placeholder="e.g. Cattle" />
                </div>
                <div className="form-group">
                  <label>Breed</label>
                  <input type="text" value={formData.breed} onChange={e => setFormData(f => ({ ...f, breed: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Target Count</label>
                  <input type="number" value={formData.targetCount} onChange={e => setFormData(f => ({ ...f, targetCount: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Color Code</label>
                  <input type="color" value={formData.colorCode} onChange={e => setFormData(f => ({ ...f, colorCode: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows={2} value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); resetForm() }}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingGroup ? 'Update' : 'Create'} Group</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnimalGroups
