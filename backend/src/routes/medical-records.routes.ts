import { Router, Request, Response } from 'express';
import { authMiddleware, roleMiddleware, validateBody } from '../middleware/auth';
import { requireAnimalAccess } from '../middleware/hospitalDataIsolation';
import { asyncHandler } from '../utils/errorHandler';
import MedicalRecordController from '../controllers/MedicalRecordController';
import NotificationController from '../controllers/NotificationController';
import {
  createMedicalRecordSchema, updateMedicalRecordSchema,
  createVaccinationSchema, updateVaccinationSchema,
  addWeightSchema, createAllergySchema, updateAllergySchema, createLabResultSchema, updateLabResultSchema,
} from '../middleware/validation';

const router = Router();

// ─── Medical Record routes ───────────────────────────────────
// HIGH FIX-5: Added requireAnimalAccess for stats endpoint to prevent leaking per-animal counts
router.get('/medical-records/stats', authMiddleware, requireAnimalAccess('query:animalId', 'stats'), asyncHandler((req: Request, res: Response) => MedicalRecordController.getStats(req, res)));
router.get('/medical-records/audit', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.getAuditLog(req, res)));
router.post('/medical-records', authMiddleware, roleMiddleware(['veterinarian', 'farmer', 'admin']), validateBody(createMedicalRecordSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.createRecord(req, res)));
router.get('/medical-records', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.listRecords(req, res)));
router.get('/medical-records/:id', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.getRecord(req, res)));
router.put('/medical-records/:id', authMiddleware, validateBody(updateMedicalRecordSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.updateRecord(req, res)));
router.delete('/medical-records/:id', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.deleteRecord(req, res)));

// ─── Vaccination routes ──────────────────────────────────────
router.post('/vaccinations', authMiddleware, validateBody(createVaccinationSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.createVaccination(req, res)));
router.get('/vaccinations/animal/:animalId', authMiddleware, requireAnimalAccess('params:animalId', 'vaccinations'), asyncHandler((req: Request, res: Response) => MedicalRecordController.listVaccinations(req, res)));
router.put('/vaccinations/:id', authMiddleware, validateBody(updateVaccinationSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.updateVaccination(req, res)));
router.delete('/vaccinations/:id', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.deleteVaccination(req, res)));

// ─── Weight History routes ───────────────────────────────────
// CRITICAL FIX: Added requireAnimalAccess for body:animalId (POST) and params:animalId (GET)
router.post('/weight-history', authMiddleware, requireAnimalAccess('body:animalId', 'weight'), validateBody(addWeightSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.addWeight(req, res)));
router.get('/weight-history/animal/:animalId', authMiddleware, requireAnimalAccess('params:animalId', 'weight'), asyncHandler((req: Request, res: Response) => MedicalRecordController.listWeightHistory(req, res)));

// ─── Allergy routes ─────────────────────────────────────────
// CRITICAL FIX: Added requireAnimalAccess for all allergy routes
router.post('/allergies', authMiddleware, requireAnimalAccess('body:animalId', 'allergies'), validateBody(createAllergySchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.createAllergy(req, res)));
router.get('/allergies/animal/:animalId', authMiddleware, requireAnimalAccess('params:animalId', 'allergies'), asyncHandler((req: Request, res: Response) => MedicalRecordController.listAllergies(req, res)));
router.put('/allergies/:id', authMiddleware, requireAnimalAccess('body:animalId', 'allergies'), validateBody(updateAllergySchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.updateAllergy(req, res)));

// ─── Lab Result routes ──────────────────────────────────────
// CRITICAL FIX: Added requireAnimalAccess for all lab result routes
router.post('/lab-results', authMiddleware, requireAnimalAccess('body:animalId', 'lab_results'), validateBody(createLabResultSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.createLabResult(req, res)));
router.get('/lab-results/animal/:animalId', authMiddleware, requireAnimalAccess('params:animalId', 'lab_results'), asyncHandler((req: Request, res: Response) => MedicalRecordController.listLabResults(req, res)));
router.put('/lab-results/:id', authMiddleware, requireAnimalAccess('body:animalId', 'lab_results'), validateBody(updateLabResultSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.updateLabResult(req, res)));

// ─── Medical Timeline route ─────────────────────────────────
// CRITICAL FIX: Added requireAnimalAccess for timeline
router.get('/timeline/animal/:animalId', authMiddleware, requireAnimalAccess('params:animalId', 'timeline'), asyncHandler((req: Request, res: Response) => MedicalRecordController.getTimeline(req, res)));

// ─── Notification routes ─────────────────────────────────────
router.get('/notifications', authMiddleware, asyncHandler((req: Request, res: Response) => NotificationController.listNotifications(req, res)));
router.put('/notifications/:id/read', authMiddleware, asyncHandler((req: Request, res: Response) => NotificationController.markAsRead(req, res)));
router.put('/notifications/read-all', authMiddleware, asyncHandler((req: Request, res: Response) => NotificationController.markAllAsRead(req, res)));


export default router;
