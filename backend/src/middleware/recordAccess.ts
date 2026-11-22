import { Response, NextFunction } from 'express';
import database from '../utils/database';
import { AuthRequest } from './auth';
import AnimalAccessService, { ANIMAL_NO_ACCESS_MESSAGE, ANIMAL_READ_ONLY_MESSAGE } from '../services/AnimalAccessService';
import { checkAnimalAccess } from './hospitalDataIsolation';

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
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return next(); // the handler answers "not found"
    const r = await database.query(
      `SELECT ${cols.animal} AS animal_id${cols.group ? `, ${cols.group} AS group_id` : ''} FROM ${table} WHERE id = $1`, [id]
    );
    const row = r.rows[0];
    if (!row) return next();
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
