import React from 'react'
import { useTranslation } from 'react-i18next'
import { getRoleBadge } from './userManagementShared'

interface RoleChangeRequestsTabProps {
  roleRequests: any[]
  requestsLoading: boolean
  requestMsg: string
  requestsFilter: 'pending' | 'approved' | 'rejected'
  setRequestsFilter: (f: 'pending' | 'approved' | 'rejected') => void
  requestProcessing: string | null
  onApprove: (id: string) => void
  showRejectModal: string | null
  setShowRejectModal: (id: string | null) => void
  rejectionReason: string
  setRejectionReason: (v: string) => void
  onRejectConfirm: () => void
}

const RoleChangeRequestsTab: React.FC<RoleChangeRequestsTabProps> = ({
  roleRequests, requestsLoading, requestMsg, requestsFilter, setRequestsFilter,
  requestProcessing, onApprove, showRejectModal, setShowRejectModal,
  rejectionReason, setRejectionReason, onRejectConfirm,
}) => {
  const { t } = useTranslation()
  return (
    <div>
      {requestMsg && <div className="module-alert success si-7e63ec4f">{requestMsg}</div>}
      <div className="module-tabs si-7e63ec4f">
        {(['pending', 'approved', 'rejected'] as const).map(s => (
          <button key={s} className={`module-tab${requestsFilter === s ? ' active' : ''}`} onClick={() => setRequestsFilter(s)}>
            {t(`adminRoleRequests.tabs.${s}`)}
          </button>
        ))}
      </div>
      {requestsLoading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : roleRequests.length === 0 ? (
        <div className="empty-state">
          <div className="si-0067e898">🔄</div>
          <p>{t('adminRoleRequests.noRequests', { status: requestsFilter })}</p>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('adminRoleRequests.table.user')}</th>
                <th>{t('adminRoleRequests.table.currentRole')}</th>
                <th>{t('adminRoleRequests.table.requestedRole')}</th>
                <th>{t('adminRoleRequests.table.reason')}</th>
                <th>{t('adminRoleRequests.table.requestedAt')}</th>
                {requestsFilter === 'pending' && <th>{t('adminRoleRequests.table.actions')}</th>}
                {requestsFilter !== 'pending' && <th>Review</th>}
              </tr>
            </thead>
            <tbody>
              {roleRequests.map(r => (
                <tr key={r.id}>
                  <td>
                    <div>
                      <strong>{r.userName}</strong>
                      <div className="si-48a0b045">{r.userEmail}</div>
                      {r.uniqueId && <div className="si-a5de6cea">{r.uniqueId}</div>}
                    </div>
                  </td>
                  <td>{getRoleBadge(r.currentRole)}</td>
                  <td>{getRoleBadge(r.requestedRole)}</td>
                  <td className="si-af971f42">
                    {r.reason}
                    {r.requestedRole === 'veterinarian' && r.profilePayload?.licenseNumber && (
                      <div className="si-a5de6cea si-7e63ec4f">
                        <div><strong>{t('adminRoleRequests.vet.license')}:</strong> {r.profilePayload.licenseNumber}</div>
                        {r.profilePayload.consultationFee != null && <div><strong>{t('adminRoleRequests.vet.fee')}:</strong> {r.profilePayload.consultationFee}</div>}
                        {r.profilePayload.yearsOfExperience != null && <div><strong>{t('adminRoleRequests.vet.experience')}:</strong> {r.profilePayload.yearsOfExperience}</div>}
                        {Array.isArray(r.profilePayload.specializations) && r.profilePayload.specializations.length > 0 && <div><strong>{t('adminRoleRequests.vet.specializations')}:</strong> {r.profilePayload.specializations.join(', ')}</div>}
                        {r.profilePayload.clinicName && <div><strong>{t('adminRoleRequests.vet.clinic')}:</strong> {r.profilePayload.clinicName}</div>}
                      </div>
                    )}
                  </td>
                  <td className="si-0a803082">{new Date(r.createdAt).toLocaleDateString()}</td>
                  {requestsFilter === 'pending' ? (
                    <td>
                      <div className="si-9f20fe5e">
                        <button
                          className="btn btn-sm btn-primary"
                          disabled={requestProcessing === r.id}
                          onClick={() => onApprove(r.id)}
                        >
                          {requestProcessing === r.id ? '...' : t('adminRoleRequests.approve')}
                        </button>
                        <button
                          className="btn btn-sm btn-outline"
                          disabled={requestProcessing === r.id}
                          onClick={() => { setShowRejectModal(r.id); setRejectionReason('') }}
                        >
                          {t('adminRoleRequests.reject')}
                        </button>
                      </div>
                    </td>
                  ) : (
                    <td className="si-756a9f21">
                      {r.reviewedBy && <div>{t('adminRoleRequests.reviewedBy', { name: r.reviewedBy })}</div>}
                      {r.rejectionReason && <div className="si-4fb20e94">{t('adminRoleRequests.rejectedReason', { reason: r.rejectionReason })}</div>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(null)}>
          <div className="modal si-3196bd33" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('adminRoleRequests.rejectModal.title')}</h2>
              <button className="modal-close" onClick={() => setShowRejectModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">{t('adminRoleRequests.rejectModal.reasonLabel')}</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder={t('adminRoleRequests.rejectModal.reasonPlaceholder')}
                />
              </div>
              <div className="si-f5f9f5f6">
                <button className="btn btn-outline" onClick={() => setShowRejectModal(null)}>
                  {t('adminRoleRequests.rejectModal.cancelBtn')}
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!rejectionReason.trim() || requestProcessing === showRejectModal}
                  onClick={onRejectConfirm}
                >
                  {requestProcessing === showRejectModal ? t('adminRoleRequests.rejecting') : t('adminRoleRequests.rejectModal.confirmBtn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RoleChangeRequestsTab
