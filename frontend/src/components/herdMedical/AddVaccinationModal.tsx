import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import SubjectPicker from './SubjectPicker'
import type { Animal, AnimalGroup, VaccFormState } from './herdMedicalShared'

interface AddVaccinationModalProps {
  vaccForm: VaccFormState
  setVaccForm: React.Dispatch<React.SetStateAction<VaccFormState>>
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  saving: boolean
  animals: Animal[]
  groups: AnimalGroup[]
  speciesLabel: (species: string, t: TFunction) => string
  vaccineProtocols: any[]
  onVaccineProtocolSelect: (name: string) => void
}

const AddVaccinationModal: React.FC<AddVaccinationModalProps> = ({
  vaccForm, setVaccForm, onSubmit, onClose, saving, animals, groups, speciesLabel, vaccineProtocols, onVaccineProtocolSelect,
}) => {
  const { t } = useTranslation()
  return (
    <div className="hm-modal-overlay" onClick={onClose}>
      <div className="hm-modal" onClick={e => e.stopPropagation()}>
        <h2 className="si-d4411fdc">{t('herdMedical.modal.recordVaccination')}</h2>
        <p className="si-a43648b0">{t('herdMedical.modal.vaccDescription')}</p>
        <form onSubmit={onSubmit}>
          <SubjectPicker
            subjectType={vaccForm.subjectType} animalId={vaccForm.animalId} groupId={vaccForm.groupId}
            onChange={patch => setVaccForm(f => ({ ...f, ...patch, vaccineName: '', vaccineType: '', dosage: '', nextDueDate: '' }))}
            animals={animals} groups={groups} speciesLabel={speciesLabel}
          />
          {vaccForm.subjectType === 'group' && (
            <div className="hm-field"><label className="hm-field-label">{t('herdMedical.modal.headCountTreated')}</label>
              <input type="number" min="0" className="search-input si-7d984748" value={vaccForm.headCountTreated}
                onChange={e => setVaccForm(f => ({ ...f, headCountTreated: e.target.value }))} /></div>
          )}
          {vaccineProtocols.length > 0 && (
            <div className="hm-protocol-hint">
              💉 {t('herdMedical.modal.protocolsAvailable', { count: vaccineProtocols.length })}
            </div>
          )}
          <div className="hm-field-row">
            <div className="si-6acd75e8">
              <label className="hm-field-label">{t('herdMedical.modal.vaccineName')} *</label>
              <input
                type="text"
                list="vaccine-protocol-datalist"
                className="search-input si-7d984748"
                value={vaccForm.vaccineName}
                onChange={e => onVaccineProtocolSelect(e.target.value)}
                required
                placeholder={vaccineProtocols.length > 0 ? t('herdMedical.modal.vaccineNameSuggestPlaceholder') : t('herdMedical.modal.vaccineNamePlaceholder')}
              />
              <datalist id="vaccine-protocol-datalist">
                {vaccineProtocols.map((p: any) => (
                  <option key={p.id} value={p.name}>{p.disease} ({p.vaccineCategory})</option>
                ))}
              </datalist>
            </div>
            <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.modal.vaccineType')}</label><input type="text" className="search-input si-7d984748" value={vaccForm.vaccineType} onChange={e => setVaccForm(f => ({ ...f, vaccineType: e.target.value }))} placeholder={t('herdMedical.modal.vaccineTypePlaceholder')} /></div>
          </div>
          <div className="hm-field-row">
            <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.modal.dateAdministered')} *</label><input type="date" className="search-input si-7d984748" value={vaccForm.dateAdministered} onChange={e => setVaccForm(f => ({ ...f, dateAdministered: e.target.value }))} required /></div>
            <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.modal.nextDueDate')}</label><input type="date" className="search-input si-7d984748" value={vaccForm.nextDueDate} onChange={e => setVaccForm(f => ({ ...f, nextDueDate: e.target.value }))} /></div>
          </div>
          <div className="hm-field-row">
            <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.modal.batchNumber')}</label><input type="text" className="search-input si-7d984748" value={vaccForm.batchNumber} onChange={e => setVaccForm(f => ({ ...f, batchNumber: e.target.value }))} /></div>
            <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.modal.manufacturer')}</label><input type="text" className="search-input si-7d984748" value={vaccForm.manufacturer} onChange={e => setVaccForm(f => ({ ...f, manufacturer: e.target.value }))} /></div>
          </div>
          <div className="hm-field-row">
            <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.modal.dosage')}</label><input type="text" className="search-input si-7d984748" value={vaccForm.dosage} onChange={e => setVaccForm(f => ({ ...f, dosage: e.target.value }))} placeholder={t('herdMedical.modal.dosagePlaceholder')} /></div>
            <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.modal.certificateNumber')}</label><input type="text" className="search-input si-7d984748" value={vaccForm.certificateNumber} onChange={e => setVaccForm(f => ({ ...f, certificateNumber: e.target.value }))} /></div>
          </div>
          <div className="si-66181d73">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('herdMedical.modal.saving') : t('herdMedical.modal.recordVaccination')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddVaccinationModal
