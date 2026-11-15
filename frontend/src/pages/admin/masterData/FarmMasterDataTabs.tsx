import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../../services/api'
import { useMasterData } from '../../../context/MasterDataContext'
import {
  FARM_SEGMENTS, LOCALE_LABEL_FIELDS, LocaleLabelCols, MasterSpeciesOption, serverMessage,
} from './farmMasterShared'

/**
 * Master Data admin - the two farm-profile tabs (migration 043):
 *
 *   Group Types   life-stage / purpose groups per species or per farm type. Full CRUD.
 *   Record Types  the daily records and events a farmer enters. Wording, icon, unit, order and
 *                 on/off only - the code is used by application logic, and the "applies when"
 *                 rules are shown read-only so an admin can see why a record is offered.
 *
 * Kept out of MasterDataManagement.tsx so that file does not grow further; it renders inside
 * that page's root, so the page-scoped styles in MasterDataManagement.css apply.
 */

interface GroupTypeRow extends LocaleLabelCols {
  id: string; speciesId: string | null; speciesCode: string | null; farmSegment: string | null
  value: string; labelKey: string | null; label: string; icon: string | null
  managementMode: 'individual' | 'batch' | null; suggestedClass: string | null
  isHealthHold: boolean; yieldsMilk: boolean; yieldsEggs: boolean; sortOrder: number; isActive: boolean
}
interface RecordRule {
  id: string; ruleKey: string; farmSegment: string | null; managementMode: string | null
  requiresSpeciesFlag: string | null; aquatic: boolean | null; requiresClassFlag: string | null; requiresGroupFlag: string | null
}
interface RecordTypeRow extends LocaleLabelCols {
  id: string; code: string; kind: 'daily' | 'event'; subject: 'animal' | 'group' | 'either'
  labelKey: string | null; label: string; icon: string | null; unit: string | null
  sortOrder: number; isActive: boolean; rules: RecordRule[]
}
interface ClassOption { value: string; label: string | null; labelKey: string | null }

interface Props {
  tab: 'groupTypes' | 'recordTypes'
  speciesRows: MasterSpeciesOption[]
  onError: (message: string) => void
  onSuccess: (message: string) => void
  clearMessages: () => void
}

