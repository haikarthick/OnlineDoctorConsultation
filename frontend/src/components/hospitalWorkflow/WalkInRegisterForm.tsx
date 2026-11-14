import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'

export interface WalkInForm {
  ownerName: string; ownerPhone: string; ownerEmail: string; ownerAddress: string
  animalName: string; animalSpecies: string; animalBreed: string
  animalGender: string; animalClass: string; animalDob: string; animalWeight: string
  animalColor: string; animalMicrochipId: string; animalRegistrationNumber: string
  animalIsNeutered: boolean; animalMedicalNotes: string
  animalInsuranceProvider: string; animalInsurancePolicyNumber: string; animalInsuranceExpiry: string
  animalEarTagId: string; animalCustomBreed: string
}

interface WalkInRegisterFormProps {
  walkInForm: WalkInForm
  setWalkInForm: Dispatch<SetStateAction<WalkInForm>>
  walkInPhotoPreview: string
  setWalkInPhotoFile: Dispatch<SetStateAction<File | null>>
  setWalkInPhotoPreview: Dispatch<SetStateAction<string>>
  walkInError: string
  walkInRegistering: boolean
  walkInFormValid: boolean
  handleWalkInRegister: () => void
  onBackToSearch: () => void
  speciesCategories: any[]
  breedsForSpecies: (species: string) => string[]
  breedLabel: (species: string, breed: string) => string
  classTermsForSpecies: (species: string) => any[]
  findClassTerm: (species: string, value: string) => any
  earTagSpecies: string[]
  speciesLabel: (species: string, t: TFunction) => string
  resolveLabel: (term: any, t: TFunction) => string
  t: TFunction
}

