import React from 'react'
import { useTranslation } from 'react-i18next'
import { DAYS, DAY_LABELS } from './manageScheduleShared'

interface SchedForm {
  dayOfWeek: string; startTime: string; endTime: string; slotDurationMinutes: number; isAvailable: boolean
}

interface ScheduleFormModalProps {
  show: boolean
  onClose: () => void
  editingSchedId: string | null
  schedForm: SchedForm
  setSchedForm: (f: SchedForm) => void
  schedFormError: string
  submitting: boolean
  onSubmit: (e: React.FormEvent) => void
}

const ScheduleFormModal: React.FC<ScheduleFormModalProps> = ({
  show, onClose, editingSchedId, schedForm, setSchedForm, schedFormError, submitting, onSubmit
}) => {
  const { t } = useTranslation()
  if (!show) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editingSchedId ? t('manageSchedule.editSchedule') : t('manageSchedule.addWeeklySchedule')}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {schedFormError && <div className="modal-alert error si-7e63ec4f">{schedFormError}</div>}
          <form onSubmit={onSubmit}>
            <div className="form-group">
              <label className="form-label">{t('manageSchedule.dayOfWeek')}</label>
              <select className="form-input" value={schedForm.dayOfWeek} onChange={e => setSchedForm({ ...schedForm, dayOfWeek: e.target.value })}>
                {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
              </select>
            </div>
            <div className="si-f23844fb">
              <div className="form-group">
                <label className="form-label">{t('manageSchedule.startTime')}</label>
                <input className="form-input" type="time" value={schedForm.startTime} onChange={e => setSchedForm({ ...schedForm, startTime: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('manageSchedule.endTime')}</label>
                <input className="form-input" type="time" value={schedForm.endTime} onChange={e => setSchedForm({ ...schedForm, endTime: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('manageSchedule.slotDuration')}</label>
              <select className="form-input" value={schedForm.slotDurationMinutes} onChange={e => setSchedForm({ ...schedForm, slotDurationMinutes: Number(e.target.value) })}>
                {[15, 20, 30, 45, 60].map(m => <option key={m} value={m}>{m} {t('manageSchedule.minutes')}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="si-0c7e7279">
                <input type="checkbox" checked={schedForm.isAvailable} onChange={e => setSchedForm({ ...schedForm, isAvailable: e.target.checked })} className="si-8f286607" />
                <span>{t('manageSchedule.availableForBookings')}</span>
              </label>
            </div>
            <div className="si-2afd2545">
              <button type="button" className="btn btn-outline" onClick={onClose}>{t('manageSchedule.cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? t('manageSchedule.saving') : editingSchedId ? t('manageSchedule.update') : t('manageSchedule.create')}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ScheduleFormModal
