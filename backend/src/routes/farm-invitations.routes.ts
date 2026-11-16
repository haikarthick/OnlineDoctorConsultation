import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { authMiddleware, validateBody } from '../middleware/auth';
import { asyncHandler } from '../utils/errorHandler';
import FarmInvitationService from '../services/FarmInvitationService';

// ═══════════════════════════════════════════════════════════════════
// Farm team invitations (migration 048). The owner / managers invite by mobile number and/or email;
// nobody asks to join and there is no farm directory. Who may invite whom is FarmAccessService's rule.
// The by-token and register routes are public on purpose: the invited person may have no account yet,
// and the link's random token is the proof they were invited (it carries 192 bits, only its hash is stored).
// ═══════════════════════════════════════════════════════════════════

const router = Router();
const actor = (req: Request) => ({ userId: (req as any).userId as string, role: (req as any).userRole as string | undefined });

const inviteSchema = Joi.object({
  phone: Joi.string().trim().max(30).allow('', null).optional(),
  email: Joi.string().trim().max(255).allow('', null).optional(),
  name: Joi.string().trim().max(150).allow('', null).optional(),
  role: Joi.string().valid('manager', 'supervisor', 'worker', 'farm_vet', 'viewer').required().messages({
    'any.only': 'Choose a role: manager, supervisor, worker, farm vet or viewer.', 'any.required': 'Choose a role for this person.',
  }),
});
const tokenSchema = Joi.object({ token: Joi.string().min(16).max(200).required() });
const registerSchema = Joi.object({
  token: Joi.string().min(16).max(200).required(),
  firstName: Joi.string().trim().min(2).max(100).required().messages({ 'string.min': 'Please enter your first name.', 'any.required': 'Please enter your first name.' }),
  lastName: Joi.string().trim().min(1).max(100).required().messages({ 'any.required': 'Please enter your last name.' }),
  email: Joi.string().trim().email().max(255).allow('', null).optional().messages({ 'string.email': 'Please enter a valid email address, or leave it blank.' }),
  password: Joi.string().min(8).max(128).required().pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).messages({
    'string.min': 'Password must be at least 8 characters.',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number.',
    'any.required': 'Please choose a password.',
  }),
});

// ── For the farm owner / managers ──
router.post('/enterprises/:id/invitations', authMiddleware, validateBody(inviteSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await FarmInvitationService.create(req.params.id, actor(req), req.body) });
}));
router.get('/enterprises/:id/invitations', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: { items: await FarmInvitationService.list(req.params.id, actor(req)) } });
}));
router.post('/enterprises/:id/invitations/:invitationId/resend', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await FarmInvitationService.resend(req.params.id, req.params.invitationId, actor(req)) });
}));
router.delete('/enterprises/:id/invitations/:invitationId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  await FarmInvitationService.revoke(req.params.id, req.params.invitationId, actor(req));
  res.json({ success: true });
}));

// ── For the invited person ──
router.get('/farm-invitations/by-token/:token', asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await FarmInvitationService.preview(req.params.token) });
}));
router.get('/farm-invitations/mine', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: { items: await FarmInvitationService.mine(actor(req).userId) } });
}));
router.post('/farm-invitations/accept', authMiddleware, validateBody(tokenSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await FarmInvitationService.accept(req.body.token, actor(req).userId) });
}));
router.post('/farm-invitations/decline', authMiddleware, validateBody(tokenSchema), asyncHandler(async (req: Request, res: Response) => {
  await FarmInvitationService.decline(req.body.token, actor(req).userId);
  res.json({ success: true });
}));
router.post('/farm-invitations/:id/accept', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await FarmInvitationService.acceptById(req.params.id, actor(req).userId) });
}));
router.post('/farm-invitations/:id/decline', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  await FarmInvitationService.declineById(req.params.id, actor(req).userId);
  res.json({ success: true });
}));
router.post('/farm-invitations/register', validateBody(registerSchema), asyncHandler(async (req: Request, res: Response) => {
  const { token, ...rest } = req.body;
  res.status(201).json({ success: true, data: await FarmInvitationService.registerFromInvite(token, rest) });
}));

export default router;
