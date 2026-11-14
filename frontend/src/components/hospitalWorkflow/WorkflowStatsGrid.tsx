import type { TFunction } from 'i18next'
import { STAGE_ICONS } from './hospitalWorkflowShared'

interface WorkflowStatsGridProps {
  dashboard: any
  t: TFunction
}

export default function WorkflowStatsGrid({ dashboard, t }: WorkflowStatsGridProps) {
  if (!dashboard) return null

  return (
    <div className="si-7186a6b3">
      <div className="si-8e371dd0">
        <div className="si-655cd763">{t('hospitalWorkflow.activeCases')}</div>
        <div className="si-075b513e">{dashboard.today?.active_cases ?? 0}</div>
      </div>
      <div className="si-e8d607cc">
        <div className="si-655cd763">{t('hospitalWorkflow.completedToday')}</div>
        <div className="si-3ca1ce25">{dashboard.today?.completed_today ?? 0}</div>
      </div>
      <div className="si-20ff762c">
        <div className="si-655cd763">{t('hospitalWorkflow.avgDuration')}</div>
        <div className="si-724132a4">{dashboard.avgCaseDurationMinutes ?? 0}m</div>
      </div>
      {(dashboard.stageCounts || []).map((s: any) => (
        <div key={s.current_stage} className="si-974475c5">
          <div className="si-655cd763">{STAGE_ICONS[s.current_stage]} {s.current_stage}</div>
          <div className="si-f0920f33">{s.count}</div>
        </div>
      ))}
    </div>
  )
}
