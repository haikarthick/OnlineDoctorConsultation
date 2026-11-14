export interface Enterprise { id: string; name: string }
export interface Animal { id: string; name: string; species: string; breed?: string; uniqueId?: string; groupName?: string; groupId?: string }
// A batch group has no per-head animal rows: currentCount IS the flock, maintained by the
// population ledger. managementMode decides whether a record can attach to the group at all.
export interface AnimalGroup { id: string; name: string; groupType: string; managementMode?: 'individual' | 'batch'; currentCount?: number }

export type Tab = 'overview' | 'records' | 'vaccinations' | 'allergies' | 'lab_results'
export type ModalType = null | 'add-record' | 'add-vaccination' | 'add-allergy' | 'add-lab' | 'view-record'

export interface RecordFormState {
  subjectType: string; animalId: string; groupId: string; recordType: string; title: string;
  content: string; severity: string; followUpDate: string; medications: string; eventDate: string;
  headCountTreated: string; affectedCount: string; mortalityCount: string
}
export interface VaccFormState {
  subjectType: string; animalId: string; groupId: string; vaccineName: string; vaccineType: string;
  dateAdministered: string; nextDueDate: string; batchNumber: string; manufacturer: string;
  dosage: string; certificateNumber: string; headCountTreated: string
}
export interface AllergyFormState { animalId: string; allergen: string; reaction: string; severity: string; notes: string }
export interface LabFormState {
  animalId: string; testName: string; testDate: string; testCategory: string; resultValue: string;
  normalRange: string; unit: string; status: string; interpretation: string; labName: string; notes: string
}

export const RECORD_TYPE_ICONS: Record<string, string> = {
  diagnosis: '\u{1FA7A}', prescription: '\u{1F48A}', lab_report: '\u{1F52C}', vaccination: '\u{1F489}',
  surgery: '\u{1F3E5}', imaging: '\u{1F4F7}', follow_up: '\u{1F4C5}', other: '\u{1F4CB}',
}
export const RECORD_TYPES = [
  { value: 'diagnosis', label: 'Diagnosis' }, { value: 'prescription', label: 'Prescription' },
  { value: 'lab_report', label: 'Lab Report' }, { value: 'vaccination', label: 'Vaccination' },
  { value: 'surgery', label: 'Surgery' }, { value: 'imaging', label: 'Imaging' },
  { value: 'follow_up', label: 'Follow-up' }, { value: 'other', label: 'Other' },
]

const KNOWN_SEVERITIES = ['low', 'normal', 'high', 'critical']

// Severity is a closed 4-value enum (plus an "unknown" fallback) - styled via static
// .sev-<key> modifier classes in ModulePage.css rather than a per-element inline color.
export const severityClass = (severity: string | undefined, size: 'sm' | 'lg' = 'sm'): string => {
  const key = severity && KNOWN_SEVERITIES.includes(severity) ? severity : 'unknown'
  return `hm-severity-badge${size === 'lg' ? '-lg' : ''} sev-${key}`
}

export const dueStatusClass = (dueStatus: string | undefined): string =>
  `hm-due-badge due-${dueStatus === 'overdue' ? 'overdue' : dueStatus === 'upcoming' ? 'upcoming' : 'current'}`

export const labStatusClass = (status: string | undefined): string =>
  `hm-lab-status-badge status-${status === 'completed' ? 'completed' : status === 'pending' ? 'pending' : 'inprogress'}`
