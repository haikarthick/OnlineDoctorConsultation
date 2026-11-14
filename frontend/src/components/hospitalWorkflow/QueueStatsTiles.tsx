import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'

interface QueueStatsTilesProps {
  queueStats: any
  queueStatusFilter: string
  setQueueStatusFilter: Dispatch<SetStateAction<string>>
  t: TFunction
}

export default function QueueStatsTiles({ queueStats, queueStatusFilter, setQueueStatusFilter, t }: QueueStatsTilesProps) {
  if (!queueStats) return null

  const tiles = [
    { key: 'waiting', label: t('hospitalWorkflow.waiting'), value: queueStats.waiting_count, filter: 'waiting' },
    { key: 'triage', label: t('hospitalWorkflow.inTriage'), value: queueStats.in_triage_count, filter: 'in_triage' },
    { key: 'exam', label: t('hospitalWorkflow.inExam'), value: queueStats.in_exam_count, filter: 'in_examination' },
    { key: 'treatment', label: t('hospitalWorkflow.inTreatment'), value: queueStats.in_treatment_count, filter: 'in_treatment' },
    { key: 'emergency', label: t('hospitalWorkflow.emergencies'), value: queueStats.emergency_count, filter: 'emergency' },
    { key: 'avgwait', label: t('hospitalWorkflow.avgWait'), value: `${Math.round(queueStats.avg_wait_minutes || 0)}m`, filter: null },
    { key: 'total', label: t('hospitalWorkflow.todayTotal'), value: queueStats.today_total, filter: null },
  ]

  return (
    <div className="si-60815cf3">
      {tiles.map((s, i) => {
        const isActive = s.filter && queueStatusFilter === s.filter
        const isClickable = s.filter !== null
        return (
          <div key={i}
            onClick={() => {
              if (!isClickable) return
              setQueueStatusFilter(prev => prev === s.filter ? '' : s.filter!)
            }}
            className={`hw-stat-tile hw-stat-tile--${s.key} ${isActive ? 'is-active' : ''} ${isClickable ? 'is-clickable' : ''}`}>
            <div className="hw-stat-tile-label">{s.label} {isClickable && <span className="si-5672d952">{isActive ? '▲' : '▼'}</span>}</div>
            <div className="hw-stat-tile-value">{s.value ?? 0}</div>
          </div>
        )
      })}
    </div>
  )
}
