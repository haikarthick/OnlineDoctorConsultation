import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, AnimalGroup } from '../types'
import { useTranslation } from 'react-i18next'
import { useMasterData } from '../context/MasterDataContext'
import { useFarmProfile, useSpeciesCategories } from '../hooks/useFarmProfile'
import { useSaveAction } from '../hooks/useSaveAction'
import { useCssVar } from '../hooks/useCssVar'
import GroupFormModal from '../components/animalGroups/GroupFormModal'
import { ShareGroupSheet } from '../components/animalGroups/ShareGroupSheet'
import { useMyFarmRole } from '../hooks/useMyFarmRole'
import { emptyGroupForm, groupToFormData, buildGroupPayload, type GroupFormData } from '../components/animalGroups/groupShared'

import { userMessage } from '../utils/userMessage'
interface SimpleAnimal { id: string; name: string; species: string; breed?: string; uniqueId?: string; groupId?: string; groupName?: string }

/** One group's colour as a CSS variable on its card (the colour is the farmer's pick, so it is dynamic). */
const GroupCardShell: React.FC<{ color?: string | null; children: React.ReactNode }> = ({ color, children }) => {
  const ref = useCssVar('--group-color', color || null)
  return <div ref={ref} className="card group-card">{children}</div>
}

const AnimalGroups: React.FC = () => {
  const { t } = useTranslation()
  const { speciesLabel, speciesIcon, groupTypeLabel, groupTypeIcon } = useMasterData()
  const speciesCategories = useSpeciesCategories()

  const navigate = useNavigate()
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  // Only the farm's owner decides to share a group's records with a hospital network.
  const [shareGroup, setShareGroup] = useState<{ id: string; name: string } | null>(null)
  const myFarmRole = useMyFarmRole(enterprises.find(e => e.id === selectedEnterpriseId))
  const [groups, setGroups] = useState<AnimalGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<AnimalGroup | null>(null)
  const [formData, setFormData] = useState<GroupFormData>(emptyGroupForm)
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

  // ── Group health (flock health as RATES) modal state ──
  const [healthGroup, setHealthGroup] = useState<AnimalGroup | null>(null)
  const [healthMetrics, setHealthMetrics] = useState<any>(null)
  const [withdrawal, setWithdrawal] = useState<any>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthError, setHealthError] = useState('')

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

  // What the form shows follows the species and group type chosen; the same profile builds the payload.
  const { profile: formProfile } = useFarmProfile({
    speciesCode: formData.species, groupType: formData.groupType, managementMode: formData.managementMode || undefined,
  })
  const saveGroup = useSaveAction(
    async (payload: Record<string, unknown>, editingId: string | null) => {
      if (editingId) await apiService.updateAnimalGroup(editingId, payload)
      else await apiService.createAnimalGroup(payload as any)
    },
    t('common.failedToSave'),
  )

  const resetForm = () => {
    setFormData(emptyGroupForm)
    setEditingGroup(null); setError('')
    saveGroup.reset()
  }

  const openEdit = (g: AnimalGroup) => {
    saveGroup.reset()
    setEditingGroup(g)
    setFormData(groupToFormData(g))
    setShowForm(true)
  }

  const handleSubmit = async () => {
    setError('')
    if (!formData.name.trim() || !formData.groupType) { setError(t('animalGroups.toasts.nameRequired')); return }
    const payload = buildGroupPayload(formData, formProfile, { editing: !!editingGroup, enterpriseId: selectedEnterpriseId })
    const wasEditing = !!editingGroup
    // On failure the form stays open and filled; the footer shows the server's own message with Retry.
    const saved = await saveGroup.run(payload, editingGroup?.id ?? null)
    if (!saved) return
    setSuccessMsg(wasEditing ? t('animalGroups.toasts.updated') : t('animalGroups.toasts.created'))
    resetForm(); setShowForm(false); fetchGroups()
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('animalGroups.toasts.deleteConfirm'))) return
    try {
      await apiService.deleteAnimalGroup(id)
      setSuccessMsg(t('animalGroups.toasts.deleted'))
      fetchGroups()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) { setError(userMessage(err, 'common.failedToDelete')) }
  }

  const groupIcon = (g: AnimalGroup) => groupTypeIcon(g.species, g.groupType) || (g.species ? speciesIcon(g.species) : null) || '📦'

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
      setAnimalError(userMessage(err, 'animalGroups.manage.assignFailed'))
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
      setAnimalError(userMessage(err, 'animalGroups.manage.removeFailed'))
    }
  }

  // ══════════════════════════════════════════════════════════
  // GROUP HEALTH AS RATES (batch/flock)
  // ══════════════════════════════════════════════════════════
  const openGroupHealth = async (group: AnimalGroup) => {
    setHealthGroup(group)
    setHealthError('')
    setHealthMetrics(null)
    setWithdrawal(null)
    setHealthLoading(true)
    try {
      const [metricsRes, withdrawalRes] = await Promise.allSettled([
        apiService.getGroupHealthMetrics(group.id),
        apiService.getGroupWithdrawal(group.id),
      ])
      if (metricsRes.status === 'fulfilled') setHealthMetrics(metricsRes.value.data)
      else setHealthError(t('animalGroups.health.loadFailed'))
      if (withdrawalRes.status === 'fulfilled') setWithdrawal(withdrawalRes.value.data)
    } catch { setHealthError(t('animalGroups.health.loadFailed')) }
    finally { setHealthLoading(false) }
  }

  const fmtPct = (v: number | null | undefined) => (v == null ? '–' : `${v}%`)

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
        <div className="group-card-grid">
          {groups.map(g => (
            <GroupCardShell key={g.id} color={g.colorCode}>
              <div className="si-99f8abcc">
                <span className="si-91db75dc">{groupIcon(g)}</span>
                <div>
                  <h3 className="si-44087c4b">{g.name}</h3>
                  <span className="badge si-8c23064b">{groupTypeLabel(g.species, g.groupType, t)}</span>
                </div>
              </div>
              {g.species && <p className="si-cf622af4">{t('animalGroups.species')} {speciesLabel(g.species, t)} {g.breed ? `(${g.breed})` : ''}</p>}
              {g.purpose && <p className="si-cf622af4">{t('animalGroups.purpose')} {g.purpose}</p>}
              <div className="si-bbfa5d5e">
                {/* "12 of 20 planned": the planned count is a hope, the first number is the real count. */}
                {g.targetCount > 0
                  ? <span>🐾 {t('farmProfile.groupForm.plannedOf', { count: g.currentCount, planned: g.targetCount })}</span>
                  : <span>🐾 {g.currentCount} {t('animalGroups.animals')}</span>}
              </div>
              {g.description && <p className="si-9cbc3f5c">{g.description}</p>}
              <div className="si-0eca3602">
                {g.managementMode === 'batch' && (
                  <button className="btn btn-sm btn-secondary" onClick={() => openGroupHealth(g)} title={t('animalGroups.health.view')}>
                    {t('animalGroups.health.view')}
                  </button>
                )}
                <button className="btn btn-sm btn-primary" onClick={() => openManageAnimals(g)} title={t('animalGroups.manageAnimals')}>
                  {t('animalGroups.manageAnimals')}
                </button>
                <button className="btn btn-sm btn-secondary"
                  onClick={() => navigate(`/book-consultation?enterpriseId=${selectedEnterpriseId}&groupId=${g.id}`)}
                  title={t('animalGroups.bookConsultation')}>
                  {t('animalGroups.bookConsultation')}
                </button>
                {myFarmRole === 'owner' && (
                  <button className="btn btn-sm btn-secondary" onClick={() => setShareGroup({ id: g.id, name: g.name })}>{t('groupSharing.shareButton')}</button>
                )}
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(g)}>{t('common.edit')}</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(g.id)}>{t('common.delete')}</button>
              </div>
            </GroupCardShell>
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
                  {groupTypeLabel(manageGroup.species, manageGroup.groupType, t)}
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

      {/* ══ Group Health (flock health as rates) Modal ══ */}
      {healthGroup && (
        <div className="modal-overlay" onClick={() => setHealthGroup(null)}>
          <div className="modal-content si-1e3f280a" onClick={e => e.stopPropagation()}>
            <div className="si-ae9b91a7">
              <div>
                <h2 className="si-44087c4b">{t('animalGroups.health.title', { name: healthGroup.name })}</h2>
                <p className="si-34b83357">
                  {groupTypeLabel(healthGroup.species, healthGroup.groupType, t)}
                  {healthGroup.species ? ` • ${speciesLabel(healthGroup.species, t)}` : ''}
                  {healthGroup.managementMode === 'batch' ? ` • ${t('animalGroups.health.batch')}` : ''}
                </p>
              </div>
              <button onClick={() => setHealthGroup(null)} className="si-2d49037b">✕</button>
            </div>

            {withdrawal && (withdrawal.milkActive || withdrawal.meatActive) && (
              <div className="alert alert-error si-2bef5018">
                ⚠️ {t('animalGroups.health.withdrawalBanner', {
                  kind: withdrawal.meatActive ? t('animalGroups.health.meat') : t('animalGroups.health.milk'),
                  date: withdrawal.meatActive ? withdrawal.meatUntil : withdrawal.milkUntil,
                })}
              </div>
            )}

            {healthError && <div className="alert alert-error si-2bef5018">{healthError}</div>}

            {healthLoading ? (
              <div className="si-41acd90c">{t('common.loading')}</div>
            ) : !healthMetrics ? (
              <div className="si-41acd90c">{t('animalGroups.health.noData')}</div>
            ) : (
              <div className="si-0adf99df">
                <div className="si-bbfa5d5e group-health-badges">
                  <span className="badge si-8c23064b">{t('animalGroups.health.placed')}: {healthMetrics.placedCount ?? 0}</span>
                  <span className="badge si-8c23064b">{t('animalGroups.health.current')}: {healthMetrics.currentCount ?? 0}</span>
                  {healthMetrics.cycleNumber != null && (
                    <span className="badge si-8c23064b">{t('animalGroups.health.cycle')} #{healthMetrics.cycleNumber}</span>
                  )}
                </div>
                <div className="group-health-grid">
                  {[
                    { label: t('animalGroups.health.mortalityRate'), value: fmtPct(healthMetrics.mortalityRate), icon: '☠️' },
                    { label: t('animalGroups.health.cullRate'), value: fmtPct(healthMetrics.cullRate), icon: '🗑️' },
                    { label: t('animalGroups.health.survivalRate'), value: fmtPct(healthMetrics.survivalRate), icon: '💚' },
                    { label: t('animalGroups.health.morbidityRate'), value: fmtPct(healthMetrics.morbidityRate), icon: '🩺' },
                    { label: t('animalGroups.health.treatmentCoverage'), value: fmtPct(healthMetrics.treatmentCoverage), icon: '💊' },
                  ].map((m, i) => (
                    <div key={i} className="group-health-metric">
                      <div className="group-health-metric-icon">{m.icon}</div>
                      <div className="group-health-metric-value">{m.value}</div>
                      <div className="group-health-metric-label">{m.label}</div>
                    </div>
                  ))}
                </div>
                <p className="si-9cbc3f5c group-health-note">
                  {t('animalGroups.health.ratesNote')}
                </p>
              </div>
            )}

            <div className="si-64c669e9">
              <button className="btn btn-secondary" onClick={() => setHealthGroup(null)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Form - short steps; group types and record-keeping style come from master data */}
      {showForm && (
        <GroupFormModal
          form={formData}
          setForm={setFormData}
          editingGroup={editingGroup}
          onClose={() => { setShowForm(false); resetForm() }}
          onSubmit={handleSubmit}
          saveStatus={saveGroup.status}
          saveError={saveGroup.error}
          saveOffline={saveGroup.offline}
          onRetry={handleSubmit}
          speciesCategories={speciesCategories}
        />
      )}
      <ShareGroupSheet group={shareGroup} onClose={() => setShareGroup(null)} />
    </div>
  )
}

export default AnimalGroups
