import React from 'react'
import type { TFunction } from 'i18next'
import { parseJsonbArray } from './inpatientShared'

// ─── Full vitals-log history for a single inpatient, most recent first ───
export const VitalsHistoryModal: React.FC<{
  patient: any
  t: TFunction
  formatDateTime: (date: any) => string
  onClose: () => void
}> = ({ patient, t, formatDateTime, onClose }) => {
  const allVitals: any[] = parseJsonbArray(patient.vitals_log)
  return (
    <div className="si-db8248e9" onClick={onClose}>
      <div className="si-8352c1ac" onClick={e => e.stopPropagation()}>
        <div className="si-101fd1d0">
          <h3 className="si-44087c4b">📈 {t('inpatientManagement.vitalsHistory')} - {patient.animal_name}</h3>
          <button onClick={onClose} className="si-5e3e3c2e">✕</button>
        </div>
        {allVitals.length === 0 ? (
          <p className="si-82a22425">{t('inpatientManagement.noVitalsHistory')}</p>
        ) : (
          <div className="si-51b511c9">
            {[...allVitals].reverse().map((v: any, i: number) => (
              <div key={i} className={`vitals-entry ${i === 0 ? 'is-latest' : ''}`}>
                <div className="si-670106c2">
                  <span className="vitals-entry-label">
                    {i === 0 ? `✨ ${t('inpatientManagement.latest')}` : `#${allVitals.length - i}`}
                  </span>
                  <span className="si-db3602ae">{v.timestamp ? formatDateTime(v.timestamp) : ''}</span>
                </div>
                <div className="si-eccb2a53">
                  {v.temperature != null && (
                    <div className="si-4af84499">
                      <div className="si-49a99517">🌡️ {t('inpatientManagement.temperatureLabel')}</div>
                      <div className="si-7cf7733e">{v.temperature}°F</div>
                    </div>
                  )}
                  {v.heartRate != null && (
                    <div className="si-4af84499">
                      <div className="si-49a99517">❤️ {t('inpatientManagement.heartRateLabel')}</div>
                      <div className="si-7cf7733e">{v.heartRate} bpm</div>
                    </div>
                  )}
                  {v.weight != null && (
                    <div className="si-4af84499">
                      <div className="si-49a99517">⚖️ {t('inpatientManagement.weightLabel')}</div>
                      <div className="si-7cf7733e">{v.weight} kg</div>
                    </div>
                  )}
                </div>
                {v.notes && <div className="si-82c00a4d">📝 {v.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
