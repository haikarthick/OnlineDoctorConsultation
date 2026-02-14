import { Router, Request, Response } from 'express';
import { authMiddleware, roleMiddleware, validateBody } from '../middleware/auth';
import { registerSchema, loginSchema, createConsultationSchema, updateConsultationSchema } from '../middleware/validation';
import { requireFeature, getAllFeatureFlags } from '../config/featureFlags';
import AuthController from '../controllers/AuthController';
import ConsultationController from '../controllers/ConsultationController';
import AnimalController from '../controllers/AnimalController';
import VetProfileController from '../controllers/VetProfileController';
import MedicalRecordController from '../controllers/MedicalRecordController';
import NotificationController from '../controllers/NotificationController';
import PaymentController from '../controllers/PaymentController';
import ReviewController from '../controllers/ReviewController';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

// ─── Auth routes ─────────────────────────────────────────────
router.post('/auth/register', validateBody(registerSchema), asyncHandler((req: Request, res: Response) => AuthController.register(req, res)));
router.post('/auth/login', validateBody(loginSchema), asyncHandler((req: Request, res: Response) => AuthController.login(req, res)));
router.get('/auth/profile', authMiddleware, asyncHandler((req: Request, res: Response) => AuthController.getProfile(req, res)));

// ─── Consultation routes ─────────────────────────────────────
router.post('/consultations', authMiddleware, validateBody(createConsultationSchema), asyncHandler((req: Request, res: Response) => ConsultationController.createConsultation(req, res)));
router.get('/consultations', authMiddleware, asyncHandler((req: Request, res: Response) => ConsultationController.listConsultations(req, res)));
router.get('/consultations/:id', authMiddleware, asyncHandler((req: Request, res: Response) => ConsultationController.getConsultation(req, res)));
router.put('/consultations/:id', authMiddleware, validateBody(updateConsultationSchema), asyncHandler((req: Request, res: Response) => ConsultationController.updateConsultation(req, res)));

// ─── Animal / Pet routes ─────────────────────────────────────
router.post('/animals', authMiddleware, asyncHandler((req: Request, res: Response) => AnimalController.createAnimal(req, res)));
router.get('/animals', authMiddleware, asyncHandler((req: Request, res: Response) => AnimalController.listAnimals(req, res)));
router.get('/animals/:id', authMiddleware, asyncHandler((req: Request, res: Response) => AnimalController.getAnimal(req, res)));
router.put('/animals/:id', authMiddleware, asyncHandler((req: Request, res: Response) => AnimalController.updateAnimal(req, res)));
router.delete('/animals/:id', authMiddleware, asyncHandler((req: Request, res: Response) => AnimalController.deleteAnimal(req, res)));

// ─── Vet Profile routes ─────────────────────────────────────
router.post('/vet-profiles', authMiddleware, asyncHandler((req: Request, res: Response) => VetProfileController.createProfile(req, res)));
router.get('/vet-profiles/me', authMiddleware, asyncHandler((req: Request, res: Response) => VetProfileController.getMyProfile(req, res)));
router.get('/vet-profiles', authMiddleware, asyncHandler((req: Request, res: Response) => VetProfileController.listVets(req, res)));
router.get('/vet-profiles/:userId', authMiddleware, asyncHandler((req: Request, res: Response) => VetProfileController.getProfile(req, res)));
router.put('/vet-profiles', authMiddleware, asyncHandler((req: Request, res: Response) => VetProfileController.updateProfile(req, res)));

// ─── Medical Record routes ───────────────────────────────────
router.post('/medical-records', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.createRecord(req, res)));
router.get('/medical-records', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.listRecords(req, res)));
router.get('/medical-records/:id', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.getRecord(req, res)));
router.put('/medical-records/:id', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.updateRecord(req, res)));
router.delete('/medical-records/:id', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.deleteRecord(req, res)));

// ─── Notification routes (feature-gated) ─────────────────────
router.get('/notifications', authMiddleware, asyncHandler((req: Request, res: Response) => NotificationController.listNotifications(req, res)));
router.put('/notifications/:id/read', authMiddleware, asyncHandler((req: Request, res: Response) => NotificationController.markAsRead(req, res)));
router.put('/notifications/read-all', authMiddleware, asyncHandler((req: Request, res: Response) => NotificationController.markAllAsRead(req, res)));

// ─── Payment routes (feature-gated) ──────────────────────────
router.post('/payments', authMiddleware, requireFeature('payments'), asyncHandler((req: Request, res: Response) => PaymentController.createPayment(req, res)));
router.get('/payments', authMiddleware, requireFeature('payments'), asyncHandler((req: Request, res: Response) => PaymentController.listPayments(req, res)));
router.get('/payments/:id', authMiddleware, requireFeature('payments'), asyncHandler((req: Request, res: Response) => PaymentController.getPayment(req, res)));

// ─── Review routes ───────────────────────────────────────────
router.post('/reviews', authMiddleware, asyncHandler((req: Request, res: Response) => ReviewController.createReview(req, res)));
router.get('/reviews/vet/:vetId', authMiddleware, asyncHandler((req: Request, res: Response) => ReviewController.listReviews(req, res)));

// ─── Health check & feature flags ────────────────────────────
router.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

router.get('/features', (_req, res) => {
  res.json({ success: true, data: getAllFeatureFlags() });
});

export default router;
