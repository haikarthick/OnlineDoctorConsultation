import MasterDataService from './MasterDataService';
import { ValidationError } from '../utils/errors';
import {
  FarmMaster, FarmProfile, FarmProfileInput, FarmSegment, ManagementMode, RecordSubject,
  resolveFarmProfile, isRecordTypeAllowed,
} from './farmProfile/resolveFarmProfile';

/**
 * Farm profile - the server side of "parent drives children" (docs/FARM_MANAGEMENT_PLAN.md
 * section 6.3). Loads the active master data and hands it to the pure resolver in
 * ./farmProfile/resolveFarmProfile.ts, which the frontend runs as well (same file, kept
 * identical by a test), so a screen never offers something this service then refuses.
 *
 * Deliberately uncached: it is four small indexed reads, and an admin's master-data edit must
 * take effect on the very next request on every server instance.
 */
class FarmProfileService {
  /** The active master data the resolver reads, in the resolver's own shape. */
  async loadMaster(): Promise<FarmMaster> {
    const [species, classes, groupTypes, recordTypes] = await Promise.all([
      MasterDataService.listSpecies(true),
      MasterDataService.listAnimalClasses(undefined, true),
      MasterDataService.listGroupTypes({}, true),
      MasterDataService.listRecordTypes(true),
    ]);
    return {
      species: species.map(s => ({
        code: s.code,
        farmSegment: s.farmSegment as FarmSegment,
        hasEarTag: s.hasEarTag,
        defaultManagementMode: s.defaultManagementMode as ManagementMode,
        producesMilk: s.producesMilk,
        producesEggs: s.producesEggs,
        producesWool: s.producesWool,
        isAquatic: s.isAquatic,
        litterExpected: s.litterExpected,
        gestationDays: s.gestationDays,
        incubationDays: s.incubationDays,
        birthEventTerm: s.birthEventTerm,
        waterType: s.waterType,
        waterQualityRanges: s.waterQualityRanges,
      })),
      classes: classes.map(c => ({
        speciesCode: c.speciesCode || '',
        value: c.value,
        impliedGender: c.impliedGender,
        canBePregnant: c.canBePregnant,
        canProduceMilk: c.canProduceMilk,
        canLayEggs: c.canLayEggs,
        isJuvenile: c.isJuvenile,
      })),
      groupTypes: groupTypes.map(g => ({
        speciesCode: g.speciesCode,
        farmSegment: g.farmSegment,
        value: g.value,
        managementMode: g.managementMode,
        suggestedClass: g.suggestedClass,
        isHealthHold: g.isHealthHold,
        yieldsMilk: g.yieldsMilk,
        yieldsEggs: g.yieldsEggs,
        sortOrder: g.sortOrder,
      })),
      recordTypes: recordTypes.map(r => ({
        code: r.code,
        kind: r.kind,
        subject: r.subject,
        unit: r.unit,
        sortOrder: r.sortOrder,
        rules: r.rules.map(rule => ({
          farmSegment: rule.farmSegment,
          managementMode: rule.managementMode,
          requiresSpeciesFlag: rule.requiresSpeciesFlag,
          aquatic: rule.aquatic,
          requiresClassFlag: rule.requiresClassFlag,
          requiresGroupFlag: rule.requiresGroupFlag,
        })),
      })),
    };
  }

  /** Which fields, sections, record types and words apply to this animal or group. */
  async resolve(input: FarmProfileInput): Promise<FarmProfile> {
    return resolveFarmProfile(await this.loadMaster(), input);
  }

  /**
   * Write-side guard for daily records and events: refuses a record that does not apply to the
   * subject (a bull's milk, a broiler flock's eggs) with a message the farmer can act on,
   * instead of storing it silently. Returns the profile so the caller can reuse it.
   */
  async assertRecordTypeAllowed(input: FarmProfileInput, recordTypeCode: string, subject: RecordSubject): Promise<FarmProfile> {
    const profile = await this.resolve(input);
    if (!profile.speciesKnown) {
      throw new ValidationError(`'${input.speciesCode || ''}' is not a species in master data, so '${recordTypeCode}' cannot be recorded for it. Pick the species from the list.`);
    }
    if (!isRecordTypeAllowed(profile, recordTypeCode, subject)) {
      const what = subject === 'animal' ? 'this animal' : 'this group';
      throw new ValidationError(`'${recordTypeCode}' does not apply to ${what} (${input.speciesCode}${input.animalClass ? `, ${input.animalClass}` : ''}${input.groupType ? `, ${input.groupType}` : ''}). Check the species, class or group type.`);
    }
    return profile;
  }

  /**
   * Days from mating to the expected birth for a species, from master data - replaces the
   * hardcoded map BreedingService used to carry (which had no buffalo). Null when master data
   * has no value: no due date is suggested rather than a guessed one.
   */
  async gestationDaysFor(speciesCode: string | null | undefined): Promise<number | null> {
    if (!speciesCode) return null;
    const species = (await MasterDataService.listSpecies(false)).find(
      s => !!s.code && (s.code === speciesCode || s.code.toLowerCase() === speciesCode.trim().toLowerCase())
    );
    return species ? (species.gestationDays ?? species.incubationDays ?? null) : null;
  }
}

export default new FarmProfileService();
