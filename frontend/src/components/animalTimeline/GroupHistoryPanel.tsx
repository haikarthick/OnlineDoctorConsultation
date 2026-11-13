import React from 'react'
import { TFunction } from 'i18next'
import { GroupHistoryItem } from './animalTimelineShared'

interface GroupHistoryPanelProps {
  t: TFunction
  selectedAnimalId: string
  groupHistoryLoading: boolean
  groupHistory: GroupHistoryItem[]
  formatEventDate: (d: string) => string
}

const GroupHistoryPanel: React.FC<GroupHistoryPanelProps> = ({
  t, selectedAnimalId, groupHistoryLoading, groupHistory, formatEventDate,
}) => {
  if (!selectedAnimalId) return null
  return (
    <div className="tl-group-panel">
      <div className="tl-group-panel-header">
        <span className="tl-group-panel-title">🐄 {t('timeline.groupHistoryTitle', 'Batch Group History')}</span>
        <span className="tl-group-panel-sub">{t('timeline.groupHistorySub', 'Group herd/flock events that applied to this animal')}</span>
      </div>
      {groupHistoryLoading ? (
        <div className="tl-loading"><div className="tl-spinner" /><p>{t('timeline.loadingTimeline')}</p></div>
      ) : groupHistory.length === 0 ? (
        <div className="tl-group-empty">{t('timeline.noGroupHistory', 'No batch group events applied to this animal yet.')}</div>
      ) : (
        <div className="tl-group-list">
          {groupHistory.map((ev, i) => (
            <div className="tl-group-item" key={`${ev.id}-${i}`}>
              <span className="tl-group-item-icon">🐄</span>
              <div className="tl-group-item-body">
                <div className="tl-group-item-title">{ev.title || ev.recordType}</div>
                <div className="tl-group-item-meta">
                  {ev.groupName ? <span className="tl-group-chip">🌾 {ev.groupName}</span> : null}
                  {ev.headCountTreated != null && <span>· {ev.headCountTreated} {t('timeline.headTreated', 'head treated')}</span>}
                  <span>· {ev.eventDate ? formatEventDate(ev.eventDate) : ''}</span>
                </div>
                {ev.content && <div className="tl-group-item-content">{ev.content}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default GroupHistoryPanel
