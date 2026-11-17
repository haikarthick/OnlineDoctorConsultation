import React from 'react'
import type { TFunction } from 'i18next'
import { EnrollmentRecord } from './hospitalNetworksShared'

export interface EnrollmentsPanelProps {
  allEnrollments: EnrollmentRecord[]
  enrollmentsLoading: boolean
  enrollmentFilter: 'all' | 'pending_consent' | 'active' | 'declined'
  setEnrollmentFilter: (v: 'all' | 'pending_consent' | 'active' | 'declined') => void
  formatDate: (d: string) => string
  speciesLabel: (species: string | undefined, t: TFunction) => string
  t: TFunction
}

const EnrollmentsPanel: React.FC<EnrollmentsPanelProps> = ({
  allEnrollments, enrollmentsLoading, enrollmentFilter, setEnrollmentFilter, formatDate, speciesLabel, t,
}) => {
  const filtered = allEnrollments.filter(e => enrollmentFilter === 'all' || e.enrollmentStatus === enrollmentFilter)

  return (
    <div className="module-card">
      <div className="hn-panel-header">
        <h3>{t('hospitalNetworks.patients.allEnrollments')}</h3>
        <div className="hn-filter-toggle">
          {(['all', 'pending_consent', 'active', 'declined'] as const).map(f => (
            <button
              key={f}
              className={`module-btn small${enrollmentFilter === f ? ' primary' : ''}`}
              onClick={() => setEnrollmentFilter(f)}
            >
              {f === 'all' ? t('hospitalNetworks.patients.filterAll')
                : f === 'pending_consent' ? t('hospitalNetworks.patients.filterPending')
                : f === 'active' ? t('hospitalNetworks.patients.filterActive')
                : t('hospitalNetworks.patients.filterDeclined')}
            </button>
          ))}
        </div>
      </div>
      <div className="card-body">
        {enrollmentsLoading ? (
          <div className="hn-loading">⏳ {t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="hn-panel-empty">{t('hospitalNetworks.patients.noEnrollments')}</div>
        ) : (
          <div className="data-table-container">
            <table className="module-table">
              <thead>
                <tr>
                  <th>{t('hospitalNetworks.patients.colAnimal')}</th>
                  <th>{t('hospitalNetworks.patients.colOwner')}</th>
                  <th>{t('hospitalNetworks.patients.colNetworkId')}</th>
                  <th>{t('hospitalNetworks.patients.colStatus')}</th>
                  <th>{t('hospitalNetworks.patients.colRequested')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id}>
                    <td>
                      <div className="si-b2cfcbec">{e.animalName}</div>
                      <div className="si-3e1bd646">{speciesLabel(e.species, t)}</div>
                    </td>
                    <td>
                      <div>{e.ownerName}</div>
                      <div className="si-921b05f1">{e.ownerEmail}</div>
                    </td>
                    <td>
                      {e.networkPatientId
                        ? <span className="si-714eb092">{e.networkPatientId}</span>
                        : '-'}
                    </td>
                    <td>
                      <span className={`badge badge-${e.enrollmentStatus === 'active' ? 'success' : e.enrollmentStatus === 'pending_consent' ? 'pending' : 'error'}`}>
                        {e.enrollmentStatus === 'pending_consent' ? t('hospitalNetworks.patients.statusPending')
                          : e.enrollmentStatus === 'active' ? t('hospitalNetworks.patients.statusActive')
                          : e.enrollmentStatus === 'declined' ? t('hospitalNetworks.patients.statusDeclined')
                          : t('hospitalNetworks.patients.statusRevoked')}
                      </span>
                    </td>
                    <td className="si-3e1bd646">{formatDate(e.enrollmentRequestedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default EnrollmentsPanel
