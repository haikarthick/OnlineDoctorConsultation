import { Router, Request, Response } from 'express';
import { authMiddleware, roleMiddleware, validateBody } from '../middleware/auth';
import { groomingEnabled } from '../middleware/grooming';
import { asyncHandler } from '../utils/errorHandler';
import GroomingProviderService from '../services/grooming/GroomingProviderService';
import GroomingOrderService from '../services/grooming/GroomingOrderService';
import GroomingScheduleService from '../services/grooming/GroomingScheduleService';
import GroomingSettlementService from '../services/grooming/GroomingSettlementService';
import GroomingCareService from '../services/grooming/GroomingCareService';
import GroomingDisputeService from '../services/grooming/GroomingDisputeService';
import GroomingReportService from '../services/grooming/GroomingReportService';
import GroomingPaymentService from '../services/grooming/GroomingPaymentService';
import GroomingModuleConfig from '../services/grooming/GroomingModuleConfig';
import {
  createGroomingProviderSchema, updateGroomingProviderSchema, groomingLocationSchema,
  groomingResourceSchema, groomingServiceSchema, updateGroomingServiceSchema,
  groomingStaffSchema, groomingProviderRejectSchema,
  createGroomingOrderSchema, groomingCancelSchema, groomingAcceptSchema, groomingDeclineSchema,
  groomingScheduleSchema, groomingDateOverrideSchema, groomingBlockedSlotSchema,
  groomingTransitionSchema, groomingAssignSchema, groomingIntakeSchema,
  groomingItemStatusSchema, groomingReportCardSchema, groomingSettleSchema,
  groomingVariableRequestSchema, groomingVariableRespondSchema,
  groomingEscalationSchema, groomingEscalationRespondSchema,
  groomingDisputeSchema, groomingDisputeRespondSchema,
} from '../middleware/validation';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// PET WELLNESS / GROOMING & SPA MODULE (P1: onboarding + discovery + admin verify)
// Dark-launched behind grooming.enabled (groomingEnabled middleware → 404 when off).
// Provider-scoped isolation enforced inside GroomingProviderService.resolveProviderAccess.
// ═══════════════════════════════════════════════════════════════════════════

// Public status probe (NO gate) so the frontend can hide the whole module when disabled.
router.get('/grooming/status', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: { enabled: await GroomingModuleConfig.isEnabled() } });
}));

// ── Provider onboarding (self-service) ──
router.post('/grooming/providers', authMiddleware, groomingEnabled, validateBody(createGroomingProviderSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const p = await GroomingProviderService.createProvider((req as any).userId, req.body);
    res.status(201).json({ success: true, data: p });
  }));

router.get('/grooming/providers/me', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingProviderService.getMyProvider((req as any).userId) });
  }));

router.put('/grooming/providers/:id', authMiddleware, groomingEnabled, validateBody(updateGroomingProviderSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingProviderService.updateProvider((req as any).userId, req.params.id, req.body) });
  }));

// ── Locations ──
router.get('/grooming/providers/:id/locations', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    if (!await GroomingProviderService.resolveProviderAccess((req as any).userId, req.params.id))
      return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: await GroomingProviderService.listLocations(req.params.id) });
  }));
router.post('/grooming/providers/:id/locations', authMiddleware, groomingEnabled, validateBody(groomingLocationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingProviderService.addLocation((req as any).userId, req.params.id, req.body) });
  }));
router.delete('/grooming/providers/:id/locations/:locId', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    await GroomingProviderService.deleteLocation((req as any).userId, req.params.id, req.params.locId);
    res.json({ success: true });
  }));

// ── Resources ──
router.get('/grooming/providers/:id/resources', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    if (!await GroomingProviderService.resolveProviderAccess((req as any).userId, req.params.id))
      return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: await GroomingProviderService.listResources(req.params.id) });
  }));
router.post('/grooming/providers/:id/resources', authMiddleware, groomingEnabled, validateBody(groomingResourceSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingProviderService.addResource((req as any).userId, req.params.id, req.body) });
  }));
router.delete('/grooming/providers/:id/resources/:resId', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    await GroomingProviderService.deleteResource((req as any).userId, req.params.id, req.params.resId);
    res.json({ success: true });
  }));

// ── Services (catalog) ──
router.get('/grooming/providers/:id/services', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    if (!await GroomingProviderService.resolveProviderAccess((req as any).userId, req.params.id))
      return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: await GroomingProviderService.listServices(req.params.id) });
  }));
router.post('/grooming/providers/:id/services', authMiddleware, groomingEnabled, validateBody(groomingServiceSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingProviderService.addService((req as any).userId, req.params.id, req.body) });
  }));
