import { Router, Request, Response } from 'express';
import { authMiddleware, roleMiddleware, validateBody, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/errorHandler';
import database from '../utils/database';
import { emitDataRefresh, emitRoleRefresh } from '../utils/socketIO';
import PaymentController from '../controllers/PaymentController';
import ReviewController from '../controllers/ReviewController';
import BookingController from '../controllers/BookingController';
import WalletController from '../controllers/WalletController';
import WalletWithdrawalService from '../services/WalletWithdrawalService';
import {
  createPaymentSchema, createReviewSchema,
  checkoutPaymentSchema, verifyPaymentSchema, legalAcceptSchema, adminLegalDocSchema, razorpayCredentialsSchema,
  createPlatformReferralSchema, acceptReferralSchema, declineReferralSchema,
  walletWithdrawalRequestSchema,
} from '../middleware/validation';

const router = Router();

// ─── Payment routes ──────────────────────────────────────────
// ─── Payment module: checkout lifecycle (docs/PAYMENT_MODULE_PLAN.md §9) ───
router.post('/payments/checkout/:bookingId', authMiddleware, validateBody(checkoutPaymentSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const PaymentOrchestrator = (await import('../services/payment/PaymentOrchestrator')).default;
  const breakdown = await PaymentOrchestrator.initiateCheckout(authReq.userId!, req.params.bookingId, req.body.useWallet === true);
  res.on('finish', () => { if (res.statusCode < 300 && authReq.userId) { emitDataRefresh(authReq.userId, 'bookings'); } });
  res.json({ success: true, data: breakdown });
}));

router.post('/payments/verify', authMiddleware, validateBody(verifyPaymentSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const PaymentOrchestrator = (await import('../services/payment/PaymentOrchestrator')).default;
  const PaymentModuleConfig = (await import('../services/payment/PaymentModuleConfig')).default;
  const mode = await PaymentModuleConfig.getGatewayMode();
  if (mode === 'demo') {
    await PaymentOrchestrator.completeDemoCheckout(authReq.userId!, req.body.paymentId);
  } else {
    const { paymentId, gatewayOrderId, gatewayPaymentId, gatewaySignature } = req.body;
    if (!gatewayOrderId || !gatewayPaymentId || !gatewaySignature) {
      return res.status(400).json({ success: false, error: 'gatewayOrderId, gatewayPaymentId and gatewaySignature are required' });
    }
    await PaymentOrchestrator.completeRazorpayCheckout(authReq.userId!, paymentId, gatewayOrderId, gatewayPaymentId, gatewaySignature);
  }
  res.on('finish', () => { if (res.statusCode < 300 && authReq.userId) { emitDataRefresh(authReq.userId, 'bookings'); emitRoleRefresh('admin', 'payments'); } });
  res.json({ success: true, message: 'Payment completed' });
}));

// Razorpay webhook (§12 rules 2-3): raw-body signature verification, no auth
// middleware, idempotent on gateway event id. Always 200 for processed events
// so Razorpay stops retrying; 400 only on signature failure.
router.post('/webhooks/razorpay', asyncHandler(async (req: Request, res: Response) => {
  const PaymentOrchestrator = (await import('../services/payment/PaymentOrchestrator')).default;
  const signature = (req.headers['x-razorpay-signature'] as string) || '';
  const eventId = (req.headers['x-razorpay-event-id'] as string) || null;
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf-8') : JSON.stringify(req.body || {});
  const result = await PaymentOrchestrator.handleRazorpayWebhook(rawBody, signature, eventId);
  if (!result.handled && result.reason === 'invalid_signature') {
    return res.status(400).json({ success: false, error: 'Invalid signature' });
  }
  res.json({ success: true });
}));

