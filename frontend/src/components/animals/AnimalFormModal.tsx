import React, { useMemo, useState } from 'react'
import type { TFunction } from 'i18next'
import type { AnimalClassTerm } from '../../constants/speciesBreeds'
import { type AnimalData, type AnimalFormData, type EnterpriseOption, type GroupOption } from './animalsShared'
import { useMasterData } from '../../context/MasterDataContext'
import { useFarmProfile } from '../../hooks/useFarmProfile'
import type { SaveStatus } from '../../hooks/useSaveAction'
import { BREEDING_STATUSES, breedingStatusLabelKey } from '../../constants/breedingStatus'
import { ChipSelect } from '../mobile/ChipSelect'
import { NumberStepper } from '../mobile/NumberStepper'
import { SaveState } from '../mobile/SaveState'
import { StepForm, type FormStep } from '../mobile/StepForm'

interface SpeciesCategory { label: string; species: string[] }

interface Props {
  formRef: React.RefObject<HTMLDivElement>
  formData: AnimalFormData
  setFormData: React.Dispatch<React.SetStateAction<AnimalFormData>>
  editingAnimal: AnimalData | null
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  isSubmitting: boolean
  /** Save state for the footer line (saving / failed with the server's message / offline). */
  saveStatus: SaveStatus
  saveError: string
  saveOffline: boolean
  onRetry: () => void
  breeds: string[]
  showEarTag: boolean
  speciesCategories: SpeciesCategory[]
  classTermsForSpecies: (species: string) => AnimalClassTerm[]
  findClassTerm: (species: string, value: string) => AnimalClassTerm | undefined
  breedLabel: (species: string | undefined, breed: string) => string
  resolveLabel: (item: AnimalClassTerm, t: (key: string) => string) => string
  speciesIcon: (species?: string) => string
  speciesLabel: (species: string | undefined, t: TFunction) => string
  isFarmer: boolean
  isAdmin: boolean
  enterpriseOptions: EnterpriseOption[]
  groupOptions: GroupOption[]
  animals: AnimalData[]
  navigate: (path: string) => void
  t: TFunction
}

const FEATURED_SPECIES = 6
/** The segments whose animals a farmer keeps most often - offered as one-tap species. */
const COMMON_FARM_SEGMENTS = ['dairy', 'small_ruminant', 'pig', 'poultry']

const today = () => new Date().toISOString().split('T')[0]

