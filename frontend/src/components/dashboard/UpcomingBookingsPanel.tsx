import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePermission } from '../../context/PermissionContext'
import { useSettings } from '../../context/SettingsContext'
import { Booking } from '../../types'

interface Props {
  upcomingBookings: Booking[]
}

const UpcomingBookingsPanel: React.FC<Props> = ({ upcomingBookings }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { hasPermission } = usePermission()
  const { formatDate } = useSettings()

  return (
    <section className="dashboard-section">
      <div className="section-header">
        <h2 className="section-title">{t('dashboard.upcomingBookings')}</h2>
        <button className="section-link" onClick={() => navigate('/consultations?tab=bookings&status=confirmed')}>{t('dashboard.viewAll')}</button>
      </div>
      {upcomingBookings.length === 0 ? (
        <div className="empty-state">
          <p>{t('dashboard.noUpcoming')}</p>
          {hasPermission('view_schedule') && (
            <button className="empty-action" onClick={() => navigate('/consultations?tab=schedule')}>
              {t('dashboard.manageSchedule')}
            </button>
          )}
        </div>
      ) : (
        <div className="booking-list">
          {upcomingBookings.map(booking => {
            const isUrgent = booking.priority === 'urgent' || booking.priority === 'emergency'
            return (
              <div key={booking.id} className="booking-item">
                <div className="booking-item-info">
                  <strong>{booking.petOwnerName || t('dashboard.pending.patient')}</strong>
                  <span className="booking-item-meta">
                    {formatDate(booking.scheduledDate)} {t('common.at')} {booking.timeSlotStart}
                  </span>
                  <span className="booking-item-meta">
                    {booking.bookingType === 'video_call' ? t('dashboard.pending.video') : t('dashboard.pending.chat')} ·{' '}
                    <span className={isUrgent ? 'dashboard-priority-urgent-text' : undefined}>
                      {t(`common.${booking.priority || 'normal'}`) || booking.priority}
                    </span>
                  </span>
                </div>
                <span className={`status-pill status-${booking.status}`}>{t(`common.${booking.status}`) || booking.status}</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default UpcomingBookingsPanel
