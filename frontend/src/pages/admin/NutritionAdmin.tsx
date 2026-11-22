import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useMasterData } from '../../context/MasterDataContext'
import { useNutritionEnabled } from '../../hooks/useNutritionEnabled'
import { useSaveAction } from '../../hooks/useSaveAction'
import { userMessage } from '../../utils/userMessage'
import { BottomSheet } from '../../components/mobile/BottomSheet'
import { ChipSelect } from '../../components/mobile/ChipSelect'
import { SaveState } from '../../components/mobile/SaveState'

type Tab = 'species' | 'factors' | 'foods' | 'unsafe' | 'sets' | 'curves' | 'usage'
const MODELS = ['companion_energy', 'ruminant_dm', 'monogastric_spec', 'aqua_biomass', 'equine_dm', 'guidance_only'] as const
const STATUSES = ['unvalidated', 'owner_approved', 'vet_validated', 'retired'] as const
const FOOD_KINDS = ['commercial_food', 'home_food', 'treat', 'forage', 'concentrate', 'mineral', 'supplement', 'compound_feed', 'aqua_feed'] as const
const BASES = ['per_1000kcal', 'per_kg_dm', 'percent_dm', 'per_day', 'per_kg_bw075', 'percent_bw', 'fraction', 'percent_milk'] as const
const LOCALES = [['labelHi', 'हिन्दी'], ['labelKn', 'ಕನ್ನಡ'], ['labelMl', 'മലയാളം'], ['labelTa', 'தமிழ்'], ['labelTe', 'తెలుగు']] as const

/**
 * Nutrition master data (admin). Everything the engine reads is data here, with its source, licence and status -
 * so the owner's vet can validate it later by flipping a status, and a licensed table (FEDIAF, NRC, NASEM, ICAR)
 * can be loaded without a code change (docs/NUTRITION_PLAN.md §12.1).
 */
