export interface TimelineEvent {
  id: string
  type: string
  title: string
  description: string
  date: string
  severity?: string
  status?: string
  createdBy?: string
  createdByName?: string
  metadata?: Record<string, unknown>
}

export interface AnimalOption {
  id: string
  name: string
  species: string
  ownerName?: string
}

export interface GroupHistoryItem {
  source: 'own' | 'group'
  id: string
  recordType: string
  title: string
  content: string | null
  eventDate: string
  groupId: string | null
  groupName: string | null
  headCountTreated: number | null
}

// ─── Event type config ──────────────────────────────────────
export const EVENT_TYPES: Record<string, { label: string; icon: string; color: string; bg: string; navPath?: string }> = {
  vaccination:        { label: 'Vaccination',      icon: '💉', color: '#4caf50', bg: '#e8f5e9', navPath: '/medical-records' },
  record_diagnosis:   { label: 'Diagnosis',        icon: '🩺', color: '#2196f3', bg: '#e3f2fd', navPath: '/medical-records' },
  record_surgery:     { label: 'Surgery',          icon: '🔪', color: '#f44336', bg: '#ffebee', navPath: '/medical-records' },
  record_imaging:     { label: 'Imaging',          icon: '📷', color: '#607d8b', bg: '#eceff1', navPath: '/medical-records' },
  record_follow_up:   { label: 'Follow-up',        icon: '🔄', color: '#00bcd4', bg: '#e0f7fa', navPath: '/medical-records' },
  record_vaccination: { label: 'Vaccination Rec',  icon: '💉', color: '#4caf50', bg: '#e8f5e9', navPath: '/medical-records' },
  record_prescription:{ label: 'Prescription',     icon: '💊', color: '#9c27b0', bg: '#f3e5f5', navPath: '/prescriptions' },
  record_lab_report:  { label: 'Lab Report',       icon: '🧪', color: '#ff9800', bg: '#fff3e0', navPath: '/medical-records' },
  record_other:       { label: 'Other Record',     icon: '📄', color: '#78909c', bg: '#eceff1', navPath: '/medical-records' },
  prescription:       { label: 'Prescription',     icon: '💊', color: '#9c27b0', bg: '#f3e5f5', navPath: '/prescriptions' },
  lab_result:         { label: 'Lab Result',       icon: '🧪', color: '#ff9800', bg: '#fff3e0', navPath: '/medical-records' },
  weight:             { label: 'Weight Entry',     icon: '⚖️', color: '#009688', bg: '#e0f2f1', navPath: '/medical-records' },
  booking:            { label: 'Booking',          icon: '📅', color: '#3f51b5', bg: '#e8eaf6', navPath: '/consultations' },
  consultation:       { label: 'Consultation',     icon: '🏥', color: '#673ab7', bg: '#ede7f6', navPath: '/consultations' },
  allergy:            { label: 'Allergy',          icon: '⚠️', color: '#ff5722', bg: '#fbe9e7', navPath: '/medical-records' },
}

export const FILTER_CATEGORIES = [
  { key: 'vaccination',  label: 'Vaccinations',   icon: '💉', matchTypes: ['vaccination', 'record_vaccination'] },
  { key: 'diagnosis',    label: 'Diagnosis',       icon: '🩺', matchTypes: ['record_diagnosis'] },
  { key: 'surgery',      label: 'Surgery',         icon: '🔪', matchTypes: ['record_surgery'] },
  { key: 'prescription', label: 'Prescriptions',   icon: '💊', matchTypes: ['prescription', 'record_prescription'] },
  { key: 'lab_result',   label: 'Lab Results',     icon: '🧪', matchTypes: ['lab_result', 'record_lab_report'] },
  { key: 'weight',       label: 'Weight',          icon: '⚖️', matchTypes: ['weight'] },
  { key: 'booking',      label: 'Bookings',        icon: '📅', matchTypes: ['booking'] },
  { key: 'consultation', label: 'Consultations',   icon: '🏥', matchTypes: ['consultation'] },
  { key: 'allergy',      label: 'Allergies',       icon: '⚠️', matchTypes: ['allergy'] },
  { key: 'other',        label: 'Other',           icon: '📄', matchTypes: ['record_imaging', 'record_follow_up', 'record_other'] },
]

export const getEventConfig = (type: string) =>
  EVENT_TYPES[type] || { label: type, icon: '📋', color: '#78909c', bg: '#eceff1' }

export const severityColor = (sev?: string) => {
  switch (sev) {
    case 'critical': return '#d32f2f'
    case 'high':     return '#f44336'
    case 'medium':   return '#ff9800'
    case 'low':      return '#4caf50'
    default:         return ''
  }
}

export const ZOOM_LEVELS = [30, 60, 90, 180, 365, 730]

export function assignLanes(events: TimelineEvent[]): Map<string, number> {
  const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const laneEndDate: number[] = []
  const laneMap = new Map<string, number>()
  sorted.forEach(ev => {
    const d = new Date(ev.date).getTime()
    let lane = laneEndDate.findIndex(end => d > end + 1000 * 60 * 60 * 24 * 3)
    if (lane === -1) { lane = laneEndDate.length; laneEndDate.push(0) }
    laneEndDate[lane] = d + 1000 * 60 * 60 * 24 * 14
    laneMap.set(ev.id, lane)
  })
  return laneMap
}
