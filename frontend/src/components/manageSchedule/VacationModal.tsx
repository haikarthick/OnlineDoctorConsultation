import React from 'react'
import { useTranslation } from 'react-i18next'

interface VacationForm { startDate: string; endDate: string; reason: string }

interface VacationModalProps {
  show: boolean
  onClose: () => void
  vacationForm: VacationForm
  setVacationForm: (f: VacationForm) => void
  todayStr: string
  submitting: boolean
  onSubmit: (e: React.FormEvent) => void
}

const VacationModal: React.FC<VacationModalProps> = ({
  show, onClose, vacationForm, setVacationForm, todayStr, submitting, onSubmit
}) => {
  const { t } = useTranslation()
  if (!show) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🏖️ {t('manageSchedule.vacationLeave')}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="card si-a9e61de4">
            <p className="si-272ffbdb">
              {t('manageSchedule.vacationInfoText')}
            </p>
          </div>
          <form onSubmit={onSubmit}>
            <div className="si-f23844fb">
              <div className="form-group">
                <label className="form-label">{t('manageSchedule.startDate')}</label>
                <input className="form-input" type="date" value={vacationForm.startDate} min={todayStr}
                  onChange={e => setVacationForm({ ...vacationForm, startDate: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('manageSchedule.endDate')}</label>
                <input className="form-input" type="date" value={vacationForm.endDate} min={vacationForm.startDate || todayStr}
                  onChange={e => setVacationForm({ ...vacationForm, endDate: e.target.value })} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('manageSchedule.reason')}</label>
              <input className="form-input" value={vacationForm.reason} onChange={e => setVacationForm({ ...vacationForm, reason: e.target.value })}
                placeholder={t('manageSchedule.vacationReasonPlaceholder')} />
            </div>
            {vacationForm.startDate && vacationForm.endDate && (
              <div className="si-80778f39">
                📅 {t('manageSchedule.daysWillBeMarked', { count: Math.max(1, Math.ceil((new Date(vacationForm.endDate).getTime() - new Date(vacationForm.startDate).getTime()) / 86400000) + 1) })}
              </div>
            )}
            <div className="si-2afd2545">
              <button type="button" className="btn btn-outline" onClick={onClose}>{t('manageSchedule.cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? t('manageSchedule.setting') : t('manageSchedule.setVacationBtn')}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default VacationModal
