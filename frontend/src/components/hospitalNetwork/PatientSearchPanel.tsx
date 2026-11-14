import React from 'react'
import type { TFunction } from 'i18next'
import { PatientSearchResult } from './hospitalNetworksShared'

export interface PatientSearchPanelProps {
  patientSearch: string
  setPatientSearch: (v: string) => void
  patientSearchLoading: boolean
  patientResults: PatientSearchResult[]
  enrollmentSuccessIds: Set<string>
  requestingEnrollment: string | null
  onRequestEnrollment: (animalId: string) => void
  onRegisterWalkIn: () => void
  onInviteOnline: () => void
  speciesLabel: (species: string | undefined, t: TFunction) => string
  t: TFunction
}

const PatientSearchPanel: React.FC<PatientSearchPanelProps> = ({
  patientSearch, setPatientSearch, patientSearchLoading, patientResults,
  enrollmentSuccessIds, requestingEnrollment, onRequestEnrollment,
  onRegisterWalkIn, onInviteOnline, speciesLabel, t,
}) => {
  return (
    <div className="module-card si-af65fe13">
      <div className="hn-panel-header">
        <h3>{t('hospitalNetworks.patients.searchTitle')}</h3>
        <div className="si-d223efb3">
          <button className="module-btn small primary" onClick={onRegisterWalkIn}>
            + {t('hospitalNetworks.patients.registerWalkIn', 'Register Walk-In')}
          </button>
          <button className="module-btn small" onClick={onInviteOnline}>
            ✉️ {t('hospitalNetworks.patients.inviteForOnlineAccess', 'Invite for Online Access')}
          </button>
        </div>
      </div>
      <div className="card-body">
        <p className="module-form-helper si-676930d7">
          {t('hospitalNetworks.patients.searchHelper')}
        </p>
        <div className="module-form-group">
          <input
            className="module-input"
            placeholder={t('hospitalNetworks.patients.searchPlaceholder')}
            value={patientSearch}
            onChange={e => setPatientSearch(e.target.value)}
          />
        </div>
        {patientSearch.length > 0 && patientSearch.length < 2 && (
          <p className="si-1617d817">{t('hospitalNetworks.patients.searchMinChars')}</p>
        )}
        {patientSearchLoading && <div className="hn-loading">⏳ {t('common.loading')}</div>}
        {!patientSearchLoading && patientSearch.length >= 2 && patientResults.length === 0 && (
          <p className="si-55855538">{t('hospitalNetworks.patients.noResults')}</p>
        )}
        {patientResults.map(patient => (
          <div key={patient.userId} className="hn-member-item si-a5c710fe">
            <div className="si-4eadb825">
              <div className="hn-member-avatar">{(patient.userName ?? 'P').charAt(0).toUpperCase()}</div>
              <div>
                <div className="hn-member-name">{patient.userName}</div>
                <div className="si-3e1bd646">{patient.userEmail}</div>
                {patient.userPhone && <div className="si-921b05f1">{patient.userPhone}</div>}
              </div>
            </div>
            <div className="si-37f17fee">
              {(patient.animals ?? []).length === 0 ? (
                <p className="si-921b05f1">No animals registered</p>
              ) : (
                <div className="si-b9eb5ec7">
                  {(patient.animals ?? []).map(animal => (
                    <div key={animal.id} className="si-e677ad2d">
                      <span className="si-8756b2e7">{animal.name}</span>
                      <span className="si-192b696d">{speciesLabel(animal.species, t)}</span>
                      {animal.uniqueId && <span className="si-ee839ecf">{animal.uniqueId}</span>}
                      {((animal as any).enrollmentStatus === 'active' || (animal as any).isEnrolled) && (
                        <span className="si-f781ec01">
                          ✓ Already Enrolled
                        </span>
                      )}
                      {enrollmentSuccessIds.has(animal.id) ? (
                        <span className="si-8812039f">✓ {t('hospitalNetworks.patients.enrollmentRequested')}</span>
                      ) : (
                        <button
                          className="module-btn small primary si-d013fb7a"
                          disabled={requestingEnrollment === animal.id}
                          onClick={() => onRequestEnrollment(animal.id)}
                        >
                          {requestingEnrollment === animal.id ? '⏳' : t('hospitalNetworks.patients.requestEnrollment')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PatientSearchPanel