const NutritionAdmin: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { enabled, loading } = useNutritionEnabled(!!user)
  const [tab, setTab] = useState<Tab>('species')
  const [refresh, setRefresh] = useState(0)

  if (loading) return <div className="module-page nutri-page"><div className="loading-spinner">{t('nutrition.loading')}</div></div>
  if (!enabled) {
    return (
      <div className="module-page nutri-page">
        <div className="empty-state">
          <div className="empty-icon">🥣</div>
          <h2>{t('nutrition.off.title')}</h2>
          <p>{t('nutrition.admin.offBody')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page nutri-page">
      <div className="module-header">
        <h1>{t('nutrition.admin.title')}</h1>
        <p className="subtitle">{t('nutrition.admin.subtitle')}</p>
      </div>
      <ChipSelect label={t('nutrition.admin.section')} value={tab} onChange={setTab} options={[
        { value: 'species', label: t('nutrition.admin.tabs.species') },
        { value: 'factors', label: t('nutrition.admin.tabs.factors') },
        { value: 'foods', label: t('nutrition.admin.tabs.foods') },
        { value: 'unsafe', label: t('nutrition.admin.tabs.unsafe') },
        { value: 'sets', label: t('nutrition.admin.tabs.sets') },
        { value: 'curves', label: t('nutrition.admin.tabs.curves') },
        { value: 'usage', label: t('nutrition.admin.tabs.usage') },
      ]} />
      <ApprovePending onDone={() => setRefresh(n => n + 1)} />
      <div key={refresh}>
        {tab === 'species' && <SpeciesModels />}
        {tab === 'curves' && <Curves />}
        {tab === 'factors' && <EnergyFactors />}
        {tab === 'foods' && <Foods />}
        {tab === 'unsafe' && <UnsafeFoods />}
        {tab === 'sets' && <RequirementSets />}
        {tab === 'usage' && <Usage />}
      </div>
    </div>
  )
}

// ─── Shared bits ─────────────────────────────────────────────────────────────

function useList<T>(fetcher: () => Promise<any>, pick: (res: any) => T[]) {
  const [items, setItems] = useState<T[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const reload = useCallback(() => {
    setLoading(true)
    fetcher().then(res => { setItems(pick(res)); setError('') })
      .catch(err => setError(userMessage(err, 'nutrition.errors.adminLoad')))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload() }, [reload])
  return { items, error, loading, reload }
}

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation()
  return <span className={`nutri-pill status-${status}`}>{t(`nutrition.admin.status.${status}`)}</span>
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="nutri-field"><span className="nutri-field-label">{label}</span>{children}</label>
)

// ─── Species -> model ────────────────────────────────────────────────────────

const SpeciesModels: React.FC = () => {
  const { t } = useTranslation()
  const { speciesLabel } = useMasterData()
  const list = useList<any>(() => apiService.nutritionAdminList('species'), r => r?.data?.items || [])
  const [search, setSearch] = useState('')
  const [rowError, setRowError] = useState('')
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? list.items.filter(s => `${s.code} ${s.label} ${s.category || ''}`.toLowerCase().includes(q)) : list.items
  }, [list.items, search])
  const change = async (code: string, model: string) => {
    try { await apiService.nutritionAdminSetSpeciesModel(code, model); setRowError(''); list.reload() } catch (err) { setRowError(userMessage(err, 'nutrition.errors.adminSave')) }
  }
  return (
    <section className="nutri-card">
      <p className="nutri-hint">{t('nutrition.admin.speciesHelp')}</p>
      <input className="search-input" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('nutrition.admin.searchSpecies')} aria-label={t('nutrition.admin.searchSpecies')} />
      {(list.error || rowError) && <div className="alert alert-error" role="alert">{list.error || rowError}</div>}
      {list.loading && <div className="loading-spinner">{t('nutrition.loading')}</div>}
      <ul className="nutri-list">
        {shown.map(s => (
          <li key={s.code} className="nutri-list-row">
            <span className="nutri-list-main"><span aria-hidden="true">{s.icon}</span> <strong>{speciesLabel(s.code, t)}</strong></span>
            <span className="nutri-list-meta">{s.category}</span>
            <select className="form-input nutri-select" value={s.nutritionModel} aria-label={t('nutrition.admin.modelFor', { species: s.label })} onChange={e => { void change(s.code, e.target.value) }}>
              {MODELS.map(m => <option key={m} value={m}>{t(`nutrition.modelNames.${m}`)}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ─── Energy factors ──────────────────────────────────────────────────────────

const EnergyFactors: React.FC = () => {
  const { t } = useTranslation()
  const list = useList<any>(() => apiService.nutritionAdminList('energy-factors'), r => r?.data?.items || [])
  const [editing, setEditing] = useState<any | null>(null)
  return (
    <section className="nutri-card">
      <div className="nutri-card-head">
        <p className="nutri-hint">{t('nutrition.admin.factorsHelp')}</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({ speciesCode: '', factorKey: '', factor: '', source: '', status: 'unvalidated' })}>{t('nutrition.admin.add')}</button>
      </div>
      {list.error && <div className="alert alert-error" role="alert">{list.error}</div>}
      <ul className="nutri-list">
        {list.items.map(f => (
          <li key={f.id} className="nutri-list-row">
            <span className="nutri-list-main"><strong>{f.speciesCode}</strong> · {t(`nutrition.factorKeys.${f.factorKey}`, { defaultValue: f.factorKey })} · ×{f.factor}</span>
            <span className="nutri-list-meta">{f.source}{f.validatedByName ? ` · ${t('nutrition.admin.validatedBy', { name: f.validatedByName })}` : ''}</span>
            <StatusPill status={f.status} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing({ ...f, factor: String(f.factor) })}>{t('nutrition.admin.edit')}</button>
          </li>
        ))}
      </ul>
      {editing && (
        <EditSheet title={editing.id ? t('nutrition.admin.editFactor') : t('nutrition.admin.addFactor')} onClose={() => setEditing(null)}
          onSave={() => apiService.nutritionAdminSave('energy-factors', editing.id || null, editing.id
            ? { factor: Number(editing.factor), source: editing.source, status: editing.status }
            : { speciesCode: editing.speciesCode, factorKey: editing.factorKey, factor: Number(editing.factor), source: editing.source, status: editing.status })}
          onSaved={() => { setEditing(null); list.reload() }}>
          {!editing.id && (
            <>
              <Field label={t('nutrition.admin.species')}><input className="form-input" value={editing.speciesCode} onChange={e => setEditing({ ...editing, speciesCode: e.target.value })} /></Field>
              <Field label={t('nutrition.admin.factorKey')}><input className="form-input" value={editing.factorKey} onChange={e => setEditing({ ...editing, factorKey: e.target.value })} /></Field>
            </>
          )}
          <Field label={t('nutrition.admin.factor')}><input className="form-input" type="number" inputMode="decimal" step="0.1" min="0.1" max="10" value={editing.factor} onChange={e => setEditing({ ...editing, factor: e.target.value })} /></Field>
          <Field label={t('nutrition.admin.source')}><input className="form-input" value={editing.source} onChange={e => setEditing({ ...editing, source: e.target.value })} /></Field>
          <StatusChips value={editing.status} onChange={v => setEditing({ ...editing, status: v })} />
        </EditSheet>
      )}
    </section>
  )
}

const StatusChips: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const { t } = useTranslation()
  return <ChipSelect label={t('nutrition.admin.statusLabel')} value={value} onChange={onChange} options={STATUSES.map(s => ({ value: s, label: t(`nutrition.admin.status.${s}`) }))} />
}

/** One edit sheet for every master-data form: save, show the server's own words on failure, keep the form filled. */
const EditSheet: React.FC<{ title: string; onClose: () => void; onSave: () => Promise<unknown>; onSaved: () => void; children: React.ReactNode }> = ({ title, onClose, onSave, onSaved, children }) => {
  const { t } = useTranslation()
  const save = useSaveAction(onSave, t('nutrition.errors.adminSave'))
  return (
    <BottomSheet open title={title} onClose={onClose}>
      <div className="record-sheet">
        {children}
        <SaveState status={save.status} error={save.error} offline={save.offline} onRetry={save.retry} />
        <div className="record-sheet-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={save.status === 'saving'} onClick={async () => { if (await save.run()) onSaved() }}>{t('common.save')}</button>
        </div>
      </div>
    </BottomSheet>
  )
}

const LocaleLabelFields: React.FC<{ value: any; onChange: (v: any) => void }> = ({ value, onChange }) => {
  const { t } = useTranslation()
  return (
    <details className="nutri-details">
      <summary>{t('nutrition.admin.otherLanguages')}</summary>
      {LOCALES.map(([key, name]) => (
        <Field key={key} label={name}><input className="form-input" maxLength={200} value={value[key] || ''} onChange={e => onChange({ ...value, [key]: e.target.value })} /></Field>
      ))}
    </details>
  )
}

// ─── Foods ───────────────────────────────────────────────────────────────────

const Foods: React.FC = () => {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<any | null>(null)
  const load = useCallback(() => {
    apiService.nutritionAdminFoods({ search: search.trim() || undefined, limit: 100 })
      .then((res: any) => { setItems(res?.data?.items || []); setTotal(res?.data?.total || 0); setError('') })
      .catch(err => setError(userMessage(err, 'nutrition.errors.adminLoad')))
  }, [search])
  useEffect(() => { const timer = window.setTimeout(load, 300); return () => window.clearTimeout(timer) }, [load])
  return (
    <section className="nutri-card">
      <div className="nutri-card-head">
        <input className="search-input" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('nutrition.admin.searchFoods')} aria-label={t('nutrition.admin.searchFoods')} />
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({ label: '', kind: 'home_food', models: ['companion_energy'], kcalPer100g: '', source: '', status: 'unvalidated', isActive: true })}>{t('nutrition.admin.add')}</button>
      </div>
      <p className="nutri-list-meta">{t('nutrition.admin.count', { shown: items.length, total })}</p>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <ul className="nutri-list">
        {items.map(f => (
          <li key={f.id} className="nutri-list-row">
            <span className="nutri-list-main"><strong>{f.label}</strong>{!f.isActive && ` · ${t('nutrition.admin.inactive')}`}</span>
            <span className="nutri-list-meta">{t(`nutrition.foodKinds.${f.kind}`)} · {f.kcalPer100g !== null ? t('nutrition.plan.kcalValue', { kcal: f.kcalPer100g }) : t('nutrition.plan.kcalUnknown')}</span>
            <StatusPill status={f.status} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing({ ...f, kcalPer100g: f.kcalPer100g ?? '' })}>{t('nutrition.admin.edit')}</button>
          </li>
        ))}
      </ul>
      {editing && (
        <EditSheet title={editing.id ? t('nutrition.admin.editFood') : t('nutrition.admin.addFood')} onClose={() => setEditing(null)}
          onSave={() => apiService.nutritionAdminSave('foods', editing.id || null, {
            label: editing.label, labelHi: editing.labelHi, labelKn: editing.labelKn, labelMl: editing.labelMl, labelTa: editing.labelTa, labelTe: editing.labelTe,
            kind: editing.kind, models: editing.models, kcalPer100g: editing.kcalPer100g === '' ? null : Number(editing.kcalPer100g),
            source: editing.source, licence: editing.licence, status: editing.status, ...(editing.id ? { isActive: editing.isActive } : {}),
          })}
          onSaved={() => { setEditing(null); load() }}>
          <Field label={t('nutrition.admin.name')}><input className="form-input" maxLength={200} value={editing.label} onChange={e => setEditing({ ...editing, label: e.target.value })} /></Field>
          <LocaleLabelFields value={editing} onChange={setEditing} />
          <Field label={t('nutrition.admin.kind')}>
            <select className="form-input" value={editing.kind} onChange={e => setEditing({ ...editing, kind: e.target.value })}>
              {FOOD_KINDS.map(k => <option key={k} value={k}>{t(`nutrition.foodKinds.${k}`)}</option>)}
            </select>
          </Field>
          <fieldset className="nutri-fieldset">
            <legend className="nutri-field-label">{t('nutrition.admin.usedFor')}</legend>
            {MODELS.map(m => (
              <label key={m} className="nutri-check">
                <input type="checkbox" checked={(editing.models || []).includes(m)}
                  onChange={e => setEditing({ ...editing, models: e.target.checked ? [...(editing.models || []), m] : (editing.models || []).filter((x: string) => x !== m) })} />
                <span>{t(`nutrition.modelNames.${m}`)}</span>
              </label>
            ))}
          </fieldset>
          <Field label={t('nutrition.plan.kcalPer100g')}><input className="form-input" type="number" inputMode="decimal" min="0" max="1000" value={editing.kcalPer100g} onChange={e => setEditing({ ...editing, kcalPer100g: e.target.value })} /></Field>
          <Field label={t('nutrition.admin.source')}><input className="form-input" value={editing.source || ''} onChange={e => setEditing({ ...editing, source: e.target.value })} /></Field>
          <Field label={t('nutrition.admin.licence')}><input className="form-input" value={editing.licence || ''} onChange={e => setEditing({ ...editing, licence: e.target.value })} /></Field>
          <StatusChips value={editing.status} onChange={v => setEditing({ ...editing, status: v })} />
          {editing.id && (
            <label className="nutri-check"><input type="checkbox" checked={!!editing.isActive} onChange={e => setEditing({ ...editing, isActive: e.target.checked })} /><span>{t('nutrition.admin.active')}</span></label>
          )}
        </EditSheet>
      )}
    </section>
  )
}

