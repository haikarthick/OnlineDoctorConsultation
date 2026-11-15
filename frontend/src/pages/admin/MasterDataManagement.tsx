import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useMasterData } from '../../context/MasterDataContext'
import '../../styles/modules.css'
import './MasterDataManagement.css'
import FarmMasterDataTabs from './masterData/FarmMasterDataTabs'
import { BIRTH_EVENT_TERMS, FARM_SEGMENTS, LOCALE_LABEL_FIELDS, LocaleLabelCols, WATER_TYPES } from './masterData/farmMasterShared'

type TabKey = 'species' | 'breeds' | 'classes' | 'groupTypes' | 'recordTypes' | 'categories' | 'conditions'

interface SpeciesRow {
  id: string; code: string; label: string; labelKey: string | null;
  labelHi: string | null; labelKn: string | null; labelMl: string | null; labelTa: string | null; labelTe: string | null;
  icon: string | null; category: string | null;
  hasEarTag: boolean; sortOrder: number; isActive: boolean; isProtected: boolean; isMarketplaceEligible: boolean
  // Farm profile flags (migration 043)
  farmSegment: string; defaultManagementMode: 'individual' | 'batch'
  producesMilk: boolean; producesEggs: boolean; producesWool: boolean; isAquatic: boolean; litterExpected: boolean
  gestationDays: number | null; incubationDays: number | null; birthEventTerm: string
  scientificName: string | null; waterType: string | null
}

interface BreedRow extends LocaleLabelCols { id: string; speciesId: string; speciesCode?: string; name: string; sortOrder: number; isActive: boolean }
interface ClassRow extends LocaleLabelCols {
  id: string; speciesId: string; speciesCode?: string; value: string; labelKey: string | null; label: string | null;
  impliedGender: 'male' | 'female' | 'unknown'; canBePregnant: boolean; canProduceMilk: boolean
  canLayEggs: boolean; isJuvenile: boolean; sortOrder: number; isActive: boolean
}
interface CategoryRow extends LocaleLabelCols { id: string; code: string; labelKey: string | null; label: string | null; icon: string | null; sortOrder: number; isActive: boolean; isProtected: boolean }
interface ConditionRow extends LocaleLabelCols { id: string; code: string; labelKey: string | null; label: string | null; sortOrder: number; isActive: boolean }

const MasterDataManagement: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { resolveLabel } = useMasterData()

  // Per-locale translators for the 5 non-English languages, so the edit form can
  // show each row's *currently effective* built-in translation (resolved from that
  // language's i18n bundle via label_key) as a placeholder - otherwise seeded rows,
  // whose per-locale override columns are NULL, look empty and admins can't tell what
  // the animal is actually called in Tamil/Hindi/etc. Only 'en' is bundled up front
  // (see i18n/index.ts), so the other bundles are force-loaded once here.
  const [localeReady, setLocaleReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    i18n.loadLanguages(['hi', 'kn', 'ml', 'ta', 'te']).then(() => { if (!cancelled) setLocaleReady(true) }).catch(() => {})
    return () => { cancelled = true }
  }, [i18n])

  const [tab, setTab] = useState<TabKey>('species')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const [speciesRows, setSpeciesRows] = useState<SpeciesRow[]>([])
  const [breedRows, setBreedRows] = useState<BreedRow[]>([])
  const [classRows, setClassRows] = useState<ClassRow[]>([])
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([])
  const [conditionRows, setConditionRows] = useState<ConditionRow[]>([])

  const [scopeSpeciesId, setScopeSpeciesId] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)

  /** The built-in translation the current row displays in `locale`, for use as an input
   *  placeholder. Resolves label_key against that locale's bundle; falls back to the plain
   *  English `label` when there's no key (matching how the app actually renders these). */
  const builtinLabelFor = useCallback((locale: string): string => {
    const key = formData.labelKey as string | null | undefined
    if (key && localeReady) {
      const v = i18n.getFixedT(locale)(key)
      if (v && v !== key) return v
    }
    // Breeds have no labelKey - their English value is `name`.
    return (formData.label as string) || (formData.name as string) || ''
  }, [formData.labelKey, formData.label, formData.name, i18n, localeReady])

  /** The shared per-locale label input block, reused by all five entity forms. */
  const renderLocaleLabelInputs = () => (
    <>
      <p className="module-hint">{t('masterData.perLocaleLabelsHint', 'Optional - add a translation for any language below. Left blank, that language uses the built-in translation (shown greyed inside each box).')}</p>
      {LOCALE_LABEL_FIELDS.map(({ locale, field, col }) => {
        const builtin = builtinLabelFor(locale)
        return (
          <div className="module-form-group" key={field}>
            <label className="module-label">{t(col)}</label>
            <input className="module-input" value={formData[field] || ''}
              placeholder={builtin ? t('masterData.currentlyShowing', 'Currently showing: {{value}}', { value: builtin }) : ''}
              onChange={e => setFormData((f: any) => ({ ...f, [field]: e.target.value }))} />
          </div>
        )
      })}
    </>
  )

  /** Per-locale label values from the current form, for update payloads. */
  const localeLabelsFromForm = () => ({
    labelHi: formData.labelHi, labelKn: formData.labelKn, labelMl: formData.labelMl, labelTa: formData.labelTa, labelTe: formData.labelTe,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (tab === 'species') {
        const res = await apiService.adminListMasterSpecies()
        setSpeciesRows(res.data || [])
      } else if (tab === 'breeds') {
        const res = await apiService.adminListMasterBreeds(scopeSpeciesId || undefined)
        setBreedRows(res.data || [])
      } else if (tab === 'classes') {
        const res = await apiService.adminListMasterAnimalClasses(scopeSpeciesId || undefined)
        setClassRows(res.data || [])
      } else if (tab === 'categories') {
        const res = await apiService.adminListMasterMarketplaceCategories()
        setCategoryRows(res.data || [])
      } else if (tab === 'conditions') {
        const res = await apiService.adminListMasterMarketplaceConditions()
        setConditionRows(res.data || [])
      }
      // groupTypes / recordTypes load their own rows inside FarmMasterDataTabs.
      // Species list is needed by every tab (breeds/classes scoping, species dropdown) - keep it fresh.
      if (tab !== 'species') {
        const sres = await apiService.adminListMasterSpecies()
        setSpeciesRows(sres.data || [])
      }
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || t('common.errorLoading', 'Failed to load'))
    } finally {
      setLoading(false)
    }
  }, [tab, scopeSpeciesId, t])

  useEffect(() => { load() }, [load])

  const clearMessages = () => { setError(''); setSuccess('') }

  const openAdd = () => {
    clearMessages()
    setEditingId(null)
    if (tab === 'species') setFormData({
      code: '', label: '', labelHi: '', labelKn: '', labelMl: '', labelTa: '', labelTe: '', icon: '', category: '', hasEarTag: false, sortOrder: 0, isMarketplaceEligible: false,
      farmSegment: 'pet', defaultManagementMode: 'individual', producesMilk: false, producesEggs: false, producesWool: false,
      isAquatic: false, litterExpected: false, gestationDays: '', incubationDays: '', birthEventTerm: 'birth', scientificName: '', waterType: '',
    })
    else if (tab === 'breeds') setFormData({ speciesId: scopeSpeciesId, name: '', sortOrder: 0 })
    else if (tab === 'classes') setFormData({ speciesId: scopeSpeciesId, value: '', label: '', impliedGender: 'unknown', canBePregnant: false, canProduceMilk: false, canLayEggs: false, isJuvenile: false, sortOrder: 0 })
    else if (tab === 'categories') setFormData({ code: '', label: '', icon: '', sortOrder: 0 })
    else setFormData({ code: '', label: '', sortOrder: 0 })
    setShowModal(true)
  }

  const openEdit = (row: any) => {
    clearMessages()
    setEditingId(row.id)
    setFormData({ ...row })
    setShowModal(true)
  }

  const save = async () => {
    setSaving(true)
    clearMessages()
    try {
      if (tab === 'species') {
        if (editingId) await apiService.adminUpdateMasterSpecies(editingId, formData)
        else await apiService.adminCreateMasterSpecies(formData)
      } else if (tab === 'breeds') {
        if (!formData.speciesId) { setError(t('masterData.errors.speciesRequired', 'Select a species first')); setSaving(false); return }
        if (editingId) await apiService.adminUpdateMasterBreed(editingId, { name: formData.name, sortOrder: formData.sortOrder, ...localeLabelsFromForm() })
        else await apiService.adminCreateMasterBreed(formData)
      } else if (tab === 'classes') {
        if (!formData.speciesId) { setError(t('masterData.errors.speciesRequired', 'Select a species first')); setSaving(false); return }
        if (editingId) await apiService.adminUpdateMasterAnimalClass(editingId, {
          label: formData.label, impliedGender: formData.impliedGender,
          canBePregnant: formData.canBePregnant, canProduceMilk: formData.canProduceMilk,
          canLayEggs: !!formData.canLayEggs, isJuvenile: !!formData.isJuvenile, sortOrder: formData.sortOrder,
          ...localeLabelsFromForm(),
        })
        else await apiService.adminCreateMasterAnimalClass(formData)
      } else if (tab === 'categories') {
        if (editingId) await apiService.adminUpdateMasterMarketplaceCategory(editingId, { label: formData.label, icon: formData.icon, sortOrder: formData.sortOrder, ...localeLabelsFromForm() })
        else await apiService.adminCreateMasterMarketplaceCategory(formData)
      } else {
        if (editingId) await apiService.adminUpdateMasterMarketplaceCondition(editingId, { label: formData.label, sortOrder: formData.sortOrder, ...localeLabelsFromForm() })
        else await apiService.adminCreateMasterMarketplaceCondition(formData)
      }
      setSuccess(editingId ? t('masterData.updatedSuccess', 'Updated successfully') : t('masterData.createdSuccess', 'Created successfully'))
      setShowModal(false)
      load()
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || t('common.errorSaving', 'Failed to save'))
    } finally {
      setSaving(false)
    }
  }

  const toggleArchive = async (row: any) => {
    clearMessages()
    try {
      const isActive = row.isActive
      if (tab === 'species') await (isActive ? apiService.adminArchiveMasterSpecies(row.id) : apiService.adminRestoreMasterSpecies(row.id))
      else if (tab === 'breeds') await (isActive ? apiService.adminArchiveMasterBreed(row.id) : apiService.adminRestoreMasterBreed(row.id))
      else if (tab === 'classes') await (isActive ? apiService.adminArchiveMasterAnimalClass(row.id) : apiService.adminRestoreMasterAnimalClass(row.id))
      else if (tab === 'categories') await (isActive ? apiService.adminArchiveMasterMarketplaceCategory(row.id) : apiService.adminRestoreMasterMarketplaceCategory(row.id))
      else await (isActive ? apiService.adminArchiveMasterMarketplaceCondition(row.id) : apiService.adminRestoreMasterMarketplaceCondition(row.id))
      setSuccess(isActive ? t('masterData.archivedSuccess', 'Deactivated') : t('masterData.restoredSuccess', 'Reactivated'))
      load()
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || t('common.errorSaving', 'Failed to save'))
    }
  }

  const remove = async (row: any) => {
    if (!window.confirm(t('masterData.confirmDelete', 'Delete this entry? This cannot be undone.'))) return
    clearMessages()
    try {
      if (tab === 'species') await apiService.adminDeleteMasterSpecies(row.id)
      else if (tab === 'breeds') await apiService.adminDeleteMasterBreed(row.id)
      else if (tab === 'classes') await apiService.adminDeleteMasterAnimalClass(row.id)
      else if (tab === 'categories') await apiService.adminDeleteMasterMarketplaceCategory(row.id)
      else await apiService.adminDeleteMasterMarketplaceCondition(row.id)
      setSuccess(t('masterData.deletedSuccess', 'Deleted'))
      load()
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || t('masterData.deleteBlocked', 'Could not delete: it may still be in use'))
    }
  }

  const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
    { key: 'species', label: t('masterData.tabs.species', 'Species'), icon: '🐾' },
    { key: 'breeds', label: t('masterData.tabs.breeds', 'Breeds'), icon: '🐕' },
    { key: 'classes', label: t('masterData.tabs.classes', 'Animal Classes'), icon: '🐄' },
    { key: 'groupTypes', label: t('farmProfile.admin.tabs.groupTypes'), icon: '🏠' },
    { key: 'recordTypes', label: t('farmProfile.admin.tabs.recordTypes'), icon: '📝' },
    { key: 'categories', label: t('masterData.tabs.categories', 'Marketplace Categories'), icon: '📦' },
    { key: 'conditions', label: t('masterData.tabs.conditions', 'Marketplace Conditions'), icon: '🏷️' },
  ]

  const needsSpeciesScope = tab === 'breeds' || tab === 'classes'
  const isFarmTab = tab === 'groupTypes' || tab === 'recordTypes'

  return (
    <div className="module-page master-data-page">
      <div className="module-header">
        <h1>{t('masterData.title', 'Master Data')}</h1>
        <p>{t('masterData.subtitle', 'Manage species, breeds, animal classes, and marketplace dropdown values, no code deploy needed.')}</p>
      </div>

      {error && <div className="module-alert error">{error}<button onClick={() => setError('')}>×</button></div>}
      {success && <div className="module-alert success">{success}<button onClick={() => setSuccess('')}>×</button></div>}

      <div className="module-tabs">
        {TABS.map(tb => (
          <button key={tb.key} className={`module-tab ${tab === tb.key ? 'active' : ''}`} onClick={() => { setTab(tb.key); setScopeSpeciesId('') }}>
            {tb.icon} {tb.label}
          </button>
        ))}
      </div>

      {needsSpeciesScope && (
        <div className="module-form-group md-scope-picker">
          <label className="module-label">{t('masterData.filterBySpecies', 'Species')}</label>
          <select className="module-input" value={scopeSpeciesId} onChange={e => setScopeSpeciesId(e.target.value)}>
            <option value="">{t('masterData.selectSpeciesPrompt', 'Select a species')}</option>
            {speciesRows.map(s => <option key={s.id} value={s.id}>{s.icon || ''} {s.label}</option>)}
          </select>
        </div>
      )}

      {isFarmTab && (
        <FarmMasterDataTabs tab={tab} speciesRows={speciesRows} onError={setError} onSuccess={setSuccess} clearMessages={clearMessages} />
      )}

      {!isFarmTab && (
      <div className="md-toolbar md-toolbar-top">
        <button className="module-btn primary" onClick={openAdd} disabled={needsSpeciesScope && !scopeSpeciesId}>
          + {t('masterData.addNew', 'Add New')}
        </button>
      </div>
      )}

      {isFarmTab ? null : loading ? (
        <div className="module-loading">{t('common.loading', 'Loading...')}</div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              {tab === 'species' && (
                <tr><th>{t('masterData.col.icon', 'Icon')}</th><th>{t('masterData.col.code', 'Code')}</th><th>{t('masterData.col.label', 'Label')}</th><th>{t('masterData.col.category', 'Category')}</th><th>{t('farmProfile.admin.col.farmSegment')}</th><th>{t('masterData.col.earTag', 'Ear Tag')}</th><th>{t('masterData.col.marketplaceEligible', 'Marketplace')}</th><th>{t('common.status')}</th><th>{t('common.actions')}</th></tr>
              )}
              {tab === 'breeds' && (
                <tr><th>{t('common.name')}</th><th>{t('masterData.col.sortOrder', 'Sort')}</th><th>{t('common.status')}</th><th>{t('common.actions')}</th></tr>
              )}
              {tab === 'classes' && (
                <tr><th>{t('masterData.col.value', 'Value')}</th><th>{t('masterData.col.label', 'Label')}</th><th>{t('masterData.col.impliedGender', 'Gender')}</th><th>{t('masterData.col.canBePregnant', 'Can Be Pregnant')}</th><th>{t('masterData.col.canProduceMilk', 'Can Produce Milk')}</th><th>{t('farmProfile.admin.col.canLayEggs')}</th><th>{t('farmProfile.admin.col.isJuvenile')}</th><th>{t('common.status')}</th><th>{t('common.actions')}</th></tr>
              )}
              {tab === 'categories' && (
                <tr><th>{t('masterData.col.icon', 'Icon')}</th><th>{t('masterData.col.code', 'Code')}</th><th>{t('masterData.col.label', 'Label')}</th><th>{t('common.status')}</th><th>{t('common.actions')}</th></tr>
              )}
              {tab === 'conditions' && (
                <tr><th>{t('masterData.col.code', 'Code')}</th><th>{t('masterData.col.label', 'Label')}</th><th>{t('common.status')}</th><th>{t('common.actions')}</th></tr>
              )}
            </thead>
            <tbody>
              {tab === 'species' && speciesRows.map(row => (
                <tr key={row.id} className={!row.isActive ? 'inactive-row' : ''}>
                  <td>{row.icon || '🐾'}</td>
                  <td>{row.code}</td>
                  <td>{row.label}</td>
                  <td>{row.category || '-'}</td>
                  <td>{t(`farmProfile.segments.${row.farmSegment || 'pet'}`)}</td>
                  <td>{row.hasEarTag ? '✓' : '-'}</td>
                  <td>{row.isMarketplaceEligible ? '✓' : '-'}</td>
                  <td><span className={`module-badge ${row.isActive ? 'badge-success' : 'badge-error'}`}>{row.isActive ? t('common.active') : t('common.inactive')}</span></td>
                  <td>
                    <button className="module-btn small" onClick={() => openEdit(row)}>{t('common.edit')}</button>
                    <button className="module-btn small" onClick={() => toggleArchive(row)}>{row.isActive ? t('common.deactivate') : t('masterData.reactivate', 'Reactivate')}</button>
                    <button className="module-btn small" onClick={() => remove(row)}>{t('common.delete')}</button>
                  </td>
                </tr>
              ))}
              {tab === 'breeds' && breedRows.map(row => (
                <tr key={row.id} className={!row.isActive ? 'inactive-row' : ''}>
                  <td>{row.name}</td>
                  <td>{row.sortOrder}</td>
                  <td><span className={`module-badge ${row.isActive ? 'badge-success' : 'badge-error'}`}>{row.isActive ? t('common.active') : t('common.inactive')}</span></td>
                  <td>
                    <button className="module-btn small" onClick={() => openEdit(row)}>{t('common.edit')}</button>
                    <button className="module-btn small" onClick={() => toggleArchive(row)}>{row.isActive ? t('common.deactivate') : t('masterData.reactivate', 'Reactivate')}</button>
                    <button className="module-btn small" onClick={() => remove(row)}>{t('common.delete')}</button>
                  </td>
                </tr>
              ))}
              {tab === 'classes' && classRows.map(row => (
                <tr key={row.id} className={!row.isActive ? 'inactive-row' : ''}>
                  <td>{row.value}</td>
                  <td>{resolveLabel(row, t)}</td>
                  <td>{row.impliedGender}</td>
                  <td>{row.canBePregnant ? '✓' : '-'}</td>
                  <td>{row.canProduceMilk ? '✓' : '-'}</td>
                  <td>{row.canLayEggs ? '✓' : '-'}</td>
                  <td>{row.isJuvenile ? '✓' : '-'}</td>
                  <td><span className={`module-badge ${row.isActive ? 'badge-success' : 'badge-error'}`}>{row.isActive ? t('common.active') : t('common.inactive')}</span></td>
                  <td>
                    <button className="module-btn small" onClick={() => openEdit(row)}>{t('common.edit')}</button>
                    <button className="module-btn small" onClick={() => toggleArchive(row)}>{row.isActive ? t('common.deactivate') : t('masterData.reactivate', 'Reactivate')}</button>
                    <button className="module-btn small" onClick={() => remove(row)}>{t('common.delete')}</button>
                  </td>
                </tr>
              ))}
              {tab === 'categories' && categoryRows.map(row => (
                <tr key={row.id} className={!row.isActive ? 'inactive-row' : ''}>
                  <td>{row.icon || '📦'}</td>
                  <td>{row.code} {row.isProtected && <span className="module-badge badge-pending" title={t('masterData.protectedHint', 'Protected: core logic depends on this code')}>🔒</span>}</td>
                  <td>{resolveLabel(row, t)}</td>
                  <td><span className={`module-badge ${row.isActive ? 'badge-success' : 'badge-error'}`}>{row.isActive ? t('common.active') : t('common.inactive')}</span></td>
                  <td>
                    <button className="module-btn small" onClick={() => openEdit(row)}>{t('common.edit')}</button>
                    <button className="module-btn small" onClick={() => toggleArchive(row)}>{row.isActive ? t('common.deactivate') : t('masterData.reactivate', 'Reactivate')}</button>
                    {!row.isProtected && <button className="module-btn small" onClick={() => remove(row)}>{t('common.delete')}</button>}
                  </td>
                </tr>
              ))}
              {tab === 'conditions' && conditionRows.map(row => (
                <tr key={row.id} className={!row.isActive ? 'inactive-row' : ''}>
                  <td>{row.code}</td>
                  <td>{resolveLabel(row, t)}</td>
                  <td><span className={`module-badge ${row.isActive ? 'badge-success' : 'badge-error'}`}>{row.isActive ? t('common.active') : t('common.inactive')}</span></td>
                  <td>
                    <button className="module-btn small" onClick={() => openEdit(row)}>{t('common.edit')}</button>
                    <button className="module-btn small" onClick={() => toggleArchive(row)}>{row.isActive ? t('common.deactivate') : t('masterData.reactivate', 'Reactivate')}</button>
                    <button className="module-btn small" onClick={() => remove(row)}>{t('common.delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {((tab === 'species' && speciesRows.length === 0) ||
            (tab === 'breeds' && breedRows.length === 0) ||
            (tab === 'classes' && classRows.length === 0) ||
            (tab === 'categories' && categoryRows.length === 0) ||
            (tab === 'conditions' && conditionRows.length === 0)) && (
            <div className="module-loading">
              {needsSpeciesScope && !scopeSpeciesId ? t('masterData.selectSpeciesPrompt', 'Select a species') : t('masterData.noEntries', 'No entries yet')}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="edit-form-overlay" onClick={() => setShowModal(false)}>
          <div className="edit-form-panel edit-form-modal" onClick={e => e.stopPropagation()}>
            <button className="edit-form-close" onClick={() => setShowModal(false)} aria-label="Close">✕</button>
            <h2>{editingId ? t('masterData.editEntry', 'Edit Entry') : t('masterData.addNew', 'Add New')}</h2>

            {tab === 'species' && (
              <>
                <div className="module-form-group">
                  <label className="module-label">{t('masterData.col.code', 'Code')}</label>
                  <input className="module-input" value={formData.code || ''} disabled={!!editingId}
                    onChange={e => setFormData((f: any) => ({ ...f, code: e.target.value }))} placeholder="e.g. Cattle" />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('masterData.col.label', 'Label')}</label>
                  <input className="module-input" value={formData.label || ''} onChange={e => setFormData((f: any) => ({ ...f, label: e.target.value }))} />
                </div>
                {renderLocaleLabelInputs()}
                <div className="module-form-group">
                  <label className="module-label">{t('masterData.col.icon', 'Icon (emoji)')}</label>
                  <input className="module-input" value={formData.icon || ''} onChange={e => setFormData((f: any) => ({ ...f, icon: e.target.value }))} maxLength={10} />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('masterData.col.category', 'Category group')}</label>
                  <input className="module-input" value={formData.category || ''} onChange={e => setFormData((f: any) => ({ ...f, category: e.target.value }))} placeholder="e.g. Livestock / Farm" />
                </div>
                <label className="checkbox-label">
                  <input type="checkbox" checked={!!formData.hasEarTag} onChange={e => setFormData((f: any) => ({ ...f, hasEarTag: e.target.checked }))} />
                  {t('masterData.col.earTag', 'Uses ear tags')}
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={!!formData.isMarketplaceEligible} onChange={e => setFormData((f: any) => ({ ...f, isMarketplaceEligible: e.target.checked }))} />
                  {t('masterData.col.marketplaceEligible', 'Sellable on Marketplace')}
                </label>

                <h3 className="md-section-title">{t('farmProfile.admin.farmSectionTitle')}</h3>
                <p className="module-hint md-hint">{t('farmProfile.admin.farmSectionHint')}</p>
                <div className="module-form-group">
                  <label className="module-label">{t('farmProfile.admin.col.farmSegment')}</label>
                  <select className="module-input" value={formData.farmSegment || 'pet'} onChange={e => setFormData((f: any) => ({ ...f, farmSegment: e.target.value }))}>
                    {FARM_SEGMENTS.map(seg => <option key={seg} value={seg}>{t(`farmProfile.segments.${seg}`)}</option>)}
                  </select>
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('farmProfile.admin.col.defaultMode')}</label>
                  <select className="module-input" value={formData.defaultManagementMode || 'individual'} onChange={e => setFormData((f: any) => ({ ...f, defaultManagementMode: e.target.value }))}>
                    <option value="individual">{t('farmProfile.modes.individual')}</option>
                    <option value="batch">{t('farmProfile.modes.batch')}</option>
                  </select>
                </div>
                {(['producesMilk', 'producesEggs', 'producesWool', 'litterExpected', 'isAquatic'] as const).map(flag => (
                  <label className="checkbox-label md-flag" key={flag}>
                    <input type="checkbox" checked={!!formData[flag]} onChange={e => setFormData((f: any) => ({ ...f, [flag]: e.target.checked }))} />
                    {t(`farmProfile.admin.col.${flag}`)}
                  </label>
                ))}
                <div className="module-form-group">
                  <label className="module-label">{t('farmProfile.admin.col.birthEventTerm')}</label>
                  <select className="module-input" value={formData.birthEventTerm || 'birth'} onChange={e => setFormData((f: any) => ({ ...f, birthEventTerm: e.target.value }))}>
                    {BIRTH_EVENT_TERMS.map(term => <option key={term} value={term}>{t(`farmProfile.birthTerms.${term}`)}</option>)}
                  </select>
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('farmProfile.admin.col.gestationDays')}</label>
                  <input type="number" inputMode="numeric" min={1} className="module-input" value={formData.gestationDays ?? ''}
                    onChange={e => setFormData((f: any) => ({ ...f, gestationDays: e.target.value === '' ? '' : parseInt(e.target.value, 10) }))} />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('farmProfile.admin.col.incubationDays')}</label>
                  <input type="number" inputMode="numeric" min={1} className="module-input" value={formData.incubationDays ?? ''}
                    onChange={e => setFormData((f: any) => ({ ...f, incubationDays: e.target.value === '' ? '' : parseInt(e.target.value, 10) }))} />
                  <p className="module-hint md-hint">{t('farmProfile.admin.daysBlankHint')}</p>
                </div>
                {formData.isAquatic && (
                  <>
                    <div className="module-form-group">
                      <label className="module-label">{t('farmProfile.admin.col.scientificName')}</label>
                      <input className="module-input" value={formData.scientificName || ''} maxLength={150}
                        onChange={e => setFormData((f: any) => ({ ...f, scientificName: e.target.value }))} />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label">{t('farmProfile.admin.col.waterType')}</label>
                      <select className="module-input" value={formData.waterType || ''} onChange={e => setFormData((f: any) => ({ ...f, waterType: e.target.value }))}>
                        <option value="">{t('farmProfile.admin.none')}</option>
                        {WATER_TYPES.map(w => <option key={w} value={w}>{t(`farmProfile.waterTypes.${w}`)}</option>)}
                      </select>
                    </div>
                  </>
                )}

                <div className="module-form-group">
                  <label className="module-label">{t('masterData.col.sortOrder', 'Sort order')}</label>
                  <input type="number" inputMode="decimal" className="module-input" value={formData.sortOrder ?? 0} onChange={e => setFormData((f: any) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))} />
                </div>
              </>
            )}

            {tab === 'breeds' && (
              <>
                <div className="module-form-group">
                  <label className="module-label">{t('common.name')}</label>
                  <input className="module-input" value={formData.name || ''} onChange={e => setFormData((f: any) => ({ ...f, name: e.target.value }))} />
                </div>
                {renderLocaleLabelInputs()}
                <div className="module-form-group">
                  <label className="module-label">{t('masterData.col.sortOrder', 'Sort order')}</label>
                  <input type="number" inputMode="decimal" className="module-input" value={formData.sortOrder ?? 0} onChange={e => setFormData((f: any) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))} />
                </div>
              </>
            )}

            {tab === 'classes' && (
              <>
                <div className="module-form-group">
                  <label className="module-label">{t('masterData.col.value', 'Value (internal code)')}</label>
                  <input className="module-input" value={formData.value || ''} disabled={!!editingId}
                    onChange={e => setFormData((f: any) => ({ ...f, value: e.target.value }))} placeholder="e.g. cattle_bullock" />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('masterData.col.label', 'Label')}</label>
                  <input className="module-input" value={formData.label || ''} onChange={e => setFormData((f: any) => ({ ...f, label: e.target.value }))}
                    placeholder={formData.labelKey ? t('masterData.currentlyShowing', 'Currently showing: {{value}}', { value: t(formData.labelKey) }) : ''} />
                </div>
                {renderLocaleLabelInputs()}
                <div className="module-form-group">
                  <label className="module-label">{t('masterData.col.impliedGender', 'Implied gender')}</label>
                  <select className="module-input" value={formData.impliedGender || 'unknown'} onChange={e => setFormData((f: any) => ({ ...f, impliedGender: e.target.value }))}>
                    <option value="male">{t('common.male')}</option>
                    <option value="female">{t('common.female')}</option>
                    <option value="unknown">{t('masterData.gender.unknown', 'Unknown')}</option>
                  </select>
                </div>
                <label className="checkbox-label">
                  <input type="checkbox" checked={!!formData.canBePregnant} onChange={e => setFormData((f: any) => ({ ...f, canBePregnant: e.target.checked }))} />
                  {t('masterData.col.canBePregnant', 'Can be pregnant')}
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={!!formData.canProduceMilk} onChange={e => setFormData((f: any) => ({ ...f, canProduceMilk: e.target.checked }))} />
                  {t('masterData.col.canProduceMilk', 'Can produce milk')}
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={!!formData.canLayEggs} onChange={e => setFormData((f: any) => ({ ...f, canLayEggs: e.target.checked }))} />
                  {t('farmProfile.admin.col.canLayEggs')}
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={!!formData.isJuvenile} onChange={e => setFormData((f: any) => ({ ...f, isJuvenile: e.target.checked }))} />
                  {t('farmProfile.admin.col.isJuvenile')}
                </label>
                <div className="module-form-group">
                  <label className="module-label">{t('masterData.col.sortOrder', 'Sort order')}</label>
                  <input type="number" inputMode="decimal" className="module-input" value={formData.sortOrder ?? 0} onChange={e => setFormData((f: any) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))} />
                </div>
              </>
            )}

            {tab === 'categories' && (
              <>
                <div className="module-form-group">
                  <label className="module-label">{t('masterData.col.code', 'Code')}</label>
                  <input className="module-input" value={formData.code || ''} disabled={!!editingId}
                    onChange={e => setFormData((f: any) => ({ ...f, code: e.target.value }))} placeholder="e.g. livestock_feed" />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('masterData.col.label', 'Label')}</label>
                  <input className="module-input" value={formData.label || ''} onChange={e => setFormData((f: any) => ({ ...f, label: e.target.value }))}
                    placeholder={formData.labelKey ? t('masterData.currentlyShowing', 'Currently showing: {{value}}', { value: t(formData.labelKey) }) : ''} />
                </div>
                {renderLocaleLabelInputs()}
                <div className="module-form-group">
                  <label className="module-label">{t('masterData.col.icon', 'Icon (emoji)')}</label>
                  <input className="module-input" value={formData.icon || ''} onChange={e => setFormData((f: any) => ({ ...f, icon: e.target.value }))} maxLength={10} />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('masterData.col.sortOrder', 'Sort order')}</label>
                  <input type="number" inputMode="decimal" className="module-input" value={formData.sortOrder ?? 0} onChange={e => setFormData((f: any) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))} />
                </div>
              </>
            )}

            {tab === 'conditions' && (
              <>
                <div className="module-form-group">
                  <label className="module-label">{t('masterData.col.code', 'Code')}</label>
                  <input className="module-input" value={formData.code || ''} disabled={!!editingId}
                    onChange={e => setFormData((f: any) => ({ ...f, code: e.target.value }))} placeholder="e.g. new" />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('masterData.col.label', 'Label')}</label>
                  <input className="module-input" value={formData.label || ''} onChange={e => setFormData((f: any) => ({ ...f, label: e.target.value }))}
                    placeholder={formData.labelKey ? t('masterData.currentlyShowing', 'Currently showing: {{value}}', { value: t(formData.labelKey) }) : ''} />
                </div>
                {renderLocaleLabelInputs()}
                <div className="module-form-group">
                  <label className="module-label">{t('masterData.col.sortOrder', 'Sort order')}</label>
                  <input type="number" inputMode="decimal" className="module-input" value={formData.sortOrder ?? 0} onChange={e => setFormData((f: any) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))} />
                </div>
              </>
            )}

            <div className="form-actions">
              <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MasterDataManagement
