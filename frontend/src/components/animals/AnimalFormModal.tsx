import React from 'react'
import type { TFunction } from 'i18next'
import type { AnimalClassTerm } from '../../constants/speciesBreeds'
import { SectionTitle, type AnimalData, type AnimalFormData, type EnterpriseOption, type GroupOption } from './animalsShared'

interface SpeciesCategory { label: string; species: string[] }

interface Props {
  formRef: React.RefObject<HTMLDivElement>
  formData: AnimalFormData
  setFormData: React.Dispatch<React.SetStateAction<AnimalFormData>>
  editingAnimal: AnimalData | null
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  isSubmitting: boolean
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

const AnimalFormModal: React.FC<Props> = ({
  formRef, formData, setFormData, editingAnimal, onClose, onSubmit, isSubmitting,
  breeds, showEarTag, speciesCategories, classTermsForSpecies, findClassTerm, breedLabel,
  resolveLabel, speciesIcon, speciesLabel, isFarmer, isAdmin, enterpriseOptions, groupOptions,
  animals, navigate, t
}) => (
  <div className="edit-form-overlay" onClick={onClose}>
    <div ref={formRef} className="edit-form-panel edit-form-modal" onClick={e => e.stopPropagation()}>
      <button className="edit-form-close" onClick={onClose} aria-label="Close">✕</button>
      {editingAnimal && <div className="edit-form-badge">{t('animals.registerModal.editingMode')}</div>}
      <h2>
        {editingAnimal ? `✏️ ${t('animals.registerModal.titleEdit', { name: editingAnimal.name })}` : t('animals.registerModal.titleNew')}
      </h2>
      <p className="si-5b728486">{t('animals.registerModal.requiredNote')}</p>

      <form onSubmit={onSubmit}>
        {/* ── Basic Information ── */}
        <SectionTitle icon="📝" text={t('animals.sections.basicInfo')} />
        <div className="si-99cba706">
          <div>
            <label className="an-field-label">{t('animals.registerModal.name')}</label>
            <input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required className="an-field" placeholder={t('animals.form.placeholderName')} />
          </div>
          <div>
            <label className="an-field-label">{t('animals.registerModal.species')}</label>
            <select value={formData.species} onChange={e => setFormData(p => ({ ...p, species: e.target.value, breed: '', customBreed: '' }))} required className="an-field">
              <option value="">{t('animals.form.selectSpecies')}</option>
              {speciesCategories.map(cat => (
                <optgroup key={cat.label} label={cat.label}>
                  {cat.species.map(s => (
                    <option key={s} value={s}>{speciesIcon(s)} {speciesLabel(s, t)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="an-field-label">{t('animals.registerModal.breed')}</label>
            {breeds.length > 0 ? (
              <select value={formData.breed} onChange={e => setFormData(p => ({ ...p, breed: e.target.value, customBreed: '' }))} className="an-field">
                <option value="">{t('animals.registerModal.selectBreed')}</option>
                {breeds.map(b => <option key={b} value={b}>{breedLabel(formData.species, b)}</option>)}
                <option value="Other">{t('animals.registerModal.otherBreed')}</option>
              </select>
            ) : (
              <input type="text" value={formData.customBreed} onChange={e => setFormData(p => ({ ...p, customBreed: e.target.value }))} className="an-field" placeholder={t('animals.form.placeholderBreed')} />
            )}
          </div>
          {formData.breed === 'Other' && (
            <div>
              <label className="an-field-label">{t('animals.registerModal.customBreed')}</label>
              <input type="text" value={formData.customBreed} onChange={e => setFormData(p => ({ ...p, customBreed: e.target.value }))} required className="an-field" placeholder={t('animals.form.placeholderBreedName')} />
            </div>
          )}
          <div>
            {classTermsForSpecies(formData.species).length > 0 ? (
              <>
                <label className="an-field-label">{t('animalClass.fieldLabel')}</label>
                <select value={formData.animalClass} onChange={e => {
                  const term = findClassTerm(formData.species, e.target.value)
                  setFormData(p => ({ ...p, animalClass: e.target.value, gender: term?.impliedGender || p.gender }))
                }} className="an-field">
                  <option value="">{t('animalClass.selectClass')}</option>
                  {classTermsForSpecies(formData.species).map(c => <option key={c.value} value={c.value}>{resolveLabel(c, t)}</option>)}
                </select>
              </>
            ) : (
              <>
                <label className="an-field-label">{t('animals.registerModal.gender')}</label>
                <select value={formData.gender} onChange={e => setFormData(p => ({ ...p, gender: e.target.value }))} className="an-field">
                  <option value="">{t('animals.form.selectGender')}</option>
                  <option value="male">{t('animals.form.male')}</option>
                  <option value="female">{t('animals.form.female')}</option>
                </select>
              </>
            )}
          </div>
          <div>
            <label className="an-field-label">{t('animals.registerModal.dob')}</label>
            <input type="date" value={formData.dateOfBirth} onChange={e => setFormData(p => ({ ...p, dateOfBirth: e.target.value }))} className="an-field" max={new Date().toISOString().split('T')[0]} />
          </div>
          <div>
            <label className="an-field-label">{t('animals.registerModal.color')}</label>
            <input type="text" value={formData.color} onChange={e => setFormData(p => ({ ...p, color: e.target.value }))} className="an-field" placeholder={t('animals.form.placeholderColor')} />
          </div>
          <div>
            <label className="an-field-label">{t('animals.registerModal.weight')}</label>
            <input type="number" step="0.1" min="0" value={formData.weight} onChange={e => setFormData(p => ({ ...p, weight: e.target.value }))} className="an-field" placeholder={t('animals.form.placeholderWeight')} />
          </div>
          <div className="si-6046e8a3">
            <input type="checkbox" id="isNeutered" checked={formData.isNeutered} onChange={e => setFormData(p => ({ ...p, isNeutered: e.target.checked }))} className="si-8f286607" />
            <label htmlFor="isNeutered" className="si-a84a6c30">{t('animals.registerModal.neutered')}</label>
          </div>
          <div>
            <label className="an-field-label">{t('animalClass.sire')}</label>
            <select value={formData.sireId} onChange={e => setFormData(p => ({ ...p, sireId: e.target.value }))} className="an-field">
              <option value="">{t('animalClass.selectSire')}</option>
              {animals.filter(a => a.species === formData.species && a.gender === 'male' && a.id !== editingAnimal?.id).map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="an-field-label">{t('animalClass.dam')}</label>
            <select value={formData.damId} onChange={e => setFormData(p => ({ ...p, damId: e.target.value }))} className="an-field">
              <option value="">{t('animalClass.selectDam')}</option>
              {animals.filter(a => a.species === formData.species && a.gender === 'female' && a.id !== editingAnimal?.id).map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          {findClassTerm(formData.species, formData.animalClass)?.canBePregnant && (
            <>
              <div>
                <label className="an-field-label">{t('animalClass.breedingStatus')}</label>
                <select value={formData.breedingStatus} onChange={e => setFormData(p => ({ ...p, breedingStatus: e.target.value }))} className="an-field">
                  <option value="">{t('animalClass.selectBreedingStatus')}</option>
                  <option value="not_bred">{t('animalClass.notBred')}</option>
                  <option value="pregnant">{t('animalClass.pregnant')}</option>
                  <option value="not_pregnant">{t('animalClass.notPregnant')}</option>
                </select>
              </div>
              <div>
                <label className="an-field-label">{t('animalClass.lastBreedingDate')}</label>
                <input type="date" value={formData.lastBreedingDate} onChange={e => setFormData(p => ({ ...p, lastBreedingDate: e.target.value }))} className="an-field" max={new Date().toISOString().split('T')[0]} />
              </div>
              {formData.breedingStatus === 'pregnant' && (
                <div>
                  <label className="an-field-label">{t('animalClass.expectedDueDate')}</label>
                  <input type="date" value={formData.expectedDueDate} onChange={e => setFormData(p => ({ ...p, expectedDueDate: e.target.value }))} className="an-field" />
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Identification ── */}
        <SectionTitle icon="🏷️" text={t('animals.sections.identification')} />
        <div className="si-b064b4a1">
          <div>
            <label className="an-field-label">{t('animals.registerModal.microchip')}</label>
            <input type="text" value={formData.microchipId} onChange={e => setFormData(p => ({ ...p, microchipId: e.target.value }))} className="an-field" placeholder={t('animals.form.placeholderMicrochip')} />
          </div>
          {showEarTag && (
            <div>
              <label className="an-field-label">{t('animals.registerModal.earTag')}</label>
              <input type="text" value={formData.earTagId} onChange={e => setFormData(p => ({ ...p, earTagId: e.target.value }))} className="an-field" placeholder={t('animals.form.placeholderEarTag')} />
            </div>
          )}
          <div>
            <label className="an-field-label">{t('animals.registerModal.regNumber')}</label>
            <input type="text" value={formData.registrationNumber} onChange={e => setFormData(p => ({ ...p, registrationNumber: e.target.value }))} className="an-field" placeholder={t('animals.form.placeholderRegNumber')} />
          </div>
        </div>

        {/* ── Insurance ── */}
        <SectionTitle icon="🛡️" text={t('animals.sections.insurance')} />
        <div className="si-b064b4a1">
          <div>
            <label className="an-field-label">{t('animals.registerModal.insuranceProvider')}</label>
            <input type="text" value={formData.insuranceProvider} onChange={e => setFormData(p => ({ ...p, insuranceProvider: e.target.value }))} className="an-field" placeholder={t('animals.form.placeholderInsurance')} />
          </div>
          <div>
            <label className="an-field-label">{t('animals.registerModal.policyNumber')}</label>
            <input type="text" value={formData.insurancePolicyNumber} onChange={e => setFormData(p => ({ ...p, insurancePolicyNumber: e.target.value }))} className="an-field" placeholder={t('animals.form.placeholderPolicy')} />
          </div>
          <div>
            <label className="an-field-label">{t('animals.registerModal.policyExpiry')}</label>
            <input type="date" value={formData.insuranceExpiry} onChange={e => setFormData(p => ({ ...p, insuranceExpiry: e.target.value }))} className="an-field" />
            {formData.insuranceExpiry && new Date(formData.insuranceExpiry) < new Date() && (
              <span className="si-58dcc166">{t('animals.registerModal.policyExpired')}</span>
            )}
          </div>
        </div>

        {/* ── Medical Notes ── */}
        <SectionTitle icon="📋" text={t('animals.sections.medicalNotes')} />
        <textarea value={formData.medicalNotes} onChange={e => setFormData(p => ({ ...p, medicalNotes: e.target.value }))}
          rows={3} className="an-field an-field--textarea"
          placeholder={t('animals.form.placeholderMedical')} />

        {/* ── Enterprise & Group (Farmer/Admin only) ── */}
        {(isFarmer || isAdmin) && enterpriseOptions.length > 0 && (
          <>
            <SectionTitle icon="🏢" text={t('animals.sections.enterprise')} />
            <p className="si-8c99d39c">
              {t('animals.enterprise.description')}
            </p>
            <div className="si-b064b4a1">
              <div>
                <label className="an-field-label">{t('animals.enterprise.label')}</label>
                <select value={formData.enterpriseId} onChange={e => setFormData(p => ({ ...p, enterpriseId: e.target.value, groupId: '' }))} className="an-field">
                  <option value="">{t('animals.enterprise.none')}</option>
                  {enterpriseOptions.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
                </select>
              </div>
              {formData.enterpriseId && (
                <div>
                  <label className="an-field-label">{t('animals.enterprise.herdGroup')}</label>
                  <select value={formData.groupId} onChange={e => setFormData(p => ({ ...p, groupId: e.target.value }))} className="an-field">
                    <option value="">{t('animals.enterprise.noGroup')}</option>
                    {groupOptions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  {groupOptions.length === 0 && (
                    <span className="si-a213bf41">{t('animals.enterprise.noGroupsFound')} <span className="si-3745f306" onClick={() => navigate('/animal-groups')}>{t('animals.enterprise.createOne')}</span></span>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <div className="si-961e4c67">
          <button type="submit" className="btn-primary si-542676d1" disabled={isSubmitting}>
            {isSubmitting ? '⏳ ' + (editingAnimal ? t('animals.registerModal.updateBtn') : t('animals.registerModal.registerBtn')) + '...' : (editingAnimal ? t('animals.registerModal.updateBtn') : t('animals.registerModal.registerBtn'))}
          </button>
          <button type="button" onClick={onClose}
            className="si-71a7eeee">
            {t('animals.actions.cancel')}
          </button>
        </div>
      </form>
    </div>
  </div>
)

export default AnimalFormModal