// ─── Unsafe foods ────────────────────────────────────────────────────────────

const UnsafeFoods: React.FC = () => {
  const { t } = useTranslation()
  const list = useList<any>(() => apiService.nutritionAdminList('unsafe-foods'), r => r?.data?.items || [])
  const [editing, setEditing] = useState<any | null>(null)
  return (
    <section className="nutri-card">
      <div className="nutri-card-head">
        <p className="nutri-hint">{t('nutrition.admin.unsafeHelp')}</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({ code: '', speciesCode: '', label: '', matchTerms: '', severity: 'danger', source: '', status: 'unvalidated', isActive: true })}>{t('nutrition.admin.add')}</button>
      </div>
      {list.error && <div className="alert alert-error" role="alert">{list.error}</div>}
      <ul className="nutri-list">
        {list.items.map(u => (
          <li key={u.id} className="nutri-list-row">
            <span className="nutri-list-main"><strong>{u.speciesCode}</strong> · {u.label}{!u.isActive && ` · ${t('nutrition.admin.inactive')}`}</span>
            <span className="nutri-list-meta">{t(`nutrition.admin.severity.${u.severity}`)} · {(u.matchTerms || []).join(', ')}</span>
            <StatusPill status={u.status} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing({ ...u, matchTerms: (u.matchTerms || []).join(', ') })}>{t('nutrition.admin.edit')}</button>
          </li>
        ))}
      </ul>
      {editing && (
        <EditSheet title={editing.id ? t('nutrition.admin.editUnsafe') : t('nutrition.admin.addUnsafe')} onClose={() => setEditing(null)}
          onSave={() => apiService.nutritionAdminSave('unsafe-foods', editing.id || null, {
            ...(editing.id ? {} : { code: editing.code, speciesCode: editing.speciesCode }),
            label: editing.label, labelHi: editing.labelHi, labelKn: editing.labelKn, labelMl: editing.labelMl, labelTa: editing.labelTa, labelTe: editing.labelTe,
            matchTerms: String(editing.matchTerms || '').split(',').map((s: string) => s.trim()).filter(Boolean),
            severity: editing.severity, source: editing.source, status: editing.status, ...(editing.id ? { isActive: editing.isActive } : {}),
          })}
          onSaved={() => { setEditing(null); list.reload() }}>
          {!editing.id && (
            <>
              <Field label={t('nutrition.admin.code')}><input className="form-input" value={editing.code} onChange={e => setEditing({ ...editing, code: e.target.value })} /></Field>
              <Field label={t('nutrition.admin.species')}><input className="form-input" value={editing.speciesCode} onChange={e => setEditing({ ...editing, speciesCode: e.target.value })} /></Field>
            </>
          )}
          <Field label={t('nutrition.admin.name')}><input className="form-input" maxLength={200} value={editing.label} onChange={e => setEditing({ ...editing, label: e.target.value })} /></Field>
          <LocaleLabelFields value={editing} onChange={setEditing} />
          <Field label={t('nutrition.admin.matchTerms')}><input className="form-input" value={editing.matchTerms} onChange={e => setEditing({ ...editing, matchTerms: e.target.value })} /></Field>
          <ChipSelect label={t('nutrition.admin.severityLabel')} variant="segmented" value={editing.severity} onChange={v => setEditing({ ...editing, severity: v })}
            options={[{ value: 'danger', label: t('nutrition.admin.severity.danger') }, { value: 'caution', label: t('nutrition.admin.severity.caution') }]} />
          <Field label={t('nutrition.admin.source')}><input className="form-input" value={editing.source} onChange={e => setEditing({ ...editing, source: e.target.value })} /></Field>
          <StatusChips value={editing.status} onChange={v => setEditing({ ...editing, status: v })} />
          {editing.id && (
            <label className="nutri-check"><input type="checkbox" checked={!!editing.isActive} onChange={e => setEditing({ ...editing, isActive: e.target.checked })} /><span>{t('nutrition.admin.active')}</span></label>
          )}
        </EditSheet>
      )}
    </section>
  )
}

