import { CodedError } from '../utils/errors';
import { Router, Request, Response } from 'express';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';
import { resolveNetworkAccess } from '../middleware/networkAccess';
import { asyncHandler } from '../utils/errorHandler';
import database from '../utils/database';
import HospitalNetworkService from '../services/HospitalNetworkService';
import animalService from '../services/AnimalService';
import enterpriseService from '../services/EnterpriseService';

const router = Router();

// G11 - Network financial summary
router.get('/hospital-networks/:id/financial-summary', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const networkId = req.params.id;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  // Was previously a hardcoded ['corporate_admin','hospital_director','auditor'] list that bypassed
  // the admin-configurable financialAnalytics matrix entirely (matrix sets it false for both
  // hospital_director and auditor) - now honors whatever the network's admin has actually configured.
  const access = await resolveNetworkAccess(networkId, userId, userRole, 'financialAnalytics');
  if (!access.allowed) {
    if (access.reason === 'not_member') return res.status(404).json({ success: false, error: 'Network not found' });
    return res.status(403).json({ success: false, error: 'Insufficient permissions' });
  }
  const result = await HospitalNetworkService.getNetworkFinancialSummary(networkId);
  res.json({ success: true, data: result });
}));

// G12 - Staff leave management
router.get('/hospital-networks/:id/leave-requests', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const networkId = req.params.id;
  const userId = (req as any).userId;
  const member = await HospitalNetworkService.getNetworkMember(networkId, userId);
  if (!member) return res.status(403).json({ success: false, error: 'Not a member' });

  const filters: any = {
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 20,
  };
  if (req.query.hospitalId) filters.hospitalId = req.query.hospitalId;
  if (req.query.status) filters.status = req.query.status;
  if (!['corporate_admin', 'hospital_director'].includes(member.networkRole)) {
    filters.userId = userId;
  }

  const result = await HospitalNetworkService.listLeaveRequests(networkId, filters);
  res.json({ success: true, data: result });
}));

router.post('/hospital-networks/:id/leave-requests', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const networkId = req.params.id;
  const userId = (req as any).userId;
  const { leaveType, startDate, endDate, reason, hospitalId } = req.body;

  if (!leaveType || !startDate || !endDate) {
    return res.status(400).json({ success: false, error: 'leaveType, startDate, and endDate are required' });
  }

  const result = await HospitalNetworkService.createLeaveRequest({
    networkId, hospitalId, userId, leaveType, startDate, endDate, reason
  });
  res.json({ success: true, data: result });
}));

router.patch('/hospital-networks/:id/leave-requests/:requestId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { id: networkId, requestId } = req.params;
  const userId = (req as any).userId;
  const { status, rejectionReason } = req.body;

  const member = await HospitalNetworkService.getNetworkMember(networkId, userId);
  if (!member || !['corporate_admin', 'hospital_director'].includes(member.networkRole)) {
    return res.status(403).json({ success: false, error: 'Only directors and admins can approve/reject leave' });
  }

  const result = await HospitalNetworkService.updateLeaveRequestStatus(networkId, requestId, status, userId, rejectionReason);
  res.json({ success: true, data: result });
}));

// G13 - Patient transfers
router.post('/hospital-networks/:id/patient-transfers', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const networkId = req.params.id;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  const { fromHospitalId, toHospitalId, animalId, reason, transferReason, clinicalNotes } = req.body;

  if (!fromHospitalId || !toHospitalId || !animalId || !reason) {
    throw new CodedError(400, 'HN_TRANSFER_FIELDS', 'Choose the patient, the hospital they move from, the hospital they move to, and give the reason for the move.');
  }

  const result = await HospitalNetworkService.createPatientTransfer({
    networkId, fromHospitalId, toHospitalId, animalId, reason, transferReason, clinicalNotes, createdBy: userId, createdByRole: userRole
  });
  res.json({ success: true, data: result });
}));

router.post('/hospital-networks/:id/patient-transfers/:transferId/complete', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { transferId } = req.params;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  const result = await HospitalNetworkService.completePatientTransfer(transferId, userId, userRole);
  res.json({ success: true, data: result });
}));

router.get('/hospital-networks/:id/patient-transfers', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const networkId = req.params.id;
  const userId = (req as any).userId;
  // Platform admins read every network (as on every other network route); anyone else must belong to it.
  if ((req as any).userRole !== 'admin') {
    const member = await HospitalNetworkService.getNetworkMember(networkId, userId);
    if (!member) throw new CodedError(403, 'HN_NOT_MEMBER', 'You are not a member of this network, so you cannot see its transfers. Ask the network admin to add you.');
  }

  const result = await database.query(
    `SELECT nr.*,
            fh.name as "fromHospitalName", th.name as "toHospitalName",
            a.name as "animalName", a.species as "animalSpecies",
            COALESCE(cu.first_name || ' ' || cu.last_name, '') as "createdByName"
     FROM network_referrals nr
     LEFT JOIN vet_hospitals fh ON fh.id = nr.from_hospital_id
     LEFT JOIN vet_hospitals th ON th.id = nr.to_hospital_id
     LEFT JOIN animals a ON a.id = nr.animal_id
     LEFT JOIN users cu ON cu.id = nr.created_by
     WHERE nr.network_id = $1 AND nr.referral_type = 'transfer'
     ORDER BY nr.created_at DESC
     LIMIT 50`,
    [networkId]
  );
  res.json({ success: true, data: result.rows });
}));

// ─── Revenue Trends ──────────────────────────────────────────
router.get('/admin/revenue-trends', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);
  try {
    const daily = await database.query(
      `SELECT 
         DATE_TRUNC('day', created_at) as date,
         SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as revenue,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as transactions,
         SUM(CASE WHEN status IN ('refunded','partially_refunded') THEN COALESCE(refund_amount,0) ELSE 0 END) as refunds
       FROM payments
       WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY DATE_TRUNC('day', created_at)
       ORDER BY date ASC`,
      [days]
    );
    const topVets = await database.query(
      `SELECT CONCAT(u.first_name, ' ', u.last_name) as "vetName",
         SUM(p.amount) as "totalRevenue",
         COUNT(*) as consultations
       FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       JOIN users u ON u.id = b.veterinarian_id
       WHERE p.status = 'completed' AND p.created_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY b.veterinarian_id, u.first_name, u.last_name
       ORDER BY "totalRevenue" DESC
       LIMIT 5`,
      [days]
    );
    res.json({ success: true, data: { daily: daily.rows, topVets: topVets.rows } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

// ─── Bulk Animal Import ──────────────────────────────────────
// Every row goes through AnimalService.createAnimal - the same path as the registration form - so
// an imported animal gets its unique ID, and the farm-profile rules apply (a bull cannot be given
// a milk yield). This used to be a raw INSERT with none of that, and an unchecked farm id.
const IMPORT_TEXT_FIELDS = ['name', 'species', 'breed', 'gender', 'animalClass', 'dateOfBirth', 'color',
  'microchipId', 'earTagId', 'registrationNumber', 'breedingStatus', 'lastBirthDate'] as const;
const IMPORT_NUMBER_FIELDS = ['weight', 'birthWeight', 'avgDailyMilkLitres', 'parity'] as const;

router.post('/animals/bulk-import', authMiddleware, roleMiddleware(['admin', 'farmer']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { animals, enterpriseId } = req.body;
  if (!Array.isArray(animals) || animals.length === 0) {
    return res.status(400).json({ success: false, error: 'animals array is required' });
  }
  if (animals.length > 500) {
    return res.status(400).json({ success: false, error: 'Maximum 500 animals per import' });
  }
  // Importing into a farm needs access to that farm (admins excepted), like every other write.
  if (enterpriseId && authReq.userRole !== 'admin' && !(await enterpriseService.hasAccess(enterpriseId, authReq.userId!))) {
    return res.status(403).json({ success: false, error: 'You do not have access to that farm' });
  }
  const results = { created: 0, failed: 0, errors: [] as string[] };
  for (const [index, row] of animals.entries()) {
    const label = row?.name ? String(row.name) : `Row ${index + 2}`;
    try {
      if (!row || !row.name || !row.species) {
        results.failed++;
        results.errors.push(`${label}: name and species are required`);
        continue;
      }
      const dto: Record<string, any> = {};
      for (const key of IMPORT_TEXT_FIELDS) {
        const value = row[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') dto[key] = String(value).trim();
      }
      let bad: string | null = null;
      for (const key of IMPORT_NUMBER_FIELDS) {
        const value = row[key];
        if (value === undefined || value === null || String(value).trim() === '') continue;
        const n = Number(String(value).replace(',', '.'));
        if (!Number.isFinite(n) || n < 0) { bad = key; break; }
        dto[key] = n;
      }
      if (bad) {
        results.failed++;
        results.errors.push(`${label}: "${bad}" must be a number`);
        continue;
      }
      if (enterpriseId) dto.enterpriseId = enterpriseId;
      await animalService.createAnimal(authReq.userId!, dto as any);
      results.created++;
    } catch (err: any) {
      results.failed++;
      // The service's own message (for example which field cannot be set for this animal).
      results.errors.push(`${label}: ${err.message}`);
    }
  }
  res.json({ success: true, data: results });
}));

// ─── Dispute Resolution ──────────────────────────────────────
router.post('/disputes', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { bookingId, consultationId, subject, description, disputeType } = req.body;
  if (!subject || !description || !disputeType) {
    return res.status(400).json({ success: false, error: 'subject, description, and disputeType are required' });
  }
  try {
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    await database.query(
      `INSERT INTO disputes (id, reported_by, booking_id, consultation_id, subject, description, dispute_type, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', NOW(), NOW())`,
      [id, authReq.userId, bookingId || null, consultationId || null, subject, description, disputeType]
    );
    res.status(201).json({ success: true, data: { id } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

router.get('/disputes', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const isAdmin = authReq.userRole === 'admin';
  const whereClause = isAdmin ? '' : 'WHERE d.reported_by = $1';
  const params: any[] = isAdmin ? [] : [authReq.userId];
  try {
    const result = await database.query(
      `SELECT d.id, d.subject, d.description, d.dispute_type as "disputeType", d.status,
              d.booking_id as "bookingId", d.consultation_id as "consultationId",
              d.resolution, d.resolved_at as "resolvedAt", d.resolved_by as "resolvedBy",
              d.created_at as "createdAt",
              CONCAT(u.first_name, ' ', u.last_name) as "reportedByName", u.email as "reportedByEmail"
       FROM disputes d
       LEFT JOIN users u ON u.id = d.reported_by
       ${whereClause}
       ORDER BY d.created_at DESC LIMIT 50`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

router.put('/disputes/:id/resolve', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { resolution, status } = req.body;
  if (!resolution) {
    return res.status(400).json({ success: false, error: 'resolution is required' });
  }
  const validStatus = ['resolved', 'dismissed', 'escalated'];
  const newStatus = validStatus.includes(status) ? status : 'resolved';
  try {
    await database.query(
      `UPDATE disputes SET status = $1, resolution = $2, resolved_by = $3, resolved_at = NOW(), updated_at = NOW()
       WHERE id = $4`,
      [newStatus, resolution, authReq.userId, req.params.id]
    );
    res.json({ success: true, message: 'Dispute resolved' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}));


export default router;
