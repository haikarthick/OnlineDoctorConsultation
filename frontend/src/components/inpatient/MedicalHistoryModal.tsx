import React from 'react'
import type { TFunction } from 'i18next'
import { parseJsonbArray } from './inpatientShared'

// ─── Animal's medical summary: allergies, recent records, prescriptions, vaccinations ───
export const MedicalHistoryModal: React.FC<{
  patient: any
  medicalHistory: any
  loadingHistory: boolean
  t: TFunction
  formatDateTime: (date: any) => string
  speciesLabel: (species: string | undefined, t: TFunction) => string
  onClose: () => void
}> = ({ patient, medicalHistory, loadingHistory, t, formatDateTime, speciesLabel, onClose }) => {
  return (
    <div className="si-db8248e9">
      <div className="si-84e7f0b2">
        <div className="si-101fd1d0">
          <h3 className="si-44087c4b">📋 {t('inpatientManagement.medicalHistory')} - {patient.animal_name}</h3>
          <button onClick={onClose} className="si-e23655e2">✕</button>
        </div>

        {loadingHistory && <div className="si-86638a30"><div className="spinner" /></div>}

        {medicalHistory && (
          <div className="si-58f59f7a">
            {/* Animal Info */}
            {medicalHistory.animal && (
              <div className="si-1a4f5caf">
                <div className="si-8b3478d6">🐾 {medicalHistory.animal.name}</div>
                <div className="si-c3e04596">{speciesLabel(medicalHistory.animal.species, t)}{medicalHistory.animal.breed ? ` - ${medicalHistory.animal.breed}` : ''}{medicalHistory.animal.weight ? ` • ${medicalHistory.animal.weight}kg` : ''}{medicalHistory.animal.age_years ? ` • ${medicalHistory.animal.age_years}y` : ''}</div>
                <div className="si-f199afd6">{t('inpatientManagement.owner')}: {medicalHistory.animal.owner_first_name} {medicalHistory.animal.owner_last_name}</div>
              </div>
            )}

            {/* Allergies */}
            {medicalHistory.allergies?.length > 0 && (
              <div>
                <div className="si-17ce82b6">⚠️ {t('inpatientManagement.allergies')}</div>
                <div className="si-50c82988">
                  {medicalHistory.allergies.map((a: any, i: number) => (
                    <span key={i} className="si-904f6bc9">
                      {a.allergen} {a.severity && `(${a.severity})`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Medical Records */}
            {medicalHistory.recentRecords?.length > 0 && (
              <div>
                <div className="si-04114015">🏥 {t('inpatientManagement.recentMedicalRecords')}</div>
                {medicalHistory.recentRecords.slice(0, 5).map((r: any, i: number) => (
                  <div key={i} className="si-c6735535">
                    <div className="si-34ec0bf0">
                      <span className="si-b2cfcbec">{r.title || r.record_type?.replace(/_/g, ' ')}</span>
                      <span className="si-26b03e6b">{r.created_at ? formatDateTime(r.created_at) : ''}</span>
                    </div>
                    {r.severity && r.severity !== 'normal' && <div className="si-df68402c">Severity: {r.severity}</div>}
                    {r.content && <div className="si-734144ea">{r.content.substring(0, 120)}{r.content.length > 120 ? '...' : ''}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Prescriptions */}
            {medicalHistory.recentPrescriptions?.length > 0 && (
              <div>
                <div className="si-04114015">💊 {t('inpatientManagement.recentPrescriptions')}</div>
                {medicalHistory.recentPrescriptions.slice(0, 5).map((rx: any, i: number) => {
                  const meds = parseJsonbArray(typeof rx.medications === 'string' ? rx.medications : JSON.stringify(rx.medications || []))
                  return (
                    <div key={i} className="si-e1bc71cf">
                      {meds.length > 0 ? meds.map((m: any, j: number) => (
                        <div key={j}><span className="si-7d5d38b3">{m.name || m.medication}</span>{m.dosage && <span className="si-98734f9a"> - {m.dosage}</span>}</div>
                      )) : <span className="si-7d5d38b3">{rx.instructions || 'Prescription'}</span>}
                      {rx.valid_until && <div className="si-96a4ece3">Valid until: {new Date(rx.valid_until).toLocaleDateString()}</div>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Vaccinations */}
            {medicalHistory.recentVaccinations?.length > 0 && (
              <div>
                <div className="si-04114015">💉 {t('inpatientManagement.vaccinations')}</div>
                <div className="si-50c82988">
                  {medicalHistory.recentVaccinations.map((v: any, i: number) => (
                    <span key={i} className="si-8ca4e418">
                      {v.vaccine_name} {v.date_administered ? `(${new Date(v.date_administered).toLocaleDateString()})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!medicalHistory.recentRecords?.length && !medicalHistory.recentPrescriptions?.length && !medicalHistory.recentVaccinations?.length && !medicalHistory.allergies?.length && (
              <p className="si-08d38003">{t('inpatientManagement.noMedicalHistory')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
