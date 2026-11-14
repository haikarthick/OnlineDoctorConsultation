import React from 'react'
import { TFunction } from 'i18next'
import { EmptyState, RecordItemProps } from './medicalRecordsShared'

interface Props {
  t: TFunction
  isVet: boolean
  isAdmin: boolean
  isFarmer: boolean
  selectedAnimal: string
  labResults: any[]
  recordItemProps: RecordItemProps
  fmtDate: (d: string) => string
  setShowModal: (m: string | null) => void
  setModalData: (d: any) => void
}

const LabResultsTab: React.FC<Props> = ({ t, isVet, isAdmin, isFarmer, selectedAnimal, labResults, recordItemProps, fmtDate, setShowModal, setModalData }) => (
  <div>
    {!selectedAnimal ? (
      <EmptyState icon="🔬" title={t('medicalRecords.labResultsTab.selectPet')} subtitle={t('medicalRecords.selectPetGenericSub')} />
    ) : (
      <>
        {(isVet || isAdmin || isFarmer) && (
          <div className="si-bab8e8bc">
            <button className="btn-primary si-f1d94d5d"
              onClick={() => { setShowModal('lab_result'); setModalData({ status: 'pending' }) }}>
              {t('medicalRecords.labResultsTab.addButton')}
            </button>
          </div>
        )}
        {labResults.length === 0 ? (
          <EmptyState icon="🔬" title={t('medicalRecords.labResultsTab.emptyTitle')} subtitle={t('medicalRecords.labResultsTab.emptySubtitle')} />
        ) : (
          <div className="records-list">
            {labResults.map((lr: any) => {
              const itemProps = recordItemProps(lr.id)
              return (
              <div key={lr.id} {...itemProps} className={`${itemProps.className} mr-lab-card${lr.isAbnormal ? ' is-abnormal' : ''}`}>
                <div className="record-icon">🔬</div>
                <div className="record-details">
                  <h4>{lr.testName} {lr.testCategory ? `(${lr.testCategory})` : ''}</h4>
                  <p>{t('medicalRecords.labResultsTab.testDate')} {fmtDate(lr.testDate)} {lr.orderedByName ? `| ${t('medicalRecords.labResultsTab.orderedBy')} ${lr.orderedByName}` : ''}</p>
                  {lr.resultValue && (
                    <p><strong>{t('medicalRecords.labResultsTab.result')}</strong> {lr.resultValue} {lr.unit || ''} {lr.normalRange ? <span className="text-muted">({t('medicalRecords.labResultsTab.normal')} {lr.normalRange})</span> : ''}</p>
                  )}
                  {lr.interpretation && <p className="text-muted">📝 {lr.interpretation}</p>}
                  {lr.labName && <p className="text-muted">{t('medicalRecords.labResultsTab.lab')} {lr.labName}</p>}
                </div>
                <div className="record-actions si-3cc8434c">
                  <span className={`badge ${lr.status === 'completed' ? 'badge-completed' : lr.status === 'pending' ? 'badge-pending' : 'badge-info'}`}>{t(lr.status === 'in_progress' ? 'common.inProgress' : `common.${lr.status}`)}</span>
                  {lr.isAbnormal && <span className="badge si-26aba32a">{t('medicalRecords.labResultsTab.abnormal')}</span>}
                </div>
              </div>
              )
            })}
          </div>
        )}
      </>
    )}
  </div>
)

export default LabResultsTab
