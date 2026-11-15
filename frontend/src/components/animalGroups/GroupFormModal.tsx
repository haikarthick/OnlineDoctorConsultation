import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AnimalGroup } from '../../types'
import { useMasterData } from '../../context/MasterDataContext'
import { useFarmProfile } from '../../hooks/useFarmProfile'
import type { SaveStatus } from '../../hooks/useSaveAction'
import { ChipSelect } from '../mobile/ChipSelect'
import { NumberStepper } from '../mobile/NumberStepper'
import { SaveState } from '../mobile/SaveState'
import { SpeciesPicker } from '../mobile/SpeciesPicker'
import { StepForm, type FormStep } from '../mobile/StepForm'
import { GROUP_PURPOSES, type GroupFormData } from './groupShared'

interface Props {
  form: GroupFormData
  setForm: React.Dispatch<React.SetStateAction<GroupFormData>>
  editingGroup: AnimalGroup | null
  onClose: () => void
  onSubmit: () => void
  saveStatus: SaveStatus
  saveError: string
  saveOffline: boolean
  onRetry: () => void
  speciesCategories: Array<{ label: string; species: string[] }>
}

/** Legacy generic group kinds, for a species that has no group types of its own (and old groups). */
const LEGACY_TYPES = ['herd', 'flock', 'pen', 'paddock', 'enclosure', 'tank', 'aviary', 'kennel_group', 'breeding_group', 'quarantine', 'nursery', 'production', 'other']

/**
 * Create or edit a group, as short steps. The group types offered, and whether the group is kept
 * animal by animal or as a whole, come from master data for the species chosen - there is no list
 * of species or group names in this file. Steps are data: reorder or add one in `steps` below.
 */
