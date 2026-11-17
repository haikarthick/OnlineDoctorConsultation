import React from 'react'
import type { PendingUser } from './userManagementShared'
import { getRoleBadge } from './userManagementShared'

interface PendingApprovalsTabProps {
  pendingUsers: PendingUser[]
  pendingLoading: boolean
  pendingMsg: string
  processing: string | null
  onApprove: (userId: string) => void
  setShowRejectRegistrationModal: (u: PendingUser | null) => void
  setRejectRegistrationReason: (v: string) => void
}

const PendingApprovalsTab: React.FC<PendingApprovalsTabProps> = ({
  pendingUsers, pendingLoading, pendingMsg, processing, onApprove,
  setShowRejectRegistrationModal, setRejectRegistrationReason,
}) => {
  return (
    <div>
      {pendingMsg && <div className="module-alert success si-7e63ec4f">{pendingMsg}</div>}
      {pendingLoading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : pendingUsers.length === 0 ? (
        <div className="empty-state">
          <div className="si-353e617d">✅</div>
          <h3>No Pending Registrations</h3>
          <p>All veterinarian and corporate admin registrations have been reviewed.</p>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Role</th>
                <th>License / Details</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingUsers.map((pu) => (
                <tr key={pu.id}>
                  <td>
                    <div>
                      <strong>{pu.firstName} {pu.lastName}</strong>
                      <div className="si-48a0b045">{pu.email}</div>
                    </div>
                  </td>
                  <td>{getRoleBadge(pu.role)}</td>
                  <td className="si-0a803082">
                    {pu.role === 'veterinarian' ? (
                      <div>
                        {pu.licenseNumber && <div><strong>License:</strong> {pu.licenseNumber}</div>}
                        {pu.clinicName && <div><strong>Clinic:</strong> {pu.clinicName}</div>}
                        {pu.yearsOfExperience != null && <div><strong>Experience:</strong> {pu.yearsOfExperience} yrs</div>}
                        {pu.specializations?.length ? <div><strong>Specializations:</strong> {pu.specializations.join(', ')}</div> : null}
                        {pu.qualifications?.length ? <div><strong>Qualifications:</strong> {pu.qualifications.join(', ')}</div> : null}
                      </div>
                    ) : (
                      <span className="si-e70e9abd">Corporate Admin account</span>
                    )}
                  </td>
                  <td className="si-0a803082">{new Date(pu.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="si-9f20fe5e">
                      <button
                        className="btn btn-sm btn-success"
                        disabled={processing === pu.id}
                        onClick={() => onApprove(pu.id)}
                      >
                        {processing === pu.id ? '...' : '✓ Approve'}
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        disabled={processing === pu.id}
                        onClick={() => { setShowRejectRegistrationModal(pu); setRejectRegistrationReason('') }}
                      >
                        ✕ Reject
                      </button>
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

export default PendingApprovalsTab
