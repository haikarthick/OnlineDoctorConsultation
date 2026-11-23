import database from '../../utils/database';
import logger from '../../utils/logger';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import AnimalService from '../AnimalService';
import AnimalAccessService, { ANIMAL_NO_ACCESS_MESSAGE } from '../AnimalAccessService';
import NutritionAccess, { type Caller } from './NutritionAccess';
import NutritionService from './NutritionService';
import { ENGINE_VERSION, ACTIVITY_LEVELS, isNutritionModel, type NutritionModel } from './engine/models';
import { ageInMonths } from './engine/facts';
import { matchesUnsafe } from './engine/rules';
import { balanceRuminantRation, type FeedOption, type RuminantRequirements, type RuminantState } from './engine/ruminantRation';
import { balanceEquineRation, type EquineFeedOption, type EquineRequirements, type EquineWork } from './engine/equineRation';

/**
 * Farm rations (docs/NUTRITION_PLAN.md Phase 2) - least-cost mixes of the farm's own feeds, for:
 *   `ruminant_dm`  cattle, buffalo, goats, sheep, camels   (engine/ruminantRation.ts, migration 057)
 *   `equine_dm`    horses, ponies, donkeys, mules          (engine/equineRation.ts, migration 060)
 * and for ONE animal or a whole HERD (an animal group): a herd ration is one solve for the herd's average animal,
 * shown per head and for the whole herd (§5.5 "a herd re-optimisation is one group-level solve").
 *
 * Single source of truth: milk yield is the animal profile's `avg_daily_milk_litres` and work is its
 * `activity_level` - a value typed here for one animal is saved back THROUGH AnimalService; weight comes from the
 * body-measurement history; due date from breeding; a herd's head count from the group. Feed actually given is
 * recorded once, in farm Daily records.
 */

export interface RationFeedChoice {
  ingredientId: string;
  /** Price per kg as fed. Prefilled from the farm's feed stock when that feed is in stock. */
  pricePerKg?: number | null;
  minKg?: number | null;
  maxKg?: number | null;
}

export interface RationInput {
  milkLitresPerDay?: number | null;
  milkFatPct?: number | null;
  /** Horses / donkeys: how hard the animal works (defaults to its profile's activity level). */
  work?: EquineWork | null;
  /** Herd ration only: average body weight when the members have no weights recorded. */
  avgWeightKg?: number | null;
  feeds: RationFeedChoice[];
}

/** Who / what the ration is for, with the facts the engine needs - read live from their owners. */
interface Subject {
  kind: 'animal' | 'group';
  id: string;
  name: string;
  model: NutritionModel;
  speciesCode: string;
  ownerId: string | null;
  enterpriseId: string | null;
  weightKg: number | null;
  weightSource: 'history' | 'members' | 'typed' | null;
  avgDailyMilkLitres: number | null;
  activityLevel: string | null;
  expectedDueDate: string | null;
  headCount: number;
  /** Age in months (an animal's, or the herd's average). Null = no date of birth recorded. */
  ageMonths: number | null;
  /** The animal was dried off on or before today (profile). */
  driedOff: boolean;
  /** Share of the herd within two months of calving (an animal is 1 or 0). */
  pregnancyShare: number | null;
  /** Reproductive state for horses and donkeys. */
  breedingStatus: string | null;
  /** Where the milk figure came from. */
  milkSource: 'recorded' | 'profile' | null;
}

/** A feed on the species' caution list: allowed, but shown with the ration. */
interface Caution { feed: string; code: string; label: string; labelKey: string | null }

const RATION_MODELS: ReadonlySet<NutritionModel> = new Set<NutritionModel>(['ruminant_dm', 'equine_dm']);

const RUMINANT_KEYS: Record<string, keyof RuminantRequirements | [keyof RuminantRequirements, keyof RuminantRequirements]> = {
  nel_maintenance: 'nelMaintenancePerKgBw075',
  late_pregnancy: 'latePregnancyExtraFraction',
  target_adg: 'targetAdgKg', nel_per_kg_gain: 'nelPerKgGain', first_lactation: 'firstLactationFraction', mineral_allowance: 'mineralAllowanceG',
  dmi: ['dmiMinPctBw', 'dmiMaxPctBw'],
  cp: 'cpMinPctDm', ca: 'caMinPctDm', p: 'pMinPctDm', ndf: 'ndfMinPctDm', forage: 'forageMinPctDm',
  milk_fat: 'milkFatPct', milk_protein: 'milkProteinPct', milk_lactose: 'milkLactosePct',
};

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

class FarmRationService {

