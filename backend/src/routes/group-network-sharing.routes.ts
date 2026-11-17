import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import requireNetworkAccess, { NetworkAccessRequest } from '../middleware/networkAccess';
import { asyncHandler } from '../utils/errorHandler';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import database from '../utils/database';
import FarmAccessService from '../services/FarmAccessService';
import GroupNetworkSharingService from '../services/GroupNetworkSharingService';

/**
 * Sharing a GROUP (herd / flock) with a hospital network for one production cycle - docs/modules/farm-profile.md
 * "Sharing a group with a hospital network". Its own file and tables: the animal enrolment code and tables
 * (hospital-network.routes.ts, animal_care_contexts) are change-protected and are not touched.
 *
 *   farm side   (owner only): create a code, see what is shared, cancel a code, stop a sharing
 *   network side (members with the existing 'enrollPatient' / 'viewEnrolledPatients' permissions): redeem a code,
 *                 list the shared groups, read the shared records
 */
const router = Router();

/** Only the farm's owner (or a platform admin) decides to share a farm's data outside it. */
async function assertOwnerOfGroup(req: Request): Promise<string> {
  const authReq = req as any;
  const groupId = req.params.groupId;
  const g = await database.query(`SELECT enterprise_id FROM animal_groups WHERE id = $1 AND is_active = true`, [groupId]);
  if (g.rows.length === 0) throw new NotFoundError('We could not find that group. It may have been removed.');
  if (authReq.userRole !== 'admin') {
    const role = await FarmAccessService.roleOf(g.rows[0].enterprise_id, authReq.userId);
    if (role === null) throw new ForbiddenError("You don't have access to this farm. Only the farm owner can add people. Please ask them to invite you.");
    if (role !== 'owner') throw new ForbiddenError('Only the farm owner can share a group with a hospital network. Ask the owner to do it.');
  }
  return groupId;
}

// ── Farm side ──────────────────────────────────────────────────────────────────────────────────────
router.post('/animal-groups/:groupId/network-share-codes', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await assertOwnerOfGroup(req);
  const b = req.body || {};
  const created = await GroupNetworkSharingService.createCode((groupId), (req as any).userId, {
    medicalRecords: b.medicalRecords, vaccinationRecords: b.vaccinationRecords, prescriptions: b.prescriptions,
  });
  res.status(201).json({ success: true, data: created });
}));

router.get('/animal-groups/:groupId/network-shares', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await assertOwnerOfGroup(req);
  res.json({ success: true, data: await GroupNetworkSharingService.listForGroup(groupId) });
}));

router.delete('/animal-groups/:groupId/network-share-codes/:codeId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await assertOwnerOfGroup(req);
  await GroupNetworkSharingService.cancelCode(groupId, req.params.codeId);
  res.json({ success: true });
}));

router.delete('/animal-groups/:groupId/network-shares/:contextId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await assertOwnerOfGroup(req);
  await GroupNetworkSharingService.stopSharing(groupId, req.params.contextId);
  res.json({ success: true });
}));

// ── Network side ───────────────────────────────────────────────────────────────────────────────────
router.post('/hospital-networks/:id/enroll-group', authMiddleware, requireNetworkAccess('enrollPatient'), asyncHandler(async (req: Request, res: Response) => {
  const nreq = req as NetworkAccessRequest;
  // Branch-scoped roles can only enrol into their own branch.
  const hospitalId = nreq.branchScopeHospitalId ?? (req.body?.hospitalId || null);
  const r = await GroupNetworkSharingService.redeem(req.params.id, (req as any).userId, req.body?.code, hospitalId);
  res.status(201).json({ success: true, data: r });
}));

router.get('/hospital-networks/:id/shared-groups', authMiddleware, requireNetworkAccess('viewEnrolledPatients'), asyncHandler(async (req: Request, res: Response) => {
  const nreq = req as NetworkAccessRequest;
  res.json({ success: true, data: await GroupNetworkSharingService.listForNetwork(req.params.id, nreq.branchScopeHospitalId ?? null) });
}));

router.get('/hospital-networks/:id/shared-groups/:groupId/records', authMiddleware, requireNetworkAccess('viewEnrolledPatients'), asyncHandler(async (req: Request, res: Response) => {
  const nreq = req as NetworkAccessRequest;
  const data = await GroupNetworkSharingService.recordsForNetwork(req.params.id, req.params.groupId, (req as any).userId, (req as any).userRole, nreq.branchScopeHospitalId ?? null);
  res.json({ success: true, data });
}));

export default router;
