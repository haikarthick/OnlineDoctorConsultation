import React, { useState, useEffect, useMemo } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, BreedingRecord, BreedingStats } from '../types'
import { useTranslation } from 'react-i18next'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { useSaveAction } from '../hooks/useSaveAction'
import { ChipSelect } from '../components/mobile/ChipSelect'
import { DateQuick, localIsoDate } from '../components/mobile/DateQuick'
import { NumberStepper } from '../components/mobile/NumberStepper'
import { SaveState } from '../components/mobile/SaveState'
import { StepForm, type FormStep } from '../components/mobile/StepForm'
import { userMessage } from '../utils/userMessage'

const METHODS = ['natural', 'artificial_insemination', 'embryo_transfer', 'ivf']
const STATUSES = ['bred', 'confirmed_pregnant', 'not_pregnant', 'delivered', 'aborted', 'reabsorbed']
/** Statuses after which the birth figures mean something. */
const BIRTH_STATUSES = ['delivered', 'aborted', 'reabsorbed']

interface FarmAnimal { id: string; name: string; gender?: string | null; species?: string | null; status?: string | null; tag?: string | null }

interface BreedingForm {
  damId: string; sireId: string; breedingDate: string; breedingMethod: string; status: string
  offspringCount: string; liveOffspring: string; stillborn: string; notes: string
}
const emptyForm = (): BreedingForm => ({
  damId: '', sireId: '', breedingDate: localIsoDate(), breedingMethod: 'natural', status: 'bred',
  offspringCount: '', liveOffspring: '', stillborn: '', notes: '',
})

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '-')

