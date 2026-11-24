import WithdrawalService from './withdrawal/WithdrawalService';
import database from '../utils/database';
import { ValidationError } from '../utils/errors';
import FarmProfileService from './FarmProfileService';
import FarmRecordService from './FarmRecordService';
import BatchManagementService, { PopulationEventType } from './BatchManagementService';
import BreedingService from './BreedingService';
import AnimalService from './AnimalService';
import AnimalGroupService from './AnimalGroupService';
import MedicalRecordService from './MedicalRecordService';
import NutritionService from './nutrition/NutritionService';

/**
 * Farm EVENTS on a batch group - placing a flock, stocking a pond, culling, a partial sale or
 * harvest, clearing out. An event is not a daily record: it changes how many animals a group has,
 * and that number has exactly one owner, the population ledger (BatchManagementService). So this
 * service never writes a count itself; it translates the farmer's words into ledger entries and
 * cycle changes, and nothing else.
 *
 * Whether an event applies to a group is the farm profile engine's answer (the record type's
 * rules in master data), exactly as for daily records; this table only says what each applicable
 * event DOES to the ledger. A record type that is not in the table cannot be recorded here yet
 * (breeding events, treatments etc. already have their own sources of truth).
 *
 * Keep GROUP_EVENT_CODES in frontend/src/components/farmRecords/recordShared.ts in step with this table.
 */
interface EventAction {
  ledger: PopulationEventType;
  /** Where the number of animals comes from: the record's quantity, or its own `count` field. */
  countFrom: 'quantity' | 'count';
  /** Starts a cycle when the group has none open (placing a new batch). */
  opensCycle?: boolean;
  /** Ends the cycle after the animals leave (clear-out, final harvest). */
  closesCycle?: boolean;
}

export const GROUP_EVENT_ACTIONS: Record<string, EventAction> = {
  placement:       { ledger: 'placement', countFrom: 'quantity', opensCycle: true },
  stocking:        { ledger: 'placement', countFrom: 'quantity', opensCycle: true },
  cull:            { ledger: 'cull',      countFrom: 'quantity' },
  partial_sale:    { ledger: 'sale',      countFrom: 'quantity' },
  clear_out:       { ledger: 'sale',      countFrom: 'quantity', closesCycle: true },
  // Harvest quantity is weight; the population only changes by how many animals were taken out.
  partial_harvest: { ledger: 'sale',      countFrom: 'count' },
  harvest:         { ledger: 'sale',      countFrom: 'count', closesCycle: true },
};

interface Caller { userId: string; role?: string }

/**
 * What each event on ONE animal does, and which source of truth it writes through. Breeding events
 * go through BreedingService (which maps record status onto the animal's own vocabulary and counts
 * a birth once); a weight through the weight history; status changes touch the animal row only.
 * A record type not listed here is not recordable as an animal event yet (treatments and
 * vaccinations have their own screens; weaning, shearing and purchases come later).
 */
export const ANIMAL_EVENT_CODES = ['heat', 'insemination', 'pregnancy_check', 'birth', 'dry_off', 'weight', 'sale', 'death'];

export interface GroupEventInput {
  groupId?: string;
  animalId?: string;
  eventType: string;
  eventDate?: string;
  quantity?: number | string | null;
  detail?: Record<string, unknown> | null;
  notes?: string | null;
  /** Birth only: the newborns to add to the herd as animals (the farmer chose to). */
  offspring?: Array<{ name?: string; gender?: string }> | null;
  /** The person saw the withdrawal warning and chose to record it anyway. */
  confirmWithdrawal?: boolean;
}

class FarmEventService {

  /** One entry point: the body names a group (head-count events) or an animal (individual events). */
  async recordEvent(input: GroupEventInput, caller: Caller): Promise<any> {
    if (!!input.groupId === !!input.animalId) throw new ValidationError('An event is about one animal or one group - choose which.');
    return input.groupId ? this.recordGroupEvent(input, caller) : this.recordAnimalEvent(input, caller);
  }

