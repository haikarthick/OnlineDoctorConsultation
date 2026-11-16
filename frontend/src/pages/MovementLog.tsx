import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, MovementRecord } from '../types'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useMasterData } from '../context/MasterDataContext'
import { useSettings } from '../context/SettingsContext'
import SearchSelect, { SearchSelectOption } from '../components/SearchSelect'
import { ChipSelect } from '../components/mobile/ChipSelect'
import { SaveState } from '../components/mobile/SaveState'
import { StepForm, type FormStep } from '../components/mobile/StepForm'
import { useSaveAction } from '../hooks/useSaveAction'
import { myFarmRole } from '../utils/farmRoles'
import { userMessage } from '../utils/userMessage'

const MOVEMENT_TYPES = ['transfer', 'intake', 'discharge', 'quarantine', 'sale', 'death', 'birth', 'import', 'export']
const MOVEMENT_TYPE_ICONS: Record<string, string> = {
  transfer: '🔄', intake: '📥', discharge: '📤', quarantine: '⚠️',
  sale: '💰', death: '✝️', birth: '🐣', import: '🚛', export: '📦',
}

interface MovementForm { movementType: string; kind: 'animal' | 'group'; animalId: string; groupId: string; fromLocationId: string; toLocationId: string; reason: string; notes: string }
const emptyForm = (): MovementForm => ({ movementType: 'transfer', kind: 'animal', animalId: '', groupId: '', fromLocationId: '', toLocationId: '', reason: '', notes: '' })

