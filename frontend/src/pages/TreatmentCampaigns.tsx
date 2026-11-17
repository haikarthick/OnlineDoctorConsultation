import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, TreatmentCampaign } from '../types'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../context/SettingsContext'
import { BottomSheet } from '../components/mobile/BottomSheet'
import { ChipSelect } from '../components/mobile/ChipSelect'
import { NumberStepper } from '../components/mobile/NumberStepper'
import { SaveState } from '../components/mobile/SaveState'
import { StepForm, type FormStep } from '../components/mobile/StepForm'
import { useSaveAction } from '../hooks/useSaveAction'
import { useMyFarmRole } from '../hooks/useMyFarmRole'
import { userMessage } from '../utils/userMessage'

/** The kinds the database accepts (treatment_campaigns.campaign_type). */
const CAMPAIGN_TYPES = ['vaccination', 'deworming', 'testing', 'treatment', 'health_check', 'tagging', 'weighing', 'hoof_trimming', 'shearing', 'dipping', 'other']
const CAMPAIGN_TYPE_ICONS: Record<string, string> = {
  vaccination: '💉', deworming: '💊', testing: '🔬', treatment: '🏥', health_check: '🩺', tagging: '🏷️',
  weighing: '⚖️', hoof_trimming: '✂️', shearing: '🐑', dipping: '🛁', other: '📋',
}
const STATUSES = ['planned', 'in_progress', 'completed', 'cancelled']
/** Who may create or change a campaign (server: EnterpriseController.createCampaign). */
const CAMPAIGN_ROLES = ['owner', 'manager', 'supervisor', 'farm_vet']

interface CampaignForm {
  name: string; campaignType: string; groupId: string; scheduledDate: string; productUsed: string; dosage: string
  targetCount: string; status: string; completedCount: string; description: string; notes: string
}
const emptyForm = (): CampaignForm => ({
  name: '', campaignType: 'vaccination', groupId: '', scheduledDate: '', productUsed: '', dosage: '',
  targetCount: '', status: 'planned', completedCount: '', description: '', notes: '',
})
const barStep = (done: number, total: number) => Math.min(20, Math.max(0, Math.round((done / Math.max(1, total)) * 20)))

