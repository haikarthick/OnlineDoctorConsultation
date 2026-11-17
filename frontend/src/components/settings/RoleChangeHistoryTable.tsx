import React from 'react'
import { useTranslation } from 'react-i18next'

interface RoleChangeHistoryTableProps {
  roleRequests: any[]
}

const RoleChangeHistoryTable: React.FC<RoleChangeHistoryTableProps> = ({ roleRequests }) => {
  const { t } = useTranslation()
  if (roleRequests.length === 0) return null
  return (
    <div className="si-b4c2d096">
      <h3 className="si-155c25d0">{t('settings.roleChange.historyTitle')}</h3>
      <div className="data-table-container">
        <table className="module-table">
          <thead>
            <tr>
              <th>{t('settings.roleChange.selectRole')}</th>
              <th>Status</th>
              <th>{t('settings.roleChange.submitted')}</th>
              <th>{t('settings.roleChange.reviewed')}</th>
            </tr>
          </thead>
          <tbody>
            {roleRequests.map((r: any) => (
              <tr key={r.id}>
                <td>{r.requestedRole?.replace('_', ' ')}</td>
                <td><span className={`badge badge-${r.status === 'approved' ? 'active' : r.status === 'rejected' ? 'danger' : 'pending'}`}>{r.status}</span></td>
                <td className="si-756a9f21">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="si-756a9f21">
                  {r.reviewedBy || '-'}
                  {r.rejectionReason && <div className="si-16697caf">{r.rejectionReason}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default RoleChangeHistoryTable
