import { Router, Request, Response } from 'express';
import { authMiddleware, validateBody } from '../middleware/auth';
import { requireAnimalAccess } from '../middleware/hospitalDataIsolation';
import { asyncHandler } from '../utils/errorHandler';
import database from '../utils/database';
import EnterpriseController from '../controllers/EnterpriseController';
import BatchManagementService from '../services/BatchManagementService';
import FarmAccessService from '../services/FarmAccessService';
import FarmInvitationService from '../services/FarmInvitationService';
import { ForbiddenError } from '../utils/errors';
import {
  createEnterpriseSchema, updateEnterpriseSchema, addMemberSchema, updateMemberSchema,
  createAnimalGroupSchema, updateAnimalGroupSchema, assignAnimalToGroupSchema,
  createLocationSchema, updateLocationSchema, createMovementSchema,
  createCampaignSchema, updateCampaignSchema,
} from '../middleware/validation';

const router = Router();

// ─── Enterprise / Farm routes ────────────────────────────────
router.post('/enterprises', authMiddleware, validateBody(createEnterpriseSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.createEnterprise(req, res)));
router.get('/enterprises', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.listEnterprises(req, res)));
router.get('/enterprises/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getEnterprise(req, res)));
router.put('/enterprises/:id', authMiddleware, validateBody(updateEnterpriseSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.updateEnterprise(req, res)));
router.delete('/enterprises/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.deleteEnterprise(req, res)));
router.get('/enterprises/:id/stats', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getEnterpriseStats(req, res)));

// Enterprise Animals
router.get('/enterprises/:enterpriseId/animals', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.listEnterpriseAnimals(req, res)));

// Enterprise Members
router.get('/enterprises/:id/members', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.listMembers(req, res)));
router.post('/enterprises/:id/members', authMiddleware, validateBody(addMemberSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.addMember(req, res)));
router.put('/enterprises/:enterpriseId/members/:userId', authMiddleware, validateBody(updateMemberSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.updateMember(req, res)));
router.post('/enterprises/:id/transfer-ownership', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.transferOwnership(req, res)));
router.delete('/enterprises/:enterpriseId/members/:userId', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.removeMember(req, res)));

// Enterprise member invite by email (finds user by email then adds as member)
router.post('/enterprises/:id/invite-member', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  const { email, role } = req.body;

  if (!email || !role) {
    return res.status(400).json({ success: false, message: 'email and role are required' });
  }

  // Kept for older clients; it now starts an INVITATION (the person accepts or declines) instead of adding
  // them straight away. Who may invite whom, and the messages, are FarmInvitationService's.
  const data = await FarmInvitationService.create(req.params.id, { userId, role: userRole }, { email, role });
  res.status(201).json({ success: true, data });
}));

// Animal Groups
router.post('/animal-groups', authMiddleware, validateBody(createAnimalGroupSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.createGroup(req, res)));
router.get('/animal-groups/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getGroup(req, res)));
router.put('/animal-groups/:id', authMiddleware, validateBody(updateAnimalGroupSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.updateGroup(req, res)));
router.delete('/animal-groups/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.deleteGroup(req, res)));
router.get('/enterprises/:enterpriseId/groups', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.listGroups(req, res)));
router.post('/animal-groups/:id/assign', authMiddleware, validateBody(assignAnimalToGroupSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.assignAnimalToGroup(req, res)));
router.delete('/animal-groups/:id/animals/:animalId', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.removeAnimalFromGroup(req, res)));

// ─── Batch (flock/herd) management ──────────────────────────────────────────
// A health event has ONE subject - an animal or a group - so a 5,000-bird flock produces one
// record, not 5,000. See docs/BATCH_ANIMAL_MANAGEMENT_PLAN.md.
//
// Every route below is gated by ensureGroupAccess(): the caller must own the enterprise that
// owns the group, be a member of it, or be a platform admin. A group id is a bearer of an
// enterprise's data, so an unguarded :groupId here would be a cross-tenant read exactly like
// the ones the network audits found.
export async function ensureGroupAccess(req: Request, res: Response): Promise<string | null> {
  const authReq = req as any;
  const groupId = req.params.groupId || req.params.id;
  if (!groupId) { res.status(400).json({ success: false, message: 'Group id is required' }); return null; }

  // The group's farm decides: any member may look; changing the head count, cycles or records needs a role
  // that records (a viewer or farm vet only looks). services/FarmAccessService.ts is the one rule.
  const g = await database.query(`SELECT enterprise_id FROM animal_groups WHERE id = $1`, [groupId]);
  if (!g.rows.length) {
    res.status(404).json({ success: false, message: 'That group was not found. It may have been removed.' });
    return null;
  }
  try {
    const action = authReq.method === 'GET' || authReq.method === 'HEAD' ? 'read' : 'record';
    await FarmAccessService.assert(g.rows[0].enterprise_id, { userId: authReq.userId, role: authReq.userRole }, action);
  } catch (err: any) {
    if (err instanceof ForbiddenError) {
      res.status(403).json({ success: false, message: err.message, error: { message: err.message } });
      return null;
    }
    throw err;
  }
  return groupId;
}

router.get('/animal-groups/:groupId/cycles', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;
  res.json({ success: true, data: await BatchManagementService.listCycles(groupId) });
}));

router.get('/animal-groups/:groupId/cycles/active', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;
  res.json({ success: true, data: await BatchManagementService.getActiveCycle(groupId) });
}));