router.get('/payments/refund-preview/:bookingId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const booking = await database.query(
    `SELECT pet_owner_id, veterinarian_id FROM bookings WHERE id = $1`, [req.params.bookingId]
  );
  if (booking.rows.length === 0) return res.status(404).json({ success: false, error: 'Booking not found' });
  const b = booking.rows[0];
  if (b.pet_owner_id !== authReq.userId && b.veterinarian_id !== authReq.userId && authReq.userRole !== 'admin') {
    return res.status(403).json({ success: false, error: 'Not your booking' });
  }
  // Preview is computed for the role of the requester (patient sees patient policy, vet sees vet policy)
  const role = authReq.userId === b.pet_owner_id ? 'pet_owner' : (authReq.userId === b.veterinarian_id ? 'veterinarian' : 'admin');
  const PaymentOrchestrator = (await import('../services/payment/PaymentOrchestrator')).default;
  const preview = await PaymentOrchestrator.computeRefundPreview(req.params.bookingId, role);
  res.json({ success: true, data: preview });
}));

router.get('/payments/receipt/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const PaymentOrchestrator = (await import('../services/payment/PaymentOrchestrator')).default;
  const receipt = await PaymentOrchestrator.getReceipt(req.params.id, authReq.userId!, authReq.userRole || '');
  res.json({ success: true, data: receipt });
}));

// ─── Doctor earnings ledger (docs/PAYMENT_MODULE_PLAN.md §6) ───────────────
router.get('/earnings/summary', authMiddleware, roleMiddleware(['veterinarian']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const EarningsService = (await import('../services/payment/EarningsService')).default;
  const PaymentModuleConfig = (await import('../services/payment/PaymentModuleConfig')).default;
  const [balance, minWithdrawal, clearanceDays, enabled] = await Promise.all([
    EarningsService.getBalance(authReq.userId!),
    PaymentModuleConfig.getMinWithdrawalAmount(),
    PaymentModuleConfig.getClearanceDays(),
    PaymentModuleConfig.isEnabled(),
  ]);
  res.json({ success: true, data: { ...balance, minWithdrawalAmount: minWithdrawal, clearanceDays, paymentsEnabled: enabled } });
}));

router.get('/earnings/statement', authMiddleware, roleMiddleware(['veterinarian']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const EarningsService = (await import('../services/payment/EarningsService')).default;
  const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const result = await EarningsService.getStatement(authReq.userId!, limit, offset);
  res.json({ success: true, data: result });
}));

// ─── Invoices & GST (docs/PAYMENT_MODULE_PLAN.md §7) ───────────────────────
router.get('/invoices/payment/:paymentId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const InvoiceService = (await import('../services/payment/InvoiceService')).default;
  const invoice = await InvoiceService.getInvoiceByPayment(req.params.paymentId, authReq.userId!, authReq.userRole || '');
  res.json({ success: true, data: invoice });
}));

router.get('/invoices/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const InvoiceService = (await import('../services/payment/InvoiceService')).default;
  const invoice = await InvoiceService.getInvoice(req.params.id, authReq.userId!, authReq.userRole || '');
  res.json({ success: true, data: invoice });
}));

// Admin: SAC tax-code management (D13 - rate changes need zero code)
router.get('/admin/tax-codes', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (_req: Request, res: Response) => {
  const result = await database.query(
    `SELECT id, sac_code as "sacCode", label, rate_percent as "ratePercent", is_active as "isActive"
     FROM tax_codes ORDER BY sac_code`
  );
  res.json({ success: true, data: result.rows });
}));

router.put('/admin/tax-codes/:sacCode', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const rate = parseFloat(req.body.ratePercent);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    return res.status(400).json({ success: false, error: 'ratePercent must be between 0 and 100' });
  }
  const result = await database.query(
    `UPDATE tax_codes SET rate_percent = $1, updated_at = NOW() WHERE sac_code = $2
     RETURNING sac_code as "sacCode", rate_percent as "ratePercent"`,
    [rate, req.params.sacCode]
  );
  if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'SAC code not found' });
  await database.query(
    `INSERT INTO payment_events (id, event_type, actor_user_id, payload, created_at)
     VALUES (gen_random_uuid(), 'tax_rate_changed', $1, $2, NOW())`,
    [authReq.userId, JSON.stringify({ sacCode: req.params.sacCode, newRate: rate })]
  ).catch(() => {});
  res.json({ success: true, data: result.rows[0] });
}));

