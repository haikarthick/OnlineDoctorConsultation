import database from '../utils/database';
import { ValidationError } from '../utils/errors';
import FarmProfileService from './FarmProfileService';
import FarmRecordService from './FarmRecordService';
import BatchManagementService, { PopulationEventType } from './BatchManagementService';

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

export interface GroupEventInput {
  groupId: string;
  eventType: string;
  eventDate?: string;
  quantity?: number | string | null;
  detail?: Record<string, unknown> | null;
  notes?: string | null;
}

class FarmEventService {

  async recordGroupEvent(input: GroupEventInput, caller: Caller): Promise<any> {
    const action = GROUP_EVENT_ACTIONS[input.eventType];
    if (!action) {
      throw new ValidationError(`'${input.eventType}' cannot be recorded here. Choose one of: ${Object.keys(GROUP_EVENT_ACTIONS).join(', ')}.`);
    }
    const subject = await FarmRecordService.loadSubject({ groupId: input.groupId }, caller, true);
    if (subject.managementMode !== 'batch') {
      throw new ValidationError('This group is kept animal by animal, so it has no head count to change. Use the animal records instead.');
    }
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