const MovementLog: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { speciesLabel } = useMasterData()
  const { formatDateTime } = useSettings()

  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [members, setMembers] = useState<Array<{ userId: string; role: string }>>([])
  const [movements, setMovements] = useState<MovementRecord[]>([])
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<MovementForm>(emptyForm)
  const [animalLabel, setAnimalLabel] = useState('')
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    apiService.listEnterprises({ limit: 100 })
      .then((res: any) => {
        const items = res.data?.items || []
        setEnterprises(items)
        if (items.length === 1) setSelectedEnterpriseId(items[0].id)
      })
      .catch(() => setEnterprises([]))
  }, [])

  const fetchMovements = async () => {
    if (!selectedEnterpriseId) return
    try {
      setLoading(true); setError('')
      const [movRes, locRes, grpRes, memRes] = await Promise.all([
        apiService.listMovements(selectedEnterpriseId),
        apiService.listLocations(selectedEnterpriseId),
        apiService.listAnimalGroups(selectedEnterpriseId),
        // Only to know whether to offer Approve / Reject; if it cannot load, the buttons are simply not offered.
        apiService.listEnterpriseMembers(selectedEnterpriseId).catch(() => ({ data: [] })),
      ])
      setMovements(movRes.data?.items || [])
      setLocations((locRes.data?.items || []).map((l: any) => ({ id: l.id, name: l.name })))
      setGroups((grpRes.data?.items || []).map((g: any) => ({ id: g.id, name: g.name })))
      setMembers(memRes.data || [])
    } catch (err: any) {
      setMovements([])
      setError(userMessage(err, 'movementLog.loadFailed'))
    } finally { setLoading(false) }
  }

  useEffect(() => { if (selectedEnterpriseId) fetchMovements() }, [selectedEnterpriseId])

  // The server decides; this only decides whether to show the buttons (owner and manager approve).
  const farm = enterprises.find(e => e.id === selectedEnterpriseId)
  const role = myFarmRole(farm as any, members, user?.id, user?.role === 'admin')
  const canApprove = role === 'owner' || role === 'manager'

  const handleApprove = async (movId: string, action: 'approve' | 'reject') => {
    setApprovingId(`${movId}-${action}`); setError('')
    try {
      await apiService.approveMovement(movId, action)
      setSuccessMsg(action === 'approve' ? t('movements.approved') : t('movements.rejected'))
      setMovements(prev => prev.map(m => m.id === movId ? { ...m, status: action === 'approve' ? 'approved' : 'rejected' } : m))
    } catch (err: any) {
      setError(userMessage(err, 'movementLog.toasts.failed'))
      void fetchMovements() // someone else may have decided it already: show what is true now
    } finally { setApprovingId(null) }
  }

  const set = <K extends keyof MovementForm>(key: K, value: MovementForm[K]) => setForm(f => ({ ...f, [key]: value }))

  const save = useSaveAction(async () => {
    await apiService.createMovement({
      enterpriseId: selectedEnterpriseId, movementType: form.movementType,
      animalId: form.kind === 'animal' ? form.animalId || undefined : undefined,
      groupId: form.kind === 'group' ? form.groupId || undefined : undefined,
      fromLocationId: form.fromLocationId || undefined, toLocationId: form.toLocationId || undefined,
      reason: form.reason || undefined, notes: form.notes || undefined,
    } as any)
  }, t('movementLog.toasts.failed'))

  const close = () => { setShowForm(false); setStep(0); save.reset() }
  const openNew = () => { setForm(emptyForm()); setAnimalLabel(''); setStep(0); save.reset(); setShowForm(true) }
  const submit = async () => {
    setSuccessMsg('')
    if (await save.run()) {
      close()
      setSuccessMsg(t('movementLog.toasts.recorded'))
      void fetchMovements()
    }
  }

  const subjectChosen = form.kind === 'animal' ? !!form.animalId : !!form.groupId
  const steps: FormStep[] = [
    {
      id: 'what', title: t('movementLog.steps.what'),
      content: (
        <div className="movement-field">
          <label htmlFor="movement-type">{t('movementLog.form.type')}</label>
          <select id="movement-type" className="an-field" value={form.movementType} onChange={e => set('movementType', e.target.value)}>
            {MOVEMENT_TYPES.map(m => <option key={m} value={m}>{MOVEMENT_TYPE_ICONS[m]} {t('movementLog.types.' + m)}</option>)}
          </select>
        </div>
      ),
    },
    {
      id: 'who', title: t('movementLog.steps.who'),
      blockedReason: subjectChosen ? undefined : t('movementLog.validation.selectAnimal'),
      content: (
        <>
          <ChipSelect label={t('movementLog.form.kind')} variant="segmented" value={form.kind}
            options={[{ value: 'animal', label: t('movementLog.form.kindAnimal') }, { value: 'group', label: t('movementLog.form.kindGroup') }]}
            onChange={v => setForm(f => ({ ...f, kind: v as 'animal' | 'group', animalId: '', groupId: '' }))} />
          {form.kind === 'animal' ? (
            <div className="movement-field">
              <label>{t('movementLog.form.animalId')}</label>
              <SearchSelect
                placeholder={t('movementLog.form.searchAnimal')}
                value={form.animalId}
                displayValue={animalLabel}
                loadOnOpen={true}
                onSelect={(val, label) => { set('animalId', val); setAnimalLabel(label) }}
                onClear={() => { set('animalId', ''); setAnimalLabel('') }}
                onSearch={async (q: string): Promise<SearchSelectOption[]> => {
                  if (!selectedEnterpriseId) return []
                  const res = await apiService.get(`/enterprises/${selectedEnterpriseId}/animals`, { params: { search: q, limit: 20 } })
                  const items = res.data?.items || res.data?.animals || res.data || []
                  return items.map((a: any) => ({ value: a.id, label: a.name, sublabel: [speciesLabel(a.species, t), a.breed].filter(Boolean).join(' · ') }))
                }}
              />
            </div>
          ) : (
            <div className="movement-field">
              <label htmlFor="movement-group">{t('movementLog.form.group')}</label>
              <select id="movement-group" className="an-field" value={form.groupId} onChange={e => set('groupId', e.target.value)}>
                <option value="">{t('movementLog.form.groupChoose')}</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              {groups.length === 0 && <p className="movement-hint" role="status">{t('movementLog.form.noGroups')}</p>}
            </div>
          )}
        </>
      ),
    },
    {
      id: 'where', title: t('movementLog.steps.where'),
      content: (
        <>
          {(['fromLocationId', 'toLocationId'] as const).map(key => (
            <div className="movement-field" key={key}>
              <label htmlFor={`movement-${key}`}>{t(key === 'fromLocationId' ? 'movementLog.form.fromLocation' : 'movementLog.form.toLocation')}</label>
              <select id={`movement-${key}`} className="an-field" value={form[key]} onChange={e => set(key, e.target.value)}>
                <option value="">{t('movementLog.form.locationDefault')}</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          ))}
          <div className="movement-field">
            <label htmlFor="movement-reason">{t('movementLog.form.reason')}</label>
            <input id="movement-reason" type="text" className="an-field" value={form.reason} onChange={e => set('reason', e.target.value)} />
          </div>
          <div className="movement-field">
            <label htmlFor="movement-notes">{t('movementLog.form.notes')}</label>
            <textarea id="movement-notes" rows={2} className="an-field an-field--textarea" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </>
      ),
    },
  ]

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>{t('movementLog.pageTitle')}</h1>
          <p className="subtitle">{t('movementLog.subtitle')}</p>
        </div>
        <div className="header-actions">
          {selectedEnterpriseId && (
            <button className="btn btn-primary" onClick={openNew}>{t('movementLog.recordMovement')}</button>
          )}
        </div>
      </div>

      {successMsg && <div className="alert alert-success" role="status">{successMsg}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="filters-bar">
        <select aria-label={t('movementLog.selectEnterprise')} value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)} className="search-input">
          <option value="">{t('movementLog.selectEnterprise')}</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="edit-form-overlay" onClick={close}>
          <div className="edit-form-panel edit-form-modal" onClick={e => e.stopPropagation()}>
            <button className="edit-form-close" onClick={close} aria-label={t('mobileUi.close')}>✕</button>
            <h2>{t('movementLog.form.title')}</h2>
            <StepForm
              steps={steps} current={step} onStepChange={setStep} onSubmit={submit}
              submitLabel={t('movementLog.form.recordBtn')} busy={save.status === 'saving'} onCancel={close}
              footer={<SaveState status={save.status} error={save.error} offline={save.offline} onRetry={save.retry} />}
            />
          </div>
        </div>
      )}

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
          <button className="btn btn-primary" onClick={openNew}>{t('movementLog.recordMovement')}</button>
        </div>
      ) : (
        <ul className="movement-list">
          {movements.map(mov => {
            const status = mov.status || 'pending'
            return (
              <li key={mov.id} className="movement-card">
                <div className="movement-card-head">
                  <strong className="movement-card-name">{MOVEMENT_TYPE_ICONS[mov.movementType] || '🔄'} {t('movementLog.types.' + mov.movementType, { defaultValue: mov.movementType })}</strong>
                  <span className={`movement-status movement-status--${status}`}>{t(`movements.${status}`, status)}</span>
                </div>
                <p className="movement-card-subject">{mov.animalName || mov.groupName || '-'}</p>
                <dl className="movement-facts">
                  <div><dt>{t('movementLog.headers.from')}</dt><dd>{mov.fromLocationName || '-'}</dd></div>
                  <div><dt>{t('movementLog.headers.to')}</dt><dd>{mov.toLocationName || '-'}</dd></div>
                  <div><dt>{t('movementLog.headers.reason')}</dt><dd>{mov.reason || '-'}</dd></div>
                  <div><dt>{t('movementLog.headers.date')}</dt><dd>{mov.createdAt ? formatDateTime(mov.createdAt) : '-'}</dd></div>
                </dl>
                {canApprove && status === 'pending' && (
                  <div className="movement-card-actions">
                    <button className="btn btn-sm btn-primary" disabled={!!approvingId} onClick={() => handleApprove(mov.id, 'approve')}>
                      {approvingId === `${mov.id}-approve` ? '⏳' : '✓'} {t('movements.approve')}
                    </button>
                    <button className="btn btn-sm btn-danger" disabled={!!approvingId} onClick={() => handleApprove(mov.id, 'reject')}>
                      {approvingId === `${mov.id}-reject` ? '⏳' : '✗'} {t('movements.reject')}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default MovementLog