// Finance overview (§11): GMV, commission, refunds, liabilities, TDS, health
router.get('/admin/reports/finance/overview', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const from = (req.query.from as string) || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const to = (req.query.to as string) || new Date().toISOString().split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ success: false, error: 'from/to must be YYYY-MM-DD' });
  }
  const [payments, pharmacyPayments, earnings, wallets, tds, health] = await Promise.all([
    database.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE status IN ('completed', 'partially_refunded', 'refunded', 'transferred')), 0) as gmv,
         COALESCE(SUM(commission_amount) FILTER (WHERE status IN ('completed', 'partially_refunded')), 0) as commission_earned,
         COALESCE(SUM(refund_amount), 0) as refunds_out,
         COALESCE(SUM(processing_charge_amount), 0) as processing_charges,
         COALESCE(SUM(gateway_fee_amount) FILTER (WHERE status IN ('completed', 'partially_refunded', 'refunded', 'transferred')), 0) as gateway_fees,
         COUNT(*) FILTER (WHERE status IN ('completed', 'partially_refunded')) as paid_count
       FROM payments WHERE payment_source = 'consultation'
         AND created_at >= $1::date AND created_at < ($2::date + INTERVAL '1 day')`,
      [from, to]
    ),
    // Pharmacy revenue has no platform commission split (it's the network's own dispensing
    // revenue, not a consultation the platform brokered) - tracked separately from GMV/commission above.
    database.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as collected,
         COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as pending_amount,
         COUNT(*) FILTER (WHERE status = 'completed') as dispensed_count,
         COUNT(*) FILTER (WHERE status = 'pending') as pending_count
       FROM payments WHERE payment_source = 'pharmacy'
         AND created_at >= $1::date AND created_at < ($2::date + INTERVAL '1 day')`,
      [from, to]
    ),
    database.query(
      `SELECT
         COALESCE(SUM(net_amount) FILTER (WHERE status = 'clearing'), 0) as clearing,
         COALESCE(SUM(net_amount) FILTER (WHERE status = 'available'), 0) as available,
         COALESCE(SUM(net_amount) FILTER (WHERE status = 'locked'), 0) as locked,
         COUNT(DISTINCT doctor_id) FILTER (WHERE status = 'available' AND net_amount < 0) as negative_doctor_rows
       FROM doctor_earnings`
    ),
    database.query(
      `SELECT COALESCE(SUM(balance), 0) as balance, COALESCE(SUM(bonus_credits), 0) as bonus FROM wallets`
    ),
    database.query(
      `SELECT COALESCE(SUM(tds_amount), 0) as tds_total, COUNT(*) as settled_count,
              COALESCE(SUM(net_paid_amount), 0) as net_paid_total
       FROM withdrawal_requests
       WHERE status = 'settled' AND settled_at >= $1::date AND settled_at < ($2::date + INTERVAL '1 day')`,
      [from, to]
    ),
    database.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending' AND updated_at < NOW() - INTERVAL '1 hour') as stuck_pending,
         COUNT(*) FILTER (WHERE status IN ('created', 'pending')) as open_holds
       FROM payments WHERE payment_source = 'consultation'`
    ),
  ]);
  const p = payments.rows[0]; const pp = pharmacyPayments.rows[0]; const e = earnings.rows[0]; const w = wallets.rows[0];
  const t = tds.rows[0]; const h = health.rows[0];
  res.json({
    success: true,
    data: {
      range: { from, to },
      revenue: {
        gmv: parseFloat(p.gmv), commissionEarned: parseFloat(p.commission_earned),
        refundsOut: parseFloat(p.refunds_out), processingCharges: parseFloat(p.processing_charges),
        gatewayFees: parseFloat(p.gateway_fees), paidCount: parseInt(p.paid_count, 10),
        netPlatformRevenue: Math.round((parseFloat(p.commission_earned) + parseFloat(p.processing_charges) - parseFloat(p.gateway_fees)) * 100) / 100,
      },
      pharmacyRevenue: {
        collected: parseFloat(pp.collected), pendingAmount: parseFloat(pp.pending_amount),
        dispensedCount: parseInt(pp.dispensed_count, 10), pendingCount: parseInt(pp.pending_count, 10),
      },
      settlementLiability: {
        clearing: parseFloat(e.clearing), available: parseFloat(e.available), locked: parseFloat(e.locked),
      },
      walletLiability: {
        balance: parseFloat(w.balance), bonusCredits: parseFloat(w.bonus),
        total: Math.round((parseFloat(w.balance) + parseFloat(w.bonus)) * 100) / 100,
      },
      tds: {
        totalDeducted: parseFloat(t.tds_total), settledCount: parseInt(t.settled_count, 10),
        netPaidTotal: parseFloat(t.net_paid_total),
      },
      health: {
        stuckPending: parseInt(h.stuck_pending, 10), openHolds: parseInt(h.open_holds, 10),
      },
    },
  });
}));

router.get('/admin/reports/gst-export', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const from = (req.query.from as string) || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const to = (req.query.to as string) || new Date().toISOString().split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ success: false, error: 'from/to must be YYYY-MM-DD' });
  }
  const InvoiceService = (await import('../services/payment/InvoiceService')).default;
  const csv = await InvoiceService.gstExportCsv(from, to);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="gst-export-${from}-to-${to}.csv"`);
  res.send(csv);
}));