  // ─── Requirement sets ────────────────────────────────────────────────────

  private async requirementRows(model: NutritionModel, speciesCode: string, stage: string) {
    const r = await database.query(
      `SELECT s.id, s.title, s.status, s.species_code, q.nutrient, q.min_value, q.max_value
         FROM nutrition_requirement_sets s JOIN nutrition_requirements q ON q.set_id = s.id
        WHERE s.nutrition_model = $3 AND s.life_stage = $2 AND s.status <> 'retired'
          AND (s.species_code = $1 OR s.species_code IS NULL)
        ORDER BY (s.species_code IS NULL), s.version DESC`,
      [speciesCode, stage, model]
    );
    if (r.rows.length === 0) throw new ValidationError('No ration requirements are set up for this kind of animal yet. An admin can add them in Nutrition data.');
    const setId = r.rows[0].id;
    return { setId, title: r.rows[0].title as string, status: r.rows[0].status as string, rows: r.rows.filter((x: any) => x.id === setId) };
  }

  /** The ruminant requirement set for this species and state: its own set first, then the general one. */
  async requirements(speciesCode: string, state: RuminantState): Promise<{ setId: string; title: string; status: string; req: RuminantRequirements; weanMonths: number | null; adultMonths: number | null }> {
    const { setId, title, status, rows } = await this.requirementRows('ruminant_dm', speciesCode, state === 'lactating' ? 'lactating' : state === 'growing' ? 'growing' : 'dry');
    // Lactating defaults for milk composition are needed even for a dry set (used only when milk > 0).
    const req: Partial<RuminantRequirements> = { milkFatPct: 4, milkProteinPct: 3.2, milkLactosePct: 4.8 };
    for (const x of rows) {
      const key = RUMINANT_KEYS[x.nutrient];
      if (!key) continue;
      if (Array.isArray(key)) { req[key[0]] = num(x.min_value) ?? undefined; req[key[1]] = num(x.max_value) ?? undefined; }
      else (req as any)[key] = num(x.min_value) ?? num(x.max_value) ?? undefined;
    }
    const needed: Array<keyof RuminantRequirements> = ['nelMaintenancePerKgBw075', 'dmiMinPctBw', 'dmiMaxPctBw', 'cpMinPctDm', 'caMinPctDm', 'pMinPctDm', 'forageMinPctDm'];
    const gaps = needed.filter(k => req[k] === undefined || req[k] === null);
    if (gaps.length) throw new ValidationError(`The ration requirements "${title}" are incomplete (${gaps.join(', ')}). An admin can complete them in Nutrition data.`);
    if (state === 'growing' && (!req.targetAdgKg || !req.nelPerKgGain)) {
      throw new ValidationError(`The growing-stock requirements "${title}" are incomplete (target gain / energy per kg gain). An admin can complete them in Nutrition data.`);
    }
    const age = (n: string): number | null => num(rows.find((x: any) => x.nutrient === n)?.min_value);
    return { setId, title, status, req: { latePregnancyExtraFraction: 0, ndfMinPctDm: 0, ...req } as RuminantRequirements, weanMonths: age('wean_months'), adultMonths: age('adult_months') };
  }

  /** The age (months) from which a growing animal is fed a ration, and the age it counts as adult - data per species. */
  private async growingLimits(speciesCode: string): Promise<{ weanMonths: number | null; adultMonths: number | null }> {
    try {
      const r = await this.requirementRows('ruminant_dm', speciesCode, 'growing');
      const g = (n: string): number | null => num(r.rows.find((x: any) => x.nutrient === n)?.min_value);
      return { weanMonths: g('wean_months'), adultMonths: g('adult_months') };
    } catch { return { weanMonths: null, adultMonths: null }; }
  }

