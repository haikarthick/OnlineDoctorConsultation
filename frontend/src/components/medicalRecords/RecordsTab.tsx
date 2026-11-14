import React from 'react'
import { TFunction } from 'i18next'
import { EmptyState, RECORD_TYPES, getRecordTypeInfo } from './medicalRecordsShared'

interface Props {
  t: TFunction
  selectedAnimal: string
  medRecords: any[]
  recordTypeFilter: string
  setRecordTypeFilter: (f: string) => void
  loadMedRecords: (typeFilter?: string) => void
  fmtDate: (d: string) => string
}

const RecordsTab: React.FC<Props> = ({ t, selectedAnimal, medRecords, recordTypeFilter, setRecordTypeFilter, loadMedRecords, fmtDate }) => (
  <div>
    {!selectedAnimal ? (
      <EmptyState icon="📋" title={t('medicalRecords.recordsTab.selectPet')} subtitle={t('medicalRecords.recordsTab.selectPetHint')} />
    ) : (
      <>
        {/* Filter bar */}
        <div className="si-ad0381af">
          <span className="si-73510eb6">{t('medicalRecords.recordsTab.filterBy')}</span>
          {[{ value: '', label: t('medicalRecords.recordsTab.allTypes') }, ...RECORD_TYPES].map(rt => (
            <button
              key={rt.value}
              onClick={() => { setRecordTypeFilter(rt.value); loadMedRecords(rt.value) }}
              className={`mr-rt-filter-chip${recordTypeFilter === rt.value ? ' is-active' : ''}`}
            >{'icon' in rt ? `${rt.icon} ` : ''}{rt.label}</button>
          ))}
        </div>
        {medRecords.length === 0 ? (
          <EmptyState icon="📋" title={t('medicalRecords.recordsTab.emptyTitle')} subtitle={t('medicalRecords.recordsTab.emptySubtitle')} />
        ) : (
          <div className="si-51b511c9">
            {medRecords.map((rec: any) => {
              const rtInfo = getRecordTypeInfo(rec.recordType || rec.record_type)
              const sev = rec.severity
              const rtKey = (rec.recordType || rec.record_type || 'other')
              return (
                <div key={rec.id} className={`record-item mr-record-card rt-${rtKey}`}>
                  <div className="si-4f84a9e7">
                    <div className="si-6acd75e8">
                      <div className="si-5c21a377">
                        <span className="si-5c854a6d">{rtInfo.icon}</span>
                        <strong className="si-38c57a68">{rec.title}</strong>
                        <span className={`badge mr-type-badge rt-${rtKey}`}>{rtInfo.label}</span>
                        {sev && sev !== 'normal' && (
                          <span className={`badge mr-sev-badge sev-${sev}`}>{sev}</span>
                        )}
                        {rec.isConfidential && <span className="badge si-f20de549">🔒 {t('medicalRecords.recordsTab.confidential')}</span>}
                      </div>
                      <p className="si-479558e0">{rec.content}</p>
                      {rec.followUpDate && (
                        <p className="si-d8d51f83">📅 {t('medicalRecords.recordsTab.followUp')} {fmtDate(rec.followUpDate || rec.follow_up_date)}</p>
                      )}
                    </div>
                    <span className="si-ad866f58">{fmtDate(rec.createdAt || rec.created_at)}</span>
                  </div>
                  {rec.veterinarianName && (
                    <p className="si-77d60966">
                      {t('medicalRecords.recordsTab.by')} {rec.veterinarianName}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </>
    )}
  </div>
)

export default RecordsTab
