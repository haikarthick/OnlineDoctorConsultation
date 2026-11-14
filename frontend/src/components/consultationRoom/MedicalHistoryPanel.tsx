import React from 'react'
import { useTranslation } from 'react-i18next'
import { useMasterData } from '../../context/MasterDataContext'

interface MedicalHistoryPanelProps {
  historyLoading: boolean
  animalInfo: any
  allergies: any[]
  vaccinations: any[]
  medicalRecords: any[]
  labResults: any[]
}

const MedicalHistoryPanel: React.FC<MedicalHistoryPanelProps> = ({
  historyLoading, animalInfo, allergies, vaccinations, medicalRecords, labResults
}) => {
  const { t } = useTranslation()
  const { speciesLabel } = useMasterData()

  return (
    <div className="si-3dc8ac19">
      {historyLoading && (
        <div className="si-ed5d7a12">
          <div className="loading-spinner si-8d6ac58b" />
          <p className="si-b416ac63">{t('consultationRoom.loadingMedicalHistory')}</p>
        </div>
      )}

      {!historyLoading && !animalInfo && (
        <div className="si-b1c6542e">
          <div className="si-75bae6a3">📋</div>
          <p className="si-c6905158">{t('consultationRoom.noAnimalLinked')}</p>
          <p className="si-0a803082">{t('consultationRoom.animalLinkMessage')}</p>
        </div>
      )}

      {!historyLoading && animalInfo && (
        <>
          {/* Animal Info Card */}
          <div className="si-843e21c5">
            <div className="si-2cd8f04c">
              🐾 {animalInfo.name || 'Unknown'}
            </div>
            <div className="si-9ac294d9">
              {speciesLabel(animalInfo.species, t)}{animalInfo.breed ? ` / ${animalInfo.breed}` : ''}
              {animalInfo.age ? ` - ${animalInfo.age}` : ''}
              {animalInfo.weight ? ` - ${animalInfo.weight}kg` : ''}
            </div>
            {animalInfo.uniqueId && <div className="si-b1a83cef">ID: {animalInfo.uniqueId}</div>}
            {(animalInfo.enterpriseName || animalInfo.enterprise_name) && (
              <div className="si-acad5bc1">
                🏢 Farm: {animalInfo.enterpriseName || animalInfo.enterprise_name}
                {(animalInfo.groupName || animalInfo.group_name) && ` › ${animalInfo.groupName || animalInfo.group_name}`}
              </div>
            )}
          </div>

          {/* Allergies */}
          <div className="si-bab8e8bc">
            <h4 className="si-d151fd1b">
              ⚠️ {t('consultationRoom.allergies')} ({allergies.length})
            </h4>
            {allergies.length === 0 ? (
              <p className="si-df056d61">{t('consultationRoom.noKnownAllergies')}</p>
            ) : (
              <div className="si-a78c2ab8">
                {allergies.map((a: any, i: number) => (
                  <span key={i} className={`cr-allergy-badge ${a.severity === 'severe' ? 'is-severe' : ''}`}>
                    {a.allergen || a.name || 'Unknown'} ({a.severity || 'unknown'})
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Vaccinations */}
          <div className="si-bab8e8bc">
            <h4 className="si-72539157">
              💉 {t('consultationRoom.vaccinations')} ({vaccinations.length})
            </h4>
            {vaccinations.length === 0 ? (
              <p className="si-df056d61">{t('consultationRoom.noVaccinationRecords')}</p>
            ) : (
              <div className="si-859b1456">
                {vaccinations.slice(0, 10).map((v: any, i: number) => (
                  <div key={i} className="si-4c23d640">
                    <strong>{v.vaccineName || v.vaccine_name || v.name || 'Vaccine'}</strong>
                    {v.dateAdministered || v.date_administered ? (
                      <span className="si-ee2911f8">
                        {new Date(v.dateAdministered || v.date_administered).toLocaleDateString()}
                      </span>
                    ) : null}
                    {v.status && <span className={`cr-vaccination-status ${v.status === 'completed' ? 'is-completed' : ''}`}>({v.status})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Medical Records */}
          <div className="si-bab8e8bc">
            <h4 className="si-1ea073bf">
              🩺 {t('consultationRoom.medicalRecords')} ({medicalRecords.length})
            </h4>
            {medicalRecords.length === 0 ? (
              <p className="si-df056d61">{t('consultationRoom.noMedicalRecords')}</p>
            ) : (
              <div className="si-a01c8940">
                {medicalRecords.slice(0, 10).map((r: any, i: number) => (
                  <div key={i} className="si-55c66e92">
                    <div className="si-b2cfcbec">{r.recordType || r.record_type || r.type || 'Record'}</div>
                    {r.diagnosis && <div className="si-93b487ee">Dx: {r.diagnosis}</div>}
                    {r.treatment && <div className="si-23033f05">Tx: {r.treatment}</div>}
                    {(r.createdAt || r.created_at || r.date) && (
                      <div className="si-a5de6cea">
                        {new Date(r.createdAt || r.created_at || r.date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lab Results */}
          <div className="si-dab75309">
            <h4 className="si-7af7d0b5">
              🔬 {t('consultationRoom.labResults')} ({labResults.length})
            </h4>
            {labResults.length === 0 ? (
              <p className="si-df056d61">{t('consultationRoom.noLabResults')}</p>
            ) : (
              <div className="si-859b1456">
                {labResults.slice(0, 10).map((l: any, i: number) => (
                  <div key={i} className="si-4c23d640">
                    <strong>{l.testName || l.test_name || l.name || 'Test'}</strong>
                    {l.result && <span className="si-c3560ab0">→ {l.result}</span>}
                    {l.status && (
                      <span className={`cr-lab-status-badge ${l.status === 'completed' ? 'is-completed' : ''}`}>{l.status}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default MedicalHistoryPanel