// ─── Platform referrals (docs/PAYMENT_MODULE_PLAN.md §4.4) ─────────────────
router.post('/referrals/platform', authMiddleware, roleMiddleware(['veterinarian']), validateBody(createPlatformReferralSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const ReferralService = (await import('../services/payment/ReferralService')).default;
  const result = await ReferralService.createReferral(authReq.userId!, {
    toVetId: req.body.toVetId || null,
    reason: req.body.reason,
    bookingId: req.body.bookingId,
    consultationId: req.body.consultationId,
  });
  res.status(201).json({ success: true, data: result });
}));

router.get('/referrals/platform/my', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const ReferralService = (await import('../services/payment/ReferralService')).default;
  res.json({ success: true, data: await ReferralService.listForUser(authReq.userId!, authReq.userRole || '') });
}));

// Doctor: items that can be referred (paid upcoming bookings + recent completed consultations)
router.get('/referrals/platform/referable', authMiddleware, roleMiddleware(['veterinarian']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const bookings = await database.query(
    `SELECT b.id, b.scheduled_date as "scheduledDate", b.time_slot_start as "timeSlotStart",
            b.status, b.priority, a.name as "animalName",
            CONCAT(po.first_name, ' ', po.last_name) as "patientName"
     FROM bookings b
     JOIN payments p ON p.booking_id = b.id AND p.status = 'completed'
     LEFT JOIN animals a ON a.id = b.animal_id
     LEFT JOIN users po ON po.id = b.pet_owner_id
     WHERE b.veterinarian_id = $1 AND b.status IN ('pending', 'confirmed')
       AND NOT EXISTS (SELECT 1 FROM referrals r WHERE r.booking_id = b.id AND r.transfer_status IN ('offered', 'accepted', 'rechosen'))
     ORDER BY b.scheduled_date ASC LIMIT 50`,
    [authReq.userId]
  );
  const consultations = await database.query(
    `SELECT c.id, c.completed_at as "completedAt", c.diagnosis, a.name as "animalName",
            CONCAT(po.first_name, ' ', po.last_name) as "patientName"
     FROM consultations c
     LEFT JOIN animals a ON a.id = c.animal_id
     LEFT JOIN users po ON po.id = c.user_id
     WHERE c.veterinarian_id = $1 AND c.status = 'completed'
       AND c.completed_at > NOW() - INTERVAL '30 days'
     ORDER BY c.completed_at DESC LIMIT 50`,
    [authReq.userId]
  );
  res.json({ success: true, data: { bookings: bookings.rows, consultations: consultations.rows } });
}));

