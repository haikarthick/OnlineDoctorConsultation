import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useMasterData } from '../context/MasterDataContext'
import { resolveFarmProfile } from '../utils/farmProfile/resolveFarmProfile'
import type { FarmProfile, FarmProfileInput } from '../utils/farmProfile/resolveFarmProfile'

/**
 * "Parent drives children" for every screen (docs/FARM_MANAGEMENT_PLAN.md section 6.3).
 *
 * Given what the user has picked so far - species, and optionally class, gender, management mode
 * and group type - returns which fields, sections, daily records and events apply, plus the
 * farmer's words (calving / kidding / farrowing, cycle / crop) and units.
 *
 * Every form, detail view, card, filter, report and the vet-side summary must read visibility
 * from here. Do NOT write `species === 'Cattle'` (or any species name) in a component: that is
 * exactly what this hook replaces, and it is why an admin-added species works without a deploy.
 * View, add and edit all use the same profile, so a bull never shows an empty "Milk yield" row.
 *
 * The profile is computed locally from master data already in memory (no request per render),
 * with the same function the backend uses to validate writes - see resolveFarmProfile.ts.
 * `ready` is false until the farm master data has loaded; until then the profile is the plain
 * (pet) one, so render a loading state rather than hiding farm fields from a farmer.
 */
export function useFarmProfile(input: FarmProfileInput): { profile: FarmProfile; ready: boolean } {
  const { farmMaster, farmMasterLoaded } = useMasterData()
  const { speciesCode, animalClass, gender, managementMode, groupType } = input
  const profile = useMemo(
    () => resolveFarmProfile(farmMaster, { speciesCode, animalClass, gender, managementMode, groupType }),
    [farmMaster, speciesCode, animalClass, gender, managementMode, groupType]
  )
  return { profile, ready: farmMasterLoaded }
}

/**
 * Species picker groups in the order that suits the signed-in user: a farmer sees livestock,
 * poultry and aquaculture first; everyone else sees pets first. Use this instead of reading
 * `speciesCategories` from useMasterData() directly, so every species picker in the app orders
 * the same way for the same person.
 */
export function useSpeciesCategories(): Array<{ label: string; species: string[] }> {
  const { user } = useAuth()
  const { speciesCategoriesFor } = useMasterData()
  const role = user?.role
  return useMemo(() => speciesCategoriesFor(role), [speciesCategoriesFor, role])
}
