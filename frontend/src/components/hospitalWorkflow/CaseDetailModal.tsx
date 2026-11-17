import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import { STAGES, STAGE_ICONS } from './hospitalWorkflowShared'

interface CaseDetailModalProps {
  selectedCase: any
  setSelectedCase: Dispatch<SetStateAction<any>>
  caseMedicalSummary: any
  t: TFunction
  formatDateTime: (date: any) => string
  onAdvanceStage: (stage: string) => void
}

export default function CaseDetailModal({ selectedCase, setSelectedCase, caseMedicalSummary, t, formatDateTime, onAdvanceStage }: CaseDetailModalProps) {
  if (!selectedCase) return null

  return (
    <div className="si-db8248e9">
      <div className="si-0eebe146">
        <div className="si-101fd1d0">
          <h3 className="si-44087c4b">{t('hospitalWorkflow.case')}: {selectedCase.animal_name || t('hospitalWorkflow.unknown')}</h3>
          <button onClick={() => setSelectedCase(null)} className="si-30be827b">✕</button>
        </div>

        {/* Stage Pipeline */}
        <div className="si-41235f19">
          {STAGES.map((s, i) => {
            const isActive = s === selectedCase.current_stage
            const isPast = STAGES.indexOf(selectedCase.current_stage) > i
            return (
              <div key={s} className={`hw-case-stage-step ${isActive ? 'is-active' : isPast ? 'is-past' : ''}`}>
                {STAGE_ICONS[s]} {s}
              </div>
            )
          })}
        </div>

        <div className="si-0c1c8326">
          <div><strong>{t('hospitalWorkflow.priority')}:</strong> <span className={`hw-priority-text pri-${selectedCase.priority}`}>{selectedCase.priority}</span></div>
          <div><strong>{t('hospitalWorkflow.status')}:</strong> {selectedCase.status}</div>
          <div><strong>{t('hospitalWorkflow.owner')}:</strong> {selectedCase.owner_first_name} {selectedCase.owner_last_name}</div>
          <div><strong>{t('hospitalWorkflow.vet')}:</strong> {selectedCase.vet_first_name ? `Dr. ${selectedCase.vet_first_name} ${selectedCase.vet_last_name}` : t('hospitalWorkflow.unassigned')}</div>
          {selectedCase.chief_complaint && <div className="si-0defe487"><strong>{t('hospitalWorkflow.chiefComplaint')}:</strong> {selectedCase.chief_complaint}</div>}
          {selectedCase.diagnosis && <div className="si-0defe487"><strong>{t('hospitalWorkflow.diagnosis')}:</strong> {selectedCase.diagnosis}</div>}
          {selectedCase.treatment_plan && <div className="si-0defe487"><strong>{t('hospitalWorkflow.treatmentPlan')}:</strong> {selectedCase.treatment_plan}</div>}
        </div>

        {/* Transition History */}
        {selectedCase.transitions && selectedCase.transitions.length > 0 && (
          <div className="si-7e63ec4f">
            <h4 className="si-24d15068">{t('hospitalWorkflow.workflowHistory')}</h4>
            <div className="si-85143a6f">
              {selectedCase.transitions.map((tr: any, i: number) => (
                <div key={i} className="si-72912216">
                  <span className="si-b2cfcbec">{tr.from_stage || '-'} → {tr.to_stage}</span>
                  <span className="si-98734f9a">{t('hospitalWorkflow.by')} {tr.first_name} {tr.last_name}</span>
                  <span className="si-bd94d1af">{formatDateTime(tr.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Medical History Panel */}
        {caseMedicalSummary && (
          <div className="si-3d341eca">
            <div className="si-db20e0d4">📋 {t('hospitalWorkflow.medicalHistory')} - {caseMedicalSummary.animal?.name}</div>
            <div className="si-933bc6a9">
              {/* Allergies */}
              {caseMedicalSummary.allergies?.length > 0 && (
                <div className="si-170de209">
                  <div className="si-17b5a0dc">⚠️ {t('hospitalWorkflow.allergies')}</div>
                  <div className="si-50c82988">
                    {caseMedicalSummary.allergies.map((a: any) => (
                      <span key={a.id} className="si-8edb907a">{a.allergen} ({a.severity})</span>
                    ))}
                  </div>
                </div>
              )}
              {/* Recent records */}
              {caseMedicalSummary.recentRecords?.length > 0 && (
                <div className="si-170de209">
                  <div className="si-47ae2048">{t('hospitalWorkflow.recentRecords')}</div>
                  {caseMedicalSummary.recentRecords.slice(0, 5).map((r: any) => (
                    <div key={r.id} className="si-6804a5dc">
                      <span className="si-b2cfcbec">{r.title || r.record_type}</span>
                      {r.diagnosis && <span className="si-23033f05"> - {r.diagnosis}</span>}
                      <span className="si-68f18f88">{formatDateTime(r.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Active prescriptions */}
              {caseMedicalSummary.recentPrescriptions?.length > 0 && (
                <div className="si-170de209">
                  <div className="si-47ae2048">💊 {t('hospitalWorkflow.recentPrescriptions')}</div>
                  {caseMedicalSummary.recentPrescriptions.slice(0, 3).map((p: any) => (
                    <div key={p.id} className="si-05aae049">
                      {p.diagnosis || 'Prescription'} - Dr. {p.vet_first_name} {p.vet_last_name} <span className="si-385f4f50">{formatDateTime(p.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Vaccinations */}
              {caseMedicalSummary.recentVaccinations?.length > 0 && (
                <div>
                  <div className="si-47ae2048">💉 {t('hospitalWorkflow.vaccinations')}</div>
                  <div className="si-50c82988">
                    {caseMedicalSummary.recentVaccinations.map((v: any) => (
                      <span key={v.id} className="si-657d89a1">{v.vaccine_name}</span>
                    ))}
                  </div>
                </div>
              )}
              {!caseMedicalSummary.recentRecords?.length && !caseMedicalSummary.allergies?.length && (
                <div className="si-72381c27">{t('hospitalWorkflow.noMedicalHistory')}</div>
              )}
            </div>
          </div>
        )}

        {/* Advance Stage */}
        {selectedCase.status === 'active' && (
          <div className="si-b9eb5ec7">
            {STAGES.filter(s => STAGES.indexOf(s) > STAGES.indexOf(selectedCase.current_stage)).map(s => (
              <button key={s} onClick={() => onAdvanceStage(s)}
                className={`hw-advance-btn ${s === 'discharge' ? 'is-discharge' : ''}`}>
                → {STAGE_ICONS[s]} {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
