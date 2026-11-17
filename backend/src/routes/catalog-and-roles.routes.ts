import { Router, Request, Response } from 'express';
import { authMiddleware, roleMiddleware, validateBody, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/errorHandler';
import database from '../utils/database';
import { uploadAny } from '../middleware/upload';
import VetHospitalController from '../controllers/VetHospitalController';
import HospitalDocumentController from '../controllers/HospitalDocumentController';
import VaccineProtocolService from '../services/VaccineProtocolService';
import MasterDataService from '../services/MasterDataService';
import VaccineScheduleService from '../services/VaccineScheduleService';
import {
  createHospitalSchema, updateHospitalSchema, addHospitalDoctorSchema, updateHospitalDoctorSchema,
  createDepartmentSchema, updateDepartmentSchema,
  createHospitalServiceSchema, updateHospitalServiceSchema, verifyHospitalSchema,
  reviewHospitalDocSchema,
  roleChangeRequestSchema, rejectRoleChangeSchema,
  createMasterSpeciesSchema, updateMasterSpeciesSchema,
  createMasterBreedSchema, updateMasterBreedSchema,
  createMasterAnimalClassSchema, updateMasterAnimalClassSchema,
  createMasterMarketplaceCategorySchema, updateMasterMarketplaceCategorySchema,
  createMasterMarketplaceConditionSchema, updateMasterMarketplaceConditionSchema,
} from '../middleware/validation';

const router = Router();

// ─── Vet Hospital routes ─────────────────────────────────────
router.post('/vet-hospitals', authMiddleware, validateBody(createHospitalSchema), asyncHandler((req: Request, res: Response) => VetHospitalController.createHospital(req, res)));
router.get('/vet-hospitals', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.listHospitals(req, res)));
router.get('/vet-hospitals/my', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.listMyHospitals(req, res)));
router.get('/vet-hospitals/admin/stats', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.getAdminStats(req, res)));
// Doctor Invite public routes (must come before :id param)
router.get('/vet-hospitals/invites/token/:token', asyncHandler((req: Request, res: Response) => VetHospitalController.getInviteByToken(req, res)));
router.post('/vet-hospitals/invites/accept', asyncHandler((req: Request, res: Response) => VetHospitalController.acceptInvite(req, res)));
router.get('/vet-hospitals/:id', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.getHospital(req, res)));
router.put('/vet-hospitals/:id', authMiddleware, validateBody(updateHospitalSchema), asyncHandler((req: Request, res: Response) => VetHospitalController.updateHospital(req, res)));
router.delete('/vet-hospitals/:id', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.deleteHospital(req, res)));
router.put('/vet-hospitals/:id/verify', authMiddleware, validateBody(verifyHospitalSchema), asyncHandler((req: Request, res: Response) => VetHospitalController.verifyHospital(req, res)));
router.get('/vet-hospitals/:id/stats', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.getHospitalStats(req, res)));
// Doctors
router.get('/vet-hospitals/:id/doctors', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.listDoctors(req, res)));
router.post('/vet-hospitals/:id/doctors', authMiddleware, validateBody(addHospitalDoctorSchema), asyncHandler((req: Request, res: Response) => VetHospitalController.addDoctor(req, res)));
router.put('/vet-hospitals/:id/doctors/:doctorId', authMiddleware, validateBody(updateHospitalDoctorSchema), asyncHandler((req: Request, res: Response) => VetHospitalController.updateDoctor(req, res)));
router.delete('/vet-hospitals/:id/doctors/:doctorId', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.removeDoctor(req, res)));
// Departments
router.get('/vet-hospitals/:id/departments', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.listDepartments(req, res)));
router.post('/vet-hospitals/:id/departments', authMiddleware, validateBody(createDepartmentSchema), asyncHandler((req: Request, res: Response) => VetHospitalController.createDepartment(req, res)));
router.put('/vet-hospitals/:id/departments/:deptId', authMiddleware, validateBody(updateDepartmentSchema), asyncHandler((req: Request, res: Response) => VetHospitalController.updateDepartment(req, res)));
router.delete('/vet-hospitals/:id/departments/:deptId', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.deleteDepartment(req, res)));
// Services
router.get('/vet-hospitals/:id/services', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.listServices(req, res)));
router.post('/vet-hospitals/:id/services', authMiddleware, validateBody(createHospitalServiceSchema), asyncHandler((req: Request, res: Response) => VetHospitalController.addService(req, res)));
router.put('/vet-hospitals/:id/services/:serviceId', authMiddleware, validateBody(updateHospitalServiceSchema), asyncHandler((req: Request, res: Response) => VetHospitalController.updateService(req, res)));
router.delete('/vet-hospitals/:id/services/:serviceId', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.deleteService(req, res)));
// Hospital Bookings (appointments at this hospital)
router.get('/vet-hospitals/:id/bookings', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.listHospitalBookings(req, res)));
// Doctor Invites
router.post('/vet-hospitals/:id/invites', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.inviteDoctor(req, res)));
router.get('/vet-hospitals/:id/invites', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.listInvites(req, res)));
router.delete('/vet-hospitals/:id/invites/:inviteId', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.revokeInvite(req, res)));
// Documents (KYC / Compliance)
router.get('/vet-hospitals/admin/pending', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalDocumentController.listPendingVerification(req, res)));
router.get('/vet-hospitals/:id/documents', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalDocumentController.listDocuments(req, res)));
router.post('/vet-hospitals/:id/documents', authMiddleware, uploadAny.any(), asyncHandler((req: Request, res: Response) => HospitalDocumentController.uploadDocument(req, res)));
router.put('/vet-hospitals/:id/documents/:docId/review', authMiddleware, validateBody(reviewHospitalDocSchema), asyncHandler((req: Request, res: Response) => HospitalDocumentController.reviewDocument(req, res)));

// ─── Vaccine Protocol routes (admin CRUD) ────────────────────
router.get('/admin/vaccine-protocols', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { species, category, country, activeOnly } = req.query as Record<string, string>;
  const protocols = await VaccineProtocolService.listProtocols({
    species, category, country, activeOnly: activeOnly !== 'false',
  });
  const stats = await VaccineProtocolService.getProtocolStats();
  res.json({ success: true, data: { protocols, stats } });
}));

router.post('/admin/vaccine-protocols', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const protocol = await VaccineProtocolService.createProtocol({
    ...req.body, createdBy: authReq.userId,
  });
  res.status(201).json({ success: true, data: protocol });
}));

router.get('/admin/vaccine-protocols/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const protocol = await VaccineProtocolService.getProtocol(req.params.id);
  if (!protocol) return res.status(404).json({ success: false, message: 'Protocol not found' });
  res.json({ success: true, data: protocol });
}));

router.put('/admin/vaccine-protocols/:id', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const protocol = await VaccineProtocolService.updateProtocol(req.params.id, req.body, authReq.userId);
  res.json({ success: true, data: protocol });
}));

router.patch('/admin/vaccine-protocols/:id/archive', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await VaccineProtocolService.archiveProtocol(req.params.id);
  res.json({ success: true, message: 'Protocol archived' });
}));

router.patch('/admin/vaccine-protocols/:id/restore', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await VaccineProtocolService.restoreProtocol(req.params.id);
  res.json({ success: true, message: 'Protocol restored' });
}));

// Regulatory change tracking
router.get('/admin/vaccine-protocols/:id/changes', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const changes = await VaccineProtocolService.getProtocolChangeHistory(req.params.id);
  res.json({ success: true, data: changes });
}));

router.post('/admin/vaccine-protocols/:id/changes', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const change = await VaccineProtocolService.addProtocolChange({
    protocolId: req.params.id,
    ...req.body,
    changedBy: authReq.userId,
  });
  res.status(201).json({ success: true, data: change });
}));

// ─── Vaccine protocols - public read (authenticated) ─────────
router.get('/vaccine-protocols', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { species, category, country } = req.query as Record<string, string>;
  const protocols = await VaccineProtocolService.listProtocols({ species, category, country, activeOnly: true });
  res.json({ success: true, data: protocols });
}));

router.get('/vaccine-protocols/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const protocol = await VaccineProtocolService.getProtocol(req.params.id);
  if (!protocol) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: protocol });
}));

// ═══════════════════════════════════════════════════════════════════
// Master Data - species, breeds, animal classes, marketplace categories/conditions.
// Public read (active-only, powers dropdowns) + admin CRUD (archive/restore + delete
// blocked while in use). Mirrors the vaccine-protocols route shape above.
// ═══════════════════════════════════════════════════════════════════