  /** The horse / donkey requirement set: the species' own set first (donkey), then the general horse set. */
  async equineRequirements(speciesCode: string): Promise<{ setId: string; title: string; status: string; req: EquineRequirements; adultMonths: number | null }> {
    const { setId, title, status, rows } = await this.requirementRows('equine_dm', speciesCode, 'maintenance');
    const v = (nutrient: string, which: 'min' | 'max' = 'min'): number | null => {
      const row = rows.find((x: any) => x.nutrient === nutrient);
      return row ? num(which === 'min' ? row.min_value : row.max_value) : null;
    };
    const req = {
      deMaintenancePerKgBw: v('de_maintenance'),
      workFactor: { low: v('work_low') ?? 1, moderate: v('work_moderate') ?? 1, high: v('work_high') ?? 1, working: v('work_working') ?? 1 },
      cpGPerMcalDe: v('cp'), caGPerKgBw: v('ca'), pGPerKgBw: v('p'),
      dmiMinPctBw: v('dmi'), dmiMaxPctBw: v('dmi', 'max'), forageMinPctBw: v('forage'),
      concentrateMaxPctDm: v('concentrate', 'max') ?? 100,
      lactatingFactor: v('work_lactating') ?? undefined, latePregnancyFraction: v('late_pregnancy') ?? undefined,
      concentrateMaxKgPerMeal: undefined,
    };
    const gaps = (['deMaintenancePerKgBw', 'cpGPerMcalDe', 'caGPerKgBw', 'pGPerKgBw', 'dmiMinPctBw', 'dmiMaxPctBw', 'forageMinPctBw'] as const)
      .filter(k => req[k] === null);
    if (gaps.length) throw new ValidationError(`The ration requirements "${title}" are incomplete (${gaps.join(', ')}). An admin can complete them in Nutrition data.`);
    return { setId, title, status, req: req as EquineRequirements, adultMonths: v('adult_months') };
  }

  // ─── Subjects (one animal, or a herd) ────────────────────────────────────

  private async animalSubject(animalId: string, caller: Caller, need: 'read' | 'write'): Promise<Subject> {
    const access = await NutritionAccess.forAnimal(animalId, caller, need);
    const { facts } = await NutritionService.loadFacts(animalId);
    // Milk: what was recorded in Daily records (last 7 days) wins; the profile's typed average is the fallback.
    const [milk, prof] = await Promise.all([
      database.query(
        `SELECT AVG(day_total) AS litres FROM (
           SELECT record_date, SUM(quantity) AS day_total FROM farm_daily_records
            WHERE animal_id = $1 AND record_type = 'milk' AND record_date >= CURRENT_DATE - 7 AND quantity IS NOT NULL
            GROUP BY record_date) d`, [animalId]),
      database.query(`SELECT dry_off_date::text AS dry_off FROM animals WHERE id = $1`, [animalId]),
    ]);
    const recorded = num(milk.rows[0]?.litres);
    const driedOff = !!prof.rows[0]?.dry_off && prof.rows[0].dry_off <= new Date().toISOString().slice(0, 10);
    const dueMonths = facts.expectedDueDate ? (new Date(facts.expectedDueDate).getTime() - Date.now()) / (30.4 * 86400000) : null;
    return {
      kind: 'animal', id: animalId, name: access.animal.name, model: facts.model, speciesCode: facts.speciesCode,
      ownerId: access.animal.ownerId, enterpriseId: access.animal.enterpriseId,
      weightKg: facts.weightKg, weightSource: facts.weightKg ? 'history' : null,
      avgDailyMilkLitres: driedOff ? 0 : (recorded !== null ? round(recorded, 1) : facts.avgDailyMilkLitres),
      milkSource: driedOff ? 'profile' : recorded !== null ? 'recorded' : facts.avgDailyMilkLitres ? 'profile' : null,
      activityLevel: facts.activityLevel, expectedDueDate: facts.expectedDueDate,
      headCount: 1, ageMonths: ageInMonths(facts.dateOfBirth), driedOff,
      pregnancyShare: dueMonths !== null && dueMonths >= -0.5 && dueMonths <= 2 ? 1 : 0, breedingStatus: facts.breedingStatus,
    };
  }

