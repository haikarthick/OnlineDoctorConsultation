import database from '../../utils/database';
import logger from '../../utils/logger';
import NutritionNotifier from './NutritionNotifier';
import { activityScoreFrom, nutritionScoreFrom, weightStatusFrom, type WeightStatus } from './engine/wellness';
import { detectConditions, type FoundCondition } from './engine/conditions';
import { ValidationError, NotFoundError, ForbiddenError, CodedError } from '../../utils/errors';
import AnimalService from '../AnimalService';
import AnimalAccessService, { ANIMAL_NO_ACCESS_MESSAGE } from '../AnimalAccessService';
import BodyMeasurementService, { type MeasurementRow } from '../BodyMeasurementService';
import NutritionAccess, { type Caller, type AnimalAccess, REVIEW_ONLY_VET_MESSAGE } from './NutritionAccess';
import { isEntitled, type NutritionFeature } from './NutritionConfig';
import {
  CALCULATOR_MODELS, ENGINE_VERSION, RULE_VERSION, PLAN_GOALS, ACTIVITY_LEVELS, HOUSING_TYPES,
  isNutritionModel, type NutritionModel, type PlanGoal, type MuscleCondition,
} from './engine/models';
import { missingFacts, canCalculate, type AnimalFacts } from './engine/facts';
import { companionEnergy, EnergyInputError, type EnergyFactorRow, type CompanionEnergyResult } from './engine/companionEnergy';
import { portions, type PortionFood, type PortionResult } from './engine/portions';
import { evaluateRisks, matchesUnsafe, type RiskFlag } from './engine/rules';

/**
 * The nutrition module's business logic (docs/NUTRITION_PLAN.md). Rules it keeps:
 *   - every fact it needs is READ LIVE from the module that owns it and, when missing, WRITTEN BACK THROUGH that
 *     module (AnimalService for the profile, BodyMeasurementService for weight / condition) - never copied here;
 *   - numbers come only from engine/ (deterministic, versioned); no AI computes a nutrient or a portion;
 *   - every plan stores the engine version, the inputs it used and the result, so it can always be explained;
 *   - plans stay "suggested" until a vet reviews them.
 */

export interface FoodChoice {
  ingredientId?: string | null;
  label?: string | null;
  kcalPer100g?: number | null;
  sharePct: number;
}

export interface PlanInput {
  goal?: PlanGoal | null;
  targetWeightKg?: number | null;
  mealsPerDay?: number;
  foods: FoodChoice[];
  markReviewed?: boolean;
  reviewNote?: string | null;
}

const FACT_KEYS = ['dateOfBirth', 'gender', 'isNeutered', 'activityLevel', 'housing'] as const;
type FactKey = typeof FACT_KEYS[number];

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

class NutritionService {

  // ─── Facts ──────────────────────────────────────────────────────────────

  /** Everything the engine needs about one animal, read live from the owning tables. */
  async loadFacts(animalId: string): Promise<{ facts: AnimalFacts; measurements: MeasurementRow[] }> {
    const r = await database.query(
      `SELECT a.species, a.date_of_birth::text AS dob, a.gender, a.is_neutered, a.activity_level, a.housing,
              a.breeding_status, a.expected_due_date::text AS due, a.last_birth_date::text AS last_birth,
              a.avg_daily_milk_litres, a.weight, a.weight_unit, a.last_weighed_at, a.updated_at,
              COALESCE(mc.nutrition_model, ms.nutrition_model) AS model
         FROM animals a
         LEFT JOIN master_species ms ON ms.code = a.species
         LEFT JOIN master_animal_classes mc ON mc.value = a.animal_class AND mc.species_id = ms.id
        WHERE a.id = $1`,
      [animalId]
    );
    const a = r.rows[0];
    if (!a) throw new CodedError(404, 'NUT_NOT_FOUND', 'We could not find that. It may have been removed, or you may not have access to it. Refresh the screen and try again.');
    const measurements = await BodyMeasurementService.list(animalId, { limit: 60 });
    const latestWeight = measurements.find(m => m.weightKg !== null);
    const latestBcs = measurements.find(m => m.bcs9 !== null);
    const latestMuscle = measurements.find(m => m.muscleCondition !== null);
    // An animal weighed before the history existed still has its weight on the profile.
    const profileWeight = num(a.weight);
    const model: NutritionModel = isNutritionModel(a.model) ? a.model : 'guidance_only';
    const facts: AnimalFacts = {
      speciesCode: a.species,
      model,
      dateOfBirth: a.dob ? String(a.dob).slice(0, 10) : null,
      gender: a.gender || null,
      isNeutered: a.is_neutered === null || a.is_neutered === undefined ? null : !!a.is_neutered,
      activityLevel: a.activity_level || null,
      housing: a.housing || null,
      breedingStatus: a.breeding_status || null,
      expectedDueDate: a.due || null,
      lastBirthDate: a.last_birth || null,
      avgDailyMilkLitres: num(a.avg_daily_milk_litres),
      weightKg: latestWeight?.weightKg ?? (profileWeight && profileWeight > 0
        ? (String(a.weight_unit || 'kg').toLowerCase().startsWith('lb') ? Math.round(profileWeight * 0.45359237 * 100) / 100 : profileWeight)
        : null),
      weightRecordedAt: latestWeight?.recordedAt ?? (profileWeight ? (a.last_weighed_at || a.updated_at)?.toISOString?.() ?? null : null),
      bcs9: latestBcs?.bcs9 ?? null,
      bcsRecordedAt: latestBcs?.recordedAt ?? null,
      muscleCondition: (latestMuscle?.muscleCondition as MuscleCondition) ?? null,
    };
    return { facts, measurements };
  }

  /** Saves missing profile facts THROUGH the animal module (its validation and farm-profile rules apply). */
  async saveFacts(animalId: string, patch: Partial<Record<FactKey, unknown>>, caller: Caller): Promise<any> {
    await NutritionAccess.forAnimal(animalId, caller, 'write');
    const updates: Record<string, unknown> = {};
    for (const key of FACT_KEYS) {
      if (patch[key] === undefined) continue;
      const v = patch[key];
      if (key === 'dateOfBirth' && v) {
        const s = String(v);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new CodedError(400, 'NUT_THAT_DATE_OF_BIRTH_IS', 'That date of birth is not a valid date.');
        if (s > todayIso()) throw new CodedError(400, 'NUT_DATE_OF_BIRTH_CANNOT_BE', 'Date of birth cannot be in the future.');
      }
      if (key === 'activityLevel' && v && !(ACTIVITY_LEVELS as readonly string[]).includes(String(v))) {
        throw new CodedError(400, 'NUT_ACTIVITY_MUST_BE_LOW_MODERATE', 'Activity must be low, moderate, high or working.');
      }
      if (key === 'housing' && v && !(HOUSING_TYPES as readonly string[]).includes(String(v))) {
        throw new CodedError(400, 'NUT_CHOOSE_WHERE_THE_ANIMAL_IS', 'Choose where the animal is kept from the list.');
      }
      updates[key] = v;
    }
    if (Object.keys(updates).length === 0) throw new CodedError(400, 'NUT_NOTHING_TO_SAVE_CHOOSE_AT', 'Nothing to save - choose at least one answer.');
    await AnimalService.updateAnimal(animalId, updates as any);
    this.track(caller, 'facts_saved').catch(() => {});
    await this.evaluateFlags(animalId).catch(err => logger.error('Nutrition flag evaluation failed', { animalId, error: err.message }));
    return this.overview(animalId, caller);
  }

  async addMeasurement(animalId: string, input: {
    weight?: number | null; unit?: string | null; bodyConditionScore?: number | null; bcsScale?: 5 | 9 | null;
    muscleCondition?: MuscleCondition | null; notes?: string | null; recordedAt?: string | null;
  }, caller: Caller): Promise<MeasurementRow> {
    await this.assertEntitled(caller, 'measurements');
    await NutritionAccess.forAnimal(animalId, caller, 'write');
    if (input.recordedAt) {
      const t = Date.parse(input.recordedAt);
      if (Number.isNaN(t)) throw new CodedError(400, 'NUT_THAT_DATE_IS_NOT_VALID', 'That date is not valid.');
      if (t > Date.now() + 86400000) throw new CodedError(400, 'NUT_THAT_DATE_IS_IN_THE', 'That date is in the future. Choose today or an earlier day.');
    }
    const saved = await BodyMeasurementService.record({ ...input, animalId, source: 'nutrition', recordedBy: caller.userId });
    this.track(caller, 'measurement_added').catch(() => {});
    await this.evaluateFlags(animalId).catch(err => logger.error('Nutrition flag evaluation failed', { animalId, error: err.message }));
    return saved;
  }

  // ─── Overview (what every role's Nutrition panel shows) ─────────────────

  async overview(animalId: string, caller: Caller): Promise<any> {
    const access = await NutritionAccess.forAnimal(animalId, caller, 'read');
    const { facts, measurements } = await this.loadFacts(animalId);
    const [plan, pendingPlan, feeding, flags, unsafe, herd] = await Promise.all([
      this.activePlan(animalId),
      this.pendingPlan(animalId),
      this.feedingSummary(animalId),
      this.openFlags(animalId),
      this.unsafeFoods(facts.speciesCode),
      facts.model === 'ruminant_dm' || facts.model === 'equine_dm' ? this.herdPlanFor(animalId) : Promise.resolve(null),
    ]);
    return {
      animal: { id: access.animal.id, name: access.animal.name, species: access.animal.species, enterpriseId: access.animal.enterpriseId },
      model: facts.model,
      calculatorAvailable: CALCULATOR_MODELS.has(facts.model),
      facts,
      missingFacts: missingFacts(facts),
      canCalculate: canCalculate(facts),
      measurements: measurements.slice(0, 20),
      plan,
      herdPlan: herd?.plan ?? null,
      herdName: herd?.groupName ?? null,
      pendingPlan,
      feeding,
      flags,
      unsafeFoods: unsafe,
      permissions: { canWrite: access.canWrite, canReview: access.canReview, via: access.via },
      engineVersion: ENGINE_VERSION,
    };
  }

  // ─── Plans ──────────────────────────────────────────────────────────────

  async energyFactors(speciesCode: string): Promise<EnergyFactorRow[]> {
    const r = await database.query(
      `SELECT factor_key, factor, status, source FROM nutrition_energy_factors WHERE species_code = $1 AND status <> 'retired'`,
      [speciesCode]
    );
    return r.rows.map((x: any) => ({ factorKey: x.factor_key, factor: Number(x.factor), status: x.status, source: x.source }));
  }

  /** Loads chosen foods the caller may use for this animal: shared library rows, or the household's / farm's own. */
  private async resolveFoods(access: AnimalAccess, foods: FoodChoice[]): Promise<Array<PortionFood & { ingredientId: string | null; kind: string | null }>> {
    if (!Array.isArray(foods) || foods.length === 0) throw new CodedError(400, 'NUT_CHOOSE_AT_LEAST_ONE_FOOD', 'Choose at least one food.');
    if (foods.length > 12) throw new CodedError(400, 'NUT_A_PLAN_CAN_HAVE_UP', 'A plan can have up to 12 foods.');
    const ids = foods.map(f => f.ingredientId).filter(Boolean) as string[];
    const rows = new Map<string, any>();
    if (ids.length) {
      const r = await database.query(
        `SELECT id, label, kind, energy_kcal_per_100g FROM nutrition_ingredients
          WHERE id = ANY($1::uuid[]) AND is_active = true AND status <> 'retired'
            AND ((owner_id IS NULL AND enterprise_id IS NULL) OR owner_id = $2 OR ($3::uuid IS NOT NULL AND enterprise_id = $3::uuid))`,
        [ids, access.animal.ownerId, access.animal.enterpriseId]
      );
      for (const x of r.rows) rows.set(x.id, x);
    }
    return foods.map((f, i) => {
      const share = num(f.sharePct);
      if (share === null || share <= 0 || share > 100) throw new CodedError(400, 'NUT_EACH_FOOD_NEEDS_A_SHARE', 'Each food needs a share between 1 and 100%.');
      if (f.ingredientId) {
        const row = rows.get(f.ingredientId);
        if (!row) throw new CodedError(400, 'NUT_ONE_OF_THE_CHOSEN_FOODS', 'One of the chosen foods is no longer available. Choose it again.');
        const ownKcal = num(f.kcalPer100g);
        return { key: `f${i}`, ingredientId: row.id, label: row.label, kind: row.kind || null, kcalPer100g: ownKcal ?? num(row.energy_kcal_per_100g), sharePct: share };
      }
      const label = String(f.label || '').trim();
      if (!label) throw new CodedError(400, 'NUT_GIVE_EACH_FOOD_A_NAME', 'Give each food a name.');
      const kcal = num(f.kcalPer100g);
      if (kcal !== null && (kcal <= 0 || kcal > 1000)) throw new CodedError(400, 'NUT_ENERGY_PER_100_G_MUST', 'Energy per 100 g must be between 1 and 1000 kcal. Check the food label.');
      return { key: `f${i}`, ingredientId: null, kind: null, label: label.slice(0, 200), kcalPer100g: kcal, sharePct: share };
    });
  }

  async preview(animalId: string, input: PlanInput, caller: Caller): Promise<any> {
    const access = await NutritionAccess.forAnimal(animalId, caller, 'read');
    return this.compute(access, input);
  }

  private async compute(access: AnimalAccess, input: PlanInput): Promise<{
    facts: AnimalFacts; energy: CompanionEnergyResult; portions: PortionResult; foods: Array<PortionFood & { ingredientId: string | null; kind: string | null }>;
    /** Every food is home-cooked, a treat or unnamed: no complete-and-balanced food in the plan. */
    incompleteDiet: boolean;
    unsafe: Array<{ food: string; item: string; severity: string; kind?: 'allergy' }>; mealsPerDay: number;
    allergies: Array<{ allergen: string; severity: string }>; conditions: FoundCondition[];
  }> {
    const { facts } = await this.loadFacts(access.animal.id);
    if (facts.model === 'ruminant_dm' || facts.model === 'equine_dm') {
      throw new CodedError(400, 'NUT_FOR_CATTLE_BUFFALO_GOATS_SHEEP', 'For cattle, buffalo, goats, sheep, horses and donkeys, use "Work out a ration" - it balances the feeds you have.');
    }
    if (facts.model !== 'companion_energy' || !CALCULATOR_MODELS.has(facts.model)) {
      throw new CodedError(400, 'NUT_A_FOOD_CALCULATOR_FOR_THIS', 'A food calculator for this kind of animal is not available yet. The safe-food guide, weight and body condition tracking work now.');
    }
    if (input.goal && !(PLAN_GOALS as readonly string[]).includes(input.goal)) throw new CodedError(400, 'NUT_CHOOSE_A_GOAL_FROM_THE', 'Choose a goal from the list.');
    const missing = missingFacts(facts).filter(m => m.required);
    if (missing.length) {
      throw new CodedError(400, 'NUT_FACTS_NEEDED', `A few details are needed first: ${missing.map(m => FACT_WORDS[m.key]).join(', ')}.`, { facts: missing.map(m => FACT_CODES[m.key] || m.key).join('|') });
    }
    const mealsPerDay = Math.min(Math.max(Math.round(num(input.mealsPerDay) ?? 2), 1), 12);
    let energy: CompanionEnergyResult;
    try {
      energy = companionEnergy({ facts, factors: await this.energyFactors(facts.speciesCode), goal: input.goal ?? null, targetWeightKg: num(input.targetWeightKg) });
    } catch (e: any) {
      if (e instanceof EnergyInputError) throw new CodedError(400, ENERGY_CODES[String(e.code)] || 'NUT_ENERGY_NO_FACTOR', e.message);
      throw e;
    }
    const foods = await this.resolveFoods(access, input.foods);
    const portionResult = portions(energy.dailyKcal, foods, mealsPerDay);
    const unsafeList = await this.unsafeFoods(facts.speciesCode);
    const unsafe: Array<{ food: string; item: string; severity: string; kind?: 'allergy' }> =
      foods.flatMap(f => unsafeList.filter(u => matchesUnsafe(f.label, u.matchTerms)).map(u => ({ food: f.label, item: u.label, severity: u.severity })));
    // Condition override (Phase 3): the animal's recorded allergies (medical records own them) are checked against
    // every food, and any active allergy means a vet should look at the plan before it is followed.
    const allergies = await this.activeAllergies(access.animal.id);
    for (const f of foods) {
      for (const a of allergies) {
        if (matchesUnsafe(f.label, [a.allergen])) unsafe.push({ food: f.label, item: a.allergen, severity: 'danger', kind: 'allergy' });
      }
    }
    const conditions = await this.activeConditions(access.animal.id, facts.breedingStatus);
    // Home-cooked food alone is not complete (calcium, vitamins, and for some species taurine are easy to miss). It is allowed for
    // a short time with a clear warning - but never as the whole diet of a young animal, which is growing and cannot miss them.
    const incompleteDiet = foods.length > 0 && !foods.some(f => f.kind === 'commercial_food');
    if (incompleteDiet && facts.dateOfBirth) {
      const months = (Date.now() - new Date(facts.dateOfBirth).getTime()) / (30.4 * 86400000);
      if (months >= 0 && months < 12) {
        throw new CodedError(400, 'NUT_HOME_DIET_YOUNG', 'A growing animal under a year old cannot be fed home-cooked food alone: it needs a complete food made for its age. Add a complete food to the plan, or ask a vet for a diet.');
      }
    }
    return { facts, energy, portions: portionResult, foods, unsafe, mealsPerDay, allergies, conditions, incompleteDiet };
  }

  /**
   * Conditions on the animal's medical record (diagnoses, abnormal lab results) that need a vet before a new plan is
   * followed. Read live - the medical record owns them; nothing is entered a second time.
   */
  async activeConditions(animalId: string, breedingStatus: string | null): Promise<FoundCondition[]> {
    const [dx, labs] = await Promise.all([
      database.query(
        `SELECT title, content, tags, severity FROM medical_records
          WHERE animal_id = $1 AND record_type = 'diagnosis' AND status = 'active' ORDER BY created_at DESC LIMIT 100`, [animalId]),
      database.query(
        `SELECT test_name, is_abnormal FROM lab_results
          WHERE animal_id = $1 AND is_abnormal = true AND test_date >= CURRENT_DATE - 180 ORDER BY test_date DESC LIMIT 100`, [animalId]),
    ]);
    return detectConditions({
      diagnoses: dx.rows.map((r: any) => ({ title: r.title, content: r.content, tags: r.tags, severity: r.severity })),
      labs: labs.rows.map((r: any) => ({ testName: r.test_name, isAbnormal: r.is_abnormal })),
      breedingStatus,
    });
  }

  async savePlan(animalId: string, input: PlanInput, caller: Caller): Promise<any> {
    await this.assertEntitled(caller, 'plans');
    const access = await NutritionAccess.forAnimal(animalId, caller, 'write');
    const c = await this.compute(access, input);
    const allergyHits = c.unsafe.filter(u => u.kind === 'allergy');
    if (allergyHits.length) {
      throw new CodedError(400, 'NUT_PLAN_ALLERGY', `This plan includes a food this animal is recorded as allergic to (${allergyHits.map(u => `${u.food}: ${u.item}`).join(', ')}). Remove it and save again, or ask the vet.`, { foods: allergyHits.map(u => `${u.food}: ${u.item}`).join(', ') });
    }
    if (c.unsafe.some(u => u.severity === 'danger')) {
      throw new CodedError(400, 'NUT_PLAN_UNSAFE', `This plan includes a food that is unsafe for this animal (${c.unsafe.filter(u => u.severity === 'danger').map(u => u.food).join(', ')}). Remove it and save again.`, { foods: c.unsafe.filter(u => u.severity === 'danger').map(u => u.food).join(', ') });
    }
    const reviewed = !!input.markReviewed && access.canReview;
    // A recorded condition (kidney, diabetes, ...) means a vet looks BEFORE this plan replaces the one in use: the new
    // plan waits as a draft, the current plan stays in force, and the vet's review is what makes it current.
    const waitsForVet = c.conditions.length > 0 && !reviewed;
    const plan = await database.transaction(async (client: any) => {
      await client.query(
        `UPDATE nutrition_plans SET status = 'superseded', updated_at = NOW() WHERE animal_id = $1 AND status = $2`, [animalId, waitsForVet ? 'draft' : 'active']
      );
      if (!waitsForVet) {
        await client.query(`UPDATE nutrition_plans SET status = 'superseded', updated_at = NOW() WHERE animal_id = $1 AND status = 'draft'`, [animalId]);
      }
      const p = await client.query(
        `INSERT INTO nutrition_plans (animal_id, enterprise_id, nutrition_model, status, validation, goal, target_weight_kg,
                                      daily_energy_kcal, meals_per_day, energy_factor_key, engine_version, inputs, result,
                                      review_note, created_by, reviewed_by, reviewed_at)
         VALUES ($1,$2,$3,$17,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15,$16)
         RETURNING id`,
        [animalId, access.animal.enterpriseId, c.facts.model, reviewed ? 'vet_reviewed' : 'suggested', c.energy.goal,
         c.energy.idealWeightKg, c.energy.dailyKcal, c.mealsPerDay, c.energy.factorKey, ENGINE_VERSION,
         JSON.stringify({ facts: c.facts, goal: input.goal ?? null, targetWeightKg: num(input.targetWeightKg) }),
         JSON.stringify({ energy: c.energy, portions: c.portions, conditions: { allergies: c.allergies, found: c.conditions, requiresVet: c.allergies.length > 0 || c.conditions.length > 0 }, incompleteDiet: c.incompleteDiet }),
         reviewed ? (input.reviewNote || null) : null, caller.userId, reviewed ? caller.userId : null, reviewed ? new Date() : null,
         waitsForVet ? 'draft' : 'active']
      );
      const planId = p.rows[0].id;
      for (let i = 0; i < c.foods.length; i++) {
        const f = c.foods[i];
        const line = c.portions.lines.find(l => l.key === f.key);
        await client.query(
          `INSERT INTO nutrition_plan_items (plan_id, ingredient_id, label, share_pct, amount_per_day, unit, energy_kcal_per_100g, kcal_per_day, sort_order)
           VALUES ($1,$2,$3,$4,$5,'g',$6,$7,$8)`,
          [planId, f.ingredientId, f.label, line?.sharePct ?? f.sharePct, line?.gramsPerDay ?? null, f.kcalPer100g, line?.kcalPerDay ?? null, i]
        );
      }
      return planId;
    });
    this.track(caller, 'plan_saved', c.facts.model).catch(() => {});
    if (!reviewed && (waitsForVet || c.energy.requiresVet)) await NutritionNotifier.planWaitingForVet({ animalId }, plan);
    await this.evaluateFlags(animalId).catch(err => logger.error('Nutrition flag evaluation failed', { animalId, error: err.message }));
    return this.planById(plan);
  }

  async reviewPlan(planId: string, input: { overrideKcal?: number | null; note?: string | null }, caller: Caller): Promise<any> {
    const p = await this.planRow(planId);
    await this.assertMayReview(p, caller);
    if (p.status !== 'active' && p.status !== 'draft') throw new CodedError(400, 'NUT_THIS_PLAN_HAS_BEEN_REPLACED', 'This plan has been replaced by a newer one. Review the current plan instead.');
    const override = num(input.overrideKcal);
    if (override !== null && p.nutrition_model !== 'companion_energy') {
      throw new CodedError(400, 'NUT_FOR_A_FARM_RATION_CHANGE', 'For a farm ration, change the feeds or limits and save a new ration instead of setting the energy by hand.');
    }
    if (override !== null && (override <= 0 || override > 50000)) throw new CodedError(400, 'NUT_THE_DAILY_ENERGY_MUST_BE', 'The daily energy must be a number above zero.');
    // A number far from the calculated one is allowed - but never silently: the vet says why, and it is kept with their name.
    if (override !== null && Number(p.daily_energy_kcal) > 0 && Math.abs(override / Number(p.daily_energy_kcal) - 1) > 0.25 && !String(input.note || '').trim()) {
      throw new CodedError(400, 'NUT_THIS_IS_MORE_THAN_25', 'This is more than 25% away from the calculated amount. Add a short reason so the owner and the next vet can see why.');
    }
    const kcal = override ?? Number(p.daily_energy_kcal);
    await database.transaction(async (client: any) => {
      await this.activateDraft(client, p);
      await client.query(
        `UPDATE nutrition_plans SET validation = 'vet_reviewed', vet_override_kcal = $2, review_note = $3,
                reviewed_by = $4, reviewed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [planId, override, input.note ? String(input.note).trim().slice(0, 2000) : null, caller.userId]
      );
      if (override !== null) {
        // Re-portion every food to the vet's number.
        const items = await client.query(`SELECT * FROM nutrition_plan_items WHERE plan_id = $1 ORDER BY sort_order`, [planId]);
        const result = portions(kcal, items.rows.map((x: any) => ({
          key: x.id, label: x.label, kcalPer100g: num(x.energy_kcal_per_100g), sharePct: Number(x.share_pct) || 0,
        })), Number(p.meals_per_day) || 2);
        for (const line of result.lines) {
          await client.query(`UPDATE nutrition_plan_items SET amount_per_day = $2, kcal_per_day = $3 WHERE id = $1`, [line.key, line.gramsPerDay, line.kcalPerDay]);
        }
      }
    });
    this.track(caller, 'plan_reviewed', p.nutrition_model).catch(() => {});
    return this.planById(planId);
  }

  /** A vet's review makes a waiting draft the plan in use; the plan it replaces is kept as history. */
  private async activateDraft(client: any, p: any): Promise<void> {
    if (p.status !== 'draft') return;
    const col = p.animal_id ? 'animal_id' : 'group_id';
    await client.query(`UPDATE nutrition_plans SET status = 'superseded', updated_at = NOW() WHERE ${col} = $1 AND status = 'active'`, [p.animal_id || p.group_id]);
    await client.query(`UPDATE nutrition_plans SET status = 'active', updated_at = NOW() WHERE id = $1`, [p.id]);
  }

  private async planRow(planId: string): Promise<any> {
    const r = await database.query(`SELECT * FROM nutrition_plans WHERE id = $1`, [planId]);
    if (!r.rows[0]) throw new CodedError(404, 'NUT_NOT_FOUND', 'We could not find that. It may have been removed, or you may not have access to it. Refresh the screen and try again.');
    return r.rows[0];
  }

  /** Only a vet (or admin) who may see this animal / herd reviews or prescribes its plan. */
  private async assertMayReview(p: any, caller: Caller): Promise<void> {
    if (p.animal_id) { await NutritionAccess.forAnimal(p.animal_id, caller, 'review'); return; }
    const access = await AnimalAccessService.checkGroup(caller, p.group_id, 'read');
    if (!access.found) throw new CodedError(404, 'NUT_NOT_FOUND', 'We could not find that. It may have been removed, or you may not have access to it. Refresh the screen and try again.');
    if (!access.allowed) throw new CodedError(403, 'ANIMAL_NO_ACCESS', ANIMAL_NO_ACCESS_MESSAGE);
    const isVetOrAdmin = ['veterinarian', 'admin'].some(r => caller.role === r || (caller.roles || []).includes(r));
    if (!isVetOrAdmin) throw new CodedError(403, 'NUT_REVIEW_ONLY_VET', REVIEW_ONLY_VET_MESSAGE);
  }

  /**
   * A vet turns the plan into a prescribed diet (Phase 3). It becomes an ordinary prescription through
   * PrescriptionService - the same rules decide who it may be written for, and the owner, the vet, print and (for
   * network prescriptions) the pharmacy see it where they see every prescription. The plan counts as reviewed.
   */
  async prescribePlan(planId: string, input: { consultationId?: string | null; durationDays?: number | null; note?: string | null }, caller: Caller): Promise<any> {
    const p = await this.planRow(planId);
    await this.assertMayReview(p, caller);
    const isVet = caller.role === 'veterinarian' || (caller.roles || []).includes('veterinarian');
    const isAdmin = caller.role === 'admin' || (caller.roles || []).includes('admin');
    if (!isVet && !isAdmin) throw new CodedError(403, 'NUT_ONLY_A_VET_CAN_PRESCRIBE', 'Only a vet can prescribe a diet.');
    if (p.status !== 'active' && p.status !== 'draft') throw new CodedError(400, 'NUT_THIS_PLAN_HAS_BEEN_REPLACED_2', 'This plan has been replaced by a newer one. Prescribe the current plan instead.');
    if (p.prescription_id) {
      const existing = await database.query(`SELECT is_active FROM prescriptions WHERE id = $1`, [p.prescription_id]);
      if (existing.rows[0]?.is_active) throw new CodedError(400, 'NUT_THIS_PLAN_IS_ALREADY_PRESCRIBED', 'This plan is already prescribed. Make a new plan to prescribe a different diet.');
    }
    const plan = await this.planById(planId);
    if (!plan.items.length) throw new CodedError(400, 'NUT_THIS_PLAN_HAS_NO_FOODS', 'This plan has no foods to prescribe.');
    const days = Math.min(Math.max(Math.round(num(input.durationDays) ?? 30), 1), 365);

    // Subject and owner come from the plan, never from the request.
    const ownerRow = p.animal_id
      ? await database.query(`SELECT owner_id FROM animals WHERE id = $1`, [p.animal_id])
      : await database.query(`SELECT e.owner_id FROM animal_groups g JOIN enterprises e ON e.id = g.enterprise_id WHERE g.id = $1`, [p.group_id]);
    const ownerId: string | null = ownerRow.rows[0]?.owner_id || null;
    if (!ownerId) throw new CodedError(400, 'NUT_THIS_ANIMAL_HAS_NO_OWNER', 'This animal has no owner on record, so a prescription cannot be written for it.');
    // Link to the vet's own consultation for this animal / herd when there is one (the given one, else the latest).
    const subjectSql = p.animal_id ? 'animal_id = $3' : 'group_id = $3';
    const subjectId = p.animal_id || p.group_id;
    const consult = input.consultationId
      ? await database.query(`SELECT id FROM consultations WHERE id = $1 AND veterinarian_id = $2 AND ${subjectSql}`, [input.consultationId, caller.userId, subjectId])
      : await database.query(`SELECT id FROM consultations WHERE veterinarian_id = $1 AND ${subjectSql.replace('$3', '$2')} ORDER BY created_at DESC LIMIT 1`, [caller.userId, subjectId]);
    if (input.consultationId && !consult.rows[0]) {
      throw new CodedError(400, 'NUT_THAT_APPOINTMENT_IS_NOT_YOURS', 'That appointment is not yours or is for another animal. Prescribe the diet from this animal\'s own consultation.');
    }
    const consultationId: string | null = consult.rows[0]?.id || null;

    const farm = p.nutrition_model !== 'companion_energy';
    // Amounts only, in units every language reads (g, kg, "x/day"): the owner opens this in their own language, and the
    // food name is the feed's own name. kind 'diet' lets pharmacies and printouts tell a diet line from a medicine.
    const amount = (kg: number | null | undefined) => (kg === null || kg === undefined ? '-' : kg < 1 ? `${Math.round(kg * 1000)} g` : `${kg} kg`);
    const medications = plan.items.map((it: any) => ({
      kind: 'diet',
      name: String(it.label).slice(0, 255),
      dosage: farm ? `${amount(it.amountPerDay)}/day${plan.ration?.herd ? ' /animal' : ''}` : `${it.gramsPerDay ?? '-'} g/day`,
      frequency: `${plan.mealsPerDay} x/day${!farm && it.gramsPerMeal ? ` (${it.gramsPerMeal} g)` : ''}`,
      duration: `${days} d`,
    }));
    const summary = farm
      ? `${amount(plan.dailyDmKg)} DM/day${plan.ration?.herd ? ' /animal' : ''} - ${plan.mealsPerDay} x/day`
      : `${Math.round(plan.effectiveKcal || 0)} kcal/day - ${plan.mealsPerDay} x/day`;
    const note = input.note ? String(input.note).trim().slice(0, 2000) : '';
    const PrescriptionService = (await import('../PrescriptionService')).default;
    const rx = await PrescriptionService.createPrescription(caller.userId, {
      consultationId: consultationId || undefined,
      petOwnerId: ownerId,
      animalId: p.animal_id || undefined,
      groupId: p.group_id || undefined,
      medications,
      instructions: note ? `${summary}\n${note}` : summary,
      validUntil: new Date(Date.now() + days * 86400000).toISOString().slice(0, 10),
    } as any, isVet ? 'veterinarian' : 'admin');
    if (p.status === 'draft') await database.transaction(async (client: any) => this.activateDraft(client, p));
    await database.query(
      `UPDATE nutrition_plans SET prescription_id = $2,
              validation = 'vet_reviewed', reviewed_by = COALESCE(reviewed_by, $3), reviewed_at = COALESCE(reviewed_at, NOW()),
              review_note = COALESCE(review_note, NULLIF($4, '')), updated_at = NOW()
        WHERE id = $1`,
      [planId, rx.id, caller.userId, note]
    );
    this.track(caller, 'diet_prescribed', p.nutrition_model).catch(() => {});
    return { prescriptionId: rx.id, plan: await this.planById(planId) };
  }

  /** Active allergies the medical record holds for this animal (read live - medical records own them). */
  async activeAllergies(animalId: string): Promise<Array<{ allergen: string; severity: string }>> {
    const r = await database.query(
      `SELECT allergen, severity FROM allergy_records WHERE animal_id = $1 AND is_active = true AND entered_by_mistake_at IS NULL ORDER BY created_at DESC LIMIT 50`,
      [animalId]
    );
    return r.rows.map((x: any) => ({ allergen: String(x.allergen), severity: x.severity || 'mild' }));
  }

  /**
   * What the AI copilot may quote about this animal's feeding (NUT-023): the plan the engine made, open alerts, recorded
   * conditions. Plain facts only - the copilot never works out an amount itself. The caller (the copilot) has already
   * limited this to the asking person's own animals.
   */
  async copilotContext(animalId: string): Promise<string | null> {
    const [plan, herd, flags, { facts }] = await Promise.all([this.activePlan(animalId), this.herdPlanFor(animalId), this.openFlags(animalId), this.loadFacts(animalId)]);
    const shown = plan || herd?.plan || null;
    if (!shown && flags.length === 0) return null;
    const lines: string[] = [];
    if (shown) {
      const farm = !!shown.ration;
      const amount = (kg: number | null) => (kg === null ? '-' : kg < 1 ? `${Math.round(kg * 1000)} g` : `${kg} kg`);
      lines.push(`Plan (${shown.validation === 'vet_reviewed' ? 'reviewed by a vet' : 'suggested, not yet reviewed by a vet'}${herd && !plan ? `, the herd "${herd.groupName}" ration, per animal` : ''}): ${
        farm ? `${shown.dailyDmKg ?? '-'} kg dry matter per day` : `${Math.round(shown.effectiveKcal || 0)} kcal per day, ${shown.mealsPerDay} meals`}`);
      for (const it of shown.items) lines.push(`- ${it.label}: ${farm ? amount(it.amountPerDay) : `${it.gramsPerDay ?? '-'} g`} per day`);
    }
    for (const f of flags.slice(0, 6)) lines.push(`Alert (${f.severity}): ${f.type.replace(/_/g, ' ')}`);
    if (facts.weightKg) lines.push(`Latest weight: ${facts.weightKg} kg${facts.bcs9 !== null ? `, body condition ${facts.bcs9}/9` : ''}`);
    return lines.join('\n');
  }

  /** The scorecard values that come from nutrition facts (internal: the caller has already been checked). */
  async wellnessMetrics(animalId: string): Promise<{ nutritionScore: number | null; activityScore: number | null; weightStatus: WeightStatus }> {
    const { facts, measurements } = await this.loadFacts(animalId);
    const [flags, plan] = await Promise.all([this.openFlags(animalId), this.activePlan(animalId)]);
    return {
      nutritionScore: nutritionScoreFrom({
        actFlags: flags.filter(f => f.severity === 'act').length, watchFlags: flags.filter(f => f.severity === 'watch').length,
        hasPlan: !!plan, needsPlan: CALCULATOR_MODELS.has(facts.model), hasWeight: facts.weightKg !== null, hasBcs: measurements.some(m => m.bcs9 !== null),
      }),
      activityScore: activityScoreFrom(facts.activityLevel),
      weightStatus: weightStatusFrom(facts.bcs9),
    };
  }

  /** A plan saved for an animal with a recorded condition, waiting for a vet (the plan in use is unchanged meanwhile). */
  async pendingPlan(animalId: string): Promise<any | null> {
    const r = await database.query(`SELECT id FROM nutrition_plans WHERE animal_id = $1 AND status = 'draft' ORDER BY created_at DESC LIMIT 1`, [animalId]);
    return r.rows[0] ? this.planById(r.rows[0].id) : null;
  }

  /**
   * The ration of the herd this animal belongs to, shown read-only on the animal's own panel (NUT-171) so a farmer
   * opening one cow sees what she is fed. It is the herd's plan, never a copy: change it on the herd.
   */
  async herdPlanFor(animalId: string): Promise<{ groupName: string; plan: any } | null> {
    const r = await database.query(
      `SELECT p.id, g.name AS group_name
         FROM animal_group_memberships m
         JOIN animal_groups g ON g.id = m.group_id
         JOIN nutrition_plans p ON p.group_id = g.id AND p.status = 'active' AND p.nutrition_model IN ('ruminant_dm', 'equine_dm')
        WHERE m.animal_id = $1 AND m.left_at IS NULL
        ORDER BY p.created_at DESC LIMIT 1`, [animalId]);
    return r.rows[0] ? { groupName: String(r.rows[0].group_name), plan: await this.planById(r.rows[0].id) } : null;
  }

  async activePlan(animalId: string): Promise<any | null> {
    const r = await database.query(`SELECT id FROM nutrition_plans WHERE animal_id = $1 AND status = 'active' LIMIT 1`, [animalId]);
    return r.rows[0] ? this.planById(r.rows[0].id) : null;
  }

  async planById(planId: string): Promise<any> {
    const r = await database.query(
      `SELECT p.*, COALESCE(cu.first_name || ' ' || cu.last_name, '') AS created_by_name,
              COALESCE(ru.first_name || ' ' || ru.last_name, '') AS reviewed_by_name
         FROM nutrition_plans p
         LEFT JOIN users cu ON cu.id = p.created_by
         LEFT JOIN users ru ON ru.id = p.reviewed_by
        WHERE p.id = $1`,
      [planId]
    );
    const p = r.rows[0];
    if (!p) throw new CodedError(404, 'NUT_NOT_FOUND', 'We could not find that. It may have been removed, or you may not have access to it. Refresh the screen and try again.');
    const items = await database.query(`SELECT i.*, ing.label_key AS ingredient_label_key FROM nutrition_plan_items i LEFT JOIN nutrition_ingredients ing ON ing.id = i.ingredient_id WHERE i.plan_id = $1 ORDER BY i.sort_order`, [planId]);
    const meals = Number(p.meals_per_day) || 2;
    return {
      id: p.id, animalId: p.animal_id, groupId: p.group_id, model: p.nutrition_model, status: p.status, validation: p.validation,
      goal: p.goal, targetWeightKg: num(p.target_weight_kg), dailyEnergyKcal: num(p.daily_energy_kcal),
      vetOverrideKcal: num(p.vet_override_kcal), effectiveKcal: num(p.vet_override_kcal) ?? num(p.daily_energy_kcal),
      mealsPerDay: meals, energyFactorKey: p.energy_factor_key, engineVersion: p.engine_version,
      energy: p.result?.energy || null, reviewNote: p.review_note,
      // A vet should look before the plan is followed: the energy rules said so, or the animal has a recorded allergy.
      requiresVet: !!(p.result?.energy?.requiresVet || p.result?.conditions?.requiresVet),
      allergies: (p.result?.conditions?.allergies || []).map((a: any) => a.allergen),
      conditions: (p.result?.conditions?.found || []).map((c: any) => c.key),
      prescriptionId: p.prescription_id || null,
      incompleteDiet: p.result?.incompleteDiet === true,
      // Farm rations (ruminant_dm): dry matter, need vs supplied, cost per day / per litre.
      dailyDmKg: num(p.daily_dm_kg),
      ration: p.nutrition_model === 'ruminant_dm' || p.nutrition_model === 'equine_dm' ? {
        need: p.result?.need || null, supplied: p.result?.supplied || null, state: p.result?.state || null,
        totalCostPerDay: p.result?.totalCostPerDay ?? null, costPerLitre: p.result?.costPerLitre ?? null,
        milkLitresPerDay: p.inputs?.milkLitresPerDay ?? null, work: p.result?.work ?? p.inputs?.work ?? null,
        weightKg: p.inputs?.weightKg ?? null, herd: p.result?.herd ?? null,
      } : null,
      createdBy: p.created_by, createdByName: p.created_by_name, createdAt: p.created_at,
      reviewedBy: p.reviewed_by, reviewedByName: p.reviewed_by_name, reviewedAt: p.reviewed_at,
      items: items.rows.map((x: any) => ({
        id: x.id, ingredientId: x.ingredient_id, label: x.label, labelKey: x.ingredient_label_key || null, sharePct: num(x.share_pct), unit: x.unit || 'g',
        amountPerDay: num(x.amount_per_day), costPerDay: num(x.cost_per_day),
        gramsPerDay: x.unit === 'kg' ? null : num(x.amount_per_day),
        gramsPerMeal: x.unit === 'kg' || num(x.amount_per_day) === null ? null : Math.round(Number(x.amount_per_day) / meals),
        kcalPerDay: num(x.kcal_per_day), kcalPer100g: num(x.energy_kcal_per_100g),
      })),
    };
  }

  // ─── Feeding log (pets; farm feed stays in farm daily records) ──────────

  async logFeeding(animalId: string, input: {
    planItemId?: string | null; ingredientId?: string | null; label?: string | null; kind?: 'meal' | 'treat';
    amountG?: number | null; kcal?: number | null; fedOn?: string | null;
  }, caller: Caller): Promise<any> {
    await this.assertEntitled(caller, 'feeding_log');
    const access = await NutritionAccess.forAnimal(animalId, caller, 'write');
    // This log is for pets (kcal of meals and treats). Feed for a farm animal is recorded in ONE place: Daily records.
    const model = (await this.loadFacts(animalId)).facts.model;
    if (['ruminant_dm', 'equine_dm', 'monogastric_spec', 'aqua_biomass'].includes(model)) {
      throw new CodedError(400, 'NUT_FEED_FOR_FARM_ANIMALS_IS', 'Feed for farm animals is recorded in Daily records - open Daily records, choose this animal or group, and tap Feed.');
    }
    const kind = input.kind === 'treat' ? 'treat' : 'meal';
    const fedOn = input.fedOn || todayIso();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fedOn)) throw new CodedError(400, 'NUT_THAT_DATE_IS_NOT_VALID', 'That date is not valid.');
    const latest = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const earliest = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);
    if (fedOn > latest) throw new CodedError(400, 'NUT_THAT_DATE_IS_IN_THE', 'That date is in the future. Choose today or an earlier day.');
    if (fedOn < earliest) throw new CodedError(400, 'NUT_FEEDING_CAN_BE_RECORDED_FOR', 'Feeding can be recorded for the last 30 days only.');

    let label = String(input.label || '').trim();
    let kcalPer100g: number | null = null;
    let planId: string | null = null;
    let ingredientId: string | null = input.ingredientId || null;
    if (input.planItemId) {
      const r = await database.query(
        `SELECT i.*, p.animal_id FROM nutrition_plan_items i JOIN nutrition_plans p ON p.id = i.plan_id WHERE i.id = $1`, [input.planItemId]);
      const item = r.rows[0];
      if (!item || item.animal_id !== animalId) throw new CodedError(400, 'NUT_THAT_FOOD_IS_NOT_IN', 'That food is not in this animal\'s plan.');
      label = item.label; kcalPer100g = num(item.energy_kcal_per_100g); planId = item.plan_id; ingredientId = item.ingredient_id;
    } else if (ingredientId) {
      const r = await database.query(
        `SELECT label, energy_kcal_per_100g FROM nutrition_ingredients WHERE id = $1 AND is_active = true
            AND ((owner_id IS NULL AND enterprise_id IS NULL) OR owner_id = $2 OR ($3::uuid IS NOT NULL AND enterprise_id = $3::uuid))`,
        [ingredientId, access.animal.ownerId, access.animal.enterpriseId]);
      if (!r.rows[0]) throw new CodedError(400, 'NUT_THAT_FOOD_IS_NO_LONGER', 'That food is no longer available. Choose it again.');
      label = r.rows[0].label; kcalPer100g = num(r.rows[0].energy_kcal_per_100g);
    }
    if (!label) throw new CodedError(400, 'NUT_SAY_WHAT_WAS_FED', 'Say what was fed.');
    const amountG = num(input.amountG);
    if (amountG !== null && (amountG < 0 || amountG > 100000)) throw new CodedError(400, 'NUT_AMOUNT_MUST_BE_A_NUMBER', 'Amount must be a number of grams, zero or more.');
    let kcal = num(input.kcal);
    if (kcal !== null && (kcal < 0 || kcal > 50000)) throw new CodedError(400, 'NUT_ENERGY_MUST_BE_A_NUMBER', 'Energy must be a number, zero or more.');
    if (kcal === null && amountG !== null && kcalPer100g !== null) kcal = Math.round((amountG * kcalPer100g) / 100);

    const saved = await database.query(
      `INSERT INTO nutrition_feeding_logs (animal_id, plan_id, plan_item_id, ingredient_id, label, kind, amount_g, kcal, fed_on, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, fed_on::text AS fed_on`,
      [animalId, planId, input.planItemId || null, ingredientId, label.slice(0, 200), kind, amountG, kcal, fedOn, caller.userId]
    );

    // Safety: a food that is unsafe for this species is saved (it happened) but raised at once.
    const unsafe = (await this.unsafeFoods(access.animal.species)).filter(u => matchesUnsafe(label, u.matchTerms));
    if (unsafe.length) {
      await this.upsertFlag(animalId, {
        type: 'unsafe_food_logged', severity: unsafe.some(u => u.severity === 'danger') ? 'act' : 'watch',
        params: { food: label.slice(0, 100), item: unsafe[0].label, date: fedOn },
      });
    }
    this.track(caller, 'feeding_logged').catch(() => {});
    if (kind === 'treat') await this.evaluateFlags(animalId).catch(err => logger.error('Nutrition flag evaluation failed', { animalId, error: err.message }));
    return {
      id: saved.rows[0].id, label, kind, amountG, kcal, fedOn: saved.rows[0].fed_on,
      warnings: unsafe.map(u => ({ item: u.label, labelKey: u.labelKey, severity: u.severity })),
    };
  }

  async deleteFeeding(id: string, caller: Caller): Promise<void> {
    const r = await database.query(`SELECT id, animal_id, recorded_by FROM nutrition_feeding_logs WHERE id = $1`, [id]);
    const row = r.rows[0];
    if (!row) throw new CodedError(404, 'NUT_NOT_FOUND', 'We could not find that. It may have been removed, or you may not have access to it. Refresh the screen and try again.');
    const access = await NutritionAccess.forAnimal(row.animal_id, caller, 'write');
    if (row.recorded_by !== caller.userId && access.via !== 'owner' && access.via !== 'admin') {
      throw new CodedError(403, 'NUT_ONLY_THE_PERSON_WHO_ENTERED', 'Only the person who entered this, or the animal\'s owner, can delete it.');
    }
    await database.query(`DELETE FROM nutrition_feeding_logs WHERE id = $1`, [id]);
  }

  async listFeeding(animalId: string, days: number, caller: Caller): Promise<any[]> {
    await NutritionAccess.forAnimal(animalId, caller, 'read');
    const span = Math.min(Math.max(Math.floor(days) || 7, 1), 31);
    const r = await database.query(
      `SELECT l.id, l.label, l.kind, l.amount_g, l.kcal, l.fed_on::text AS fed_on, l.fed_at, l.recorded_by,
              COALESCE(u.first_name || ' ' || u.last_name, '') AS recorded_by_name
         FROM nutrition_feeding_logs l LEFT JOIN users u ON u.id = l.recorded_by
        WHERE l.animal_id = $1 AND l.fed_on >= CURRENT_DATE - ($2::int - 1)
        ORDER BY l.fed_on DESC, l.fed_at DESC LIMIT 500`,
      [animalId, span]
    );
    return r.rows.map((x: any) => ({
      id: x.id, label: x.label, kind: x.kind, amountG: num(x.amount_g), kcal: num(x.kcal), fedOn: x.fed_on,
      fedAt: x.fed_at, recordedBy: x.recorded_by, recordedByName: x.recorded_by_name,
    }));
  }

  /** Today's and the last 7 days' totals - what the Today card shows. */
  async feedingSummary(animalId: string): Promise<{ today: { mealKcal: number; treatKcal: number; entries: number }; last7: { mealKcal: number; treatKcal: number; days: number } }> {
    const r = await database.query(
      `SELECT
         COALESCE(SUM(kcal) FILTER (WHERE fed_on = CURRENT_DATE AND kind = 'meal'), 0)  AS today_meal,
         COALESCE(SUM(kcal) FILTER (WHERE fed_on = CURRENT_DATE AND kind = 'treat'), 0) AS today_treat,
         COUNT(*) FILTER (WHERE fed_on = CURRENT_DATE)                                    AS today_entries,
         COALESCE(SUM(kcal) FILTER (WHERE kind = 'meal'), 0)                              AS week_meal,
         COALESCE(SUM(kcal) FILTER (WHERE kind = 'treat'), 0)                             AS week_treat,
         COUNT(DISTINCT fed_on)                                                           AS week_days
       FROM nutrition_feeding_logs WHERE animal_id = $1 AND fed_on >= CURRENT_DATE - 6`,
      [animalId]
    );
    const x = r.rows[0] || {};
    return {
      today: { mealKcal: Number(x.today_meal) || 0, treatKcal: Number(x.today_treat) || 0, entries: Number(x.today_entries) || 0 },
      last7: { mealKcal: Number(x.week_meal) || 0, treatKcal: Number(x.week_treat) || 0, days: Number(x.week_days) || 0 },
    };
  }

  // ─── Foods ──────────────────────────────────────────────────────────────

  async foods(params: { animalId?: string; groupId?: string; search?: string; kind?: string }, caller: Caller): Promise<any[]> {
    let ownerId: string | null = caller.userId;
    let enterpriseId: string | null = null;
    let model: string | null = null;
    if (params.groupId) {
      // A herd's feeds: the shared library for its species' model plus the farm's own feeds.
      const access = await AnimalAccessService.checkGroup(caller, params.groupId, 'read');
      if (!access.found) throw new CodedError(404, 'NUT_NOT_FOUND', 'We could not find that. It may have been removed, or you may not have access to it. Refresh the screen and try again.');
      if (!access.allowed) throw new CodedError(403, 'ANIMAL_NO_ACCESS', ANIMAL_NO_ACCESS_MESSAGE);
      const g = await database.query(
        `SELECT g.enterprise_id, e.owner_id, ms.nutrition_model FROM animal_groups g
           LEFT JOIN enterprises e ON e.id = g.enterprise_id LEFT JOIN master_species ms ON ms.code = g.species WHERE g.id = $1`,
        [params.groupId]
      );
      ownerId = g.rows[0]?.owner_id || null;
      enterpriseId = g.rows[0]?.enterprise_id || null;
      model = g.rows[0]?.nutrition_model || null;
    } else if (params.animalId) {
      const access = await NutritionAccess.forAnimal(params.animalId, caller, 'read');
      ownerId = access.animal.ownerId;
      enterpriseId = access.animal.enterpriseId;
      model = (await this.loadFacts(params.animalId)).facts.model;
    }
    const where = [`is_active = true`, `status <> 'retired'`,
      `((owner_id IS NULL AND enterprise_id IS NULL) OR owner_id = $1 OR ($2::uuid IS NOT NULL AND enterprise_id = $2::uuid))`];
    const values: unknown[] = [ownerId, enterpriseId];
    if (model) { values.push(model); where.push(`(cardinality(models) = 0 OR $${values.length} = ANY(models) OR owner_id IS NOT NULL OR enterprise_id IS NOT NULL)`); }
    if (params.kind) { values.push(params.kind); where.push(`kind = $${values.length}`); }
    if (params.search) {
      values.push(`%${String(params.search).trim().slice(0, 60)}%`);
      where.push(`(label ILIKE $${values.length} OR label_hi ILIKE $${values.length} OR label_kn ILIKE $${values.length}
                  OR label_ml ILIKE $${values.length} OR label_ta ILIKE $${values.length} OR label_te ILIKE $${values.length})`);
    }
    // A farm's own price for a feed comes from its stock (Feed Inventory) - the one place a price is entered.
    const r = await database.query(
      `SELECT nutrition_ingredients.*,
              (SELECT fi.cost_per_unit / NULLIF(COALESCE(fi.kg_per_unit, CASE lower(fi.unit) WHEN 'kg' THEN 1 WHEN 'g' THEN 0.001 WHEN 'ton' THEN 1000 WHEN 'lb' THEN 0.45359237 END), 0)
                 FROM feed_inventory fi
                WHERE fi.ingredient_id = nutrition_ingredients.id AND fi.enterprise_id = $2::uuid AND fi.is_active = true AND fi.cost_per_unit > 0
                ORDER BY fi.updated_at DESC LIMIT 1) AS stock_price_per_kg
         FROM nutrition_ingredients WHERE ${where.join(' AND ')}
        ORDER BY (owner_id IS NOT NULL OR enterprise_id IS NOT NULL) DESC, label ASC LIMIT 200`,
      values
    );
    return r.rows.map((x: any) => this.mapFood(x));
  }

  async createFood(input: { animalId?: string | null; label: string; kcalPer100g?: number | null; kind?: string }, caller: Caller): Promise<any> {
    const label = String(input.label || '').trim();
    if (!label) throw new CodedError(400, 'NUT_GIVE_THE_FOOD_A_NAME', 'Give the food a name, as it is written on the pack.');
    const kcal = num(input.kcalPer100g);
    if (kcal !== null && (kcal <= 0 || kcal > 1000)) throw new CodedError(400, 'NUT_ENERGY_PER_100_G_MUST', 'Energy per 100 g must be between 1 and 1000 kcal. Check the food label.');
    const kind = ['commercial_food', 'home_food', 'treat'].includes(String(input.kind)) ? String(input.kind) : 'commercial_food';
    let ownerId: string | null = caller.userId;
    let enterpriseId: string | null = null;
    if (input.animalId) {
      const access = await NutritionAccess.forAnimal(input.animalId, caller, 'write');
      // The food belongs to the household (or the farm), so everyone caring for the animal sees the same list.
      if (access.animal.enterpriseId) { enterpriseId = access.animal.enterpriseId; ownerId = null; } else ownerId = access.animal.ownerId;
    }
    const r = await database.query(
      `INSERT INTO nutrition_ingredients (label, kind, models, energy_kcal_per_100g, owner_id, enterprise_id, source, created_by)
       VALUES ($1, $2, '{}', $3, $4, $5, 'Entered from the food label', $6) RETURNING *`,
      [label.slice(0, 200), kind, kcal, ownerId, enterpriseId, caller.userId]
    );
    this.track(caller, 'food_added').catch(() => {});
    return this.mapFood(r.rows[0]);
  }

  mapFood(x: any) {
    return {
      id: x.id, code: x.code, label: x.label, labelKey: x.label_key,
      labelHi: x.label_hi, labelKn: x.label_kn, labelMl: x.label_ml, labelTa: x.label_ta, labelTe: x.label_te,
      kind: x.kind, models: x.models || [], kcalPer100g: num(x.energy_kcal_per_100g), dryMatterPct: num(x.dry_matter_pct),
      composition: x.composition || {}, source: x.source, licence: x.licence, status: x.status,
      isOwn: !!(x.owner_id || x.enterprise_id),
      stockPricePerKg: num(x.stock_price_per_kg) === null ? null : Math.round(Number(x.stock_price_per_kg) * 100) / 100,
    };
  }

  async unsafeFoods(speciesCode: string): Promise<Array<{ id: string; code: string; label: string; labelKey: string | null; labelHi: string | null; labelKn: string | null; labelMl: string | null; labelTa: string | null; labelTe: string | null; matchTerms: string[]; severity: string; source: string; status: string }>> {
    const r = await database.query(
      `SELECT * FROM nutrition_unsafe_foods WHERE species_code = $1 AND is_active = true AND status <> 'retired' ORDER BY severity DESC, label`,
      [speciesCode]
    );
    return r.rows.map((x: any) => ({
      id: x.id, code: x.code, label: x.label, labelKey: x.label_key,
      labelHi: x.label_hi, labelKn: x.label_kn, labelMl: x.label_ml, labelTa: x.label_ta, labelTe: x.label_te,
      matchTerms: [x.label, ...(x.match_terms || [])], severity: x.severity, source: x.source, status: x.status,
    }));
  }

  // ─── Risk flags ─────────────────────────────────────────────────────────

  async openFlags(animalId: string): Promise<any[]> {
    const r = await database.query(
      `SELECT id, flag_type, severity, params, rule_version, created_at, updated_at FROM nutrition_risk_flags
        WHERE animal_id = $1 AND status = 'open'
        ORDER BY CASE severity WHEN 'act' THEN 0 WHEN 'watch' THEN 1 ELSE 2 END, updated_at DESC`,
      [animalId]
    );
    return r.rows.map((x: any) => ({ id: x.id, type: x.flag_type, severity: x.severity, params: x.params || {}, ruleVersion: x.rule_version, createdAt: x.created_at, updatedAt: x.updated_at }));
  }

  private async upsertFlag(animalId: string, flag: RiskFlag): Promise<void> {
    const r = await database.query(
      `INSERT INTO nutrition_risk_flags (animal_id, flag_type, severity, params, rule_version)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT ((COALESCE(animal_id, group_id)), flag_type) WHERE status = 'open'
       DO UPDATE SET severity = EXCLUDED.severity, params = EXCLUDED.params, rule_version = EXCLUDED.rule_version, updated_at = NOW()
       RETURNING id, (xmax = 0) AS inserted`,
      [animalId, flag.type, flag.severity, JSON.stringify(flag.params), RULE_VERSION]
    );
    // Only a NEW alert tells people (a refresh of an open one is not news).
    if (r.rows[0]?.inserted) await NutritionNotifier.flagRaised({ animalId }, { id: r.rows[0].id, type: flag.type, severity: flag.severity });
  }

  /** Re-runs the rules for one animal: refreshes what still applies, closes what no longer does. */
  async evaluateFlags(animalId: string): Promise<RiskFlag[]> {
    // An animal that is sold, has died, was transferred, lost or retired has no food plan to follow and raises no alerts.
    const state = await database.query(`SELECT status, is_active FROM animals WHERE id = $1`, [animalId]);
    if (state.rows[0] && (state.rows[0].is_active === false || (state.rows[0].status && state.rows[0].status !== 'active' && state.rows[0].status !== 'quarantined'))) {
      await database.query(`UPDATE nutrition_plans SET status = 'archived', updated_at = NOW() WHERE animal_id = $1 AND status IN ('active', 'draft')`, [animalId]);
      await database.query(`UPDATE nutrition_risk_flags SET status = 'resolved', updated_at = NOW() WHERE animal_id = $1 AND status = 'open'`, [animalId]);
      return [];
    }
    const { facts, measurements } = await this.loadFacts(animalId);
    const [plan, feeding] = await Promise.all([
      database.query(`SELECT goal FROM nutrition_plans WHERE animal_id = $1 AND status = 'active' LIMIT 1`, [animalId]),
      this.feedingSummary(animalId),
    ]);
    const flags = evaluateRisks({
      facts,
      weights: measurements.filter(m => m.weightKg !== null).map(m => ({ kg: m.weightKg as number, at: m.recordedAt })),
      goal: (plan.rows[0]?.goal as PlanGoal) || null, hasPlan: plan.rows.length > 0,
      feeding7d: feeding.last7.days > 0 ? { mealKcal: feeding.last7.mealKcal, treatKcal: feeding.last7.treatKcal } : null,
      conditions: measurements.filter(m => m.bcs9 !== null).map(m => ({ bcs9: m.bcs9 as number, at: m.recordedAt })),
    });
    for (const f of flags) await this.upsertFlag(animalId, f);
    const keep = flags.map(f => f.type);
    const closed = await database.query(
      `UPDATE nutrition_risk_flags SET status = 'resolved', updated_at = NOW()
        WHERE animal_id = $1 AND status = 'open' AND flag_type <> 'unsafe_food_logged' AND NOT (flag_type = ANY($2::text[]))
        RETURNING id, animal_id, group_id, flag_type, severity, rule_version, params`,
      [animalId, keep]
    );
    for (const row of closed.rows) await recordOutcome(row, 'resolved', null);
    return flags;
  }

  /**
   * "Seen" (the alert was right) or "Not right" (a false alarm) - for an animal's or a herd's alert. The answer is
   * kept as a labelled outcome (Phase 4): it is what each rule's hit rate, and any later prediction model, rest on.
   */
  async setFlagStatus(flagId: string, status: 'reviewed' | 'dismissed', caller: Caller): Promise<void> {
    const r = await database.query(
      `SELECT id, animal_id, group_id, flag_type, severity, rule_version, params, status FROM nutrition_risk_flags WHERE id = $1`, [flagId]);
    const f = r.rows[0];
    if (!f) throw new CodedError(404, 'NUT_NOT_FOUND', 'We could not find that. It may have been removed, or you may not have access to it. Refresh the screen and try again.');
    if (f.animal_id) {
      await NutritionAccess.forAnimal(f.animal_id, caller, 'write');
    } else {
      const access = await AnimalAccessService.checkGroup(caller, f.group_id, 'write');
      if (!access.found) throw new CodedError(404, 'NUT_NOT_FOUND', 'We could not find that. It may have been removed, or you may not have access to it. Refresh the screen and try again.');
      if (!access.allowed) throw new CodedError(403, 'ANIMAL_NO_ACCESS', ANIMAL_NO_ACCESS_MESSAGE);
    }
    await database.query(
      `UPDATE nutrition_risk_flags SET status = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [flagId, status, caller.userId]
    );
    if (f.status === 'open') await recordOutcome(f, status === 'reviewed' ? 'confirmed' : 'false_alarm', caller);
  }

  // ─── Animal list (the Nutrition page) ───────────────────────────────────

  /**
   * The few numbers a dashboard shows (NUT-175/121). Counts come from listAnimals itself, so who is counted follows the
   * one access rule - no second scope. Feed cost today is the cost stored on today's feed records of the caller's farms.
   */
  async summary(caller: Caller): Promise<{ total: number; attention: number; toReview: number; noPlan: number; feedCostToday: number | null }> {
    const [all, attention, toReview, noPlan, cost] = await Promise.all([
      this.listAnimals(caller, { limit: 1 }),
      this.listAnimals(caller, { filter: 'attention', limit: 1 }),
      this.listAnimals(caller, { filter: 'to_review', limit: 1 }),
      this.listAnimals(caller, { filter: 'no_plan', limit: 1 }),
      database.query(
        `SELECT SUM(r.cost) AS cost, COUNT(*) AS n FROM farm_daily_records r
          WHERE r.record_type = 'feed' AND r.record_date = CURRENT_DATE
            AND r.enterprise_id IN (SELECT id FROM enterprises WHERE owner_id = $1
                                    UNION SELECT enterprise_id FROM enterprise_members WHERE user_id = $1 AND is_active = true)`, [caller.userId]),
    ]);
    return {
      total: all.total, attention: attention.total, toReview: toReview.total, noPlan: noPlan.total,
      feedCostToday: Number(cost.rows[0]?.n) > 0 ? Math.round(Number(cost.rows[0].cost || 0) * 100) / 100 : null,
    };
  }

  async listAnimals(caller: Caller, params: { search?: string; filter?: string; limit?: number; offset?: number }): Promise<{ items: any[]; total: number }> {
    const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
    const offset = Math.max(Number(params.offset) || 0, 0);
    const values: unknown[] = [caller.userId];
    const isAdmin = caller.role === 'admin' || (caller.roles || []).includes('admin');
    const isVet = caller.role === 'veterinarian' || (caller.roles || []).includes('veterinarian');
    // Admin sees every animal. The clause still names $1 so the count query (which has no ORDER BY using it)
    // binds the same parameters as the list query - a bare TRUE made Postgres refuse the unused parameter.
    const scope: string[] = isAdmin ? ['$1::uuid IS NOT NULL'] : [
      'a.owner_id = $1',
      `a.enterprise_id IN (SELECT id FROM enterprises WHERE owner_id = $1
                           UNION SELECT enterprise_id FROM enterprise_members WHERE user_id = $1 AND is_active = true)`,
    ];
    if (!isAdmin && isVet) {
      scope.push(`a.id IN (SELECT animal_id FROM bookings WHERE veterinarian_id = $1 AND animal_id IS NOT NULL
                           AND (status IN ('confirmed', 'rescheduled') OR (status = 'completed' AND updated_at >= NOW() - INTERVAL '30 days'))
                           UNION SELECT animal_id FROM consultations WHERE veterinarian_id = $1 AND animal_id IS NOT NULL
                           AND (status IN ('confirmed', 'scheduled', 'in_progress') OR (status = 'completed' AND completed_at >= NOW() - INTERVAL '30 days')))`);
    }
    const where = [`a.is_active = true`, `(${scope.join(' OR ')})`];
    if (params.search) {
      values.push(`%${String(params.search).trim().slice(0, 60)}%`);
      where.push(`(a.name ILIKE $${values.length} OR a.unique_id ILIKE $${values.length} OR a.ear_tag_id ILIKE $${values.length})`);
    }
    // A herd of thousands is narrowed by design, not scrolled: what needs attention, what has no plan yet.
    if (params.filter === 'attention') {
      where.push(`EXISTS (SELECT 1 FROM nutrition_risk_flags f WHERE f.animal_id = a.id AND f.status = 'open' AND f.severity IN ('act', 'watch'))`);
    } else if (params.filter === 'to_review') {
      // The vet's review queue: a plan or ration is in use but no vet has looked at it yet.
      where.push(`EXISTS (SELECT 1 FROM nutrition_plans p WHERE p.animal_id = a.id AND p.status IN ('active', 'draft') AND p.validation = 'suggested')`);
    } else if (params.filter === 'no_plan') {
      where.push(`NOT EXISTS (SELECT 1 FROM nutrition_plans p WHERE p.animal_id = a.id AND p.status IN ('active', 'draft'))`);
    }
    const base = `FROM animals a
                  LEFT JOIN master_species ms ON ms.code = a.species
                  LEFT JOIN master_animal_classes mc ON mc.value = a.animal_class AND mc.species_id = ms.id
                  LEFT JOIN enterprises e ON e.id = a.enterprise_id
                 WHERE ${where.join(' AND ')}`;
    const [rows, count] = await Promise.all([
      database.query(
        `SELECT a.id, a.name, a.species, a.unique_id, a.enterprise_id, e.name AS enterprise_name, a.owner_id,
                COALESCE(mc.nutrition_model, ms.nutrition_model, 'guidance_only') AS model,
                (SELECT jsonb_build_object('id', p.id, 'validation', p.validation, 'kcal', COALESCE(p.vet_override_kcal, p.daily_energy_kcal), 'goal', p.goal, 'waitingForVet', p.status = 'draft')
                   FROM nutrition_plans p WHERE p.animal_id = a.id AND p.status IN ('active', 'draft') ORDER BY (p.status = 'active') DESC, p.created_at DESC LIMIT 1) AS plan,
                (SELECT COUNT(*) FROM nutrition_risk_flags f WHERE f.animal_id = a.id AND f.status = 'open' AND f.severity = 'act') AS act_flags,
                (SELECT COUNT(*) FROM nutrition_risk_flags f WHERE f.animal_id = a.id AND f.status = 'open' AND f.severity = 'watch') AS watch_flags
           ${base}
          ORDER BY (a.owner_id = $1) DESC, a.name ASC
          LIMIT ${limit} OFFSET ${offset}`,
        values
      ),
      database.query(`SELECT COUNT(*) AS n ${base}`, values),
    ]);
    return {
      total: Number(count.rows[0]?.n) || 0,
      items: rows.rows.map((x: any) => ({
        id: x.id, name: x.name, species: x.species, uniqueId: x.unique_id, enterpriseId: x.enterprise_id,
        enterpriseName: x.enterprise_name, isMine: x.owner_id === caller.userId, model: x.model, plan: x.plan || null,
        actFlags: Number(x.act_flags) || 0, watchFlags: Number(x.watch_flags) || 0,
      })),
    };
  }

  // ─── Usage + entitlement ────────────────────────────────────────────────

  private async assertEntitled(caller: Caller, feature: NutritionFeature): Promise<void> {
    if (!(await isEntitled(caller.userId, feature))) {
      throw new CodedError(403, 'NUT_THIS_PART_OF_NUTRITION_IS', 'This part of nutrition is not included in your plan yet.');
    }
  }

  async track(caller: Caller, event: string, model?: string | null): Promise<void> {
    await database.query(
      `INSERT INTO nutrition_usage_events (user_id, user_role, event, nutrition_model) VALUES ($1, $2, $3, $4)`,
      [caller.userId, caller.role || null, event.slice(0, 40), model || null]
    ).catch((err: any) => logger.error('nutrition usage event failed', { error: err.message }));
  }
}

/** One labelled outcome per alert closure (migration 062). Never blocks the action that closed the alert. */
export async function recordOutcome(
  flag: { id: string; animal_id: string | null; group_id: string | null; flag_type: string; severity: string; rule_version: string; params: any },
  outcome: 'confirmed' | 'false_alarm' | 'resolved',
  caller: Caller | null,
): Promise<void> {
  await database.query(
    `INSERT INTO nutrition_outcomes (flag_id, animal_id, group_id, flag_type, severity, rule_version, outcome, features, labelled_by, labelled_role)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`,
    [flag.id, flag.animal_id, flag.group_id, flag.flag_type, flag.severity, flag.rule_version, outcome,
     JSON.stringify(flag.params || {}), caller?.userId || null, caller?.role || null]
  ).catch((err: any) => logger.error('nutrition outcome not recorded', { flagId: flag.id, error: err.message }));
}

const ENERGY_CODES: Record<string, string> = {
  no_weight: 'NUT_ENERGY_NO_WEIGHT', needs_target_weight: 'NUT_ENERGY_NEEDS_TARGET_WEIGHT', no_factor: 'NUT_ENERGY_NO_FACTOR',
};

/** The code the app translates for each missing fact (serverMessages.FACT_*). */
const FACT_CODES: Record<string, string> = {
  weight: 'FACT_WEIGHT', dateOfBirth: 'FACT_DATE_OF_BIRTH', gender: 'FACT_GENDER', isNeutered: 'FACT_NEUTERED',
  activityLevel: 'FACT_ACTIVITY', housing: 'FACT_HOUSING', bodyCondition: 'FACT_BODY_CONDITION',
};
const FACT_WORDS: Record<string, string> = {
  weight: 'a current weight', dateOfBirth: 'date of birth', gender: 'sex', isNeutered: 'neutered or not',
  activityLevel: 'how active it is', housing: 'where it is kept', bodyCondition: 'a body condition score',
};

export default new NutritionService();
