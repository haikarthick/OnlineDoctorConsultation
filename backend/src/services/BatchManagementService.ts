import database from '../utils/database';
import logger from '../utils/logger';
import { DatabaseError, ValidationError, NotFoundError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';

/**
 * Batch (flock/herd) management.
 *
 * A health event has ONE subject: an animal OR a group - never both, never a fan-out. Treating a
 * 5,000-bird flock writes one row, not 5,000. See docs/BATCH_ANIMAL_MANAGEMENT_PLAN.md.
 *
 * Three responsibilities live here:
 *   1. Production cycles - a batch group is a shed; the population inside it is a cycle.
 *   2. The population ledger - EVERY headcount change goes through recordPopulationEvent(), so
 *      current_count is always explainable and is never written to directly from anywhere else.
 *   3. Lifetime history - an animal promoted out of a batch keeps that history by MEMBERSHIP,
 *      not by copying rows. getAnimalLifetimeHistory() composes it at read time.
 */

export type PopulationEventType =
  | 'placement' | 'hatch' | 'mortality' | 'cull' | 'sale'
  | 'transfer_in' | 'transfer_out' | 'promotion' | 'adjustment';

/** Events that REMOVE animals. Their quantity is stored negative. */
const NEGATIVE_EVENTS: PopulationEventType[] = ['mortality', 'cull', 'sale', 'transfer_out', 'promotion'];

export class BatchManagementService {

  // ═══ CYCLES ════════════════════════════════════════════════════════════════

  /**
   * Open a cycle and place the initial population, in ONE transaction. Placement is written to
   * the ledger like any other population change - opening a cycle is not a special case that
   * gets to set a count directly.
   */
  async openCycle(data: {
    groupId: string; name?: string; species?: string; breed?: string;
    placedCount: number; startedAt?: string; notes?: string; userId: string;
  }) {
    if (!Number.isInteger(data.placedCount) || data.placedCount < 0) {
      throw new ValidationError('placedCount must be a non-negative whole number');
    }
    try {
      // The id is returned from the transaction and re-read AFTER commit: getCycle() goes
      // through the pool, so reading it inside would not see the uncommitted rows.
      const newId: string = await database.transaction(async (client: any) => {
      const grp = await client.query(
        `SELECT id, management_mode FROM animal_groups WHERE id = $1 FOR UPDATE`, [data.groupId]
      );
      if (!grp.rows.length) throw new NotFoundError('Animal group not found');
      if (grp.rows[0].management_mode !== 'batch') {
        throw new ValidationError('Cycles apply to batch-managed groups only. Switch the group to batch mode first.');
      }

      // The partial unique index enforces this too; checking here gives a usable message
      // instead of a constraint violation.
      const open = await client.query(
        `SELECT id FROM group_cycles WHERE group_id = $1 AND status = 'active'`, [data.groupId]
      );
      if (open.rows.length) {
        throw new ValidationError('This group already has an open cycle. Close it before placing a new batch.');
      }

      const nextNumber = await client.query(
        `SELECT COALESCE(MAX(cycle_number), 0) + 1 AS n FROM group_cycles WHERE group_id = $1`, [data.groupId]
      );
      const cycleId = uuidv4();
      await client.query(
        `INSERT INTO group_cycles (id, group_id, cycle_number, name, species, breed,
                                   placed_count, current_count, started_at, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7,COALESCE($8::date, CURRENT_DATE),$9,$10)`,
        [cycleId, data.groupId, nextNumber.rows[0].n, data.name || null, data.species || null,
         data.breed || null, data.placedCount, data.startedAt || null, data.notes || null, data.userId]
      );

      if (data.placedCount > 0) {
        await client.query(
          `INSERT INTO group_population_events (group_id, cycle_id, event_type, quantity, event_date, reason, recorded_by)
           VALUES ($1,$2,'placement',$3,COALESCE($4::date, CURRENT_DATE),$5,$6)`,
          [data.groupId, cycleId, data.placedCount, data.startedAt || null, 'Cycle opened', data.userId]
        );
        await client.query(
          `UPDATE animal_groups SET current_count = current_count + $1, updated_at = NOW() WHERE id = $2`,
          [data.placedCount, data.groupId]
        );
      }

      logger.info('Batch cycle opened', { cycleId, groupId: data.groupId, placed: data.placedCount });
      return cycleId;
      });
      return await this.getCycle(newId);
    } catch (err: any) {
      if (err instanceof ValidationError || err instanceof NotFoundError) throw err;
      throw new DatabaseError('Error opening cycle', { originalError: err.message });
    }
  }

  /**
   * Close a cycle. The remaining population leaves the group, so it is written to the ledger as
   * a transfer_out rather than silently zeroed - a count that changes with no event behind it is
   * exactly what the ledger exists to prevent.
   */
  async closeCycle(cycleId: string, userId: string, reason?: string) {
    try {
      await database.transaction(async (client: any) => {
      const cyc = await client.query(
        `SELECT id, group_id, current_count, status FROM group_cycles WHERE id = $1 FOR UPDATE`, [cycleId]
      );
      if (!cyc.rows.length) throw new NotFoundError('Cycle not found');
      const cycle = cyc.rows[0];
      if (cycle.status === 'closed') throw new ValidationError('This cycle is already closed');

      const remaining = Number(cycle.current_count);
      if (remaining > 0) {
        await client.query(
          `INSERT INTO group_population_events (group_id, cycle_id, event_type, quantity, event_date, reason, recorded_by)
           VALUES ($1,$2,'transfer_out',$3,CURRENT_DATE,$4,$5)`,
          [cycle.group_id, cycleId, -remaining, reason || 'Cycle closed', userId]
        );
        await client.query(
          `UPDATE animal_groups SET current_count = GREATEST(current_count - $1, 0), updated_at = NOW() WHERE id = $2`,
          [remaining, cycle.group_id]
        );
      }

      await client.query(
        `UPDATE group_cycles SET status = 'closed', ended_at = CURRENT_DATE, current_count = 0, updated_at = NOW()
          WHERE id = $1`, [cycleId]
      );
      // Everyone still in the batch stops being a member when the population leaves.
      await client.query(
        `UPDATE animal_group_memberships SET left_at = CURRENT_DATE, exit_reason = 'cycle_closed'
          WHERE cycle_id = $1 AND left_at IS NULL`, [cycleId]
      );

      logger.info('Batch cycle closed', { cycleId, released: remaining });
      });
      return await this.getCycle(cycleId);
    } catch (err: any) {
      if (err instanceof ValidationError || err instanceof NotFoundError) throw err;
      throw new DatabaseError('Error closing cycle', { originalError: err.message });
    }
  }

  async getCycle(cycleId: string) {
    const r = await database.query(
      `SELECT gc.*, ag.name AS group_name, ag.enterprise_id
         FROM group_cycles gc JOIN animal_groups ag ON ag.id = gc.group_id
        WHERE gc.id = $1`, [cycleId]
    );
    if (!r.rows.length) throw new NotFoundError('Cycle not found');
    return this.mapCycle(r.rows[0]);
  }

  async listCycles(groupId: string) {
    const r = await database.query(
      `SELECT gc.*, ag.name AS group_name, ag.enterprise_id
         FROM group_cycles gc JOIN animal_groups ag ON ag.id = gc.group_id
        WHERE gc.group_id = $1 ORDER BY gc.cycle_number DESC`, [groupId]
    );
    return r.rows.map((row: any) => this.mapCycle(row));
  }

  async getActiveCycle(groupId: string) {
    const r = await database.query(
      `SELECT gc.*, ag.name AS group_name, ag.enterprise_id
         FROM group_cycles gc JOIN animal_groups ag ON ag.id = gc.group_id
        WHERE gc.group_id = $1 AND gc.status = 'active' LIMIT 1`, [groupId]
    );
    return r.rows.length ? this.mapCycle(r.rows[0]) : null;
  }

  private mapCycle(row: any) {
    return {
      id: row.id, groupId: row.group_id, groupName: row.group_name,
      enterpriseId: row.enterprise_id, cycleNumber: row.cycle_number, name: row.name,
      species: row.species, breed: row.breed,
      placedCount: Number(row.placed_count), currentCount: Number(row.current_count),
      startedAt: row.started_at, endedAt: row.ended_at, status: row.status, notes: row.notes,
    };
  }

  // ═══ POPULATION LEDGER ═════════════════════════════════════════════════════

  /**
   * The ONLY way a group's headcount changes. Mortality is not a special case - placement,
   * hatch, cull, sale and transfers all come through here, which is what keeps current_count
   * explainable instead of drifting.
   *
   * `quantity` is supplied as a magnitude; the sign is derived from the event type so a caller
   * cannot accidentally add animals by recording a death.
   */
  async recordPopulationEvent(data: {
    groupId: string; cycleId?: string | null; eventType: PopulationEventType;
    quantity: number; eventDate?: string; reason?: string; sourceRef?: string; userId: string;
  }) {
    if (!Number.isInteger(data.quantity) || data.quantity === 0) {
      throw new ValidationError('quantity must be a non-zero whole number');
    }
    const magnitude = Math.abs(data.quantity);
    const signed = NEGATIVE_EVENTS.includes(data.eventType) ? -magnitude
                 : data.eventType === 'adjustment' ? data.quantity
                 : magnitude;

    try {
      return await database.transaction(async (client: any) => {
      const grp = await client.query(
        `SELECT id, current_count FROM animal_groups WHERE id = $1 FOR UPDATE`, [data.groupId]
      );
      if (!grp.rows.length) throw new NotFoundError('Animal group not found');

      let cycleId = data.cycleId ?? null;
      if (!cycleId) {
        const active = await client.query(
          `SELECT id FROM group_cycles WHERE group_id = $1 AND status = 'active' LIMIT 1`, [data.groupId]
        );
        cycleId = active.rows.length ? active.rows[0].id : null;
      }

      // Refuse to remove more than exist rather than clamping: a mortality of 200 against a
      // flock of 150 is a data-entry error, and silently recording 150 would hide it.
      if (signed < 0 && Number(grp.rows[0].current_count) + signed < 0) {
        throw new ValidationError(
          `Cannot remove ${magnitude} - the group only has ${grp.rows[0].current_count}.`
        );
      }

      await client.query(
        `INSERT INTO group_population_events
           (group_id, cycle_id, event_type, quantity, event_date, reason, source_ref, recorded_by)
         VALUES ($1,$2,$3,$4,COALESCE($5::date, CURRENT_DATE),$6,$7,$8)`,
        [data.groupId, cycleId, data.eventType, signed, data.eventDate || null,
         data.reason || null, data.sourceRef || null, data.userId]
      );

      await client.query(
        `UPDATE animal_groups SET current_count = current_count + $1, updated_at = NOW() WHERE id = $2`,
        [signed, data.groupId]
      );
      if (cycleId) {
        await client.query(
          `UPDATE group_cycles SET current_count = GREATEST(current_count + $1, 0), updated_at = NOW() WHERE id = $2`,
          [signed, cycleId]
        );
      }

      logger.info('Population event recorded', { groupId: data.groupId, type: data.eventType, signed });
      return { groupId: data.groupId, cycleId, eventType: data.eventType, quantity: signed };
      });
    } catch (err: any) {
      if (err instanceof ValidationError || err instanceof NotFoundError) throw err;
      throw new DatabaseError('Error recording population event', { originalError: err.message });
    }
  }

  async listPopulationEvents(groupId: string, cycleId?: string) {
    const params: any[] = [groupId];
    let where = 'gpe.group_id = $1';
    if (cycleId) { params.push(cycleId); where += ` AND gpe.cycle_id = $${params.length}`; }
    const r = await database.query(
      `SELECT gpe.*, u.first_name, u.last_name
         FROM group_population_events gpe
         LEFT JOIN users u ON u.id = gpe.recorded_by
        WHERE ${where}
        ORDER BY gpe.event_date DESC, gpe.created_at DESC
        LIMIT 500`, params
    );
    return r.rows.map((row: any) => ({
      id: row.id, groupId: row.group_id, cycleId: row.cycle_id, eventType: row.event_type,
      quantity: Number(row.quantity), eventDate: row.event_date, reason: row.reason,
      sourceRef: row.source_ref,
      recordedBy: row.first_name ? `${row.first_name} ${row.last_name}` : null,
    }));
  }

  /** Proves the stored count still equals the sum of its ledger. Surfaced for audit. */
  async reconcile(groupId: string) {
    const r = await database.query(
      `SELECT ag.current_count AS stored,
              COALESCE((SELECT SUM(quantity) FROM group_population_events WHERE group_id = ag.id), 0) AS from_ledger
         FROM animal_groups ag WHERE ag.id = $1`, [groupId]
    );
    if (!r.rows.length) throw new NotFoundError('Animal group not found');
    const stored = Number(r.rows[0].stored);
    const fromLedger = Number(r.rows[0].from_ledger);
    return { groupId, stored, fromLedger, reconciles: stored === fromLedger, drift: stored - fromLedger };
  }

  // ═══ WITHDRAWAL ════════════════════════════════════════════════════════════

  /**
   * Is this subject under a milk or meat withdrawal right now?
   * Consulted before movement and before issuing slaughter/export certificates (Phase 2).
   */
  async getWithdrawalStatus(subject: { animalId?: string; groupId?: string }) {
    const col = subject.groupId ? 'group_id' : 'animal_id';
    const id = subject.groupId || subject.animalId;
    if (!id) throw new ValidationError('An animalId or groupId is required');

    const r = await database.query(
      `SELECT MAX(withdrawal_until_milk) AS milk, MAX(withdrawal_until_meat) AS meat
         FROM medical_records
        WHERE ${col} = $1
          AND (withdrawal_until_milk >= CURRENT_DATE OR withdrawal_until_meat >= CURRENT_DATE)`,
      [id]
    );
    const milk = r.rows[0]?.milk || null;
    const meat = r.rows[0]?.meat || null;
    return {
      milkUntil: milk, meatUntil: meat,
      milkActive: !!milk, meatActive: !!meat,
      active: !!milk || !!meat,
    };
  }

  /**
   * Refuse an action that would put treated animals into the food chain before their withdrawal
   * period has run.
   *
   * `kind` picks which withdrawal applies: slaughter and meat export are governed by the MEAT
   * period, milk collection by the MILK period, and a general movement by either - an animal
   * still under any withdrawal should not leave the holding unannounced.
   *
   * This is the point of Phase 1 recording the dates: without an interlock the obligation is
   * merely written down, and a batch treatment that never reaches the movement and certificate
   * paths is a food-safety hole rather than a feature.
   */
  async assertNotUnderWithdrawal(
    subject: { animalId?: string; groupId?: string },
    kind: 'meat' | 'milk' | 'any' = 'any',
  ): Promise<void> {
    if (!subject.animalId && !subject.groupId) return;
    const status = await this.getWithdrawalStatus(subject);

    const blockingMeat = (kind === 'meat' || kind === 'any') && status.meatActive;
    const blockingMilk = (kind === 'milk' || kind === 'any') && status.milkActive;
    if (!blockingMeat && !blockingMilk) return;

    const until = blockingMeat ? status.meatUntil : status.milkUntil;
    const what = blockingMeat ? 'meat' : 'milk';
    const on = until ? new Date(until).toISOString().slice(0, 10) : 'an unknown date';
    throw new ValidationError(
      `Blocked: this ${subject.groupId ? 'group' : 'animal'} is under a ${what} withdrawal period until ${on}. ` +
      `Treated animals must not enter the food chain before it ends.`
    );
  }

  /** treatment date + withdrawal days, or null when the medication declares none. */
  computeWithdrawalDates(eventDate: string, milkDays?: number | null, meatDays?: number | null) {
    const base = new Date(eventDate);
    const add = (days?: number | null) => {
      if (days == null || days <= 0) return null;
      const d = new Date(base);
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };
    return { withdrawalUntilMilk: add(milkDays), withdrawalUntilMeat: add(meatDays) };
  }

  // ═══ LIFETIME HISTORY ══════════════════════════════════════════════════════

  /**
   * An animal's full history: its own records PLUS the group records that applied while it was
   * a member of that cycle. Composed at read time from animal_group_memberships - nothing is
   * ever copied down, which is what keeps a 5,000-bird flock at one row per event while still
   * giving every bird a complete life story.
   */
  async getAnimalLifetimeHistory(animalId: string) {
    const r = await database.query(
      `SELECT 'own' AS source, mr.id, mr.record_type, mr.title, mr.content, mr.event_date,
              NULL::uuid AS group_id, NULL::text AS group_name, NULL::int AS head_count_treated
         FROM medical_records mr
        WHERE mr.animal_id = $1

        UNION ALL

       SELECT 'group' AS source, mr.id, mr.record_type, mr.title, mr.content, mr.event_date,
              mr.group_id, ag.name AS group_name, mr.head_count_treated
         FROM medical_records mr
         JOIN animal_group_memberships m
           ON m.cycle_id = mr.cycle_id
          AND m.animal_id = $1
          AND mr.event_date BETWEEN m.joined_at AND COALESCE(m.left_at, CURRENT_DATE)
         JOIN animal_groups ag ON ag.id = mr.group_id
        WHERE mr.group_id IS NOT NULL

        ORDER BY event_date DESC NULLS LAST`,
      [animalId]
    );
    return r.rows.map((row: any) => ({
      source: row.source, id: row.id, recordType: row.record_type, title: row.title,
      content: row.content, eventDate: row.event_date,
      groupId: row.group_id, groupName: row.group_name,
      headCountTreated: row.head_count_treated == null ? null : Number(row.head_count_treated),
    }));
  }

  /**
   * Move an animal out of a batch into individual tracking. One transaction: close the
   * membership window, decrement the population through the ledger, and stamp the animal's
   * origin so its provenance survives.
   */
  async promoteFromBatch(data: {
    animalId: string; groupId: string; cycleId?: string | null; userId: string; reason?: string;
  }) {
    try {
      return await database.transaction(async (client: any) => {
      let cycleId = data.cycleId ?? null;
      if (!cycleId) {
        const active = await client.query(
          `SELECT id FROM group_cycles WHERE group_id = $1 AND status = 'active' LIMIT 1`, [data.groupId]
        );
        cycleId = active.rows.length ? active.rows[0].id : null;
      }

      await client.query(
        `UPDATE animal_group_memberships
            SET left_at = CURRENT_DATE, exit_reason = 'promoted'
          WHERE animal_id = $1 AND group_id = $2 AND left_at IS NULL`,
        [data.animalId, data.groupId]
      );
      await client.query(
        `UPDATE animals SET origin_group_id = COALESCE(origin_group_id, $2),
                            origin_cycle_id = COALESCE(origin_cycle_id, $3),
                            updated_at = NOW()
          WHERE id = $1`,
        [data.animalId, data.groupId, cycleId]
      );
      await client.query(
        `INSERT INTO group_population_events
           (group_id, cycle_id, event_type, quantity, event_date, reason, source_ref, recorded_by)
         VALUES ($1,$2,'promotion',-1,CURRENT_DATE,$3,$4,$5)`,
        [data.groupId, cycleId, data.reason || 'Promoted to individual tracking',
         `animal:${data.animalId}`, data.userId]
      );
      await client.query(
        `UPDATE animal_groups SET current_count = GREATEST(current_count - 1, 0), updated_at = NOW() WHERE id = $1`,
        [data.groupId]
      );
      if (cycleId) {
        await client.query(
          `UPDATE group_cycles SET current_count = GREATEST(current_count - 1, 0), updated_at = NOW() WHERE id = $1`,
          [cycleId]
        );
      }
      logger.info('Animal promoted from batch', { animalId: data.animalId, groupId: data.groupId });
      return { animalId: data.animalId, groupId: data.groupId, cycleId };
      });
    } catch (err: any) {
      throw new DatabaseError('Error promoting animal from batch', { originalError: err.message });
    }
  }
}

export default new BatchManagementService();
