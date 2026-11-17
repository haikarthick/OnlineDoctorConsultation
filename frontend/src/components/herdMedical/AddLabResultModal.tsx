import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import AnimalSelect from './AnimalSelect'
import type { Animal, LabFormState } from './herdMedicalShared'

interface AddLabResultModalProps {
  labForm: LabFormState
  setLabForm: React.Dispatch<React.SetStateAction<LabFormState>>
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  saving: boolean
  animals: Animal[]
  speciesLabel: (species: string, t: TFunction) => string
}

const AddLabResultModal: React.FC<AddLabResultModalProps> = ({ labForm, setLabForm, onSubmit, onClose, saving, animals, speciesLabel }) => {
  const { t } = useTranslation()
  return (
    <div className="hm-modal-overlay" onClick={onClose}>
      <div className="hm-modal" onClick={e => e.stopPropagation()}>
        <h2 className="si-d4411fdc">{t('herdMedical.modal.addLabResult')}</h2>
        <form onSubmit={onSubmit}>
          <div className="hm-field"><label className="hm-field-label">{t('herdMedical.modal.animal')} *</label><AnimalSelect animals={animals} value={labForm.animalId} onChange={v => setLabForm(f => ({ ...f, animalId: v }))} required speciesLabel={speciesLabel} /></div>
          <div className="hm-field-row">
            <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.modal.testName')} *</label><input type="text" className="search-input si-7d984748" value={labForm.testName} onChange={e => setLabForm(f => ({ ...f, testName: e.target.value }))} required placeholder={t('herdMedical.modal.testNamePlaceholder')} /></div>
            <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.modal.testCategory')}</label><input type="text" className="search-input si-7d984748" value={labForm.testCategory} onChange={e => setLabForm(f => ({ ...f, testCategory: e.target.value }))} placeholder={t('herdMedical.modal.testCategoryPlaceholder')} /></div>
          </div>
          <div className="hm-field-row">
            <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.modal.testDate')} *</label><input type="date" className="search-input si-7d984748" value={labForm.testDate} onChange={e => setLabForm(f => ({ ...f, testDate: e.target.value }))} required /></div>
            <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.modal.labName')}</label><input type="text" className="search-input si-7d984748" value={labForm.labName} onChange={e => setLabForm(f => ({ ...f, labName: e.target.value }))} /></div>
          </div>
          <div className="hm-field-row">
            <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.modal.resultValue')}</label><input type="text" className="search-input si-7d984748" value={labForm.resultValue} onChange={e => setLabForm(f => ({ ...f, resultValue: e.target.value }))} placeholder={t('herdMedical.modal.resultPlaceholder')} /></div>
            <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.modal.normalRange')}</label><input type="text" className="search-input si-7d984748" value={labForm.normalRange} onChange={e => setLabForm(f => ({ ...f, normalRange: e.target.value }))} placeholder={t('herdMedical.modal.normalRangePlaceholder')} /></div>
            <div className="si-e379d232"><label className="hm-field-label">{t('herdMedical.modal.unit')}</label><input type="text" className="search-input si-7d984748" value={labForm.unit} onChange={e => setLabForm(f => ({ ...f, unit: e.target.value }))} placeholder="mg/dL" /></div>
          </div>
          <div className="hm-field-row">
            <div className="si-6acd75e8"><label className="hm-field-label">{t('common.status')}</label>
              <select value={labForm.status} onChange={e => setLabForm(f => ({ ...f, status: e.target.value }))} className="search-input si-7d984748">
                <option value="pending">{t('common.pending')}</option><option value="in_progress">{t('common.inProgress')}</option><option value="completed">{t('common.completed')}</option>
              </select>
            </div>
            <div className="si-cd7f5466"><label className="hm-field-label">{t('herdMedical.modal.interpretation')}</label><input type="text" className="search-input si-7d984748" value={labForm.interpretation} onChange={e => setLabForm(f => ({ ...f, interpretation: e.target.value }))} placeholder={t('herdMedical.modal.interpretationPlaceholder')} /></div>
          </div>
          <div className="si-66181d73">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('herdMedical.modal.saving') : t('herdMedical.modal.saveLabResult')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddLabResultModal
