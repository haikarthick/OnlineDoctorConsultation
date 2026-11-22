import database from '../../utils/database';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import AnimalAccessService from '../AnimalAccessService';
import { ANIMAL_NO_ACCESS_MESSAGE } from '../AnimalAccessService';
import { groupDailyFeed, fcr, type FeedingCurveRow, type TemperatureFactor } from './engine/groupFeeding';

/**
 * Daily feed and FCR for a flock, pig batch or pond (docs/NUTRITION_PLAN.md Phase 2). Everything it reads is OWNED
 * elsewhere and read live: head count from the group / its active cycle (population ledger), age from the cycle's
 * start, average weight from the latest Sample-weight daily record, water temperature from Water-quality records,
 * feed given and eggs from Daily records. Nothing is copied; the farmer records once, in Daily records.
 */

interface Caller { userId: string; role?: string; roles?: string[] }

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

class GroupFeedingService {

  async forGroup(groupId: string, caller: Caller, input: { pricePerKg?: number | null; avgWeightG?: number | null; waterTempC?: number | null } = {}) {
    const access = await AnimalAccessService.checkGroup(caller, groupId, 'read');
    if (!access.found) throw new NotFoundError('Group');
    if (!access.allowed) throw new ForbiddenError(ANIMAL_NO_ACCESS_MESSAGE);

    const g = await database.query(
      `SELECT g.id, g.name, g.species, g.group_type, g.current_count,
              c.id AS cycle_id, c.started_at::text AS started_at, c.placed_count, c.current_count AS cycle_count
         FROM animal_groups g
         LEFT JOIN group_cycles c ON c.group_id = g.id AND c.status = 'active'
        WHERE g.id = $1`,
      [groupId]
    );
    const grp = g.rows[0];
    if (!grp) throw new NotFoundError('Group');

    const curves = await database.query(
      `SELECT * FROM nutrition_feeding_curves
        WHERE $1 = ANY(species_codes) AND status <> 'retired'
          AND (cardinality(group_types) = 0 OR $2 = ANY(group_types))
        ORDER BY (cardinality(group_types) = 0), curve_key, COALESCE(age_from_days, 0), COALESCE(weight_from_g, 0)`,
      [grp.species, grp.group_type || '']
    );
    if (curves.rows.length === 0) {
      return { status: 'no_curve' as const, group: this.groupInfo(grp) };
    }
    const key = curves.rows[0].curve_key;
    const rows = curves.rows.filter((r: any) => r.curve_key === key);
    const curve: FeedingCurveRow[] = rows.map((r: any) => ({
      basis: r.basis, ageFromDays: r.age_from_days, ageToDays: r.age_to_days, weightFromG: num(r.weight_from_g), weightToG: num(r.weight_to_g),
      gramsPerHeadDay: num(r.grams_per_head_day), ratePctBiomass: num(r.rate_pct_biomass), feedsPerDay: r.feeds_per_day, feedType: r.feed_type,
    }));
    const temps = await database.query(`SELECT from_c, to_c, factor FROM nutrition_temperature_factors WHERE curve_key = $1 AND status <> 'retired'`, [key]);
    const temperature: TemperatureFactor[] = temps.rows.map((t: any) => ({ fromC: Number(t.from_c), toC: Number(t.to_c), factor: Number(t.factor) }));

    const headCount = num(grp.cycle_count) ?? num(grp.current_count) ?? 0;
    const ageDays = grp.started_at ? Math.max(0, Math.floor((Date.now() - new Date(grp.started_at).getTime()) / 86400000)) : null;

    const since = grp.started_at || new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
    const recs = await database.query(
      `SELECT record_type, record_date::text AS record_date, quantity, detail
         FROM farm_daily_records
        WHERE group_id = $1 AND record_date >= $2::date AND record_type IN ('feed', 'eggs', 'sample_weight', 'water_quality')
        ORDER BY record_date ASC`,
      [groupId, since]
    );
    const samples = recs.rows.filter((r: any) => r.record_type === 'sample_weight' && num(r.detail?.averageWeight));
    const lastSample = samples[samples.length - 1];
    const firstSample = samples[0];
    const water = recs.rows.filter((r: any) => r.record_type === 'water_quality' && num(r.detail?.temperatureC) !== null);
    const lastWater = water[water.length - 1];

    const avgWeightG = num(input.avgWeightG) ?? (lastSample ? num(lastSample.detail.averageWeight) : null);
    const waterTempC = num(input.waterTempC) ?? (lastWater ? num(lastWater.detail.temperatureC) : null);
    if (input.pricePerKg !== undefined && input.pricePerKg !== null && (Number(input.pricePerKg) < 0 || Number(input.pricePerKg) > 100000)) {
      throw new ValidationError('Check the feed price.');
    }

    const today = groupDailyFeed({ headCount, ageDays, avgWeightG, waterTempC, curve, temperature, pricePerKg: num(input.pricePerKg) });

    // FCR over the active cycle: feed recorded vs product made.
    const feedKg = recs.rows.filter((r: any) => r.record_type === 'feed').reduce((s: number, r: any) => s + (num(r.quantity) || 0), 0);
    const product = rows[0].product as 'meat' | 'eggs';
    let productKg: number | null = null;
    if (product === 'eggs') {
      const eggs = recs.rows.filter((r: any) => r.record_type === 'eggs').reduce((s: number, r: any) => s + (num(r.quantity) || 0), 0);
      productKg = eggs > 0 && num(rows[0].egg_mass_g) ? (eggs * Number(rows[0].egg_mass_g)) / 1000 : null;
    } else if (lastSample && firstSample && lastSample !== firstSample) {
      const start = (num(grp.placed_count) || headCount) * (num(firstSample.detail.averageWeight) as number) / 1000;
      const now = headCount * (num(lastSample.detail.averageWeight) as number) / 1000;
      productKg = now - start > 0 ? now - start : null;
    }

    return {
      status: 'ok' as const,
      group: this.groupInfo(grp),
      curve: { key, title: rows[0].title, product, source: rows[0].source, status: rows[0].status, basis: rows[0].basis },
      inputs: { headCount, ageDays, avgWeightG, waterTempC, avgWeightDate: lastSample?.record_date ?? null, waterDate: lastWater?.record_date ?? null },
      today,
      cycle: { since, feedKg: Math.round(feedKg * 10) / 10, productKg: productKg === null ? null : Math.round(productKg * 10) / 10, fcr: fcr(feedKg, productKg) },
    };
  }

  private groupInfo(g: any) {
    return { id: g.id, name: g.name, species: g.species, groupType: g.group_type, cycleId: g.cycle_id || null };
  }
}

export default new GroupFeedingService();