  async recordAnimalEvent(input: GroupEventInput, caller: Caller): Promise<any> {
    if (!ANIMAL_EVENT_CODES.includes(input.eventType)) {
      throw new ValidationError(`'${input.eventType}' cannot be recorded here. Choose one of: ${ANIMAL_EVENT_CODES.join(', ')}.`);
    }
    const subject = await FarmRecordService.loadSubject({ animalId: input.animalId }, caller, true);
    const eventDate = FarmRecordService.checkDate(input.eventDate);
    const rt = await FarmRecordService.loadRecordType(input.eventType, 'event');
    await FarmProfileService.assertRecordTypeAllowed({
      speciesCode: subject.speciesCode, animalClass: subject.animalClass, gender: subject.gender,
      managementMode: 'individual', groupType: subject.groupType,
    }, rt.code, 'animal');
    const { quantity, detail } = FarmRecordService.shape(rt.fields, { recordType: rt.code, quantity: input.quantity, detail: input.detail });
    // A sale or a death of an animal still under a meat withdrawal: say so, and record it only when the person confirms.
    if (rt.code === 'sale' || rt.code === 'death') await WithdrawalService.guard({ animalId: subject.id }, 'meat', input.confirmWithdrawal);

    const st = await database.query(`SELECT status, group_id FROM animals WHERE id = $1`, [subject.id]);
    const status: string = st.rows[0]?.status || 'active';
    const groupId: string | null = st.rows[0]?.group_id || null;
    if (status === 'sold' || status === 'deceased') {
      throw new ValidationError(`This animal is already marked as ${status}, so nothing more can be recorded for it.`);
    }

    const base = { recordType: rt.code, animalId: subject.id, eventDate };
    switch (rt.code) {
      case 'heat':
        // An observation, not a change to anything else: one a day.
        await FarmRecordService.save({ animalId: subject.id, recordType: 'heat', recordDate: eventDate, notes: input.notes }, caller, 'event');
        return base;

      case 'insemination': {
        const rec = await BreedingService.create({
          enterpriseId: subject.enterpriseId, damId: subject.id, species: subject.speciesCode,
          breedingMethod: (detail.method as string) || 'natural', breedingDate: eventDate, status: 'bred', notes: input.notes || null,
        });
        return { ...base, breedingRecordId: rec.id, expectedDueDate: rec.expectedDueDate ?? null };
      }

      case 'pregnancy_check': {
        const open = await this.openBreedingRecord(subject.id, ['bred']);
        if (!open) throw new ValidationError('No mating is recorded for this animal. Record the mating first, then the pregnancy check.');
        const pregnant = detail.result === 'pregnant';
        const rec = await BreedingService.update(open.id, {
          status: pregnant ? 'confirmed_pregnant' : 'not_pregnant', pregnancyConfirmed: pregnant, pregnancyCheckDate: eventDate,
        });
        return { ...base, breedingRecordId: open.id, result: detail.result, expectedDueDate: rec.expectedDueDate ?? null };
      }

      case 'birth': {
        // A birth entered twice (a retry after a slow connection) must not count twice.
        const dup = await database.query(
          `SELECT 1 FROM breeding_records WHERE dam_id = $1 AND status = 'delivered' AND actual_birth_date = $2::date
              AND updated_at > NOW() - INTERVAL '1 day' LIMIT 1`, [subject.id, eventDate]);
        if (dup.rows.length) throw new ValidationError('A birth for this animal on that day is already recorded.');
        let open = await this.openBreedingRecord(subject.id, ['bred', 'confirmed_pregnant']);
        if (!open) {
          // A birth without a recorded mating (bought in pregnant, mating not written down): the
          // date of the mating is unknown, so the birth date stands in for it.
          const created = await BreedingService.create({
            enterpriseId: subject.enterpriseId, damId: subject.id, species: subject.speciesCode,
            breedingMethod: 'natural', breedingDate: eventDate, status: 'bred', notes: 'Created from a birth entry (no mating recorded)',
          });
          open = { id: created.id };
        }
        const live = Math.round(Number(detail.liveBirths ?? 0));
        const still = Math.round(Number(detail.stillbirths ?? 0));
        await BreedingService.update(open.id, {
          status: 'delivered', actualBirthDate: eventDate, liveBirths: live, stillbirths: still, offspringCount: live + still, notes: input.notes,
        });
        const calves = await this.addNewborns(subject, open.id, eventDate, live, input.offspring || [], caller);
        return { ...base, breedingRecordId: open.id, liveBirths: live, stillbirths: still, newborns: calves };
      }

      case 'dry_off':
        await AnimalService.updateAnimal(subject.id, { dryOffDate: eventDate });
        return base;

      case 'weight': {
        const w = Number(detail.weight ?? quantity);
        if (!Number.isFinite(w) || w <= 0) throw new ValidationError('Enter the weight, above zero.');
        await MedicalRecordService.addWeight(subject.id, w, 'kg', caller.userId, input.notes || undefined);
        return { ...base, weight: w };
      }

      case 'sale':
      case 'death': {
        const newStatus = rt.code === 'sale' ? 'sold' : 'deceased';
        const note = [rt.code === 'sale' ? 'Sold' : 'Died', eventDate, detail.amount ? `amount ${detail.amount}` : '', detail.buyer ? `to ${detail.buyer}` : '',
          detail.cause ? `cause: ${detail.cause}` : '', input.notes || ''].filter(Boolean).join(' - ');
        await database.query(
          `UPDATE animals SET status = $1, medical_notes = CASE WHEN COALESCE(medical_notes, '') = '' THEN $2 ELSE medical_notes || chr(10) || $2 END, updated_at = NOW() WHERE id = $3`,
          [newStatus, note, subject.id]
        );
        // It leaves its group, which keeps the group's head count honest.
        if (groupId) await AnimalGroupService.removeAnimal(groupId, subject.id);
        // A sold or dead animal has no feeding plan to follow and raises no alerts: close them now, not at the next check.
        await NutritionService.evaluateFlags(subject.id).catch(() => undefined);
        return { ...base, status: newStatus };
      }
    }
    throw new ValidationError(`'${rt.code}' cannot be recorded here.`);
  }

