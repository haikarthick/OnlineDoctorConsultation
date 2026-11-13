import React from 'react'
import type { TFunction } from 'i18next'
import AnimalSearchPicker from '../AnimalSearchPicker'
import { ADMISSION_TYPES } from './inpatientShared'

export interface AdmitForm {
  admissionType: string
  roomNumber: string
  bedNumber: string
  careInstructions: string
  specialNeeds: string
  estimatedDischarge: string
  dailyRate: number
}

// ─── "Admit new patient" modal: animal search + admission details form ───
export const AdmitPatientModal: React.FC<{
  admitAnimal: any
  admitForm: AdmitForm
  admitError: string
  admitSubmitting: boolean
  t: TFunction
  onSelectAnimal: (a: any) => void
  onFormChange: (updater: (f: AdmitForm) => AdmitForm) => void
  onSubmit: () => void
  onClose: () => void
}> = ({ admitAnimal, admitForm, admitError, admitSubmitting, t, onSelectAnimal, onFormChange, onSubmit, onClose }) => {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} className="si-96206cf2">
      <div className="si-0715f1d7">

        {/* Header */}
        <div className="si-fe2d5bfb">
          <h3 className="si-949cd24d">🛏️ {t('inpatientManagement.admitPatient')}</h3>
          <button onClick={onClose} className="si-b1489b52">✕</button>
        </div>

        {/* API Error Banner */}
        {admitError && (
          <div className="si-86aee441">
            ⚠️ {admitError}
          </div>
        )}

        <div className="si-58f59f7a">

          {/* Animal Search - Required */}
          <div>
            <AnimalSearchPicker selectedAnimal={admitAnimal} onSelect={onSelectAnimal} label={`🔍 ${t('inpatientManagement.searchPatient')} *`} />
            {!admitAnimal && (
              <div className="si-ca69dd8f">
                <span>⚠️</span>
                <span><strong>Required:</strong> Type an animal name or owner name and select a patient from the dropdown to enable submission.</span>
              </div>
            )}
          </div>

          {/* Admission Type */}
          <div>
            <label className="si-1e22ae90">{t('inpatientManagement.admissionType')} <span className="si-f84f41a5">*</span></label>
            <div className="si-50c82988">
              {ADMISSION_TYPES.map(at => (
                <button
                  key={at}
                  onClick={() => onFormChange(f => ({ ...f, admissionType: at }))}
                  className={`admission-type-btn ${admitForm.admissionType === at ? 'is-selected' : ''}`}
                >
                  {at.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Room & Bed */}
          <div className="si-347df862">
            <div>
              <label className="si-2561596d">{t('inpatientManagement.roomNumber')}</label>
              <input placeholder="e.g. R101" value={admitForm.roomNumber} onChange={e => onFormChange(f => ({ ...f, roomNumber: e.target.value }))} className="si-d0e0df59" />
            </div>
            <div>
              <label className="si-2561596d">{t('inpatientManagement.bedNumber')}</label>
              <input placeholder="e.g. B1" value={admitForm.bedNumber} onChange={e => onFormChange(f => ({ ...f, bedNumber: e.target.value }))} className="si-d0e0df59" />
            </div>
          </div>

          {/* Care Instructions */}
          <div>
            <label className="si-2561596d">{t('inpatientManagement.careInstructions')} <span className="si-17788c1c">(optional)</span></label>
            <textarea placeholder={t('inpatientManagement.careInstructionsPlaceholder')} value={admitForm.careInstructions} onChange={e => onFormChange(f => ({ ...f, careInstructions: e.target.value }))} rows={2} className="si-0523a7a3" />
          </div>

          {/* Special Needs */}
          <div>
            <label className="si-2561596d">{t('inpatientManagement.specialNeeds')} <span className="si-17788c1c">(optional)</span></label>
            <textarea placeholder={t('inpatientManagement.specialNeedsPlaceholder')} value={admitForm.specialNeeds} onChange={e => onFormChange(f => ({ ...f, specialNeeds: e.target.value }))} rows={2} className="si-0523a7a3" />
          </div>

          {/* Est. Discharge & Daily Rate */}
          <div className="si-347df862">
            <div>
              <label className="si-2561596d">{t('inpatientManagement.estDischarge')} <span className="si-17788c1c">(optional)</span></label>
              <input type="datetime-local" value={admitForm.estimatedDischarge} onChange={e => onFormChange(f => ({ ...f, estimatedDischarge: e.target.value }))} className="si-9bb25fd1" />
            </div>
            <div>
              <label className="si-2561596d">{t('inpatientManagement.dailyRateLabel')} <span className="si-17788c1c">(optional)</span></label>
              <input type="number" min="0" placeholder="0.00" value={admitForm.dailyRate || ''} onChange={e => onFormChange(f => ({ ...f, dailyRate: parseFloat(e.target.value) || 0 }))} className="si-d0e0df59" />
            </div>
          </div>

          {/* Required fields legend */}
          <div className="si-db3602ae">
            <span className="si-f84f41a5">*</span> Required field
          </div>

          {/* Action Buttons */}
          <div className="si-81c39146">
            <button onClick={onClose} className="si-52d0e896">
              {t('inpatientManagement.cancel')}
            </button>
            <button
              onClick={onSubmit}
              disabled={!admitAnimal || admitSubmitting}
              title={!admitAnimal ? 'Select a patient from the search above to enable this button' : ''}
              className="btn-admit-submit"
            >
              {admitSubmitting ? '⏳ Admitting...' : `🛏️ ${t('inpatientManagement.admitPatient')}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
