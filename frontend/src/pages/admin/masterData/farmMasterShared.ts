/** Shared by MasterDataManagement.tsx and its farm-profile parts (kept here so neither imports the other). */

/** Per-locale label fields shared by every master-data form, in display order. `col` is the
 *  i18n key for the field caption; `field` is the formData/DB column camelCase key. */
export const LOCALE_LABEL_FIELDS: Array<{ locale: string; field: 'labelHi' | 'labelKn' | 'labelMl' | 'labelTa' | 'labelTe'; col: string }> = [
  { locale: 'hi', field: 'labelHi', col: 'masterData.col.labelHi' },
  { locale: 'kn', field: 'labelKn', col: 'masterData.col.labelKn' },
  { locale: 'ml', field: 'labelMl', col: 'masterData.col.labelMl' },
  { locale: 'ta', field: 'labelTa', col: 'masterData.col.labelTa' },
  { locale: 'te', field: 'labelTe', col: 'masterData.col.labelTe' },
]

/** Per-locale label overrides present on every master-data row (migrations 025/026). */
export interface LocaleLabelCols {
  labelHi: string | null; labelKn: string | null; labelMl: string | null; labelTa: string | null; labelTe: string | null
}

/** The farm segments a species can belong to - must match the CHECK constraint in migration 043. */
export const FARM_SEGMENTS = ['dairy', 'small_ruminant', 'pig', 'poultry', 'aquaculture', 'equine', 'other_livestock', 'pet'] as const

/** The farmer's word for a birth - must match the CHECK constraint in migration 043. */
export const BIRTH_EVENT_TERMS = ['birth', 'calving', 'kidding', 'lambing', 'farrowing', 'foaling', 'hatching', 'spawning'] as const

export const WATER_TYPES = ['fresh', 'brackish', 'marine'] as const

/** The species fields the farm tabs need from the admin species list. */
export interface MasterSpeciesOption { id: string; code: string; label: string; icon: string | null; farmSegment?: string }

/** The server's own message when it sent one (usability rule: never a generic fallback over it). */
export function serverMessage(e: any, fallback: string): string {
  return e?.response?.data?.error?.message || e?.response?.data?.message || fallback
}
