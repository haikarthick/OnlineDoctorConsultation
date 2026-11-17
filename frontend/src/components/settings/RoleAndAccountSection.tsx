import React from 'react'
import { useTranslation } from 'react-i18next'
import BecomeGroomerCard from './BecomeGroomerCard'
import RoleChangeRequestPanel from './RoleChangeRequestPanel'
import RoleChangeHistoryTable from './RoleChangeHistoryTable'
import NotificationPreferencesPanel from './NotificationPreferencesPanel'

interface RoleAndAccountSectionProps {
  currentUserRole?: string
  groomingEnabled: boolean
  canUseGroomerConsole: boolean
  rcMsg: string
  approvedRequest: any
  pendingRequest: any
  rcLoading: boolean
  selectedNewRole: string
  setSelectedNewRole: (role: string) => void
  isVetRequest: boolean
  rcVetLicense: string
  setRcVetLicense: (v: string) => void
  rcVetFee: string
  setRcVetFee: (v: string) => void
  rcVetExperience: string
  setRcVetExperience: (v: string) => void
  rcVetClinic: string
  setRcVetClinic: (v: string) => void
  rcVetSpecializations: string
  setRcVetSpecializations: (v: string) => void
  rcReason: string
  setRcReason: (v: string) => void
  vetDetailsMissing: boolean
  rcSubmitting: boolean
  onSubmitRoleChange: () => void
  onCancelRoleChange: (id: string) => void
  roleRequests: any[]
  digestEnabled: boolean
  setDigestEnabled: (v: boolean) => void
  prefSaving: boolean
  prefSaved: boolean
  prefLoadError: string
  setPrefLoadError: (v: string) => void
  onSaveNotificationPreferences: () => void
}

const RoleAndAccountSection: React.FC<RoleAndAccountSectionProps> = (props) => {
  const { t } = useTranslation()
  const { currentUserRole, groomingEnabled, canUseGroomerConsole, rcMsg } = props

  return (
    <div className="settings-section">
      <h2>{t('settings.roleChange.sectionTitle')}</h2>
      <p className="si-edc77e88">{t('settings.roleChange.sectionDesc')}</p>

      <div className="si-7e63ec4f">
        <span className="si-c3b93ebb">{t('settings.roleChange.currentRole')}: </span>
        <span className="badge badge-active si-ecf1d5e5">{currentUserRole?.replace('_', ' ')}</span>
      </div>

      {/* Grooming & Spa: becoming a provider is ADDITIVE (createProvider grants the 'groomer'
          role alongside the existing one), so it deliberately does NOT go through the role-change
          request below - that flow REPLACES users.role and would cost a pet owner access to
          their own animals. Hidden once they already run a business. */}
      {groomingEnabled && !canUseGroomerConsole && <BecomeGroomerCard />}

      {rcMsg && <div className={`module-alert ${rcMsg.includes('✓') || rcMsg.includes('submitted') || rcMsg.includes('cancel') ? 'success' : 'error'} si-7e63ec4f`}>{rcMsg}</div>}

      <RoleChangeRequestPanel
        currentUserRole={currentUserRole}
        approvedRequest={props.approvedRequest}
        pendingRequest={props.pendingRequest}
        rcLoading={props.rcLoading}
        selectedNewRole={props.selectedNewRole}
        setSelectedNewRole={props.setSelectedNewRole}
        isVetRequest={props.isVetRequest}
        rcVetLicense={props.rcVetLicense}
        setRcVetLicense={props.setRcVetLicense}
        rcVetFee={props.rcVetFee}
        setRcVetFee={props.setRcVetFee}
        rcVetExperience={props.rcVetExperience}
        setRcVetExperience={props.setRcVetExperience}
        rcVetClinic={props.rcVetClinic}
        setRcVetClinic={props.setRcVetClinic}
        rcVetSpecializations={props.rcVetSpecializations}
        setRcVetSpecializations={props.setRcVetSpecializations}
        rcReason={props.rcReason}
        setRcReason={props.setRcReason}
        vetDetailsMissing={props.vetDetailsMissing}
        rcSubmitting={props.rcSubmitting}
        onSubmit={props.onSubmitRoleChange}
        onCancel={props.onCancelRoleChange}
      />

      <RoleChangeHistoryTable roleRequests={props.roleRequests} />

      <NotificationPreferencesPanel
        digestEnabled={props.digestEnabled}
        setDigestEnabled={props.setDigestEnabled}
        prefSaving={props.prefSaving}
        prefSaved={props.prefSaved}
        prefLoadError={props.prefLoadError}
        setPrefLoadError={props.setPrefLoadError}
        onSave={props.onSaveNotificationPreferences}
      />
    </div>
  )
}

export default RoleAndAccountSection
