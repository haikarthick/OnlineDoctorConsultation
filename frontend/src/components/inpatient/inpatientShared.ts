// JSONB columns from PostgreSQL arrive as JS objects - handle both string and array
export const parseJsonbArray = (val: any): any[] => {
  if (Array.isArray(val)) return val
  try { return JSON.parse(typeof val === 'string' ? val : '[]') } catch { return [] }
}

export const STATUS_COLORS: Record<string, { bg: string; color: string; icon: string }> = {
  admitted:           { bg: '#dbeafe', color: '#1d4ed8', icon: '📋' },
  in_treatment:       { bg: '#fef3c7', color: '#b45309', icon: '💊' },
  recovering:         { bg: '#dcfce7', color: '#166534', icon: '🩹' },
  ready_to_discharge: { bg: '#ecfdf5', color: '#0ea5e9', icon: '✅' },
  discharged:         { bg: '#f1f5f9', color: '#64748b', icon: '👋' },
  icu:                { bg: '#fee2e2', color: '#991b1b', icon: '🚨' },
}

export const ADMISSION_TYPES = ['surgery_recovery', 'overnight_observation', 'boarding', 'icu', 'post_treatment', 'quarantine'] as const
