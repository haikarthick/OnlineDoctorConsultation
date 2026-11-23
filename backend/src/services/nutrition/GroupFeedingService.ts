import NutritionNotifier from './NutritionNotifier';
import database from '../../utils/database';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import AnimalAccessService from '../AnimalAccessService';
import { ANIMAL_NO_ACCESS_MESSAGE } from '../AnimalAccessService';
import { groupDailyFeed, fcr, type FeedingCurveRow, type TemperatureFactor } from './engine/groupFeeding';
import { evaluateGroupFeed, type RiskFlag } from './engine/rules';
import { RULE_VERSION } from './engine/models';
import { recordOutcome } from './NutritionService';

/**
 * Daily feed and FCR for a flock, pig batch or pond (docs/NUTRITION_PLAN.md Phase 2). Everything it reads is OWNED
 * elsewhere and read live: head count from the group / its active cycle (population ledger), age from the cycle's
 * start, average weight from the latest Sample-weight daily record, water temperature from Water-quality records,
 * feed given and eggs from Daily records. Nothing is copied; the farmer records once, in Daily records.
 */

interface Caller { userId: string; role?: string; roles?: string[] }

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

class GroupFeedingService {

  async forGroup(groupId: string, caller: Caller, input: { avgWeightG?: number | null; waterTempC?: number | null } = {}) {
    const access = await AnimalAccessService.checkGroup(caller, groupId, 'read');
    if (!access.found) throw new NotFoundError('Group');
    if (!access.allowed) throw new ForbiddenError(ANIMAL_NO_ACCESS_MESSAGE);

    const g = await database.query(
      `SELECT g.id, g.name, g.species, g.group_type, g.current_count,
              c.id AS cycle_id, c.started_at::text AS started_at, c.placed_count, c.current_count AS cycle_count, c.age_at_placement_days
         FROM animal_groups g
         LEFT JOIN group_cycles c ON c.group_id = g.id AND c.status = 'active'
        WHERE g.id = $1`,
      [groupId]
    );
    const grp = g.rows[0];
    if (!grp) throw new NotFoundError('Group');

    // Herds of cattle, buffalo, goats, sheep, horses: their feeding is a balanced ration (FarmRationService), not a
    // per-head table - the card hands over to the herd ration instead of saying "no table".
    const m = await database.query(`SELECT nutrition_model FROM master_species WHERE code = $1`, [grp.species]);
    if (['ruminant_dm', 'equine_dm'].includes(m.rows[0]?.nutrition_model)) {
      return { status: 'herd_ration' as const, group: this.groupInfo(grp), model: m.rows[0].nutrition_model as string };
    }

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
      survivalPct: num(r.survival_pct),
    }));
    const temps = await database.query(`SELECT from_c, to_c, factor FROM nutrition_temperature_factors WHERE curve_key = $1 AND status <> 'retired'`, [key]);
    const temperature: TemperatureFactor[] = temps.rows.map((t: any) => ({ fromC: Number(t.from_c), toC: Number(t.to_c), factor: Number(t.factor) }));

    const headCount = num(grp.cycle_count) ?? num(grp.current_count) ?? 0;
    // Age counts from hatch / birth: pullets placed at 18 weeks are not day-old chicks (age_at_placement_days).
    const ageDays = grp.started_at ? Math.max(0, Math.floor((Date.now() - new Date(grp.started_at).getTime()) / 86400000)) + (num(grp.age_at_placement_days) || 0) : null;
    // A pond's count is what was STOCKED; once the farmer records deaths the count is live and no survival is assumed on top.
    const headCountIsLive = num(grp.placed_count) !== null && (num(grp.cycle_count) ?? 0) < (num(grp.placed_count) ?? 0);

    const since = grp.started_at || new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
    // Feed given is counted in kg only (a migrated "Log use" row kept in bags has no kg figure - migration 063).
    const recs = await database.query(
      `SELECT record_type, record_date::text AS record_date, quantity, detail, cost
         FROM farm_daily_records
        WHERE group_id = $1 AND record_date >= $2::date AND record_type IN ('feed', 'eggs', 'sample_weight', 'water_quality')
          AND (record_type <> 'feed' OR unit = 'kg')
        ORDER BY record_date ASC`,
      [groupId, since]
    );
    // Price per kg: what this group's recorded feed actually cost (each entry carries its stock price) - never a
    // second price typed here.
    const priced = recs.rows.filter((r: any) => r.record_type === 'feed' && num(r.cost) !== null && (num(r.quantity) || 0) > 0).slice(-30);
    const pricedKg = priced.reduce((s: number, r: any) => s + Number(r.quantity), 0);
    const stockPricePerKg = pricedKg > 0 ? Math.round((priced.reduce((s: number, r: any) => s + Number(r.cost), 0) / pricedKg) * 100) / 100 : null;
    const samples = recs.rows.filter((r: any) => r.record_type === 'sample_weight' && num(r.detail?.averageWeight));
    const lastSample = samples[samples.length - 1];
    const firstSample = samples[0];
    const water = recs.rows.filter((r: any) => r.record_type === 'water_quality' && num(r.detail?.temperatureC) !== null);
    const lastWater = water[water.length - 1];

    const avgWeightG = num(input.avgWeightG) ?? (lastSample ? num(lastSample.detail.averageWeight) : null);
    const waterTempC = num(input.waterTempC) ?? (lastWater ? num(lastWater.detail.temperatureC) : null);
    const today = groupDailyFeed({ headCount, headCountIsLive, ageDays, avgWeightG, waterTempC, curve, temperature, pricePerKg: stockPricePerKg });

    // FCR: feed and product are counted over the SAME days. Meat: the feed between the first and the last sample weight
    // (not the whole cycle, which would include feed that built weight before the first sample). Eggs: the feed since the
    // first eggs were recorded (the rearing feed is not the layers' feed).
    const sum = (list: any[]) => list.reduce((s: number, r: any) => s + (num(r.quantity) || 0), 0);
    const feedRows = recs.rows.filter((r: any) => r.record_type === 'feed');
    const product = rows[0].product as 'meat' | 'eggs';
    let productKg: number | null = null;
    let feedKg = sum(feedRows);
    if (product === 'eggs') {
      const eggRows = recs.rows.filter((r: any) => r.record_type === 'eggs');
      const eggs = sum(eggRows);
      productKg = eggs > 0 && num(rows[0].egg_mass_g) ? (eggs * Number(rows[0].egg_mass_g)) / 1000 : null;
      if (eggRows.length) feedKg = sum(feedRows.filter((r: any) => r.record_date >= eggRows[0].record_date));
    } else if (lastSample && firstSample && lastSample !== firstSample) {
      // Meat gain between the two samples, for the animals alive now (count changes between samples are not tracked here).
      const gainKg = headCount * ((num(lastSample.detail.averageWeight) as number) - (num(firstSample.detail.averageWeight) as number)) / 1000;
      productKg = gainKg > 0 ? gainKg : null;
      feedKg = sum(feedRows.filter((r: any) => r.record_date >= firstSample.record_date && r.record_date <= lastSample.record_date));
    }

    // Fed well below / above the table this week (Phase 4 rule). Judged on the RECORDED inputs only - a "what if"
    // weight or temperature typed on the card never raises or closes an alert.
    if (input.avgWeightG === undefined || input.avgWeightG === null) {
      if (input.waterTempC === undefined || input.waterTempC === null) {
        const recordedFeed = feedRows.map((r: any) => ({ date: r.record_date, kg: num(r.quantity) || 0 }));
        // What the table said on each of those days: the age (or the latest sample weight) as it was THEN.
        const suggestedByDay = new Map<string, number>();
        for (const d of new Set<string>(recordedFeed.map((r: { date: string }) => r.date))) {
          const daysAgo = Math.round((Date.now() - new Date(d).getTime()) / 86400000);
          const sampleThen = [...samples].reverse().find((x: any) => x.record_date <= d);
          const dayResult = groupDailyFeed({
            headCount, headCountIsLive, ageDays: ageDays === null ? null : Math.max(0, ageDays - daysAgo),
            avgWeightG: sampleThen ? num(sampleThen.detail.averageWeight) : avgWeightG, waterTempC, curve, temperature,
          });
          if (dayResult.status === 'ok') suggestedByDay.set(d as string, dayResult.kgPerDay);
        }
        const flagged = today.status === 'ok' ? evaluateGroupFeed({ suggestedByDay, recorded: recordedFeed }) : [];
        await this.syncFeedFlags(groupId, flagged).catch(() => { /* an alert failure must not hide the feed card */ });
      }
    }
    const flags = await database.query(
      `SELECT id, flag_type, severity, params FROM nutrition_risk_flags WHERE group_id = $1 AND status = 'open' ORDER BY updated_at DESC`, [groupId]);

    return {
      status: 'ok' as const,
      group: this.groupInfo(grp),
      curve: { key, title: rows[0].title, product, source: rows[0].source, status: rows[0].status, basis: rows[0].basis },
      inputs: { headCount, ageDays, avgWeightG, waterTempC, avgWeightDate: lastSample?.record_date ?? null, waterDate: lastWater?.record_date ?? null, pricePerKg: stockPricePerKg },
      today,
      cycle: { since, feedKg: Math.round(feedKg * 10) / 10, productKg: productKg === null ? null : Math.round(productKg * 10) / 10, fcr: fcr(feedKg, productKg) },
      flags: flags.rows.map((x: any) => ({ id: x.id, type: x.flag_type, severity: x.severity, params: x.params || {} })),
      canAct: access.via === 'admin' || (await AnimalAccessService.checkGroup(caller, groupId, 'write')).allowed,
    };
  }

  /** Raise / refresh the herd feed alerts that apply now and close the ones that no longer do (with an outcome label). */
  private async syncFeedFlags(groupId: string, flagged: RiskFlag[]): Promise<void> {
    for (const f of flagged) {
      const r = await database.query(
        `INSERT INTO nutrition_risk_flags (group_id, flag_type, severity, params, rule_version)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT ((COALESCE(animal_id, group_id)), flag_type) WHERE status = 'open'
         DO UPDATE SET severity = EXCLUDED.severity, params = EXCLUDED.params, rule_version = EXCLUDED.rule_version, updated_at = NOW()
         RETURNING id, (xmax = 0) AS inserted`,
        [groupId, f.type, f.severity, JSON.stringify(f.params), RULE_VERSION]
      );
      if (r.rows[0]?.inserted) await NutritionNotifier.flagRaised({ groupId }, { id: r.rows[0].id, type: f.type, severity: f.severity });
    }
    const closed = await database.query(
      `UPDATE nutrition_risk_flags SET status = 'resolved', updated_at = NOW()
        WHERE group_id = $1 AND status = 'open' AND flag_type IN ('feed_below_need', 'feed_above_need') AND NOT (flag_type = ANY($2::text[]))
        RETURNING id, animal_id, group_id, flag_type, severity, rule_version, params`,
      [groupId, flagged.map(f => f.type)]
    );
    for (const row of closed.rows) await recordOutcome(row, 'resolved', null);
  }

  private groupInfo(g: any) {
    return { id: g.id, name: g.name, species: g.species, groupType: g.group_type, cycleId: g.cycle_id || null };
  }
}

export default new GroupFeedingService();
