import type { TFunction } from 'i18next'

interface QueueListProps {
  queue: any[]
  queueStatusFilter: string
  t: TFunction
  speciesLabel: (species: string, t: TFunction) => string
  formatDateTime: (date: any) => string
  onTriage: (q: any) => void
  onStatusChange: (id: string, status: string) => void
}

export default function QueueList({ queue, queueStatusFilter, t, speciesLabel, formatDateTime, onTriage, onStatusChange }: QueueListProps) {
  let filtered = queue
  if (queueStatusFilter === 'emergency') {
    filtered = queue.filter(q => q.priority === 'emergency')
  } else if (queueStatusFilter) {
    filtered = queue.filter(q => q.status === queueStatusFilter)
  }

  return (
    <div className="si-977f8af1">
      {filtered.length === 0 && <p className="si-d91f9779">{t('hospitalWorkflow.noPatients')}</p>}
      {filtered.map((q, idx) => (
        <div key={q.id} className={`hw-queue-row pri-${q.priority}`}>
          {/* Queue position: per-status index when filtered, global number when unfiltered */}
          <div className="si-88c652ba">
            <div className="si-2602e7d1">
              #{queueStatusFilter ? idx + 1 : q.queue_number}
            </div>
            {queueStatusFilter && (
              <div className="si-0de1dca7">Q#{q.queue_number}</div>
            )}
          </div>
          <div className="si-42eae7d1">
            <div className="si-b2cfcbec">{q.animal_name || t('hospitalWorkflow.unknownPatient')} <span className="si-db3602ae">({speciesLabel(q.animal_species, t)}{q.animal_breed ? ` - ${q.animal_breed}` : ''})</span></div>
            <div className="si-4801fc30">{t('hospitalWorkflow.owner')}: {q.owner_first_name} {q.owner_last_name}</div>
            {q.enterpriseName && (
              <div className="si-e893254c">
                🏢 {q.enterpriseName}{q.groupName ? ` › ${q.groupName}` : ''}
              </div>
            )}
            {(q.referralId || (q as any).referral_id) && (
              <div className="si-fd4f18cf">
                🔄 Referred from Network
              </div>
            )}
            {q.reason && <div className="si-aff656fd">{q.reason}</div>}
            {/* Check-in time */}
            <div className="si-c992365a">🕐 Checked in: {formatDateTime(q.checked_in_at)}</div>
            {(q as any).medication_status && (() => {
              const ms = (q as any).medication_status
              const medClass = ms.dispensingStatus ? 'is-dispensed' : (ms.reviewStatus === 'approved_for_dispensing' ? 'is-ready' : 'is-pending')
              const label = ms.dispensingStatus
                ? t('hospitalWorkflow.medicationDispensed')
                : ms.reviewStatus === 'approved_for_dispensing'
                  ? t('hospitalWorkflow.medicationReady')
                  : t('hospitalWorkflow.medicationPendingReview')
              return (
                <div className={`hw-med-status ${medClass}`}>
                  💊 {label}{ms.pharmacyName ? ` - ${ms.pharmacyName}` : ''}
                </div>
              )
            })()}
          </div>
          <span className={`hw-priority-badge pri-${q.priority}`}>{q.priority}</span>
          <span className="si-9e05cc79">{(q.status || '').replace(/_/g, ' ')}</span>
          <div className="si-9f48dfc6">
            {q.status === 'waiting' && (
              <button onClick={() => onTriage(q)} className="si-ac0a504f">{t('hospitalWorkflow.triage')}</button>
            )}
            {['waiting', 'in_triage'].includes(q.status) && (
              <button onClick={() => onStatusChange(q.id, 'in_examination')} className="si-6a421f43">{t('hospitalWorkflow.startExam')}</button>
            )}
            {q.status === 'in_examination' && (
              <button onClick={() => onStatusChange(q.id, 'in_treatment')} className="si-d903510c">{t('hospitalWorkflow.treat')}</button>
            )}
            {q.status !== 'discharged' && q.status !== 'no_show' && (
              <button onClick={() => onStatusChange(q.id, 'discharged')} className="si-cf604be4">{t('hospitalWorkflow.discharge')}</button>
            )}
            {q.status === 'waiting' && (
              <button onClick={() => onStatusChange(q.id, 'no_show')} className="si-487fb5c6">{t('hospitalWorkflow.noShow')}</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
