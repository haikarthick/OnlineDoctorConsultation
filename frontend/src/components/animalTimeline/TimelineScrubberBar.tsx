import React from 'react'

interface MinimapSegment { label: string; color: string; pct: number }
interface ScrubDot { id: string; pct: number; color: string }

interface TimelineScrubberBarProps {
  viewStartMs: number
  daysVisible: number
  filteredEventsCount: number
  minimapSegments: MinimapSegment[]
  scrubberRef: React.RefObject<HTMLDivElement>
  minMs: number
  maxMs: number
  fullRangeMs: number
  scrubDots: ScrubDot[]
  thumbLeftPct: number
  thumbWidthPct: number
  onScrubThumbDown: (e: React.MouseEvent) => void
}

const TimelineScrubberBar: React.FC<TimelineScrubberBarProps> = ({
  viewStartMs, daysVisible, filteredEventsCount, minimapSegments,
  scrubberRef, minMs, maxMs, fullRangeMs, scrubDots, thumbLeftPct, thumbWidthPct, onScrubThumbDown,
}) => {
  const years: { label: string; pct: number }[] = []
  for (let y = new Date(minMs).getFullYear(); y <= new Date(maxMs).getFullYear(); y++) {
    const ms  = new Date(y, 0, 1).getTime()
    const pct = ((ms - minMs) / fullRangeMs) * 100
    if (pct >= 0 && pct <= 100) years.push({ label: String(y), pct })
  }

  return (
    <>
      {/* Distribution bar */}
      <div className="tl-dist-bar-wrap">
        <span className="tl-dist-label">Showing: {new Date(viewStartMs).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })} - {new Date(viewStartMs + daysVisible * 86400000).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })} · {daysVisible} day(s) · {filteredEventsCount} item(s)</span>
        <div className="tl-dist-bar">
          {minimapSegments.map(seg => (
            // eslint-disable-next-line react/forbid-dom-props -- segment width is a computed percentage of filtered events, not a finite enum
            <div key={seg.label} className="tl-dist-seg" style={{ ['--w' as string]: `${seg.pct}%`, ['--c' as string]: seg.color }} title={`${seg.label} (${Math.round(seg.pct)}%)`} />
          ))}
        </div>
        <div className="tl-dist-legend">
          {minimapSegments.map(seg => (
            <span key={seg.label} className="tl-dist-legend-item">
              {/* eslint-disable-next-line react/forbid-dom-props -- aggregated per-label color, same grouping as the distribution segment above */}
              <span className="tl-dist-dot" style={{ ['--c' as string]: seg.color }} />{seg.label}
            </span>
          ))}
        </div>
      </div>

      {/* Scrubber */}
      <div className="tl-scrubber-wrap">
        <div className="tl-scrubber-track" ref={scrubberRef}>
          <span className="tl-scrubber-min">{new Date(minMs).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</span>
          <span className="tl-scrubber-max">{new Date(maxMs).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</span>
          {scrubDots.map(dot => (
            // eslint-disable-next-line react/forbid-dom-props -- dot x-position is a computed percentage along the full date range, not a finite enum
            <div key={dot.id} className="tl-scrubber-dot" style={{ ['--x' as string]: `${Math.max(0, Math.min(100, dot.pct))}%`, ['--c' as string]: dot.color }} />
          ))}
          <div
            className="tl-scrubber-thumb"
            // eslint-disable-next-line react/forbid-dom-props -- thumb position/width are drag-computed, not a finite enum
            style={{ ['--x' as string]: `${thumbLeftPct}%`, ['--w' as string]: `${thumbWidthPct}%` }}
            onMouseDown={onScrubThumbDown}
          />
        </div>
        <div className="tl-scrubber-years">
          {years.map(y => (
            // eslint-disable-next-line react/forbid-dom-props -- year-marker x-position is computed from the full date range, not a finite enum
            <span key={y.label} className="tl-scrubber-year" style={{ ['--x' as string]: `${y.pct}%` }}>{y.label}</span>
          ))}
        </div>
      </div>
    </>
  )
}

export default TimelineScrubberBar
