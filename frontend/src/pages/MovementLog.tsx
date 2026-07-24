import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, MovementRecord } from '../types'
import { useTranslation } from 'react-i18next'
import { useScrollToForm } from '../hooks/useScrollToForm'
import { useAuth } from '../context/AuthContext'
import { useMasterData } from '../context/MasterDataContext'
import SearchSelect, { SearchSelectOption } from '../components/SearchSelect'

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
  const { t } = useTranslation()
  const { user } = useAuth()
  const { speciesLabel } = useMasterData()

  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [movements, setMovements] = useState<MovementRecord[]>([])
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const formRef = useScrollToForm(showForm)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    movementType: 'transfer', animalId: '', groupId: '',
    fromLocationId: '', toLocationId: '', reason: '', notes: ''
  })
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [animalLabel, setAnimalLabel] = useState('')

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

  const handleApprove = async (movId: string, action: 'approve' | 'reject') => {
    setApprovingId(`${movId}-${action}`)
    try {
      await apiService.approveMovement(movId, action)
      setSuccessMsg(action === 'approve' ? t('movements.approved') : t('movements.rejected'))
      setMovements(prev => prev.map(m => m.id === movId ? { ...m, status: action === 'approve' ? 'approved' : 'rejected' } : m))
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error || t('movementLog.toasts.failed'))
    } finally {
      setApprovingId(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!formData.movementType) { setError(t('movementLog.validation.typeRequired')); return }
    if (!formData.animalId && !formData.groupId) { setError(t('movementLog.validation.selectAnimal')); return }
    try {
      await apiService.createMovement({
        enterpriseId: selectedEnterpriseId,
        ...formData,
        animalId: formData.animalId || undefined,
        groupId: formData.groupId || undefined,
        fromLocationId: formData.fromLocationId || undefined,
        toLocationId: formData.toLocationId || undefined
      } as any)
      setSuccessMsg(t('movementLog.toasts.recorded'))
      setShowForm(false)
      setFormData({ movementType: 'transfer', animalId: '', groupId: '', fromLocationId: '', toLocationId: '', reason: '', notes: '' })
      fetchMovements()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) { setError(err.response?.data?.error?.message || t('movementLog.toasts.failed')) }
  }

  const formatDate = (d: string) => d ? new Date(d).toLocaleString() : '–'

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>{t('movementLog.pageTitle')}</h1>
          <p className="subtitle">{t('movementLog.subtitle')}</p>
        </div>
        <div className="header-actions">
          {selectedEnterpriseId && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>{t('movementLog.recordMovement')}</button>
          )}
        </div>
      </div>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      {error && !showForm && <div className="alert alert-error">{error}</div>}

      <div className="filters-bar">
        <select value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)} className="search-input si-58fb376a">
          <option value="">{t('movementLog.selectEnterprise')}</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {!selectedEnterpriseId ? (
        <div className="empty-state">
          <div className="empty-icon">🔄</div>
          <h3>{t('movementLog.emptyEnterprise')}</h3>
          <p>{t('movementLog.emptyEnterpriseSubtitle')}</p>
        </div>
      ) : loading ? (
        <div className="loading-spinner">{t('common.loading')}</div>
      ) : movements.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔄</div>
          <h3>{t('movementLog.emptyTitle')}</h3>
          <p>{t('movementLog.emptySubtitle')}</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>{t('movementLog.recordMovement')}</button>
        </div>
      ) : (
        <div className="si-bde003a3">
          <table className="data-table si-4d966555">
            <thead>
              <tr>
                <th className="si-9874afe5">{t('movementLog.headers.type')}</th>
                <th className="si-9874afe5">{t('movementLog.headers.animalGroup')}</th>
                <th className="si-9874afe5">{t('movementLog.headers.from')}</th>
                <th className="si-9874afe5">{t('movementLog.headers.to')}</th>
                <th className="si-9874afe5">{t('movementLog.headers.reason')}</th>
                <th className="si-9874afe5">{t('common.status')}</th>
                <th className="si-9874afe5">{t('movementLog.headers.date')}</th>
                {user?.role === 'farmer' && <th className="si-9874afe5">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {movements.map(mov => {
                const statusColors: Record<string, string> = {
                  pending: '#f59e0b', approved: '#22c55e', rejected: '#ef4444', completed: '#3b82f6'
                }
                const status = mov.status || 'pending'
                return (
                  <tr key={mov.id} className="si-d953d1c8">
                    <td className="si-1e6cf2e2">
                      <span>{MOVEMENT_TYPE_ICONS[mov.movementType] || '🔄'}</span>{' '}
                      <span className="badge">{MOVEMENT_TYPE_LABELS[mov.movementType] || mov.movementType}</span>
                    </td>
                    <td className="si-1e6cf2e2">{mov.animalName || mov.groupName || '—'}</td>
                    <td className="si-1e6cf2e2">{mov.fromLocationName || '—'}</td>
                    <td className="si-1e6cf2e2">{mov.toLocationName || '—'}</td>
                    <td className="si-64c8f9db">{mov.reason || '—'}</td>
                    <td className="si-1e6cf2e2">
                      <span className="badge" style={{ background: statusColors[status] || '#94a3b8', color: '#fff', fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                        {t(`movements.${status}`, status)}
                      </span>
                    </td>
                    <td className="si-9b4bf64c">{formatDate(mov.createdAt)}</td>
                    {user?.role === 'farmer' && (
                      <td className="si-fcba35b6">
                        {status === 'pending' ? (
                          <>
                            <button
                              className="btn btn-sm si-d63e0b7c"
                             
                              disabled={!!approvingId}
                              onClick={() => handleApprove(mov.id, 'approve')}
                            >
                              {approvingId === `${mov.id}-approve` ? '⏳' : '✓'} {t('movements.approve')}
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              disabled={!!approvingId}
                              onClick={() => handleApprove(mov.id, 'reject')}
                            >
                              {approvingId === `${mov.id}-reject` ? '⏳' : '✗'} {t('movements.reject')}
                            </button>
                          </>
                        ) : (
                          <span className="si-93f5e4c5">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <div className="edit-form-overlay" onClick={() => setShowForm(false)} />}
      {showForm && (
        <div ref={formRef} className="edit-form-panel">
            <h2>{t('movementLog.form.title')}</h2>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label>{t('movementLog.form.type')}</label>
                <select value={formData.movementType} onChange={e => setFormData(f => ({ ...f, movementType: e.target.value }))} required>
                  {Object.entries(MOVEMENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="si-ec24da01">
                <div className="form-group">
                  <label>{t('movementLog.form.animalId')}</label>
                  <SearchSelect
                    placeholder="Search animal by name..."
                    value={formData.animalId}
                    displayValue={animalLabel}
                    loadOnOpen={true}
                    onSelect={(val, label) => { setFormData(f => ({ ...f, animalId: val })); setAnimalLabel(label) }}
                    onClear={() => { setFormData(f => ({ ...f, animalId: '' })); setAnimalLabel('') }}
                    onSearch={async (q: string): Promise<SearchSelectOption[]> => {
                      if (!selectedEnterpriseId) return []
                      const res = await apiService.get(`/enterprises/${selectedEnterpriseId}/animals`, { params: { search: q, limit: 20 } })
                      const items = res.data?.items || res.data?.animals || res.data || []
                      return items.map((a: any) => ({ value: a.id, label: a.name, sublabel: [speciesLabel(a.species, t), a.breed].filter(Boolean).join(' · ') }))
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>{t('movementLog.form.group')}</label>
                  <select value={formData.groupId} onChange={e => setFormData(f => ({ ...f, groupId: e.target.value }))}>
                    <option value="">{t('movementLog.form.groupDefault')}</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('movementLog.form.fromLocation')}</label>
                  <select value={formData.fromLocationId} onChange={e => setFormData(f => ({ ...f, fromLocationId: e.target.value }))}>
                    <option value="">{t('movementLog.form.locationDefault')}</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('movementLog.form.toLocation')}</label>
                  <select value={formData.toLocationId} onChange={e => setFormData(f => ({ ...f, toLocationId: e.target.value }))}>
                    <option value="">{t('movementLog.form.locationDefault')}</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>{t('movementLog.form.reason')}</label>
                <input type="text" value={formData.reason} onChange={e => setFormData(f => ({ ...f, reason: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>{t('movementLog.form.notes')}</label>
                <textarea rows={2} value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="si-5af10afb">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('movementLog.form.recordBtn')}</button>
              </div>
            </form>
        </div>
      )}
    </div>
  )
}

export default MovementLog
