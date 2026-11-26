import { Response, NextFunction } from 'express';
import database from '../utils/database';
import { AuthRequest } from './auth';
import AnimalAccessService, { ANIMAL_NO_ACCESS_MESSAGE, ANIMAL_READ_ONLY_MESSAGE } from '../services/AnimalAccessService';
import { checkAnimalAccess } from './hospitalDataIsolation';
import FarmAccessService from '../services/FarmAccessService';
import { ForbiddenError } from '../utils/errors';

/**
 * Gate for routes that address ONE RECORD by its own id (PUT /allergies/:id, DELETE /vaccinations/:id ...).
 *
 * The record's animal (or group) is looked up from the record itself - never taken from the request body. Before
 * 2026-11-22, `PUT /allergies/:id` checked `body.animalId`: a caller could send their own animal's id and edit
 * someone else's allergy. Usage:
 *
 *   router.put('/allergies/:id', authMiddleware, requireRecordAccess('allergy_records'), ...)
 *
 * Only tables listed in RECORD_TABLES can be named, so a table name is never taken from input.
 */
const RECORD_TABLES = {
  allergy_records: { animal: 'animal_id', group: null },
  lab_results: { animal: 'animal_id', group: null },
  vaccination_records: { animal: 'animal_id', group: 'group_id' },
  medical_records: { animal: 'animal_id', group: 'group_id' },
  weight_history: { animal: 'animal_id', group: null },
  vaccine_schedule: { animal: 'animal_id', group: null },
  wellness_reminders: { animal: 'animal_id', group: null },
  prescriptions: { animal: 'animal_id', group: 'group_id' },
  self_treatments: { animal: 'animal_id', group: 'group_id' },
} as const;

export type RecordTable = keyof typeof RECORD_TABLES;

/**
 * Gate for routes that take an ANIMAL id (path, query or body): the one platform rule from AnimalAccessService.
 * Placed AFTER `requireAnimalAccess` (which keeps the hospital-private rule, unchanged), it closes the gap that
 * middleware leaves open: for a non-private animal it let every signed-in user through.
 *
 *   router.get('/weight-history/animal/:animalId', authMiddleware, requireAnimalAccess(...), requireAnimal('params:animalId'), ...)
 */
export function requireAnimal(source: 'params:animalId' | 'params:id' | 'query:animalId' | 'body:animalId' = 'params:animalId') {
  const [where, key] = source.split(':') as ['params' | 'query' | 'body', string];
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Please sign in again.' });
    const raw = where === 'params' ? req.params[key] : where === 'query' ? req.query[key] : req.body?.[key];
    const animalId = typeof raw === 'string' ? raw : '';
    if (!animalId) return next(); // nothing to check (e.g. a group subject); the handler validates its input
    const isolation = await checkAnimalAccess(userId, req.userRole || '', animalId);
    if (isolation.isPrivate) return next(); // private hospital animals: requireAnimalAccess already decided
    const mode = req.method === 'GET' || req.method === 'HEAD' ? 'read' : 'write';
    const a = await AnimalAccessService.check({ userId, role: req.userRole, roles: req.userRoles }, animalId, mode);
    if (a.found && !a.allowed) {
      const message = a.via ? ANIMAL_READ_ONLY_MESSAGE : ANIMAL_NO_ACCESS_MESSAGE;
      return res.status(403).json({ success: false, message, error: { message, code: 'ANIMAL_ACCESS_DENIED' } });
    }
    next();
  };
}

export function requireRecordAccess(table: RecordTable, idParam = 'id') {
  const cols = RECORD_TABLES[table];
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Please sign in again.' });
    const id = req.params[idParam];
    const isAdmin = req.userRole === 'admin' || (req.userRoles || []).includes('admin');
    // A missing record gets the SAME refusal as one that is not yours (never a different answer that reveals which ids exist);
    // only an admin is passed on so the handler can say "not found".
    const refuse = (res2: Response) => res2.status(403).json({ success: false, message: ANIMAL_NO_ACCESS_MESSAGE, error: { message: ANIMAL_NO_ACCESS_MESSAGE, code: 'RECORD_ACCESS_DENIED' } });
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return isAdmin ? next() : refuse(res);
    const r = await database.query(
      `SELECT ${cols.animal} AS animal_id${cols.group ? `, ${cols.group} AS group_id` : ''} FROM ${table} WHERE id = $1`, [id]
    );
    const row = r.rows[0];
    if (!row) return isAdmin ? next() : refuse(res);
    const mode = req.method === 'GET' || req.method === 'HEAD' ? 'read' : 'write';
    const user = { userId, role: req.userRole, roles: req.userRoles };

    let allowed = false;
    let readOnly = false;
    if (row.animal_id) {
      const isolation = await checkAnimalAccess(userId, req.userRole || '', row.animal_id);
      if (isolation.isPrivate) allowed = isolation.allowed;
      else {
        const a = await AnimalAccessService.check(user, row.animal_id, mode);
        allowed = a.allowed;
        readOnly = !a.allowed && !!a.via;
      }
    } else if (row.group_id) {
      const g = await AnimalAccessService.checkGroup(user, row.group_id, mode);
      allowed = g.allowed;
      readOnly = !g.allowed && !!g.via;
    }
    if (!allowed) {
      const message = readOnly ? ANIMAL_READ_ONLY_MESSAGE : ANIMAL_NO_ACCESS_MESSAGE;
      return res.status(403).json({ success: false, message, error: { message, code: 'RECORD_ACCESS_DENIED' } });
    }
    next();
  };
}

