import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, MovementRecord } from '../types'
import { useTranslation } from 'react-i18next'
import { useScrollToForm } from '../hooks/useScrollToForm'
import { useAuth } from '../context/AuthContext'

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
        <select value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)} className="search-input" style={{ maxWidth: '350px' }}>
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
        <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{t('movementLog.headers.type')}</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{t('movementLog.headers.animalGroup')}</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{t('movementLog.headers.from')}</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{t('movementLog.headers.to')}</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{t('movementLog.headers.reason')}</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{t('common.status')}</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{t('movementLog.headers.date')}</th>
                {user?.role === 'farmer' && <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {movements.map(mov => {
                const statusColors: Record<string, string> = {
                  pending: '#f59e0b', approved: '#22c55e', rejected: '#ef4444', completed: '#3b82f6'
                }
                const status = mov.status || 'pending'
                return (
                  <tr key={mov.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span>{MOVEMENT_TYPE_ICONS[mov.movementType] || '🔄'}</span>{' '}
                      <span className="badge">{MOVEMENT_TYPE_LABELS[mov.movementType] || mov.movementType}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>{mov.animalName || mov.groupName || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{mov.fromLocationName || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{mov.toLocationName || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{mov.reason || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className="badge" style={{ background: statusColors[status] || '#94a3b8', color: '#fff', fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                        {t(`movements.${status}`, status)}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{formatDate(mov.createdAt)}</td>
                    {user?.role === 'farmer' && (
                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                        {status === 'pending' ? (
                          <>
                            <button
                              className="btn btn-sm"
                              style={{ background: '#22c55e', color: '#fff', marginRight: '0.4rem' }}
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
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>—</span>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>{t('movementLog.form.animalId')}</label>
                  <input type="text" placeholder={t('movementLog.form.animalId')} value={formData.animalId} onChange={e => setFormData(f => ({ ...f, animalId: e.target.value }))} />
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
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
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
