import React from 'react'
import type { TFunction } from 'i18next'

export interface VitalsForm {
  temperature: string
  heartRate: string
  weight: string
  notes: string
}

// ─── "Record vitals" modal for a single inpatient ───
export const RecordVitalsModal: React.FC<{
  animalName: string
  vitalsForm: VitalsForm
  vitalsError: string
  vitalsSubmitting: boolean
  t: TFunction
  onFormChange: (updater: (f: VitalsForm) => VitalsForm) => void
  onSubmit: () => void
  onClose: () => void
}> = ({ animalName, vitalsForm, vitalsError, vitalsSubmitting, t, onFormChange, onSubmit, onClose }) => {
  return (
    <div className="si-db8248e9" onClick={onClose}>
      <div className="si-922743e0" onClick={e => e.stopPropagation()}>
        <div className="si-101fd1d0">
          <h3 className="si-44087c4b">📊 {t('inpatientManagement.recordVitals')} - {animalName}</h3>
          <button onClick={onClose} className="si-5e3e3c2e">✕</button>
        </div>
        {vitalsError && (
          <div className="si-3646c5ee">⚠️ {vitalsError}</div>
        )}
        <div className="si-7a28b1a9">
          <div>
            <label className="si-2561596d">
              🌡️ {t('inpatientManagement.temperatureLabel')}
              <span className="si-899e716c">({t('inpatientManagement.normalTempHint')})</span>
            </label>
            <input
              type="number" step="0.1" min="0" placeholder="e.g. 101.5"
              value={vitalsForm.temperature}
              onChange={e => onFormChange(f => ({ ...f, temperature: e.target.value }))}
              className="si-d0e0df59"
            />
          </div>
          <div>
            <label className="si-2561596d">
              ❤️ {t('inpatientManagement.heartRateLabel')}
              <span className="si-899e716c">({t('inpatientManagement.normalHrHint')})</span>
            </label>
            <input
              type="number" min="0" placeholder="e.g. 80"
              value={vitalsForm.heartRate}
              onChange={e => onFormChange(f => ({ ...f, heartRate: e.target.value }))}
              className="si-d0e0df59"
            />
          </div>
          <div>
            <label className="si-2561596d">
              ⚖️ {t('inpatientManagement.weightLabel')}
              <span className="si-899e716c">({t('inpatientManagement.weightUnit')})</span>
            </label>
            <input
              type="number" step="0.1" min="0" placeholder="e.g. 12.5"
              value={vitalsForm.weight}
              onChange={e => onFormChange(f => ({ ...f, weight: e.target.value }))}
              className="si-d0e0df59"
            />
          </div>
          <div>
            <label className="si-2561596d">
              📝 {t('inpatientManagement.notesLabel')}
            </label>
            <textarea
              placeholder={t('inpatientManagement.notesPlaceholder')}
              value={vitalsForm.notes}
              onChange={e => onFormChange(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="si-0523a7a3"
            />
          </div>
          <div className="si-f0412db6">
            <button onClick={onClose} className="si-978a1643">{t('inpatientManagement.cancel')}</button>
            <button onClick={onSubmit} disabled={vitalsSubmitting} className="btn-save-vitals">
              {vitalsSubmitting ? '⏳ Saving...' : t('inpatientManagement.saveVitals')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
