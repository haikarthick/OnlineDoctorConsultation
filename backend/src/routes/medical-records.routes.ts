import { Router, Request, Response } from 'express';
import { authMiddleware, roleMiddleware, validateBody } from '../middleware/auth';
import { requireAnimalAccess } from '../middleware/hospitalDataIsolation';
import { requireAnimal, requireRecordAccess } from '../middleware/recordAccess';
import { asyncHandler } from '../utils/errorHandler';
import MedicalRecordController from '../controllers/MedicalRecordController';
import NotificationController from '../controllers/NotificationController';
import {
  createMedicalRecordSchema, createVaccinationSchema,
  addWeightSchema, createAllergySchema, createLabResultSchema, updateLabResultSchema,
  addAddendumSchema, markMistakeSchema,
} from '../middleware/validation';

const router = Router();

// ─── Medical Record routes ───────────────────────────────────
// HIGH FIX-5: Added requireAnimalAccess for stats endpoint to prevent leaking per-animal counts
router.get('/medical-records/stats', authMiddleware, requireAnimalAccess('query:animalId', 'stats'), requireAnimal('query:animalId'), asyncHandler((req: Request, res: Response) => MedicalRecordController.getStats(req, res)));
router.get('/medical-records/audit', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.getAuditLog(req, res)));
router.post('/medical-records', authMiddleware, roleMiddleware(['veterinarian', 'farmer', 'admin']), validateBody(createMedicalRecordSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.createRecord(req, res)));
router.get('/medical-records', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.listRecords(req, res)));
router.get('/medical-records/:id', authMiddleware, requireRecordAccess('medical_records'), asyncHandler((req: Request, res: Response) => MedicalRecordController.getRecord(req, res)));
// A saved record is never edited in place (owner decision 2026-11-25): it is corrected by an addendum, a new dated note on the record.
router.get('/medical-records/:id/addenda', authMiddleware, requireRecordAccess('medical_records'), asyncHandler((req: Request, res: Response) => MedicalRecordController.listAddenda(req, res)));
router.post('/medical-records/:id/addenda', authMiddleware, requireRecordAccess('medical_records'), validateBody(addAddendumSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.addAddendum(req, res)));
router.delete('/medical-records/:id', authMiddleware, requireRecordAccess('medical_records'), asyncHandler((req: Request, res: Response) => MedicalRecordController.deleteRecord(req, res)));

// ─── Vaccination routes ──────────────────────────────────────
router.post('/vaccinations', authMiddleware, requireAnimalAccess('body:animalId', 'vaccinations'), requireAnimal('body:animalId'), validateBody(createVaccinationSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.createVaccination(req, res)));
router.get('/vaccinations/animal/:animalId', authMiddleware, requireAnimalAccess('params:animalId', 'vaccinations'), requireAnimal('params:animalId'), asyncHandler((req: Request, res: Response) => MedicalRecordController.listVaccinations(req, res)));
// A wrong vaccination is marked "entered by mistake" (reason required), never overwritten or deleted.
router.post('/vaccinations/:id/mistake', authMiddleware, requireRecordAccess('vaccination_records'), validateBody(markMistakeSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.markVaccinationMistake(req, res)));

// ─── Weight History routes ───────────────────────────────────
// CRITICAL FIX: Added requireAnimalAccess for body:animalId (POST) and params:animalId (GET)
router.post('/weight-history', authMiddleware, requireAnimalAccess('body:animalId', 'weight'), requireAnimal('body:animalId'), validateBody(addWeightSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.addWeight(req, res)));
router.get('/weight-history/animal/:animalId', authMiddleware, requireAnimalAccess('params:animalId', 'weight'), requireAnimal('params:animalId'), asyncHandler((req: Request, res: Response) => MedicalRecordController.listWeightHistory(req, res)));

// ─── Allergy routes ─────────────────────────────────────────
// CRITICAL FIX: Added requireAnimalAccess for all allergy routes
router.post('/allergies', authMiddleware, requireAnimalAccess('body:animalId', 'allergies'), requireAnimal('body:animalId'), validateBody(createAllergySchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.createAllergy(req, res)));
router.get('/allergies/animal/:animalId', authMiddleware, requireAnimalAccess('params:animalId', 'allergies'), requireAnimal('params:animalId'), asyncHandler((req: Request, res: Response) => MedicalRecordController.listAllergies(req, res)));
router.post('/allergies/:id/mistake', authMiddleware, requireRecordAccess('allergy_records'), validateBody(markMistakeSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.markAllergyMistake(req, res)));

// ─── Lab Result routes ──────────────────────────────────────
// CRITICAL FIX: Added requireAnimalAccess for all lab result routes
router.post('/lab-results', authMiddleware, requireAnimalAccess('body:animalId', 'lab_results'), requireAnimal('body:animalId'), validateBody(createLabResultSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.createLabResult(req, res)));
router.get('/lab-results/animal/:animalId', authMiddleware, requireAnimalAccess('params:animalId', 'lab_results'), requireAnimal('params:animalId'), asyncHandler((req: Request, res: Response) => MedicalRecordController.listLabResults(req, res)));
router.put('/lab-results/:id', authMiddleware, requireRecordAccess('lab_results'), validateBody(updateLabResultSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.updateLabResult(req, res)));

// ─── Medical Timeline route ─────────────────────────────────
// CRITICAL FIX: Added requireAnimalAccess for timeline
router.get('/timeline/animal/:animalId', authMiddleware, requireAnimalAccess('params:animalId', 'timeline'), requireAnimal('params:animalId'), asyncHandler((req: Request, res: Response) => MedicalRecordController.getTimeline(req, res)));

// ─── Notification routes ─────────────────────────────────────
router.get('/notifications', authMiddleware, asyncHandler((req: Request, res: Response) => NotificationController.listNotifications(req, res)));
router.put('/notifications/:id/read', authMiddleware, asyncHandler((req: Request, res: Response) => NotificationController.markAsRead(req, res)));
router.put('/notifications/read-all', authMiddleware, asyncHandler((req: Request, res: Response) => NotificationController.markAllAsRead(req, res)));


export default router;
