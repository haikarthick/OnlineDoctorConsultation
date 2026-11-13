export interface Protocol {
  id: string
  name: string
  disease: string
  species: string[]
  applicableGender: 'all' | 'male' | 'female'
  minAgeWeeks: number | null
  maxAgeWeeks: number | null
  vaccineCategory: 'core' | 'non_core' | 'mandatory_govt' | 'legally_mandated'
  isZoonotic: boolean
  initialDoseAgeWeeks: number | null
  boosterIntervalDays: number
  seriesDoseCount: number
  seriesIntervalDays: number
  route: string
  dosageMl: string | null
  site: string | null
  regulatoryBody: string | null
  regulatoryStandard: string | null
  seasonalWindow: string | null
  country: string
  isActive: boolean
  notes: string | null
}

export interface ProtocolChange {
  id: string
  changedField: string
  oldValue: string | null
  newValue: string | null
  changeReason: string | null
  regulatoryStandard: string | null
  effectiveDate: string
  changedByName: string | null
  createdAt: string
}

export interface Stats {
  total: number
  active: number
  byCategory: Record<string, number>
  bySpecies: Record<string, number>
}

export const SPECIES_OPTIONS = ['cattle', 'buffalo', 'sheep', 'goat', 'pig', 'horse', 'dog', 'cat', 'rabbit', 'poultry']
export const CATEGORY_COLORS: Record<string, string> = {
  core: 'badge-success',
  non_core: 'badge-pending',
  mandatory_govt: 'badge-error',
  legally_mandated: 'badge-error',
}
export const ROUTE_OPTIONS = ['intramuscular', 'subcutaneous', 'intranasal', 'oral', 'intravenous', 'topical']

export const getStatusBadge = (isActive: boolean, t: any) =>
  isActive ? (
    <span className="module-badge badge-success">{t('vaccineProtocol.status.active')}</span>
  ) : (
    <span className="module-badge badge-error">{t('vaccineProtocol.status.archived')}</span>
  )

export const getCategoryDisplay = (cat: string, t: any) => {
  const labels: Record<string, string> = {
    core: t('vaccineProtocol.category.core'),
    non_core: t('vaccineProtocol.category.nonCore'),
    mandatory_govt: t('vaccineProtocol.category.mandatoryGovt'),
    legally_mandated: t('vaccineProtocol.category.legallyMandated'),
  }
  return (
    <span className={`module-badge ${CATEGORY_COLORS[cat] || 'badge-pending'}`}>
      {labels[cat] || cat}
    </span>
  )
}

export const EMPTY_FORM: Partial<Protocol> = {
  name: '',
  disease: '',
  species: [],
  applicableGender: 'all',
  minAgeWeeks: null,
  maxAgeWeeks: null,
  vaccineCategory: 'core',
  isZoonotic: false,
  initialDoseAgeWeeks: null,
  boosterIntervalDays: 365,
  seriesDoseCount: 1,
  seriesIntervalDays: 21,
  route: 'intramuscular',
  dosageMl: '',
  site: '',
  regulatoryBody: '',
  regulatoryStandard: '',
  seasonalWindow: '',
  country: 'IN',
  notes: '',
}

export const getIntervalLabel = (days: number, t: any) => {
  if (days === 365) return '1 year'
  if (days === 182) return '6 months'
  if (days === 1095) return '3 years'
  if (days === 730) return '2 years'
  if (days === 0) return t('vaccineProtocol.oneTime')
  return `${days} ${t('vaccineProtocol.days')}`
}
