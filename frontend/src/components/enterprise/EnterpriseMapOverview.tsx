import React from 'react'
import MapView from '../MapView'
import { Enterprise, ENTERPRISE_TYPE_LABELS } from '../../types'
import { typeIcon } from './enterpriseShared'

// ─── Enterprise locations map overview (toggled from the page header) ───
export const EnterpriseMapOverview: React.FC<{
  enterprises: Enterprise[]
  selectedEnterprise: Enterprise | null
}> = ({ enterprises, selectedEnterprise }) => {
  const withCoords = enterprises.filter(e => e.gpsLatitude && e.gpsLongitude)

  return (
    <div className="si-a87c8813">
      <div className="si-5214c8b8">
        <h3 className="si-44087c4b">🗺️ Enterprise Locations</h3>
        <p className="si-29492778">
          {withCoords.length} of {enterprises.length} enterprises have GPS coordinates
        </p>
      </div>
      <MapView
        height={400}
        markers={withCoords.map(ent => ({
          id: ent.id,
          lat: +(ent.gpsLatitude || 0),
          lng: +(ent.gpsLongitude || 0),
          color: selectedEnterprise?.id === ent.id ? '#3b82f6' : '#22c55e',
          pulse: selectedEnterprise?.id === ent.id,
          popup: (
            <div>
              <strong>{typeIcon(ent.enterpriseType)} {ent.name}</strong><br />
              <span className="si-756a9f21">{ENTERPRISE_TYPE_LABELS[ent.enterpriseType] || ent.enterpriseType}</span><br />
              {ent.city && <span className="si-756a9f21">{ent.city}{ent.state ? `, ${ent.state}` : ''}</span>}
              <div className="si-692258ce">
                👥 {ent.memberCount || 0} members · 🐾 {ent.animalCount || 0} animals
              </div>
            </div>
          ),
        }))}
        fitToData={withCoords.length > 0}
      />
    </div>
  )
}
