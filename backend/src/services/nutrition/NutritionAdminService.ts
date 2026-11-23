import database from '../../utils/database';
import { ValidationError, NotFoundError, ConflictError } from '../../utils/errors';
import { isNutritionModel } from './engine/models';
import NutritionService from './NutritionService';

/**
 * Admin master data for nutrition: which model each species uses, energy factors, the shared food library,
 * unsafe foods, requirement sets, and the usage report the later pricing decision rests on.
 *
 * Every reference row carries source, licence and status. Marking a row 'vet_validated' records who did it
 * and when - the owner's vet-validation step (docs/NUTRITION_PLAN.md §12.1 row 3) flips data, not code.
 */

const LOCALES = ['hi', 'kn', 'ml', 'ta', 'te'] as const;
const blank = (v: unknown) => v === undefined || v === null || v === '';
const numOrNull = (v: unknown) => (blank(v) ? null : Number(v));

/** Builds "col = $n" pairs from a whitelist; returns [sets, values]. Never splices a key into SQL. */
function buildSets(input: Record<string, unknown>, map: Record<string, string>, startAt = 2): [string[], unknown[]] {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, col] of Object.entries(map)) {
    if (input[key] === undefined) continue;
    values.push(input[key] === '' ? null : input[key]);
    sets.push(`${col} = $${startAt + values.length - 1}`);
  }
  return [sets, values];
}

const LABEL_MAP: Record<string, string> = {
  label: 'label', labelHi: 'label_hi', labelKn: 'label_kn', labelMl: 'label_ml', labelTa: 'label_ta', labelTe: 'label_te',
};

class NutritionAdminService {

  // ─── Species -> model ────────────────────────────────────────────────────

  async listSpecies(): Promise<any[]> {
    const r = await database.query(
      `SELECT code, label, label_key, label_hi, label_kn, label_ml, label_ta, label_te, icon, category, nutrition_model, is_active
         FROM master_species ORDER BY sort_order, label`);
    return r.rows.map((x: any) => ({
      code: x.code, label: x.label, labelKey: x.label_key, labelHi: x.label_hi, labelKn: x.label_kn, labelMl: x.label_ml,
      labelTa: x.label_ta, labelTe: x.label_te, icon: x.icon, category: x.category, nutritionModel: x.nutrition_model, isActive: x.is_active,
    }));
  }

  async setSpeciesModel(code: string, model: string): Promise<void> {
    if (!isNutritionModel(model)) throw new ValidationError('Choose a nutrition model from the list.');
    const r = await database.query(`UPDATE master_species SET nutrition_model = $2, updated_at = NOW() WHERE code = $1`, [code, model]);
    if (r.rowCount === 0) throw new NotFoundError('Species');
  }

  // ─── Energy factors ──────────────────────────────────────────────────────

  async listEnergyFactors(): Promise<any[]> {
    const r = await database.query(
      `SELECT f.*, COALESCE(u.first_name || ' ' || u.last_name, '') AS validated_by_name
         FROM nutrition_energy_factors f LEFT JOIN users u ON u.id = f.validated_by
        ORDER BY f.species_code, f.factor_key`);
    return r.rows.map((x: any) => ({
      id: x.id, speciesCode: x.species_code, factorKey: x.factor_key, factor: Number(x.factor), source: x.source,
      licence: x.licence, status: x.status, validatedBy: x.validated_by, validatedByName: x.validated_by_name, validatedAt: x.validated_at,
    }));
  }

  async createEnergyFactor(input: any, adminId: string): Promise<any> {
    if (blank(input.speciesCode) || blank(input.factorKey) || blank(input.factor) || blank(input.source)) {
      throw new ValidationError('Species, factor name, factor and source are all needed.');
    }
    try {
      await database.query(
        `INSERT INTO nutrition_energy_factors (species_code, factor_key, factor, source, licence, status, validated_by, validated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [input.speciesCode, input.factorKey, input.factor, input.source, input.licence || null, input.status || 'unvalidated',
         input.status === 'vet_validated' ? adminId : null, input.status === 'vet_validated' ? new Date() : null]
      );
    } catch (e: any) {
      if (e.code === '23505') throw new ConflictError('That species already has a factor with this name. Edit the existing one.');
      throw e;
    }
    return this.listEnergyFactors();
  }

  async updateEnergyFactor(id: string, input: any, adminId: string): Promise<void> {
    const [sets, values] = buildSets(input, { factor: 'factor', source: 'source', licence: 'licence', status: 'status' });
    if (input.status === 'vet_validated') { values.push(adminId); sets.push(`validated_by = $${values.length + 1}`, 'validated_at = NOW()'); }
    if (input.status && input.status !== 'vet_validated') sets.push('validated_by = NULL', 'validated_at = NULL');
    if (sets.length === 0) throw new ValidationError('Nothing to change.');
    const r = await database.query(`UPDATE nutrition_energy_factors SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`, [id, ...values]);
    if (r.rowCount === 0) throw new NotFoundError('Energy factor');
  }

  // ─── Shared food library ─────────────────────────────────────────────────

  async listFoods(params: { search?: string; kind?: string; limit?: number; offset?: number }): Promise<{ items: any[]; total: number }> {
    const where = ['owner_id IS NULL', 'enterprise_id IS NULL'];
    const values: unknown[] = [];
    if (params.kind) { values.push(params.kind); where.push(`kind = $${values.length}`); }
    if (params.search) { values.push(`%${String(params.search).trim().slice(0, 60)}%`); where.push(`(label ILIKE $${values.length} OR code ILIKE $${values.length})`); }
    const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);
    const offset = Math.max(Number(params.offset) || 0, 0);
    const [rows, count] = await Promise.all([
      database.query(`SELECT * FROM nutrition_ingredients WHERE ${where.join(' AND ')} ORDER BY label LIMIT ${limit} OFFSET ${offset}`, values),
      database.query(`SELECT COUNT(*) AS n FROM nutrition_ingredients WHERE ${where.join(' AND ')}`, values),
    ]);
    return { items: rows.rows.map((x: any) => ({ ...NutritionService.mapFood(x), isActive: x.is_active })), total: Number(count.rows[0]?.n) || 0 };
  }

  async createFood(input: any, adminId: string): Promise<any> {
    if (blank(input.label) || blank(input.kind)) throw new ValidationError('A food needs a name and a kind.');
    try {
      const r = await database.query(
        `INSERT INTO nutrition_ingredients (code, label, label_hi, label_kn, label_ml, label_ta, label_te, kind, models,
                                            energy_kcal_per_100g, dry_matter_pct, composition, source, licence, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16) RETURNING *`,
        [input.code || null, input.label, input.labelHi || null, input.labelKn || null, input.labelMl || null, input.labelTa || null,
         input.labelTe || null, input.kind, input.models || [], numOrNull(input.kcalPer100g), numOrNull(input.dryMatterPct),
         JSON.stringify(input.composition || {}), input.source || null, input.licence || null, input.status || 'unvalidated', adminId]
      );
      return NutritionService.mapFood(r.rows[0]);
    } catch (e: any) {
      if (e.code === '23505') throw new ConflictError('A food with this code already exists. Use another code or edit that food.');
      throw e;
    }
  }

  async updateFood(id: string, input: any): Promise<void> {
    const owned = await database.query(`SELECT owner_id, enterprise_id FROM nutrition_ingredients WHERE id = $1`, [id]);
    if (!owned.rows[0]) throw new NotFoundError('Food');
    if (owned.rows[0].owner_id || owned.rows[0].enterprise_id) throw new ValidationError('This food belongs to a pet owner or farm and is edited by them.');
    const prepared: Record<string, unknown> = { ...input };
    if (input.kcalPer100g !== undefined) prepared.kcalPer100g = numOrNull(input.kcalPer100g);
    if (input.dryMatterPct !== undefined) prepared.dryMatterPct = numOrNull(input.dryMatterPct);
    if (input.composition !== undefined) prepared.composition = JSON.stringify(input.composition);
    const [sets, values] = buildSets(prepared, {
      ...LABEL_MAP, code: 'code', kind: 'kind', models: 'models', kcalPer100g: 'energy_kcal_per_100g', dryMatterPct: 'dry_matter_pct',
      composition: 'composition', source: 'source', licence: 'licence', status: 'status', isActive: 'is_active',
    });
    if (sets.length === 0) throw new ValidationError('Nothing to change.');
    await database.query(`UPDATE nutrition_ingredients SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`, [id, ...values]);
  }

  // ─── Unsafe foods ────────────────────────────────────────────────────────

  async listUnsafe(): Promise<any[]> {
    const r = await database.query(`SELECT * FROM nutrition_unsafe_foods ORDER BY species_code, label`);
    return r.rows.map((x: any) => ({
      id: x.id, code: x.code, speciesCode: x.species_code, label: x.label, labelKey: x.label_key,
      ...Object.fromEntries(LOCALES.map(l => [`label${l[0].toUpperCase()}${l[1]}`, x[`label_${l}`]])),
      matchTerms: x.match_terms || [], severity: x.severity, source: x.source, status: x.status, isActive: x.is_active,
    }));
  }

  async createUnsafe(input: any): Promise<void> {
    if (blank(input.code) || blank(input.speciesCode) || blank(input.label) || blank(input.source)) {
      throw new ValidationError('Code, species, name and source are all needed.');
    }
    try {
      await database.query(
        `INSERT INTO nutrition_unsafe_foods (code, species_code, label, label_hi, label_kn, label_ml, label_ta, label_te, match_terms, severity, source, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [input.code, input.speciesCode, input.label, input.labelHi || null, input.labelKn || null, input.labelMl || null,
         input.labelTa || null, input.labelTe || null, input.matchTerms || [], input.severity || 'danger', input.source, input.status || 'unvalidated']
      );
    } catch (e: any) {
      if (e.code === '23505') throw new ConflictError('This species already has an unsafe food with this code.');
      throw e;
    }
  }

  async updateUnsafe(id: string, input: any): Promise<void> {
    const [sets, values] = buildSets(input, {
      ...LABEL_MAP, matchTerms: 'match_terms', severity: 'severity', source: 'source', status: 'status', isActive: 'is_active',
    });
    if (sets.length === 0) throw new ValidationError('Nothing to change.');
    const r = await database.query(`UPDATE nutrition_unsafe_foods SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`, [id, ...values]);
    if (r.rowCount === 0) throw new NotFoundError('Unsafe food');
  }

  // ─── Requirement sets ────────────────────────────────────────────────────

  async listRequirementSets(): Promise<any[]> {
    const r = await database.query(
      `SELECT s.*, (SELECT COUNT(*) FROM nutrition_requirements q WHERE q.set_id = s.id) AS rows
         FROM nutrition_requirement_sets s ORDER BY s.nutrition_model, s.species_code NULLS LAST, s.code`);
    return r.rows.map((x: any) => this.mapSet(x));
  }

  async getRequirementSet(id: string): Promise<any> {
    const r = await database.query(`SELECT * FROM nutrition_requirement_sets WHERE id = $1`, [id]);
    if (!r.rows[0]) throw new NotFoundError('Requirement set');
    const q = await database.query(`SELECT * FROM nutrition_requirements WHERE set_id = $1 ORDER BY nutrient, basis`, [id]);
    return {
      ...this.mapSet(r.rows[0]),
      requirements: q.rows.map((x: any) => ({
        id: x.id, nutrient: x.nutrient, basis: x.basis, minValue: numOrNull(x.min_value), maxValue: numOrNull(x.max_value), unit: x.unit, notes: x.notes,
      })),
    };
  }

  async saveRequirementSet(id: string | null, input: any, adminId: string): Promise<any> {
    const setId = await database.transaction(async (client: any) => {
      let sid = id;
      if (!sid) {
        if (blank(input.code) || blank(input.nutritionModel) || blank(input.title) || blank(input.source)) {
          throw new ValidationError('Code, model, title and source are all needed.');
        }
        try {
          const ins = await client.query(
            `INSERT INTO nutrition_requirement_sets (code, nutrition_model, species_code, life_stage, title, source, source_url, licence, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
            [input.code, input.nutritionModel, input.speciesCode || null, input.lifeStage || null, input.title, input.source,
             input.sourceUrl || null, input.licence || null, input.status || 'unvalidated']
          );
          sid = ins.rows[0].id;
        } catch (e: any) {
          if (e.code === '23505') throw new ConflictError('A requirement set with this code already exists.');
          throw e;
        }
      } else {
        const [sets, values] = buildSets(input, {
          nutritionModel: 'nutrition_model', speciesCode: 'species_code', lifeStage: 'life_stage', title: 'title',
          source: 'source', sourceUrl: 'source_url', licence: 'licence', status: 'status',
        });
        if (input.status === 'vet_validated') { values.push(adminId); sets.push(`validated_by = $${values.length + 1}`, 'validated_at = NOW()'); }
        if (Array.isArray(input.requirements)) sets.push('version = version + 1');
        if (sets.length) {
          const u = await client.query(`UPDATE nutrition_requirement_sets SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`, [sid, ...values]);
          if (u.rowCount === 0) throw new NotFoundError('Requirement set');
        }
      }
      if (Array.isArray(input.requirements)) {
        await client.query(`DELETE FROM nutrition_requirements WHERE set_id = $1`, [sid]);
        const seen = new Set<string>();
        for (const q of input.requirements) {
          const k = `${q.nutrient}|${q.basis}`;
          if (seen.has(k)) throw new ValidationError(`${q.nutrient} is listed twice for the same basis.`);
          seen.add(k);
          if (blank(q.minValue) && blank(q.maxValue)) throw new ValidationError(`${q.nutrient} needs a minimum, a maximum or both.`);
          if (!blank(q.minValue) && !blank(q.maxValue) && Number(q.minValue) > Number(q.maxValue)) {
            throw new ValidationError(`${q.nutrient}: the minimum is above the maximum.`);
          }
          await client.query(
            `INSERT INTO nutrition_requirements (set_id, nutrient, basis, min_value, max_value, unit, notes) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [sid, q.nutrient, q.basis, numOrNull(q.minValue), numOrNull(q.maxValue), q.unit, q.notes || null]
          );
        }
      }
      return sid;
    });
    return this.getRequirementSet(setId as string);
  }

  private mapSet(x: any) {
    return {
      id: x.id, code: x.code, nutritionModel: x.nutrition_model, speciesCode: x.species_code, lifeStage: x.life_stage,
      title: x.title, source: x.source, sourceUrl: x.source_url, licence: x.licence, version: x.version, status: x.status,
      validatedAt: x.validated_at, rows: x.rows === undefined ? undefined : Number(x.rows),
    };
  }

  // ─── Feeding curves (flocks, pig batches, ponds - migration 059) ─────────

  async listCurves(): Promise<any[]> {
    const r = await database.query(
      `SELECT * FROM nutrition_feeding_curves ORDER BY curve_key, COALESCE(age_from_days, 0), COALESCE(weight_from_g, 0)`);
    return r.rows.map((x: any) => ({
      id: x.id, curveKey: x.curve_key, title: x.title, model: x.nutrition_model, speciesCodes: x.species_codes, groupTypes: x.group_types,
      basis: x.basis, product: x.product, ageFromDays: x.age_from_days, ageToDays: x.age_to_days,
      weightFromG: numOrNull(x.weight_from_g), weightToG: numOrNull(x.weight_to_g),
      gramsPerHeadDay: numOrNull(x.grams_per_head_day), ratePctBiomass: numOrNull(x.rate_pct_biomass),
      feedsPerDay: x.feeds_per_day, feedType: x.feed_type, source: x.source, status: x.status,
    }));
  }

  async updateCurve(id: string, input: any): Promise<void> {
    const [sets, values] = buildSets(input, {
      gramsPerHeadDay: 'grams_per_head_day', ratePctBiomass: 'rate_pct_biomass', feedsPerDay: 'feeds_per_day',
      feedType: 'feed_type', source: 'source', status: 'status',
    });
    if (sets.length === 0) throw new ValidationError('Nothing to change.');
    const r = await database.query(`UPDATE nutrition_feeding_curves SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`, [id, ...values]);
    if (r.rowCount === 0) throw new NotFoundError('Feeding curve row');
  }

  /**
   * Owner decision 2026-11-22: approve reference data for use now, vet review later. Moves every shared row still
   * 'unvalidated' to 'owner_approved' in one step. Private foods a pet owner or farm entered are theirs - untouched.
   */
  async approveAllPending(): Promise<Record<string, number>> {
    return database.transaction(async (client: any) => {
      const out: Record<string, number> = {};
      const run = async (table: string, extra = '') => {
        const r = await client.query(`UPDATE ${table} SET status = 'owner_approved' WHERE status = 'unvalidated'${extra}`);
        out[table] = r.rowCount || 0;
      };
      await run('nutrition_energy_factors');
      await run('nutrition_requirement_sets');
      await run('nutrition_unsafe_foods');
      await run('nutrition_ingredients', ' AND owner_id IS NULL AND enterprise_id IS NULL');
      await run('nutrition_feeding_curves');
      await run('nutrition_temperature_factors');
      return out;
    });
  }

  // ─── Usage (for the later, usage-based pricing decision) ─────────────────

  async usage(days: number): Promise<any> {
    const span = Math.min(Math.max(Math.floor(days) || 30, 1), 365);
    const [byEvent, users, plans, alerts] = await Promise.all([
      database.query(
        `SELECT event, COALESCE(user_role, 'unknown') AS role, COUNT(*) AS n FROM nutrition_usage_events
          WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day') GROUP BY event, role ORDER BY event, role`, [span]),
      database.query(
        `SELECT COUNT(DISTINCT user_id) AS n FROM nutrition_usage_events WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')`, [span]),
      database.query(
        `SELECT nutrition_model, validation, COUNT(*) AS n FROM nutrition_plans WHERE status = 'active' GROUP BY 1, 2 ORDER BY 1, 2`),
      // Alert quality (Phase 4): per rule, how people answered its alerts in the period, and how many are open now.
      database.query(
        `SELECT t.flag_type,
                COALESCE(o.confirmed, 0) AS confirmed, COALESCE(o.false_alarm, 0) AS false_alarm, COALESCE(o.resolved, 0) AS resolved,
                COALESCE(f.open, 0) AS open
           FROM (SELECT flag_type FROM nutrition_outcomes WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
                 UNION SELECT flag_type FROM nutrition_risk_flags WHERE status = 'open') t
           LEFT JOIN (SELECT flag_type,
                             COUNT(*) FILTER (WHERE outcome = 'confirmed') AS confirmed,
                             COUNT(*) FILTER (WHERE outcome = 'false_alarm') AS false_alarm,
                             COUNT(*) FILTER (WHERE outcome = 'resolved') AS resolved
                        FROM nutrition_outcomes WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day') GROUP BY flag_type) o ON o.flag_type = t.flag_type
           LEFT JOIN (SELECT flag_type, COUNT(*) AS open FROM nutrition_risk_flags WHERE status = 'open' GROUP BY flag_type) f ON f.flag_type = t.flag_type
          ORDER BY t.flag_type`, [span]),
    ]);
    return {
      days: span,
      activeUsers: Number(users.rows[0]?.n) || 0,
      events: byEvent.rows.map((x: any) => ({ event: x.event, role: x.role, count: Number(x.n) })),
      activePlans: plans.rows.map((x: any) => ({ model: x.nutrition_model, validation: x.validation, count: Number(x.n) })),
      alerts: alerts.rows.map((x: any) => {
        const confirmed = Number(x.confirmed) || 0;
        const falseAlarm = Number(x.false_alarm) || 0;
        return {
          type: x.flag_type, confirmed, falseAlarm, resolved: Number(x.resolved) || 0, open: Number(x.open) || 0,
          // Share of answered alerts people said were right; null until someone has answered one.
          hitRatePct: confirmed + falseAlarm > 0 ? Math.round((confirmed / (confirmed + falseAlarm)) * 100) : null,
        };
      }),
    };
  }
}

export default new NutritionAdminService();
