import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import GroupFormModal from './GroupFormModal'
import { emptyGroupForm, buildGroupPayload, groupToFormData, type GroupFormData } from './groupShared'

const t = ((key: string, opts?: Record<string, unknown>) => (opts?.current ? `${key}:${opts.current}/${opts.total}` : key)) as any
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }))

vi.mock('../../context/MasterDataContext', async () => {
  const { FARM_MASTER } = await import('../../test/farmMasterFixture')
  const pig = { code: 'Pig', farmSegment: 'pig', hasEarTag: true, defaultManagementMode: 'individual', producesMilk: false, producesEggs: false, producesWool: false, isAquatic: false, litterExpected: true, gestationDays: 114, incubationDays: null, birthEventTerm: 'farrowing', waterType: null, waterQualityRanges: null }
  const gt = (speciesCode: string, value: string, label: string, mode: string | null, sortOrder: number, icon = '*') => ({
    speciesCode, farmSegment: null, value, managementMode: mode, suggestedClass: null, isHealthHold: false, yieldsMilk: false, yieldsEggs: false, sortOrder, label, labelKey: null, icon,
  })
  const types = [
    gt('Cattle', 'lactating', 'Lactating cows', 'individual', 30), gt('Cattle', 'bulls', 'Bulls', 'individual', 60),
    gt('Pig', 'sows', 'Sows', 'individual', 30), gt('Pig', 'fatteners', 'Fatteners', 'batch', 50),
  ]
  const master = { ...FARM_MASTER, species: [...FARM_MASTER.species, pig], groupTypes: types.map(({ label: _l, labelKey: _k, icon: _i, ...rest }) => rest) }
  const entriesFor = (species?: string | null) => types.filter(g => g.speciesCode === species)
  return {
    useMasterData: () => ({
      farmMaster: master, farmMasterLoaded: true,
      speciesLabel: (s: string) => s, speciesIcon: () => '*',
      groupTypesForSpecies: (s?: string | null) => entriesFor(s),
      groupTypeLabel: (s: string | null | undefined, v: string | null | undefined) => entriesFor(s).find(g => g.value === v)?.label || v || '',
      groupTypeIcon: () => null,
      resolveLabel: (item: any) => item.label,
      breedsForSpecies: (s?: string) => (s === 'Cattle' ? ['Kangayam', 'Cross Breed'] : []),
      breedLabel: (_s: string | undefined, b: string) => b,
    }),
  }
})

const categories = [{ label: 'Livestock', species: ['Cattle', 'Pig'] }]

describe('buildGroupPayload', () => {
  const form: GroupFormData = { ...emptyGroupForm, name: ' Lactating cows ', groupType: 'lactating', species: 'Cattle', targetCount: '20' }

  it('sends the record-keeping style from the resolved profile when creating', () => {
    expect(buildGroupPayload(form, { managementMode: 'individual' }, { editing: false, enterpriseId: 'e1' })).toMatchObject({
      enterpriseId: 'e1', name: 'Lactating cows', groupType: 'lactating', species: 'Cattle', targetCount: 20, managementMode: 'individual',
    })
    expect(buildGroupPayload(form, { managementMode: 'batch' }, { editing: false, enterpriseId: 'e1' }).managementMode).toBe('batch')
  })

  it('never changes an existing group\'s style from the form', () => {
    expect(buildGroupPayload(form, { managementMode: 'batch' }, { editing: true, enterpriseId: 'e1' })).not.toHaveProperty('managementMode')
  })

  it('reads the planned count safely: blank, zero and garbage mean "no plan"', () => {
    for (const v of ['', '0', 'abc', '-5']) {
      expect(buildGroupPayload({ ...form, targetCount: v }, { managementMode: 'individual' }, { editing: false, enterpriseId: 'e1' }).targetCount).toBe(0)
    }
  })

  it('round-trips a saved group through the edit form', () => {
    const back = groupToFormData({ id: 'g', enterpriseId: 'e', name: 'Sows', groupType: 'sows', species: 'Pig', targetCount: 12, managementMode: 'individual', colorCode: '#112233' } as any)
    expect(back).toMatchObject({ name: 'Sows', groupType: 'sows', species: 'Pig', targetCount: '12', colorCode: '#112233', managementMode: 'individual' })
    expect(groupToFormData({ id: 'g', name: 'Old', groupType: 'herd' } as any)).toMatchObject({ targetCount: '', species: '', colorCode: '#4F46E5' })
  })
})