  /** A herd: the group's species decides the model; weight and milk are the members' averages (read live). */
  async groupSubject(groupId: string, caller: Caller, need: 'read' | 'write'): Promise<Subject & { canWrite: boolean; canReview: boolean }> {
    const access = await AnimalAccessService.checkGroup(caller, groupId, need);
    if (!access.found) throw new NotFoundError('Group');
    if (!access.allowed) throw new ForbiddenError(need === 'write'
      ? "You can see this herd's ration but not change it. Ask the owner or the farm manager if something needs to change."
      : ANIMAL_NO_ACCESS_MESSAGE);
    const canWrite = need === 'write' || (await AnimalAccessService.checkGroup(caller, groupId, 'write')).allowed;
    const isVet = caller.role === 'veterinarian' || (caller.roles || []).includes('veterinarian') || caller.role === 'admin' || (caller.roles || []).includes('admin');
    const r = await database.query(
      `SELECT g.id, g.name, g.species, g.enterprise_id, g.current_count, e.owner_id,
              COALESCE(ms.nutrition_model, 'guidance_only') AS model,
              m.members, m.avg_weight, m.avg_milk, m.due, m.avg_age_months, m.near_calving, m.dried,
              rm.recorded_milk
         FROM animal_groups g
         LEFT JOIN enterprises e ON e.id = g.enterprise_id
         LEFT JOIN master_species ms ON ms.code = g.species
         LEFT JOIN LATERAL (
           SELECT COUNT(*) AS members,
                  AVG(NULLIF(COALESCE(a.current_weight, CASE WHEN lower(COALESCE(a.weight_unit, 'kg')) LIKE 'lb%' THEN a.weight * 0.45359237 ELSE a.weight END), 0)) AS avg_weight,
                  AVG(a.avg_daily_milk_litres) FILTER (WHERE a.avg_daily_milk_litres > 0) AS avg_milk,
                  MIN(a.expected_due_date)::text AS due,
                  AVG(EXTRACT(EPOCH FROM (NOW() - a.date_of_birth::timestamp)) / (86400 * 30.4)) AS avg_age_months,
                  COUNT(*) FILTER (WHERE a.expected_due_date BETWEEN CURRENT_DATE - 15 AND CURRENT_DATE + 62) AS near_calving,
                  COUNT(*) FILTER (WHERE a.dry_off_date IS NOT NULL AND a.dry_off_date <= CURRENT_DATE) AS dried
             FROM animals a WHERE a.group_id = g.id AND a.is_active = true
         ) m ON true
         LEFT JOIN LATERAL (
           SELECT AVG(per_animal) AS recorded_milk FROM (
             SELECT AVG(day_total) AS per_animal FROM (
               SELECT animal_id, record_date, SUM(quantity) AS day_total FROM farm_daily_records
                WHERE record_type = 'milk' AND record_date >= CURRENT_DATE - 7 AND quantity IS NOT NULL
                  AND animal_id IN (SELECT id FROM animals WHERE group_id = g.id AND is_active = true)
                GROUP BY animal_id, record_date) d
             GROUP BY animal_id) p
         ) rm ON true
        WHERE g.id = $1`,
      [groupId]
    );
    const g = r.rows[0];
    if (!g) throw new NotFoundError('Group');
    const headCount = Math.max(num(g.current_count) || 0, Number(g.members) || 0);
    const avgWeight = num(g.avg_weight);
    const members = Number(g.members) || 0;
    const recordedMilk = num(g.recorded_milk);
    const profileMilk = num(g.avg_milk);
    return {
      kind: 'group', id: g.id, name: g.name, model: isNutritionModel(g.model) ? g.model : 'guidance_only', speciesCode: g.species,
      ownerId: g.owner_id || null, enterpriseId: g.enterprise_id || null,
      weightKg: avgWeight ? round(avgWeight, 1) : null, weightSource: avgWeight ? 'members' : null,
      avgDailyMilkLitres: recordedMilk !== null ? round(recordedMilk, 1) : profileMilk === null ? null : round(profileMilk, 1),
      milkSource: recordedMilk !== null ? 'recorded' : profileMilk !== null ? 'profile' : null,
      activityLevel: null, expectedDueDate: null, headCount,
      ageMonths: num(g.avg_age_months) === null ? null : Math.round(Number(g.avg_age_months)), driedOff: members > 0 && Number(g.dried) === members,
      // The herd's due dates are kept as a SHARE: the late-pregnancy allowance applies to that share of the animals.
      pregnancyShare: members > 0 ? round(Number(g.near_calving) / members, 2) : null, breedingStatus: null,
      canWrite, canReview: isVet,
    };
  }

  // ─── Feeds ───────────────────────────────────────────────────────────────

  /** Feeds the caller may use for this subject, with composition from the library and price from the farm's stock. */
  private async feedRows(subject: Subject, choices: RationFeedChoice[]) {
    if (!Array.isArray(choices) || choices.length === 0) throw new ValidationError('Choose the feeds you have - at least one fodder and one concentrate.');
    if (choices.length > 25) throw new ValidationError('A ration can use up to 25 feeds.');
    const r = await database.query(
      `SELECT i.id, i.label, i.kind, i.models, (i.owner_id IS NULL AND i.enterprise_id IS NULL) AS is_shared, i.dry_matter_pct, i.composition,
              (SELECT fi.cost_per_unit / NULLIF(COALESCE(fi.kg_per_unit, CASE lower(fi.unit) WHEN 'kg' THEN 1 WHEN 'g' THEN 0.001 WHEN 'ton' THEN 1000 WHEN 'lb' THEN 0.45359237 END), 0)
                 FROM feed_inventory fi
                WHERE fi.ingredient_id = i.id AND fi.enterprise_id = $3::uuid AND fi.is_active = true
                ORDER BY fi.updated_at DESC LIMIT 1) AS stock_price
         FROM nutrition_ingredients i
        WHERE i.id = ANY($1::uuid[]) AND i.is_active = true AND i.status <> 'retired'
          AND ((i.owner_id IS NULL AND i.enterprise_id IS NULL) OR i.owner_id = $2 OR ($3::uuid IS NOT NULL AND i.enterprise_id = $3::uuid))`,
      [choices.map(c => c.ingredientId), subject.ownerId, subject.enterpriseId]
    );
    const byId = new Map(r.rows.map((x: any) => [x.id, x]));
    const unsafeList = await NutritionService.unsafeFoods(subject.speciesCode);
    return choices.map(c => {
      const x: any = byId.get(c.ingredientId);
      if (!x) throw new ValidationError('One of the chosen feeds is no longer available. Choose it again.');
      // A shared library feed is only offered for the kinds of animal it is listed for (no cattle mixture for a horse).
      if (x.is_shared && Array.isArray(x.models) && x.models.length > 0 && !x.models.includes(subject.model)) {
        throw new ValidationError(`${x.label} is not a feed for this kind of animal. Choose another feed.`);
      }
      // Species safety: a feed on this species' danger list is refused in words; a caution list item is shown with the ration.
      const hit = unsafeList.filter(u => matchesUnsafe(x.label, u.matchTerms));
      const danger = hit.find(u => u.severity === 'danger');
      if (danger) throw new ValidationError(`${x.label} is not safe for this animal (${danger.label}). Take it out and choose another feed.`);
      const price = num(c.pricePerKg) ?? num(x.stock_price) ?? 0;
      if (price < 0 || price > 100000) throw new ValidationError(`Check the price of ${x.label}.`);
      const comp = x.composition || {};
      return { x, comp, dm: num(comp.dm_pct) ?? num(x.dry_matter_pct), price, choice: c, cautions: hit.filter(u => u.severity !== 'danger').map(u => ({ feed: x.label as string, code: u.code, label: u.label, labelKey: u.labelKey })) };
    });
  }

  private async ruminantFeeds(subject: Subject, choices: RationFeedChoice[]): Promise<{ feeds: FeedOption[]; cautions: Caution[] }> {
    const rows = await this.feedRows(subject, choices);
    const feeds = rows.map(({ x, comp, dm, price, choice }) => {
      if (dm === null || num(comp.nel_mcal_kg_dm) === null || num(comp.cp_pct_dm) === null) {
        throw new ValidationError(`${x.label} has no feed values (dry matter, energy, protein) yet, so it cannot be used in a ration.`);
      }
      return {
        key: x.id, label: x.label, isMineral: x.kind === 'mineral', isForage: Number(comp.is_forage) === 1, dmPct: dm,
        nelMcalPerKgDm: num(comp.nel_mcal_kg_dm) as number, cpPctDm: num(comp.cp_pct_dm) as number,
        caPctDm: num(comp.ca_pct_dm) ?? 0, pPctDm: num(comp.p_pct_dm) ?? 0, ndfPctDm: num(comp.ndf_pct_dm),
        pricePerKgAsFed: price, minKgAsFed: num(choice.minKg), maxKgAsFed: num(choice.maxKg),
      };
    });
    return { feeds, cautions: rows.flatMap(r => r.cautions) };
  }

  private async equineFeeds(subject: Subject, choices: RationFeedChoice[]): Promise<{ feeds: EquineFeedOption[]; cautions: Caution[] }> {
    const rows = await this.feedRows(subject, choices);
    const feeds = rows.map(({ x, comp, dm, price, choice }) => {
      if (dm === null || num(comp.de_mcal_kg_dm) === null || num(comp.cp_pct_dm) === null) {
        throw new ValidationError(`${x.label} has no horse feed values (dry matter, energy, protein) yet, so it cannot be used in a horse ration.`);
      }
      return {
        key: x.id, label: x.label, isForage: Number(comp.is_forage) === 1, dmPct: dm,
        deMcalPerKgDm: num(comp.de_mcal_kg_dm) as number, cpPctDm: num(comp.cp_pct_dm) as number,
        caPctDm: num(comp.ca_pct_dm) ?? 0, pPctDm: num(comp.p_pct_dm) ?? 0,
        pricePerKgAsFed: price, minKgAsFed: num(choice.minKg), maxKgAsFed: num(choice.maxKg),
      };
    });
    return { feeds, cautions: rows.flatMap(r => r.cautions) };
  }

  // ─── The calculation ─────────────────────────────────────────────────────

