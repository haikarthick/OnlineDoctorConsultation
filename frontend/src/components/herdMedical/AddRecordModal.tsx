import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import SubjectPicker from './SubjectPicker'
import { RECORD_TYPES } from './herdMedicalShared'
import type { Animal, AnimalGroup, RecordFormState } from './herdMedicalShared'

interface AddRecordModalProps {
  recordForm: RecordFormState
  setRecordForm: React.Dispatch<React.SetStateAction<RecordFormState>>
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  saving: boolean
  isVet: boolean
  isAdmin: boolean
  animals: Animal[]
  groups: AnimalGroup[]
  speciesLabel: (species: string, t: TFunction) => string
}

const AddRecordModal: React.FC<AddRecordModalProps> = ({ recordForm, setRecordForm, onSubmit, onClose, saving, isVet, isAdmin, animals, groups, speciesLabel }) => {
  const { t } = useTranslation()
  return (
    <div className="hm-modal-overlay" onClick={onClose}>
      <div className="hm-modal" onClick={e => e.stopPropagation()}>
        <h2 className="si-d4411fdc">{t('medicalRecords.pageTitle')}</h2>
        <p className="si-a43648b0">
          {isVet ? t('herdMedical.modal.roleVet') : isAdmin ? t('herdMedical.modal.roleAdmin') : t('herdMedical.modal.roleFarmer')}
        </p>
        <form onSubmit={onSubmit}>
          <SubjectPicker
            subjectType={recordForm.subjectType} animalId={recordForm.animalId} groupId={recordForm.groupId}
            onChange={patch => setRecordForm(f => ({ ...f, ...patch }))}
            animals={animals} groups={groups} speciesLabel={speciesLabel}
          />
          {recordForm.subjectType === 'group' && (
            <div className="hm-field-row">
              <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.modal.headCountTreated')}</label>
                <input type="number" min="0" className="search-input si-7d984748" value={recordForm.headCountTreated}
                  onChange={e => setRecordForm(f => ({ ...f, headCountTreated: e.target.value }))} /></div>
              <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.modal.affectedCount')}</label>
                <input type="number" min="0" className="search-input si-7d984748" value={recordForm.affectedCount}
                  onChange={e => setRecordForm(f => ({ ...f, affectedCount: e.target.value }))} /></div>
              <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.modal.mortalityCount')}</label>
                <input type="number" min="0" className="search-input si-7d984748" value={recordForm.mortalityCount}
                  onChange={e => setRecordForm(f => ({ ...f, mortalityCount: e.target.value }))} /></div>
            </div>
          )}
          <div className="hm-field"><label className="hm-field-label">{t('herdMedical.modal.eventDate')}</label>
            <input type="date" className="search-input si-7d984748" value={recordForm.eventDate}
              onChange={e => setRecordForm(f => ({ ...f, eventDate: e.target.value }))} /></div>
          <div className="hm-field-row">
            <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.modal.recordType')} *</label>
              <select value={recordForm.recordType} onChange={e => setRecordForm(f => ({ ...f, recordType: e.target.value }))} className="search-input si-7d984748">
                {RECORD_TYPES.map(rt => <option key={rt.value} value={rt.value}>{t(`herdMedical.recordTypes.${rt.value}`)}</option>)}
              </select>
            </div>
            <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.table.severity')}</label>
              <select value={recordForm.severity} onChange={e => setRecordForm(f => ({ ...f, severity: e.target.value }))} className="search-input si-7d984748">
                <option value="low">{t('herdMedical.severity.low')}</option><option value="normal">{t('herdMedical.severity.normal')}</option><option value="high">{t('herdMedical.severity.high')}</option><option value="critical">{t('herdMedical.severity.critical')}</option>
              </select>
            </div>
          </div>
          <div className="hm-field"><label className="hm-field-label">{t('herdMedical.table.title')} *</label><input type="text" className="search-input si-7d984748" value={recordForm.title} onChange={e => setRecordForm(f => ({ ...f, title: e.target.value }))} required placeholder={t('herdMedical.modal.titlePlaceholder')} /></div>
          <div className="hm-field"><label className="hm-field-label">{t('herdMedical.modal.contentNotes')} *</label><textarea className="search-input si-3973cbd1" value={recordForm.content} onChange={e => setRecordForm(f => ({ ...f, content: e.target.value }))} required placeholder={t('herdMedical.modal.contentPlaceholder')} /></div>
          <div className="hm-field-row">
            <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.modal.medications')}</label><input type="text" className="search-input si-7d984748" value={recordForm.medications} onChange={e => setRecordForm(f => ({ ...f, medications: e.target.value }))} placeholder={t('herdMedical.modal.medicationsPlaceholder')} /></div>
            <div className="si-6acd75e8"><label className="hm-field-label">{t('herdMedical.modal.followUpDate')}</label><input type="date" className="search-input si-7d984748" value={recordForm.followUpDate} onChange={e => setRecordForm(f => ({ ...f, followUpDate: e.target.value }))} /></div>
          </div>
          <div className="si-66181d73">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('herdMedical.modal.saving') : t('herdMedical.modal.createRecord')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddRecordModal
