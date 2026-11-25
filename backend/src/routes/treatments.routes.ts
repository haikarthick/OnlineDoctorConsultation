import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { authMiddleware, validateBody } from '../middleware/auth';
import { requireAnimal, requireRecordAccess } from '../middleware/recordAccess';
import { asyncHandler } from '../utils/errorHandler';
import { CodedError, ForbiddenError } from '../utils/errors';
import database from '../utils/database';
import FarmAccessService from '../services/FarmAccessService';
import AnimalAccessService, { ANIMAL_NO_ACCESS_MESSAGE } from '../services/AnimalAccessService';
import WithdrawalService from '../services/withdrawal/WithdrawalService';

/**
 * Treatments and withdrawal (docs/modules/withdrawal-ledger.md).
 *
 * A treatment is written ONCE, on the vet's prescription; "under withdrawal" and the farmer's "My medicines" are worked out
 * from it (WithdrawalService). A farmer who treated without a vet adds the same facts here. The platform ships no medicine
 * list: every figure is typed from the product label by the person responsible.
 */
const router = Router();
const who = (req: Request) => ({ userId: (req as any).userId as string, role: (req as any).userRole as string | undefined });

const selfTreatmentSchema = Joi.object({
  /** The phone's outbox id: sending the same entry again (the first answer was lost) never makes a second row. */
  id: Joi.string().uuid().optional(),
  animalId: Joi.string().uuid().allow(null, '').optional(),
  groupId: Joi.string().uuid().allow(null, '').optional(),
  // Missing values are refused by the service with a coded, translated sentence (WD_NAME_REQUIRED, WD_DAYS_REQUIRED,
  // WD_LABEL_DAYS_REQUIRED) - not by field-name text from the validator.
  medicineName: Joi.string().trim().max(255).allow('', null).optional(),
  treatmentDays: Joi.number().integer().min(1).max(365).allow('', null).optional(),
  withdrawalMilkDays: Joi.number().integer().min(0).max(365).allow('', null).optional(),
  withdrawalMeatDays: Joi.number().integer().min(0).max(365).allow('', null).optional(),
  startedOn: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null, '').optional(),
  note: Joi.string().max(500).allow('', null).optional(),
});

/**
 * Who may correct a course ("stopped early"): the people who run the animal's FARM (the same 'record' right as adding a
 * treatment), or the owner of a pet that is on no farm. A vet who is merely booked for the animal can read it but never edits the
 * farm's treatment record. Runs after requireRecordAccess (which proves the person can reach the record at all).
 */
async function assertMayCorrect(req: Request, table: 'prescriptions' | 'self_treatments'): Promise<void> {
  const row = await database.query(`SELECT animal_id, group_id FROM ${table} WHERE id = $1`, [req.params.id]);
  const r = row.rows[0];
  if (!r) throw new CodedError(404, 'WD_NOT_FOUND', 'We could not find this treatment. It may have been removed.');
  const subject = r.animal_id
    ? await database.query(`SELECT enterprise_id, owner_id FROM animals WHERE id = $1`, [r.animal_id])
    : await database.query(`SELECT g.enterprise_id, e.owner_id FROM animal_groups g LEFT JOIN enterprises e ON e.id = g.enterprise_id WHERE g.id = $1`, [r.group_id]);
  const s = subject.rows[0];
  if (!s) throw new CodedError(403, 'WD_TREATMENT_UNLINKED', 'This treatment is no longer linked to an animal or herd, so it cannot be changed here.');
  const actor = who(req);
  if (s.enterprise_id) {
    try { await FarmAccessService.assert(s.enterprise_id, actor, 'record'); } catch {
      throw new CodedError(403, 'WD_FARM_TEAM_ONLY', 'Only the people who run this farm can change its treatment record. Ask the farm owner or a manager to do it.');
    }
    return;
  }
  if (s.owner_id !== actor.userId && actor.role !== 'admin') {
    throw new CodedError(403, 'WD_ONLY_OWNER_EDITS', 'Only the owner of this animal can change its treatment record.');
  }
}

const courseSchema = Joi.object({
  /** The last day the medicine was given (YYYY-MM-DD); null puts the course back as prescribed. */
  lastDoseOn: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null).required(),
});