  private async compute(subject: Subject, input: RationInput) {
    if (!RATION_MODELS.has(subject.model)) {
      throw new ValidationError(subject.kind === 'group'
        ? 'A herd ration is for cattle, buffalo, goats, sheep, camels, horses and donkeys. For poultry, pigs and fish use the daily feed card.'
        : 'The ration calculator is for cattle, buffalo, goats, sheep, camels, horses and donkeys.');
    }
    const typedWeight = num(input.avgWeightKg);
    if (typedWeight !== null && (typedWeight <= 0 || typedWeight > 2000)) throw new ValidationError('Average weight must be between 1 and 2000 kg.');
    const weightKg = subject.kind === 'group' ? (typedWeight ?? subject.weightKg) : subject.weightKg;
    if (!weightKg) {
      throw new ValidationError(subject.kind === 'group'
        ? "Type the herd's average weight (a weighing band estimate is fine) - no weights are recorded for its animals yet."
        : 'A current weight is needed first. Add it on the Body tab (a weighing band estimate is fine).');
    }
    if (subject.kind === 'group' && subject.headCount <= 0) throw new ValidationError('This group has no animals in it yet. Add animals to the group first.');
    const weightSource = subject.kind === 'group' && typedWeight !== null ? 'typed' : subject.weightSource;

    if (subject.model === 'equine_dm') {
      const work = (input.work && (ACTIVITY_LEVELS as readonly string[]).includes(input.work) ? input.work
        : (ACTIVITY_LEVELS as readonly string[]).includes(String(subject.activityLevel)) ? subject.activityLevel : 'low') as EquineWork;
      const reqs = await this.equineRequirements(subject.speciesCode);
      // A foal or yearling is growing fast and its needs are not an adult's: a vet makes that plan.
      if (subject.ageMonths !== null && reqs.adultMonths !== null && subject.ageMonths < reqs.adultMonths) {
        throw new ValidationError(`${subject.kind === 'group' ? 'The young horses in this group are' : 'This horse is'} still growing (under ${reqs.adultMonths} months). A growing horse needs a feeding plan from a vet - book a consultation.`);
      }
      const dueMonths = subject.expectedDueDate ? (new Date(subject.expectedDueDate).getTime() - Date.now()) / (30.4 * 86400000) : null;
      const reproState = subject.breedingStatus === 'lactating' ? 'lactating' as const : (dueMonths !== null && dueMonths >= 0 && dueMonths <= 3 ? 'pregnant' as const : null);
      const { feeds, cautions } = await this.equineFeeds(subject, input.feeds);
      const result = balanceEquineRation({ bodyWeightKg: weightKg, work, reproState, requirements: reqs.req, feeds });
      return { model: 'equine_dm' as const, weightKg, weightSource, milk: 0, fat: null, state: reproState === 'lactating' ? 'lactating' : 'maintenance', work, monthsToCalving: null, reqs, result, cautions, stage: { ageMonths: subject.ageMonths, growing: false, firstLactation: false }, milkSource: null as 'recorded' | 'profile' | null };
    }

    const milk = num(input.milkLitresPerDay) ?? subject.avgDailyMilkLitres ?? 0;
    if (milk < 0 || milk > 200) throw new ValidationError('Milk per day must be between 0 and 200 litres.');
    const fat = num(input.milkFatPct);
    if (fat !== null && (fat <= 0 || fat > 15)) throw new ValidationError('Milk fat must be between 0 and 15%.');
    // Life stage (data per species, migration 064): a calf, kid or lamb is not fed as a dry adult. Below weaning age the
    // young are on milk and starter feed - no fodder ration; until adult age they are GROWING (maintenance + gain).
    const limits = await this.growingLimits(subject.speciesCode);
    const age = subject.ageMonths;
    if (age !== null && limits.weanMonths !== null && age < limits.weanMonths) {
      throw new ValidationError(`${subject.kind === 'group' ? 'The young animals in this group are' : 'This animal is'} still on milk and starter feed (under ${limits.weanMonths} months). A fodder ration is not right for them yet - ask your vet for a calf feeding plan.`);
    }
    const isYoung = age !== null && limits.adultMonths !== null && age < limits.adultMonths;
    const state: RuminantState = milk > 0 ? 'lactating' : isYoung ? 'growing' : 'dry';
    // First lactation: the animal is still growing, so it needs more than an older cow giving the same milk.
    const firstLactation = state === 'lactating' && age !== null && limits.adultMonths !== null && age < limits.adultMonths + 12;
    let monthsToCalving: number | null = null;
    if (subject.expectedDueDate) {
      const months = (new Date(subject.expectedDueDate).getTime() - Date.now()) / (30.4 * 86400000);
      if (months >= -0.5) monthsToCalving = Math.max(0, months);
    }
    const reqs = await this.requirements(subject.speciesCode, state);
    const { feeds, cautions } = await this.ruminantFeeds(subject, input.feeds);
    const result = balanceRuminantRation({
      bodyWeightKg: weightKg, milkLitresPerDay: state === 'growing' ? 0 : milk, milkFatPct: fat, monthsToCalving, state, firstLactation,
      pregnancyShare: subject.pregnancyShare, requirements: reqs.req, feeds,
    });
    return {
      model: 'ruminant_dm' as const, weightKg, weightSource, milk, fat, state, work: null, monthsToCalving, reqs, result, cautions,
      stage: { ageMonths: age, growing: state === 'growing', firstLactation }, milkSource: subject.milkSource,
    };
  }