const GroupFormModal: React.FC<Props> = ({ form, setForm, editingGroup, onClose, onSubmit, saveStatus, saveError, saveOffline, onRetry, speciesCategories }) => {
  const { t } = useTranslation()
  const { groupTypesForSpecies, groupTypeLabel, groupTypeIcon, resolveLabel, breedsForSpecies, breedLabel } = useMasterData()
  const [step, setStep] = useState(0)
  const [showMore, setShowMore] = useState(false)
  const { profile } = useFarmProfile({
    speciesCode: form.species, groupType: form.groupType, managementMode: form.managementMode || undefined,
  })

  const masterTypes = groupTypesForSpecies(form.species)
  const breeds = useMemo(() => breedsForSpecies(form.species), [breedsForSpecies, form.species])
  const set = <K extends keyof GroupFormData>(key: K, value: GroupFormData[K]) => setForm(f => ({ ...f, [key]: value }))

  const typeOptions = useMemo(() => {
    const options = masterTypes.map(g => ({ value: g.value, label: resolveLabel(g, t), icon: g.icon || undefined }))
    // A group saved with a value that is not in the list (an older group) keeps its own chip so
    // editing it does not silently change its type.
    if (form.groupType && !options.some(o => o.value === form.groupType)) {
      options.push({ value: form.groupType, label: groupTypeLabel(form.species, form.groupType, t), icon: groupTypeIcon(form.species, form.groupType) || undefined })
    }
    return options
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterTypes, form.groupType, form.species, t])

  const pickSpecies = (code: string) => setForm(f => ({ ...f, species: code, groupType: '', breed: '', managementMode: '' }))
  const pickType = (value: string) => setForm(f => ({
    ...f, groupType: value, managementMode: '',
    // A name is required; offer the type's own name as a start rather than an empty box.
    name: f.name || groupTypeLabel(f.species, value, t),
  }))

  const isBatch = profile.managementMode === 'batch'

  const whatStep: FormStep = {
    id: 'what',
    title: t('farmProfile.groupForm.stepWhat'),
    blockedReason: !form.species && !form.groupType ? t('farmProfile.groupForm.chooseSpeciesFirst') : !form.groupType ? t('farmProfile.groupForm.chooseType') : '',
    content: (
      <>
        <SpeciesPicker label={t('farmProfile.groupForm.animals')} categories={speciesCategories} value={form.species} onChange={pickSpecies} preferFarm />
        {form.species && typeOptions.length > 0 && (
          <ChipSelect label={t('farmProfile.groupForm.whatFor')} options={typeOptions} value={form.groupType} onChange={pickType} />
        )}
        {form.species && typeOptions.length === 0 && (
          <div>
            <label className="an-field-label" htmlFor="group-kind">{t('farmProfile.groupForm.kindOfGroup')}</label>
            <select id="group-kind" className="an-field" value={form.groupType} onChange={e => pickType(e.target.value)}>
              <option value="">{t('animalGroups.modal.selectType')}</option>
              {LEGACY_TYPES.map(v => <option key={v} value={v}>{groupTypeLabel(form.species, v, t)}</option>)}
            </select>
          </div>
        )}
        {form.groupType && (
          editingGroup ? (
            <p className="an-field-hint">{t('farmProfile.groupForm.modeLocked')}</p>
          ) : (
            <>
              <ChipSelect
                label={t('farmProfile.groupForm.modeLabel')}
                variant="segmented"
                options={[
                  { value: 'individual', label: t('farmProfile.groupForm.modeIndividual') },
                  { value: 'batch', label: t('farmProfile.groupForm.modeBatch') },
                ]}
                value={profile.managementMode}
                onChange={v => set('managementMode', v as GroupFormData['managementMode'])}
              />
              <p className="an-field-hint">{t(isBatch ? 'farmProfile.groupForm.modeHintBatch' : 'farmProfile.groupForm.modeHintIndividual')}</p>
            </>
          )
        )}
      </>
    ),
  }

  const detailsStep: FormStep = {
    id: 'details',
    title: t('farmProfile.groupForm.stepDetails'),
    blockedReason: !form.name.trim() ? t('farmProfile.groupForm.enterName') : '',
    content: (
      <>
        <div>
          <label className="an-field-label" htmlFor="group-name">{t('animalGroups.modal.name')}</label>
          <input id="group-name" type="text" className="an-field" value={form.name} onChange={e => set('name', e.target.value)} autoComplete="off" />
        </div>
        {breeds.length > 0 && (
          <div>
            <label className="an-field-label" htmlFor="group-breed">{t('animalGroups.modal.breed')}</label>
            <select id="group-breed" className="an-field" value={form.breed} onChange={e => set('breed', e.target.value)}>
              <option value="">{t('animals.registerModal.selectBreed')}</option>
              {form.breed && !breeds.includes(form.breed) && <option value={form.breed}>{form.breed}</option>}
              {breeds.map(b => <option key={b} value={b}>{breedLabel(form.species, b)}</option>)}
            </select>
          </div>
        )}
        <NumberStepper
          label={t('farmProfile.groupForm.plannedCount')}
          value={form.targetCount}
          onChange={v => set('targetCount', v)}
          integer step={isBatch ? 100 : 1} max={10000000}
          hint={t('farmProfile.groupForm.plannedHint')}
        />
        <button type="button" className="choice-chip" aria-expanded={showMore} onClick={() => setShowMore(v => !v)}>
          {showMore ? t('farmProfile.form.lessDetails') : t('farmProfile.form.moreDetails')}
        </button>
        {showMore && (
          <>
            <div>
              <label className="an-field-label" htmlFor="group-purpose">{t('farmProfile.groupForm.purpose')}</label>
              <select id="group-purpose" className="an-field" value={form.purpose} onChange={e => set('purpose', e.target.value)}>
                <option value="">{t('farmProfile.groupForm.noPurpose')}</option>
                {form.purpose && !(GROUP_PURPOSES as readonly string[]).includes(form.purpose) && <option value={form.purpose}>{form.purpose}</option>}
                {GROUP_PURPOSES.map(p => <option key={p} value={p}>{t(`farmProfile.purposes.${p}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="an-field-label" htmlFor="group-color">{t('animalGroups.modal.colorCode')}</label>
              <input id="group-color" type="color" className="an-color-input" value={form.colorCode} onChange={e => set('colorCode', e.target.value)} />
            </div>
            <div>
              <label className="an-field-label" htmlFor="group-description">{t('animalGroups.modal.description')}</label>
              <textarea id="group-description" rows={2} className="an-field an-field--textarea" value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
          </>
        )}
      </>
    ),
  }

  const steps: FormStep[] = [whatStep, detailsStep]

  return (
    <div className="edit-form-overlay" onClick={onClose}>
      <div className="edit-form-panel edit-form-modal" onClick={e => e.stopPropagation()}>
        <button className="edit-form-close" onClick={onClose} aria-label={t('mobileUi.close')}>✕</button>
        <h2>{editingGroup ? t('animalGroups.modal.editTitle') : t('animalGroups.modal.createTitle')}</h2>
        <StepForm
          steps={steps}
          current={step}
          onStepChange={setStep}
          onSubmit={onSubmit}
          submitLabel={editingGroup ? t('animalGroups.modal.updateBtn') : t('animalGroups.modal.createBtn')}
          busy={saveStatus === 'saving'}
          saveNowLabel={editingGroup ? t('farmProfile.form.saveNow') : undefined}
          onCancel={onClose}
          footer={<SaveState status={saveStatus} error={saveError} offline={saveOffline} onRetry={onRetry} />}
        />
      </div>
    </div>
  )
}

export default GroupFormModal
