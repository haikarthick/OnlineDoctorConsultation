import React from 'react'
import { TFunction } from 'i18next'
import { EmptyState, getRecordTypeInfo } from './medicalRecordsShared'

interface Props {
  t: TFunction
  selectedAnimal: string
  timeline: any[]
  fmtDate: (d: string) => string
}

const TimelineTab: React.FC<Props> = ({ t, selectedAnimal, timeline, fmtDate }) => (
  <div>
    {!selectedAnimal ? (
      <EmptyState icon="📅" title={t('medicalRecords.timelineTab.selectPet')} subtitle={t('medicalRecords.timelineTab.selectSubtitle')} />
    ) : timeline.length === 0 ? (
      <EmptyState icon="📅" title={t('medicalRecords.timelineTab.emptyTitle')} subtitle={t('medicalRecords.timelineTab.emptySubtitle')} />
    ) : (
      <div className="si-0e8a6d7c">
        <div className="si-e73de40e" />
        {timeline.map((item: any, i: number) => {
          const typeIcon = item.type.startsWith('record_') ? getRecordTypeInfo(item.type.replace('record_', '')).icon
            : item.type === 'vaccination' ? '💉' : item.type === 'lab_result' ? '🔬'
            : item.type === 'prescription' ? '💊' : item.type === 'weight' ? '⚖️' : '📋'
          const typeClass = item.type.startsWith('record_') ? `rt-${item.type.replace('record_', '')}`
            : item.type === 'vaccination' ? 'rt-vaccination' : item.type === 'lab_result' ? 'rt-lab_report'
            : item.type === 'prescription' ? 'rt-prescription' : ''
          return (
            <div key={`${item.id}-${i}`} className="si-312d4e03">
              <div className={`mr-timeline-dot ${typeClass}`}>{typeIcon}</div>
              <div className="si-48ce4ea4">
                <div className="si-2a170661">
                  <strong className="si-0a803082">{item.title}</strong>
                  <span className="text-muted si-6af9d82f">{fmtDate(item.date)}</span>
                </div>
                {item.description && <p className="si-ada3b9d6">{item.description}</p>}
                {item.createdByName && <p className="si-1f14f25b">{t('medicalRecords.timelineTab.by')} {item.createdByName}</p>}
                <div className="si-beb18125">
                  {item.status && <span className={`badge badge-${item.status === 'active' || item.status === 'valid' ? 'completed' : item.status === 'pending' ? 'pending' : 'info'} si-586056cf`}>{t(item.status === 'in_progress' ? 'common.inProgress' : `common.${item.status}`)}</span>}
                  {item.severity && item.severity !== 'normal' && <span className={`badge mr-sev-badge sev-${item.severity}`}>{t(`medicalRecords.severityLevels.${item.severity}`)}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )}
  </div>
)

export default TimelineTab
