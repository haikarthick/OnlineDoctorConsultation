import React from 'react'
import { useTranslation } from 'react-i18next'
import { BlockedSlot, DAY_LABELS } from './manageScheduleShared'

interface TimeBlocksTabProps {
  blockedSlots: BlockedSlot[]
  formatSlotTime: (t: string) => string
  formatDate: (d: string | Date, opts?: Intl.DateTimeFormatOptions) => string
  onAddNew: () => void
  onDelete: (id: string) => void
}

const TimeBlocksTab: React.FC<TimeBlocksTabProps> = ({ blockedSlots, formatSlotTime, formatDate, onAddNew, onDelete }) => {
  const { t } = useTranslation()
  const recurring = blockedSlots.filter(b => b.isRecurring)
  const oneTime = blockedSlots.filter(b => !b.isRecurring)

  return (
    <div>
      <div className="si-101fd1d0">
        <h2 className="si-670df8d2">{t('manageSchedule.timeBlocksTitle')}</h2>
        <button className="btn btn-primary" onClick={onAddNew}>+ {t('manageSchedule.addTimeBlock')}</button>
      </div>

      <div className="card si-c5145b89">
        <p className="si-272ffbdb">
          💡 <strong>{t('manageSchedule.timeBlocksInfo')}</strong>
        </p>
      </div>

      {/* Recurring blocks */}
      <h3 className="si-37c342ae">🔄 {t('manageSchedule.recurringWeeklyBlocks')}</h3>
      {recurring.length === 0 ? (
        <div className="card si-05535ed3">{t('manageSchedule.noRecurringBlocks')}</div>
      ) : (
        <div className="si-ade41b1f">
          {recurring.map(b => (
            <div key={b.id} className="card si-25d97c4a">
              <div>
                <strong>{t('manageSchedule.every')} {DAY_LABELS[b.recurringDay || '']}</strong>
                <span className="si-fddef076">🕐 {formatSlotTime(b.startTime)} - {formatSlotTime(b.endTime)}</span>
                {b.reason && <span className="si-824a7a1e">({b.reason})</span>}
              </div>
              <button className="btn btn-sm btn-danger" onClick={() => onDelete(b.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* One-time blocks */}
      <h3 className="si-37c342ae">📌 {t('manageSchedule.oneTimeBlocks')}</h3>
      {oneTime.length === 0 ? (
        <div className="card si-eb9d45f8">{t('manageSchedule.noOneTimeBlocks')}</div>
      ) : (
        <div className="si-b1691638">
          {oneTime.map(b => (
            <div key={b.id} className="card si-1ad6e65d">
              <div>
                <strong>{b.blockDate ? formatDate(b.blockDate + 'T12:00:00', { weekday: 'short', month: 'short', day: 'numeric' }) : '-'}</strong>
                <span className="si-fddef076">🕐 {formatSlotTime(b.startTime)} - {formatSlotTime(b.endTime)}</span>
                {b.reason && <span className="si-824a7a1e">({b.reason})</span>}
              </div>
              <button className="btn btn-sm btn-danger" onClick={() => onDelete(b.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TimeBlocksTab