const BreedingManager: React.FC = () => {
  const { t } = useTranslation()

  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [records, setRecords] = useState<BreedingRecord[]>([])
  const [stats, setStats] = useState<BreedingStats | null>(null)
  const [upcomingDue, setUpcomingDue] = useState<BreedingRecord[]>([])
  const [animals, setAnimals] = useState<FarmAnimal[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<BreedingRecord | null>(null)
  const [step, setStep] = useState(0)
  const [tab, setTab] = useState<'records' | 'upcoming' | 'stats'>('records')
  const [form, setForm] = useState<BreedingForm>(emptyForm)
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

  const fetchData = async () => {
    if (!selectedEnterpriseId) return
    try {
      setLoading(true); setError('')
      const [recRes, statsRes, dueRes, animalsRes] = await Promise.all([
        apiService.listBreedingRecords(selectedEnterpriseId),
        apiService.getBreedingStats(selectedEnterpriseId),
        apiService.getUpcomingDueDates(selectedEnterpriseId, 60),
        apiService.listEnterpriseAnimals(selectedEnterpriseId, { limit: 500 }),
      ])
      setRecords(recRes.data?.items || [])
      setStats(statsRes.data || null)
      setUpcomingDue(dueRes.data || [])
      setAnimals((animalsRes.data?.items || []).map((a: any): FarmAnimal => ({
        id: a.id, name: a.name, gender: a.gender, species: a.species, status: a.status, tag: a.earTagId || a.uniqueId || null,
      })))
    } catch (err: any) {
      setError(userMessage(err, 'breedingManager.loadFailed'))
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [selectedEnterpriseId])
  useAutoRefresh('breeding', fetchData)

  // Mothers and fathers are chosen from the farm's own animals - a typed ID could name anyone's animal or a typo.
  const alive = (a: FarmAnimal) => a.status !== 'sold' && a.status !== 'deceased'
  const label = (a: FarmAnimal) => (a.tag ? `${a.name} (${a.tag})` : a.name)
  const damOptions = useMemo(() => {
    const list = animals.filter(a => alive(a) && a.gender === 'female')
    // Editing a record whose mother has since been sold: keep her visible so the record can still be opened.
    if (editing && form.damId && !list.some(a => a.id === form.damId)) list.unshift({ id: form.damId, name: editing.damName || '-' })
    return list
  }, [animals, editing, form.damId])
  const damSpecies = animals.find(a => a.id === form.damId)?.species
  const sireOptions = useMemo(() => {
    const list = animals.filter(a => alive(a) && a.gender === 'male' && (!damSpecies || !a.species || a.species === damSpecies))
    if (editing && form.sireId && !list.some(a => a.id === form.sireId)) list.unshift({ id: form.sireId, name: editing.sireName || '-' })
    return list
  }, [animals, damSpecies, editing, form.sireId])

  const set = <K extends keyof BreedingForm>(key: K, value: BreedingForm[K]) => setForm(f => ({ ...f, [key]: value }))

  const close = () => { setShowForm(false); setEditing(null); setStep(0); save.reset() }
  const openNew = () => { setForm(emptyForm()); setEditing(null); setStep(0); save.reset(); setShowForm(true) }
  const openEdit = (rec: BreedingRecord) => {
    setEditing(rec); setStep(0); save.reset()
    setForm({
      damId: rec.damId, sireId: rec.sireId || '', breedingDate: rec.breedingDate?.split('T')[0] || '',
      breedingMethod: rec.breedingMethod || 'natural', status: rec.status,
      offspringCount: rec.offspringCount?.toString() || '', liveOffspring: rec.liveOffspring?.toString() || '',
      stillborn: rec.stillborn?.toString() || '', notes: rec.notes || '',
    })
    setShowForm(true)
  }

  const save = useSaveAction(async () => {
    const num = (v: string) => (v !== '' && !Number.isNaN(parseInt(v, 10)) ? parseInt(v, 10) : undefined)
    const birthFigures = BIRTH_STATUSES.includes(form.status)
    const payload: Record<string, unknown> = {
      enterpriseId: selectedEnterpriseId, damId: form.damId, sireId: form.sireId || undefined,
      breedingDate: form.breedingDate, breedingMethod: form.breedingMethod, status: form.status,
      notes: form.notes || undefined,
      offspringCount: birthFigures ? num(form.offspringCount) : undefined,
      liveOffspring: birthFigures ? num(form.liveOffspring) : undefined,
      stillborn: birthFigures ? num(form.stillborn) : undefined,
    }
    if (editing) await apiService.updateBreedingRecord(editing.id, payload)
    else await apiService.createBreedingRecord(selectedEnterpriseId, payload)
  }, t('breedingManager.toasts.failed'))

  const submit = async () => {
    setSuccessMsg('')
    const wasEditing = !!editing
    if (await save.run()) {
      close()
      setSuccessMsg(t(wasEditing ? 'breedingManager.toasts.updated' : 'breedingManager.toasts.created'))
      void fetchData()
    }
  }

  const steps: FormStep[] = [
    {
      id: 'who', title: t('breedingManager.steps.who'),
      blockedReason: form.damId ? undefined : t('breedingManager.blocked.dam'),
      content: (
        <>
          <div className="breeding-field">
            <label htmlFor="breeding-dam">{t('breedingManager.modal.dam')}</label>
            <select id="breeding-dam" className="an-field" value={form.damId} onChange={e => { set('damId', e.target.value); set('sireId', '') }}>
              <option value="">{t('breedingManager.modal.damPlaceholder')}</option>
              {damOptions.map(a => <option key={a.id} value={a.id}>{label(a)}</option>)}
            </select>
            {damOptions.length === 0 && <p className="breeding-hint" role="status">{t('breedingManager.noFemales')}</p>}
          </div>
          <div className="breeding-field">
            <label htmlFor="breeding-sire">{t('breedingManager.modal.sire')}</label>
            <select id="breeding-sire" className="an-field" value={form.sireId} onChange={e => set('sireId', e.target.value)}>
              <option value="">{t('breedingManager.modal.sirePlaceholder')}</option>
              {sireOptions.map(a => <option key={a.id} value={a.id}>{label(a)}</option>)}
            </select>
          </div>
        </>
      ),
    },
    {
      id: 'when', title: t('breedingManager.steps.when'),
      blockedReason: form.breedingDate ? undefined : t('breedingManager.blocked.date'),
      content: (
        <>
          <DateQuick label={t('breedingManager.modal.breedingDate')} value={form.breedingDate} onChange={d => set('breedingDate', d)} />
          <ChipSelect label={t('breedingManager.modal.method')} options={METHODS.map(m => ({ value: m, label: t('breedingManager.methods.' + m) }))}
            value={form.breedingMethod} onChange={v => set('breedingMethod', v)} />
        </>
      ),
    },
    {
      id: 'result', title: t('breedingManager.steps.result'),
      content: (
        <>
          <ChipSelect label={t('breedingManager.modal.status')} options={STATUSES.map(s => ({ value: s, label: t('breedingManager.statuses.' + s) }))}
            value={form.status} onChange={v => set('status', v)} />
          {BIRTH_STATUSES.includes(form.status) && (
            <>
              <NumberStepper label={t('breedingManager.modal.offspringCount')} value={form.offspringCount} onChange={v => set('offspringCount', v)} integer min={0} />
              <NumberStepper label={t('breedingManager.modal.liveOffspring')} value={form.liveOffspring} onChange={v => set('liveOffspring', v)} integer min={0} />
              <NumberStepper label={t('breedingManager.modal.stillborn')} value={form.stillborn} onChange={v => set('stillborn', v)} integer min={0} />
            </>
          )}
          <div className="breeding-field">
            <label htmlFor="breeding-notes">{t('breedingManager.modal.notes')}</label>
            <textarea id="breeding-notes" rows={2} className="an-field an-field--textarea" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </>
      ),
    },
  ]

  const statusBadge = (s?: string) => (s ? <span className={`breeding-status breeding-status--${s}`}>{t('breedingManager.statuses.' + s)}</span> : null)

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>{t('breedingManager.pageTitle')}</h1>
        <p>{t('breedingManager.subtitle')}</p>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {successMsg && <div className="alert alert-success" role="status">{successMsg}</div>}

      <div className="enterprise-selector">
        <label htmlFor="breeding-farm">{t('breedingManager.selectEnterprise')}</label>
        <select id="breeding-farm" value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)}>
          <option value="">{t('breedingManager.selectDefault')}</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {selectedEnterpriseId && (
        <>
          <div className="tab-bar">
            <button className={`tab-btn ${tab === 'records' ? 'active' : ''}`} onClick={() => setTab('records')}>{t('breedingManager.tabs.records')}</button>
            <button className={`tab-btn ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>{t('breedingManager.tabs.upcomingDue')} ({upcomingDue.length})</button>
            <button className={`tab-btn ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>{t('breedingManager.tabs.statistics')}</button>
            <button className="btn btn-primary" onClick={openNew}>{t('breedingManager.newRecord')}</button>
          </div>

          {showForm && (
            <div className="edit-form-overlay" onClick={close}>
              <div className="edit-form-panel edit-form-modal" onClick={e => e.stopPropagation()}>
                <button className="edit-form-close" onClick={close} aria-label={t('mobileUi.close')}>✕</button>
                <h2>{editing ? t('breedingManager.modal.editTitle') : t('breedingManager.modal.createTitle')}</h2>
                <StepForm
                  steps={steps} current={step} onStepChange={setStep} onSubmit={submit}
                  submitLabel={editing ? t('breedingManager.modal.updateBtn') : t('breedingManager.modal.createBtn')}
                  busy={save.status === 'saving'} onCancel={close}
                  saveNowLabel={editing ? t('farmProfile.form.saveNow') : undefined}
                  footer={<SaveState status={save.status} error={save.error} offline={save.offline} onRetry={save.retry} />}
                />
              </div>
            </div>
          )}

          {loading ? <p className="loading-text">{t('breedingManager.loading')}</p> : tab === 'records' ? (
            <div className="card full-width">
              <h3>{t('breedingManager.recordsTable.title')}</h3>
              {records.length === 0 ? <p className="empty-text">{t('breedingManager.recordsTable.empty')}</p> : (
                <ul className="breeding-list">
                  {records.map(r => (
                    <li key={r.id} className="breeding-card">
                      <div className="breeding-card-head">
                        <strong className="breeding-card-name">{r.damName || '-'}</strong>
                        {statusBadge(r.status)}
                      </div>
                      <dl className="breeding-facts">
                        <div><dt>{t('breedingManager.recordsTable.headers.sire')}</dt><dd>{r.sireName || '-'}</dd></div>
                        <div><dt>{t('breedingManager.recordsTable.headers.date')}</dt><dd>{day(r.breedingDate)}</dd></div>
                        <div><dt>{t('breedingManager.recordsTable.headers.method')}</dt><dd>{r.breedingMethod ? t('breedingManager.methods.' + r.breedingMethod) : '-'}</dd></div>
                        <div><dt>{t('breedingManager.recordsTable.headers.dueDate')}</dt><dd>{day(r.expectedDueDate)}</dd></div>
                        {(r.offspringCount != null || r.liveOffspring != null) && (
                          <div><dt>{t('breedingManager.recordsTable.headers.offspring')}</dt><dd>{r.liveOffspring ?? '-'} / {r.offspringCount ?? '-'}</dd></div>
                        )}
                      </dl>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(r)}>{t('breedingManager.editBtn')}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : tab === 'upcoming' ? (
            <div className="card full-width">
              <h3>{t('breedingManager.upcomingDue.title')}</h3>
              {upcomingDue.length === 0 ? <p className="empty-text">{t('breedingManager.upcomingDue.empty')}</p> : (
                <ul className="breeding-list">
                  {upcomingDue.map(r => {
                    const daysLeft = r.expectedDueDate ? Math.ceil((new Date(r.expectedDueDate).getTime() - Date.now()) / 86400000) : null
                    const urgency = daysLeft != null && daysLeft <= 7 ? 'badge-danger' : daysLeft != null && daysLeft <= 14 ? 'badge-warning' : ''
                    return (
                      <li key={r.id} className="breeding-card">
                        <div className="breeding-card-head">
                          <strong className="breeding-card-name">{r.damName || '-'}</strong>
                          <span className={`badge ${urgency}`}>{daysLeft ?? '?'} {t('breedingManager.upcomingDue.dayUnit')}</span>
                        </div>
                        <dl className="breeding-facts">
                          <div><dt>{t('breedingManager.upcomingDue.headers.expectedDue')}</dt><dd>{day(r.expectedDueDate)}</dd></div>
                          <div><dt>{t('breedingManager.upcomingDue.headers.status')}</dt><dd>{r.status ? t('breedingManager.statuses.' + r.status) : '-'}</dd></div>
                          <div><dt>{t('breedingManager.upcomingDue.headers.method')}</dt><dd>{r.breedingMethod ? t('breedingManager.methods.' + r.breedingMethod) : '-'}</dd></div>
                        </dl>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : tab === 'stats' && stats ? (
            <div className="dashboard-grid">
              <div className="card"><h3>{t('breedingManager.statistics.totalRecords')}</h3><div className="big-stat">{stats.total}</div></div>
              <div className="card"><h3>{t('breedingManager.statistics.currentlyBred')}</h3><div className="big-stat">{stats.bred}</div></div>
              <div className="card"><h3>{t('breedingManager.statistics.confirmedPregnant')}</h3><div className="big-stat">{stats.confirmed}</div></div>
              <div className="card"><h3>{t('breedingManager.statistics.delivered')}</h3><div className="big-stat">{stats.delivered}</div></div>
              <div className="card"><h3>{t('breedingManager.statistics.liveBirths')}</h3><div className="big-stat success">{stats.live_births}</div></div>
              <div className="card"><h3>{t('breedingManager.statistics.stillbirths')}</h3><div className="big-stat danger">{stats.stillbirths}</div></div>
              <div className="card"><h3>{t('breedingManager.statistics.avgGestation')}</h3><div className="big-stat">{stats.avgGestation ? Number(stats.avgGestation).toFixed(0) : '-'}</div></div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default BreedingManager
