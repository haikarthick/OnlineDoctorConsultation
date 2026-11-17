import React from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  staffDashboard: any
}

const HospitalStaffStatsPanel: React.FC<Props> = ({ staffDashboard }) => {
  const { t } = useTranslation()

  return (
    <div className="module-stats si-af65fe13">
      <div className="stat-card">
        <div className="stat-icon">🏥</div>
        <div className="stat-value">{staffDashboard.hospitalName || t('dashboard.noHospital')}</div>
        <div className="stat-label">{t('dashboard.stats.myHospital')}</div>
      </div>
      <div className="stat-card">
        <div className="stat-icon">🐾</div>
        <div className="stat-value">{staffDashboard.enrolledPatients || 0}</div>
        <div className="stat-label">{t('dashboard.stats.enrolledPatients')}</div>
      </div>
      <div className="stat-card">
        <div className="stat-icon">📋</div>
        <div className="stat-value">{staffDashboard.todayQueueCount || 0}</div>
        <div className="stat-label">{t('dashboard.stats.todayQueue')}</div>
      </div>
      <div className="stat-card">
        <div className="stat-icon">🛏️</div>
        <div className="stat-value">{staffDashboard.activeInpatients || 0}</div>
        <div className="stat-label">{t('dashboard.stats.activeInpatients')}</div>
      </div>
      <div className="stat-card">
        <div className="stat-icon">🔄</div>
        <div className="stat-value">{staffDashboard.pendingReferrals || 0}</div>
        <div className="stat-label">{t('dashboard.stats.pendingReferrals')}</div>
      </div>
      <div className="stat-card">
        <div className="stat-icon">👥</div>
        <div className="stat-value">{staffDashboard.staffCount || 0}</div>
        <div className="stat-label">{t('dashboard.stats.branchStaff')}</div>
      </div>
    </div>
  )
}

export default HospitalStaffStatsPanel
