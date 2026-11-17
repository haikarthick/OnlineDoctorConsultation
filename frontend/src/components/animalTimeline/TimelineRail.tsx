import React from 'react'
import { TimelineEvent, getEventConfig, severityColor } from './animalTimelineShared'

interface TimelineRailProps {
  railRef: React.RefObject<HTMLDivElement>
  railHeight: number
  railWidth: number
  onRailMouseDown: (e: React.MouseEvent) => void
  onRailTouchStart: (e: React.TouchEvent) => void
  onRailTouchMove: (e: React.TouchEvent) => void
  ticks: { label: string; x: number }[]
  msToX: (ms: number) => number
  filteredEvents: TimelineEvent[]
  laneMap: Map<string, number>
  railPadTop: number
  laneHeight: number
  formatEventDate: (d: string) => string
  showHover: (ev: TimelineEvent, e: React.MouseEvent) => void
  hideHover: () => void
  setHoverEvent: (ev: TimelineEvent | null) => void
  setDrawerEvent: (ev: TimelineEvent | null) => void
}

const TimelineRail: React.FC<TimelineRailProps> = ({
  railRef, railHeight, railWidth, onRailMouseDown, onRailTouchStart, onRailTouchMove,
  ticks, msToX, filteredEvents, laneMap, railPadTop, laneHeight, formatEventDate,
  showHover, hideHover, setHoverEvent, setDrawerEvent,
}) => (
  <div
    className="tl-rail-wrap"
    ref={railRef}
    // eslint-disable-next-line react/forbid-dom-props -- rail height depends on the number of event lanes, not a finite enum
    style={{ ['--h' as string]: `${railHeight}px` }}
    onMouseDown={onRailMouseDown}
    onTouchStart={onRailTouchStart}
    onTouchMove={onRailTouchMove}
  >
    {ticks.map((tick, i) => (
      <React.Fragment key={i}>
        {/* eslint-disable-next-line react/forbid-dom-props -- tick x-position is computed from drag/zoom state, not a finite enum */}
        <div className="tl-tick-line"  style={{ ['--x' as string]: `${tick.x}px` }} />
        {/* eslint-disable-next-line react/forbid-dom-props -- tick x-position is computed from drag/zoom state, not a finite enum */}
        <div className="tl-tick-label" style={{ ['--x' as string]: `${tick.x}px` }}>{tick.label}</div>
      </React.Fragment>
    ))}
    {(() => {
      const todayX = msToX(Date.now())
      if (todayX < 0 || todayX > railWidth) return null
      return (
        // eslint-disable-next-line react/forbid-dom-props -- today-line x-position is computed from drag/zoom state
        <div className="tl-today-line" style={{ ['--x' as string]: `${todayX}px` }}>
          <span className="tl-today-label">Today</span>
        </div>
      )
    })()}
    {filteredEvents.map(ev => {
      const cfg  = getEventConfig(ev.type)
      const x    = msToX(new Date(ev.date).getTime())
      const lane = laneMap.get(ev.id) ?? 0
      const top  = railPadTop + lane * laneHeight
      const sevCol = severityColor(ev.severity)
      if (x < -60 || x > railWidth + 60) return null
      return (
        <div
          key={ev.id}
          className={`tl-node tl-type-${ev.type}`}
          // eslint-disable-next-line react/forbid-dom-props -- node x/y position is computed from drag/zoom/lane state, not a finite enum
          style={{ ['--x' as string]: `${x}px`, ['--y' as string]: `${top}px` }}
          onMouseEnter={e => showHover(ev, e)}
          onMouseLeave={hideHover}
          onClick={e => { e.stopPropagation(); setHoverEvent(null); setDrawerEvent(ev) }}
        >
          {sevCol && <div className={`tl-node-sev-ring tl-ring-${ev.severity}`} />}
          <div className="tl-node-dot">{cfg.icon}</div>
          <div className="tl-node-label">
            <span className="tl-node-title">{ev.title}</span>
            <span className="tl-node-date">{formatEventDate(ev.date)}</span>
          </div>
        </div>
      )
    })}
  </div>
)

export default TimelineRail
