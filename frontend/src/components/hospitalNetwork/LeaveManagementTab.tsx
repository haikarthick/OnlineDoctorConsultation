import React from 'react'
import type { TFunction } from 'i18next'
import LeaveRequestModal from './LeaveRequestModal'

export interface LeaveManagementTabProps {
  leaveRequests: any[]
  showLeaveModal: boolean
  onOpenLeaveModal: () => void
  onCloseLeaveModal: () => void
  onSubmitLeaveRequest: (e: React.FormEvent<HTMLFormElement>) => void
  onApproveLeave: (lr: any) => void
  onRejectLeave: (lr: any) => void
  t: TFunction
}

const LeaveManagementTab: React.FC<LeaveManagementTabProps> = ({
  leaveRequests, showLeaveModal, onOpenLeaveModal, onCloseLeaveModal,
  onSubmitLeaveRequest, onApproveLeave, onRejectLeave, t,
}) => {
  return (
    <div className="hn-tab-content">
      <div className="hn-audit-header">
        <div>
          <h2 className="hn-audit-section-title">🏖️ {t('hospitalNetworks.leave.title')}</h2>
        </div>
        <button className="module-btn primary" onClick={onOpenLeaveModal}>
          + {t('hospitalNetworks.leave.requestLeave')}
        </button>
      </div>
      {leaveRequests.length === 0 ? (
        <div className="hn-empty-state">
          <div className="hn-empty-icon">🏖️</div>
          <div className="hn-empty-title">{t('hospitalNetworks.leave.noRequests')}</div>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="module-table">
            <thead>
              <tr>
                <th>{t('hospitalNetworks.leave.staffName')}</th>
                <th>{t('hospitalNetworks.leave.type')}</th>
                <th>{t('hospitalNetworks.leave.dates')}</th>
                <th>{t('hospitalNetworks.leave.status')}</th>
                <th>{t('hospitalNetworks.leave.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {leaveRequests.map((lr: any) => (
                <tr key={lr.id}>
                  <td>{lr.userName || '-'}</td>
                  <td><span className="module-badge">{lr.leave_type}</span></td>
                  <td>{new Date(lr.start_date).toLocaleDateString()} - {new Date(lr.end_date).toLocaleDateString()}</td>
                  <td>
                    <span className={`module-badge ${lr.status === 'approved' ? 'badge-success' : lr.status === 'rejected' ? 'badge-error' : 'badge-pending'}`}>
                      {lr.status}
                    </span>
                  </td>
                  <td>
                    {lr.status === 'pending' && (
                      <div className="hn-leave-actions">
                        <button className="module-btn small" onClick={() => onApproveLeave(lr)}>✅</button>
                        <button className="module-btn small" onClick={() => onRejectLeave(lr)}>❌</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showLeaveModal && (
        <LeaveRequestModal onClose={onCloseLeaveModal} onSubmit={onSubmitLeaveRequest} t={t} />
      )}
    </div>
  )
}

export default LeaveManagementTab
