import { Router, Request, Response } from 'express';
import { authMiddleware, roleMiddleware, validateBody } from '../middleware/auth';
import { asyncHandler } from '../utils/errorHandler';
import MasterDataService from '../services/MasterDataService';
import FarmProfileService from '../services/FarmProfileService';
import {
  createMasterGroupTypeSchema, updateMasterGroupTypeSchema, updateMasterRecordTypeSchema,
  resolveFarmProfileQuerySchema,
} from '../middleware/validation';

// ═══════════════════════════════════════════════════════════════════
// Farm profile engine (docs/FARM_MANAGEMENT_PLAN.md section 6, migration 043).
//
// Group types and record types are master data like species/breeds/classes, so they follow the
// same shape as the master-data routes in catalog-and-roles.routes.ts: a public active-only read
// that powers pickers, plus admin CRUD. Nothing here takes a tenant id - it is platform reference
// data, identical for every farm - so there is no tenant scoping to get wrong.
// ═══════════════════════════════════════════════════════════════════

const router = Router();

// ─── Public read (no auth - reference data that loads with the rest of master data) ───
router.get('/master-data/group-types', asyncHandler(async (req: Request, res: Response) => {
  const { speciesId, farmSegment } = req.query as Record<string, string | undefined>;
  res.json({ success: true, data: await MasterDataService.listGroupTypes({ speciesId, farmSegment }, true) });
}));
router.get('/master-data/record-types', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listRecordTypes(true) });
}));

// What applies to one animal or group. The frontend resolves this locally from master data with
// the same function; this endpoint exists for other clients and for checking the two agree.
router.get('/farm-profile/resolve', asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = resolveFarmProfileQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(400).json({ success: false, message: error.details.map(d => d.message).join(', ') });
  }
  const profile = await FarmProfileService.resolve({
    speciesCode: value.species,
    animalClass: value.animalClass || null,
    gender: value.gender || null,
    managementMode: value.managementMode || null,
    groupType: value.groupType || null,
  });
  res.json({ success: true, data: profile });
}));

// ─── Admin CRUD: Group Types ───────────────────────────────────
router.get('/admin/master-data/group-types', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { speciesId, farmSegment } = req.query as Record<string, string | undefined>;
  res.json({ success: true, data: await MasterDataService.listGroupTypes({ speciesId, farmSegment }, false) });
}));
router.post('/admin/master-data/group-types', authMiddleware, roleMiddleware(['admin']), validateBody(createMasterGroupTypeSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await MasterDataService.createGroupType(req.body) });
}));
router.put('/admin/master-data/group-types/:id', authMiddleware, roleMiddleware(['admin']), validateBody(updateMasterGroupTypeSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.updateGroupType(req.params.id, req.body) });
}));
router.patch('/admin/master-data/group-types/:id/archive', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.archiveGroupType(req.params.id);
  res.json({ success: true, message: 'Group type archived' });
}));
router.patch('/admin/master-data/group-types/:id/restore', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.restoreGroupType(req.params.id);
  res.json({ success: true, message: 'Group type restored' });
}));
router.delete('/admin/master-data/group-types/:id', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.deleteGroupType(req.params.id);
  res.json({ success: true, message: 'Group type deleted' });
}));

// ─── Admin: Record Types (wording / icon / order / on-off only - codes are used by logic) ───
router.get('/admin/master-data/record-types', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listRecordTypes(false) });
}));
router.put('/admin/master-data/record-types/:id', authMiddleware, roleMiddleware(['admin']), validateBody(updateMasterRecordTypeSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.updateRecordType(req.params.id, req.body) });
}));
router.patch('/admin/master-data/record-types/:id/archive', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.archiveRecordType(req.params.id);
  res.json({ success: true, message: 'Record type archived' });
}));
router.patch('/admin/master-data/record-types/:id/restore', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.restoreRecordType(req.params.id);
  res.json({ success: true, message: 'Record type restored' });
}));

export default router;
