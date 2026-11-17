import React from 'react'
import { TFunction } from 'i18next'
import { EmptyState } from './medicalRecordsShared'

interface Props {
  t: TFunction
  selectedAnimal: string
  loadingHospitalVisits: boolean
  hospitalVisits: { queueVisits: any[]; inpatientAdmissions: any[] }
  networkReferralHistory: any[]
  fmtDate: (d: string) => string
}

const HospitalVisitsTab: React.FC<Props> = ({ t, selectedAnimal, loadingHospitalVisits, hospitalVisits, networkReferralHistory, fmtDate }) => (
  <div>
    {!selectedAnimal ? (
      <EmptyState icon="🏥" title={t('medicalRecords.hospitalVisitsTab.selectPet')} subtitle={t('medicalRecords.hospitalVisitsTab.selectPetHint')} />
    ) : loadingHospitalVisits ? (
      <div className="si-86638a30"><div className="loading-spinner si-8d6ac58b" /></div>
    ) : (hospitalVisits.queueVisits.length === 0 && hospitalVisits.inpatientAdmissions.length === 0) ? (
      <EmptyState icon="🏥" title={t('medicalRecords.hospitalVisitsTab.emptyTitle')} subtitle={t('medicalRecords.hospitalVisitsTab.emptyHint')} />
    ) : (
      <div className="si-0fa972fb">

        {/* Queue / Walk-in Visits */}
        {hospitalVisits.queueVisits.length > 0 && (
          <div>
            <h3 className="si-f27ecf95">🚶 {t('medicalRecords.hospitalVisitsTab.queueVisits')} ({hospitalVisits.queueVisits.length})</h3>
            <div className="si-977f8af1">
              {hospitalVisits.queueVisits.map((v: any) => {
                const statusKeys = ['waiting', 'in_triage', 'in_examination', 'in_treatment', 'discharged', 'no_show']
                const scClass = statusKeys.includes(v.status) ? `q-${v.status}` : 'q-default'
                return (
                  <div key={v.id} className={`mr-visit-card ${scClass}`}>
                    <div className="si-9d036184">
                      <div>
                        <div className="si-abd5b4ee">🏥 {v.hospital_name}</div>
                        {v.reason && <div className="si-f473664f">📋 {v.reason}</div>}
                        {v.chief_complaint && v.chief_complaint !== v.reason && <div className="si-f199afd6">Case: {v.chief_complaint}</div>}
                        {v.diagnosis && <div className="si-c4ec351d">🩺 {v.diagnosis}</div>}
                        {(v.vet_first_name || v.vet_last_name) && <div className="si-aff656fd">👨‍⚕️ Dr. {v.vet_first_name} {v.vet_last_name}</div>}
                      </div>
                      <div className="si-f4e64596">
                        <span className={`mr-visit-badge ${scClass}`}>#{v.queue_number} · {(v.status || '').replace(/_/g, ' ')}</span>
                        {v.priority !== 'normal' && <div className="si-9c8a4c03">⚡ {v.priority}</div>}
                        <div className="si-0610a7ce">{v.checked_in_at ? fmtDate(v.checked_in_at) : ''}</div>
                        {v.case_stage && <div className="si-7de800ff">📊 Case: {v.case_stage}</div>}
                      </div>
                    </div>
                    {v.triage_notes && <div className="si-995d72ed">📝 Triage: {v.triage_notes}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Inpatient Admissions */}
        {hospitalVisits.inpatientAdmissions.length > 0 && (
          <div>
            <h3 className="si-f27ecf95">🛏️ {t('medicalRecords.hospitalVisitsTab.inpatientAdmissions')} ({hospitalVisits.inpatientAdmissions.length})</h3>
            <div className="si-977f8af1">
              {hospitalVisits.inpatientAdmissions.map((a: any) => {
                const statusKeys = ['admitted', 'in_treatment', 'recovering', 'ready_to_discharge', 'discharged', 'icu']
                const scClass = statusKeys.includes(a.status) ? `a-${a.status}` : 'a-default'
                const vitals = Array.isArray(a.vitals_log) ? a.vitals_log : (() => { try { return JSON.parse(a.vitals_log || '[]') } catch { return [] } })()
                return (
                  <div key={a.id} className={`mr-visit-card ${scClass}`}>
                    <div className="si-9d036184">
                      <div>
                        <div className="si-abd5b4ee">🏥 {a.hospital_name}</div>
                        <div className="si-f473664f">🛏️ {(a.admission_type || '').replace(/_/g, ' ')}{a.room_number ? ` · Room ${a.room_number}` : ''}</div>
                        {a.care_instructions && <div className="si-f199afd6">💊 {a.care_instructions.substring(0, 80)}{a.care_instructions.length > 80 ? '...' : ''}</div>}
                        {a.discharge_notes && <div className="si-37eb6ea2">📋 {a.discharge_notes.substring(0, 80)}</div>}
                        {(a.vet_first_name || a.vet_last_name) && <div className="si-aff656fd">👨‍⚕️ Dr. {a.vet_first_name} {a.vet_last_name}</div>}
                      </div>
                      <div className="si-f4e64596">
                        <span className={`mr-visit-badge ${scClass}`}>{(a.status || '').replace(/_/g, ' ')}</span>
                        <div className="si-0610a7ce">In: {fmtDate(a.admitted_at)}</div>
                        {a.discharged_at && <div className="si-26b03e6b">Out: {fmtDate(a.discharged_at)}</div>}
                        {vitals.length > 0 && <div className="si-7de800ff">📊 {vitals.length} vitals recorded</div>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* P4-MED2: Unified Referral History */}
        {networkReferralHistory.length > 0 && (
          <div className="si-cbfb1eb8">
            <h3 className="si-f27ecf95">🔄 {t('medicalRecords.unifiedReferrals')} ({networkReferralHistory.length})</h3>
            <div className="data-table-container">
              <table className="module-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>From Vet</th>
                    <th>To Vet / Hospital</th>
                    <th>Reason</th>
                    <th>Priority</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {networkReferralHistory.map((ref: any) => (
                    <tr key={`${ref.type}-${ref.id}`}>
                      <td className="si-7a2c0aef">
                        {fmtDate(ref.createdAt)}
                      </td>
                      <td>
                        <span className={`mr-ref-type-badge type-${ref.type === 'network' ? 'network' : 'platform'}`}>
                          {ref.type === 'network' ? t('medicalRecords.networkReferral') : t('medicalRecords.platformReferral')}
                        </span>
                      </td>
                      <td className="si-0a803082">{ref.fromVetName || '-'}</td>
                      <td className="si-0a803082">
                        {ref.toHospitalName || ref.toVetName || '-'}
                      </td>
                      <td className="si-633ac59d">{ref.reason}</td>
                      <td>
                        <span className={`mr-ref-priority-badge priority-${ref.priority === 'emergency' ? 'emergency' : ref.priority === 'high' ? 'high' : 'normal'}`}>
                          {ref.priority || 'normal'}
                        </span>
                      </td>
                      <td>
                        <span className={`module-badge ${
                          ref.status === 'accepted' || ref.status === 'completed' ? 'badge-success' :
                          ref.status === 'rejected' ? 'badge-error' : 'badge-pending'
                        }`}>{ref.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )}
  </div>
)

export default HospitalVisitsTab