// ─── Requirement sets ────────────────────────────────────────────────────────

const RequirementSets: React.FC = () => {
  const { t } = useTranslation()
  const list = useList<any>(() => apiService.nutritionAdminList('requirement-sets'), r => r?.data?.items || [])
  const [editing, setEditing] = useState<any | null>(null)
  const [error, setError] = useState('')
  const open = async (id: string) => {
    try { const res: any = await apiService.nutritionAdminRequirementSet(id); setEditing(res?.data); setError('') } catch (err) { setError(userMessage(err, 'nutrition.errors.adminLoad')) }
  }
  const setRow = (i: number, patch: any) => setEditing({ ...editing, requirements: editing.requirements.map((r: any, k: number) => (k === i ? { ...r, ...patch } : r)) })
  const num = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v))
  return (
    <section className="nutri-card">
      <div className="nutri-card-head">
        <p className="nutri-hint">{t('nutrition.admin.setsHelp')}</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({ code: '', nutritionModel: 'companion_energy', speciesCode: '', lifeStage: '', title: '', source: '', sourceUrl: '', licence: '', status: 'unvalidated', requirements: [] })}>{t('nutrition.admin.add')}</button>
      </div>
      {(list.error || error) && <div className="alert alert-error" role="alert">{list.error || error}</div>}
      {list.items.length === 0 && !list.loading && <p className="nutri-empty">{t('nutrition.admin.setsEmpty')}</p>}
      <ul className="nutri-list">
        {list.items.map(s => (
          <li key={s.id} className="nutri-list-row">
            <span className="nutri-list-main"><strong>{s.title}</strong></span>
            <span className="nutri-list-meta">{t(`nutrition.modelNames.${s.nutritionModel}`)}{s.speciesCode ? ` · ${s.speciesCode}` : ''} · v{s.version} · {t('nutrition.admin.rows', { count: s.rows || 0 })}</span>
            <StatusPill status={s.status} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { void open(s.id) }}>{t('nutrition.admin.edit')}</button>
          </li>
        ))}
      </ul>
      {editing && (
        <EditSheet title={editing.id ? t('nutrition.admin.editSet') : t('nutrition.admin.addSet')} onClose={() => setEditing(null)}
          onSave={() => apiService.nutritionAdminSave('requirement-sets', editing.id || null, {
            ...(editing.id ? {} : { code: editing.code }),
            nutritionModel: editing.nutritionModel, speciesCode: editing.speciesCode || null, lifeStage: editing.lifeStage || null,
            title: editing.title, source: editing.source, sourceUrl: editing.sourceUrl || null, licence: editing.licence || null, status: editing.status,
            requirements: editing.requirements.map((r: any) => ({ nutrient: r.nutrient, basis: r.basis, minValue: num(r.minValue), maxValue: num(r.maxValue), unit: r.unit, notes: r.notes || null })),
          })}
          onSaved={() => { setEditing(null); list.reload() }}>
          {!editing.id && <Field label={t('nutrition.admin.code')}><input className="form-input" value={editing.code} onChange={e => setEditing({ ...editing, code: e.target.value })} /></Field>}
          <Field label={t('nutrition.admin.setTitle')}><input className="form-input" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} /></Field>
          <Field label={t('nutrition.admin.model')}>
            <select className="form-input" value={editing.nutritionModel} onChange={e => setEditing({ ...editing, nutritionModel: e.target.value })}>
              {MODELS.map(m => <option key={m} value={m}>{t(`nutrition.modelNames.${m}`)}</option>)}
            </select>
          </Field>
          <Field label={t('nutrition.admin.species')}><input className="form-input" value={editing.speciesCode || ''} onChange={e => setEditing({ ...editing, speciesCode: e.target.value })} /></Field>
          <Field label={t('nutrition.admin.lifeStage')}><input className="form-input" value={editing.lifeStage || ''} onChange={e => setEditing({ ...editing, lifeStage: e.target.value })} /></Field>
          <Field label={t('nutrition.admin.source')}><input className="form-input" value={editing.source} onChange={e => setEditing({ ...editing, source: e.target.value })} /></Field>
          <Field label={t('nutrition.admin.licence')}><input className="form-input" value={editing.licence || ''} onChange={e => setEditing({ ...editing, licence: e.target.value })} /></Field>
          <StatusChips value={editing.status} onChange={v => setEditing({ ...editing, status: v })} />
          <div className="nutri-subsection">
            <h4 className="nutri-sub-title">{t('nutrition.admin.requirements')}</h4>
            {editing.requirements.map((r: any, i: number) => (
              <div key={i} className="nutri-req-row">
                <input className="form-input" aria-label={t('nutrition.admin.nutrient')} placeholder={t('nutrition.admin.nutrient')} value={r.nutrient} onChange={e => setRow(i, { nutrient: e.target.value })} />
                <select className="form-input" aria-label={t('nutrition.admin.basis')} value={r.basis} onChange={e => setRow(i, { basis: e.target.value })}>
                  {BASES.map(b => <option key={b} value={b}>{t(`nutrition.admin.bases.${b}`)}</option>)}
                </select>
                <input className="form-input" type="number" inputMode="decimal" aria-label={t('nutrition.admin.min')} placeholder={t('nutrition.admin.min')} value={r.minValue ?? ''} onChange={e => setRow(i, { minValue: e.target.value })} />
                <input className="form-input" type="number" inputMode="decimal" aria-label={t('nutrition.admin.max')} placeholder={t('nutrition.admin.max')} value={r.maxValue ?? ''} onChange={e => setRow(i, { maxValue: e.target.value })} />
                <input className="form-input" aria-label={t('nutrition.admin.unit')} placeholder={t('nutrition.admin.unit')} value={r.unit} onChange={e => setRow(i, { unit: e.target.value })} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing({ ...editing, requirements: editing.requirements.filter((_: any, k: number) => k !== i) })} aria-label={t('nutrition.plan.remove')}>✕</button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing({ ...editing, requirements: [...editing.requirements, { nutrient: '', basis: 'per_1000kcal', minValue: '', maxValue: '', unit: 'g' }] })}>{t('nutrition.admin.addRow')}</button>
          </div>
        </EditSheet>
      )}
    </section>
  )
}

