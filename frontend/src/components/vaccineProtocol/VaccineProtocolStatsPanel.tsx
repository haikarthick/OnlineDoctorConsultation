import React from 'react'
import { Stats } from './vaccineProtocolShared'

interface VaccineProtocolStatsPanelProps {
  stats: Stats | null
  t: any
}

const VaccineProtocolStatsPanel: React.FC<VaccineProtocolStatsPanelProps> = ({ stats, t }) => {
  if (!stats) return null
  return (
    <div className="module-stats">
      <div className="stat-card">
        <div className="stat-value">{stats.total}</div>
        <div className="stat-label">{t('vaccineProtocol.stats.total')}</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{stats.active}</div>
        <div className="stat-label">{t('vaccineProtocol.stats.active')}</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{stats.byCategory?.mandatory_govt || 0}</div>
        <div className="stat-label">{t('vaccineProtocol.stats.mandatoryGovt')}</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{stats.byCategory?.core || 0}</div>
        <div className="stat-label">{t('vaccineProtocol.stats.core')}</div>
      </div>
    </div>
  )
}

export default VaccineProtocolStatsPanel