// ─── Public read (no auth - powers dropdowns on both authed pages and the
// unauthenticated PublicMarketplace; mirrors GET /settings/public's convention
// for non-sensitive UI config that must load before/without login) ─────────
router.get('/master-data/species', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listSpecies(true) });
}));
router.get('/master-data/breeds', asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listBreeds(req.query.speciesId as string | undefined, true) });
}));
router.get('/master-data/animal-classes', asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listAnimalClasses(req.query.speciesId as string | undefined, true) });
}));
router.get('/master-data/marketplace/categories', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listMarketplaceCategories(true) });
}));
router.get('/master-data/marketplace/conditions', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listMarketplaceConditions(true) });
}));

// ─── Admin CRUD: Species ───────────────────────────────────────
router.get('/admin/master-data/species', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listSpecies(false) });
}));
router.post('/admin/master-data/species', authMiddleware, roleMiddleware(['admin']), validateBody(createMasterSpeciesSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await MasterDataService.createSpecies(req.body) });
}));
router.put('/admin/master-data/species/:id', authMiddleware, roleMiddleware(['admin']), validateBody(updateMasterSpeciesSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.updateSpecies(req.params.id, req.body) });
}));
router.patch('/admin/master-data/species/:id/archive', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.archiveSpecies(req.params.id);
  res.json({ success: true, message: 'Species archived' });
}));
router.patch('/admin/master-data/species/:id/restore', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.restoreSpecies(req.params.id);
  res.json({ success: true, message: 'Species restored' });
}));
router.delete('/admin/master-data/species/:id', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.deleteSpecies(req.params.id);
  res.json({ success: true, message: 'Species deleted' });
}));

// ─── Admin CRUD: Breeds ────────────────────────────────────────
router.get('/admin/master-data/breeds', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listBreeds(req.query.speciesId as string | undefined, false) });
}));
router.post('/admin/master-data/breeds', authMiddleware, roleMiddleware(['admin']), validateBody(createMasterBreedSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await MasterDataService.createBreed(req.body) });
}));
router.put('/admin/master-data/breeds/:id', authMiddleware, roleMiddleware(['admin']), validateBody(updateMasterBreedSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.updateBreed(req.params.id, req.body) });
}));
router.patch('/admin/master-data/breeds/:id/archive', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.archiveBreed(req.params.id);
  res.json({ success: true, message: 'Breed archived' });
}));
router.patch('/admin/master-data/breeds/:id/restore', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.restoreBreed(req.params.id);
  res.json({ success: true, message: 'Breed restored' });
}));
router.delete('/admin/master-data/breeds/:id', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.deleteBreed(req.params.id);
  res.json({ success: true, message: 'Breed deleted' });
}));

// ─── Admin CRUD: Animal Classes ────────────────────────────────
router.get('/admin/master-data/animal-classes', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listAnimalClasses(req.query.speciesId as string | undefined, false) });
}));
router.post('/admin/master-data/animal-classes', authMiddleware, roleMiddleware(['admin']), validateBody(createMasterAnimalClassSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await MasterDataService.createAnimalClass(req.body) });
}));
router.put('/admin/master-data/animal-classes/:id', authMiddleware, roleMiddleware(['admin']), validateBody(updateMasterAnimalClassSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.updateAnimalClass(req.params.id, req.body) });
}));
router.patch('/admin/master-data/animal-classes/:id/archive', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.archiveAnimalClass(req.params.id);
  res.json({ success: true, message: 'Animal class archived' });
}));
router.patch('/admin/master-data/animal-classes/:id/restore', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.restoreAnimalClass(req.params.id);
  res.json({ success: true, message: 'Animal class restored' });
}));
router.delete('/admin/master-data/animal-classes/:id', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.deleteAnimalClass(req.params.id);
  res.json({ success: true, message: 'Animal class deleted' });
}));

// ─── Admin CRUD: Marketplace Categories ────────────────────────
router.get('/admin/master-data/marketplace/categories', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listMarketplaceCategories(false) });
}));
router.post('/admin/master-data/marketplace/categories', authMiddleware, roleMiddleware(['admin']), validateBody(createMasterMarketplaceCategorySchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await MasterDataService.createMarketplaceCategory(req.body) });
}));
router.put('/admin/master-data/marketplace/categories/:id', authMiddleware, roleMiddleware(['admin']), validateBody(updateMasterMarketplaceCategorySchema), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.updateMarketplaceCategory(req.params.id, req.body) });
}));
router.patch('/admin/master-data/marketplace/categories/:id/archive', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.archiveMarketplaceCategory(req.params.id);
  res.json({ success: true, message: 'Category archived' });
}));
router.patch('/admin/master-data/marketplace/categories/:id/restore', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.restoreMarketplaceCategory(req.params.id);
  res.json({ success: true, message: 'Category restored' });
}));
router.delete('/admin/master-data/marketplace/categories/:id', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.deleteMarketplaceCategory(req.params.id);
  res.json({ success: true, message: 'Category deleted' });
}));

