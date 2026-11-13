import React from 'react'
import type { TFunction } from 'i18next'
import MapView from '../MapView'
import { Enterprise, EnterpriseStats } from '../../types'

// ─── Selected-enterprise overview: counts, species breakdown, mini location map ───
export const EnterpriseStatsPanel: React.FC<{
  enterprise: Enterprise
  stats: EnterpriseStats
  speciesLabel: (species: string | undefined, t: TFunction) => string
  t: TFunction
}> = ({ enterprise, stats, speciesLabel, t }) => {
  return (
    <div className="si-78b34307">
      <h3 className="si-7f683059">{enterprise.name} - Overview</h3>
      <div className="si-b2577ace">
        <div className="si-6e899795">
          <div className="si-7729e24e">{stats.totalAnimals}</div>
          <div className="si-93f5e4c5">Animals</div>
        </div>
        <div className="si-6e899795">
          <div className="si-7729e24e">{stats.totalGroups}</div>
          <div className="si-93f5e4c5">Groups</div>
        </div>
        <div className="si-6e899795">
          <div className="si-7729e24e">{stats.totalLocations}</div>
          <div className="si-93f5e4c5">Locations</div>
        </div>
        <div className="si-6e899795">
          <div className="si-7729e24e">{stats.totalMembers}</div>
          <div className="si-93f5e4c5">Members</div>
        </div>
      </div>
      {stats.animalsBySpecies.length > 0 && (
        <div className="si-216c99b7">
          <h4 className="si-305f3e0a">Animals by Species</h4>
          {stats.animalsBySpecies.map(s => (
            <div key={s.species} className="si-4721f179">
              <span>{speciesLabel(s.species, t)}</span>
              <span className="si-b2cfcbec">{s.count}</span>
            </div>
          ))}
        </div>
      )}
      {enterprise.licenseNumber && (
        <div className="si-c9622f6f">
          📋 License: {enterprise.licenseNumber}
        </div>
      )}
      {enterprise.regulatoryId && (
        <div className="si-62bd76f7">
          🏛️ Regulatory ID: {enterprise.regulatoryId}
        </div>
      )}
      {enterprise.gpsLatitude && enterprise.gpsLongitude && (
        <div className="si-1f1ebdcd">
          <MapView
            height={180}
            center={[+(enterprise.gpsLatitude), +(enterprise.gpsLongitude)]}
            zoom={14}
            markers={[{
              id: 'selected-ent',
              lat: +(enterprise.gpsLatitude),
              lng: +(enterprise.gpsLongitude),
              color: '#3b82f6',
              popup: <div><strong>{enterprise.name}</strong></div>,
            }]}
          />
        </div>
      )}
    </div>
  )
}
