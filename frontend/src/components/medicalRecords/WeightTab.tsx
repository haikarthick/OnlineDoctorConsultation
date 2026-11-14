import React from 'react'
import { TFunction } from 'i18next'
import { EmptyState, RecordItemProps } from './medicalRecordsShared'

interface Props {
  t: TFunction
  selectedAnimal: string
  weightHistory: any[]
  recordItemProps: RecordItemProps
  fmtDate: (d: string) => string
  setShowModal: (m: string | null) => void
  setModalData: (d: any) => void
}

const WeightTab: React.FC<Props> = ({ t, selectedAnimal, weightHistory, recordItemProps, fmtDate, setShowModal, setModalData }) => (
  <div>
    {!selectedAnimal ? (
      <EmptyState icon="⚖️" title={t('medicalRecords.weightTab.selectPet')} subtitle={t('medicalRecords.selectPetGenericSub')} />
    ) : (
      <>
        <div className="si-bab8e8bc">
          <button className="btn-primary si-f1d94d5d"
            onClick={() => { setShowModal('weight'); setModalData({ unit: 'kg' }) }}>
            {t('medicalRecords.weightTab.addButton')}
          </button>
        </div>
        {weightHistory.length === 0 ? (
          <EmptyState icon="⚖️" title={t('medicalRecords.weightTab.emptyTitle')} subtitle={t('medicalRecords.weightTab.emptySubtitle')} />
        ) : (
          <>
            {/* Weight Chart (simple text-based) */}
            <div className="si-55be0ff5">
              <h4 className="si-02563074">{t('medicalRecords.weightTab.weightTrend')}</h4>
              <div className="si-d8174e8b">
                {weightHistory.slice().reverse().slice(-20).map((w: any, i: number) => {
                  const max = Math.max(...weightHistory.map((x: any) => parseFloat(x.weight)))
                  const min = Math.min(...weightHistory.map((x: any) => parseFloat(x.weight)))
                  const range = max - min || 1
                  const pct = ((parseFloat(w.weight) - min) / range) * 80 + 20
                  return (
                    <div key={i} title={`${w.weight} ${w.unit} - ${fmtDate(w.recordedAt)}`}
                      className="mr-weight-bar"
                      // eslint-disable-next-line react/forbid-dom-props -- bar height is a genuinely continuous, per-item computed value; set as a custom property rather than a literal style object.
                      style={{ ['--h' as string]: `${pct}%` }} />
                  )
                })}
              </div>
              <p className="text-muted si-f27ad32c">
                {t('medicalRecords.weightTab.latest')} <strong>{weightHistory[0]?.weight} {weightHistory[0]?.unit}</strong>
                {weightHistory.length > 1 && (() => {
                  const diff = (parseFloat(weightHistory[0].weight) - parseFloat(weightHistory[1].weight)).toFixed(2)
                  const num = parseFloat(diff)
                  return ` (${num > 0 ? '+' : ''}${diff} ${weightHistory[0].unit} ${t('medicalRecords.weightTab.fromLast')})`
                })()}
              </p>
            </div>
            <div className="records-list">
              {weightHistory.map((w: any) => (
                <div key={w.id} {...recordItemProps(w.id)} className="si-605c43ff">
                  <div className="record-icon">⚖️</div>
                  <div className="record-details">
                    <h4>{w.weight} {w.unit}</h4>
                    <p className="text-muted">{t('medicalRecords.weightTab.recorded')} {fmtDate(w.recordedAt)} {w.recordedByName ? `by ${w.recordedByName}` : ''}</p>
                    {w.notes && <p className="text-muted">📝 {w.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </>
    )}
  </div>
)

export default WeightTab
