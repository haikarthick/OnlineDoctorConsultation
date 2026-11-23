import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import WalkInRegisterForm, { type WalkInForm } from './WalkInRegisterForm'

/** NUT-222: a hospital walk-in pet is asked whether it is neutered; unanswered stays unanswered (null), never "no". */
const t = ((key: string) => key) as any

const empty: WalkInForm = {
  ownerName: '', ownerPhone: '', ownerEmail: '', ownerAddress: '', animalName: '', animalSpecies: '', animalBreed: '',
  animalGender: '', animalClass: '', animalDob: '', animalWeight: '', animalColor: '', animalMicrochipId: '',
  animalRegistrationNumber: '', animalIsNeutered: null, animalMedicalNotes: '', animalInsuranceProvider: '',
  animalInsurancePolicyNumber: '', animalInsuranceExpiry: '', animalEarTagId: '', animalCustomBreed: '',
}

let latest: WalkInForm = empty
const Harness = () => {
  const [form, setForm] = useState<WalkInForm>(empty)
  latest = form
  return (
    <WalkInRegisterForm
      walkInForm={form} setWalkInForm={setForm} walkInPhotoPreview="" setWalkInPhotoFile={vi.fn()} setWalkInPhotoPreview={vi.fn()}
      walkInError="" walkInRegistering={false} walkInFormValid handleWalkInRegister={vi.fn()} onBackToSearch={vi.fn()}
      speciesCategories={[]} breedsForSpecies={() => []} breedLabel={(_s, b) => b} classTermsForSpecies={() => []}
      findClassTerm={() => undefined} earTagSpecies={[]} speciesLabel={s => s} resolveLabel={(x: any) => x?.labelKey || ''} t={t}
    />
  )
}

describe('walk-in registration: neutered', () => {
  it('starts unanswered, keeps the answer, and can be cleared again', () => {
    render(<Harness />)
    expect(latest.animalIsNeutered).toBeNull()
    fireEvent.click(screen.getByText('nutrition.options.no'))
    expect(latest.animalIsNeutered).toBe(false)
    fireEvent.click(screen.getByText('nutrition.options.yes'))
    expect(latest.animalIsNeutered).toBe(true)
  })
})
