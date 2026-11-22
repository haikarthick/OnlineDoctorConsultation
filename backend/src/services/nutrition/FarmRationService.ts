import database from '../../utils/database';
import logger from '../../utils/logger';
import { ValidationError } from '../../utils/errors';
import AnimalService from '../AnimalService';
import NutritionAccess, { type Caller, type AnimalAccess } from './NutritionAccess';
import NutritionService from './NutritionService';
import { ENGINE_VERSION } from './engine/models';
import { balanceRuminantRation, type FeedOption, type RuminantRequirements, type RuminantState } from './engine/ruminantRation';

/**
 * Farm rations (docs/NUTRITION_PLAN.md Phase 2) for the `ruminant_dm` model: cattle, buffalo, goats, sheep,
 * camels. Same tables, same panel, same access gate as Phase 1. Requirements and feed composition are admin
 * data (migration 057); the method is engine/ruminantRation.ts.
 *
 * Single source of truth: milk yield is the animal profile's `avg_daily_milk_litres` - a yield typed here is
 * saved back THROUGH AnimalService; weight comes from the body-measurement history; due date from breeding.
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
  feeds: RationFeedChoice[];
}

const REQUIREMENT_KEYS: Record<string, keyof RuminantRequirements | [keyof RuminantRequirements, keyof RuminantRequirements]> = {
  nel_maintenance: 'nelMaintenancePerKgBw075',
  late_pregnancy: 'latePregnancyExtraFraction',
  dmi: ['dmiMinPctBw', 'dmiMaxPctBw'],
  cp: 'cpMinPctDm', ca: 'caMinPctDm', p: 'pMinPctDm', ndf: 'ndfMinPctDm', forage: 'forageMinPctDm',
  milk_fat: 'milkFatPct', milk_protein: 'milkProteinPct', milk_lactose: 'milkLactosePct',
};

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

class FarmRationService {

  /** The requirement set for this species and state: its own set first, then the general small-ruminant one. */
  async requirements(speciesCode: string, state: RuminantState): Promise<{ setId: string; title: string; status: string; req: RuminantRequirements }> {
    const stage = state === 'lactating' ? 'lactating' : 'dry';
    const r = await database.query(
      `SELECT s.id, s.title, s.status, s.species_code, q.nutrient, q.min_value, q.max_value
         FROM nutrition_requirement_sets s JOIN nutrition_requirements q ON q.set_id = s.id
        WHERE s.nutrition_model = 'ruminant_dm' AND s.life_stage = $2 AND s.status <> 'retired'
          AND (s.species_code = $1 OR s.species_code IS NULL)
        ORDER BY (s.species_code IS NULL), s.version DESC`,
      [speciesCode, stage]
    );
    if (r.rows.length === 0) throw new ValidationError('No ration requirements are set up for this kind of animal yet. An admin can add them in Nutrition data.');
    const setId = r.rows[0].id;
    const rows = r.rows.filter((x: any) => x.id === setId);
    // Lactating defaults for milk composition are needed even for a dry set (used only when milk > 0).
    const req: Partial<RuminantRequirements> = { milkFatPct: 4, milkProteinPct: 3.2, milkLactosePct: 4.8 };
    for (const x of rows) {
      const key = REQUIREMENT_KEYS[x.nutrient];
      if (!key) continue;
      if (Array.isArray(key)) { req[key[0]] = num(x.min_value) ?? undefined; req[key[1]] = num(x.max_value) ?? undefined; }
      else (req as any)[key] = num(x.min_value) ?? num(x.max_value) ?? undefined;
    }
    const needed: Array<keyof RuminantRequirements> = ['nelMaintenancePerKgBw075', 'dmiMinPctBw', 'dmiMaxPctBw', 'cpMinPctDm', 'caMinPctDm', 'pMinPctDm', 'forageMinPctDm'];
    const gaps = needed.filter(k => req[k] === undefined || req[k] === null);
    if (gaps.length) throw new ValidationError(`The ration requirements "${rows[0].title}" are incomplete (${gaps.join(', ')}). An admin can complete them in Nutrition data.`);
    return {
      setId, title: rows[0].title, status: rows[0].status,
      req: { latePregnancyExtraFraction: 0, ndfMinPctDm: 0, ...req } as RuminantRequirements,
    };
  }

  /** Feeds the caller may use for this animal, with composition from the library and price from the farm's stock. */
  private async feeds(access: AnimalAccess, choices: RationFeedChoice[]): Promise<FeedOption[]> {
    if (!Array.isArray(choices) || choices.length === 0) throw new ValidationError('Choose the feeds you have - at least one fodder and one concentrate.');
    if (choices.length > 25) throw new ValidationError('A ration can use up to 25 feeds.');
    const ids = choices.map(c => c.ingredientId);
    const r = await database.query(
      `SELECT i.id, i.label, i.dry_matter_pct, i.composition,
              (SELECT fi.cost_per_unit FROM feed_inventory fi
                WHERE fi.ingredient_id = i.id AND fi.enterprise_id = $3::uuid AND fi.is_active = true AND lower(fi.unit) = 'kg'
                ORDER BY fi.updated_at DESC LIMIT 1) AS stock_price
         FROM nutrition_ingredients i
        WHERE i.id = ANY($1::uuid[]) AND i.is_active = true AND i.status <> 'retired'
          AND ((i.owner_id IS NULL AND i.enterprise_id IS NULL) OR i.owner_id = $2 OR ($3::uuid IS NOT NULL AND i.enterprise_id = $3::uuid))`,
      [ids, access.animal.ownerId, access.animal.enterpriseId]
    );
    const byId = new Map(r.rows.map((x: any) => [x.id, x]));
    return choices.map(c => {
      const x: any = byId.get(c.ingredientId);
      if (!x) throw new ValidationError('One of the chosen feeds is no longer available. Choose it again.');
      const comp = x.composition || {};
      const dm = num(comp.dm_pct) ?? num(x.dry_matter_pct);
      if (dm === null || num(comp.nel_mcal_kg_dm) === null || num(comp.cp_pct_dm) === null) {
        throw new ValidationError(`${x.label} has no feed values (dry matter, energy, protein) yet, so it cannot be used in a ration.`);
      }
      const price = num(c.pricePerKg) ?? num(x.stock_price) ?? 0;
      if (price < 0 || price > 100000) throw new ValidationError(`Check the price of ${x.label}.`);
      return {
        key: x.id, label: x.label, isForage: Number(comp.is_forage) === 1, dmPct: dm,
        nelMcalPerKgDm: num(comp.nel_mcal_kg_dm) as number, cpPctDm: num(comp.cp_pct_dm) as number,
        caPctDm: num(comp.ca_pct_dm) ?? 0, pPctDm: num(comp.p_pct_dm) ?? 0, ndfPctDm: num(comp.ndf_pct_dm),
        pricePerKgAsFed: price, minKgAsFed: num(c.minKg), maxKgAsFed: num(c.maxKg),
      };
    });
  }

  private async compute(access: AnimalAccess, input: RationInput) {
    const { facts } = await NutritionService.loadFacts(access.animal.id);
    if (facts.model !== 'ruminant_dm') throw new ValidationError('The ration calculator is for cattle, buffalo, goats, sheep and camels.');
    if (!facts.weightKg) throw new ValidationError('A current weight is needed first. Add it on the Body tab (a weighing band estimate is fine).');
    const milk = num(input.milkLitresPerDay) ?? facts.avgDailyMilkLitres ?? 0;
    if (milk < 0 || milk > 200) throw new ValidationError('Milk per day must be between 0 and 200 litres.');
    const fat = num(input.milkFatPct);
    if (fat !== null && (fat <= 0 || fat > 15)) throw new ValidationError('Milk fat must be between 0 and 15%.');
    const state: RuminantState = milk > 0 ? 'lactating' : 'dry';
    let monthsToCalving: number | null = null;
    if (facts.expectedDueDate) {
      const months = (new Date(facts.expectedDueDate).getTime() - Date.now()) / (30.4 * 86400000);
      if (months >= -0.5) monthsToCalving = Math.max(0, months);
    }
    const reqs = await this.requirements(facts.speciesCode, state);
    const feeds = await this.feeds(access, input.feeds);
    const result = balanceRuminantRation({
      bodyWeightKg: facts.weightKg, milkLitresPerDay: milk, milkFatPct: fat, monthsToCalving, state, requirements: reqs.req, feeds,
    });
    return { facts, milk, fat, state, monthsToCalving, reqs, result };
  }

  async preview(animalId: string, input: RationInput, caller: Caller) {
    const access = await NutritionAccess.forAnimal(animalId, caller, 'read');
    const c = await this.compute(access, input);
    return {
      state: c.state, milkLitresPerDay: c.milk, monthsToCalving: c.monthsToCalving,
      requirementSet: { id: c.reqs.setId, title: c.reqs.title, status: c.reqs.status },
      result: c.result,
    };
  }

  async save(animalId: string, input: RationInput, caller: Caller) {
    const access = await NutritionAccess.forAnimal(animalId, caller, 'write');
    const c = await this.compute(access, input);
    if (c.result.status !== 'ok') {
      throw new ValidationError('These feeds cannot meet the animal\'s needs yet. Follow the suggestions on screen, then save.', { reasons: c.result.reasons });
    }
    const ok = c.result;
    // The yield typed here is the animal's fact: save it on the profile so every screen agrees.
    if (num(input.milkLitresPerDay) !== null && num(input.milkLitresPerDay) !== c.facts.avgDailyMilkLitres) {
      await AnimalService.updateAnimal(animalId, { avgDailyMilkLitres: num(input.milkLitresPerDay) } as any).catch(err => {
        logger.warn('Ration saved but milk yield not written to the animal profile', { animalId, error: err.message });
      });
    }
    const planId = await database.transaction(async (client: any) => {
      await client.query(`UPDATE nutrition_plans SET status = 'superseded', updated_at = NOW() WHERE animal_id = $1 AND status = 'active'`, [animalId]);
      const p = await client.query(
        `INSERT INTO nutrition_plans (animal_id, enterprise_id, nutrition_model, status, validation, goal, daily_dm_kg, meals_per_day,
                                      requirement_set_id, engine_version, inputs, result, created_by)
         VALUES ($1,$2,'ruminant_dm','active','suggested',$3,$4,2,$5,$6,$7::jsonb,$8::jsonb,$9) RETURNING id`,
        [animalId, access.animal.enterpriseId, c.state === 'lactating' ? 'production' : 'maintain', ok.supplied.dmKg, c.reqs.setId, ENGINE_VERSION,
         JSON.stringify({ milkLitresPerDay: c.milk, milkFatPct: c.fat, monthsToCalving: c.monthsToCalving, weightKg: c.facts.weightKg, feeds: input.feeds }),
         JSON.stringify({ need: ok.need, supplied: ok.supplied, totalCostPerDay: ok.totalCostPerDay, costPerLitre: ok.costPerLitre, state: c.state }),
         caller.userId]
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
    NutritionService.track(caller, 'ration_saved', 'ruminant_dm').catch(() => {});
    return NutritionService.planById(planId);
  }
}

export default new FarmRationService();
