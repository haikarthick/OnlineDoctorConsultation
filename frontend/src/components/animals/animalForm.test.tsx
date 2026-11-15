import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import AnimalFormModal from './AnimalFormModal'
import { SubjectSummary, subjectFromPrescription } from '../shared/SubjectSummary'
import { emptyAnimalFormData, buildAnimalPayload, animalToFormData, type AnimalFormData } from './animalsShared'
import { resolveFarmProfile } from '../../utils/farmProfile/resolveFarmProfile'
import { FARM_MASTER } from '../../test/farmMasterFixture'

const t = ((key: string, opts?: Record<string, unknown>) => (opts?.current ? `${key}:${opts.current}/${opts.total}` : key)) as any

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }))
vi.mock('../../context/SettingsContext', () => ({ useSettings: () => ({ formatDate: (d: string) => `fmt:${d}` }) }))
vi.mock('../../context/MasterDataContext', async () => {
  const { FARM_MASTER: master } = await import('../../test/farmMasterFixture')
  const classes: Record<string, any[]> = {
    Cattle: [{ value: 'cattle_cow', labelKey: 'c.cow', impliedGender: 'female', canBePregnant: true, canProduceMilk: true }, { value: 'cattle_bull', labelKey: 'c.bull', impliedGender: 'male', canBePregnant: false, canProduceMilk: false }],
    Dog: [],
  }
  return {
    useMasterData: () => ({
      farmMaster: master, farmMasterLoaded: true,
      speciesLabel: (s: string) => s, breedLabel: (_s: string, b: string) => b, speciesIcon: () => '*',
      findClassTerm: (sp: string, v: string) => (classes[sp] || []).find(c => c.value === v),
      resolveLabel: (item: any) => item.labelKey,
    }),
  }
})

const profileFor = (species: string, animalClass = '') => resolveFarmProfile(FARM_MASTER, { speciesCode: species, animalClass })

describe('buildAnimalPayload', () => {
  const cow: AnimalFormData = { ...emptyAnimalFormData, name: 'Lakshmi', species: 'Cattle', animalClass: 'cattle_cow', avgDailyMilkLitres: '9,5', parity: '2', breedingStatus: 'pregnant', dryOffDate: '2026-12-01' }

  it('sends the production fields of a cow, reading a decimal comma', () => {
    const p = buildAnimalPayload(cow, profileFor('Cattle', 'cattle_cow'), { editing: false, placementVisible: false })
    expect(p).toMatchObject({ avgDailyMilkLitres: 9.5, parity: 2, breedingStatus: 'pregnant', dryOffDate: '2026-12-01' })
  })

  it('does NOT send what the profile hides - stale values after a class change never reach the server', () => {
    const bull = { ...cow, animalClass: 'cattle_bull' }
    const p = buildAnimalPayload(bull, profileFor('Cattle', 'cattle_bull'), { editing: false, placementVisible: false })
    for (const key of ['avgDailyMilkLitres', 'parity', 'breedingStatus', 'dryOffDate', 'lastBreedingDate', 'expectedDueDate']) expect(p).not.toHaveProperty(key)
  })

  it('on a new animal an empty field is "not given"; on an edit a shown empty field is cleared', () => {
    const blank = { ...cow, avgDailyMilkLitres: '', dryOffDate: '' }
    const created = buildAnimalPayload(blank, profileFor('Cattle', 'cattle_cow'), { editing: false, placementVisible: false })
    expect(created.avgDailyMilkLitres).toBeUndefined()
    expect(created.dryOffDate).toBeUndefined()
    const edited = buildAnimalPayload(blank, profileFor('Cattle', 'cattle_cow'), { editing: true, placementVisible: false })
    expect(edited.avgDailyMilkLitres).toBeNull()
    expect(edited.dryOffDate).toBeNull()
  })

  it('a pet\'s payload has no farm fields at all', () => {
    const dog = { ...emptyAnimalFormData, name: 'Rex', species: 'Dog', avgDailyMilkLitres: '3' }
    const p = buildAnimalPayload(dog, profileFor('Dog'), { editing: false, placementVisible: false })
    expect(p).not.toHaveProperty('avgDailyMilkLitres')
    expect(p).not.toHaveProperty('parity')
  })

  it('placement is sent only when the form shows it, and can be cleared on edit', () => {
    expect(buildAnimalPayload(cow, profileFor('Cattle', 'cattle_cow'), { editing: true, placementVisible: false })).not.toHaveProperty('groupId')
    expect(buildAnimalPayload({ ...cow, groupId: '' }, profileFor('Cattle', 'cattle_cow'), { editing: true, placementVisible: true }).groupId).toBeNull()
    expect(buildAnimalPayload({ ...cow, groupId: 'g1', enterpriseId: 'e1' }, profileFor('Cattle', 'cattle_cow'), { editing: false, placementVisible: true })).toMatchObject({ groupId: 'g1', enterpriseId: 'e1' })
  })

  it('a custom breed is sent under its own name', () => {
    const p = buildAnimalPayload({ ...cow, breed: 'Other', customBreed: 'Local type' }, profileFor('Cattle', 'cattle_cow'), { editing: false, placementVisible: false })
    expect(p.breed).toBe('Local type')
  })

  it('round-trips an animal through the edit form, including DECIMAL strings and ISO dates', () => {
    const form = animalToFormData({ id: 'a', name: 'Lakshmi', species: 'Cattle', breed: 'Kangayam', avgDailyMilkLitres: '9.50', parity: 2, dryOffDate: '2026-12-01T00:00:00.000Z', birthWeight: '24.00' } as any, ['Kangayam'])
    expect(form).toMatchObject({ avgDailyMilkLitres: '9.50', parity: '2', dryOffDate: '2026-12-01', birthWeight: '24.00', breed: 'Kangayam', customBreed: '' })
    expect(animalToFormData({ id: 'a', name: 'x', species: 'Cattle', breed: 'Local' } as any, ['Kangayam'])).toMatchObject({ breed: 'Other', customBreed: 'Local' })
  })
})

