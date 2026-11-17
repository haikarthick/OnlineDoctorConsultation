import type { TFunction } from 'i18next'
import { STAGE_ICONS } from './hospitalWorkflowShared'

interface CasesListProps {
  cases: any[]
  t: TFunction
  speciesLabel: (species: string, t: TFunction) => string
  onSelectCase: (id: string) => void
}

export default function CasesList({ cases, t, speciesLabel, onSelectCase }: CasesListProps) {
  return (
    <div className="si-977f8af1">
      {cases.length === 0 && <p className="si-d91f9779">{t('hospitalWorkflow.noCases')}</p>}
      {cases.map(c => (
        <div key={c.id} onClick={() => onSelectCase(c.id)} className={`hw-case-card pri-${c.priority}`}>
          <div className="si-588e32ac">
            <span className="si-7ff2b341">{STAGE_ICONS[c.current_stage]}</span>
            <div className="si-42eae7d1">
              <div className="si-b2cfcbec">{c.animal_name || t('hospitalWorkflow.unknown')} <span className="si-db3602ae">({speciesLabel(c.animal_species, t)})</span></div>
              <div className="si-4801fc30">{c.chief_complaint || t('hospitalWorkflow.noComplaintNoted')}</div>
            </div>
            <span className={`hw-priority-badge pri-${c.priority}`}>{c.priority}</span>
            <span className="si-138fd2c9">{c.current_stage}</span>
            <span className={`hw-case-status-badge ${c.status === 'active' ? 'is-active' : ''}`}>{c.status}</span>
            {c.vet_first_name && <span className="si-655cd763">Dr. {c.vet_first_name} {c.vet_last_name}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
