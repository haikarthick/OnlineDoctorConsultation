import React from 'react'
import { useTranslation } from 'react-i18next'
import { VetSchedule } from '../../types'
import { DAYS, DAY_LABELS, DAY_SHORT } from './manageScheduleShared'

interface WeeklyScheduleTabProps {
  schedules: VetSchedule[]
  formatSlotTime: (t: string) => string
  onAddNew: () => void
  onEdit: (s: VetSchedule) => void
  onDelete: (id: string) => void
  onCopyDay: (day: string) => void
}

const WeeklyScheduleTab: React.FC<WeeklyScheduleTabProps> = ({ schedules, formatSlotTime, onAddNew, onEdit, onDelete, onCopyDay }) => {
  const { t } = useTranslation()
  const getScheduleForDay = (day: string) => schedules.filter(s => s.dayOfWeek === day)

  return (
    <div>
      <div className="si-101fd1d0">
        <h2 className="si-670df8d2">{t('manageSchedule.weeklyRecurringSchedule')}</h2>
        <button className="btn btn-primary" onClick={onAddNew}>
          + {t('manageSchedule.addTimeSlot')}
        </button>
      </div>

      {/* Visual Week Grid */}
      <div className="si-4ca33dc3">
        {DAYS.map(day => {
          const daySched = getScheduleForDay(day)
          const isActive = daySched.some(s => s.isActive ?? s.isAvailable)
          return (
            <div key={day} className={`ms-week-tile ${isActive ? 'is-active' : daySched.length ? 'is-off' : ''}`}>
              <div className="ms-week-tile-label">{DAY_SHORT[day]}</div>
              {daySched.length === 0 ? (
                <div className="si-ed6d4afe">{t('manageSchedule.off')}</div>
              ) : daySched.map(s => (
                <div key={s.id} className="si-692258ce">
                  <div className="si-b2cfcbec">{formatSlotTime(s.startTime)}-{formatSlotTime(s.endTime)}</div>
                  <div className="si-a213bf41">{s.slotDuration || s.slotDurationMinutes}min</div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Day Details */}
      {DAYS.map(day => {
        const daySched = getScheduleForDay(day)
        if (daySched.length === 0) return null
        return (
          <div key={day} className="card si-170de209">
            <div className="si-a0cc3086">
              <div className="si-98d3a741">
                <h3 className="si-5ec640a4">{DAY_LABELS[day]}</h3>
                <span className={`badge ${(daySched[0].isActive ?? daySched[0].isAvailable) ? 'badge-active' : 'badge-inactive'}`}>
                  {(daySched[0].isActive ?? daySched[0].isAvailable) ? t('common.active') : t('manageSchedule.inactive')}
                </span>
              </div>
              <div className="si-9f20fe5e">
                <button className="btn btn-sm btn-outline" title={t('manageSchedule.copyToAllEmpty')} onClick={() => onCopyDay(day)}>📋 {t('manageSchedule.copyToAll')}</button>
                <button className="btn btn-sm btn-outline" onClick={() => onEdit(daySched[0])}>✏️ {t('manageSchedule.edit')}</button>
                <button className="btn btn-sm btn-danger" onClick={() => onDelete(daySched[0].id)}>🗑️</button>
              </div>
            </div>
            <div className="si-9e38e1e1">
              <span>🕐 {formatSlotTime(daySched[0].startTime)} - {formatSlotTime(daySched[0].endTime)}</span>
              <span>⏱️ {daySched[0].slotDuration || daySched[0].slotDurationMinutes}{t('manageSchedule.minSlots')}</span>
            </div>
          </div>
        )
      })}

      {schedules.length === 0 && (
        <div className="card si-f6d75b01">
          <div className="si-75bae6a3">📅</div>
          <p>{t('manageSchedule.noScheduleConfigured')}</p>
        </div>
      )}
    </div>
  )
}

export default WeeklyScheduleTab
