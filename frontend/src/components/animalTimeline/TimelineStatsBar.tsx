import React from 'react'
import { TFunction } from 'i18next'

interface TimelineStatsBarProps {
  t: TFunction
  eventsCount: number
  stats: { total: number; types: number; active: number; highSev: number }
}

const TimelineStatsBar: React.FC<TimelineStatsBarProps> = ({ t, eventsCount, stats }) => {
  if (eventsCount === 0) return null
  return (
    <div className="tl-stats">
      {[
        { icon: '📊', value: stats.total,   label: t('timeline.stats.totalEvents')  },
        { icon: '📋', value: stats.types,   label: t('timeline.stats.eventTypes')   },
        { icon: '✅', value: stats.active,  label: t('timeline.stats.activeItems')  },
        ...(stats.highSev > 0 ? [{ icon: '🔴', value: stats.highSev, label: t('timeline.stats.highSeverity') }] : []),
      ].map(s => (
        <div className="tl-stat" key={s.label}>
          <span className="tl-stat-icon">{s.icon}</span>
          <span className="tl-stat-val">{s.value}</span>
          <span className="tl-stat-lbl">{s.label}</span>
        </div>
      ))}
    </div>
  )
}

export default TimelineStatsBar
