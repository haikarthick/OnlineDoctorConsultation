import React from 'react'
import { useTranslation } from 'react-i18next'
import { DAYS, DAY_LABELS } from './manageScheduleShared'

interface BlockForm {
  blockDate: string; startTime: string; endTime: string; reason: string; isRecurring: boolean; recurringDay: string
}

interface BlockModalProps {
  show: boolean
  onClose: () => void
  blockForm: BlockForm
  setBlockForm: (f: BlockForm) => void
  todayStr: string
  submitting: boolean
  onSubmit: (e: React.FormEvent) => void
}

const BlockModal: React.FC<BlockModalProps> = ({
  show, onClose, blockForm, setBlockForm, todayStr, submitting, onSubmit
}) => {
  const { t } = useTranslation()
  if (!show) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⏰ {t('manageSchedule.blockTimeSlot')}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <form onSubmit={onSubmit}>
            <div className="form-group">
              <label className="form-label">{t('manageSchedule.blockType')}</label>
              <div className="si-b1214800">
                <label className={`ms-radio-chip variant-info ${!blockForm.isRecurring ? 'is-selected' : ''}`}>
                  <input type="radio" name="blockType" checked={!blockForm.isRecurring}
                    onChange={() => setBlockForm({ ...blockForm, isRecurring: false })} />
                  <span>📌 {t('manageSchedule.oneTime')}</span>
                </label>
                <label className={`ms-radio-chip variant-success ${blockForm.isRecurring ? 'is-selected' : ''}`}>
                  <input type="radio" name="blockType" checked={blockForm.isRecurring}
                    onChange={() => setBlockForm({ ...blockForm, isRecurring: true })} />
                  <span>🔄 {t('manageSchedule.everyWeek')}</span>
                </label>
              </div>
            </div>
            {blockForm.isRecurring ? (
              <div className="form-group">
                <label className="form-label">{t('manageSchedule.dayOfWeek')}</label>
                <select className="form-input" value={blockForm.recurringDay} onChange={e => setBlockForm({ ...blockForm, recurringDay: e.target.value })}>
                  {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">{t('manageSchedule.date')}</label>
                <input className="form-input" type="date" value={blockForm.blockDate} min={todayStr}
                  onChange={e => setBlockForm({ ...blockForm, blockDate: e.target.value })} required />
              </div>
            )}
            <div className="si-f23844fb">
              <div className="form-group">
                <label className="form-label">{t('manageSchedule.blockStart')}</label>
                <input className="form-input" type="time" value={blockForm.startTime} onChange={e => setBlockForm({ ...blockForm, startTime: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('manageSchedule.blockEnd')}</label>
                <input className="form-input" type="time" value={blockForm.endTime} onChange={e => setBlockForm({ ...blockForm, endTime: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('manageSchedule.reason')}</label>
              <input className="form-input" value={blockForm.reason} onChange={e => setBlockForm({ ...blockForm, reason: e.target.value })}
                placeholder={t('manageSchedule.blockReasonPlaceholder')} />
            </div>
            <div className="si-2afd2545">
              <button type="button" className="btn btn-outline" onClick={onClose}>{t('manageSchedule.cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? t('manageSchedule.saving') : t('manageSchedule.createBlock')}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default BlockModal