router.put('/grooming/providers/:id/services/:svcId', authMiddleware, groomingEnabled, validateBody(updateGroomingServiceSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingProviderService.updateService((req as any).userId, req.params.id, req.params.svcId, req.body) });
  }));
router.delete('/grooming/providers/:id/services/:svcId', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    await GroomingProviderService.deleteService((req as any).userId, req.params.id, req.params.svcId);
    res.json({ success: true });
  }));

// ── Staff ──
router.get('/grooming/providers/:id/staff', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    if (!await GroomingProviderService.resolveProviderAccess((req as any).userId, req.params.id))
      return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: await GroomingProviderService.listStaff(req.params.id) });
  }));
router.post('/grooming/providers/:id/staff', authMiddleware, groomingEnabled, validateBody(groomingStaffSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as any;
    res.status(201).json({ success: true, data: await GroomingProviderService.addStaffByEmail(authReq.userId, req.params.id, req.body.email, req.body.role, authReq.userId) });
  }));
router.delete('/grooming/providers/:id/staff/:userId', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    await GroomingProviderService.removeStaff((req as any).userId, req.params.id, req.params.userId);
    res.json({ success: true });
  }));

// ── Public discovery (verified providers only) ──
router.get('/grooming/discover', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    const { mobile, species, search, limit, offset } = req.query;
    const result = await GroomingProviderService.listPublicProviders({
      mobile: mobile === 'true', species, search, limit, offset,
    });
    res.json({ success: true, data: result });
  }));
router.get('/grooming/providers/:id/public', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingProviderService.getPublicProvider(req.params.id) });
  }));

// ── Admin verification ──
router.get('/grooming/admin/providers', authMiddleware, roleMiddleware(['admin']), groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingProviderService.adminListProviders((req.query.status as string) || 'pending') });
  }));
router.put('/grooming/admin/providers/:id/verify', authMiddleware, roleMiddleware(['admin']), groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingProviderService.adminVerify(req.params.id, (req as any).userId) });
  }));
router.put('/grooming/admin/providers/:id/reject', authMiddleware, roleMiddleware(['admin']), groomingEnabled, validateBody(groomingProviderRejectSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingProviderService.adminReject(req.params.id, (req as any).userId, req.body.reason) });
  }));
router.put('/grooming/admin/providers/:id/suspend', authMiddleware, roleMiddleware(['admin']), groomingEnabled, validateBody(groomingProviderRejectSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingProviderService.adminSuspend(req.params.id, (req as any).userId, req.body.reason) });
  }));

// ── Availability & working hours (037) ──
// Slot reads are PUBLIC (authMiddleware only, no provider membership): a customer must be able
// to see when a salon is free before booking. They expose times and remaining capacity only -
// never customer or order details.
router.get('/grooming/providers/:id/availability', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: await GroomingScheduleService.getAvailability(req.params.id, String(req.query.date || ''), {
        serviceId: req.query.serviceId ? String(req.query.serviceId) : undefined,
        locationId: req.query.locationId ? String(req.query.locationId) : null,
      }),
    });
  }));
router.get('/grooming/providers/:id/availability/month', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: await GroomingScheduleService.getMonthAvailability(
        req.params.id, Number(req.query.year), Number(req.query.month), {
          serviceId: req.query.serviceId ? String(req.query.serviceId) : undefined,
          locationId: req.query.locationId ? String(req.query.locationId) : null,
        }),
    });
  }));

// Weekly working hours - owner/manager only (enforced in the service).
router.get('/grooming/providers/:id/schedules', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingScheduleService.listSchedules((req as any).userId, req.params.id) });
  }));
router.put('/grooming/providers/:id/schedules', authMiddleware, groomingEnabled, validateBody(groomingScheduleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingScheduleService.saveSchedule((req as any).userId, req.params.id, req.body) });
  }));
router.delete('/grooming/providers/:id/schedules/:scheduleId', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    await GroomingScheduleService.deleteSchedule((req as any).userId, req.params.id, req.params.scheduleId);
    res.json({ success: true });
  }));

// Date overrides - closures and one-off hours.
router.get('/grooming/providers/:id/date-overrides', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingScheduleService.listOverrides(
      (req as any).userId, req.params.id, req.query.from as string, req.query.to as string) });
  }));
router.put('/grooming/providers/:id/date-overrides', authMiddleware, groomingEnabled, validateBody(groomingDateOverrideSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingScheduleService.saveOverride((req as any).userId, req.params.id, req.body) });
  }));
router.delete('/grooming/providers/:id/date-overrides/:overrideId', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    await GroomingScheduleService.deleteOverride((req as any).userId, req.params.id, req.params.overrideId);
    res.json({ success: true });
  }));