// ─── Approve everything pending (owner decision 2026-11-22: approve now, vet review later) ─────

const ApprovePending: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { t } = useTranslation()
  const [result, setResult] = useState('')
  const save = useSaveAction(async () => {
    const res: any = await apiService.nutritionAdminApprovePending()
    const total = Object.values(res?.data || {}).reduce((s: number, n: any) => s + Number(n || 0), 0)
    setResult(t('nutrition.admin.approvedCount', { count: total }))
    onDone()
  }, t('nutrition.errors.adminSave'))
  return (
    <div className="nutri-card-head">
      <p className="nutri-hint">{t('nutrition.admin.approveHelp')}</p>
      <button type="button" className="btn btn-secondary btn-sm" disabled={save.status === 'saving'} onClick={() => { void save.run() }}>
        ✅ {t('nutrition.admin.approveAll')}
      </button>
      {save.status === 'failed' && <p className="nutri-note is-warning" role="status">{save.error}</p>}
      {result && save.status === 'saved' && <p className="nutri-hint" role="status">{result}</p>}
    </div>
  )
}

// ─── Feeding curves (flocks, pig batches, ponds) ─────────────────────────────

const Curves: React.FC = () => {
  const { t } = useTranslation()
  const list = useList<any>(() => apiService.nutritionAdminCurves(), r => r?.data?.items || [])
  const [editing, setEditing] = useState<any | null>(null)
  const band = (c: any) => (c.basis === 'per_head'
    ? t('nutrition.admin.curveAge', { from: c.ageFromDays, to: c.ageToDays })
    : t('nutrition.admin.curveWeight', { from: c.weightFromG, to: c.weightToG }))
  const value = (c: any) => (c.basis === 'per_head'
    ? t('nutrition.admin.curvePerHead', { g: c.gramsPerHeadDay })
    : t('nutrition.admin.curveRate', { pct: c.ratePctBiomass }))
  return (
    <section className="nutri-card">
      <p className="nutri-hint">{t('nutrition.admin.curvesHelp')}</p>
      {list.error && <div className="alert alert-error" role="alert">{list.error}</div>}
      <ul className="nutri-list">
        {list.items.map(c => (
          <li key={c.id} className="nutri-list-row">
            <span className="nutri-list-main"><strong>{c.title}</strong> · {band(c)}</span>
            <span className="nutri-list-meta">{value(c)}{c.feedType ? ` · ${c.feedType}` : ''}</span>
            <StatusPill status={c.status} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing({ ...c })}>{t('nutrition.admin.edit')}</button>
          </li>
        ))}
      </ul>
      {editing && (
        <EditSheet title={`${editing.title} · ${band(editing)}`} onClose={() => setEditing(null)}
          onSave={() => apiService.nutritionAdminSaveCurve(editing.id, editing.basis === 'per_head'
            ? { gramsPerHeadDay: Number(editing.gramsPerHeadDay), feedType: editing.feedType || null, status: editing.status }
            : { ratePctBiomass: Number(editing.ratePctBiomass), feedType: editing.feedType || null, status: editing.status })}
          onSaved={() => { setEditing(null); list.reload() }}>
          {editing.basis === 'per_head'
            ? <Field label={t('nutrition.admin.gramsPerHead')}><input className="form-input" type="number" inputMode="decimal" min="0" value={editing.gramsPerHeadDay ?? ''} onChange={e => setEditing({ ...editing, gramsPerHeadDay: e.target.value })} /></Field>
            : <Field label={t('nutrition.admin.ratePct')}><input className="form-input" type="number" inputMode="decimal" min="0" max="30" step="0.1" value={editing.ratePctBiomass ?? ''} onChange={e => setEditing({ ...editing, ratePctBiomass: e.target.value })} /></Field>}
          <Field label={t('nutrition.admin.feedType')}><input className="form-input" maxLength={40} value={editing.feedType || ''} onChange={e => setEditing({ ...editing, feedType: e.target.value })} /></Field>
          <StatusChips value={editing.status} onChange={v => setEditing({ ...editing, status: v })} />
        </EditSheet>
      )}
    </section>
  )
}

