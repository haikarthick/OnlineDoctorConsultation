import React from 'react'
import type { TFunction } from 'i18next'
import { EnrollmentRecord, PatientSearchResult } from './hospitalNetworksShared'
import PatientSearchPanel from './PatientSearchPanel'
import EnrollmentsPanel from './EnrollmentsPanel'

export interface PatientsTabProps {
  hasSelectedNetwork: boolean
  patientSearch: string
  setPatientSearch: (v: string) => void
  patientSearchLoading: boolean
  patientResults: PatientSearchResult[]
  enrollmentSuccessIds: Set<string>
  requestingEnrollment: string | null
  onRequestEnrollment: (animalId: string) => void
  onRegisterWalkIn: () => void
  onInviteOnline: () => void
  allEnrollments: EnrollmentRecord[]
  enrollmentsLoading: boolean
  enrollmentFilter: 'all' | 'pending_consent' | 'active' | 'declined'
  setEnrollmentFilter: (v: 'all' | 'pending_consent' | 'active' | 'declined') => void
  formatDate: (d: string) => string
  speciesLabel: (species: string | undefined, t: TFunction) => string
  t: TFunction
}

const PatientsTab: React.FC<PatientsTabProps> = (props) => {
  const { hasSelectedNetwork, t } = props

  if (!hasSelectedNetwork) {
    return (
      <div className="hn-tab-content">
        <div className="hn-empty-state">
          <div className="hn-empty-icon">👥</div>
          <div className="hn-empty-title">{t('hospitalNetworks.selectNetwork')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="hn-tab-content">
      <PatientSearchPanel
        patientSearch={props.patientSearch}
        setPatientSearch={props.setPatientSearch}
        patientSearchLoading={props.patientSearchLoading}
        patientResults={props.patientResults}
        enrollmentSuccessIds={props.enrollmentSuccessIds}
        requestingEnrollment={props.requestingEnrollment}
        onRequestEnrollment={props.onRequestEnrollment}
        onRegisterWalkIn={props.onRegisterWalkIn}
        onInviteOnline={props.onInviteOnline}
        speciesLabel={props.speciesLabel}
        t={t}
      />
      <EnrollmentsPanel
        allEnrollments={props.allEnrollments}
        enrollmentsLoading={props.enrollmentsLoading}
        enrollmentFilter={props.enrollmentFilter}
        setEnrollmentFilter={props.setEnrollmentFilter}
        formatDate={props.formatDate}
        speciesLabel={props.speciesLabel}
        t={t}
      />
    </div>
  )
}

export default PatientsTab