router.post('/referrals/platform/:id/accept', authMiddleware, roleMiddleware(['pet_owner', 'farmer']), validateBody(acceptReferralSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const ReferralService = (await import('../services/payment/ReferralService')).default;
  const booking = await ReferralService.acceptReferral(authReq.userId!, req.params.id, {
    veterinarianId: req.body.veterinarianId || undefined,
    scheduledDate: req.body.scheduledDate,
    timeSlotStart: req.body.timeSlotStart,
    timeSlotEnd: req.body.timeSlotEnd,
    bookingType: req.body.bookingType,
    reasonForVisit: req.body.reasonForVisit,
  });
  res.on('finish', () => { if (res.statusCode < 300 && authReq.userId) { emitDataRefresh(authReq.userId, 'bookings'); } });
  res.status(201).json({ success: true, data: booking });
}));

router.post('/referrals/platform/:id/decline', authMiddleware, roleMiddleware(['pet_owner', 'farmer']), validateBody(declineReferralSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const ReferralService = (await import('../services/payment/ReferralService')).default;
  const outcome = await ReferralService.declineReferral(authReq.userId!, req.params.id, req.body.refundDestination || 'wallet');
  res.json({ success: true, data: outcome });
}));

// ─── Withdrawals / settlements (docs/PAYMENT_MODULE_PLAN.md §6.3) ──────────
router.post('/withdrawals/request', authMiddleware, roleMiddleware(['veterinarian']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const WithdrawalService = (await import('../services/payment/WithdrawalService')).default;
  const result = await WithdrawalService.requestWithdrawal(authReq.userId!);
  res.status(201).json({ success: true, data: result });
}));

router.post('/withdrawals/:id/cancel', authMiddleware, roleMiddleware(['veterinarian']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const WithdrawalService = (await import('../services/payment/WithdrawalService')).default;
  await WithdrawalService.cancelRequest(authReq.userId!, req.params.id);
  res.json({ success: true, message: 'Withdrawal request cancelled' });
}));

router.get('/withdrawals/my', authMiddleware, roleMiddleware(['veterinarian']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const WithdrawalService = (await import('../services/payment/WithdrawalService')).default;
  res.json({ success: true, data: await WithdrawalService.listMyWithdrawals(authReq.userId!) });
}));

router.get('/admin/withdrawals', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const WithdrawalService = (await import('../services/payment/WithdrawalService')).default;
  res.json({ success: true, data: await WithdrawalService.adminList(req.query.status as string | undefined) });
}));

// Doctors the platform owes money to. The negative-balance route below is its counterpart;
// neither existed for the positive case until now, so unpaid doctors were invisible.
router.get('/admin/withdrawals/payables', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (_req: Request, res: Response) => {
  const WithdrawalService = (await import('../services/payment/WithdrawalService')).default;
  res.json({ success: true, data: await WithdrawalService.adminPayables() });
}));
router.get('/admin/withdrawals/negative-balances', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (_req: Request, res: Response) => {
  const WithdrawalService = (await import('../services/payment/WithdrawalService')).default;
  res.json({ success: true, data: await WithdrawalService.adminNegativeBalances() });
}));

router.put('/admin/withdrawals/:id/approve', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const WithdrawalService = (await import('../services/payment/WithdrawalService')).default;
  await WithdrawalService.adminApprove(req.params.id, authReq.userId!, req.body.note);
  res.json({ success: true, message: 'Withdrawal approved' });
}));

