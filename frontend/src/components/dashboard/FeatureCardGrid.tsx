import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FeatureCardDef } from './dashboardShared'

interface Props {
  features: FeatureCardDef[]
}

const FeatureCardGrid: React.FC<Props> = ({ features }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="dashboard-feature-grid">
      {features.map((f) => (
        <div key={f.path} className="feature-card" onClick={() => navigate(f.path)}>
          <div className={`feature-card-icon ${f.iconClass}`}>{f.icon}</div>
          <div className="feature-card-body">
            <h3>{t(f.titleKey)}</h3>
            <p>{t(f.descKey)}</p>
          </div>
          <span className="feature-arrow">→</span>
        </div>
      ))}
    </div>
  )
}

export default FeatureCardGrid