describe('GroupFormModal', () => {
  const Harness = ({ editing = false, saveStatus = 'idle' as any, saveError = '', onSubmit = () => {}, start = emptyGroupForm }: { editing?: boolean; saveStatus?: any; saveError?: string; onSubmit?: () => void; start?: GroupFormData }) => {
    const [form, setForm] = useState<GroupFormData>(start)
    return (
      <GroupFormModal form={form} setForm={setForm} editingGroup={editing ? ({ id: 'g1', name: 'Sows' } as any) : null}
        onClose={() => {}} onSubmit={onSubmit} saveStatus={saveStatus} saveError={saveError} saveOffline={false} onRetry={() => {}}
        speciesCategories={categories} />
    )
  }

  it('cannot go on without an animal, then without a type - and says which', () => {
    render(<Harness />)
    expect(screen.getByText('farmProfile.groupForm.chooseSpeciesFirst')).toBeInTheDocument()
    expect(screen.getByText('mobileUi.step.next')).toBeDisabled()
    fireEvent.click(screen.getByText('Cattle'))
    expect(screen.getByText('farmProfile.groupForm.chooseType')).toBeInTheDocument()
  })

  it('offers the group types of the chosen species, from master data', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('Cattle'))
    expect(screen.getByText('Lactating cows')).toBeInTheDocument()
    expect(screen.getByText('Bulls')).toBeInTheDocument()
    expect(screen.queryByText('Fatteners')).toBeNull() // a pig type is not offered for cattle
    fireEvent.click(screen.getByText('Pig'))
    expect(screen.getByText('Fatteners')).toBeInTheDocument()
    expect(screen.queryByText('Bulls')).toBeNull()
  })

  it('choosing a type starts the name for you, and the type decides the record-keeping style', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('Pig'))
    fireEvent.click(screen.getByText('Sows'))
    expect(screen.getByText('farmProfile.groupForm.modeHintIndividual')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Fatteners'))
    expect(screen.getByText('farmProfile.groupForm.modeHintBatch')).toBeInTheDocument()
    fireEvent.click(screen.getByText('mobileUi.step.next'))
    expect(screen.getByLabelText('animalGroups.modal.name')).toHaveValue('Sows') // started by the first pick, kept when the type changes
  })

  it('the farmer can override the suggested style', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('Pig'))
    fireEvent.click(screen.getByText('Fatteners'))
    fireEvent.click(screen.getByText('farmProfile.groupForm.modeIndividual'))
    expect(screen.getByText('farmProfile.groupForm.modeHintIndividual')).toBeInTheDocument()
  })

  it('changing the species clears a type that no longer applies', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('Pig'))
    fireEvent.click(screen.getByText('Fatteners'))
    fireEvent.click(screen.getByText('Cattle'))
    expect(screen.getByText('farmProfile.groupForm.chooseType')).toBeInTheDocument()
  })

  it('details step: planned count is explained, optional, and needs a name', () => {
    render(<Harness start={{ ...emptyGroupForm, species: 'Cattle', groupType: 'lactating' }} />)
    fireEvent.click(screen.getByText('mobileUi.step.next'))
    expect(screen.getByText('farmProfile.groupForm.enterName')).toBeInTheDocument()
    expect(screen.getByText('animalGroups.modal.createBtn')).toBeDisabled() // the last step's button creates the group
    expect(screen.getByText('farmProfile.groupForm.plannedCount')).toBeInTheDocument()
    expect(screen.getByText('farmProfile.groupForm.plannedHint')).toBeInTheDocument()
    expect(screen.getByLabelText('animalGroups.modal.breed')).toBeInTheDocument() // a picker, not free text
  })

  it('editing: the style is shown as fixed, an older type keeps its own chip, and "save now" is offered', () => {
    const onSubmit = vi.fn()
    render(<Harness editing onSubmit={onSubmit} start={{ ...emptyGroupForm, name: 'Old herd', species: 'Cattle', groupType: 'herd', managementMode: 'individual' }} />)
    expect(screen.getByText('farmProfile.groupForm.modeLocked')).toBeInTheDocument()
    expect(screen.getByText('herd')).toBeInTheDocument() // legacy value not in master data still selectable/shown
    fireEvent.click(screen.getByText('farmProfile.form.saveNow'))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('a failed save keeps the form and shows the server\'s message with Retry', () => {
    render(<Harness editing saveStatus="failed" saveError="That farm already has a group with this name" start={{ ...emptyGroupForm, name: 'Sows', species: 'Pig', groupType: 'sows' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('That farm already has a group with this name')
    expect(screen.getByText('mobileUi.save.retry')).toBeInTheDocument()
  })
})
