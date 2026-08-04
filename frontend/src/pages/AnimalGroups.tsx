import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, AnimalGroup, GROUP_TYPE_LABELS, AnimalGroupType } from '../types'
import { useTranslation } from 'react-i18next'
import { useMasterData } from '../context/MasterDataContext'
import { useScrollToForm } from '../hooks/useScrollToForm'

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
  const { t } = useTranslation()
  const { speciesLabel } = useMasterData()

  const navigate = useNavigate()
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [groups, setGroups] = useState<AnimalGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const formRef = useScrollToForm(showForm)
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
    if (!formData.name || !formData.groupType) { setError(t('animalGroups.toasts.nameRequired')); return }
    try {
      const payload: any = { ...formData, enterpriseId: selectedEnterpriseId, targetCount: formData.targetCount ? parseInt(formData.targetCount) : 0 }
      if (editingGroup) {
        await apiService.updateAnimalGroup(editingGroup.id, payload)
        setSuccessMsg(t('animalGroups.toasts.updated'))
      } else {
        await apiService.createAnimalGroup(payload)
        setSuccessMsg(t('animalGroups.toasts.created'))
      }
      resetForm(); setShowForm(false); fetchGroups()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) { setError(err.response?.data?.error?.message || t('common.failedToSave')) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('animalGroups.toasts.deleteConfirm'))) return
    try {
      await apiService.deleteAnimalGroup(id)
      setSuccessMsg(t('animalGroups.toasts.deleted'))
      fetchGroups()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) { setError(err.response?.data?.error?.message || t('common.failedToDelete')) }
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
    } catch { setAnimalError(t('animalGroups.manage.loadFailed')) }
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
      setAnimalSuccess(t('animalGroups.manage.assignSuccess'))
      setTimeout(() => setAnimalSuccess(''), 2500)
      // Refresh both lists
      await openManageAnimals(manageGroup)
      fetchGroups()
    } catch (err: any) {
      setAnimalError(err.response?.data?.error?.message || t('animalGroups.manage.assignFailed'))
    }
  }

  const handleRemoveAnimal = async (animalId: string) => {
    if (!manageGroup) return
    setAnimalError('')
    try {
      await apiService.removeAnimalFromGroup(manageGroup.id, animalId)
      setAnimalSuccess(t('animalGroups.manage.removeSuccess'))
      setTimeout(() => setAnimalSuccess(''), 2500)
      await openManageAnimals(manageGroup)
      fetchGroups()
    } catch (err: any) {
      setAnimalError(err.response?.data?.error?.message || t('animalGroups.manage.removeFailed'))
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
          <h1>{t('animalGroups.pageTitle')}</h1>
          <p className="subtitle">{t('animalGroups.subtitle')}</p>
        </div>
        <div className="header-actions si-6fdaaf49">
          {selectedEnterpriseId && (
            <>
              <button className="btn btn-secondary" onClick={() => navigate('/animals')}>{t('common.myAnimals')}</button>
              <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>{t('animalGroups.newGroup')}</button>
            </>
          )}
        </div>
      </div>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Enterprise Selector */}
      <div className="filters-bar">
        <select value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)} className="search-input si-58fb376a">
          <option value="">{t('animalGroups.selectEnterprise')}</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {!selectedEnterpriseId ? (
        <div className="empty-state">
          <div className="empty-icon">🐾</div>
          <h3>{t('animalGroups.emptyEnterprise')}</h3>
          <p>{t('animalGroups.emptyEnterpriseSubtitle')}</p>
        </div>
      ) : loading ? (
        <div className="loading-spinner">{t('animalGroups.loading')}</div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🐾</div>
          <h3>{t('animalGroups.emptyTitle')}</h3>
          <p>{t('animalGroups.emptySubtitle')}</p>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>{t('animalGroups.createBtn')}</button>
        </div>
      ) : (
        <div className="si-22cdfbdb">
          {groups.map(g => (
            <div key={g.id} className="card" style={{ borderRadius: '12px', padding: '1.25rem', borderLeft: `4px solid ${g.colorCode || 'var(--primary)'}` }}>
              <div className="si-99f8abcc">
                <span className="si-91db75dc">{groupIcon(g.groupType as AnimalGroupType)}</span>
                <div>
                  <h3 className="si-44087c4b">{g.name}</h3>
                  <span className="badge si-8c23064b">{GROUP_TYPE_LABELS[g.groupType as AnimalGroupType] || g.groupType}</span>
                </div>
              </div>
              {g.species && <p className="si-cf622af4">{t('animalGroups.species')} {speciesLabel(g.species, t)} {g.breed ? `(${g.breed})` : ''}</p>}
              {g.purpose && <p className="si-cf622af4">{t('animalGroups.purpose')} {g.purpose}</p>}
              <div className="si-bbfa5d5e">
                <span>🐾 {g.currentCount} {t('animalGroups.animals')}</span>
                {g.targetCount > 0 && <span className="si-c46367a3">/ {g.targetCount} {t('animalGroups.target')}</span>}
              </div>
              {g.description && <p className="si-9cbc3f5c">{g.description}</p>}
              <div className="si-0eca3602">
                <button className="btn btn-sm btn-primary" onClick={() => openManageAnimals(g)} title={t('animalGroups.manageAnimals')}>
                  {t('animalGroups.manageAnimals')}
                </button>
                <button className="btn btn-sm btn-secondary"
                  onClick={() => navigate(`/book-consultation?enterpriseId=${selectedEnterpriseId}&groupId=${g.id}`)}
                  title={t('animalGroups.bookConsultation')}>
                  {t('animalGroups.bookConsultation')}
                </button>
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(g)}>{t('common.edit')}</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(g.id)}>{t('common.delete')}</button>
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
          <div className="modal-content si-1e3f280a" onClick={e => e.stopPropagation()}>
            <div className="si-ae9b91a7">
              <div>
                <h2 className="si-44087c4b">{t('animalGroups.manage.title', { name: manageGroup.name })}</h2>
                <p className="si-34b83357">
                  {GROUP_TYPE_LABELS[manageGroup.groupType as AnimalGroupType] || manageGroup.groupType}
                  {manageGroup.species ? ` • ${speciesLabel(manageGroup.species, t)}` : ''}
                </p>
              </div>
              <button onClick={() => setManageGroup(null)} className="si-2d49037b">✕</button>
            </div>

            {animalSuccess && <div className="alert alert-success si-2bef5018">{animalSuccess}</div>}
            {animalError && <div className="alert alert-error si-2bef5018">{animalError}</div>}

            {loadingAnimals ? (
              <div className="si-41acd90c">{t('common.loading')}</div>
            ) : (
              <div className="si-0adf99df">
                {/* ── Animals Currently in Group ── */}
                <div className="si-1e52b2bd">
                  <h3 className="si-66e7e82d">
                    {t('animalGroups.manage.inGroup', { count: groupAnimals.length })}
                  </h3>
                  {groupAnimals.length === 0 ? (
                    <div className="si-7e76947c">
                      {t('animalGroups.manage.emptyGroup')}{' '}
                      <button onClick={() => { setManageGroup(null); navigate('/animals') }}
                        className="si-42cfb803">
                        {t('animalGroups.manage.registerAnimal')}
                      </button> {t('animalGroups.manage.first')}
                    </div>
                  ) : (
                    <div className="si-41debbe8">
                      {groupAnimals.map((a: any) => (
                        <div key={a.id} className="si-b948943c">
                          <div>
                            <span className="si-f30b396a">{a.name}</span>
                            <span className="si-5e80ef64">{speciesLabel(a.species, t)}{a.breed ? ` • ${a.breed}` : ''}</span>
                            {a.uniqueId && <span className="si-6a41a2a7">{a.uniqueId}</span>}
                          </div>
                          <button className="btn btn-sm btn-danger si-70a187fb" onClick={() => handleRemoveAnimal(a.id)}
                           >{t('common.remove')}</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Available Animals to Assign ── */}
                <div>
                  <h3 className="si-66e7e82d">
                    {t('animalGroups.manage.available', { count: availableAnimals.length })}
                  </h3>
                  <input
                    type="text" placeholder={t('animalGroups.manage.searchPlaceholder')}
                    value={animalSearch} onChange={e => setAnimalSearch(e.target.value)}
                    className="si-103cebdb"
                  />
                  {availableAnimals.length === 0 ? (
                    <div className="si-7e76947c">
                      {allMyAnimals.length === 0
                        ? <>{t('animalGroups.manage.noAnimals')}{' '}
                            <button onClick={() => { setManageGroup(null); navigate('/animals') }}
                              className="si-42cfb803">
                              {t('animalGroups.manage.registerFirst')}
                            </button> {t('animalGroups.manage.toGetStarted')}</>
                        : animalSearch
                          ? t('animalGroups.manage.noMatch')
                          : t('animalGroups.manage.allAssigned')}
                    </div>
                  ) : (
                    <div className="si-66dba6d1">
                      {availableAnimals.map(a => (
                        <div key={a.id} className="si-aff1dbb0">
                          <div>
                            <span className="si-f30b396a">{a.name}</span>
                            <span className="si-5e80ef64">{speciesLabel(a.species, t)}{a.breed ? ` • ${a.breed}` : ''}</span>
                            {a.uniqueId && <span className="si-6a41a2a7">{a.uniqueId}</span>}
                            {a.groupId && a.groupName && (
                              <span className="si-cfa7a876">
                                (in: {a.groupName})
                              </span>
                            )}
                          </div>
                          <button className="btn btn-sm btn-primary si-70a187fb" onClick={() => handleAssignAnimal(a.id)}
                           >
                            {t('animalGroups.manage.assign')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="si-64c669e9">
              <button className="btn btn-secondary" onClick={() => setManageGroup(null)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Reassignment Confirmation Dialog ══ */}
      {confirmReassign && manageGroup && (
        <div className="modal-overlay si-0f362879" onClick={() => setConfirmReassign(null)}>
          <div className="modal-content si-9f12971b" onClick={e => e.stopPropagation()}>
            <div className="si-0de4ec62">
              <span className="si-818ab2c7">⚠️</span>
            </div>
            <h3 className="si-ff99b75c">{t('animalGroups.reassign.title')}</h3>
            <p className="si-cc0437c0">
              <strong className="si-672b6b98">{confirmReassign.name}</strong> ({speciesLabel(confirmReassign.species, t)}{confirmReassign.breed ? ` • ${confirmReassign.breed}` : ''})
              is currently in <strong className="si-f84f41a5">{confirmReassign.groupName || t('animalGroups.reassign.currentGroup')}</strong>.
            </p>
            <p className="si-908e4d8e">
              {t('animalGroups.reassign.moveMessage', { targetGroup: manageGroup.name })}
            </p>
            <div className="si-3083878c">
              <button className="btn btn-secondary si-303f991c" onClick={() => setConfirmReassign(null)}
               >{t('common.cancel')}</button>
              <button className="btn btn-primary si-f5da1353" onClick={() => doAssignAnimal(confirmReassign.id)}
               >
                {t('animalGroups.reassign.confirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && <div className="edit-form-overlay" onClick={() => { setShowForm(false); resetForm() }} />}
      {showForm && (
        <div ref={formRef} className="edit-form-panel">
            <h2>{editingGroup ? t('animalGroups.modal.editTitle') : t('animalGroups.modal.createTitle')}</h2>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label>{t('animalGroups.modal.name')}</label>
                <input type="text" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="si-ec24da01">
                <div className="form-group">
                  <label>{t('animalGroups.modal.type')}</label>
                  <select value={formData.groupType} onChange={e => setFormData(f => ({ ...f, groupType: e.target.value as AnimalGroupType }))} required>
                    <option value="">{t('animalGroups.modal.selectType')}</option>
                    {Object.entries(GROUP_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('animalGroups.modal.purpose')}</label>
                  <select value={formData.purpose} onChange={e => setFormData(f => ({ ...f, purpose: e.target.value }))}>
                    <option value="">{t('animalGroups.modal.selectPurpose')}</option>
                    {PURPOSE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('animalGroups.modal.species')}</label>
                  <input type="text" value={formData.species} onChange={e => setFormData(f => ({ ...f, species: e.target.value }))} placeholder="e.g. Cattle" />
                </div>
                <div className="form-group">
                  <label>{t('animalGroups.modal.breed')}</label>
                  <input type="text" value={formData.breed} onChange={e => setFormData(f => ({ ...f, breed: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>{t('animalGroups.modal.targetCount')}</label>
                  <input type="number" value={formData.targetCount} onChange={e => setFormData(f => ({ ...f, targetCount: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>{t('animalGroups.modal.colorCode')}</label>
                  <div className="si-0dd04361">
                    <div style={{ width: 36, height: 36, borderRadius: 6, border: '2px solid #d1d5db', background: formData.colorCode, flexShrink: 0 }} />
                    <input type="color" value={formData.colorCode} onChange={e => setFormData(f => ({ ...f, colorCode: e.target.value }))} className="si-63147c7d" title="Pick a color" />
                    <input type="text" value={formData.colorCode} onChange={e => { const v = e.target.value; if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setFormData(f => ({ ...f, colorCode: v })) }} className="si-4ab6b540" placeholder="#4F46E5" />
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>{t('animalGroups.modal.description')}</label>
                <textarea rows={2} value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="si-5af10afb">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); resetForm() }}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{editingGroup ? t('animalGroups.modal.updateBtn') : t('animalGroups.modal.createBtn')}</button>
              </div>
            </form>
        </div>
      )}
    </div>
  )
}

export default AnimalGroups
