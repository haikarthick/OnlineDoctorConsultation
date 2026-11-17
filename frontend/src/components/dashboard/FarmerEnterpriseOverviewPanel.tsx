import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { EnterpriseOverviewStats } from './dashboardShared'

interface Props {
  enterpriseOverview: EnterpriseOverviewStats
}

const FarmerEnterpriseOverviewPanel: React.FC<Props> = ({ enterpriseOverview }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="module-card si-1e52b2bd">
      <div className="si-6625e7cc">
        <h3 className="si-657b8a7c">🏢 {t('dashboard.enterpriseOverview', 'Enterprise Overview')}</h3>
        <button className="btn btn-sm btn-secondary" onClick={() => navigate('/enterprises')}>{t('common.viewAll', 'View All')}</button>
      </div>
      <div className="module-stats si-2d6a231a">
        <div className="stat-card si-3c1f81b9" onClick={() => navigate('/animals')}>
          <div className="stat-icon">🐄</div>
          <div className="stat-value">{enterpriseOverview.totalAnimals}</div>
          <div className="stat-label">{t('dashboard.stats.myAnimals', 'Total Animals')}</div>
        </div>
        <div className="stat-card si-3c1f81b9" onClick={() => navigate('/campaigns')}>
          <div className="stat-icon">💉</div>
          <div className="stat-value">{enterpriseOverview.activeCampaigns}</div>
          <div className="stat-label">{t('dashboard.enterpriseStats.activeCampaigns', 'Active Campaigns')}</div>
        </div>
        <div className="stat-card si-3c1f81b9" onClick={() => navigate('/movement-log')}>
          <div className="stat-icon">⏳</div>
          <div className="stat-value">{enterpriseOverview.pendingMovements}</div>
          <div className="stat-label">{t('dashboard.enterpriseStats.pendingApprovals', 'Pending Approvals')}</div>
        </div>
        <div className="stat-card si-3c1f81b9" onClick={() => navigate('/animal-groups')}>
          <div className="stat-icon">📂</div>
          <div className="stat-value">{enterpriseOverview.activeGroups}</div>
          <div className="stat-label">{t('dashboard.enterpriseStats.groups', 'Enterprise Groups')}</div>
        </div>
      </div>
      <div className="si-44eb72fc">
        <button className="btn btn-secondary si-1a1e3482" onClick={() => navigate('/herd-medical')}>💊 {t('dashboard.features.herdMedicalTitle', 'Herd Medical')}</button>
        <button className="btn btn-secondary si-1a1e3482" onClick={() => navigate('/campaigns')}>💉 {t('dashboard.features.treatmentCampaigns', 'Campaigns')}</button>
        <button className="btn btn-secondary si-1a1e3482" onClick={() => navigate('/movement-log')}>🔄 {t('movementLog.pageTitle', 'Movement Log')}</button>
        <button className="btn btn-secondary si-1a1e3482" onClick={() => navigate('/feed-inventory')}>🌾 {t('dashboard.features.feedTitle', 'Feed Inventory')}</button>
      </div>
    </div>
  )
}

export default FarmerEnterpriseOverviewPanel
