import React from 'react'
import { Enterprise, ENTERPRISE_TYPE_LABELS } from '../../types'
import { typeIcon } from './enterpriseShared'

// ─── Single enterprise card in the results grid ───
export const EnterpriseCard: React.FC<{
  ent: Enterprise
  isSelected: boolean
  canManage: boolean
  editLabel: string
  deleteLabel: string
  onSelect: (ent: Enterprise) => void
  onEdit: (ent: Enterprise) => void
  onDelete: (id: string) => void
}> = ({ ent, isSelected, canManage, editLabel, deleteLabel, onSelect, onEdit, onDelete }) => {
  return (
    <div
      className={`card card-clickable ${isSelected ? 'card-selected' : ''}`}
      onClick={() => onSelect(ent)}
    >
      <div className="si-d2493201">
        <span className="si-fc27df36">{typeIcon(ent.enterpriseType)}</span>
        <div>
          <h3 className="si-2a119c30">{ent.name}</h3>
          <span className="badge si-8c23064b">{ENTERPRISE_TYPE_LABELS[ent.enterpriseType] || ent.enterpriseType}</span>
        </div>
      </div>
      {ent.address && <p className="si-cf622af4">📍 {ent.city ? `${ent.city}, ${ent.state || ''}` : ent.address}</p>}
      <div className="si-53035512">
        <span>👥 {ent.memberCount || 0} members</span>
        <span>🐾 {ent.animalCount || 0} animals</span>
      </div>
      <div className="si-3429dc13">
        <button className="btn btn-sm btn-secondary" onClick={e => { e.stopPropagation(); onEdit(ent) }}>{editLabel}</button>
        {canManage && (
          <button className="btn btn-sm btn-danger" onClick={e => { e.stopPropagation(); onDelete(ent.id) }}>{deleteLabel}</button>
        )}
      </div>
    </div>
  )
}
