import React from 'react'
import type { TFunction } from 'i18next'
import { STATUS_COLORS, parseJsonbArray } from './inpatientShared'

// ─── Single inpatient card: status, room, last vitals, medical history + status-transition actions ───
export const InpatientCard: React.FC<{
  p: any
  t: TFunction
  formatDateTime: (date: any) => string
  formatCurrency: (amount: number) => string
  speciesLabel: (species: string | undefined, t: TFunction) => string
  onShowVitals: (p: any) => void
  onShowVitalsHistory: (p: any) => void
  onLoadMedicalHistory: (p: any) => void
  onStatusChange: (id: string, status: string) => void
}> = ({ p, t, formatDateTime, formatCurrency, speciesLabel, onShowVitals, onShowVitalsHistory, onLoadMedicalHistory, onStatusChange }) => {
  const statusClass = STATUS_COLORS[p.status] ? `status-${p.status}` : 'status-admitted'
  const meds = parseJsonbArray(p.medications)
  const vitals = parseJsonbArray(p.vitals_log)
  const lastVitals = vitals.length > 0 ? vitals[vitals.length - 1] : null

  return (
    <div className={`inpatient-card ${statusClass}`}>
      <div className="si-7a981126">
        <div>
          <div className="si-9dd702ba">{p.animal_name}</div>
          <div className="si-4801fc30">{speciesLabel(p.animal_species, t)}{p.animal_breed ? ` - ${p.animal_breed}` : ''}{p.animal_weight ? ` • ${p.animal_weight}kg` : ''}</div>
          <div className="si-db3602ae">{t('inpatientManagement.owner')}: {p.owner_first_name} {p.owner_last_name}{p.owner_phone ? ` • ${p.owner_phone}` : ''}</div>
          {p.enterpriseName && (
            <div className="si-e893254c">
              🏢 {p.enterpriseName}{p.groupName ? ` › ${p.groupName}` : ''}
            </div>
          )}
          {((p as any).referralId || (p as any).referral_id) && (
            <div className="si-fd4f18cf">
              🔄 Referred from Network
            </div>
          )}
        </div>
        <span className={`inpatient-status-badge ${statusClass}`}>{(p.status || '').replace(/_/g, ' ')}</span>
      </div>

      <div className="si-339f6726">
        <div><strong>{t('inpatientManagement.type')}:</strong> {(p.admission_type || '').replace(/_/g, ' ')}</div>
        {p.room_number && <div><strong>{t('inpatientManagement.room')}:</strong> {p.room_number}{p.bed_number ? ` / ${t('inpatientManagement.bed')} ${p.bed_number}` : ''}</div>}
        <div><strong>{t('inpatientManagement.admittedAt')}:</strong> {formatDateTime(p.admitted_at)}</div>
        {p.estimated_discharge && <div><strong>{t('inpatientManagement.estDischarge')}:</strong> {formatDateTime(p.estimated_discharge)}</div>}
        {p.daily_rate > 0 && <div><strong>{t('inpatientManagement.dailyRate')}:</strong> {formatCurrency(p.daily_rate)}</div>}
      </div>

      {/* Last Vitals - clickable to open full history */}
      {lastVitals && (
        <button onClick={() => onShowVitalsHistory(p)} className="si-b25056d0">
          <strong>{t('inpatientManagement.lastVitals')}:</strong>{' '}
          {lastVitals.temperature && `🌡️ ${lastVitals.temperature}°F`}{' '}
          {lastVitals.heartRate && `❤️ ${lastVitals.heartRate}bpm`}{' '}
          {lastVitals.weight && `⚖️ ${lastVitals.weight}kg`}
          <span className="si-68f18f88">{lastVitals.timestamp && formatDateTime(lastVitals.timestamp)}</span>
          <span className="si-49160324">📈 {t('inpatientManagement.viewVitalsHistory')} ({vitals.length})</span>
        </button>
      )}

      {p.care_instructions && <div className="si-0c383e3b"><strong>{t('inpatientManagement.care')}:</strong> {p.care_instructions}</div>}
      {meds.length > 0 && <div className="si-0d8c3802">💊 {meds.length} {t('inpatientManagement.medications')}</div>}

      {/* Actions */}
      <div className="si-d2dd2367">
        <button onClick={() => onShowVitals(p)} className="si-c49f76ab">📊 {t('inpatientManagement.vitals')}</button>
        <button onClick={() => onLoadMedicalHistory(p)} className="si-99c426a3">📋 {t('inpatientManagement.history')}</button>
        {p.status === 'admitted' && <button onClick={() => onStatusChange(p.id, 'in_treatment')} className="si-816667d0">{t('inpatientManagement.startTreatment')}</button>}
        {p.status === 'in_treatment' && <button onClick={() => onStatusChange(p.id, 'recovering')} className="si-9b0031b9">{t('inpatientManagement.recovering')}</button>}
        {p.status === 'recovering' && <button onClick={() => onStatusChange(p.id, 'ready_to_discharge')} className="si-255a19db">{t('inpatientManagement.readyToDischarge')}</button>}
        {(p.status === 'ready_to_discharge' || p.status === 'recovering') && <button onClick={() => onStatusChange(p.id, 'discharged')} className="si-4f5ef47c">{t('inpatientManagement.discharge')}</button>}
      </div>
    </div>
  )
}
