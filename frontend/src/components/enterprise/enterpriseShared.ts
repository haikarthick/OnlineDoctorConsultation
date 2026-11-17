import { EnterpriseType } from '../../types'

// ─── Enterprise type icons (shared by the card grid and map popups) ───
export const ENTERPRISE_TYPE_ICONS: Record<string, string> = {
  dairy_farm: '🐄', poultry_farm: '🐔', cattle_ranch: '🐂', mixed_farm: '🌾',
  zoo: '🦁', breeding_facility: '🧬', pet_shop: '🐾', sanctuary: '🏔️',
  equestrian_center: '🐴', aquaculture: '🐟', wildlife_reserve: '🌿',
  veterinary_clinic: '🏥', kennel: '🐕', cattery: '🐈', aviary: '🦜', other: '🏢'
}

export const typeIcon = (type: EnterpriseType): string => ENTERPRISE_TYPE_ICONS[type] || '🏢'
