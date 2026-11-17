import React from 'react'
import type { TFunction } from 'i18next'
import { HospitalNetwork, NetworkDashboard, NetworkHospital, NetworkMember } from './hospitalNetworksShared'
import NetworkDetailHeader from './NetworkDetailHeader'
import BranchHospitalsPanel from './BranchHospitalsPanel'
import ApprovalWorkflowPanel from './ApprovalWorkflowPanel'
import BrandingSettingsPanel, { BrandingFormState } from './BrandingSettingsPanel'
import StaffMembersPanel from './StaffMembersPanel'

export interface NetworkDetailTabProps {
  selectedNetwork: HospitalNetwork | null
  detailLoading: boolean
  dashboard: NetworkDashboard | null
  financialData: any
  networkHospitals: NetworkHospital[]
  networkMembers: NetworkMember[]
  pendingInvites: any[]
  approvalLoading: boolean
  approvalHistory: any[]
  brandingForm: BrandingFormState
  setBrandingForm: React.Dispatch<React.SetStateAction<BrandingFormState>>
  brandingSaving: boolean
  brandingSaved: boolean
  showBrandingPanel: boolean
  setShowBrandingPanel: React.Dispatch<React.SetStateAction<boolean>>
  userNetworkRole?: string
  userRole?: string
  formatDate: (d: string) => string
  onEditNetwork: () => void
  onDeactivateNetwork: (networkId: string) => void
  onAddBranch: () => void
  onEditBranch: (h: NetworkHospital) => void
  onDeleteBranch: (h: NetworkHospital) => void
  onApprovalRequestInfo: () => void
  onApprovalApprove: () => void
  onApprovalReject: () => void
  onApprovalSuspend: () => void
  onBrandingSave: () => void
  onInviteStaff: () => void
  onAddMember: () => void
  onEditMember: (member: NetworkMember) => void
  onRemoveMember: (member: NetworkMember) => void
  onCopyInviteLink: (invite: any) => void
  onRevokeInvite: (invite: any) => void
  t: TFunction
}

const NetworkDetailTab: React.FC<NetworkDetailTabProps> = (props) => {
  const { selectedNetwork, detailLoading, t } = props

  return (
    <div className="hn-tab-content">
      {!selectedNetwork ? (
        <div className="hn-empty-state">
          <div className="hn-empty-icon">🔍</div>
          <div className="hn-empty-title">{t('hospitalNetworks.selectNetwork')}</div>
        </div>
      ) : detailLoading ? (
        <div className="hn-loading">⏳ {t('common.loading')}</div>
      ) : (
        <>
          <NetworkDetailHeader
            selectedNetwork={selectedNetwork}
            dashboard={props.dashboard}
            financialData={props.financialData}
            userNetworkRole={props.userNetworkRole}
            userRole={props.userRole}
            onEdit={props.onEditNetwork}
            onDeactivate={props.onDeactivateNetwork}
            t={t}
          />

          <div className="hn-detail-panels">
            <BranchHospitalsPanel
              networkHospitals={props.networkHospitals}
              onAddBranch={props.onAddBranch}
              onEditBranch={props.onEditBranch}
              onDeleteBranch={props.onDeleteBranch}
              t={t}
            />

            {/* P6-APPROVAL: Approval Workflow Panel */}
            {(['admin', 'corporate_admin', 'compliance_officer'] as string[]).includes(props.userRole ?? '') && (
              <ApprovalWorkflowPanel
                selectedNetwork={selectedNetwork}
                userRole={props.userRole}
                approvalLoading={props.approvalLoading}
                approvalHistory={props.approvalHistory}
                formatDate={props.formatDate}
                onRequestInfo={props.onApprovalRequestInfo}
                onApprove={props.onApprovalApprove}
                onReject={props.onApprovalReject}
                onSuspend={props.onApprovalSuspend}
                t={t}
              />
            )}

            {/* P6-BRANDING: Settings Panel */}
            <BrandingSettingsPanel
              userNetworkRole={props.userNetworkRole}
              userRole={props.userRole}
              brandingForm={props.brandingForm}
              setBrandingForm={props.setBrandingForm}
              brandingSaving={props.brandingSaving}
              brandingSaved={props.brandingSaved}
              showBrandingPanel={props.showBrandingPanel}
              setShowBrandingPanel={props.setShowBrandingPanel}
              onSave={props.onBrandingSave}
              t={t}
            />

            <StaffMembersPanel
              networkMembers={props.networkMembers}
              pendingInvites={props.pendingInvites}
              userNetworkRole={props.userNetworkRole}
              userRole={props.userRole}
              onInviteStaff={props.onInviteStaff}
              onAddMember={props.onAddMember}
              onEditMember={props.onEditMember}
              onRemoveMember={props.onRemoveMember}
              onCopyInviteLink={props.onCopyInviteLink}
              onRevokeInvite={props.onRevokeInvite}
              t={t}
            />
          </div>
        </>
      )}
    </div>
  )
}

export default NetworkDetailTab
