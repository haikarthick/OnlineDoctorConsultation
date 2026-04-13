import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, TreatmentCampaign } from '../types'
import { useTranslation } from 'react-i18next'
import { useScrollToForm } from '../hooks/useScrollToForm'

const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  vaccination: 'Vaccination', deworming: 'Deworming', testing: 'Testing',
  treatment: 'Treatment', supplement: 'Supplement', other: 'Other'
}

const CAMPAIGN_TYPE_ICONS: Record<string, string> = {
  vaccination: '💉', deworming: '💊', testing: '🔬',
  treatment: '🏥', supplement: '🧪', other: '📋'
}

const STATUS_COLORS: Record<string, string> = {
  planned: '#6c757d', in_progress: '#0d6efd', completed: '#198754',
  cancelled: '#dc3545'
}

const TreatmentCampaigns: React.FC = () => {
  const { t } = useTranslation()

  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [campaigns, setCampaigns] = useState<TreatmentCampaign[]>([])
  const [groups, setGroups] = useState<{ id: string; name: string; animalCount?: number }[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [groupsError, setGroupsError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const formRef = useScrollToForm(showForm)
  const [editingCampaign, setEditingCampaign] = useState<TreatmentCampaign | null>(null)
  const [formData, setFormData] = useState({
    name: '', campaignType: 'vaccination', description: '',
    targetSpecies: '', targetGroupId: '', status: 'planned',
    scheduledDate: '', medication: '', dosage: '', notes: ''
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

  const fetchCampaigns = async () => {
    if (!selectedEnterpriseId) return
    try {
      setLoading(true)
      const res = await apiService.listCampaigns(selectedEnterpriseId)
      setCampaigns(res.data?.items || [])
    } catch { setCampaigns([]) }
    finally { setLoading(false) }
  }

  const fetchGroups = async (enterpriseId: string) => {
    setGroupsLoading(true)
    setGroupsError(false)
    try {
      const res = await apiService.listAnimalGroups(enterpriseId)
      setGroups((res.data?.items || []).map((g: any) => ({ id: g.id, name: g.name, animalCount: g.animalCount })))
    } catch {
      setGroupsError(true)
      setGroups([])
    } finally {
      setGroupsLoading(false)
    }
  }

  useEffect(() => { if (selectedEnterpriseId) { fetchCampaigns(); fetchGroups(selectedEnterpriseId) } }, [selectedEnterpriseId])

  const resetForm = () => {
    setFormData({ name: '', campaignType: 'vaccination', description: '', targetSpecies: '', targetGroupId: '', status: 'planned', scheduledDate: '', medication: '', dosage: '', notes: '' })
    setEditingCampaign(null); setError('')
  }

  const openEdit = (c: TreatmentCampaign) => {
    setEditingCampaign(c)
    setFormData({
      name: c.name, campaignType: c.campaignType, description: c.description || '',
      targetSpecies: c.targetSpecies || '', targetGroupId: c.targetGroupId || '',
      status: c.status, scheduledDate: c.scheduledDate ? c.scheduledDate.split('T')[0] : '',
      medication: c.medication || '', dosage: c.dosage || '', notes: c.notes || ''
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!formData.name || !formData.campaignType) { setError('Name and type required'); return }
    try {
      const payload: any = {
        ...formData, enterpriseId: selectedEnterpriseId,
        targetGroupId: formData.targetGroupId || undefined,
        scheduledDate: formData.scheduledDate || undefined,
      }
      if (editingCampaign) {
        await apiService.updateCampaign(editingCampaign.id, payload)
        setSuccessMsg('Campaign updated')
      } else {
        await apiService.createCampaign(payload)
        setSuccessMsg('Campaign created')
      }
      resetForm(); setShowForm(false); fetchCampaigns()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this campaign?')) return
    try {
      await apiService.deleteCampaign(id)
      setSuccessMsg('Campaign deleted')
      fetchCampaigns()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed') }
  }

  const formatDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString() : '—'

  const getStatusLabel = (s: string) => {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>{t('treatmentCampaigns.pageTitle')}</h1>
          <p className="subtitle">{t('treatmentCampaigns.subtitle')}</p>
        </div>
        <div className="header-actions">
          {selectedEnterpriseId && (
            <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>+ New Campaign</button>
          )}
        </div>
      </div>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      {error && !showForm && <div className="alert alert-error">{error}</div>}

      <div className="filters-bar">
        <select value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)} className="search-input" style={{ maxWidth: '350px' }}>
          <option value="">Select Enterprise...</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {!selectedEnterpriseId ? (
        <div className="empty-state">
          <div className="empty-icon">💉</div>
          <h3>Select an Enterprise</h3>
          <p>Choose an enterprise to manage treatment campaigns.</p>
        </div>
      ) : loading ? (
        <div className="loading-spinner">{t('common.loading')}</div>
      ) : campaigns.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💉</div>
          <h3>{t('treatmentCampaigns.emptyTitle')}</h3>
          <p>{t('treatmentCampaigns.emptySubtitle')}</p>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>+ Create Campaign</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {campaigns.map(camp => (
            <div key={camp.id} className="card" style={{ borderRadius: '12px', padding: '1.25rem', borderLeft: `4px solid ${STATUS_COLORS[camp.status] || '#6c757d'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>{CAMPAIGN_TYPE_ICONS[camp.campaignType] || '📋'}</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0 }}>{camp.name}</h3>
                  <span className="badge" style={{ fontSize: '0.75rem' }}>{CAMPAIGN_TYPE_LABELS[camp.campaignType] || camp.campaignType}</span>
                </div>
                <span className="badge" style={{ background: STATUS_COLORS[camp.status] || '#6c757d', color: '#fff', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '12px' }}>
                  {getStatusLabel(camp.status)}
                </span>
              </div>
              {camp.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0' }}>{camp.description}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 1rem', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                {camp.targetSpecies && <div><strong>Species:</strong> {camp.targetSpecies}</div>}
                {camp.medication && <div><strong>Medication:</strong> {camp.medication}</div>}
                {camp.dosage && <div><strong>Dosage:</strong> {camp.dosage}</div>}
                <div><strong>Scheduled:</strong> {formatDate(camp.scheduledDate)}</div>
                {camp.startedAt && <div><strong>Started:</strong> {formatDate(camp.startedAt)}</div>}
                {camp.completedAt && <div><strong>Completed:</strong> {formatDate(camp.completedAt)}</div>}
                <div><strong>Treated:</strong> {camp.treatedCount}/{camp.totalAnimals}</div>
              </div>
              {camp.totalAnimals > 0 && (
                <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', marginTop: '0.5rem', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (camp.treatedCount / camp.totalAnimals) * 100)}%`, background: STATUS_COLORS[camp.status] || '#6c757d', borderRadius: '3px' }} />
                </div>
              )}
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(camp)}>{t('common.edit')}</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(camp.id)}>{t('common.delete')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <div className="edit-form-overlay" onClick={() => { setShowForm(false); resetForm() }} />}
      {showForm && (
        <div ref={formRef} className="edit-form-panel">
            <h2>{editingCampaign ? t('treatmentCampaigns.modal.editTitle') : t('treatmentCampaigns.modal.createTitle')}</h2>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label>Campaign Name *</label>
                <input type="text" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Campaign Type *</label>
                  <select value={formData.campaignType} onChange={e => setFormData(f => ({ ...f, campaignType: e.target.value }))} required>
                    {Object.entries(CAMPAIGN_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('treatmentCampaigns.modal.status')}</label>
                  <select value={formData.status} onChange={e => setFormData(f => ({ ...f, status: e.target.value }))}>
                    <option value="planned">{t('treatmentCampaigns.modal.statusOptions.planned')}</option>
                    <option value="in_progress">{t('treatmentCampaigns.modal.statusOptions.inProgress')}</option>
                    <option value="completed">{t('common.completed')}</option>
                    <option value="cancelled">{t('common.cancelled')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Target Species</label>
                  <input type="text" value={formData.targetSpecies} onChange={e => setFormData(f => ({ ...f, targetSpecies: e.target.value }))} placeholder="e.g. Cattle" />
                </div>
                <div className="form-group">
                  <label>Target Group (optional)</label>
                  {groupsError ? (
                    <input type="text" value={formData.targetGroupId} onChange={e => setFormData(f => ({ ...f, targetGroupId: e.target.value }))} placeholder="Group ID" />
                  ) : (
                    <select value={formData.targetGroupId} onChange={e => setFormData(f => ({ ...f, targetGroupId: e.target.value }))}>
                      <option value="">{groupsLoading ? 'Loading groups...' : 'All animals (no group filter)'}</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}{g.animalCount != null ? ` (${g.animalCount} animals)` : ''}</option>)}
                    </select>
                  )}
                  {formData.targetGroupId && groups.length > 0 && (() => {
                    const sel = groups.find(g => g.id === formData.targetGroupId)
                    return sel && sel.animalCount != null ? (
                      <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>
                        📊 {sel.animalCount} animals in this group will be included
                      </small>
                    ) : null
                  })()}
                </div>
                <div className="form-group">
                  <label>Scheduled Date</label>
                  <input type="date" value={formData.scheduledDate} onChange={e => setFormData(f => ({ ...f, scheduledDate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Medication</label>
                  <input type="text" value={formData.medication} onChange={e => setFormData(f => ({ ...f, medication: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Dosage</label>
                  <input type="text" value={formData.dosage} onChange={e => setFormData(f => ({ ...f, dosage: e.target.value }))} placeholder="e.g. 5ml" />
                </div>
              </div>
              <div className="form-group">
                <label>{t('common.description')}</label>
                <textarea rows={2} value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>{t('common.notes')}</label>
                <textarea rows={2} value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); resetForm() }}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{editingCampaign ? 'Update' : 'Create'} Campaign</button>
              </div>
            </form>
        </div>
      )}
    </div>
  )
}

export default TreatmentCampaigns
