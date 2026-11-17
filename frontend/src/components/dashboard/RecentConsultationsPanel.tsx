import React from 'react'
import { useTranslation } from 'react-i18next'
import { usePermission } from '../../context/PermissionContext'
import { useSettings } from '../../context/SettingsContext'
import { useNavigate } from 'react-router-dom'
import { Consultation } from '../../types'

interface Props {
  recentConsultations: Consultation[]
}

const RecentConsultationsPanel: React.FC<Props> = ({ recentConsultations }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { hasPermission } = usePermission()
  const { formatDate } = useSettings()

  return (
    <section className="dashboard-section">
      <div className="section-header">
        <h2 className="section-title">{t('dashboard.recentConsultations')}</h2>
      </div>
      {recentConsultations.length === 0 ? (
        <div className="empty-state">
          <p>{t('dashboard.noRecent')}</p>
          {hasPermission('book_consultation') && (
            <button className="empty-action" onClick={() => navigate('/find-doctor')}>
              {t('dashboard.findDoctor')}
            </button>
          )}
        </div>
      ) : (
        <div className="booking-list">
          {recentConsultations.map(consultation => (
            <div key={consultation.id} className="booking-item">
              <div className="booking-item-info">
                <strong>{consultation.title || t('dashboard.pending.consultation')}</strong>
                <span className="booking-item-meta">
                  {formatDate(consultation.createdAt || '')}
                </span>
              </div>
              <span className={`status-pill status-${consultation.status}`}>{t(`common.${consultation.status}`) || consultation.status}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default RecentConsultationsPanel