// ─── Admin CRUD: Marketplace Conditions ────────────────────────
router.get('/admin/master-data/marketplace/conditions', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listMarketplaceConditions(false) });
}));
router.post('/admin/master-data/marketplace/conditions', authMiddleware, roleMiddleware(['admin']), validateBody(createMasterMarketplaceConditionSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await MasterDataService.createMarketplaceCondition(req.body) });
}));
router.put('/admin/master-data/marketplace/conditions/:id', authMiddleware, roleMiddleware(['admin']), validateBody(updateMasterMarketplaceConditionSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.updateMarketplaceCondition(req.params.id, req.body) });
}));
router.patch('/admin/master-data/marketplace/conditions/:id/archive', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.archiveMarketplaceCondition(req.params.id);
  res.json({ success: true, message: 'Condition archived' });
}));
router.patch('/admin/master-data/marketplace/conditions/:id/restore', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.restoreMarketplaceCondition(req.params.id);
  res.json({ success: true, message: 'Condition restored' });
}));
router.delete('/admin/master-data/marketplace/conditions/:id', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.deleteMarketplaceCondition(req.params.id);
  res.json({ success: true, message: 'Condition deleted' });
}));

// ─── Animal vaccine assignment routes ────────────────────────
router.get('/animals/:animalId/vaccine-assignments', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const assignments = await VaccineProtocolService.getAnimalAssignments(req.params.animalId);
  res.json({ success: true, data: assignments });
}));

router.post('/animals/:animalId/vaccine-assignments', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { protocolId, notes } = req.body;
  if (!protocolId) return res.status(400).json({ success: false, message: 'protocolId required' });
  const assignment = await VaccineProtocolService.assignProtocolToAnimal(
    req.params.animalId, protocolId, authReq.userId!, notes
  );
  // Auto-generate schedule rows
  const animalRes = await database.query(
    `SELECT date_of_birth FROM animals WHERE id = $1`, [req.params.animalId]
  );
  await VaccineScheduleService.generateScheduleForAnimal(
    req.params.animalId, protocolId, animalRes.rows[0]?.date_of_birth ?? null
  );
  res.status(201).json({ success: true, data: assignment });
}));

router.patch('/animals/:animalId/vaccine-assignments/:protocolId/waive', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body;
  await VaccineProtocolService.waiverProtocol(req.params.animalId, req.params.protocolId, reason || 'Owner waiver');
  res.json({ success: true, message: 'Protocol waived' });
}));

// ─── Vaccine schedule routes ─────────────────────────────────
router.get('/vaccine-schedule/animal/:animalId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const rows = await VaccineScheduleService.getAnimalSchedule(req.params.animalId);
  res.json({ success: true, data: rows });
}));

router.patch('/vaccine-schedule/:scheduleId/administer', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { vaccinationRecordId, administeredAt } = req.body;
  if (!vaccinationRecordId) return res.status(400).json({ success: false, message: 'vaccinationRecordId required' });
  await VaccineScheduleService.markDoseAdministered(
    req.params.scheduleId, vaccinationRecordId, administeredAt || new Date().toISOString().split('T')[0]
  );
  res.json({ success: true, message: 'Dose marked administered' });
}));

// ─── Vaccination Passport routes ─────────────────────────────
router.get('/vaccination-passport/animal/:animalId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  // Pet owners and farmers may only access their own animal's passport
  if (authReq.userRole !== 'admin' && authReq.userRole !== 'veterinarian') {
    const { rows } = await database.query(
      'SELECT owner_id FROM animals WHERE id = $1',
      [req.params.animalId]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Animal not found' });
    if (rows[0].owner_id !== authReq.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
  }
  const passport = await VaccineScheduleService.getAnimalPassport(req.params.animalId);
  if (!passport) return res.status(404).json({ success: false, message: 'Animal not found' });
  res.json({ success: true, data: passport });
}));

router.get('/vaccination-passport/compliance-summary', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { enterpriseId, species } = req.query as Record<string, string>;
  const isAdmin = authReq.userRole === 'admin';
  const isVet = authReq.userRole === 'veterinarian';
  const ownerId = (isAdmin || isVet) ? undefined : authReq.userId;
  const data = await VaccineScheduleService.getComplianceSummary({
    enterpriseId: enterpriseId || undefined,
    ownerId,
    species: species || undefined,
  });
  res.json({ success: true, data });
}));

