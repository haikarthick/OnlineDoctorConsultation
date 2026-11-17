import React from 'react'
import type { TFunction } from 'i18next'
import { HospitalNetwork, NetworkDashboard, NetworkTypeLabel } from './hospitalNetworksShared'

export interface NetworkDetailHeaderProps {
  selectedNetwork: HospitalNetwork
  dashboard: NetworkDashboard | null
  financialData: any
  userNetworkRole?: string
  userRole?: string
  onEdit: () => void
  onDeactivate: (networkId: string) => void
  t: TFunction
}

const NetworkDetailHeader: React.FC<NetworkDetailHeaderProps> = ({
  selectedNetwork, dashboard, financialData, userNetworkRole, userRole, onEdit, onDeactivate, t,
}) => {
  return (
    <>
      <div className="hn-detail-header module-card">
        <div className="hn-detail-title-row">
          <h2 className="hn-detail-name">{selectedNetwork.name}</h2>
          <div className="hn-detail-badges">
            {selectedNetwork.isApproved
              ? <span className="badge badge-success">{t('hospitalNetworks.status.approved')}</span>
              : <span className="badge badge-pending">{t('hospitalNetworks.status.pending')}</span>
            }
          </div>
          {(userNetworkRole === 'corporate_admin' || userRole === 'admin') && (
            <button className="module-btn small" onClick={onEdit}>
              ✏ {t('hospitalNetworks.actions.edit')}
            </button>
          )}
          {userNetworkRole === 'corporate_admin' && (
            <button
              className="module-btn small si-42e8005b"
              onClick={() => onDeactivate(selectedNetwork.id)}
            >
              ⚠️ {t('hospitalNetworks.deactivate')}
            </button>
          )}
        </div>
        <div className="hn-detail-meta">
          {selectedNetwork.networkType && (
            <span className="hn-detail-meta-item">
              🏷 <NetworkTypeLabel type={selectedNetwork.networkType} />
            </span>
          )}
          {selectedNetwork.contactEmail && (
            <span className="hn-detail-meta-item">✉ {selectedNetwork.contactEmail}</span>
          )}
          {selectedNetwork.contactPhone && (
            <span className="hn-detail-meta-item">📞 {selectedNetwork.contactPhone}</span>
          )}
          {selectedNetwork.website && (
            <a href={selectedNetwork.website} target="_blank" rel="noopener noreferrer" className="hn-detail-meta-item hn-website-link">
              🌐 Website
            </a>
          )}
          {selectedNetwork.country && (
            <span className="hn-detail-meta-item">
              📍 {[selectedNetwork.headquartersCity, selectedNetwork.headquartersState, selectedNetwork.country].filter(Boolean).join(', ')}
            </span>
          )}
        </div>
      </div>

      {dashboard && (
        <div className="hn-stats-row">
          <div className="hn-stat-card hn-stat-blue">
            <div className="hn-stat-value">{dashboard.totalMembers ?? 0}</div>
            <div className="hn-stat-label">Members</div>
          </div>
          <div className="hn-stat-card hn-stat-green">
            <div className="hn-stat-value">{dashboard.totalHospitals ?? 0}</div>
            <div className="hn-stat-label">Hospitals</div>
          </div>
          <div className="hn-stat-card hn-stat-purple">
            <div className="hn-stat-value">{dashboard.totalPatients ?? 0}</div>
            <div className="hn-stat-label">Patients</div>
          </div>
          <div className="hn-stat-card hn-stat-teal">
            <div className="hn-stat-value">{dashboard.activeConsents ?? 0}</div>
            <div className="hn-stat-label">Active Consents</div>
          </div>
        </div>
      )}

      {financialData && (
        <div className="module-card hn-financial-card">
          <div className="card-header">
            <h3>📊 {t('hospitalNetworks.financial.title')}</h3>
          </div>
          <div className="card-body">
            <div className="module-stats">
              <div className="stat-card">
                <div className="stat-icon">📋</div>
                <div className="stat-value">{financialData.totalConsultations || 0}</div>
                <div className="stat-label">{t('hospitalNetworks.financial.consultations')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📅</div>
                <div className="stat-value">{financialData.totalBookings || 0}</div>
                <div className="stat-label">{t('hospitalNetworks.financial.bookings')}</div>
              </div>
            </div>
            {financialData.hospitalBreakdown?.length > 0 && (
              <div className="data-table-container hn-financial-table">
                <table className="module-table">
                  <thead>
                    <tr>
                      <th>{t('hospitalNetworks.financial.hospital')}</th>
                      <th>{t('hospitalNetworks.financial.bookings')}</th>
                      <th>{t('hospitalNetworks.financial.queueVisits')}</th>
                      <th>{t('hospitalNetworks.financial.inpatients')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialData.hospitalBreakdown.map((h: any) => (
                      <tr key={h.id}>
                        <td>{h.name}</td>
                        <td>{h.bookings}</td>
                        <td>{h.queueVisits}</td>
                        <td>{h.inpatients}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default NetworkDetailHeader