/** Adds `days` to an ISO date, in local calendar terms. */
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const next = new Date(y, m - 1, d + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`
}

const AnimalFormModal: React.FC<Props> = ({
  formRef, formData, setFormData, editingAnimal, onClose, onSubmit, isSubmitting,
  saveStatus, saveError, saveOffline, onRetry,
  breeds, showEarTag, speciesCategories, classTermsForSpecies, findClassTerm, breedLabel,
  resolveLabel, speciesIcon, speciesLabel, isFarmer, isAdmin, enterpriseOptions, groupOptions,
  animals, navigate, t
}) => {
  const { farmMaster } = useMasterData()
  const { profile } = useFarmProfile({ speciesCode: formData.species, animalClass: formData.animalClass, gender: formData.gender })
  const [step, setStep] = useState(0)
  const [showMore, setShowMore] = useState(false)
  const [showAllSpecies, setShowAllSpecies] = useState(false)

  const set = <K extends keyof AnimalFormData>(key: K, value: AnimalFormData[K]) => setFormData(p => ({ ...p, [key]: value }))
  const classTerms = classTermsForSpecies(formData.species)
  const fieldShown = (f: keyof typeof profile.fields) => profile.fields[f] !== 'hidden'

  // One-tap species: farm animals first for a farmer (read from master data, not a species list in
  // code), the first few of the picker order for everyone else. The chosen species always shows.
  const featured = useMemo(() => {
    const all = speciesCategories.flatMap(c => c.species)
    const segmentOf = new Map(farmMaster.species.map(s => [s.code, s.farmSegment as string]))
    const pool = isFarmer ? all.filter(code => COMMON_FARM_SEGMENTS.includes(segmentOf.get(code) || '')) : all
    const picked = pool.slice(0, FEATURED_SPECIES)
    if (formData.species && !picked.includes(formData.species)) picked.push(formData.species)
    return picked
  }, [speciesCategories, farmMaster.species, isFarmer, formData.species])

  const today_ = today()
  const dueFromBreeding = (breedingDate: string): string => {
    const days = profile.reproduction.gestationDays
    return breedingDate && days ? addDays(breedingDate, days) : ''
  }

  const showProduction = fieldShown('pregnancyStatus') || fieldShown('avgDailyMilk') || fieldShown('parity') || fieldShown('dryOffDate')
  const showPlacement = (isFarmer || isAdmin) && enterpriseOptions.length > 0
  const statusOptions = BREEDING_STATUSES.map(s => ({ value: s, label: t(breedingStatusLabelKey(s) as string) }))

  const speciesSelect = (
    <select value={formData.species} onChange={e => setFormData(p => ({ ...p, species: e.target.value, breed: '', customBreed: '', animalClass: '' }))} className="an-field" aria-label={t('animals.registerModal.species')}>
      <option value="">{t('animals.form.selectSpecies')}</option>
      {speciesCategories.map(cat => (
        <optgroup key={cat.label} label={cat.label}>
          {cat.species.map(s => <option key={s} value={s}>{speciesIcon(s)} {speciesLabel(s, t)}</option>)}
        </optgroup>
      ))}
    </select>
  )

  const whoStep: FormStep = {
    id: 'who',
    title: t('farmProfile.form.stepWho'),
    blockedReason: !formData.species ? t('farmProfile.form.chooseAnimalFirst') : !formData.name.trim() ? t('farmProfile.form.enterName') : '',
    content: (
      <>
        <ChipSelect
          label={t('farmProfile.form.which')}
          options={[
            ...featured.map(code => ({ value: code, label: speciesLabel(code, t), icon: speciesIcon(code) })),
          ]}
          value={formData.species}
          onChange={code => setFormData(p => ({ ...p, species: code, breed: '', customBreed: '', animalClass: '' }))}
        />
        <div>
          <button type="button" className="choice-chip" aria-expanded={showAllSpecies} onClick={() => setShowAllSpecies(v => !v)}>
            {t('farmProfile.form.moreSpecies')}
          </button>
          {showAllSpecies && <div className="an-more-species">{speciesSelect}</div>}
        </div>

        {formData.species && (classTerms.length > 0 ? (
          <ChipSelect
            label={t('farmProfile.form.kind')}
            options={classTerms.map(c => ({ value: c.value, label: resolveLabel(c, t) }))}
            value={formData.animalClass}
            allowClear
            onClear={() => set('animalClass', '')}
            onChange={value => {
              const term = findClassTerm(formData.species, value)
              setFormData(p => ({ ...p, animalClass: value, gender: term?.impliedGender && term.impliedGender !== 'unknown' ? term.impliedGender : p.gender }))
            }}
          />
        ) : (
          <ChipSelect
            label={t('animals.registerModal.gender')}
            variant="segmented"
            options={[{ value: 'male', label: t('animals.form.male') }, { value: 'female', label: t('animals.form.female') }]}
            value={formData.gender}
            allowClear
            onClear={() => set('gender', '')}
            onChange={value => set('gender', value)}
          />
        ))}

        <div>
          <label className="an-field-label" htmlFor="animal-name">{t('animals.registerModal.name')}</label>
          <input id="animal-name" type="text" value={formData.name} onChange={e => set('name', e.target.value)} className="an-field" placeholder={t('animals.form.placeholderName')} autoComplete="off" />
        </div>

        {(showEarTag || fieldShown('earTag')) && (
          <div>
            <label className="an-field-label" htmlFor="animal-ear-tag">{t('animals.registerModal.earTag')}</label>
            <input id="animal-ear-tag" type="text" value={formData.earTagId} onChange={e => set('earTagId', e.target.value)} className="an-field" placeholder={t('animals.form.placeholderEarTag')} autoComplete="off" />
          </div>
        )}

        {formData.species && (
          <div>
            <label className="an-field-label" htmlFor="animal-breed">{t('animals.registerModal.breed')}</label>
            {breeds.length > 0 ? (
              <select id="animal-breed" value={formData.breed} onChange={e => setFormData(p => ({ ...p, breed: e.target.value, customBreed: '' }))} className="an-field">
                <option value="">{t('animals.registerModal.selectBreed')}</option>
                {breeds.map(b => <option key={b} value={b}>{breedLabel(formData.species, b)}</option>)}
                <option value="Other">{t('animals.registerModal.otherBreed')}</option>
              </select>
            ) : (
              <input id="animal-breed" type="text" value={formData.customBreed} onChange={e => set('customBreed', e.target.value)} className="an-field" placeholder={t('animals.form.placeholderBreed')} />
            )}
            {formData.breed === 'Other' && (
              <input type="text" value={formData.customBreed} onChange={e => set('customBreed', e.target.value)} className="an-field an-field--follow" aria-label={t('animals.registerModal.customBreed')} placeholder={t('animals.form.placeholderBreedName')} />
            )}
          </div>
        )}
      </>
    ),
  }

  const parentField = (label: string, value: string, key: 'sireId' | 'damId', gender: 'male' | 'female', none: string) => (
    <div key={key}>
      <label className="an-field-label" htmlFor={`animal-${key}`}>{label}</label>
      <select id={`animal-${key}`} value={value} onChange={e => set(key, e.target.value)} className="an-field">
        <option value="">{none}</option>
        {animals.filter(a => a.species === formData.species && a.gender === gender && a.id !== editingAnimal?.id).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
    </div>
  )

  const detailsStep: FormStep = {
    id: 'details',
    title: t('farmProfile.form.stepDetails'),
    content: (
      <>
        <div>
          <label className="an-field-label" htmlFor="animal-dob">{t('animals.registerModal.dob')}</label>
          <input id="animal-dob" type="date" value={formData.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} className="an-field" max={today_} />
        </div>
        <NumberStepper label={`${t('animals.registerModal.weight')}`} value={formData.weight} onChange={v => set('weight', v)} step={1} unit="kg" />
        {profile.fields.birthWeight === 'optional' && (
          <NumberStepper label={t('farmProfile.fieldLabels.birthWeight')} value={formData.birthWeight} onChange={v => set('birthWeight', v)} step={0.5} unit="kg" />
        )}
        {parentField(t('animalClass.sire'), formData.sireId, 'sireId', 'male', t('animalClass.selectSire'))}
        {parentField(t('animalClass.dam'), formData.damId, 'damId', 'female', t('animalClass.selectDam'))}

        <button type="button" className="choice-chip" aria-expanded={showMore} onClick={() => setShowMore(v => !v)}>
          {showMore ? t('farmProfile.form.lessDetails') : t('farmProfile.form.moreDetails')}
        </button>
        {showMore && (
          <>
            {profile.fields.birthWeight === 'more' && (
              <NumberStepper label={t('farmProfile.fieldLabels.birthWeight')} value={formData.birthWeight} onChange={v => set('birthWeight', v)} step={0.5} unit="kg" />
            )}
            <div>
              <label className="an-field-label" htmlFor="animal-color">{t('animals.registerModal.color')}</label>
              <input id="animal-color" type="text" value={formData.color} onChange={e => set('color', e.target.value)} className="an-field" placeholder={t('animals.form.placeholderColor')} />
            </div>
            <label className="checkbox-label">
              <input type="checkbox" checked={formData.isNeutered} onChange={e => set('isNeutered', e.target.checked)} />
              {t('animals.registerModal.neutered')}
            </label>
            <div>
              <label className="an-field-label" htmlFor="animal-microchip">{t('animals.registerModal.microchip')}</label>
              <input id="animal-microchip" type="text" value={formData.microchipId} onChange={e => set('microchipId', e.target.value)} className="an-field" placeholder={t('animals.form.placeholderMicrochip')} />
            </div>
            <div>
              <label className="an-field-label" htmlFor="animal-reg">{t('animals.registerModal.regNumber')}</label>
              <input id="animal-reg" type="text" value={formData.registrationNumber} onChange={e => set('registrationNumber', e.target.value)} className="an-field" placeholder={t('animals.form.placeholderRegNumber')} />
            </div>
            <div>
              <label className="an-field-label" htmlFor="animal-ins">{t('animals.registerModal.insuranceProvider')}</label>
              <input id="animal-ins" type="text" value={formData.insuranceProvider} onChange={e => set('insuranceProvider', e.target.value)} className="an-field" placeholder={t('animals.form.placeholderInsurance')} />
            </div>
            <div>
              <label className="an-field-label" htmlFor="animal-policy">{t('animals.registerModal.policyNumber')}</label>
              <input id="animal-policy" type="text" value={formData.insurancePolicyNumber} onChange={e => set('insurancePolicyNumber', e.target.value)} className="an-field" placeholder={t('animals.form.placeholderPolicy')} />
            </div>
            <div>
              <label className="an-field-label" htmlFor="animal-expiry">{t('animals.registerModal.policyExpiry')}</label>
              <input id="animal-expiry" type="date" value={formData.insuranceExpiry} onChange={e => set('insuranceExpiry', e.target.value)} className="an-field" />
              {formData.insuranceExpiry && new Date(formData.insuranceExpiry) < new Date() && <span className="an-field-warn">{t('animals.registerModal.policyExpired')}</span>}
            </div>
            <div>
              <label className="an-field-label" htmlFor="animal-notes">{t('animals.sections.medicalNotes')}</label>
              <textarea id="animal-notes" value={formData.medicalNotes} onChange={e => set('medicalNotes', e.target.value)} rows={3} className="an-field an-field--textarea" placeholder={t('animals.form.placeholderMedical')} />
            </div>
          </>
        )}
      </>
    ),
  }

  const productionStep: FormStep = {
    id: 'production',
    title: t('farmProfile.form.stepProduction'),
    content: (
      <>
        {fieldShown('pregnancyStatus') && (
          <>
            <ChipSelect
              label={t('animalClass.breedingStatus')}
              options={statusOptions}
              value={formData.breedingStatus}
              allowClear
              onClear={() => set('breedingStatus', '')}
              onChange={v => set('breedingStatus', v)}
            />
            <div>
              <label className="an-field-label" htmlFor="animal-last-bred">{t('animalClass.lastBreedingDate')}</label>
              <input id="animal-last-bred" type="date" value={formData.lastBreedingDate} max={today_} className="an-field"
                onChange={e => {
                  const value = e.target.value
                  setFormData(p => ({ ...p, lastBreedingDate: value, expectedDueDate: p.expectedDueDate || (p.breedingStatus === 'pregnant' || p.breedingStatus === 'bred' ? dueFromBreeding(value) : '') }))
                }} />
            </div>
            {(formData.breedingStatus === 'pregnant' || formData.breedingStatus === 'bred') && (
              <div>
                <label className="an-field-label" htmlFor="animal-due">{t('animalClass.expectedDueDate')}</label>
                <input id="animal-due" type="date" value={formData.expectedDueDate} className="an-field" onChange={e => set('expectedDueDate', e.target.value)} />
                {profile.reproduction.gestationDays ? <span className="an-field-hint">{t('farmProfile.form.dueAuto')}</span> : null}
              </div>
            )}
          </>
        )}
        {fieldShown('parity') && (
          <NumberStepper label={t('farmProfile.fieldLabels.parity')} value={formData.parity} onChange={v => set('parity', v)} integer step={1} max={40}
            hint={t('farmProfile.form.parityHint', { term: t(`farmProfile.birthTerms.${profile.terms.birthEvent}`) })} />
        )}
        {fieldShown('lastBirthDate') && (
          <div>
            <label className="an-field-label" htmlFor="animal-last-birth">{t('farmProfile.fieldLabels.lastBirthDate')}</label>
            <input id="animal-last-birth" type="date" value={formData.lastBirthDate} max={today_} className="an-field" onChange={e => set('lastBirthDate', e.target.value)} />
          </div>
        )}
        {fieldShown('avgDailyMilk') && (
          <NumberStepper label={t('farmProfile.fieldLabels.avgDailyMilk')} value={formData.avgDailyMilkLitres} onChange={v => set('avgDailyMilkLitres', v)} step={0.5} max={200} unit="L"
            hint={t('farmProfile.form.milkHint')} />
        )}
        {fieldShown('dryOffDate') && (
          <div>
            <label className="an-field-label" htmlFor="animal-dry-off">{t('farmProfile.fieldLabels.dryOffDate')}</label>
            <input id="animal-dry-off" type="date" value={formData.dryOffDate} className="an-field" onChange={e => set('dryOffDate', e.target.value)} />
          </div>
        )}
      </>
    ),
  }

  const farmStep: FormStep = {
    id: 'farm',
    title: t('farmProfile.form.stepFarm'),
    content: (
      <>
        <p className="an-field-hint">{t('animals.enterprise.description')}</p>
        <div>
          <label className="an-field-label" htmlFor="animal-farm">{t('animals.enterprise.label')}</label>
          <select id="animal-farm" value={formData.enterpriseId} onChange={e => setFormData(p => ({ ...p, enterpriseId: e.target.value, groupId: '' }))} className="an-field">
            <option value="">{t('animals.enterprise.none')}</option>
            {enterpriseOptions.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
          </select>
        </div>
        {formData.enterpriseId && (
          <div>
            <label className="an-field-label" htmlFor="animal-group">{t('animals.enterprise.herdGroup')}</label>
            <select id="animal-group" value={formData.groupId} onChange={e => set('groupId', e.target.value)} className="an-field">
              <option value="">{t('animals.enterprise.noGroup')}</option>
              {groupOptions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            {groupOptions.length === 0 && (
              <span className="an-field-hint">{t('animals.enterprise.noGroupsFound')}{' '}
                <button type="button" className="an-link-button" onClick={() => navigate('/animal-groups')}>{t('animals.enterprise.createOne')}</button>
              </span>
            )}
          </div>
        )}
      </>
    ),
  }

  // The steps are DATA: add, remove or reorder one here and the progress bar, Back and Next follow.
  const steps: FormStep[] = [whoStep, detailsStep, ...(showProduction ? [productionStep] : []), ...(showPlacement ? [farmStep] : [])]

  return (
    <div className="edit-form-overlay" onClick={onClose}>
      <div ref={formRef} className="edit-form-panel edit-form-modal" onClick={e => e.stopPropagation()}>
        <button className="edit-form-close" onClick={onClose} aria-label={t('mobileUi.close')}>✕</button>
        {editingAnimal && <div className="edit-form-badge">{t('animals.registerModal.editingMode')}</div>}
        <h2>
          {editingAnimal ? `✏️ ${t('animals.registerModal.titleEdit', { name: editingAnimal.name })}` : t('animals.registerModal.titleNew')}
        </h2>
        <StepForm
          steps={steps}
          current={step}
          onStepChange={setStep}
          onSubmit={() => onSubmit({ preventDefault: () => undefined } as React.FormEvent)}
          submitLabel={editingAnimal ? t('animals.registerModal.updateBtn') : t('animals.registerModal.registerBtn')}
          busy={isSubmitting}
          saveNowLabel={editingAnimal ? t('farmProfile.form.saveNow') : undefined}
          onCancel={onClose}
          footer={<SaveState status={saveStatus} error={saveError} offline={saveOffline} onRetry={onRetry} />}
        />
      </div>
    </div>
  )
}

export default AnimalFormModal