// Group vaccination passport - the passport for a batch herd/flock is the group's, not a bird's.
// Farmers/vets/admins may view any group they can see; pet owners are blocked (groups are farm assets).
router.get('/vaccination-passport/group/:groupId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (authReq.userRole === 'pet_owner') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  if (authReq.userRole !== 'admin' && authReq.userRole !== 'veterinarian') {
    // farmer: only their own enterprise's group
    const { rows } = await database.query(
      `SELECT 1 FROM animal_groups ag
         JOIN enterprises e ON e.id = ag.enterprise_id
        WHERE ag.id = $1 AND e.owner_id = $2`,
      [req.params.groupId, authReq.userId]
    );
    if (!rows[0]) return res.status(403).json({ success: false, message: 'Access denied' });
  }
  const passport = await VaccineProtocolService.getGroupVaccinationPassport(req.params.groupId);
  res.json({ success: true, data: passport });
}));

// ─── Certificate log routes ───────────────────────────────────
router.post('/vaccine-certificate-log', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { animalId, vaccinationRecordId, certificateType, fileName } = req.body;
  if (!animalId) return res.status(400).json({ success: false, message: 'animalId required' });
  const entry = await VaccineProtocolService.logCertificateDownload({
    animalId,
    vaccinationRecordId: vaccinationRecordId ?? null,
    generatedBy: authReq.userId!,
    certificateType: certificateType ?? 'single',
    fileName: fileName ?? null,
  });
  res.status(201).json({ success: true, data: entry });
}));

router.get('/vaccine-certificate-log/animal/:animalId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  // Pet owners and farmers may only view certificate logs for their own animals
  if (authReq.userRole !== 'admin' && authReq.userRole !== 'veterinarian') {
    const { rows } = await database.query(
      'SELECT owner_id FROM animals WHERE id = $1',
      [req.params.animalId]
    );
    if (rows[0] && rows[0].owner_id !== authReq.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
  }
  const logs = await VaccineProtocolService.getCertificateLogs(req.params.animalId);
  res.json({ success: true, data: logs });
}));

// ─── Role Change Requests ─────────────────────────────────────
// User submits a role change request
router.post('/role-change-requests', authMiddleware, validateBody(roleChangeRequestSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const { requested_role, reason, profile } = req.body;
  const userId = authReq.userId;
  const currentRole = authReq.userRole;
  if (requested_role === currentRole) {
    return res.status(400).json({ success: false, message: 'Requested role is the same as your current role' });
  }
  const existing = await (await import('../utils/database')).default.query(
    `SELECT id FROM role_change_requests WHERE user_id = $1 AND status = 'pending'`, [userId]
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({ success: false, message: 'You already have a pending role change request' });
  }
  // Store role-specific details (validated by roleChangeRequestSchema) so the admin can
  // review + provision the satellite profile on approval. Empty object for non-vet roles.
  const profilePayload = requested_role === 'veterinarian' && profile ? profile : {};
  const result = await (await import('../utils/database')).default.query(
    `INSERT INTO role_change_requests (user_id, "current_role", requested_role, reason, profile_payload)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, status, created_at`,
    [userId, currentRole, requested_role, reason, JSON.stringify(profilePayload)]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}));

// User views their own role change requests
router.get('/role-change-requests/my', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const result = await (await import('../utils/database')).default.query(
    `SELECT r.id, r."current_role" AS "currentRole", r.requested_role AS "requestedRole",
            r.reason, r.status, r.rejection_reason AS "rejectionReason",
            r.reviewed_at AS "reviewedAt", r.created_at AS "createdAt",
            u.first_name || ' ' || u.last_name AS "reviewedBy"
     FROM role_change_requests r
     LEFT JOIN users u ON u.id = r.reviewed_by
     WHERE r.user_id = $1
     ORDER BY r.created_at DESC`,
    [authReq.userId]
  );
  res.json({ success: true, data: result.rows });
}));

// User cancels their own pending request
router.put('/role-change-requests/:id/cancel', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const result = await (await import('../utils/database')).default.query(
    `UPDATE role_change_requests SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id`,
    [req.params.id, authReq.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Request not found or already processed' });
  res.json({ success: true });
}));