export default function WalkInRegisterForm({
  walkInForm, setWalkInForm, walkInPhotoPreview, setWalkInPhotoFile, setWalkInPhotoPreview,
  walkInError, walkInRegistering, walkInFormValid, handleWalkInRegister, onBackToSearch,
  speciesCategories, breedsForSpecies, breedLabel, classTermsForSpecies, findClassTerm,
  earTagSpecies, speciesLabel, resolveLabel, t,
}: WalkInRegisterFormProps) {
  return (
    <div className="si-7a28b1a9">
      <div className="si-223e4798">
        🐾 {t('hospitalWorkflow.walkIn.instructions')}
      </div>

      {walkInError && (
        <div className="si-dfe9e95d">
          ⚠️ {walkInError}
        </div>
      )}

      {/* Photo upload */}
      <div className="si-1d133837">
        <div
          onClick={() => document.getElementById('walkInPhotoInput')?.click()}
          className={`hw-photo-circle ${walkInPhotoPreview ? 'has-preview' : ''}`}
        >
          {walkInPhotoPreview
            ? <img src={walkInPhotoPreview} alt="preview" className="si-0ece644a" />
            : <span className="si-db109633">🐾</span>
          }
        </div>
        <div>
          <div className="si-2fed5332">{t('hospitalWorkflow.walkIn.animalPhoto')} <span className="si-17788c1c">(optional)</span></div>
          <div className="si-aff656fd">{walkInPhotoPreview ? t('hospitalWorkflow.walkIn.photoChangeHint') : t('hospitalWorkflow.walkIn.photoUploadHint')}</div>
          {walkInPhotoPreview && <button onClick={() => { setWalkInPhotoFile(null); setWalkInPhotoPreview('') }} className="si-8cb303c0">✕ {t('hospitalWorkflow.walkIn.removePhoto')}</button>}
        </div>
        <input id="walkInPhotoInput" type="file" accept="image/*" className="si-d6a2f871" onChange={e => {
          const file = e.target.files?.[0]
          if (!file) return
          setWalkInPhotoFile(file)
          const reader = new FileReader()
          reader.onload = () => setWalkInPhotoPreview(reader.result as string)
          reader.readAsDataURL(file)
          e.target.value = ''
        }} />
      </div>

      {/* Owner Details */}
      <div className="si-9a250e84">
        <div className="si-27da07a6">👤 {t('hospitalWorkflow.walkIn.ownerDetails')}</div>
        <div className="si-51b511c9">
          <div>
            <label className="si-2561596d">{t('hospitalWorkflow.walkIn.ownerName')} <span className="si-f84f41a5">*</span></label>
            <input placeholder={t('hospitalWorkflow.walkIn.ownerNamePlaceholder')} value={walkInForm.ownerName} onChange={e => setWalkInForm(f => ({ ...f, ownerName: e.target.value }))} className="si-d0e0df59" />
          </div>
          <div className="si-347df862">
            <div>
              <label className="si-2561596d">{t('hospitalWorkflow.walkIn.ownerPhone')} <span className="si-17788c1c">(optional)</span></label>
              <input placeholder="+91 9876543210" value={walkInForm.ownerPhone} onChange={e => setWalkInForm(f => ({ ...f, ownerPhone: e.target.value }))} className="si-d0e0df59" />
            </div>
            <div>
              <label className="si-2561596d">{t('hospitalWorkflow.walkIn.ownerEmail')} <span className="si-17788c1c">(optional)</span></label>
              <input placeholder="owner@email.com" type="email" value={walkInForm.ownerEmail} onChange={e => setWalkInForm(f => ({ ...f, ownerEmail: e.target.value }))} className="si-d0e0df59" />
            </div>
          </div>
          <div>
            <label className="si-2561596d">{t('hospitalWorkflow.walkIn.ownerAddress')} <span className="si-17788c1c">(optional)</span></label>
            <input placeholder={t('hospitalWorkflow.walkIn.ownerAddressPlaceholder')} value={walkInForm.ownerAddress} onChange={e => setWalkInForm(f => ({ ...f, ownerAddress: e.target.value }))} className="si-d0e0df59" />
          </div>
        </div>
      </div>

      {/* Patient Details - core */}
      <div className="si-9a250e84">
        <div className="si-27da07a6">🐾 {t('hospitalWorkflow.walkIn.patientDetails')}</div>
        <div className="si-51b511c9">
          <div>
            <label className="si-2561596d">{t('hospitalWorkflow.walkIn.animalName')} <span className="si-f84f41a5">*</span></label>
            <input placeholder={t('hospitalWorkflow.walkIn.animalNamePlaceholder')} value={walkInForm.animalName} onChange={e => setWalkInForm(f => ({ ...f, animalName: e.target.value }))} className="si-d0e0df59" />
          </div>
          <div className="si-347df862">
            <div>
              <label className="si-2561596d">{t('hospitalWorkflow.walkIn.species')} <span className="si-f84f41a5">*</span></label>
              <select value={walkInForm.animalSpecies} onChange={e => setWalkInForm(f => ({ ...f, animalSpecies: e.target.value, animalBreed: '', animalCustomBreed: '' }))} className="si-f3740d1a">
                <option value="">{t('hospitalWorkflow.walkIn.selectSpecies')}</option>
                {speciesCategories.map(cat => (
                  <optgroup key={cat.label} label={cat.label}>
                    {cat.species.map((sp: string) => <option key={sp} value={sp}>{speciesLabel(sp, t)}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="si-2561596d">{t('hospitalWorkflow.walkIn.breed')} <span className="si-17788c1c">(optional)</span></label>
              {breedsForSpecies(walkInForm.animalSpecies).length > 0 ? (
                <select value={walkInForm.animalBreed} onChange={e => setWalkInForm(f => ({ ...f, animalBreed: e.target.value, animalCustomBreed: '' }))} className="si-f3740d1a">
                  <option value="">{t('hospitalWorkflow.walkIn.selectBreed')}</option>
                  {breedsForSpecies(walkInForm.animalSpecies).map(b => <option key={b} value={b}>{breedLabel(walkInForm.animalSpecies, b)}</option>)}
                </select>
              ) : (
                <input placeholder={t('hospitalWorkflow.walkIn.breedPlaceholder')} value={walkInForm.animalBreed} onChange={e => setWalkInForm(f => ({ ...f, animalBreed: e.target.value }))} className="si-d0e0df59" />
              )}
            </div>
          </div>
          {walkInForm.animalBreed === 'Other' && (
            <div>
              <label className="si-2561596d">{t('hospitalWorkflow.walkIn.customBreed')} <span className="si-17788c1c">(optional)</span></label>
              <input placeholder={t('hospitalWorkflow.walkIn.customBreedPlaceholder')} value={walkInForm.animalCustomBreed} onChange={e => setWalkInForm(f => ({ ...f, animalCustomBreed: e.target.value }))} className="si-d0e0df59" />
            </div>
          )}
          <div className="si-347df862">
            <div>
              {classTermsForSpecies(walkInForm.animalSpecies).length > 0 ? (
                <>
                  <label className="si-2561596d">{t('animalClass.fieldLabel')} <span className="si-17788c1c">(optional)</span></label>
                  <select value={walkInForm.animalClass} onChange={e => {
                    const term = findClassTerm(walkInForm.animalSpecies, e.target.value)
                    setWalkInForm(f => ({ ...f, animalClass: e.target.value, animalGender: term?.impliedGender || f.animalGender }))
                  }} className="si-f3740d1a">
                    <option value="">{t('animalClass.selectClass')}</option>
                    {classTermsForSpecies(walkInForm.animalSpecies).map(c => <option key={c.value} value={c.value}>{resolveLabel(c, t)}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <label className="si-2561596d">{t('hospitalWorkflow.walkIn.animalGender')} <span className="si-17788c1c">(optional)</span></label>
                  <select value={walkInForm.animalGender} onChange={e => setWalkInForm(f => ({ ...f, animalGender: e.target.value }))} className="si-f3740d1a">
                    <option value="">{t('hospitalWorkflow.walkIn.selectGender')}</option>
                    <option value="male">{t('hospitalWorkflow.walkIn.male')}</option>
                    <option value="female">{t('hospitalWorkflow.walkIn.female')}</option>
                    <option value="unknown">{t('hospitalWorkflow.walkIn.genderUnknown')}</option>
                  </select>
                </>
              )}
            </div>
            <div>
              <label className="si-2561596d">{t('hospitalWorkflow.walkIn.animalDob')} <span className="si-17788c1c">(optional)</span></label>
              <input type="date" value={walkInForm.animalDob} onChange={e => setWalkInForm(f => ({ ...f, animalDob: e.target.value }))} max={new Date().toISOString().split('T')[0]} className="si-d0e0df59" />
            </div>
          </div>
          <div className="si-347df862">
            <div>
              <label className="si-2561596d">{t('hospitalWorkflow.walkIn.animalWeight')} <span className="si-17788c1c">(optional)</span></label>
              <input type="number" step="0.1" min="0" placeholder="e.g., 12.5" value={walkInForm.animalWeight} onChange={e => setWalkInForm(f => ({ ...f, animalWeight: e.target.value }))} className="si-d0e0df59" />
            </div>
            <div>
              <label className="si-2561596d">{t('hospitalWorkflow.walkIn.animalColor')} <span className="si-17788c1c">(optional)</span></label>
              <input placeholder={t('hospitalWorkflow.walkIn.animalColorPlaceholder')} value={walkInForm.animalColor} onChange={e => setWalkInForm(f => ({ ...f, animalColor: e.target.value }))} className="si-d0e0df59" />
            </div>
          </div>
          <div className="si-a8fa078e">
            <input type="checkbox" id="walkInNeutered" checked={walkInForm.animalIsNeutered} onChange={e => setWalkInForm(f => ({ ...f, animalIsNeutered: e.target.checked }))} className="si-f9badade" />
            <label htmlFor="walkInNeutered" className="si-e6d76076">{t('hospitalWorkflow.walkIn.animalIsNeutered')}</label>
          </div>
        </div>
      </div>

      {/* Identification */}
      <div className="si-9a250e84">
        <div className="si-27da07a6">🔖 {t('hospitalWorkflow.walkIn.identificationDetails')}</div>
        <div className="si-347df862">
          <div>
            <label className="si-2561596d">{t('hospitalWorkflow.walkIn.animalMicrochipId')} <span className="si-17788c1c">(optional)</span></label>
            <input placeholder={t('hospitalWorkflow.walkIn.animalMicrochipPlaceholder')} value={walkInForm.animalMicrochipId} onChange={e => setWalkInForm(f => ({ ...f, animalMicrochipId: e.target.value }))} className="si-d0e0df59" />
          </div>
          <div>
            <label className="si-2561596d">{t('hospitalWorkflow.walkIn.animalRegistrationNumber')} <span className="si-17788c1c">(optional)</span></label>
            <input placeholder={t('hospitalWorkflow.walkIn.animalRegistrationPlaceholder')} value={walkInForm.animalRegistrationNumber} onChange={e => setWalkInForm(f => ({ ...f, animalRegistrationNumber: e.target.value }))} className="si-d0e0df59" />
          </div>
          {earTagSpecies.includes(walkInForm.animalSpecies) && (
            <div className="si-06af062a">
              <label className="si-2561596d">{t('hospitalWorkflow.walkIn.animalEarTagId')} <span className="si-17788c1c">(optional)</span></label>
              <input placeholder={t('hospitalWorkflow.walkIn.animalEarTagPlaceholder')} value={walkInForm.animalEarTagId} onChange={e => setWalkInForm(f => ({ ...f, animalEarTagId: e.target.value }))} className="si-d0e0df59" />
            </div>
          )}
        </div>
      </div>

      {/* Medical Notes */}
      <div>
        <label className="si-2561596d">📋 {t('hospitalWorkflow.walkIn.animalMedicalNotes')} <span className="si-17788c1c">(optional)</span></label>
        <textarea
          placeholder={t('hospitalWorkflow.walkIn.animalMedicalNotesPlaceholder')}
          value={walkInForm.animalMedicalNotes}
          onChange={e => setWalkInForm(f => ({ ...f, animalMedicalNotes: e.target.value }))}
          rows={3}
          className="si-0523a7a3"
        />
      </div>

      {/* Insurance Details */}
      <div className="si-27da07a6">🛡️ {t('hospitalWorkflow.walkIn.insuranceSection')}</div>
      <div className="si-fbb64b4e">
        <div>
          <label className="si-2561596d">{t('hospitalWorkflow.walkIn.insuranceProvider')} <span className="si-17788c1c">(optional)</span></label>
          <input placeholder={t('hospitalWorkflow.walkIn.insuranceProviderPlaceholder')} value={walkInForm.animalInsuranceProvider} onChange={e => setWalkInForm(f => ({ ...f, animalInsuranceProvider: e.target.value }))} className="si-d0e0df59" />
        </div>
        <div>
          <label className="si-2561596d">{t('hospitalWorkflow.walkIn.insurancePolicyNumber')} <span className="si-17788c1c">(optional)</span></label>
          <input placeholder={t('hospitalWorkflow.walkIn.insurancePolicyPlaceholder')} value={walkInForm.animalInsurancePolicyNumber} onChange={e => setWalkInForm(f => ({ ...f, animalInsurancePolicyNumber: e.target.value }))} className="si-d0e0df59" />
        </div>
      </div>
      <div>
        <label className="si-2561596d">{t('hospitalWorkflow.walkIn.insuranceExpiry')} <span className="si-17788c1c">(optional)</span></label>
        <input type="date" value={walkInForm.animalInsuranceExpiry} onChange={e => setWalkInForm(f => ({ ...f, animalInsuranceExpiry: e.target.value }))} className="si-d0e0df59" />
        {walkInForm.animalInsuranceExpiry && new Date(walkInForm.animalInsuranceExpiry) < new Date() && (
          <div className="si-9e7b17f4">⚠️ {t('hospitalWorkflow.walkIn.insuranceExpired')}</div>
        )}
      </div>

      <div className="si-db3602ae"><span className="si-f84f41a5">*</span> Required field</div>
      <div className="si-81c39146">
        <button onClick={onBackToSearch} className="si-db673962">← {t('hospitalWorkflow.walkIn.backToSearch')}</button>
        <button onClick={handleWalkInRegister}
          disabled={!walkInFormValid || walkInRegistering}
          className="hw-walkin-submit">
          {walkInRegistering ? `⏳ ${t('hospitalWorkflow.walkIn.registering')}` : `✅ ${t('hospitalWorkflow.walkIn.registerAndContinue')}`}
        </button>
      </div>
    </div>
  )
}
