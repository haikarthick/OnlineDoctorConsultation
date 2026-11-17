import React from 'react'
import type { TFunction } from 'i18next'
import { NetworkHospital } from './hospitalNetworksShared'

export interface BranchHospitalsPanelProps {
  networkHospitals: NetworkHospital[]
  onAddBranch: () => void
  onEditBranch: (h: NetworkHospital) => void
  onDeleteBranch: (h: NetworkHospital) => void
  t: TFunction
}

const BranchHospitalsPanel: React.FC<BranchHospitalsPanelProps> = ({
  networkHospitals, onAddBranch, onEditBranch, onDeleteBranch, t,
}) => {
  return (
    <div className="module-card">
      <div className="hn-panel-header">
        <h3>{t('hospitalNetworks.detail.hospitals')}</h3>
        <button type="button" className="module-btn small primary" onClick={onAddBranch}>
          + Add Branch Hospital
        </button>
      </div>
      <div className="card-body">
        {networkHospitals.length === 0 ? (
          <div className="hn-panel-empty">🏥 {t('hospitalNetworks.detail.noHospitals')}</div>
        ) : (
          <div className="hn-hospital-list">
            {networkHospitals.map(h => (
              <div key={h.id} className="hn-hospital-item si-418b4a36">
                <span className="hn-hospital-icon">🏥</span>
                <div className="hn-hospital-info si-6acd75e8">
                  <div className="hn-hospital-name">
                    {h.name}
                    {h.isNetworkBranch && <span className="si-dfca5832">Branch</span>}
                    {h.isVerified && <span className="si-31f987da">✓ Verified</span>}
                  </div>
                  <div className="si-c9661b3b">
                    {h.city && <span>📍 {h.city}{h.state ? `, ${h.state}` : ''}</span>}
                    {h.hospitalType && <span>🏷️ {h.hospitalType.replace(/_/g, ' ')}</span>}
                    {h.staffCount != null && <span>👥 {h.staffCount} staff</span>}
                    {h.contactPhone && <span>📞 {h.contactPhone}</span>}
                  </div>
                </div>
                {h.isNetworkBranch && (
                  <div className="si-542ae40d">
                    <button
                      type="button"
                      title="Edit branch hospital"
                      onClick={() => onEditBranch(h)}
                      className="si-9acabb0d"
                    >✏️</button>
                    <button
                      type="button"
                      title="Remove branch hospital"
                      onClick={() => onDeleteBranch(h)}
                      className="si-19b6a27c"
                    >🗑️</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default BranchHospitalsPanel