  /** Whole-herd totals: the per-head ration times the head count. */
  private herd(subject: Subject, result: { status: string; lines?: Array<{ key: string; label: string; kgAsFedPerDay: number; costPerDay: number }>; totalCostPerDay?: number }) {
    if (subject.kind !== 'group' || result.status !== 'ok' || !result.lines) return null;
    const n = subject.headCount;
    return {
      headCount: n,
      lines: result.lines.map(l => ({ key: l.key, label: l.label, kgAsFedPerDay: round(l.kgAsFedPerDay * n, 1), costPerDay: round(l.costPerDay * n) })),
      totalCostPerDay: round((result.totalCostPerDay || 0) * n),
    };
  }

  /** Milk / meat withdrawal still running for this animal or herd (medical records own it): shown beside the ration. */
  async withdrawals(subject: Subject): Promise<Array<{ what: 'milk' | 'meat'; until: string }>> {
    const col = subject.kind === 'animal' ? 'animal_id' : 'group_id';
    const r = await database.query(
      `SELECT MAX(withdrawal_until_milk)::text AS milk, MAX(withdrawal_until_meat)::text AS meat FROM medical_records
        WHERE ${col} = $1 AND (withdrawal_until_milk >= CURRENT_DATE OR withdrawal_until_meat >= CURRENT_DATE)`,
      [subject.id]
    );
    const x = r.rows[0] || {};
    const today = new Date().toISOString().slice(0, 10);
    const out: Array<{ what: 'milk' | 'meat'; until: string }> = [];
    if (x.milk && x.milk >= today) out.push({ what: 'milk', until: x.milk });
    if (x.meat && x.meat >= today) out.push({ what: 'meat', until: x.meat });
    return out;
  }

  private view(subject: Subject, c: Awaited<ReturnType<FarmRationService['compute']>>, withdrawals: Array<{ what: 'milk' | 'meat'; until: string }> = []) {
    return {
      withdrawals,
      model: c.model, state: c.state, work: c.work, milkLitresPerDay: c.milk, monthsToCalving: c.monthsToCalving,
      weightKg: c.weightKg, weightSource: c.weightSource, stage: c.stage, milkSource: c.milkSource,
      // Feeds on the species' caution list (e.g. groundnut cake: check it is dry and not mouldy).
      cautions: c.cautions,
      requirementSet: { id: c.reqs.setId, title: c.reqs.title, status: c.reqs.status },
      result: c.result,
      herd: this.herd(subject, c.result as any),
    };
  }

  // ─── One animal ──────────────────────────────────────────────────────────

  async preview(animalId: string, input: RationInput, caller: Caller) {
    const subject = await this.animalSubject(animalId, caller, 'read');
    return this.view(subject, await this.compute(subject, input), await this.withdrawals(subject));
  }

  async save(animalId: string, input: RationInput, caller: Caller) {
    const subject = await this.animalSubject(animalId, caller, 'write');
    const c = await this.compute(subject, input);
    if (c.result.status !== 'ok') {
      throw new ValidationError('These feeds cannot meet the animal\'s needs yet. Follow the suggestions on screen, then save.', { reasons: c.result.reasons });
    }
    // Values typed here are the animal's facts: save them on the profile so every screen agrees.
    const patch: Record<string, unknown> = {};
    if (c.model === 'ruminant_dm' && num(input.milkLitresPerDay) !== null && num(input.milkLitresPerDay) !== subject.avgDailyMilkLitres) patch.avgDailyMilkLitres = num(input.milkLitresPerDay);
    if (c.model === 'equine_dm' && input.work && input.work !== subject.activityLevel) patch.activityLevel = input.work;
    if (Object.keys(patch).length) {
      await AnimalService.updateAnimal(animalId, patch as any).catch(err => {
        logger.warn('Ration saved but the typed fact was not written to the animal profile', { animalId, error: err.message });
      });
    }
    const planId = await this.persist(subject, c, input, caller);
    NutritionService.track(caller, 'ration_saved', c.model).catch(() => {});
    return NutritionService.planById(planId);
  }

