import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { QuickAction } from './dashboardShared'

interface Props {
  quickActions: QuickAction[]
}

const QuickActionsPanel: React.FC<Props> = ({ quickActions }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <section className="dashboard-section quick-actions-section">
      <div className="section-header">
        <h2 className="section-title">{t('dashboard.quickActionsTitle')}</h2>
      </div>
      <div className="quick-actions-grid">
        {quickActions.map((action, i) => (
          <button key={i} className="action-card" onClick={() => navigate(action.path)}>
            {/* eslint-disable-next-line react/forbid-dom-props -- per-item color comes from a role-config data array, not a finite enum */}
            <div className="action-card-icon" style={{ ['--icon-bg' as string]: `${action.color}12`, ['--icon-color' as string]: action.color }}>
              <span>{action.icon}</span>
            </div>
            <div className="action-card-content">
              <span className="action-card-label">{action.label}</span>
              {action.description && <span className="action-card-desc">{action.description}</span>}
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

export default QuickActionsPanel
