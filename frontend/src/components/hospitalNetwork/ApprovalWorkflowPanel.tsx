import React from 'react'
import type { TFunction } from 'i18next'
import { HospitalNetwork } from './hospitalNetworksShared'

const APPROVAL_EVENT_ICONS: Record<string, string> = {
  submitted: '📨', under_review: '🔍', info_requested: '❓',
  info_provided: '📝', approved: '✅', rejected: '❌',
  suspended: '⏸', reactivated: '🔄',
}

export interface ApprovalWorkflowPanelProps {
  selectedNetwork: HospitalNetwork
  userRole?: string
  approvalLoading: boolean
  approvalHistory: any[]
  formatDate: (d: string) => string
  onRequestInfo: () => void
  onApprove: () => void
  onReject: () => void
  onSuspend: () => void
  t: TFunction
}

const ApprovalWorkflowPanel: React.FC<ApprovalWorkflowPanelProps> = ({
  selectedNetwork, userRole, approvalLoading, approvalHistory, formatDate,
  onRequestInfo, onApprove, onReject, onSuspend, t,
}) => {
  return (
    <div className="module-card">
      <div className="hn-panel-header">
        <h3>📋 {t('networkApproval.title')}</h3>
        {userRole === 'admin' && !selectedNetwork.isApproved && (
          <div className="si-d223efb3">
            <button className="module-btn small si-e54ed6c3" onClick={onRequestInfo}>
              ❓ {t('networkApproval.requestInfo')}
            </button>
            <button className="module-btn small primary" onClick={onApprove}>
              ✅ {t('networkApproval.approveNetwork')}
            </button>
            <button className="module-btn small si-42e8005b" onClick={onReject}>
              ❌ {t('networkApproval.rejectNetwork')}
            </button>
          </div>
        )}
        {userRole === 'admin' && selectedNetwork.isApproved && (
          <button className="module-btn small si-01fda312" onClick={onSuspend}>
            ⏸ Suspend Network
          </button>
        )}
      </div>
      <div className="card-body">
        {approvalLoading ? (
          <div className="hn-loading">⏳ {t('common.loading')}</div>
        ) : approvalHistory.length === 0 ? (
          <div className="hn-panel-empty">📋 {t('networkApproval.noHistory')}</div>
        ) : (
          <div className="hn-approval-timeline">
            {approvalHistory.map((ev, idx) => (
              <div key={ev.id} className={`hn-approval-event ${idx === 0 ? 'hn-approval-event-latest' : ''}`}>
                <div className="hn-approval-event-icon">{APPROVAL_EVENT_ICONS[ev.eventType] ?? '📋'}</div>
                <div className="hn-approval-event-body">
                  <div className="hn-approval-event-type">{t(`networkApproval.${ev.eventType}` as any) || ev.eventType}</div>
                  <div className="hn-approval-event-meta">
                    {t('networkApproval.actedBy', { name: ev.actorName })} · {formatDate(ev.createdAt)}
                  </div>
                  {ev.notes && <div className="hn-approval-event-notes">"{ev.notes}"</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ApprovalWorkflowPanel
