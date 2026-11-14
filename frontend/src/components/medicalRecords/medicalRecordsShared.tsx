import React from 'react'
import { useTranslation } from 'react-i18next'

export type Tab = 'overview' | 'consultations' | 'prescriptions' | 'vaccinations' | 'lab_results' | 'allergies' | 'weight' | 'timeline' | 'hospital_visits' | 'records' | 'certificates'

export const RECORD_TYPES = [
  { value: 'diagnosis', label: 'Diagnosis', icon: '🩺', color: '#667eea' },
  { value: 'prescription', label: 'Prescription', icon: '💊', color: '#059669' },
  { value: 'lab_report', label: 'Lab Report', icon: '🔬', color: '#d97706' },
  { value: 'vaccination', label: 'Vaccination', icon: '💉', color: '#7c3aed' },
  { value: 'surgery', label: 'Surgery', icon: '🏥', color: '#dc2626' },
  { value: 'imaging', label: 'Imaging', icon: '📷', color: '#0891b2' },
  { value: 'follow_up', label: 'Follow-up', icon: '📅', color: '#ea580c' },
  { value: 'other', label: 'Other', icon: '📋', color: '#6b7280' },
]

export const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#059669' },
  { value: 'normal', label: 'Normal', color: '#667eea' },
  { value: 'high', label: 'High', color: '#d97706' },
  { value: 'critical', label: 'Critical', color: '#dc2626' },
]

export const getRecordTypeInfo = (type: string) => RECORD_TYPES.find(r => r.value === type) || RECORD_TYPES[7]
export const getSeverityInfo = (sev: string) => SEVERITY_OPTIONS.find(s => s.value === sev) || SEVERITY_OPTIONS[1]

export const StatCard: React.FC<{ icon: string; label: string; value: number; color: string; sub?: string; onClick?: () => void }> = ({ icon, label, value, color, sub, onClick }) => (
  <div
    onClick={onClick}
    className={`mr-stat-card${onClick ? ' is-clickable' : ''}`}
    // eslint-disable-next-line react/forbid-dom-props -- `color` is a free-form accent passed per call site, not a closed enum; set as a custom property rather than a literal style object.
    style={{ ['--accent' as string]: color }}
  >
    <div className="si-a98fab3e">{icon}</div>
    <div className="mr-stat-value">{value}</div>
    <div className="si-d29f9778">{label}</div>
    {sub && <div className="si-4f20e511">{sub}</div>}
    {onClick && <div className="si-0293220f">Click to view →</div>}
  </div>
)

export const EmptyState: React.FC<{ icon: string; title: string; subtitle: string }> = ({ icon, title, subtitle }) => (
  <div className="si-73dafd71">
    <div className="si-fc4388e2">{icon}</div>
    <p className="si-37a5ef01">{title}</p>
    <p className="si-0a803082">{subtitle}</p>
  </div>
)

export const QuickBtn: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button type="button" onClick={onClick} className="si-e52e3f8e">{label}</button>
)

export const ModalField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="si-bab8e8bc">
    <label className="si-13e1b2f2">{label}</label>
    {children}
  </div>
)

export const ModalActions: React.FC<{ onCancel: () => void; onSave: () => void; saving: boolean; disabled: boolean }> = ({ onCancel, onSave, saving, disabled }) => {
  const { t } = useTranslation()
  return (
  <div className="si-f74c20c9">
    <button type="button" onClick={onCancel} className="si-3bb1104a">{t('medicalRecords.modals.cancel')}</button>
    <button onClick={onSave} disabled={disabled || saving} className="btn-primary mr-modal-save">
      {saving ? t('medicalRecords.modals.saving') : t('medicalRecords.modals.save')}
    </button>
  </div>
  )
}

export type RecordItemProps = (id: string) => { className: string; ref?: React.LegacyRef<HTMLDivElement> }