// Admin lists all role change requests
router.get('/admin/role-change-requests', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { status = 'pending' } = req.query;
  const result = await (await import('../utils/database')).default.query(
    `SELECT r.id, r."current_role" AS "currentRole", r.requested_role AS "requestedRole",
            r.reason, r.profile_payload AS "profilePayload", r.created_at AS "createdAt",
            u.first_name || ' ' || u.last_name AS "userName",
            u.email AS "userEmail", u.unique_id AS "uniqueId",
            r.rejection_reason AS "rejectionReason", r.reviewed_at AS "reviewedAt",
            rev.first_name || ' ' || rev.last_name AS "reviewedBy"
     FROM role_change_requests r
     JOIN users u ON u.id = r.user_id
     LEFT JOIN users rev ON rev.id = r.reviewed_by
     WHERE r.status = $1
     ORDER BY r.created_at ASC`,
    [status]
  );
  res.json({ success: true, data: result.rows });
}));

// Admin approves a role change request
router.put('/admin/role-change-requests/:id/approve', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const db = (await import('../utils/database')).default;
  const rcrResult = await db.query(
    `SELECT r.*, u.id AS "uid" FROM role_change_requests r JOIN users u ON u.id = r.user_id WHERE r.id = $1`,
    [req.params.id]
  );
  if (rcrResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Request not found' });
  const rcr = rcrResult.rows[0];
  if (rcr.status !== 'pending') return res.status(400).json({ success: false, message: 'Request is no longer pending' });

  // Provision the role's satellite profile in the SAME transaction as the role flip, so a
  // user approved into 'veterinarian' always gets a vet_profiles row and is immediately
  // visible/bookable in Find Doctor (which INNER JOINs vet_profiles). Admin-approval counts
  // as verification, so is_verified/is_available = true (mirrors AdminService.approveUser).
  await db.transaction(async (client: any) => {
    await client.query(`UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`, [rcr.requested_role, rcr.uid]);

    if (rcr.requested_role === 'veterinarian') {
      const p = rcr.profile_payload || {};
      await client.query(
        `INSERT INTO vet_profiles
           (user_id, license_number, specializations, qualifications, years_of_experience,
            clinic_name, consultation_fee, is_verified, is_available)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)
         ON CONFLICT (user_id) DO UPDATE SET
           license_number      = COALESCE(NULLIF(EXCLUDED.license_number, ''), vet_profiles.license_number),
           specializations     = CASE WHEN cardinality(EXCLUDED.specializations) > 0 THEN EXCLUDED.specializations ELSE vet_profiles.specializations END,
           qualifications      = CASE WHEN cardinality(EXCLUDED.qualifications) > 0 THEN EXCLUDED.qualifications ELSE vet_profiles.qualifications END,
           years_of_experience = GREATEST(EXCLUDED.years_of_experience, vet_profiles.years_of_experience),
           clinic_name         = COALESCE(NULLIF(EXCLUDED.clinic_name, ''), vet_profiles.clinic_name),
           consultation_fee    = CASE WHEN EXCLUDED.consultation_fee > 0 THEN EXCLUDED.consultation_fee ELSE vet_profiles.consultation_fee END,
           is_verified         = true,
           is_available        = true,
           updated_at          = NOW()`,
        [
          rcr.uid,
          (p.licenseNumber || '').toString().trim(),
          Array.isArray(p.specializations) ? p.specializations : [],
          Array.isArray(p.qualifications) ? p.qualifications : [],
          Number(p.yearsOfExperience) || 0,
          (p.clinicName || '').toString().trim(),
          Number(p.consultationFee) || 0,
        ]
      );
    }

    await client.query(
      `UPDATE role_change_requests SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [authReq.userId, req.params.id]
    );
  });
  res.json({ success: true, message: 'Role change approved. User must re-login to receive new permissions.' });
}));

// Admin rejects a role change request
router.put('/admin/role-change-requests/:id/reject', authMiddleware, roleMiddleware(['admin']), validateBody(rejectRoleChangeSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const { rejection_reason } = req.body;
  const db = (await import('../utils/database')).default;
  const rcrResult = await db.query(`SELECT id, status FROM role_change_requests WHERE id = $1`, [req.params.id]);
  if (rcrResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Request not found' });
  if (rcrResult.rows[0].status !== 'pending') return res.status(400).json({ success: false, message: 'Request is no longer pending' });
  await db.query(
    `UPDATE role_change_requests SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), rejection_reason = $2, updated_at = NOW() WHERE id = $3`,
    [authReq.userId, rejection_reason, req.params.id]
  );
  res.json({ success: true });
}));


export default router;