const FarmMasterDataTabs: React.FC<Props> = ({ tab, speciesRows, onError, onSuccess, clearMessages }) => {
  const { t } = useTranslation()
  const { resolveLabel } = useMasterData()

  const [loading, setLoading] = useState(false)
  const [groupTypeRows, setGroupTypeRows] = useState<GroupTypeRow[]>([])
  const [recordTypeRows, setRecordTypeRows] = useState<RecordTypeRow[]>([])
  // Scope filter for group types: "species:<id>" or "segment:<code>".
  const [scope, setScope] = useState('')
  const [classOptions, setClassOptions] = useState<ClassOption[]>([])

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)

  const scopeSpeciesId = scope.startsWith('species:') ? scope.slice('species:'.length) : ''
  const scopeSegment = scope.startsWith('segment:') ? scope.slice('segment:'.length) : ''

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'groupTypes') {
        if (!scopeSpeciesId && !scopeSegment) { setGroupTypeRows([]); return }
        const res = await apiService.adminListMasterGroupTypes(scopeSpeciesId ? { speciesId: scopeSpeciesId } : { farmSegment: scopeSegment })
        setGroupTypeRows(res.data || [])
      } else {
        const res = await apiService.adminListMasterRecordTypes()
        setRecordTypeRows(res.data || [])
      }
    } catch (e: any) {
      onError(serverMessage(e, t('common.errorLoading', 'Failed to load')))
    } finally {
      setLoading(false)
    }
  }, [tab, scopeSpeciesId, scopeSegment, onError, t])

  useEffect(() => { load() }, [load])

  // Class picker for "suggested class" - master-linked, so a picker, never free text.
  useEffect(() => {
    let cancelled = false
    if (!scopeSpeciesId) { setClassOptions([]); return }
    apiService.adminListMasterAnimalClasses(scopeSpeciesId)
      .then((res: any) => { if (!cancelled) setClassOptions(res.data || []) })
      .catch(() => { if (!cancelled) setClassOptions([]) })
    return () => { cancelled = true }
  }, [scopeSpeciesId])

  const setField = (field: string, value: any) => setFormData((f: any) => ({ ...f, [field]: value }))

  const openAdd = () => {
    clearMessages()
    setEditingId(null)
    setFormData({
      value: '', label: '', icon: '', managementMode: '', suggestedClass: '',
      isHealthHold: false, yieldsMilk: false, yieldsEggs: false, sortOrder: 0,
      labelHi: '', labelKn: '', labelMl: '', labelTa: '', labelTe: '',
    })
    setShowModal(true)
  }

  const openEdit = (row: GroupTypeRow | RecordTypeRow) => {
    clearMessages()
    setEditingId(row.id)
    setFormData({ ...row })
    setShowModal(true)
  }

  const localeLabelsFromForm = () => ({
    labelHi: formData.labelHi ?? '', labelKn: formData.labelKn ?? '', labelMl: formData.labelMl ?? '',
    labelTa: formData.labelTa ?? '', labelTe: formData.labelTe ?? '',
  })

  const save = async () => {
    if (saving) return
    setSaving(true)
    clearMessages()
    try {
      if (tab === 'groupTypes') {
        const common = {
          label: formData.label, icon: formData.icon ?? '', managementMode: formData.managementMode ?? '',
          suggestedClass: formData.suggestedClass ?? '', isHealthHold: !!formData.isHealthHold,
          yieldsMilk: !!formData.yieldsMilk, yieldsEggs: !!formData.yieldsEggs, sortOrder: formData.sortOrder ?? 0,
          ...localeLabelsFromForm(),
        }
        if (editingId) await apiService.adminUpdateMasterGroupType(editingId, common)
        else await apiService.adminCreateMasterGroupType({
          ...common, value: formData.value,
          ...(scopeSpeciesId ? { speciesId: scopeSpeciesId } : { farmSegment: scopeSegment }),
        })
      } else if (editingId) {
        await apiService.adminUpdateMasterRecordType(editingId, {
          label: formData.label, icon: formData.icon ?? '', unit: formData.unit ?? '', sortOrder: formData.sortOrder ?? 0,
          ...localeLabelsFromForm(),
        })
      }
      onSuccess(editingId ? t('masterData.updatedSuccess', 'Updated successfully') : t('masterData.createdSuccess', 'Created successfully'))
      setShowModal(false)
      load()
    } catch (e: any) {
      // The form stays open and filled, so nothing typed is lost - fix and save again.
      onError(serverMessage(e, t('common.errorSaving', 'Failed to save')))
    } finally {
      setSaving(false)
    }
  }

  const toggleArchive = async (row: GroupTypeRow | RecordTypeRow) => {
    clearMessages()
    try {
      if (tab === 'groupTypes') await (row.isActive ? apiService.adminArchiveMasterGroupType(row.id) : apiService.adminRestoreMasterGroupType(row.id))
      else await (row.isActive ? apiService.adminArchiveMasterRecordType(row.id) : apiService.adminRestoreMasterRecordType(row.id))
      onSuccess(row.isActive ? t('masterData.archivedSuccess', 'Deactivated') : t('masterData.restoredSuccess', 'Reactivated'))
      load()
    } catch (e: any) {
      onError(serverMessage(e, t('common.errorSaving', 'Failed to save')))
    }
  }

  const remove = async (row: GroupTypeRow) => {
    if (!window.confirm(t('masterData.confirmDelete', 'Delete this entry? This cannot be undone.'))) return
    clearMessages()
    try {
      await apiService.adminDeleteMasterGroupType(row.id)
      onSuccess(t('masterData.deletedSuccess', 'Deleted'))
      load()
    } catch (e: any) {
      onError(serverMessage(e, t('masterData.deleteBlocked', 'Could not delete: it may still be in use')))
    }
  }

  /** One rule in plain words, e.g. "Batch-managed · Not aquatic". */
  const describeRule = (rule: RecordRule): string => {
    const parts: string[] = []
    if (rule.farmSegment) parts.push(t(`farmProfile.segments.${rule.farmSegment}`))
    if (rule.managementMode) parts.push(t(`farmProfile.modes.${rule.managementMode}`))
    if (rule.aquatic === true) parts.push(t('farmProfile.admin.rule.aquaticOnly'))
    if (rule.aquatic === false) parts.push(t('farmProfile.admin.rule.landOnly'))
    if (rule.requiresSpeciesFlag) parts.push(t(`farmProfile.flags.${rule.requiresSpeciesFlag}`))
    if (rule.requiresClassFlag) parts.push(`${t('farmProfile.admin.rule.animal')}: ${t(`farmProfile.flags.${rule.requiresClassFlag}`)}`)
    if (rule.requiresGroupFlag) parts.push(`${t('farmProfile.admin.rule.group')}: ${t(`farmProfile.flags.${rule.requiresGroupFlag}`)}`)
    return parts.length > 0 ? parts.join(' · ') : t('farmProfile.admin.rule.anyFarmStock')
  }

  const farmSpecies = speciesRows.filter(s => s.farmSegment && s.farmSegment !== 'pet')
  const statusBadge = (isActive: boolean) => (
    <span className={`module-badge ${isActive ? 'badge-success' : 'badge-error'}`}>{isActive ? t('common.active') : t('common.inactive')}</span>
  )

  return (
    <>
      {tab === 'groupTypes' && (
        <>
          <div className="module-form-group md-scope-picker">
            <label className="module-label" htmlFor="md-group-type-scope">{t('farmProfile.admin.appliesTo')}</label>
            <select id="md-group-type-scope" className="module-input" value={scope} onChange={e => setScope(e.target.value)}>
              <option value="">{t('farmProfile.admin.selectScopePrompt')}</option>
              <optgroup label={t('farmProfile.admin.scopeSpecies')}>
                {farmSpecies.map(s => <option key={s.id} value={`species:${s.id}`}>{s.icon || ''} {s.label}</option>)}
              </optgroup>
              <optgroup label={t('farmProfile.admin.scopeSegment')}>
                {FARM_SEGMENTS.filter(seg => seg !== 'pet').map(seg => <option key={seg} value={`segment:${seg}`}>{t(`farmProfile.segments.${seg}`)}</option>)}
              </optgroup>
            </select>
            <p className="module-hint md-hint">{t('farmProfile.admin.scopeHint')}</p>
          </div>
          <div className="md-toolbar">
            <button className="module-btn primary" onClick={openAdd} disabled={!scope}>+ {t('masterData.addNew', 'Add New')}</button>
          </div>
        </>
      )}
      {tab === 'recordTypes' && <p className="module-hint md-hint md-tab-hint">{t('farmProfile.admin.recordTypeFixed')}</p>}

      {loading ? (
        <div className="module-loading">{t('common.loading', 'Loading...')}</div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              {tab === 'groupTypes' ? (
                <tr>
                  <th>{t('masterData.col.icon', 'Icon')}</th><th>{t('masterData.col.code', 'Code')}</th><th>{t('masterData.col.label', 'Label')}</th>
                  <th>{t('farmProfile.admin.col.managementMode')}</th><th>{t('farmProfile.admin.col.flags')}</th>
                  <th>{t('common.status')}</th><th>{t('common.actions')}</th>
                </tr>
              ) : (
                <tr>
                  <th>{t('masterData.col.icon', 'Icon')}</th><th>{t('masterData.col.code', 'Code')}</th><th>{t('masterData.col.label', 'Label')}</th>
                  <th>{t('farmProfile.admin.col.kind')}</th><th>{t('farmProfile.admin.col.subject')}</th><th>{t('farmProfile.admin.col.appliesWhen')}</th>
                  <th>{t('common.status')}</th><th>{t('common.actions')}</th>
                </tr>
              )}
            </thead>
            <tbody>
              {tab === 'groupTypes' && groupTypeRows.map(row => (
                <tr key={row.id} className={!row.isActive ? 'inactive-row' : ''}>
                  <td>{row.icon || '-'}</td>
                  <td>{row.value}</td>
                  <td>{resolveLabel(row, t)}</td>
                  <td>{row.managementMode ? t(`farmProfile.modes.${row.managementMode}`) : '-'}</td>
                  <td>
                    {[row.isHealthHold && t('farmProfile.admin.col.isHealthHold'), row.yieldsMilk && t('farmProfile.flags.yields_milk'), row.yieldsEggs && t('farmProfile.flags.yields_eggs')]
                      .filter(Boolean).join(' · ') || '-'}
                  </td>
                  <td>{statusBadge(row.isActive)}</td>
                  <td>
                    <button className="module-btn small" onClick={() => openEdit(row)}>{t('common.edit')}</button>
                    <button className="module-btn small" onClick={() => toggleArchive(row)}>{row.isActive ? t('common.deactivate') : t('masterData.reactivate', 'Reactivate')}</button>
                    <button className="module-btn small" onClick={() => remove(row)}>{t('common.delete')}</button>
                  </td>
                </tr>
              ))}
              {tab === 'recordTypes' && recordTypeRows.map(row => (
                <tr key={row.id} className={!row.isActive ? 'inactive-row' : ''}>
                  <td>{row.icon || '-'}</td>
                  <td>{row.code}</td>
                  <td>{resolveLabel(row, t)}</td>
                  <td>{t(`farmProfile.kinds.${row.kind}`)}</td>
                  <td>{t(`farmProfile.subjects.${row.subject}`)}</td>
                  <td>
                    <ul className="md-rule-list">
                      {row.rules.map(rule => <li key={rule.id}>{describeRule(rule)}</li>)}
                    </ul>
                  </td>
                  <td>{statusBadge(row.isActive)}</td>
                  <td>
                    <button className="module-btn small" onClick={() => openEdit(row)}>{t('common.edit')}</button>
                    <button className="module-btn small" onClick={() => toggleArchive(row)}>{row.isActive ? t('common.deactivate') : t('masterData.reactivate', 'Reactivate')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {((tab === 'groupTypes' && groupTypeRows.length === 0) || (tab === 'recordTypes' && recordTypeRows.length === 0)) && (
            <div className="module-loading">
              {tab === 'groupTypes' && !scope ? t('farmProfile.admin.selectScopePrompt') : t('masterData.noEntries', 'No entries yet')}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="edit-form-overlay" onClick={() => setShowModal(false)}>
          <div className="edit-form-panel edit-form-modal" onClick={e => e.stopPropagation()}>
            <button className="edit-form-close" onClick={() => setShowModal(false)} aria-label={t('common.close', 'Close')}>✕</button>
            <h2>{editingId ? t('masterData.editEntry', 'Edit Entry') : t('masterData.addNew', 'Add New')}</h2>

            <div className="module-form-group">
              <label className="module-label">{t('masterData.col.value', 'Value (internal code)')}</label>
              <input className="module-input" value={(tab === 'groupTypes' ? formData.value : formData.code) || ''} disabled={!!editingId || tab === 'recordTypes'}
                onChange={e => setField('value', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} placeholder="lactating" />
              {tab === 'groupTypes' && !editingId && <p className="module-hint md-hint">{t('farmProfile.admin.groupTypeValueHint')}</p>}
            </div>
            <div className="module-form-group">
              <label className="module-label">{t('masterData.col.label', 'Label')}</label>
              <input className="module-input" value={formData.label || ''} onChange={e => setField('label', e.target.value)} />
            </div>
            <p className="module-hint md-hint">{t('farmProfile.admin.localeLabelsHint')}</p>
            {LOCALE_LABEL_FIELDS.map(({ field, col }) => (
              <div className="module-form-group" key={field}>
                <label className="module-label">{t(col)}</label>
                <input className="module-input" value={formData[field] || ''} onChange={e => setField(field, e.target.value)} />
              </div>
            ))}
            <div className="module-form-group">
              <label className="module-label">{t('masterData.col.icon', 'Icon (emoji)')}</label>
              <input className="module-input" value={formData.icon || ''} onChange={e => setField('icon', e.target.value)} maxLength={10} />
            </div>

            {tab === 'groupTypes' && (
              <>
                <div className="module-form-group">
                  <label className="module-label">{t('farmProfile.admin.col.managementMode')}</label>
                  <select className="module-input" value={formData.managementMode || ''} onChange={e => setField('managementMode', e.target.value)}>
                    <option value="">{t('farmProfile.admin.modeNone')}</option>
                    <option value="individual">{t('farmProfile.modes.individual')}</option>
                    <option value="batch">{t('farmProfile.modes.batch')}</option>
                  </select>
                </div>
                {scopeSpeciesId && (
                  <div className="module-form-group">
                    <label className="module-label">{t('farmProfile.admin.col.suggestedClass')}</label>
                    <select className="module-input" value={formData.suggestedClass || ''} onChange={e => setField('suggestedClass', e.target.value)}>
                      <option value="">{t('farmProfile.admin.none')}</option>
                      {classOptions.map(c => <option key={c.value} value={c.value}>{resolveLabel(c, t) || c.value}</option>)}
                    </select>
                    <p className="module-hint md-hint">{t('farmProfile.admin.suggestedClassHint')}</p>
                  </div>
                )}
                <label className="checkbox-label">
                  <input type="checkbox" checked={!!formData.isHealthHold} onChange={e => setField('isHealthHold', e.target.checked)} />
                  {t('farmProfile.admin.col.isHealthHold')}
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={!!formData.yieldsMilk} onChange={e => setField('yieldsMilk', e.target.checked)} />
                  {t('farmProfile.admin.col.yieldsMilk')}
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={!!formData.yieldsEggs} onChange={e => setField('yieldsEggs', e.target.checked)} />
                  {t('farmProfile.admin.col.yieldsEggs')}
                </label>
              </>
            )}

            {tab === 'recordTypes' && (
              <div className="module-form-group">
                <label className="module-label">{t('farmProfile.admin.col.unit')}</label>
                <input className="module-input" value={formData.unit || ''} onChange={e => setField('unit', e.target.value)} maxLength={20} />
              </div>
            )}

            <div className="module-form-group">
              <label className="module-label">{t('masterData.col.sortOrder', 'Sort order')}</label>
              <input type="number" inputMode="numeric" className="module-input" value={formData.sortOrder ?? 0}
                onChange={e => setField('sortOrder', parseInt(e.target.value, 10) || 0)} />
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
              <button type="button" className="btn btn-primary" disabled={saving || !formData.label || (tab === 'groupTypes' && !formData.value)} onClick={save}>
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default FarmMasterDataTabs