  /**
   * The newborns the farmer chose to add: each becomes an animal on the same farm, with the dam (and the
   * mating's sire) recorded, born on the birth date. Never more than were born alive. The farmer names them
   * and may leave it blank - then it is "<dam> calf 1" style; the class is left for the farmer to set.
   */
  private async addNewborns(subject: { id: string; enterpriseId: string; speciesCode: string | null }, breedingRecordId: string,
    eventDate: string, liveBirths: number, wanted: Array<{ name?: string; gender?: string }>, caller: Caller): Promise<Array<{ id: string; name: string }>> {
    const list = wanted.slice(0, Math.min(liveBirths, 10));
    if (list.length === 0) return [];
    const dam = await database.query(`SELECT owner_id, name, breed FROM animals WHERE id = $1`, [subject.id]);
    const sire = await database.query(`SELECT sire_id FROM breeding_records WHERE id = $1`, [breedingRecordId]);
    const created: Array<{ id: string; name: string }> = [];
    for (let i = 0; i < list.length; i++) {
      const name = (list[i].name || '').trim().slice(0, 100) || `${dam.rows[0]?.name || 'Newborn'} calf ${i + 1}`;
      const gender = ['male', 'female'].includes(String(list[i].gender)) ? String(list[i].gender) : 'unknown';
      const a = await AnimalService.createAnimal(dam.rows[0]?.owner_id || caller.userId, {
        name, species: subject.speciesCode || '', breed: dam.rows[0]?.breed || undefined, gender, dateOfBirth: eventDate,
        enterpriseId: subject.enterpriseId, damId: subject.id, sireId: sire.rows[0]?.sire_id || undefined,
      } as any);
      created.push({ id: a.id, name: a.name });
    }
    return created;
  }

  /** The animal's most recent breeding record that is still in one of these states. */
  private async openBreedingRecord(damId: string, statuses: string[]): Promise<{ id: string } | null> {
    const r = await database.query(
      `SELECT id FROM breeding_records WHERE dam_id = $1 AND status = ANY($2::text[]) ORDER BY breeding_date DESC, created_at DESC LIMIT 1`,
      [damId, statuses]
    );
    return r.rows[0] ? { id: r.rows[0].id } : null;
  }