/**
 * Gate for routes that address ONE FARM RECORD by its own id (a sensor, a shift, a batch, a sustainability goal ...).
 * The record's own farm decides - never an id from the request. The farm rules are the ones every farm screen uses
 * (FarmAccessService): a viewer may look, not change; a farm vet / worker / supervisor / manager / owner may change.
 * A missing record and a record on someone else's farm get the SAME plain refusal, so ids cannot be probed.
 * Rows with no farm (built-in report templates) may be changed by an admin only.
 */
const FARM_RECORD_TABLES = [
  'iot_sensors', 'product_batches', 'workforce_tasks', 'shift_schedules', 'report_templates', 'digital_twins',
  'simulation_runs', 'sustainability_metrics', 'sustainability_goals', 'geofence_zones', 'genetic_profiles',
  'alert_rules', 'alert_events', 'disease_predictions', 'outbreak_zones', 'traceability_events', 'generated_reports',
] as const;
export type FarmRecordTable = typeof FARM_RECORD_TABLES[number];

export const FARM_RECORD_NO_ACCESS_MESSAGE =
  'We could not find that record on a farm you work with, so nothing was changed. Check that you are signed in to the right account, or ask the farm owner to add you to the farm.';

/**
 * The same farm rule for a route that names the farm itself (`/enterprises/:enterpriseId/...`): only people of that farm get in, a
 * viewer can look but not change, and a stranger gets the same plain refusal whether or not the farm exists.
 */
export function requireFarm(idParam = 'enterpriseId') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Please sign in again.' });
    const refuse = () => res.status(403).json({ success: false, message: FARM_RECORD_NO_ACCESS_MESSAGE, error: { message: FARM_RECORD_NO_ACCESS_MESSAGE, code: 'RECORD_ACCESS_DENIED' } });
    const isAdmin = req.userRole === 'admin' || (req.userRoles || []).includes('admin');
    const enterpriseId = req.params[idParam];
    if (!enterpriseId || !/^[0-9a-f-]{36}$/i.test(enterpriseId)) return isAdmin ? next() : refuse();
    const actor = { userId, role: req.userRole };
    if (!(await FarmAccessService.can(enterpriseId, actor, 'read'))) return refuse();
    try {
      await FarmAccessService.assert(enterpriseId, actor, FarmAccessService.actionForMethod(req.method));
    } catch (err: any) {
      if (err instanceof ForbiddenError) return res.status(403).json({ success: false, message: err.message, error: { message: err.message, code: 'FARM_ROLE_READ_ONLY' } });
      throw err;
    }
    next();
  };
}

export function requireFarmRecord(table: FarmRecordTable, idParam = 'id') {
  if (!(FARM_RECORD_TABLES as readonly string[]).includes(table)) throw new Error(`requireFarmRecord: unknown table ${table}`);
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Please sign in again.' });
    const refuse = () => res.status(403).json({ success: false, message: FARM_RECORD_NO_ACCESS_MESSAGE, error: { message: FARM_RECORD_NO_ACCESS_MESSAGE, code: 'RECORD_ACCESS_DENIED' } });
    const isAdmin = req.userRole === 'admin' || (req.userRoles || []).includes('admin');
    const id = req.params[idParam];
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return isAdmin ? next() : refuse();
    const r = await database.query(`SELECT enterprise_id FROM ${table} WHERE id = $1`, [id]);
    if (!r.rows[0]) return isAdmin ? next() : refuse();
    const enterpriseId: string | null = r.rows[0].enterprise_id;
    if (!enterpriseId) return isAdmin ? next() : refuse();
    const actor = { userId, role: req.userRole };
    if (!(await FarmAccessService.can(enterpriseId, actor, 'read'))) return refuse();
    try {
      await FarmAccessService.assert(enterpriseId, actor, FarmAccessService.actionForMethod(req.method));
    } catch (err: any) {
      if (err instanceof ForbiddenError) return res.status(403).json({ success: false, message: err.message, error: { message: err.message, code: 'FARM_ROLE_READ_ONLY' } });
      throw err;
    }
    next();
  };
}

/** Gate for an AI copilot chat addressed by id: only the person who had the chat may read, continue or delete it. */
export const CHAT_NO_ACCESS_MESSAGE =
  'We could not find that conversation in your history, so nothing was opened or changed. Start a new chat from the AI Copilot page.';

export function requireOwnChatSession(idParam = 'id') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Please sign in again.' });
    const refuse = () => res.status(403).json({ success: false, message: CHAT_NO_ACCESS_MESSAGE, error: { message: CHAT_NO_ACCESS_MESSAGE, code: 'RECORD_ACCESS_DENIED' } });
    const id = req.params[idParam];
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return refuse();
    const r = await database.query('SELECT user_id FROM ai_chat_sessions WHERE id = $1', [id]);
    if (!r.rows[0] || r.rows[0].user_id !== userId) return refuse();
    next();
  };
}