router.put('/admin/withdrawals/:id/reject', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (!req.body.reason || !String(req.body.reason).trim()) {
    return res.status(400).json({ success: false, error: 'A rejection reason is required' });
  }
  const WithdrawalService = (await import('../services/payment/WithdrawalService')).default;
  await WithdrawalService.adminReject(req.params.id, authReq.userId!, String(req.body.reason).substring(0, 500));
  res.json({ success: true, message: 'Withdrawal rejected' });
}));

router.put('/admin/withdrawals/:id/settle', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (!req.body.utrReference || !String(req.body.utrReference).trim()) {
    return res.status(400).json({ success: false, error: 'utrReference (bank/UPI reference) is required' });
  }
  const WithdrawalService = (await import('../services/payment/WithdrawalService')).default;
  await WithdrawalService.adminSettle(req.params.id, authReq.userId!, String(req.body.utrReference).substring(0, 100), req.body.note);
  res.json({ success: true, message: 'Withdrawal settled' });
}));

router.post('/admin/withdrawals/discretionary', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { doctorId, utrReference, note } = req.body;
  if (!doctorId || !utrReference || !note) {
    return res.status(400).json({ success: false, error: 'doctorId, utrReference and note are required' });
  }
  const WithdrawalService = (await import('../services/payment/WithdrawalService')).default;
  const result = await WithdrawalService.adminDiscretionaryPayout(doctorId, authReq.userId!, String(utrReference).substring(0, 100), String(note).substring(0, 500));
  res.status(201).json({ success: true, data: result });
}));

// Admin: per-doctor commission overrides (§5)
router.get('/admin/commission/doctors', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const search = (req.query.search as string) || '';
  const params: any[] = [];
  let where = `u.role = 'veterinarian'`;
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where += ` AND (LOWER(u.first_name) LIKE $${params.length} OR LOWER(u.last_name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`;
  }
  const result = await database.query(
    `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) as "name", u.email,
            vp.consultation_fee as "consultationFee", vp.emergency_consultation_fee as "emergencyFee",
            vp.commission_percent_override as "commissionPercentOverride",
            vp.commission_flat_override as "commissionFlatOverride"
     FROM users u JOIN vet_profiles vp ON vp.user_id = u.id
     WHERE ${where}
     ORDER BY u.first_name, u.last_name LIMIT 100`,
    params
  );
  res.json({ success: true, data: result.rows });
}));

router.put('/admin/commission/doctors/:userId', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { commissionPercentOverride, commissionFlatOverride } = req.body;
  const pct = commissionPercentOverride === null || commissionPercentOverride === '' || commissionPercentOverride === undefined
    ? null : parseFloat(commissionPercentOverride);
  const flat = commissionFlatOverride === null || commissionFlatOverride === '' || commissionFlatOverride === undefined
    ? null : parseFloat(commissionFlatOverride);
  if (pct !== null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) {
    return res.status(400).json({ success: false, error: 'commissionPercentOverride must be between 0 and 100' });
  }
  if (flat !== null && (!Number.isFinite(flat) || flat < 0 || flat > 100000)) {
    return res.status(400).json({ success: false, error: 'commissionFlatOverride must be a non-negative amount' });
  }
  const before = await database.query(
    `SELECT commission_percent_override, commission_flat_override FROM vet_profiles WHERE user_id = $1`,
    [req.params.userId]
  );
  if (before.rows.length === 0) return res.status(404).json({ success: false, error: 'Doctor profile not found' });
  await database.query(
    `UPDATE vet_profiles SET commission_percent_override = $1, commission_flat_override = $2, updated_at = NOW() WHERE user_id = $3`,
    [pct, flat, req.params.userId]
  );
  // §5: commission config changes are audit-logged
  await database.query(
    `INSERT INTO payment_events (id, event_type, actor_user_id, payload, created_at)
     VALUES (gen_random_uuid(), 'commission_override_changed', $1, $2, NOW())`,
    [authReq.userId, JSON.stringify({
      doctorUserId: req.params.userId,
      before: before.rows[0],
      after: { commission_percent_override: pct, commission_flat_override: flat },
    })]
  ).catch(() => {});
  res.json({ success: true, message: 'Commission override updated' });
}));

