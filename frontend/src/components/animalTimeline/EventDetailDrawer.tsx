import React from 'react'
import { TFunction } from 'i18next'
import { TimelineEvent, AnimalOption, getEventConfig, severityColor } from './animalTimelineShared'

interface EventDetailDrawerProps {
  t: TFunction
  drawerEvent: TimelineEvent
  selectedAnimal: AnimalOption | undefined
  speciesLabel: (species: string, t: TFunction) => string
  formatEventDate: (d: string) => string
  filteredEvents: TimelineEvent[]
  onClose: () => void
  setDrawerEvent: (ev: TimelineEvent | null) => void
  onOpenFullRecord: (ev: TimelineEvent) => void
  onGoToConsultation: () => void
  onViewPrescriptions: (ev: TimelineEvent) => void
}

const EventDetailDrawer: React.FC<EventDetailDrawerProps> = ({
  t, drawerEvent, selectedAnimal, speciesLabel, formatEventDate,
  filteredEvents, onClose, setDrawerEvent, onOpenFullRecord, onGoToConsultation, onViewPrescriptions,
}) => {
  const cfg = getEventConfig(drawerEvent.type)
  const idx = filteredEvents.findIndex(e => e.id === drawerEvent.id)
  const isActiveStatus = drawerEvent.status === 'active' || drawerEvent.status === 'valid'
  const sevClass = severityColor(drawerEvent.severity) ? `tl-sevtext-${drawerEvent.severity}` : ''

  return (
    <div className="tl-drawer-overlay" onClick={onClose}>
      <div className="tl-drawer" onClick={e => e.stopPropagation()}>
        <div className={`tl-drawer-header tl-type-${drawerEvent.type}`}>
          <span className="tl-drawer-icon">{cfg.icon}</span>
          <div className="tl-drawer-title-wrap">
            <h2 className="tl-drawer-title">{drawerEvent.title}</h2>
            <span className="tl-drawer-type-pill">{cfg.label}</span>
          </div>
          <button className="tl-drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="tl-drawer-body">
          {[
            { k: t('common.date'),        v: formatEventDate(drawerEvent.date) },
            { k: t('common.animal'),      v: selectedAnimal ? `${selectedAnimal.name} (${speciesLabel(selectedAnimal.species, t)})` : undefined },
            { k: t('common.status'),      v: drawerEvent.status,       colClass: isActiveStatus ? 'tl-status-active' : '' },
            { k: t('timeline.severity'),    v: drawerEvent.severity,     colClass: sevClass },
            { k: t('timeline.recordedBy'), v: drawerEvent.createdByName },
            { k: t('common.description'), v: drawerEvent.description },
          ].filter(r => r.v).map(row => (
            <div className="tl-drawer-row" key={row.k}>
              <span className="tl-drawer-key">{row.k}</span>
              <span className={`tl-drawer-val ${(row as any).colClass || ''}`}>{row.v}</span>
            </div>
          ))}
          {drawerEvent.metadata && Object.entries(drawerEvent.metadata).filter(([, v]) => v).map(([k, v]) => (
            <div className="tl-drawer-row" key={k}>
              <span className="tl-drawer-key">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span className="tl-drawer-val">{String(v)}</span>
            </div>
          ))}
        </div>
        <div className="tl-drawer-actions">
          {cfg.navPath && (
            <button className="tl-drawer-action-primary" onClick={() => onOpenFullRecord(drawerEvent)}>🔗 {t('timeline.openFullRecord')}</button>
          )}
          {(drawerEvent.type === 'booking' || drawerEvent.type === 'consultation') && (
            <button className="tl-drawer-action-primary" onClick={onGoToConsultation}>🏥 {t('timeline.viewConsultation')}</button>
          )}
          {(drawerEvent.type === 'prescription' || drawerEvent.type === 'record_prescription') && (
            <button className="tl-drawer-action" onClick={() => onViewPrescriptions(drawerEvent)}>💊 {t('timeline.viewPrescriptions')}</button>
          )}
          <div className="tl-drawer-nav">
            <button className="tl-drawer-action"
              disabled={idx === 0}
              onClick={() => { if (idx > 0) setDrawerEvent(filteredEvents[idx - 1]) }}>
              ← {t('vetHospitals.prev')}
            </button>
            <span className="tl-drawer-nav-pos">
              {idx + 1} / {filteredEvents.length}
            </span>
            <button className="tl-drawer-action"
              disabled={idx === filteredEvents.length - 1}
              onClick={() => { if (idx < filteredEvents.length - 1) setDrawerEvent(filteredEvents[idx + 1]) }}>
              {t('vetHospitals.next')} →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EventDetailDrawer
