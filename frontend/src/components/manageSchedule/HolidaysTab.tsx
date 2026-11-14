import React from 'react'
import { useTranslation } from 'react-i18next'
import { Holiday } from './manageScheduleShared'

interface HolidaysTabProps {
  holidays: Holiday[]
  calMonth: { year: number; month: number }
  setCalMonth: React.Dispatch<React.SetStateAction<{ year: number; month: number }>>
  todayStr: string
  formatSlotTime: (t: string) => string
  formatDate: (d: string | Date, opts?: Intl.DateTimeFormatOptions) => string
  onAddNew: () => void
  onDelete: (id: string) => void
}

const HolidaysTab: React.FC<HolidaysTabProps> = ({ holidays, calMonth, setCalMonth, todayStr, formatSlotTime, formatDate, onAddNew, onDelete }) => {
  const { t } = useTranslation()

  return (
    <div>
      <div className="si-101fd1d0">
        <h2 className="si-670df8d2">{t('manageSchedule.hospitalSystemHolidays')}</h2>
        <button className="btn btn-primary" onClick={onAddNew}>+ {t('manageSchedule.addHoliday')}</button>
      </div>

      <div className="card si-20cc5dae">
        <p className="si-9f6f0e77">
          🎉 <strong>{t('manageSchedule.systemHolidaysInfo')}</strong>
        </p>
      </div>

      {/* Holiday year filter */}
      <div className="si-cf4a3ba4">
        {[calMonth.year - 1, calMonth.year, calMonth.year + 1].map(y => (
          <button key={y} className={`btn btn-sm ${calMonth.year === y ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setCalMonth(p => ({ ...p, year: y }))}>{y}</button>
        ))}
      </div>

      {holidays.length === 0 ? (
        <div className="card si-f6d75b01">
          <div className="si-75bae6a3">🎉</div>
          <p>{t('manageSchedule.noHolidaysConfigured', { year: calMonth.year })}</p>
        </div>
      ) : (
        <div className="si-b1691638">
          {holidays.map(h => (
            <div key={h.id} className={`card ms-holiday-card ${h.holidayType === 'emergency_closure' ? 'type-emergency' : ''} ${h.holidayDate < todayStr ? 'is-past' : ''}`}>
              <div>
                <strong className="si-38c57a68">{h.name}</strong>
                <span className="si-3d174d55">
                  {formatDate(h.holidayDate + 'T12:00:00', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className={`badge ${h.holidayType === 'general' ? 'badge-active' : h.holidayType === 'emergency_closure' ? 'badge-danger' : 'badge-warning'} si-7984dfbc`}>
                  {(h.holidayType || '').replace('_', ' ')}
                </span>
                {!h.isFullDay && <span className="si-824a7a1e">({formatSlotTime(h.startTime || '')}-{formatSlotTime(h.endTime || '')})</span>}
              </div>
              <button className="btn btn-sm btn-danger" onClick={() => onDelete(h.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default HolidaysTab