router.post('/animal-groups/:groupId/cycles', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;
  const { name, species, breed, placedCount, startedAt, notes } = req.body;
  const cycle = await BatchManagementService.openCycle({
    groupId, name, species, breed,
    placedCount: Number(placedCount) || 0, startedAt, notes,
    userId: (req as any).userId,
  });
  res.status(201).json({ success: true, data: cycle });
}));

router.post('/group-cycles/:cycleId/close', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  // The cycle is reached by its own id, so resolve its group first and guard on that.
  const owner = await database.query(
    `SELECT gc.group_id FROM group_cycles gc WHERE gc.id = $1`, [req.params.cycleId]
  );
  if (!owner.rows.length) { res.status(404).json({ success: false, message: 'Cycle not found' }); return; }
  req.params.groupId = owner.rows[0].group_id;
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;

  const cycle = await BatchManagementService.closeCycle(req.params.cycleId, authReq.userId, req.body?.reason);
  res.json({ success: true, data: cycle });
}));

router.get('/animal-groups/:groupId/population-events', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;
  const events = await BatchManagementService.listPopulationEvents(groupId, req.query.cycleId as string | undefined);
  res.json({ success: true, data: events });
}));

router.post('/animal-groups/:groupId/population-events', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;
  const { cycleId, eventType, quantity, eventDate, reason, sourceRef } = req.body;
  const result = await BatchManagementService.recordPopulationEvent({
    groupId, cycleId, eventType, quantity: Number(quantity),
    eventDate, reason, sourceRef, userId: (req as any).userId,
  });
  res.status(201).json({ success: true, data: result });
}));

router.get('/animal-groups/:groupId/reconcile', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;
  res.json({ success: true, data: await BatchManagementService.reconcile(groupId) });
}));

// Flock health as RATES - mortality %, morbidity %, treatment coverage. "1 record" says
// nothing about a flock of 5,000; these are the numbers a producer manages by.
router.get('/animal-groups/:groupId/health-metrics', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;
  const metrics = await BatchManagementService.getGroupHealthMetrics(groupId, req.query.cycleId as string | undefined);
  res.json({ success: true, data: metrics });
}));

router.get('/animal-groups/:groupId/withdrawal', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;
  res.json({ success: true, data: await BatchManagementService.getWithdrawalStatus({ groupId }) });
}));

router.post('/animal-groups/:groupId/promote', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;
  const { animalId, cycleId, reason } = req.body;
  if (!animalId) { res.status(400).json({ success: false, message: 'animalId is required' }); return; }
  const result = await BatchManagementService.promoteFromBatch({
    animalId, groupId, cycleId, reason, userId: (req as any).userId,
  });
  res.status(201).json({ success: true, data: result });
}));

// An animal's FULL life story: its own records plus the group records that applied while it was
// a member of that cycle. Composed at read time - nothing is ever copied down.
router.get('/animals/:animalId/lifetime-history', authMiddleware, requireAnimalAccess('params:animalId', 'medical_records'), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await BatchManagementService.getAnimalLifetimeHistory(req.params.animalId) });
}));

// Locations
router.post('/locations', authMiddleware, validateBody(createLocationSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.createLocation(req, res)));
router.get('/locations/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getLocation(req, res)));
router.put('/locations/:id', authMiddleware, validateBody(updateLocationSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.updateLocation(req, res)));
router.delete('/locations/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.deleteLocation(req, res)));
router.get('/enterprises/:enterpriseId/locations', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.listLocations(req, res)));
router.get('/enterprises/:enterpriseId/location-tree', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getLocationTree(req, res)));

// Movement Records
router.post('/movements', authMiddleware, validateBody(createMovementSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.createMovement(req, res)));
router.get('/movements/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getMovement(req, res)));
router.get('/enterprises/:enterpriseId/movements', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.listMovements(req, res)));

// Movement approval/rejection (enterprise owner or admin)
router.patch('/movements/:id/approve', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  const { action } = req.body;

  if (!action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, message: 'action must be "approve" or "reject"' });
  }

  const movement = await database.query(
    `SELECT m.*, a.enterprise_id FROM movement_records m
     LEFT JOIN animals a ON a.id = m.animal_id
     WHERE m.id = $1`,
    [req.params.id]
  );

  if (movement.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Movement record not found' });
  }

  const mv = movement.rows[0];
  const enterpriseId = mv.enterprise_id || mv.enterprise_id;

  if (userRole !== 'admin') {
    const enterpriseAccess = await database.query(
      `SELECT id FROM enterprises WHERE id = $1 AND owner_id = $2`,
      [enterpriseId, userId]
    );
    if (enterpriseAccess.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized to approve this movement' });
    }
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  await database.query(
    `UPDATE movement_records SET status = $1, approved_by = $2 WHERE id = $3`,
    [newStatus, userId, req.params.id]
  );

  res.json({ data: { status: newStatus, message: `Movement ${newStatus}` } });
}));

// Treatment Campaigns
router.post('/campaigns', authMiddleware, validateBody(createCampaignSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.createCampaign(req, res)));
router.get('/campaigns/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getCampaign(req, res)));
router.put('/campaigns/:id', authMiddleware, validateBody(updateCampaignSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.updateCampaign(req, res)));
router.delete('/campaigns/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.deleteCampaign(req, res)));
router.get('/enterprises/:enterpriseId/campaigns', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.listCampaigns(req, res)));


export default router;
