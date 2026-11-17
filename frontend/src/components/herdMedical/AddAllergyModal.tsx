import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import AnimalSelect from './AnimalSelect'
import type { Animal, AllergyFormState } from './herdMedicalShared'

interface AddAllergyModalProps {
  allergyForm: AllergyFormState
  setAllergyForm: React.Dispatch<React.SetStateAction<AllergyFormState>>
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  saving: boolean
  animals: Animal[]
  speciesLabel: (species: string, t: TFunction) => string
}

const AddAllergyModal: React.FC<AddAllergyModalProps> = ({ allergyForm, setAllergyForm, onSubmit, onClose, saving, animals, speciesLabel }) => {
  const { t } = useTranslation()
  return (
    <div className="hm-modal-overlay" onClick={onClose}>
      <div className="hm-modal" onClick={e => e.stopPropagation()}>
        <h2 className="si-d4411fdc">{t('herdMedical.modal.recordAllergy')}</h2>
        <form onSubmit={onSubmit}>
          <div className="hm-field"><label className="hm-field-label">{t('herdMedical.modal.animal')} *</label><AnimalSelect animals={animals} value={allergyForm.animalId} onChange={v => setAllergyForm(f => ({ ...f, animalId: v }))} required speciesLabel={speciesLabel} /></div>
          <div className="hm-field-row">
            <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.table.allergen')} *</label><input type="text" className="search-input si-7d984748" value={allergyForm.allergen} onChange={e => setAllergyForm(f => ({ ...f, allergen: e.target.value }))} required placeholder={t('herdMedical.modal.allergenPlaceholder')} /></div>
            <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.table.severity')}</label>
              <select value={allergyForm.severity} onChange={e => setAllergyForm(f => ({ ...f, severity: e.target.value }))} className="search-input si-7d984748">
                <option value="low">{t('herdMedical.severity.low')}</option><option value="normal">{t('herdMedical.severity.normal')}</option><option value="high">{t('herdMedical.severity.high')}</option><option value="critical">{t('herdMedical.severity.critical')}</option>
              </select>
            </div>
          </div>
          <div className="hm-field"><label className="hm-field-label">{t('herdMedical.table.reaction')}</label><input type="text" className="search-input si-7d984748" value={allergyForm.reaction} onChange={e => setAllergyForm(f => ({ ...f, reaction: e.target.value }))} placeholder={t('herdMedical.modal.reactionPlaceholder')} /></div>
          <div className="hm-field"><label className="hm-field-label">{t('common.notes')}</label><textarea className="search-input si-51f96471" value={allergyForm.notes} onChange={e => setAllergyForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('herdMedical.modal.notesPlaceholder')} /></div>
          <div className="si-66181d73">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('herdMedical.modal.saving') : t('herdMedical.modal.recordAllergy')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddAllergyModal
