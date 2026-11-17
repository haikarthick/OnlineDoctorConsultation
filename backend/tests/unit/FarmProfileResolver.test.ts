import {
  FarmMaster, FarmSpecies, FarmAnimalClass, FarmGroupType, FarmRecordType, FarmRecordRule,
  resolveFarmProfile, isRecordTypeAllowed, groupTypesForSpecies,
} from '../../src/services/farmProfile/resolveFarmProfile';

/**
 * The farm-type matrix from docs/FARM_MANAGEMENT_PLAN.md section 6.4, as executable checks.
 * The fixture mirrors what migration 043 seeds. Every farm type gets a row here on purpose:
 * the earlier design was cattle-weighted and the owner called that out.
 */

const sp = (code: string, o: Partial<FarmSpecies>): FarmSpecies => ({
  code, farmSegment: 'pet', hasEarTag: false, defaultManagementMode: 'individual',
  producesMilk: false, producesEggs: false, producesWool: false, isAquatic: false, litterExpected: false,
  gestationDays: null, incubationDays: null, birthEventTerm: 'birth', waterType: null, waterQualityRanges: null, ...o,
});
const cls = (speciesCode: string, value: string, o: Partial<FarmAnimalClass>): FarmAnimalClass => ({
  speciesCode, value, impliedGender: 'unknown', canBePregnant: false, canProduceMilk: false, canLayEggs: false, isJuvenile: false, ...o,
});
const gt = (o: Partial<FarmGroupType> & { value: string }): FarmGroupType => ({
  speciesCode: null, farmSegment: null, managementMode: null, suggestedClass: null,
  isHealthHold: false, yieldsMilk: false, yieldsEggs: false, sortOrder: 0, ...o,
});
const rule = (o: Partial<FarmRecordRule>): FarmRecordRule => ({
  farmSegment: null, managementMode: null, requiresSpeciesFlag: null, aquatic: null, requiresClassFlag: null, requiresGroupFlag: null, ...o,
});
const rt = (code: string, kind: 'daily' | 'event', subject: 'animal' | 'group' | 'either', sortOrder: number, rules: FarmRecordRule[]): FarmRecordType =>
  ({ code, kind, subject, unit: null, sortOrder, rules });

const breedingFemale = [rule({ managementMode: 'individual', aquatic: false, requiresClassFlag: 'can_be_pregnant' })];
const landBatch = [rule({ managementMode: 'batch', aquatic: false })];
const aquatic = [rule({ aquatic: true })];
const anyFarm = [rule({})];

const master: FarmMaster = {
  species: [
    sp('Cattle', { farmSegment: 'dairy', hasEarTag: true, producesMilk: true, gestationDays: 283, birthEventTerm: 'calving' }),
    sp('Buffalo', { farmSegment: 'dairy', hasEarTag: true, producesMilk: true, gestationDays: 315, birthEventTerm: 'calving' }),
    sp('Goat', { farmSegment: 'small_ruminant', hasEarTag: true, producesMilk: true, litterExpected: true, gestationDays: 150, birthEventTerm: 'kidding' }),
    sp('Sheep', { farmSegment: 'small_ruminant', hasEarTag: true, producesMilk: true, producesWool: true, litterExpected: true, gestationDays: 148, birthEventTerm: 'lambing' }),
    sp('Pig', { farmSegment: 'pig', hasEarTag: true, litterExpected: true, gestationDays: 114, birthEventTerm: 'farrowing' }),
    sp('Chicken', { farmSegment: 'poultry', defaultManagementMode: 'batch', producesEggs: true, incubationDays: 21, birthEventTerm: 'hatching' }),
    sp('Rohu', { farmSegment: 'aquaculture', defaultManagementMode: 'batch', isAquatic: true, birthEventTerm: 'spawning', waterType: 'fresh' }),
    sp('Vannamei Shrimp', { farmSegment: 'aquaculture', defaultManagementMode: 'batch', isAquatic: true, birthEventTerm: 'spawning', waterType: 'brackish', waterQualityRanges: { ph: { min: 7.5, max: 8.3 } } }),
    sp('Horse', { farmSegment: 'equine', hasEarTag: true, producesMilk: true, gestationDays: 340, birthEventTerm: 'foaling' }),
    sp('Deer', { farmSegment: 'other_livestock', hasEarTag: true }),
    sp('Dog', { litterExpected: true, gestationDays: 63 }),
  ],
  classes: [
    cls('Cattle', 'cattle_bull', { impliedGender: 'male' }),
    cls('Cattle', 'cattle_cow', { impliedGender: 'female', canBePregnant: true, canProduceMilk: true }),
    cls('Cattle', 'cattle_heifer', { impliedGender: 'female', canBePregnant: true }),
    cls('Cattle', 'cattle_calf', { isJuvenile: true }),
    cls('Buffalo', 'buffalo_cow', { impliedGender: 'female', canBePregnant: true, canProduceMilk: true }),
    cls('Goat', 'goat_doe', { impliedGender: 'female', canBePregnant: true, canProduceMilk: true }),
    cls('Goat', 'goat_buck', { impliedGender: 'male' }),
    cls('Sheep', 'sheep_ewe', { impliedGender: 'female', canBePregnant: true, canProduceMilk: true }),
    cls('Pig', 'pig_sow', { impliedGender: 'female', canBePregnant: true }),
    cls('Chicken', 'chicken_hen', { impliedGender: 'female', canLayEggs: true }),
    cls('Chicken', 'chicken_cock', { impliedGender: 'male' }),
    cls('Horse', 'horse_mare', { impliedGender: 'female', canBePregnant: true, canProduceMilk: true }),
    cls('Dog', 'dog_bitch', { impliedGender: 'female', canBePregnant: true }),
  ],
  groupTypes: [
    gt({ speciesCode: 'Cattle', value: 'lactating', managementMode: 'individual', suggestedClass: 'cattle_cow', yieldsMilk: true, sortOrder: 30 }),
    gt({ speciesCode: 'Cattle', value: 'bulls', managementMode: 'individual', suggestedClass: 'cattle_bull', sortOrder: 60 }),
    gt({ speciesCode: 'Cattle', value: 'calf_pen', managementMode: 'individual', sortOrder: 10 }),
    gt({ speciesCode: 'Goat', value: 'does', yieldsMilk: true, sortOrder: 30 }),
    gt({ speciesCode: 'Pig', value: 'fatteners', managementMode: 'batch', sortOrder: 50 }),
    gt({ speciesCode: 'Pig', value: 'sows', managementMode: 'individual', sortOrder: 30 }),
    gt({ farmSegment: 'poultry', value: 'broilers', managementMode: 'batch', sortOrder: 10 }),
    gt({ farmSegment: 'poultry', value: 'layers', managementMode: 'batch', yieldsEggs: true, sortOrder: 20 }),
    gt({ farmSegment: 'aquaculture', value: 'grow_out_pond', managementMode: 'batch', sortOrder: 30 }),
    gt({ farmSegment: 'aquaculture', value: 'nursery_pond', managementMode: 'batch', sortOrder: 10 }),
  ],
  recordTypes: [
    rt('milk', 'daily', 'either', 10, [rule({ requiresSpeciesFlag: 'produces_milk', requiresClassFlag: 'can_produce_milk', requiresGroupFlag: 'yields_milk' })]),
    rt('eggs', 'daily', 'either', 20, [rule({ requiresSpeciesFlag: 'produces_eggs', requiresClassFlag: 'can_lay_eggs', requiresGroupFlag: 'yields_eggs' })]),
    rt('feed', 'daily', 'either', 30, anyFarm),
    rt('mortality', 'daily', 'group', 40, [rule({ managementMode: 'batch' })]),
    rt('sample_weight', 'daily', 'group', 50, [rule({ managementMode: 'batch' })]),
    rt('water_quality', 'daily', 'group', 60, aquatic),
    rt('weight', 'event', 'animal', 100, [rule({ managementMode: 'individual', aquatic: false })]),
    rt('heat', 'event', 'animal', 110, breedingFemale),
    rt('insemination', 'event', 'animal', 120, breedingFemale),
    rt('pregnancy_check', 'event', 'animal', 130, breedingFemale),
    rt('dry_off', 'event', 'animal', 140, [rule({ managementMode: 'individual', aquatic: false, requiresSpeciesFlag: 'produces_milk', requiresClassFlag: 'can_produce_milk' })]),
    rt('birth', 'event', 'animal', 150, breedingFemale),
    rt('shearing', 'event', 'either', 170, [rule({ requiresSpeciesFlag: 'produces_wool' })]),
    rt('placement', 'event', 'group', 200, landBatch),
    rt('stocking', 'event', 'group', 210, aquatic),
    rt('clear_out', 'event', 'group', 240, landBatch),
    rt('harvest', 'event', 'group', 270, aquatic),
    rt('treatment', 'event', 'either', 300, anyFarm),
    rt('death', 'event', 'animal', 340, [rule({ managementMode: 'individual', aquatic: false })]),
  ],
};

const codes = (p: ReturnType<typeof resolveFarmProfile>) => p.recordTypes.map(r => r.code);

describe('resolveFarmProfile', () => {
  describe('dairy (cattle, buffalo)', () => {
    it('a cow gets milk, breeding events and ear tag; gender is implied by the class', () => {
      const p = resolveFarmProfile(master, { speciesCode: 'Cattle', animalClass: 'cattle_cow' });
      expect(p.segment).toBe('dairy');
      expect(p.managementMode).toBe('individual');
      expect(p.fields.earTag).toBe('optional');
      expect(p.fields.gender).toBe('hidden');
      expect(p.fields.avgDailyMilk).toBe('optional');
      expect(p.fields.pregnancyStatus).toBe('optional');
      expect(p.fields.parity).toBe('optional');
      expect(isRecordTypeAllowed(p, 'milk', 'animal')).toBe(true);
      expect(codes(p)).toEqual(expect.arrayContaining(['milk', 'heat', 'insemination', 'pregnancy_check', 'dry_off', 'birth', 'weight', 'death']));
      expect(p.terms.birthEvent).toBe('calving');
      expect(p.reproduction.gestationDays).toBe(283);
      expect(p.sections).toEqual(expect.arrayContaining(['breeding', 'milk']));
    });

    it('a bull is never asked about milk, pregnancy or calvings', () => {
      const p = resolveFarmProfile(master, { speciesCode: 'Cattle', animalClass: 'cattle_bull' });
      expect(p.fields.avgDailyMilk).toBe('hidden');
      expect(p.fields.lactationNumber).toBe('hidden');
      expect(p.fields.pregnancyStatus).toBe('hidden');
      expect(p.fields.parity).toBe('hidden');
      expect(isRecordTypeAllowed(p, 'milk', 'animal')).toBe(false);
      expect(codes(p)).not.toEqual(expect.arrayContaining(['heat']));
      expect(codes(p)).not.toEqual(expect.arrayContaining(['dry_off']));
      expect(p.sections).not.toContain('breeding');
    });

    it('a calf (juvenile) is never asked about calvings or milk', () => {
      const p = resolveFarmProfile(master, { speciesCode: 'Cattle', animalClass: 'cattle_calf', gender: 'female' });
      expect(p.isJuvenile).toBe(true);
      expect(p.fields.parity).toBe('hidden');
      expect(p.fields.avgDailyMilk).toBe('hidden');
      expect(isRecordTypeAllowed(p, 'birth', 'animal')).toBe(false);
    });

    it('a heifer can be pregnant but is not milked', () => {
      const p = resolveFarmProfile(master, { speciesCode: 'Cattle', animalClass: 'cattle_heifer' });
      expect(p.fields.pregnancyStatus).toBe('optional');
      expect(p.fields.avgDailyMilk).toBe('hidden');
      expect(isRecordTypeAllowed(p, 'milk', 'animal')).toBe(false);
      expect(isRecordTypeAllowed(p, 'insemination', 'animal')).toBe(true);
    });

    it('buffalo has its own gestation (the old hardcoded map had none)', () => {
      const p = resolveFarmProfile(master, { speciesCode: 'Buffalo', animalClass: 'buffalo_cow' });
      expect(p.reproduction.gestationDays).toBe(315);
      expect(isRecordTypeAllowed(p, 'milk', 'animal')).toBe(true);
    });

    it('with no class chosen, only an explicitly female animal gets milk and breeding', () => {
      const female = resolveFarmProfile(master, { speciesCode: 'Cattle', gender: 'female' });
      expect(female.fields.avgDailyMilk).toBe('optional');
      expect(isRecordTypeAllowed(female, 'milk', 'animal')).toBe(true);
      const male = resolveFarmProfile(master, { speciesCode: 'Cattle', gender: 'Male' });
      expect(male.fields.avgDailyMilk).toBe('hidden');
      expect(male.fields.pregnancyStatus).toBe('hidden');
      // gender not given: nothing is assumed (a farm animal registered without a class or gender)
      const unknown = resolveFarmProfile(master, { speciesCode: 'Cattle' });
      expect(unknown.fields.avgDailyMilk).toBe('hidden');
      expect(unknown.fields.pregnancyStatus).toBe('hidden');
    });

    it('a group milk total is offered for the lactating group, not for the bulls group', () => {
      const lactating = resolveFarmProfile(master, { speciesCode: 'Cattle', groupType: 'lactating' });
      expect(isRecordTypeAllowed(lactating, 'milk', 'group')).toBe(true);
      const bulls = resolveFarmProfile(master, { speciesCode: 'Cattle', groupType: 'bulls', animalClass: 'cattle_bull' });
      expect(isRecordTypeAllowed(bulls, 'milk', 'group')).toBe(false);
      expect(isRecordTypeAllowed(bulls, 'milk', 'animal')).toBe(false);
    });

    it('an old free-text group type still works: it falls back to what the species can do', () => {
      const p = resolveFarmProfile(master, { speciesCode: 'Cattle', groupType: 'herd' });
      expect(isRecordTypeAllowed(p, 'milk', 'group')).toBe(true);
      expect(isRecordTypeAllowed(p, 'feed', 'group')).toBe(true);
    });
  });

  describe('goat / sheep', () => {
    it('a doe is milked (owner rule: every milk-producing animal) and kids are counted', () => {
      const p = resolveFarmProfile(master, { speciesCode: 'Goat', animalClass: 'goat_doe' });
      expect(isRecordTypeAllowed(p, 'milk', 'animal')).toBe(true);
      expect(p.terms.birthEvent).toBe('kidding');
      expect(p.terms.offspringCounted).toBe(true);
      expect(codes(p)).not.toContain('shearing');
    });

    it('sheep get shearing; a ewe lambs', () => {
      const p = resolveFarmProfile(master, { speciesCode: 'Sheep', animalClass: 'sheep_ewe' });
      expect(codes(p)).toContain('shearing');
      expect(p.sections).toContain('wool');
      expect(p.terms.birthEvent).toBe('lambing');
    });
  });

  describe('pig', () => {
    it('a sow farrows and is not milked', () => {
      const p = resolveFarmProfile(master, { speciesCode: 'Pig', animalClass: 'pig_sow' });
      expect(p.terms.birthEvent).toBe('farrowing');
      expect(isRecordTypeAllowed(p, 'birth', 'animal')).toBe(true);
      expect(codes(p)).not.toContain('milk');
      expect(p.fields.avgDailyMilk).toBe('hidden');
    });

    it('fatteners are a batch: mortality and clear-out, no per-animal fields', () => {
      const p = resolveFarmProfile(master, { speciesCode: 'Pig', groupType: 'fatteners' });
      expect(p.managementMode).toBe('batch');
      expect(p.fields.earTag).toBe('hidden');
      expect(p.fields.animalClass).toBe('hidden');
      expect(p.fields.placedCount).toBe('required');
      expect(codes(p)).toEqual(expect.arrayContaining(['mortality', 'sample_weight', 'placement', 'clear_out', 'feed']));
      expect(codes(p)).not.toContain('death');
      expect(p.terms.cycle).toBe('cycle');
    });
  });

  describe('poultry', () => {
    it('broilers: batch, mortality/feed/sample weight, never eggs, age in days', () => {
      const p = resolveFarmProfile(master, { speciesCode: 'Chicken', groupType: 'broilers' });
      expect(p.managementMode).toBe('batch');
      expect(codes(p)).toEqual(expect.arrayContaining(['mortality', 'feed', 'sample_weight', 'placement', 'clear_out']));
      expect(codes(p)).not.toContain('eggs');
      expect(codes(p)).not.toContain('milk');
      expect(codes(p)).not.toContain('water_quality');
      expect(p.fields.earTag).toBe('hidden');
      expect(p.fields.gender).toBe('hidden');
      expect(p.terms.ageUnit).toBe('days');
      expect(p.terms.placement).toBe('placement');
      expect(p.terms.closeOut).toBe('clear_out');
      // no record is ever against one bird in a batch
      expect(p.recordTypes.every(r => r.subjects.length === 1 && r.subjects[0] === 'group')).toBe(true);
    });

    it('layers: eggs for the group, age in weeks', () => {
      const p = resolveFarmProfile(master, { speciesCode: 'Chicken', groupType: 'layers' });
      expect(isRecordTypeAllowed(p, 'eggs', 'group')).toBe(true);
      expect(p.terms.ageUnit).toBe('weeks');
      expect(p.sections).toContain('eggs');
    });

    it('a backyard hen kept individually lays eggs and is never asked about pregnancy', () => {
      const p = resolveFarmProfile(master, { speciesCode: 'Chicken', managementMode: 'individual', animalClass: 'chicken_hen' });
      expect(isRecordTypeAllowed(p, 'eggs', 'animal')).toBe(true);
      expect(p.fields.pregnancyStatus).toBe('hidden');
      expect(codes(p)).not.toContain('heat');
      const noClass = resolveFarmProfile(master, { speciesCode: 'Chicken', managementMode: 'individual', gender: 'female' });
      expect(noClass.fields.pregnancyStatus).toBe('hidden');
    });
  });

  describe('aquaculture', () => {
    it('a pond is a crop: stocking, water quality, harvest - no ear tag, gender, class or milk', () => {
      const p = resolveFarmProfile(master, { speciesCode: 'Rohu', groupType: 'grow_out_pond' });
      expect(p.segment).toBe('aquaculture');
      expect(p.managementMode).toBe('batch');
      expect(p.isAquatic).toBe(true);
      expect(codes(p)).toEqual(expect.arrayContaining(['feed', 'mortality', 'sample_weight', 'water_quality', 'stocking', 'harvest', 'treatment']));
      expect(codes(p)).not.toContain('placement');
      expect(codes(p)).not.toContain('clear_out');
      expect(codes(p)).not.toContain('milk');
      expect(p.fields.earTag).toBe('hidden');
      expect(p.fields.gender).toBe('hidden');
      expect(p.fields.pondArea).toBe('optional');
      expect(p.terms.cycle).toBe('crop');
      expect(p.terms.placement).toBe('stocking');
      expect(p.terms.closeOut).toBe('harvest');
      expect(p.units.weight).toBe('g');
      expect(p.units.area).toContain('acre');
      expect(p.sections).toContain('water');
      expect(p.waterQualityRanges).toBeNull();
    });

    it('guide ranges come from master data per species, only where a source exists', () => {
      const p = resolveFarmProfile(master, { speciesCode: 'Vannamei Shrimp' });
      expect(p.waterQualityRanges).toEqual({ ph: { min: 7.5, max: 8.3 } });
    });

    it('aquatic species share the segment group types, sorted', () => {
      expect(groupTypesForSpecies(master, 'Rohu').map(g => g.value)).toEqual(['nursery_pond', 'grow_out_pond']);
    });
  });

  describe('equine / other livestock', () => {
    it('a mare is milked where the class allows it, and foals', () => {
      const p = resolveFarmProfile(master, { speciesCode: 'Horse', animalClass: 'horse_mare' });
      expect(isRecordTypeAllowed(p, 'milk', 'animal')).toBe(true);
      expect(p.terms.birthEvent).toBe('foaling');
    });

    it('a species with no classes and no production flags gets health and weight only', () => {
      const p = resolveFarmProfile(master, { speciesCode: 'Deer', gender: 'male' });
      expect(p.fields.animalClass).toBe('hidden');
      expect(codes(p)).toEqual(expect.arrayContaining(['feed', 'weight', 'treatment', 'death']));
      expect(codes(p)).not.toContain('milk');
    });
  });

  describe('pets and unknown species', () => {
    it('a pet gets no farm record types and no farm fields, but keeps breeding fields by class', () => {
      const p = resolveFarmProfile(master, { speciesCode: 'Dog', animalClass: 'dog_bitch' });
      expect(p.segment).toBe('pet');
      expect(p.recordTypes).toEqual([]);
      expect(p.fields.groupType).toBe('hidden');
      expect(p.fields.microchip).toBe('optional');
      expect(p.fields.pregnancyStatus).toBe('optional');
      expect(p.fields.birthWeight).toBe('more');
    });

    it('farm stock keeps pet-care details behind "More details"', () => {
      const p = resolveFarmProfile(master, { speciesCode: 'Cattle', animalClass: 'cattle_cow' });
      expect(p.fields.microchip).toBe('more');
      expect(p.fields.insurance).toBe('more');
      expect(p.fields.birthWeight).toBe('optional');
    });

    it('an unknown or missing species resolves to the plain profile rather than throwing', () => {
      for (const speciesCode of ['Unicorn', '', null, undefined]) {
        const p = resolveFarmProfile(master, { speciesCode });
        expect(p.speciesKnown).toBe(false);
        expect(p.segment).toBe('pet');
        expect(p.recordTypes).toEqual([]);
        expect(p.fields.name).toBe('required');
      }
    });

    it('species lookup tolerates case', () => {
      expect(resolveFarmProfile(master, { speciesCode: 'cattle' }).segment).toBe('dairy');
    });
  });

  describe('management mode', () => {
    it('the caller decides; else the group type; else the species default', () => {
      expect(resolveFarmProfile(master, { speciesCode: 'Chicken' }).managementMode).toBe('batch');
      expect(resolveFarmProfile(master, { speciesCode: 'Chicken', managementMode: 'individual' }).managementMode).toBe('individual');
      expect(resolveFarmProfile(master, { speciesCode: 'Pig' }).managementMode).toBe('individual');
      expect(resolveFarmProfile(master, { speciesCode: 'Pig', groupType: 'fatteners' }).managementMode).toBe('batch');
      expect(resolveFarmProfile(master, { speciesCode: 'Pig', groupType: 'fatteners', managementMode: 'individual' }).managementMode).toBe('individual');
    });

    it('goats run as a flock (batch) can still record a group milk total for the does', () => {
      const p = resolveFarmProfile(master, { speciesCode: 'Goat', managementMode: 'batch', groupType: 'does' });
      expect(isRecordTypeAllowed(p, 'milk', 'group')).toBe(true);
      expect(isRecordTypeAllowed(p, 'milk', 'animal')).toBe(false);
    });
  });

  it('record types come back in sort order', () => {
    const p = resolveFarmProfile(master, { speciesCode: 'Cattle', animalClass: 'cattle_cow' });
    expect(codes(p).slice(0, 2)).toEqual(['milk', 'feed']);
  });
});