// ─── Legal documents & consent (docs/PAYMENT_MODULE_PLAN.md §17) ───────────
router.get('/legal/documents', asyncHandler(async (_req: Request, res: Response) => {
  const LegalService = (await import('../services/LegalService')).default;
  res.json({ success: true, data: await LegalService.listActiveDocuments() });
}));

router.get('/legal/documents/:docType', asyncHandler(async (req: Request, res: Response) => {
  const LegalService = (await import('../services/LegalService')).default;
  res.json({ success: true, data: await LegalService.getActiveDocument(req.params.docType) });
}));

router.get('/legal/acceptances/pending', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const LegalService = (await import('../services/LegalService')).default;
  const pending = await LegalService.getPendingReacceptances(authReq.userId!, authReq.userRole || '');
  res.json({ success: true, data: pending });
}));

router.post('/legal/acceptances', authMiddleware, validateBody(legalAcceptSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const LegalService = (await import('../services/LegalService')).default;
  const userRes = await database.query(`SELECT email FROM users WHERE id = $1`, [authReq.userId]);
  await LegalService.recordAcceptances({
    userId: authReq.userId!,
    userEmail: userRes.rows[0]?.email || '',
    docTypes: req.body.docTypes,
    context: req.body.context || 'login_reacceptance',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.json({ success: true, message: 'Acceptance recorded' });
}));

// Admin: Legal & Policies manager (§10 item 8)
router.get('/admin/legal-documents', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (_req: Request, res: Response) => {
  const LegalService = (await import('../services/LegalService')).default;
  res.json({ success: true, data: await LegalService.listAllDocuments() });
}));

router.post('/admin/legal-documents', authMiddleware, roleMiddleware(['admin']), validateBody(adminLegalDocSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const LegalService = (await import('../services/LegalService')).default;
  const doc = await LegalService.publishNewVersion({
    docType: req.body.docType,
    title: req.body.title,
    content: req.body.content,
    requiresReacceptance: req.body.requiresReacceptance === true,
    createdBy: authReq.userId!,
  });
  res.status(201).json({ success: true, data: doc });
}));

router.get('/admin/legal-documents/acceptance-stats', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (_req: Request, res: Response) => {
  const LegalService = (await import('../services/LegalService')).default;
  res.json({ success: true, data: await LegalService.getAcceptanceStats() });
}));

router.get('/admin/legal-documents/user/:userId', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const LegalService = (await import('../services/LegalService')).default;
  res.json({ success: true, data: await LegalService.getUserAcceptances(req.params.userId) });
}));

router.post('/payments', authMiddleware, validateBody(createPaymentSchema), asyncHandler((req: Request, res: Response) => PaymentController.createPayment(req, res)));
router.get('/payments', authMiddleware, asyncHandler((req: Request, res: Response) => PaymentController.listPayments(req, res)));
router.get('/payments/booking/:bookingId', authMiddleware, asyncHandler((req: Request, res: Response) => PaymentController.getPaymentByBooking(req, res)));
router.get('/payments/gateway-settings', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => PaymentController.getGatewaySettings(req, res)));
router.get('/payments/:id', authMiddleware, asyncHandler((req: Request, res: Response) => PaymentController.getPayment(req, res)));

// ─── Razorpay credentials (payment module - §12 rule 6: masked only, never plaintext) ───
router.get('/admin/razorpay-credentials', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const PaymentCredentialsService = (await import('../services/payment/PaymentCredentialsService')).default;
  const [test, live] = await Promise.all([
    PaymentCredentialsService.getMaskedStatus('test'),
    PaymentCredentialsService.getMaskedStatus('live'),
  ]);
  const webhookUrl = `${req.protocol}://${req.get('host')}/api/v1/webhooks/razorpay`;
  res.json({ success: true, data: { test, live, webhookUrl } });
}));

