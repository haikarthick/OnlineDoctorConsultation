import type { FarmMaster, FarmSpecies, FarmAnimalClass } from '../utils/farmProfile/resolveFarmProfile'

/**
 * A small master-data set in the shape the farm profile resolver reads, for component tests.
 * Mirrors what migration 043 seeds for the species these tests need - behaviour of the resolver
 * itself is tested in backend/tests/unit/FarmProfileResolver.test.ts.
 */
const sp = (code: string, o: Partial<FarmSpecies>): FarmSpecies => ({
  code, farmSegment: 'pet', hasEarTag: false, defaultManagementMode: 'individual',
  producesMilk: false, producesEggs: false, producesWool: false, isAquatic: false, litterExpected: false,
  gestationDays: null, incubationDays: null, birthEventTerm: 'birth', waterType: null, waterQualityRanges: null, ...o,
})
const cls = (speciesCode: string, value: string, o: Partial<FarmAnimalClass>): FarmAnimalClass => ({
  speciesCode, value, impliedGender: 'unknown', canBePregnant: false, canProduceMilk: false, canLayEggs: false, isJuvenile: false, ...o,
})

export const FARM_MASTER: FarmMaster = {
  species: [
    sp('Cattle', { farmSegment: 'dairy', hasEarTag: true, producesMilk: true, gestationDays: 283, birthEventTerm: 'calving' }),
    sp('Dog', { litterExpected: true, gestationDays: 63 }),
  ],
  classes: [
    cls('Cattle', 'cattle_cow', { impliedGender: 'female', canBePregnant: true, canProduceMilk: true }),
    cls('Cattle', 'cattle_bull', { impliedGender: 'male' }),
    cls('Cattle', 'cattle_calf', { isJuvenile: true }),
    cls('Dog', 'dog_bitch', { impliedGender: 'female', canBePregnant: true }),
  ],
  groupTypes: [],
  recordTypes: [],
}
