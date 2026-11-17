export const STAGES = ['triage', 'examination', 'treatment', 'observation', 'discharge'] as const
export const PRIORITIES = ['emergency', 'urgent', 'high', 'normal', 'low'] as const

export const PRIORITY_COLORS: Record<string, string> = {
  emergency: '#dc2626', urgent: '#ea580c', high: '#d97706', normal: '#2563eb', low: '#6b7280',
}

// Triage level 1-5 maps directly to a priority - these are the SAME concept.
// Never show both independently; derive priority from level automatically.
export const TRIAGE_LEVELS: Record<number, { priority: string; label: string; description: string; color: string; bg: string; icon: string }> = {
  1: { priority: 'emergency', label: 'Critical',  description: 'Immediate life-threatening - act now',  color: '#dc2626', bg: '#fee2e2', icon: '🚨' },
  2: { priority: 'urgent',    label: 'Urgent',    description: 'Serious condition - seen within 15 min', color: '#ea580c', bg: '#ffedd5', icon: '⚠️' },
  3: { priority: 'high',      label: 'High',      description: 'Significant concern - monitor closely',  color: '#d97706', bg: '#fef3c7', icon: '🔶' },
  4: { priority: 'normal',    label: 'Moderate',  description: 'Stable - routine attention required',    color: '#2563eb', bg: '#dbeafe', icon: '🔵' },
  5: { priority: 'low',       label: 'Minor',     description: 'Non-urgent - can wait for treatment',    color: '#6b7280', bg: '#f1f5f9', icon: '🟢' },
}
export const STAGE_ICONS: Record<string, string> = {
  triage: '🏥', examination: '🔍', treatment: '💊', observation: '👁️', discharge: '✅',
}
