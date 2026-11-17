import React from 'react'
import { Protocol, getStatusBadge, getCategoryDisplay, getIntervalLabel } from './vaccineProtocolShared'

interface VaccineProtocolCardProps {
  protocol: Protocol
  onEdit: (p: Protocol) => void
  onHistory: (p: Protocol) => void
  onToggleArchive: (p: Protocol) => void
  t: any
  speciesLabel: (s: string, t: any) => string
}

const VaccineProtocolCard: React.FC<VaccineProtocolCardProps> = ({ protocol: p, onEdit, onHistory, onToggleArchive, t, speciesLabel }) => (
  <div className={`vpa-protocol-card ${!p.isActive ? 'vpa-card-archived' : ''}`}>
    <div className="vpa-card-header">
      <div className="vpa-card-title-row">
        <h3 className="vpa-card-title">{p.name}</h3>
        {p.isZoonotic && (
          <span className="vpa-zoonotic-badge">⚠ {t('vaccineProtocol.zoonotic')}</span>
        )}
      </div>
      <div className="vpa-card-badges">
        {getCategoryDisplay(p.vaccineCategory, t)}
        {getStatusBadge(p.isActive, t)}
      </div>
    </div>
    <div className="vpa-card-disease">
      🦠 <span>{p.disease}</span>
    </div>
    <div className="vpa-species-chips">
      {p.species.slice(0, 4).map(s => (
        <span key={s} className="vpa-species-chip">{speciesLabel(s, t)}</span>
      ))}
      {p.species.length > 4 && (
        <span className="vpa-species-chip">+{p.species.length - 4}</span>
      )}
    </div>
    <div className="vpa-card-meta">
      <span className="vpa-meta-item">🔄 {getIntervalLabel(p.boosterIntervalDays, t)}</span>
      <span className="vpa-meta-item">💉 {p.route}</span>
      {p.country && <span className="vpa-meta-item">🌍 {p.country}</span>}
      {p.regulatoryBody && <span className="vpa-meta-item">📋 {p.regulatoryBody}</span>}
    </div>
    <div className="vpa-card-actions">
      <button className="module-btn module-btn-small" onClick={() => onEdit(p)}>
        ✏️ {t('common.edit')}
      </button>
      <button className="module-btn module-btn-small" onClick={() => onHistory(p)}>
        📋 {t('vaccineProtocol.history')}
      </button>
      <button
        className={`module-btn module-btn-small ${p.isActive ? '' : 'primary'}`}
        onClick={() => onToggleArchive(p)}
      >
        {p.isActive ? `🗃 ${t('vaccineProtocol.archive')}` : `♻️ ${t('vaccineProtocol.restore')}`}
      </button>
    </div>
  </div>
)

export default VaccineProtocolCard
