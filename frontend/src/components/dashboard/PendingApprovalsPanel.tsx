import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import { Booking } from '../../types'

interface Props {
  pendingBookings: Booking[]
  onConfirm: (id: string) => void
  onCancel: (id: string) => void
}

const PendingApprovalsPanel: React.FC<Props> = ({ pendingBookings, onConfirm, onCancel }) => {
  const { t } = useTranslation()
  const { formatDate, formatSlotTime } = useSettings()

  return (
    <div className="dashboard-alert-section">
      <div className="alert-card alert-warning">
        <div className="alert-header">
          <span className="alert-header-icon">🔔</span>
          <h3>{t('dashboard.pendingBookings')} ({pendingBookings.filter(booking => {
            const d = new Date(booking.scheduledDate + 'T' + (booking.timeSlotEnd || '23:59') + ':00')
            return d >= new Date()
          }).length})</h3>
        </div>
        <div className="alert-body">
          {pendingBookings.map(booking => {
            const expired = booking.status === 'pending' && (() => {
              const d = new Date(booking.scheduledDate + 'T' + (booking.timeSlotEnd || '23:59') + ':00')
              return d < new Date()
            })()
            // Skip expired pending bookings - backend auto-transitions these to missed
            if (expired) return null
            return (
            <div key={booking.id} className="alert-item">
              <div className="alert-item-info">
                <strong>{booking.petOwnerName || t('dashboard.pending.patient')}</strong>
                <span className="alert-item-meta">
                  {formatDate(booking.scheduledDate, { weekday: 'short', month: 'short', day: 'numeric' })} {t('common.at')} {formatSlotTime(booking.timeSlotStart)}
                  {' · '}{booking.bookingType === 'video_call' ? t('dashboard.pending.video') : t('dashboard.pending.chat')}
                </span>
                <span className="alert-item-reason">
                  {booking.reasonForVisit || booking.reason || t('dashboard.pending.generalConsultation')}
                  {(booking.priority === 'urgent' || booking.priority === 'emergency') && (
                    <span className="priority-tag"> ⚠️ {t(`common.${booking.priority}`)?.toUpperCase()}</span>
                  )}
                </span>
              </div>
              <div className="alert-item-actions">
                <button className="btn-confirm" onClick={() => onConfirm(booking.id)}>{t('dashboard.pending.confirm')}</button>
                <button className="btn-decline" onClick={() => onCancel(booking.id)}>{t('dashboard.pending.decline')}</button>
              </div>
            </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default PendingApprovalsPanel
