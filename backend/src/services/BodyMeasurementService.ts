import database from '../utils/database';
import { ValidationError, NotFoundError } from '../utils/errors';
import { inferBcsScale, toNinePoint } from './nutrition/engine/condition';
import { isNutritionModel, MUSCLE_CONDITIONS, type MuscleCondition, type NutritionModel } from './nutrition/engine/models';

/**
 * THE one writer of body measurements - weight, body condition score, muscle condition - for every module
 * (medical records' weight history, farm health observations, nutrition). Owner decision 2026-11-22:
 * weight_history is the single body-measurement history (migration 056).
 *
 * It also keeps the animal's cached "current weight" right. Two columns hold it, written by different screens
 * before this service existed (animals.weight by weight history, animals.current_weight by health
 * observations), and screens read either - so both are updated together here, and they can no longer drift.
 */

export type MeasurementSource = 'medical_record' | 'health_observation' | 'nutrition' | 'farm_event' | 'import';

export interface MeasurementInput {
  animalId: string;
  weight?: number | null;
  unit?: string | null;
  bodyConditionScore?: number | null;
  /** 5 or 9. Left out: inferred from the species' nutrition model and the score. */
  bcsScale?: 5 | 9 | null;
  muscleCondition?: MuscleCondition | null;
  notes?: string | null;
  source: MeasurementSource;
  sourceId?: string | null;
  recordedBy?: string | null;
  recordedAt?: string | null;
}

export interface MeasurementRow {
  id: string;
  animalId: string;
  weight: number | null;
  unit: string;
  weightKg: number | null;
  bodyConditionScore: number | null;
  bcsScale: number | null;
  bcs9: number | null;
  muscleCondition: MuscleCondition | null;
  source: MeasurementSource;
  notes: string | null;
  recordedAt: string;
  recordedBy: string | null;
  recordedByName: string;
}

const TO_KG: Record<string, number> = { kg: 1, g: 0.001, lbs: 0.45359237, lb: 0.45359237 };

export const toKg = (weight: number | null, unit: string | null | undefined): number | null =>
  weight === null || !Number.isFinite(weight) ? null : Math.round(weight * (TO_KG[(unit || 'kg').toLowerCase()] ?? 1) * 1000) / 1000;

class BodyMeasurementService {

  /** The nutrition model of an animal's species (class override first). guidance_only when unmapped. */
  async modelFor(animalId: string): Promise<NutritionModel> {
    const r = await database.query(
      `SELECT COALESCE(mc.nutrition_model, ms.nutrition_model) AS model
         FROM animals a
         LEFT JOIN master_species ms ON ms.code = a.species
         LEFT JOIN master_animal_classes mc ON mc.value = a.animal_class AND mc.species_id = ms.id
        WHERE a.id = $1`,
      [animalId]
    );
    const m = r.rows[0]?.model;
    return isNutritionModel(m) ? m : 'guidance_only';
  }

