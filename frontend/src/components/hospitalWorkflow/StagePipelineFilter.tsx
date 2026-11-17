import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import { STAGES, STAGE_ICONS } from './hospitalWorkflowShared'

interface StagePipelineFilterProps {
  stageFilter: string
  setStageFilter: Dispatch<SetStateAction<string>>
  t: TFunction
}

export default function StagePipelineFilter({ stageFilter, setStageFilter, t }: StagePipelineFilterProps) {
  return (
    <div className="si-c5224945">
      <button onClick={() => setStageFilter('')} className={`hw-stage-filter-btn ${stageFilter === '' ? 'is-active' : ''}`}>{t('hospitalWorkflow.allStages')}</button>
      {STAGES.map(s => (
        <button key={s} onClick={() => setStageFilter(s)} className={`hw-stage-filter-btn ${stageFilter === s ? 'is-active' : ''}`}>
          {STAGE_ICONS[s]} {s}
        </button>
      ))}
    </div>
  )
}
