import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import AuthController from '../controllers/AuthController';
import ConsultationController from '../controllers/ConsultationController';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

// Auth routes
router.post('/auth/register', asyncHandler((req, res) => AuthController.register(req, res)));
router.post('/auth/login', asyncHandler((req, res) => AuthController.login(req, res)));
router.get('/auth/profile', authMiddleware, asyncHandler((req, res) => AuthController.getProfile(req, res)));

// Consultation routes
router.post(
  '/consultations',
  authMiddleware,
  asyncHandler((req, res) => ConsultationController.createConsultation(req, res))
);

router.get(
  '/consultations/:id',
  authMiddleware,
  asyncHandler((req, res) => ConsultationController.getConsultation(req, res))
);

router.put(
  '/consultations/:id',
  authMiddleware,
  asyncHandler((req, res) => ConsultationController.updateConsultation(req, res))
);

router.get(
  '/consultations',
  authMiddleware,
  asyncHandler((req, res) => ConsultationController.listConsultations(req, res))
);

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

export default router;