  async recordGroupEvent(input: GroupEventInput, caller: Caller): Promise<any> {
    const action = GROUP_EVENT_ACTIONS[input.eventType];
    if (!action) {
      throw new ValidationError(`'${input.eventType}' cannot be recorded here. Choose one of: ${Object.keys(GROUP_EVENT_ACTIONS).join(', ')}.`);
    }
    const subject = await FarmRecordService.loadSubject({ groupId: input.groupId }, caller, true);
    if (subject.managementMode !== 'batch') {
      throw new ValidationError('This group is kept animal by animal, so it has no head count to change. Use the animal records instead.');
    }
    // Animals leaving a herd for sale or cull while the herd is under a meat withdrawal: warn and confirm.
    if (action.ledger === 'sale' || action.ledger === 'cull') await WithdrawalService.guard({ groupId: subject.id }, 'meat', input.confirmWithdrawal);
    const eventDate = FarmRecordService.checkDate(input.eventDate);
    const rt = await FarmRecordService.loadRecordType(input.eventType, 'event');
    await FarmProfileService.assertRecordTypeAllowed({
      speciesCode: subject.speciesCode, animalClass: null, gender: null,
      managementMode: subject.managementMode, groupType: subject.groupType,
    }, rt.code, 'group');

    const { quantity, detail } = FarmRecordService.shape(rt.fields, { recordType: rt.code, quantity: input.quantity, detail: input.detail });
    const raw = action.countFrom === 'quantity' ? quantity : (detail.count as number | undefined);
    const count = Math.round(Number(raw ?? 0));
    if (!Number.isFinite(count) || count < 0) throw new ValidationError('The number of animals must be zero or more.');
    if (count === 0 && !action.closesCycle) {
      throw new ValidationError(action.countFrom === 'count'
        ? 'How many animals were taken out? The group\'s head count needs that number.'
        : 'How many animals? Enter a number above zero.');
    }

    const reason = [
      rt.code.replace(/_/g, ' '),
      action.countFrom === 'count' && quantity ? `${quantity}${rt.unit ? ` ${rt.unit}` : ''}` : '',
      detail.amount ? `amount ${detail.amount}` : '', detail.buyer ? `to ${detail.buyer}` : '',
      detail.source ? `from ${detail.source}` : '', detail.seedSource ? `from ${detail.seedSource}` : '',
      detail.reason ? String(detail.reason) : '', input.notes ? String(input.notes).trim().slice(0, 500) : '',
    ].filter(Boolean).join(' - ');
    const sourceRef = `event:${rt.code}`;

    let cycleOpened = false;
    let cycleClosed = false;
    let cycleId: string | null = subject.cycleId;

    if (action.opensCycle) {
      if (cycleId) {
        await BatchManagementService.recordPopulationEvent({ groupId: subject.id, cycleId, eventType: action.ledger, quantity: count, eventDate, reason, sourceRef, userId: caller.userId });
      } else {
        const cycle: any = await BatchManagementService.openCycle({
          groupId: subject.id, species: subject.speciesCode || undefined, placedCount: count, startedAt: eventDate, notes: reason, userId: caller.userId,
          ageAtPlacementDays: detail.ageAtPlacementDays as number | undefined,
        });
        cycleId = cycle?.id ?? null;
        cycleOpened = true;
      }
    } else {
      if (!cycleId && action.closesCycle) throw new ValidationError('This group has no open batch to close.');
      if (count > 0) {
        await BatchManagementService.recordPopulationEvent({ groupId: subject.id, cycleId, eventType: action.ledger, quantity: count, eventDate, reason, sourceRef, userId: caller.userId });
      }
      if (action.closesCycle && cycleId) {
        // The animals that were sold are already out; whatever is left leaves with the batch, as
        // the ledger's own close does. If this step fails the sale stays recorded and the batch
        // can be closed again.
        await BatchManagementService.closeCycle(cycleId, caller.userId, reason || 'Batch closed');
        cycleClosed = true;
      }
    }

    const left = await database.query(`SELECT current_count FROM animal_groups WHERE id = $1`, [subject.id]);
    return {
      recordType: rt.code, groupId: subject.id, cycleId, cycleOpened, cycleClosed,
      ledgerType: action.ledger, count, currentCount: left.rows[0] ? Number(left.rows[0].current_count) : null, eventDate,
    };
  }
}

export default new FarmEventService();
