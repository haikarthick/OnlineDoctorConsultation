import React from 'react'
import { useTranslation } from 'react-i18next'

interface OverrideForm {
  overrideDate: string; overrideType: 'unavailable' | 'custom_hours'; startTime: string; endTime: string; slotDuration: number; reason: string
}

interface OverrideModalProps {
  show: boolean
  onClose: () => void
  overrideForm: OverrideForm
  setOverrideForm: (f: OverrideForm) => void
  todayStr: string
  submitting: boolean
  onSubmit: (e: React.FormEvent) => void
}

const OverrideModal: React.FC<OverrideModalProps> = ({
  show, onClose, overrideForm, setOverrideForm, todayStr, submitting, onSubmit
}) => {
  const { t } = useTranslation()
  if (!show) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📅 {t('manageSchedule.dateOverrideTitle')}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <form onSubmit={onSubmit}>
            <div className="form-group">
              <label className="form-label">{t('manageSchedule.date')}</label>
              <input className="form-input" type="date" value={overrideForm.overrideDate} min={todayStr}
                onChange={e => setOverrideForm({ ...overrideForm, overrideDate: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t('manageSchedule.overrideType')}</label>
              <div className="si-b1214800">
                <label className={`ms-radio-chip variant-danger ${overrideForm.overrideType === 'unavailable' ? 'is-selected' : ''}`}>
                  <input type="radio" name="overrideType" value="unavailable" checked={overrideForm.overrideType === 'unavailable'}
                    onChange={() => setOverrideForm({ ...overrideForm, overrideType: 'unavailable' })} />
                  <span>🚫 {t('manageSchedule.dayOff')}</span>
                </label>
                <label className={`ms-radio-chip variant-info ${overrideForm.overrideType === 'custom_hours' ? 'is-selected' : ''}`}>
                  <input type="radio" name="overrideType" value="custom_hours" checked={overrideForm.overrideType === 'custom_hours'}
                    onChange={() => setOverrideForm({ ...overrideForm, overrideType: 'custom_hours' })} />
                  <span>⚙️ {t('manageSchedule.customHours')}</span>
                </label>
              </div>
            </div>
            {overrideForm.overrideType === 'custom_hours' && (
              <>
                <div className="si-f23844fb">
                  <div className="form-group">
                    <label className="form-label">{t('manageSchedule.startTime')}</label>
                    <input className="form-input" type="time" value={overrideForm.startTime} onChange={e => setOverrideForm({ ...overrideForm, startTime: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('manageSchedule.endTime')}</label>
                    <input className="form-input" type="time" value={overrideForm.endTime} onChange={e => setOverrideForm({ ...overrideForm, endTime: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('manageSchedule.slotDuration')}</label>
                  <select className="form-input" value={overrideForm.slotDuration} onChange={e => setOverrideForm({ ...overrideForm, slotDuration: Number(e.target.value) })}>
                    {[15, 20, 30, 45, 60].map(m => <option key={m} value={m}>{m} {t('manageSchedule.minutes')}</option>)}
                  </select>
                </div>
              </>
            )}
            <div className="form-group">
              <label className="form-label">{t('manageSchedule.reason')}</label>
              <input className="form-input" value={overrideForm.reason} onChange={e => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                placeholder={t('manageSchedule.reasonPlaceholder')} />
            </div>
            <div className="si-2afd2545">
              <button type="button" className="btn btn-outline" onClick={onClose}>{t('manageSchedule.cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? t('manageSchedule.saving') : t('manageSchedule.saveOverride')}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default OverrideModal
