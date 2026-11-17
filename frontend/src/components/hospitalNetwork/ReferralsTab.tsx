import React from 'react'
import type { TFunction } from 'i18next'
import { HospitalNetwork } from './hospitalNetworksShared'
import ReferralsTable from './ReferralsTable'
import PatientTransfersPanel from './PatientTransfersPanel'
import CreateReferralModal, { ReferralFormState } from './CreateReferralModal'
import ReferralResponseModal from './ReferralResponseModal'

export interface ReferralsTabProps {
  selectedNetwork: HospitalNetwork
  referralSuccess: string
  referralError: string
  referralDirection: 'incoming' | 'outgoing' | 'all'
  onChangeDirection: (dir: 'incoming' | 'outgoing' | 'all') => void
  referralsLoading: boolean
  referrals: any[]
  speciesLabel: (species: string | undefined, t: TFunction) => string
  onAcceptReferral: (referral: any) => void
  onRejectReferral: (referral: any) => void
  transfers: any[]
  onCompleteTransfer: (transfer: any) => void
  onOpenCreateReferral: () => void
  showCreateReferralModal: boolean
  referralForm: ReferralFormState
  setReferralForm: React.Dispatch<React.SetStateAction<ReferralFormState>>
  referralNetworkHospitals: any[]
  referralSubmitting: boolean
  onCloseCreateReferral: () => void
  onSubmitCreateReferral: (e: React.FormEvent) => void
  responseModal: { referral: any; action: 'accepted' | 'rejected' } | null
  responseNotes: string
  setResponseNotes: (v: string) => void
  respondingSubmitting: boolean
  onCloseResponseModal: () => void
  onConfirmResponse: () => void
  t: TFunction
}

const ReferralsTab: React.FC<ReferralsTabProps> = (props) => {
  const { selectedNetwork, referralSuccess, referralError, t } = props

  return (
    <div className="hn-tab-content">
      {/* Header */}
      <div className="module-header si-478be2e9">
        <div>
          <h2 className="si-44087c4b">{t('networkReferrals.title')}</h2>
          <p className="si-d078dad1">{selectedNetwork.name}</p>
        </div>
        <button className="module-btn primary" onClick={props.onOpenCreateReferral}>
          + {t('networkReferrals.create')}
        </button>
      </div>

      {/* Alerts */}
      {referralSuccess && <div className="module-alert success si-7e63ec4f">{referralSuccess}</div>}
      {referralError && <div className="module-alert error si-7e63ec4f">{referralError}</div>}

      <ReferralsTable
        referralDirection={props.referralDirection}
        onChangeDirection={props.onChangeDirection}
        referralsLoading={props.referralsLoading}
        referrals={props.referrals}
        speciesLabel={props.speciesLabel}
        onAccept={props.onAcceptReferral}
        onReject={props.onRejectReferral}
        t={t}
      />

      <PatientTransfersPanel
        transfers={props.transfers}
        speciesLabel={props.speciesLabel}
        onComplete={props.onCompleteTransfer}
        t={t}
      />

      {props.showCreateReferralModal && (
        <CreateReferralModal
          referralForm={props.referralForm}
          setReferralForm={props.setReferralForm}
          referralNetworkHospitals={props.referralNetworkHospitals}
          referralError={referralError}
          referralSubmitting={props.referralSubmitting}
          onClose={props.onCloseCreateReferral}
          onSubmit={props.onSubmitCreateReferral}
          t={t}
        />
      )}

      {props.responseModal && (
        <ReferralResponseModal
          responseModal={props.responseModal}
          responseNotes={props.responseNotes}
          setResponseNotes={props.setResponseNotes}
          respondingSubmitting={props.respondingSubmitting}
          onClose={props.onCloseResponseModal}
          onConfirm={props.onConfirmResponse}
          t={t}
        />
      )}
    </div>
  )
}

export default ReferralsTab