// ─── Usage ───────────────────────────────────────────────────────────────────

const Usage: React.FC = () => {
  const { t } = useTranslation()
  const [days, setDays] = useState('30')
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    apiService.nutritionAdminUsage(Number(days))
      .then((res: any) => { setData(res?.data || null); setError('') })
      .catch(err => setError(userMessage(err, 'nutrition.errors.adminLoad')))
  }, [days])
  return (
    <section className="nutri-card">
      <p className="nutri-hint">{t('nutrition.admin.usageHelp')}</p>
      <ChipSelect label={t('nutrition.admin.period')} variant="segmented" value={days} onChange={setDays}
        options={[{ value: '7', label: t('nutrition.admin.days', { count: 7 }) }, { value: '30', label: t('nutrition.admin.days', { count: 30 }) }, { value: '90', label: t('nutrition.admin.days', { count: 90 }) }]} />
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {data && (
        <>
          <p className="nutri-big">{t('nutrition.admin.activeUsers', { count: data.activeUsers })}</p>
          {data.events.length === 0 ? <p className="nutri-empty">{t('nutrition.admin.noUsage')}</p> : (
            <ul className="nutri-list">
              {data.events.map((e: any) => (
                <li key={`${e.event}-${e.role}`} className="nutri-list-row">
                  <span className="nutri-list-main">{t(`nutrition.admin.events.${e.event}`, { defaultValue: e.event })}</span>
                  <span className="nutri-list-meta">{e.role}</span>
                  <strong>{e.count}</strong>
                </li>
              ))}
            </ul>
          )}
          <h4 className="nutri-sub-title">{t('nutrition.admin.activePlans')}</h4>
          <ul className="nutri-list">
            {data.activePlans.map((p: any) => (
              <li key={`${p.model}-${p.validation}`} className="nutri-list-row">
                <span className="nutri-list-main">{t(`nutrition.modelNames.${p.model}`)}</span>
                <span className="nutri-list-meta">{p.validation === 'vet_reviewed' ? t('nutrition.plan.reviewed') : t('nutrition.plan.suggested')}</span>
                <strong>{p.count}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export default NutritionAdmin