  async record(input: MeasurementInput, client?: any): Promise<MeasurementRow> {
    const weight = input.weight === undefined || input.weight === null || (input.weight as unknown) === '' ? null : Number(input.weight);
    if (weight !== null && (!Number.isFinite(weight) || weight <= 0 || weight > 20000)) {
      throw new ValidationError('Weight must be a number above zero.');
    }
    const unit = (input.unit || 'kg').toLowerCase();
    if (!(unit in TO_KG)) throw new ValidationError('Weight unit must be kg, g or lbs.');

    let bcs: number | null = input.bodyConditionScore === undefined || input.bodyConditionScore === null ? null : Number(input.bodyConditionScore);
    let scale: 5 | 9 | null = input.bcsScale ?? null;
    if (bcs !== null) {
      if (!Number.isFinite(bcs)) throw new ValidationError('Body condition score must be a number.');
      if (!scale) scale = inferBcsScale(await this.modelFor(input.animalId), bcs);
      if (bcs < 1 || bcs > scale) throw new ValidationError(`Body condition score must be between 1 and ${scale}.`);
      bcs = Math.round(bcs * 2) / 2; // half points are the finest anyone scores
    }
    const muscle = input.muscleCondition ?? null;
    if (muscle !== null && !(MUSCLE_CONDITIONS as readonly string[]).includes(muscle)) {
      throw new ValidationError('Muscle condition must be normal, mild, moderate or marked loss.');
    }
    if (weight === null && bcs === null && muscle === null) {
      throw new ValidationError('Enter a weight, a body condition score or a muscle condition.');
    }

    const q = client ? client.query.bind(client) : database.query.bind(database);
    const exists = await q(`SELECT id FROM animals WHERE id = $1`, [input.animalId]);
    if (exists.rows.length === 0) throw new NotFoundError('Animal');

    const ins = await q(
      `INSERT INTO weight_history (animal_id, weight, unit, body_condition_score, bcs_scale, muscle_condition,
                                   source, source_id, notes, recorded_by, recorded_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::timestamptz, NOW()), NOW())
       RETURNING id`,
      [input.animalId, weight, unit, bcs, bcs === null ? null : scale, muscle, input.source, input.sourceId || null,
       input.notes ? String(input.notes).trim().slice(0, 500) : null, input.recordedBy || null, input.recordedAt || null]
    );

    if (weight !== null) {
      // Only move the cached current weight forward: a back-dated entry must not overwrite a newer one.
      await q(
        `UPDATE animals SET weight = $1, current_weight = $1, weight_unit = $2, last_weighed_at = COALESCE($4::timestamptz, NOW()), updated_at = NOW()
          WHERE id = $3 AND (last_weighed_at IS NULL OR last_weighed_at <= COALESCE($4::timestamptz, NOW()))`,
        [weight, unit, input.animalId, input.recordedAt || null]
      );
    }
    const rows = await this.list(input.animalId, { limit: 1, id: ins.rows[0].id }, client);
    return rows[0];
  }

  async list(animalId: string, opts: { limit?: number; since?: string; id?: string; withWeightOnly?: boolean } = {}, client?: any): Promise<MeasurementRow[]> {
    const q = client ? client.query.bind(client) : database.query.bind(database);
    const params: unknown[] = [animalId];
    const where = ['wh.animal_id = $1'];
    if (opts.id) { params.push(opts.id); where.push(`wh.id = $${params.length}`); }
    if (opts.since) { params.push(opts.since); where.push(`wh.recorded_at >= $${params.length}::timestamptz`); }
    if (opts.withWeightOnly) where.push('wh.weight IS NOT NULL');
    params.push(Math.min(Math.max(opts.limit || 50, 1), 500));
    const r = await q(
      `SELECT wh.id, wh.animal_id, wh.weight, wh.unit, wh.body_condition_score, wh.bcs_scale, wh.muscle_condition,
              wh.source, wh.notes, wh.recorded_at, wh.recorded_by,
              COALESCE(u.first_name || ' ' || u.last_name, '') AS recorded_by_name
         FROM weight_history wh LEFT JOIN users u ON u.id = wh.recorded_by
        WHERE ${where.join(' AND ')}
        ORDER BY wh.recorded_at DESC
        LIMIT $${params.length}`,
      params
    );
    return r.rows.map((x: any) => this.map(x));
  }

  map(x: any): MeasurementRow {
    const weight = x.weight === null || x.weight === undefined ? null : Number(x.weight);
    const bcs = x.body_condition_score === null || x.body_condition_score === undefined ? null : Number(x.body_condition_score);
    const scale = x.bcs_scale ? (Number(x.bcs_scale) as 5 | 9) : null;
    return {
      id: x.id, animalId: x.animal_id, weight, unit: x.unit || 'kg', weightKg: toKg(weight, x.unit),
      bodyConditionScore: bcs, bcsScale: scale, bcs9: bcs === null || !scale ? null : toNinePoint(bcs, scale),
      muscleCondition: x.muscle_condition || null, source: x.source || 'medical_record', notes: x.notes || null,
      recordedAt: x.recorded_at instanceof Date ? x.recorded_at.toISOString() : String(x.recorded_at),
      recordedBy: x.recorded_by || null, recordedByName: x.recorded_by_name || '',
    };
  }
}

export default new BodyMeasurementService();