const TreatmentCampaigns: React.FC = () => {
  const { t } = useTranslation()
  const { formatDate } = useSettings()

  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [campaigns, setCampaigns] = useState<TreatmentCampaign[]>([])
  const [groups, setGroups] = useState<{ id: string; name: string; currentCount?: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<TreatmentCampaign | null>(null)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<CampaignForm>(emptyForm)
  const [deleting, setDeleting] = useState<TreatmentCampaign | null>(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const farm = enterprises.find(e => e.id === selectedEnterpriseId)
  const role = useMyFarmRole(farm)
  const canEdit = !!role && CAMPAIGN_ROLES.includes(role)

  useEffect(() => {
    apiService.listEnterprises({ limit: 100 })
      .then((res: any) => {
        const items = res.data?.items || []
        setEnterprises(items)
        if (items.length === 1) setSelectedEnterpriseId(items[0].id)
      })
      .catch(() => setEnterprises([]))
  }, [])

  const fetchAll = async () => {
    if (!selectedEnterpriseId) return
    try {
      setLoading(true); setError('')
      const [campRes, groupRes] = await Promise.all([
        apiService.listCampaigns(selectedEnterpriseId),
        apiService.listAnimalGroups(selectedEnterpriseId, { limit: 200 }),
      ])
      setCampaigns(campRes.data?.items || [])
      setGroups((groupRes.data?.items || []).map((g: any) => ({ id: g.id, name: g.name, currentCount: g.currentCount })))
    } catch (err: any) {
      setCampaigns([])
      setError(userMessage(err, 'treatmentCampaigns.loadFailed'))
    } finally { setLoading(false) }
  }
  useEffect(() => { if (selectedEnterpriseId) fetchAll() }, [selectedEnterpriseId])

  const typeLabel = (c: string) => t('treatmentCampaigns.types.' + c, { defaultValue: c })
  const statusLabel = (s: string) => t('treatmentCampaigns.status.' + s, { defaultValue: s })
  const set = <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => setForm(f => ({ ...f, [key]: value }))

  const save = useSaveAction(async () => {
    const num = (v: string) => (v !== '' && !Number.isNaN(parseInt(v, 10)) ? parseInt(v, 10) : undefined)
    const payload: Record<string, unknown> = {
      enterpriseId: selectedEnterpriseId, name: form.name.trim(), campaignType: form.campaignType,
      groupId: form.groupId || undefined, scheduledDate: form.scheduledDate || undefined,
      productUsed: form.productUsed || undefined, dosage: form.dosage || undefined,
      targetCount: num(form.targetCount), description: form.description || undefined, notes: form.notes || undefined,
    }
    if (editing) {
      await apiService.updateCampaign(editing.id, { ...payload, status: form.status, completedCount: num(form.completedCount) })
    } else {
      await apiService.createCampaign(payload as any)
    }
  }, t('treatmentCampaigns.toasts.failed'))

  const close = () => { setShowForm(false); setEditing(null); setStep(0); save.reset() }
  const openNew = () => { setForm(emptyForm()); setEditing(null); setStep(0); save.reset(); setShowForm(true) }
  const openEdit = (c: TreatmentCampaign, status?: string, firstStep = 0) => {
    setEditing(c); setStep(firstStep); save.reset()
    setForm({
      name: c.name, campaignType: c.campaignType, groupId: c.groupId || '', scheduledDate: c.scheduledDate ? c.scheduledDate.split('T')[0] : '',
      productUsed: c.productUsed || '', dosage: c.dosage || '', targetCount: c.targetCount ? String(c.targetCount) : '',
      status: status || c.status, completedCount: c.completedCount ? String(c.completedCount) : '', description: c.description || '', notes: c.notes || '',
    })
    setShowForm(true)
  }
  const submit = async () => {
    setSuccessMsg('')
    const wasEditing = !!editing
    if (await save.run()) {
      close()
      setSuccessMsg(t(wasEditing ? 'treatmentCampaigns.toasts.updated' : 'treatmentCampaigns.toasts.created'))
      void fetchAll()
    }
  }

  // "Start" is one tap; finishing asks how many were actually treated, so the health record is true.
  const start = useSaveAction(async (c: TreatmentCampaign) => { await apiService.updateCampaign(c.id, { status: 'in_progress' }) }, t('treatmentCampaigns.toasts.failed'))
  const startCampaign = async (c: TreatmentCampaign) => {
    setSuccessMsg(''); setError('')
    if (await start.run(c)) { setSuccessMsg(t('treatmentCampaigns.toasts.started')); void fetchAll() }
    else setError(start.error || t('treatmentCampaigns.toasts.failed'))
  }

  const removal = useSaveAction(async () => { if (deleting) await apiService.deleteCampaign(deleting.id) }, t('treatmentCampaigns.toasts.deleteFailed'))
  const submitDelete = async () => {
    if (await removal.run()) { setDeleting(null); setSuccessMsg(t('treatmentCampaigns.toasts.deleted')); void fetchAll() }
  }

  const chosenGroup = groups.find(g => g.id === form.groupId)
  const steps: FormStep[] = [
    {
      id: 'what', title: t('treatmentCampaigns.steps.what'),
      blockedReason: form.name.trim() ? undefined : t('treatmentCampaigns.blocked.name'),
      content: (
        <>
          <div className="camp-field">
            <label htmlFor="camp-name">{t('treatmentCampaigns.modal.name')}</label>
            <input id="camp-name" type="text" className="an-field" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="camp-field">
            <label htmlFor="camp-type">{t('treatmentCampaigns.modal.type')}</label>
            <select id="camp-type" className="an-field" value={form.campaignType} onChange={e => set('campaignType', e.target.value)}>
              {CAMPAIGN_TYPES.map(c => <option key={c} value={c}>{CAMPAIGN_TYPE_ICONS[c]} {typeLabel(c)}</option>)}
            </select>
          </div>
          <div className="camp-field">
            <label htmlFor="camp-date">{t('treatmentCampaigns.modal.scheduledDate')}</label>
            <input id="camp-date" type="date" className="an-field" value={form.scheduledDate} onChange={e => set('scheduledDate', e.target.value)} />
          </div>
        </>
      ),
    },
    {
      id: 'who', title: t('treatmentCampaigns.steps.who'),
      content: (
        <>
          <div className="camp-field">
            <label htmlFor="camp-group">{t('treatmentCampaigns.modal.group')}</label>
            <select id="camp-group" className="an-field" value={form.groupId} onChange={e => {
              const g = groups.find(x => x.id === e.target.value)
              setForm(f => ({ ...f, groupId: e.target.value, targetCount: g && typeof g.currentCount === 'number' && !f.targetCount ? String(g.currentCount) : f.targetCount }))
            }}>
              <option value="">{t('treatmentCampaigns.modal.groupNone')}</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}{typeof g.currentCount === 'number' ? ` (${g.currentCount})` : ''}</option>)}
            </select>
            {chosenGroup && typeof chosenGroup.currentCount === 'number' && (
              <p className="camp-hint" role="status">{t('treatmentCampaigns.modal.groupCount', { count: chosenGroup.currentCount })}</p>
            )}
          </div>
          <NumberStepper label={t('treatmentCampaigns.modal.targetCount')} value={form.targetCount} onChange={v => set('targetCount', v)} integer min={0} hint={t('treatmentCampaigns.modal.targetHint')} />
          <div className="camp-field">
            <label htmlFor="camp-product">{t('treatmentCampaigns.modal.medication')}</label>
            <input id="camp-product" type="text" className="an-field" value={form.productUsed} onChange={e => set('productUsed', e.target.value)} />
          </div>
          <div className="camp-field">
            <label htmlFor="camp-dosage">{t('treatmentCampaigns.modal.dosage')}</label>
            <input id="camp-dosage" type="text" className="an-field" value={form.dosage} onChange={e => set('dosage', e.target.value)} />
          </div>
        </>
      ),
    },
    {
      id: 'progress', title: t('treatmentCampaigns.steps.progress'),
      content: (
        <>
          {editing && (
            <>
              <ChipSelect label={t('treatmentCampaigns.modal.status')} options={STATUSES.map(s => ({ value: s, label: statusLabel(s) }))} value={form.status} onChange={v => set('status', v)} />
              <NumberStepper label={t('treatmentCampaigns.modal.completedCount')} value={form.completedCount} onChange={v => set('completedCount', v)} integer min={0}
                hint={form.status === 'completed' ? t('treatmentCampaigns.modal.completedHint') : undefined} />
            </>
          )}
          <div className="camp-field">
            <label htmlFor="camp-desc">{t('treatmentCampaigns.modal.description')}</label>
            <textarea id="camp-desc" rows={2} className="an-field an-field--textarea" value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="camp-field">
            <label htmlFor="camp-notes">{t('treatmentCampaigns.modal.notes')}</label>
            <textarea id="camp-notes" rows={2} className="an-field an-field--textarea" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </>
      ),
    },
  ]

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>{t('treatmentCampaigns.pageTitle')}</h1>
          <p className="subtitle">{t('treatmentCampaigns.subtitle')}</p>
        </div>
        <div className="header-actions">
          {selectedEnterpriseId && canEdit && <button className="btn btn-primary" onClick={openNew}>{t('treatmentCampaigns.newCampaign')}</button>}
        </div>
      </div>

      {successMsg && <div className="alert alert-success" role="status">{successMsg}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="filters-bar">
        <select aria-label={t('treatmentCampaigns.selectEnterprise')} value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)} className="search-input">
          <option value="">{t('treatmentCampaigns.selectEnterprise')}</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="edit-form-overlay" onClick={close}>
          <div className="edit-form-panel edit-form-modal" onClick={e => e.stopPropagation()}>
            <button className="edit-form-close" onClick={close} aria-label={t('mobileUi.close')}>✕</button>
            <h2>{editing ? t('treatmentCampaigns.modal.editTitle') : t('treatmentCampaigns.modal.createTitle')}</h2>
            <StepForm
              steps={steps} current={step} onStepChange={setStep} onSubmit={submit}
              submitLabel={editing ? t('treatmentCampaigns.modal.updateBtn') : t('treatmentCampaigns.modal.createBtn')}
              busy={save.status === 'saving'} onCancel={close}
              saveNowLabel={editing ? t('farmProfile.form.saveNow') : undefined}
              footer={<SaveState status={save.status} error={save.error} offline={save.offline} onRetry={save.retry} />}
            />
          </div>
        </div>
      )}

      <BottomSheet open={!!deleting} title={t('treatmentCampaigns.toasts.deleteConfirm')} onClose={() => { setDeleting(null); removal.reset() }}>
        <p>{deleting?.name}</p>
        <SaveState status={removal.status} error={removal.error} offline={removal.offline} onRetry={removal.retry} />
        <button type="button" className="btn btn-danger camp-sheet-action" disabled={removal.status === 'saving'} onClick={submitDelete}>{t('common.delete')}</button>
      </BottomSheet>

      {!selectedEnterpriseId ? (
        <div className="empty-state">
          <div className="empty-icon">💉</div>
          <h3>{t('treatmentCampaigns.emptyEnterprise')}</h3>
          <p>{t('treatmentCampaigns.emptyEnterpriseSubtitle')}</p>
        </div>
      ) : loading ? (
        <div className="loading-spinner">{t('common.loading')}</div>
      ) : campaigns.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💉</div>
          <h3>{t('treatmentCampaigns.emptyTitle')}</h3>
          <p>{t('treatmentCampaigns.emptySubtitle')}</p>
          {canEdit && <button className="btn btn-primary" onClick={openNew}>{t('treatmentCampaigns.createBtn')}</button>}
        </div>
      ) : (
        <ul className="camp-list">
          {campaigns.map(camp => (
            <li key={camp.id} className={`camp-card camp-card--${camp.status}`}>
              <div className="camp-card-head">
                <strong className="camp-card-name">{CAMPAIGN_TYPE_ICONS[camp.campaignType] || '📋'} {camp.name}</strong>
                <span className={`camp-status camp-status--${camp.status}`}>{statusLabel(camp.status)}</span>
              </div>
              <p className="camp-card-type">{typeLabel(camp.campaignType)}{camp.groupName ? ` · ${camp.groupName}` : ''}</p>
              {camp.description && <p className="camp-card-desc">{camp.description}</p>}
              <dl className="camp-facts">
                {camp.productUsed && <div><dt>{t('treatmentCampaigns.cardLabels.medication')}</dt><dd>{camp.productUsed}</dd></div>}
                {camp.dosage && <div><dt>{t('treatmentCampaigns.cardLabels.dosage')}</dt><dd>{camp.dosage}</dd></div>}
                <div><dt>{t('treatmentCampaigns.cardLabels.scheduled')}</dt><dd>{camp.scheduledDate ? formatDate(camp.scheduledDate) : '-'}</dd></div>
                {camp.startedAt && <div><dt>{t('treatmentCampaigns.cardLabels.started')}</dt><dd>{formatDate(camp.startedAt)}</dd></div>}
                {camp.completedAt && <div><dt>{t('treatmentCampaigns.cardLabels.completed')}</dt><dd>{formatDate(camp.completedAt)}</dd></div>}
                <div><dt>{t('treatmentCampaigns.cardLabels.treated')}</dt><dd>{camp.completedCount}/{camp.targetCount}</dd></div>
              </dl>
              {camp.targetCount > 0 && (
                <div className="camp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={camp.targetCount} aria-valuenow={camp.completedCount}>
                  <div className={`camp-progress-fill camp-progress-${barStep(camp.completedCount, camp.targetCount)}`} />
                </div>
              )}
              {canEdit && (
                <div className="camp-card-actions">
                  {camp.status === 'planned' && <button className="btn btn-sm btn-primary" disabled={start.status === 'saving'} onClick={() => startCampaign(camp)}>{t('treatmentCampaigns.start')}</button>}
                  {(camp.status === 'planned' || camp.status === 'in_progress') && <button className="btn btn-sm btn-primary" onClick={() => openEdit(camp, 'completed', 2)}>{t('treatmentCampaigns.markDone')}</button>}
                  <button className="btn btn-sm btn-secondary" onClick={() => openEdit(camp)}>{t('common.edit')}</button>
                  <button className="btn btn-sm btn-danger" onClick={() => { removal.reset(); setDeleting(camp) }}>{t('common.delete')}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default TreatmentCampaigns