describe('SubjectSummary', () => {
  const cow = { name: 'Lakshmi', species: 'Cattle', animalClass: 'cattle_cow', gender: 'female', breedingStatus: 'pregnant', avgDailyMilkLitres: '8.00', parity: 2, expectedDueDate: '2030-01-10' }

  it('shows a cow\'s pregnancy and milk, with a dosing warning for the vet', () => {
    render(<SubjectSummary animal={cow} emphasis />)
    expect(screen.getByText('Lakshmi')).toBeInTheDocument()
    expect(screen.getByText(/animalClass\.pregnant/)).toBeInTheDocument()
    expect(screen.getByText(/farmProfile\.summary\.inMilk/)).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('farmProfile.summary.warnPregnant')
    expect(screen.getByRole('note')).toHaveTextContent('farmProfile.summary.warnLactating')
  })

  it('has no dosing warning outside the vet view', () => {
    render(<SubjectSummary animal={cow} />)
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('a bull shows no milk, births or pregnancy - whatever stale values are stored', () => {
    render(<SubjectSummary animal={{ ...cow, name: 'Raja', animalClass: 'cattle_bull', gender: 'male' }} emphasis />)
    expect(screen.queryByText(/inMilk/)).toBeNull()
    expect(screen.queryByText(/births/)).toBeNull()
    expect(screen.queryByText(/animalClass\.pregnant/)).toBeNull()
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('a status the animal screens do not know is never shown as a raw key', () => {
    render(<SubjectSummary animal={{ ...cow, breedingStatus: 'confirmed_pregnant', avgDailyMilkLitres: null }} emphasis />)
    expect(screen.queryByText(/animalClass\./)).toBeNull()
  })

  it('renders nothing for no animal, and adapts a prescription row', () => {
    const { container } = render(<SubjectSummary animal={null} />)
    expect(container).toBeEmptyDOMElement()
    expect(subjectFromPrescription({ animalName: 'Lakshmi', animalSpecies: 'Cattle', animalBreedingStatus: 'pregnant', animalAvgMilkLitres: '8.00', animalDueDate: '2030-01-10' })).toMatchObject({ name: 'Lakshmi', species: 'Cattle', breedingStatus: 'pregnant', avgDailyMilkLitres: '8.00', expectedDueDate: '2030-01-10' })
    expect(subjectFromPrescription(null)).toBeNull()
  })

  it('shows the farm only when asked', () => {
    const withFarm = { ...cow, enterpriseName: 'Kumar Dairy', groupName: 'Lactating cows' }
    const { rerender } = render(<SubjectSummary animal={withFarm} showFarm />)
    expect(screen.getByText(/Kumar Dairy › Lactating cows/)).toBeInTheDocument()
    rerender(<SubjectSummary animal={withFarm} />)
    expect(screen.queryByText(/Kumar Dairy/)).toBeNull()
  })
})

describe('AnimalFormModal', () => {
  const Harness = ({ farmer = true, editing = false, onSubmit = () => {}, saveStatus = 'idle' as any, saveError = '', saveOffline = false, onRetry = () => {} }) => {
    const [form, setForm] = useState<AnimalFormData>(editing ? { ...emptyAnimalFormData, name: 'Lakshmi', species: 'Cattle', animalClass: 'cattle_cow' } : emptyAnimalFormData)
    return (
      <AnimalFormModal
        formRef={{ current: null }} formData={form} setFormData={setForm}
        editingAnimal={editing ? ({ id: 'a1', name: 'Lakshmi' } as any) : null}
        onClose={() => {}} onSubmit={onSubmit} isSubmitting={saveStatus === 'saving'}
        saveStatus={saveStatus} saveError={saveError} saveOffline={saveOffline} onRetry={onRetry}
        breeds={['Kangayam']} showEarTag speciesCategories={[{ label: 'Livestock', species: ['Cattle', 'Dog'] }]}
        classTermsForSpecies={(s: string) => (s === 'Cattle' ? [{ value: 'cattle_cow', labelKey: 'c.cow', impliedGender: 'female', canBePregnant: true, canProduceMilk: true }, { value: 'cattle_bull', labelKey: 'c.bull', impliedGender: 'male', canBePregnant: false, canProduceMilk: false }] : [])}
        findClassTerm={(s: string, v: string) => (s === 'Cattle' ? ({ cattle_cow: { value: 'cattle_cow', impliedGender: 'female' }, cattle_bull: { value: 'cattle_bull', impliedGender: 'male' } } as any)[v] : undefined)}
        breedLabel={(_s: any, b: string) => b} resolveLabel={(item: any) => item.labelKey} speciesIcon={() => '*'} speciesLabel={(s: any) => s}
        isFarmer={farmer} isAdmin={false} enterpriseOptions={[]} groupOptions={[]} animals={[]} navigate={() => {}} t={t}
      />
    )
  }

  it('cannot go on until an animal and a name are chosen, and says why', () => {
    render(<Harness />)
    expect(screen.getByText('farmProfile.form.chooseAnimalFirst')).toBeInTheDocument()
    expect(screen.getByText('mobileUi.step.next')).toBeDisabled()
    fireEvent.click(screen.getByText('Cattle'))
    expect(screen.getByText('farmProfile.form.enterName')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('animals.registerModal.name'), { target: { value: 'Lakshmi' } })
    expect(screen.getByText('mobileUi.step.next')).not.toBeDisabled()
  })

  it('a cow gets the milk-and-breeding step; a bull does not', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('Cattle'))
    fireEvent.change(screen.getByLabelText('animals.registerModal.name'), { target: { value: 'Lakshmi' } })
    fireEvent.click(screen.getByText('c.cow'))
    expect(screen.getByText('mobileUi.step.stepOf:1/3')).toBeInTheDocument()
    fireEvent.click(screen.getByText('c.bull'))
    expect(screen.getByText('mobileUi.step.stepOf:1/2')).toBeInTheDocument()
  })

  it('choosing a class fills in the gender it implies', () => {
    const submitted: any[] = []
    render(<Harness onSubmit={() => submitted.push(1)} />)
    fireEvent.click(screen.getByText('Cattle'))
    fireEvent.click(screen.getByText('c.bull'))
    // no gender question is shown once a class decides it
    expect(screen.queryByText('animals.registerModal.gender')).toBeNull()
  })

  it('a pet (no classes) is asked for gender instead, and gets no milk step', () => {
    render(<Harness farmer={false} />)
    fireEvent.click(screen.getByText('Dog'))
    expect(screen.getByText('animals.registerModal.gender')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('animals.registerModal.name'), { target: { value: 'Rex' } })
    expect(screen.getByText('mobileUi.step.stepOf:1/2')).toBeInTheDocument()
  })

  it('walks forward to the milk step and shows the milk fields for a cow', () => {
    render(<Harness editing />)
    fireEvent.click(screen.getByText('mobileUi.step.next'))
    fireEvent.click(screen.getByText('mobileUi.step.next'))
    expect(screen.getByText('farmProfile.fieldLabels.avgDailyMilk')).toBeInTheDocument()
    expect(screen.getByText('farmProfile.fieldLabels.parity')).toBeInTheDocument()
    expect(screen.getByText('animalClass.breedingStatus')).toBeInTheDocument()
  })

  it('editing offers "save now" so one change does not mean walking every step', () => {
    const onSubmit = vi.fn()
    render(<Harness editing onSubmit={onSubmit} />)
    fireEvent.click(screen.getByText('farmProfile.form.saveNow'))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('a new animal has no "save now" (it needs its steps)', () => {
    render(<Harness />)
    expect(screen.queryByText('farmProfile.form.saveNow')).toBeNull()
  })

  it('a failed save keeps the form, shows the server\'s own message and offers Retry', () => {
    const retry = vi.fn()
    render(<Harness editing saveStatus="failed" saveError="medicine withdrawal in force" onRetry={retry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('medicine withdrawal in force')
    expect(screen.getByLabelText('animals.registerModal.name')).toHaveValue('Lakshmi')
    fireEvent.click(screen.getByText('mobileUi.save.retry'))
    expect(retry).toHaveBeenCalled()
  })
})
