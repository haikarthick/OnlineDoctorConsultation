import React from 'react'
import { TFunction } from 'i18next'
import { TimelineEvent, getEventConfig, severityColor } from './animalTimelineShared'

interface EventHoverTooltipProps {
  t: TFunction
  hoverEvent: TimelineEvent
  hoverPos: { x: number; y: number }
  formatEventDate: (d: string) => string
  keepHover: () => void
  hideHover: () => void
  onShowDetails: () => void
  onOpenRecord: () => void
  onGoToConsultation: () => void
}

const EventHoverTooltip: React.FC<EventHoverTooltipProps> = ({
  t, hoverEvent, hoverPos, formatEventDate, keepHover, hideHover,
  onShowDetails, onOpenRecord, onGoToConsultation,
}) => {
  const cfg = getEventConfig(hoverEvent.type)
  const isActiveStatus = hoverEvent.status === 'active' || hoverEvent.status === 'valid'
  const sevClass = severityColor(hoverEvent.severity) ? `tl-sevtext-${hoverEvent.severity}` : ''
  return (
    <div
      className={`tl-tooltip tl-type-${hoverEvent.type}`}
      // eslint-disable-next-line react/forbid-dom-props -- tooltip position is computed from the mouse event, not a finite enum
      style={{ ['--x' as string]: `${Math.min(hoverPos.x + 14, window.innerWidth - 270)}px`, ['--y' as string]: `${Math.min(hoverPos.y - 10, window.innerHeight - 260)}px` }}
      onMouseEnter={keepHover}
      onMouseLeave={hideHover}
    >
      <div className="tl-tt-header">
        <span className="tl-tt-icon">
          {cfg.icon}
        </span>
        <div>
          <div className="tl-tt-title">{hoverEvent.title}</div>
          <div className="tl-tt-meta">{formatEventDate(hoverEvent.date)}</div>
        </div>
      </div>
      {hoverEvent.status && (
        <div className="tl-tt-row">
          <span className="tl-tt-key">{t('common.status')}</span>
          <span className={`tl-tt-val ${isActiveStatus ? 'tl-status-active' : 'tl-status-inactive'}`}>{hoverEvent.status}</span>
        </div>
      )}
      {hoverEvent.severity && (
        <div className="tl-tt-row">
          <span className="tl-tt-key">{t('timeline.severity')}</span>
          <span className={`tl-tt-val ${sevClass}`}>{hoverEvent.severity}</span>
        </div>
      )}
      {hoverEvent.description && (
        <div className="tl-tt-desc">{hoverEvent.description.slice(0, 90)}{hoverEvent.description.length > 90 ? '...' : ''}</div>
      )}
      <div className="tl-tt-actions">
        <button className="tl-tt-action" onClick={onShowDetails}>📋 {t('timeline.details')}</button>
        {cfg.navPath && (
          <button className="tl-tt-action" onClick={onOpenRecord}>🔗 {t('timeline.openRecord')}</button>
        )}
        {(hoverEvent.type === 'booking' || hoverEvent.type === 'consultation') && (
          <button className="tl-tt-action tl-tt-action-primary" onClick={onGoToConsultation}>🏥 {t('timeline.consultation')}</button>
        )}
      </div>
    </div>
  )
}

export default EventHoverTooltip
