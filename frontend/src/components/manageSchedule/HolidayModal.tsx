import React from 'react'
import { useTranslation } from 'react-i18next'

interface HolidayForm {
  holidayDate: string; name: string; holidayType: string; isFullDay: boolean; startTime: string; endTime: string
}

interface HolidayModalProps {
  show: boolean
  onClose: () => void
  holidayForm: HolidayForm
  setHolidayForm: (f: HolidayForm) => void
  submitting: boolean
  onSubmit: (e: React.FormEvent) => void
}

const HolidayModal: React.FC<HolidayModalProps> = ({
  show, onClose, holidayForm, setHolidayForm, submitting, onSubmit
}) => {
  const { t } = useTranslation()
  if (!show) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🎉 {t('manageSchedule.addHolidayTitle')}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <form onSubmit={onSubmit}>
            <div className="form-group">
              <label className="form-label">{t('manageSchedule.holidayName')}</label>
              <input className="form-input" value={holidayForm.name} onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value })}
                placeholder={t('manageSchedule.holidayNamePlaceholder')} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t('manageSchedule.date')}</label>
              <input className="form-input" type="date" value={holidayForm.holidayDate}
                onChange={e => setHolidayForm({ ...holidayForm, holidayDate: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t('manageSchedule.type')}</label>
              <select className="form-input" value={holidayForm.holidayType} onChange={e => setHolidayForm({ ...holidayForm, holidayType: e.target.value })}>
                <option value="general">{t('manageSchedule.generalHoliday')}</option>
                <option value="hospital_specific">{t('manageSchedule.hospitalSpecific')}</option>
                <option value="emergency_closure">{t('manageSchedule.emergencyClosure')}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="si-0c7e7279">
                <input type="checkbox" checked={holidayForm.isFullDay} onChange={e => setHolidayForm({ ...holidayForm, isFullDay: e.target.checked })} className="si-8f286607" />
                <span>{t('manageSchedule.fullDayClosure')}</span>
              </label>
            </div>
            {!holidayForm.isFullDay && (
              <div className="si-f23844fb">
                <div className="form-group">
                  <label className="form-label">{t('manageSchedule.closureStart')}</label>
                  <input className="form-input" type="time" value={holidayForm.startTime} onChange={e => setHolidayForm({ ...holidayForm, startTime: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('manageSchedule.closureEnd')}</label>
                  <input className="form-input" type="time" value={holidayForm.endTime} onChange={e => setHolidayForm({ ...holidayForm, endTime: e.target.value })} />
                </div>
              </div>
            )}
            <div className="si-2afd2545">
              <button type="button" className="btn btn-outline" onClick={onClose}>{t('manageSchedule.cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? t('manageSchedule.saving') : t('manageSchedule.addHolidayBtn')}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default HolidayModal
