export const CATEGORY_ICONS: Record<string, string> = { animal: '🐄', feed: '🌾', equipment: '🔧', medicine: '💊', semen_embryo: '🧬', service: '🩺', other: '📦' }

// Reads the first defined/non-null value across both camelCase and snake_case key spellings,
// since public listing payloads mix both depending on the API path that produced them.
export const g = (l: any, ...keys: string[]): any => { for (const k of keys) { if (l[k] !== undefined && l[k] !== null) return l[k]; } return undefined }