// Blocked ranges - breaks within an otherwise open day.
router.get('/grooming/providers/:id/blocked-slots', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingScheduleService.listBlockedSlots((req as any).userId, req.params.id) });
  }));
router.post('/grooming/providers/:id/blocked-slots', authMiddleware, groomingEnabled, validateBody(groomingBlockedSlotSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingScheduleService.createBlockedSlot((req as any).userId, req.params.id, req.body) });
  }));
router.delete('/grooming/providers/:id/blocked-slots/:slotId', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    await GroomingScheduleService.deleteBlockedSlot((req as any).userId, req.params.id, req.params.slotId);
    res.json({ success: true });
  }));

// ── Orders (P2: customer booking + provider view) ──
router.post('/grooming/orders', authMiddleware, groomingEnabled, validateBody(createGroomingOrderSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingOrderService.createOrder((req as any).userId, req.body) });
  }));
router.get('/grooming/orders', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.listMyOrders((req as any).userId) });
  }));
router.get('/grooming/orders/:id', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.getOrder((req as any).userId, req.params.id) });
  }));
// NOTE: the legacy POST /grooming/orders/:id/pay route was REMOVED. It was the demo-era
// "mark it paid" shortcut and it confirmed an order, set amount_paid and credited the provider
// WITHOUT taking any money - any customer could self-issue a free booking. Payment goes through
// /checkout + /confirm-payment (real gateway, verified capture) only.
// Real gateway checkout (demo auto-verifies; Razorpay opens on the client) + GST invoice
router.post('/grooming/orders/:id/checkout', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingPaymentService.createCheckout((req as any).userId, req.params.id, req.body?.deposit === true) });
  }));
router.post('/grooming/orders/:id/confirm-payment', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingPaymentService.confirmCheckout((req as any).userId, req.params.id, req.body || {}) });
  }));
// Balance collection (approved extra work / remainder after a deposit). Separate payments row
// per collection, linked by payments.grooming_order_id.
router.post('/grooming/orders/:id/balance-checkout', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingPaymentService.createBalanceCheckout((req as any).userId, req.params.id) });
  }));
router.post('/grooming/orders/:id/confirm-balance', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingPaymentService.confirmBalancePayment((req as any).userId, req.params.id, req.body || {}) });
  }));
// What the customer gets back if they cancel now - grooming's own policy engine, shown in the
// cancel dialog before they commit (mirrors /payments/refund-preview for consultations).
router.get('/grooming/orders/:id/refund-preview', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.getRefundPreview((req as any).userId, req.params.id) });
  }));
router.put('/grooming/orders/:id/cancel', authMiddleware, groomingEnabled, validateBody(groomingCancelSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.cancelOrder((req as any).userId, req.params.id, req.body?.reason) });
  }));
router.get('/grooming/providers/:id/orders', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.listProviderOrders((req as any).userId, req.params.id, req.query.status as string) });
  }));

// ── Provider acceptance gate (036) ──
// Provider staff only (enforced in the service via requireProviderStaff). Accepting confirms the
// appointment; declining triggers a full no-fault refund, so a reason is mandatory.
router.put('/grooming/orders/:id/accept', authMiddleware, groomingEnabled, validateBody(groomingAcceptSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.acceptOrder((req as any).userId, req.params.id, req.body?.note) });
  }));
router.put('/grooming/orders/:id/decline', authMiddleware, groomingEnabled, validateBody(groomingDeclineSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.declineOrder((req as any).userId, req.params.id, req.body.reason) });
  }));

// ── Order detail + ops workflow (P3) ──
router.get('/grooming/orders/:id/detail', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.getOrderDetail((req as any).userId, req.params.id) });
  }));
router.put('/grooming/orders/:id/transition', authMiddleware, groomingEnabled, validateBody(groomingTransitionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.transitionOrder((req as any).userId, req.params.id, req.body.toStatus, req.body.note) });
  }));
router.put('/grooming/orders/:id/assign', authMiddleware, groomingEnabled, validateBody(groomingAssignSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.assignOrder((req as any).userId, req.params.id, req.body) });
  }));
router.put('/grooming/orders/:id/intake', authMiddleware, groomingEnabled, validateBody(groomingIntakeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.saveIntake((req as any).userId, req.params.id, req.body) });
  }));
router.put('/grooming/orders/:id/items/:itemId', authMiddleware, groomingEnabled, validateBody(groomingItemStatusSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.updateItemStatus((req as any).userId, req.params.id, req.params.itemId, req.body.status, { reason: req.body.reason, photoUrl: req.body.photoUrl }) });
  }));
