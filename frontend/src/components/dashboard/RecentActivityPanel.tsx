import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePermission } from '../../context/PermissionContext'
import { ActivityItem } from './dashboardShared'

interface Props {
  activities: ActivityItem[]
  loading: boolean
}

const RecentActivityPanel: React.FC<Props> = ({ activities, loading }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { hasPermission } = usePermission()

  return (
    <section className="dashboard-section activity-section">
      <div className="section-header">
        <h2 className="section-title">{t('dashboard.recentActivity')}</h2>
        <button className="section-link" onClick={() => navigate('/consultations?tab=bookings')}>{t('dashboard.viewAll')}</button>
      </div>
      <div className="activity-list">
        {activities.length === 0 && !loading && (
          <div className="empty-state">
            <span className="empty-icon">📭</span>
            <p>{t('dashboard.noActivity')}</p>
            {hasPermission('book_consultation') && (
              <button className="empty-action" onClick={() => navigate('/book-consultation')}>
                {t('dashboard.bookFirst')}
              </button>
            )}
          </div>
        )}
        {activities.map((activity, index) => (
          <div key={index} className="activity-item">
            <div className="activity-icon">
              {activity.type === 'Consultation' ? '🩺' : '📅'}
            </div>
            <div className="activity-content">
              <div className="activity-title">{activity.type}</div>
              <div className="activity-description">{activity.description}</div>
            </div>
            <div className="activity-meta">
              <span className={`activity-status status-${activity.status}`}>{t(`common.${activity.status}`) || activity.status}</span>
              <span className="activity-time">{activity.time}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default RecentActivityPanel
