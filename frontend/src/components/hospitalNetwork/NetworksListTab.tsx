import React from 'react'
import type { TFunction } from 'i18next'
import { HospitalNetwork, NetworkTypeLabel } from './hospitalNetworksShared'

export interface NetworksListTabProps {
  networks: HospitalNetwork[]
  filteredNetworks: HospitalNetwork[]
  loading: boolean
  searchTerm: string
  setSearchTerm: (v: string) => void
  statusFilter: 'all' | 'approved' | 'pending'
  setStatusFilter: (v: 'all' | 'approved' | 'pending') => void
  approveState: Record<string, 'idle' | 'confirming'>
  userRole?: string
  formatDate: (d: string) => string
  onView: (network: HospitalNetwork) => void
  onEdit: (network: HospitalNetwork) => void
  onApproveClick: (network: HospitalNetwork) => void
  onApproveConfirm: (network: HospitalNetwork) => void
  onApproveCancel: (networkId: string) => void
  t: TFunction
}

const NetworksListTab: React.FC<NetworksListTabProps> = ({
  networks, filteredNetworks, loading, searchTerm, setSearchTerm, statusFilter, setStatusFilter,
  approveState, userRole, formatDate, onView, onEdit, onApproveClick, onApproveConfirm, onApproveCancel, t,
}) => {
  const stats = {
    total: networks.length,
    approved: networks.filter(n => n.isApproved).length,
    pending: networks.filter(n => !n.isApproved).length,
    hospitals: networks.reduce((sum, n) => sum + (n.hospitalCount ?? 0), 0),
  }

  return (
    <div className="hn-tab-content">
      <div className="hn-stats-row">
        <div className="hn-stat-card hn-stat-blue">
          <div className="hn-stat-value">{stats.total}</div>
          <div className="hn-stat-label">{t('hospitalNetworks.stats.total')}</div>
        </div>
        <div className="hn-stat-card hn-stat-green">
          <div className="hn-stat-value">{stats.approved}</div>
          <div className="hn-stat-label">{t('hospitalNetworks.stats.approved')}</div>
        </div>
        <div className="hn-stat-card hn-stat-orange">
          <div className="hn-stat-value">{stats.pending}</div>
          <div className="hn-stat-label">{t('hospitalNetworks.stats.pending')}</div>
        </div>
        <div className="hn-stat-card hn-stat-purple">
          <div className="hn-stat-value">{stats.hospitals}</div>
          <div className="hn-stat-label">{t('hospitalNetworks.stats.hospitals')}</div>
        </div>
      </div>

      <div className="hn-filter-bar">
        <div className="hn-filter-toggle">
          {(['all', 'approved', 'pending'] as const).map(f => (
            <button
              key={f}
              className={`module-btn small${statusFilter === f ? ' primary' : ''}`}
              onClick={() => setStatusFilter(f)}
            >
              {f === 'all' ? t('common.all') : f === 'approved' ? t('hospitalNetworks.stats.approved') : t('hospitalNetworks.stats.pending')}
            </button>
          ))}
        </div>
        <input
          className="module-input hn-search-input"
          placeholder={`🔍 ${t('common.search')} networks…`}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="hn-loading">⏳ {t('common.loading')}</div>
      ) : filteredNetworks.length === 0 ? (
        <div className="hn-empty-state">
          <div className="hn-empty-icon">🏢</div>
          <div className="hn-empty-title">No networks found</div>
          <div className="hn-empty-desc">
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your filters.'
              : 'Create the first hospital network to get started.'}
          </div>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="module-table">
            <thead>
              <tr>
                <th>{t('hospitalNetworks.table.name')}</th>
                <th>{t('hospitalNetworks.table.type')}</th>
                <th>{t('hospitalNetworks.table.headquarters')}</th>
                <th>{t('hospitalNetworks.table.members')}</th>
                <th>{t('hospitalNetworks.table.hospitals')}</th>
                <th>{t('hospitalNetworks.table.status')}</th>
                <th>{t('hospitalNetworks.table.created')}</th>
                <th>{t('hospitalNetworks.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredNetworks.map(network => (
                <tr key={network.id}>
                  <td>
                    <div className="hn-network-name">{network.name}</div>
                    {network.legalName && <div className="hn-network-legal">{network.legalName}</div>}
                    {network.idPrefix && <span className="module-badge si-a42e1735">{network.idPrefix}-*</span>}
                  </td>
                  <td><NetworkTypeLabel type={network.networkType} /></td>
                  <td>
                    {[network.headquartersCity, network.headquartersState, network.country]
                      .filter(Boolean).join(', ') || '-'}
                  </td>
                  <td>{network.memberCount ?? '-'}</td>
                  <td>{network.hospitalCount ?? '-'}</td>
                  <td>
                    {network.isApproved
                      ? <span className="badge badge-success">{t('hospitalNetworks.status.approved')}</span>
                      : <span className="badge badge-pending">{t('hospitalNetworks.status.pending')}</span>
                    }
                  </td>
                  <td>{formatDate(network.createdAt)}</td>
                  <td>
                    <div className="hn-actions">
                      <button className="module-btn small" onClick={() => onView(network)}>
                        {t('hospitalNetworks.actions.view')}
                      </button>
                      <button className="module-btn small" onClick={() => onEdit(network)}>
                        {t('hospitalNetworks.actions.edit')}
                      </button>
                      {!network.isApproved && userRole === 'admin' && (
                        approveState[network.id] === 'confirming' ? (
                          <div className="hn-confirm-row">
                            <span className="hn-confirm-label">Sure?</span>
                            <button type="button" className="module-btn small primary" onClick={() => onApproveConfirm(network)}>Yes</button>
                            <button type="button" className="module-btn small" onClick={() => onApproveCancel(network.id)}>No</button>
                          </div>
                        ) : (
                          <button type="button" className="module-btn small hn-btn-approve" onClick={() => onApproveClick(network)}>
                            {t('hospitalNetworks.actions.approve')}
                          </button>
                        )
                      )}
                      {/* Pending badge for non-admin users */}
                      {!network.isApproved && userRole !== 'admin' && (
                        <span className="module-badge badge-pending" title="Awaiting platform admin approval">⏳ Pending Admin Approval</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default NetworksListTab