/** One animal: is it under a withdrawal, and (for the vet's form) whether label days are required for it. */
router.get('/animals/:animalId/withdrawal', authMiddleware, requireAnimal('params:animalId'), asyncHandler(async (req: Request, res: Response) => {
  const [status, foodProducing] = await Promise.all([
    WithdrawalService.status({ animalId: req.params.animalId }),
    WithdrawalService.isFoodProducing({ animalId: req.params.animalId }),
  ]);
  res.json({ success: true, data: { ...status, foodProducing } });
}));

/** What is under withdrawal on a farm now, and the farm's treatment history (prescriptions + the farmer's own entries). */
router.get('/enterprises/:enterpriseId/treatments', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  await FarmAccessService.assert(req.params.enterpriseId, who(req), 'read');
  const [underWithdrawal, history] = await Promise.all([
    WithdrawalService.listForFarm(req.params.enterpriseId),
    WithdrawalService.history(req.params.enterpriseId, Number(req.query.limit) || 60),
  ]);
  res.json({ success: true, data: { underWithdrawal, history } });
}));

/** Medicated-feed courses still running for one animal (shown on the Daily records feed entry). The animal's own gate decides. */
router.get('/treatments/animals/:animalId/feed-courses', authMiddleware, requireAnimal('params:animalId'), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await WithdrawalService.activeFeedCourses({ animalId: req.params.animalId }) });
}));

/** ...and for one herd: the platform rule for a group decides who may read it. */
router.get('/treatments/groups/:groupId/feed-courses', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const access = await AnimalAccessService.checkGroup({ userId: who(req).userId, role: who(req).role, roles: (req as any).userRoles }, req.params.groupId, 'read');
  if (!access.found) throw new CodedError(404, 'WD_GROUP_NOT_FOUND', 'We could not find this herd. It may have been removed.');
  if (!access.allowed) throw new ForbiddenError(ANIMAL_NO_ACCESS_MESSAGE);
  res.json({ success: true, data: await WithdrawalService.activeFeedCourses({ groupId: req.params.groupId }) });
}));

/** A farmer treated an animal or herd without a vet: the same facts, entered once, in the same history. */
router.post('/enterprises/:enterpriseId/treatments', authMiddleware, validateBody(selfTreatmentSchema), asyncHandler(async (req: Request, res: Response) => {
  await FarmAccessService.assert(req.params.enterpriseId, who(req), 'record');
  const created = await WithdrawalService.addSelfTreatment(req.params.enterpriseId, req.body, who(req).userId);
  res.status(201).json({ success: true, data: created });
}));

/** "Stopped early" / "last dose on": the farm corrects a prescription's course. The prescription's own animal or herd decides who may. */
router.patch('/treatments/prescriptions/:id/course', authMiddleware, requireRecordAccess('prescriptions'), validateBody(courseSchema), asyncHandler(async (req: Request, res: Response) => {
  await assertMayCorrect(req, 'prescriptions');
  await WithdrawalService.correctCourse(req.params.id, req.body.lastDoseOn, who(req).userId);
  res.json({ success: true, data: await WithdrawalService.statusForPrescription(req.params.id) });
}));

/** The same correction for a treatment the farmer entered themselves. */
router.patch('/treatments/self/:id/course', authMiddleware, requireRecordAccess('self_treatments'), validateBody(courseSchema), asyncHandler(async (req: Request, res: Response) => {
  await assertMayCorrect(req, 'self_treatments');
  await WithdrawalService.correctSelfCourse(req.params.id, req.body.lastDoseOn);
  res.json({ success: true, data: { ok: true } });
}));

/** The vet's own recent medicines with the label days they typed last time - pre-fills the prescription line (their data, not ours). */
router.get('/treatments/my-recent-lines', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const role = (req as any).userRole as string;
  if (role !== 'veterinarian' && role !== 'admin') throw new CodedError(403, 'WD_VET_ONLY_LIST', 'Only a vet can use this list.');
  res.json({ success: true, data: await WithdrawalService.recentLinesOf(who(req).userId) });
}));

export default router;