  // ─── A herd (animal group) ───────────────────────────────────────────────

  async groupPreview(groupId: string, input: RationInput, caller: Caller) {
    const subject = await this.groupSubject(groupId, caller, 'read');
    return this.view(subject, await this.compute(subject, input), await this.withdrawals(subject));
  }

  async groupSave(groupId: string, input: RationInput, caller: Caller) {
    const subject = await this.groupSubject(groupId, caller, 'write');
    const c = await this.compute(subject, input);
    if (c.result.status !== 'ok') {
      throw new ValidationError('These feeds cannot meet the herd\'s needs yet. Follow the suggestions on screen, then save.', { reasons: c.result.reasons });
    }
    const planId = await this.persist(subject, c, input, caller);
    NutritionService.track(caller, 'herd_ration_saved', c.model).catch(() => {});
    return NutritionService.planById(planId);
  }

  /** What the herd card shows: the herd's current ration and what the caller may do. */
  async groupOverview(groupId: string, caller: Caller) {
    const subject = await this.groupSubject(groupId, caller, 'read');
    const p = await database.query(`SELECT id FROM nutrition_plans WHERE group_id = $1 AND status = 'active' LIMIT 1`, [groupId]);
    return {
      group: { id: subject.id, name: subject.name, species: subject.speciesCode, headCount: subject.headCount, enterpriseId: subject.enterpriseId },
      model: subject.model,
      rationAvailable: RATION_MODELS.has(subject.model),
      facts: { avgWeightKg: subject.weightKg, avgDailyMilkLitres: subject.avgDailyMilkLitres },
      plan: p.rows[0] ? await NutritionService.planById(p.rows[0].id) : null,
      permissions: { canWrite: subject.canWrite, canReview: subject.canReview },
    };
  }

  private async persist(subject: Subject, c: Awaited<ReturnType<FarmRationService['compute']>>, input: RationInput, caller: Caller): Promise<string> {
    if (c.result.status !== 'ok') throw new ValidationError('These feeds cannot meet the needs yet.');
    const ok = c.result as any;
    const herd = this.herd(subject, ok);
    const subjectCol = subject.kind === 'group' ? 'group_id' : 'animal_id';
    return database.transaction(async (client: any) => {
      await client.query(`UPDATE nutrition_plans SET status = 'superseded', updated_at = NOW() WHERE ${subjectCol} = $1 AND status = 'active'`, [subject.id]);
      const p = await client.query(
        `INSERT INTO nutrition_plans (${subjectCol}, enterprise_id, nutrition_model, status, validation, goal, daily_dm_kg, meals_per_day,
                                      requirement_set_id, engine_version, inputs, result, created_by)
         VALUES ($1,$2,$3,'active','suggested',$4,$5,$11,$6,$7,$8::jsonb,$9::jsonb,$10) RETURNING id`,
        [subject.id, subject.enterpriseId, c.model, c.state === 'lactating' ? 'production' : c.state === 'growing' ? 'growth' : 'maintain', ok.supplied.dmKg, c.reqs.setId, ENGINE_VERSION,
         JSON.stringify({
           milkLitresPerDay: c.milk, milkFatPct: c.fat, monthsToCalving: c.monthsToCalving, work: c.work,
           weightKg: c.weightKg, weightSource: c.weightSource, headCount: subject.headCount, feeds: input.feeds,
         }),
         JSON.stringify({
           need: ok.need, supplied: ok.supplied, totalCostPerDay: ok.totalCostPerDay, costPerLitre: ok.costPerLitre ?? null,
           state: c.state, work: c.work, herd, stage: c.stage, cautions: c.cautions,
         }),
         caller.userId, Math.min(Math.max(Number(ok.supplied.feedsPerDay) || 2, 1), 12)]
      );
      let i = 0;
      for (const line of ok.lines) {
        await client.query(
          `INSERT INTO nutrition_plan_items (plan_id, ingredient_id, label, amount_per_day, unit, cost_per_day, sort_order)
           VALUES ($1,$2,$3,$4,'kg',$5,$6)`,
          [p.rows[0].id, line.key, line.label, line.kgAsFedPerDay, line.costPerDay, i++]
        );
      }
      return p.rows[0].id;
    });
  }
}

export default new FarmRationService();
