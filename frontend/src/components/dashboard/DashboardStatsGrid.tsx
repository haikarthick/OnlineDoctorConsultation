import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { StatCard } from './dashboardShared'

interface Props {
  statCards: StatCard[]
  loading: boolean
}

const DashboardStatsGrid: React.FC<Props> = ({ statCards, loading }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="dashboard-stats-grid">
      {statCards.map((stat, index) => (
        <div key={index} className="stat-card" onClick={() => navigate(stat.path)} title={`${t('common.view')} ${stat.label}`}>
          {/* eslint-disable-next-line react/forbid-dom-props -- per-item color comes from a role-config data array, not a finite enum */}
          <div className="stat-icon" style={{ ['--icon-bg' as string]: `${stat.color}15`, ['--icon-color' as string]: stat.color }}>
            <span>{stat.icon}</span>
          </div>
          <div className="stat-content">
            <div className="stat-value">{loading ? '-' : stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default DashboardStatsGrid