router.put('/grooming/orders/:id/report-card', authMiddleware, groomingEnabled, validateBody(groomingReportCardSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.createReportCard((req as any).userId, req.params.id, req.body) });
  }));
// P4: variable-price (extra work) approval
router.post('/grooming/orders/:id/variable-items', authMiddleware, groomingEnabled, validateBody(groomingVariableRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingOrderService.requestVariableItem((req as any).userId, req.params.id, req.body) });
  }));
router.put('/grooming/orders/:id/variable-items/:itemId/respond', authMiddleware, groomingEnabled, validateBody(groomingVariableRespondSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.respondVariableItem((req as any).userId, req.params.id, req.params.itemId, req.body.approve === true) });
  }));

// ── Earnings + manual settlement (P3) ──
router.get('/grooming/providers/:id/earnings', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingSettlementService.getEarnings((req as any).userId, req.params.id) });
  }));
router.get('/grooming/providers/:id/settlements', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as any;
    const isAdmin = authReq.userRole === 'admin' || (authReq.userRoles || []).includes('admin');
    res.json({ success: true, data: await GroomingSettlementService.listSettlements(authReq.userId, req.params.id, isAdmin) });
  }));
router.post('/grooming/admin/providers/:id/settle', authMiddleware, roleMiddleware(['admin']), groomingEnabled, validateBody(groomingSettleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingSettlementService.adminSettle((req as any).userId, req.params.id, req.body) });
  }));
router.get('/grooming/admin/providers/:id/earnings', authMiddleware, roleMiddleware(['admin']), groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingSettlementService.getEarningsAdmin(req.params.id) });
  }));
// "Who do I owe, and how much" - the register that made manual settlement operable.
router.get('/grooming/admin/payables', authMiddleware, roleMiddleware(['admin']), groomingEnabled,
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingSettlementService.adminPayables() });
  }));
// Statement of exactly which earnings one payout covered - the provider's reconciliation view.
router.get('/grooming/settlements/:settlementId/statement', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = ((req as any).userRoles || []).includes('admin');
    res.json({ success: true, data: await GroomingSettlementService.getSettlementStatement(
      (req as any).userId, req.params.settlementId, isAdmin) });
  }));
router.get('/grooming/admin/reconciliation', authMiddleware, roleMiddleware(['admin']), groomingEnabled,
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingSettlementService.adminReconciliation() });
  }));

// ── P5: safety escalation (groomer → vet) + grooming passport ──
router.post('/grooming/orders/:id/escalations', authMiddleware, groomingEnabled, validateBody(groomingEscalationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingCareService.raiseEscalation((req as any).userId, req.params.id, req.body) });
  }));
router.get('/grooming/orders/:id/escalations', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingCareService.listEscalations((req as any).userId, req.params.id) });
  }));
router.put('/grooming/escalations/:id/respond', authMiddleware, groomingEnabled, validateBody(groomingEscalationRespondSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingCareService.respondEscalation((req as any).userId, req.params.id, req.body) });
  }));
router.get('/grooming/pets/:animalId/passport', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingCareService.getPetPassport((req as any).userId, req.params.animalId) });
  }));

// ── P6: disputes & refunds ──
router.post('/grooming/orders/:id/disputes', authMiddleware, groomingEnabled, validateBody(groomingDisputeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingDisputeService.raiseDispute((req as any).userId, req.params.id, req.body) });
  }));
router.get('/grooming/disputes/mine', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingDisputeService.listMyDisputes((req as any).userId) });
  }));
router.get('/grooming/providers/:id/disputes', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingDisputeService.listProviderDisputes((req as any).userId, req.params.id) });
  }));
router.get('/grooming/admin/disputes', authMiddleware, roleMiddleware(['admin']), groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingDisputeService.adminListDisputes(req.query.status as string) });
  }));
router.put('/grooming/disputes/:id/respond', authMiddleware, groomingEnabled, validateBody(groomingDisputeRespondSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as any;
    const isAdmin = authReq.userRole === 'admin' || (authReq.userRoles || []).includes('admin');
    res.json({ success: true, data: await GroomingDisputeService.respondDispute(authReq.userId, isAdmin, req.params.id, req.body) });
  }));

// ── P7: reports ──
router.get('/grooming/providers/:id/report', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as any;
    const isAdmin = authReq.userRole === 'admin' || (authReq.userRoles || []).includes('admin');
    res.json({ success: true, data: await GroomingReportService.providerReport(authReq.userId, req.params.id, isAdmin) });
  }));
router.get('/grooming/admin/report', authMiddleware, roleMiddleware(['admin']), groomingEnabled,
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingReportService.platformReport() });
  }));


export default router;