router.put('/admin/razorpay-credentials/:environment', authMiddleware, roleMiddleware(['admin']), validateBody(razorpayCredentialsSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { environment } = req.params;
  if (environment !== 'test' && environment !== 'live') {
    return res.status(400).json({ success: false, error: { message: "environment must be 'test' or 'live'" } });
  }
  const PaymentCredentialsService = (await import('../services/payment/PaymentCredentialsService')).default;
  const { keyId, keySecret, webhookSecret } = req.body;
  await PaymentCredentialsService.setCredentials(environment, keyId, keySecret || undefined, webhookSecret || undefined, authReq.userId!);
  res.json({ success: true, data: await PaymentCredentialsService.getMaskedStatus(environment) });
}));

// ─── Wallet routes ───────────────────────────────────────────
router.get('/wallet', authMiddleware, asyncHandler((req: Request, res: Response) => WalletController.getWallet(req, res)));
router.get('/wallet/transactions', authMiddleware, asyncHandler((req: Request, res: Response) => WalletController.listTransactions(req, res)));

// Wallet withdrawals (038) - the wallet's exit door. Any authenticated user may withdraw their
// OWN balance; refunds land here and must not be trapped as permanent store credit.
router.post('/wallet/withdrawals', authMiddleware, validateBody(walletWithdrawalRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await WalletWithdrawalService.requestWithdrawal((req as any).userId, req.body) });
  }));
router.get('/wallet/withdrawals', authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await WalletWithdrawalService.listMine((req as any).userId) });
  }));
router.post('/wallet/withdrawals/:id/cancel', authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    await WalletWithdrawalService.cancelMine((req as any).userId, req.params.id);
    res.json({ success: true });
  }));

// Admin payout queue for customer withdrawals.
router.get('/admin/wallet-withdrawals', authMiddleware, roleMiddleware(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await WalletWithdrawalService.adminList(req.query.status as string) });
  }));
router.put('/admin/wallet-withdrawals/:id/approve', authMiddleware, roleMiddleware(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    await WalletWithdrawalService.adminApprove(req.params.id, (req as any).userId, req.body?.note);
    res.json({ success: true });
  }));
router.put('/admin/wallet-withdrawals/:id/reject', authMiddleware, roleMiddleware(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    await WalletWithdrawalService.adminReject(req.params.id, (req as any).userId, req.body?.reason);
    res.json({ success: true });
  }));
router.put('/admin/wallet-withdrawals/:id/settle', authMiddleware, roleMiddleware(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    await WalletWithdrawalService.adminSettle(req.params.id, (req as any).userId, req.body?.utrReference, req.body?.note);
    res.json({ success: true });
  }));

// ─── Doctor reliability ──────────────────────────────────────
router.get('/doctors/:vetId/reliability', authMiddleware, asyncHandler((req: Request, res: Response) => BookingController.getDoctorReliability(req, res)));

// ─── Review routes ───────────────────────────────────────────
router.get('/reviews/reviewable', authMiddleware, asyncHandler((req: Request, res: Response) => ReviewController.listReviewableConsultations(req, res)));
router.post('/reviews', authMiddleware, validateBody(createReviewSchema), asyncHandler((req: Request, res: Response) => ReviewController.createReview(req, res)));
router.get('/reviews/vet/:vetId', asyncHandler((req: Request, res: Response) => ReviewController.listReviews(req, res)));
router.put('/reviews/:id/vet-response', authMiddleware, asyncHandler((req: Request, res: Response) => ReviewController.addVetResponse(req, res)));
router.post('/reviews/:id/helpful', authMiddleware, asyncHandler((req: Request, res: Response) => ReviewController.markHelpful(req, res)));
router.post('/reviews/:id/report', authMiddleware, asyncHandler((req: Request, res: Response) => ReviewController.reportReview(req, res)));


export default router;
