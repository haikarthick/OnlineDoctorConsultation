import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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

interface SimpleAnimal { id: string; name: string; species: string; breed?: string; uniqueId?: string; groupId?: string; groupName?: string }

const AnimalGroups: React.FC = () => {
  const navigate = useNavigate()
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

  // ── Manage Animals state ──
  const [manageGroup, setManageGroup] = useState<AnimalGroup | null>(null)
  const [groupAnimals, setGroupAnimals] = useState<SimpleAnimal[]>([])
  const [allMyAnimals, setAllMyAnimals] = useState<SimpleAnimal[]>([])
  const [loadingAnimals, setLoadingAnimals] = useState(false)
  const [animalError, setAnimalError] = useState('')
  const [animalSuccess, setAnimalSuccess] = useState('')
  const [animalSearch, setAnimalSearch] = useState('')

  // ── Reassignment confirmation state ──
  const [confirmReassign, setConfirmReassign] = useState<SimpleAnimal | null>(null)

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

  const fetchGroups = useCallback(async () => {
    if (!selectedEnterpriseId) return
    try {
      setLoading(true)
      const res = await apiService.listAnimalGroups(selectedEnterpriseId)
      setGroups(res.data?.items || [])
    } catch { setGroups([]) }
    finally { setLoading(false) }
  }, [selectedEnterpriseId])

  useEffect(() => { fetchGroups() }, [fetchGroups])

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

  // ══════════════════════════════════════════════════════════
  // MANAGE ANIMALS IN GROUP
  // ══════════════════════════════════════════════════════════
  const openManageAnimals = async (group: AnimalGroup) => {
    setManageGroup(group)
    setAnimalError('')
    setAnimalSuccess('')
    setAnimalSearch('')
    setLoadingAnimals(true)
    try {
      // Load animals in this group (via enterprise animals with group filter)
      // AND all user's animals (to show unassigned ones)
      const [enterpriseRes, myAnimalsRes] = await Promise.all([
        apiService.listEnterpriseAnimals(selectedEnterpriseId, { limit: 200, groupId: group.id }),
        apiService.listAnimals({ limit: 200 })
      ])
      const inGroup = enterpriseRes.data?.items || []
      const mine = (myAnimalsRes.data?.animals || myAnimalsRes.data?.items || []).map((a: any) => ({
        id: a.id, name: a.name, species: a.species, breed: a.breed,
        uniqueId: a.uniqueId || a.unique_id, groupId: a.groupId || a.group_id,
        groupName: a.groupName || a.group_name
      }))
      setGroupAnimals(inGroup)
      setAllMyAnimals(mine)
    } catch { setAnimalError('Failed to load animals') }
    finally { setLoadingAnimals(false) }
  }

  const handleAssignAnimal = async (animalId: string) => {
    if (!manageGroup) return
    // Check if animal is already in another group → show confirmation
    const animal = allMyAnimals.find(a => a.id === animalId)
    if (animal && animal.groupId && animal.groupId !== manageGroup.id) {
      setConfirmReassign(animal)
      return
    }
    await doAssignAnimal(animalId)
  }

  const doAssignAnimal = async (animalId: string) => {
    if (!manageGroup) return
    setAnimalError('')
    setConfirmReassign(null)
    try {
      await apiService.assignAnimalToGroup(manageGroup.id, animalId)
      setAnimalSuccess('Animal assigned to group')
      setTimeout(() => setAnimalSuccess(''), 2500)
      // Refresh both lists
      await openManageAnimals(manageGroup)
      fetchGroups()
    } catch (err: any) {
      setAnimalError(err.response?.data?.error?.message || 'Failed to assign animal')
    }
  }

  const handleRemoveAnimal = async (animalId: string) => {
    if (!manageGroup) return
    setAnimalError('')
    try {
      await apiService.removeAnimalFromGroup(manageGroup.id, animalId)
      setAnimalSuccess('Animal removed from group')
      setTimeout(() => setAnimalSuccess(''), 2500)
      await openManageAnimals(manageGroup)
      fetchGroups()
    } catch (err: any) {
      setAnimalError(err.response?.data?.error?.message || 'Failed to remove animal')
    }
  }

  // Animals available to assign: owned by user, not already in this group
  const availableAnimals = allMyAnimals.filter(a => {
    const notInGroup = !a.groupId || a.groupId !== manageGroup?.id
    const matchSearch = !animalSearch || a.name.toLowerCase().includes(animalSearch.toLowerCase()) ||
      (a.uniqueId || '').toLowerCase().includes(animalSearch.toLowerCase()) ||
      (a.species || '').toLowerCase().includes(animalSearch.toLowerCase())
    return notInGroup && matchSearch
  })

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>🐾 Animal Groups</h1>
          <p className="subtitle">Manage herds, flocks, pens, and animal groups</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '0.5rem' }}>
          {selectedEnterpriseId && (
            <>
              <button className="btn btn-secondary" onClick={() => navigate('/animals')}>🐾 My Animals</button>
              <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>+ New Group</button>
            </>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
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
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-sm btn-primary" onClick={() => openManageAnimals(g)} title="Add or remove animals from this group">
                  🐾 Manage Animals
                </button>
                <button className="btn btn-sm btn-secondary"
                  onClick={() => navigate(`/book-consultation?enterpriseId=${selectedEnterpriseId}&groupId=${g.id}`)}
                  title="Book a consultation for this group">
                  📅 Book Consultation
                </button>
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(g)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(g.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MANAGE ANIMALS MODAL
          ══════════════════════════════════════════════════════════ */}
      {manageGroup && (
        <div className="modal-overlay" onClick={() => setManageGroup(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '720px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0 }}>🐾 Manage Animals — {manageGroup.name}</h2>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                  {GROUP_TYPE_LABELS[manageGroup.groupType as AnimalGroupType] || manageGroup.groupType}
                  {manageGroup.species ? ` • ${manageGroup.species}` : ''}
                </p>
              </div>
              <button onClick={() => setManageGroup(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>

            {animalSuccess && <div className="alert alert-success" style={{ padding: '8px 12px', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{animalSuccess}</div>}
            {animalError && <div className="alert alert-error" style={{ padding: '8px 12px', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{animalError}</div>}

            {loadingAnimals ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>Loading animals...</div>
            ) : (
              <div style={{ flex: 1, overflow: 'auto' }}>
                {/* ── Animals Currently in Group ── */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.5rem' }}>
                    ✅ Animals in this group ({groupAnimals.length})
                  </h3>
                  {groupAnimals.length === 0 ? (
                    <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', color: '#6b7280', fontSize: '0.85rem', textAlign: 'center' }}>
                      No animals in this group yet. Assign animals from your registered list below, or{' '}
                      <button onClick={() => { setManageGroup(null); navigate('/animals') }}
                        style={{ background: 'none', border: 'none', color: '#4F46E5', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem', padding: 0 }}>
                        register a new animal
                      </button> first.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {groupAnimals.map((a: any) => (
                        <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{a.name}</span>
                            <span style={{ color: '#6b7280', fontSize: '0.8rem', marginLeft: '0.5rem' }}>{a.species}{a.breed ? ` • ${a.breed}` : ''}</span>
                            {a.uniqueId && <span style={{ color: '#9ca3af', fontSize: '0.75rem', marginLeft: '0.5rem', fontFamily: 'monospace' }}>{a.uniqueId}</span>}
                          </div>
                          <button className="btn btn-sm btn-danger" onClick={() => handleRemoveAnimal(a.id)}
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}>Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Available Animals to Assign ── */}
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.5rem' }}>
                    📋 Available Animals to Assign ({availableAnimals.length})
                  </h3>
                  <input
                    type="text" placeholder="Search animals by name, ID, or species..."
                    value={animalSearch} onChange={e => setAnimalSearch(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '0.5rem' }}
                  />
                  {availableAnimals.length === 0 ? (
                    <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', color: '#6b7280', fontSize: '0.85rem', textAlign: 'center' }}>
                      {allMyAnimals.length === 0
                        ? <>No animals registered yet.{' '}
                            <button onClick={() => { setManageGroup(null); navigate('/animals') }}
                              style={{ background: 'none', border: 'none', color: '#4F46E5', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem', padding: 0 }}>
                              Register your first animal
                            </button> to get started.</>
                        : animalSearch
                          ? 'No matching animals found.'
                          : 'All your animals are already assigned to this group.'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '250px', overflowY: 'auto' }}>
                      {availableAnimals.map(a => (
                        <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#fafafa', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{a.name}</span>
                            <span style={{ color: '#6b7280', fontSize: '0.8rem', marginLeft: '0.5rem' }}>{a.species}{a.breed ? ` • ${a.breed}` : ''}</span>
                            {a.uniqueId && <span style={{ color: '#9ca3af', fontSize: '0.75rem', marginLeft: '0.5rem', fontFamily: 'monospace' }}>{a.uniqueId}</span>}
                            {a.groupId && a.groupName && (
                              <span style={{ color: '#f59e0b', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                                (in: {a.groupName})
                              </span>
                            )}
                          </div>
                          <button className="btn btn-sm btn-primary" onClick={() => handleAssignAnimal(a.id)}
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                            + Assign
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem', marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setManageGroup(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Reassignment Confirmation Dialog ══ */}
      {confirmReassign && manageGroup && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => setConfirmReassign(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px', padding: '1.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '2.5rem' }}>⚠️</span>
            </div>
            <h3 style={{ margin: '0 0 0.5rem', textAlign: 'center', color: '#1f2937' }}>Move Animal to Another Group?</h3>
            <p style={{ color: '#4b5563', fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.6, margin: '0 0 1rem' }}>
              <strong style={{ color: '#1f2937' }}>{confirmReassign.name}</strong> ({confirmReassign.species}{confirmReassign.breed ? ` • ${confirmReassign.breed}` : ''})
              is currently in <strong style={{ color: '#dc2626' }}>{confirmReassign.groupName || 'another group'}</strong>.
            </p>
            <p style={{ color: '#4b5563', fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.6, margin: '0 0 1.25rem' }}>
              Moving it to <strong style={{ color: '#059669' }}>{manageGroup.name}</strong> will automatically remove it from the previous group.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmReassign(null)}
                style={{ padding: '8px 20px', fontSize: '0.9rem' }}>Cancel</button>
              <button className="btn btn-primary" onClick={() => doAssignAnimal(confirmReassign.id)}
                style={{ padding: '8px 20px', fontSize: '0.9rem', background: '#dc2626', borderColor: '#dc2626' }}>
                Yes, Move Animal
              </button>
            </div>
          </div>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 6, border: '2px solid #d1d5db', background: formData.colorCode, flexShrink: 0 }} />
                    <input type="color" value={formData.colorCode} onChange={e => setFormData(f => ({ ...f, colorCode: e.target.value }))} style={{ width: 40, height: 36, padding: 0, border: 'none', cursor: 'pointer' }} title="Pick a color" />
                    <input type="text" value={formData.colorCode} onChange={e => { const v = e.target.value; if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setFormData(f => ({ ...f, colorCode: v })) }} style={{ width: 90, fontFamily: 'monospace', fontSize: '0.85rem' }} placeholder="#4F46E5" />
                  </div>
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
