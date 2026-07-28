import { v4 as uuidv4 } from 'uuid';
import database from '../../utils/database';
import logger from '../../utils/logger';
import { NotFoundError, DatabaseError } from '../../utils/errors';
import { getGatewayForMode } from '../payment/gateways';
import GroomingModuleConfig from './GroomingModuleConfig';
import NotificationService from '../NotificationService';

/**
 * Grooming cancellation, refund and compensation engine.
 *
 * MODULE BOUNDARY — read before changing anything here.
 * This is grooming's own policy engine. It mirrors the SHAPE of the consultation engine
 * (PaymentOrchestrator.computeRefundPreview / refundForCancellation) so the platform behaves
 * consistently, but it shares no code, no settings keys and no ledger with it:
 *   - policy comes from `grooming.*` settings, never `cancellation.*`
 *   - provider money moves on `grooming_earnings`, never `doctor_earnings`
 *   - order state lives on `grooming_orders`, never `bookings`
 * Changing a consultation window must not move a grooming one, and vice versa. The only shared
 * things are genuinely platform-level ledgers — `payments`, `wallets`, `wallet_transactions`,
 * `payment_events` — which are keyed by `payment_source = 'grooming'` and carry no consultation
 * semantics.
 *
 * Policy matrix (all thresholds admin-editable):
 *   provider/admin cancels  → full refund + goodwill bonus; provider penalised the bonus + the
 *                             non-recoverable gateway fee; clearing earning reversed
 *   customer, >= freeWindow → refund = paid − processing charge
 *   customer, >= partialWin → refund = paid × partial% − processing charge; provider compensated
 *                             a share of what the policy retained
 *   customer, < partialWin  → no refund; provider compensated a share of their net
 *   customer no-show        → same as the no-refund window
 */

export type GroomingCanceller = 'customer' | 'provider' | 'admin' | 'no_show';

export interface GroomingRefundPreview {
  hasPayment: boolean;
  amountPaid: number;
  refundAmount: number;
  processingCharge: number;
  goodwillBonus: number;
  policy: string;
}

export interface GroomingRefundOutcome extends GroomingRefundPreview {
  refunded: boolean;
  destination: 'wallet' | 'gateway';
  gatewayRefundAmount: number;
  walletRefundAmount: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const EMPTY: GroomingRefundPreview = {
  hasPayment: false, amountPaid: 0, refundAmount: 0, processingCharge: 0, goodwillBonus: 0, policy: 'none',
};

class GroomingRefundService {
  /**
   * Order + its paid payment, or null when the order was never actually paid.
   *
   * 'partially_refunded' counts as paid: a partial dispute refund must not block a later
   * cancellation refund of the remainder. Over-refunding is prevented by the cap in
   * computeRefundPreview, not by hiding the payment.
   */
  private async loadPaidOrder(orderId: string): Promise<any | null> {
    const r = await database.query(
      `SELECT o.id, o.pet_owner_id, o.provider_id, o.status, o.scheduled_date, o.time_slot_start,
              o.amount_paid, o.currency, o.gateway, o.gateway_payment_id, o.payment_id,
              p.id AS "paymentId", p.status AS "paymentStatus", p.amount AS "paymentAmount",
              p.gateway_fee_amount AS "gatewayFee", p.gateway_payment_id AS "payGatewayPaymentId",
              COALESCE(p.refund_amount, 0) AS "alreadyRefunded",
              o.subtotal, o.addons_total, o.variable_total, o.tax_total, o.order_number, o.invoice_number,
              gp.legal_name AS "providerLegal", gp.business_name AS "providerName",
              gp.gstin AS "providerGstin", gp.business_address AS "providerAddress"
       FROM grooming_orders o
       JOIN grooming_providers gp ON gp.id = o.provider_id
       JOIN payments p ON p.id = o.payment_id AND p.status IN ('completed', 'partially_refunded')
       WHERE o.id = $1`, [orderId]);
    return r.rows[0] || null;
  }

  /** Hours from now until the appointment slot starts (negative once it has passed). */
  private hoursUntilAppointment(scheduledDate: any, timeSlotStart: string): number {
    const d = new Date(scheduledDate);
    const datePart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const appt = new Date(`${datePart}T${(timeSlotStart || '00:00')}:00`);
    return (appt.getTime() - Date.now()) / (1000 * 60 * 60);
  }

  /**
   * What the customer would get back — pure computation, no writes. Powers the cancel dialog so
   * the policy is shown before the customer commits, not explained afterwards.
   */
  async computeRefundPreview(orderId: string, canceller: GroomingCanceller): Promise<GroomingRefundPreview> {
    const o = await this.loadPaidOrder(orderId);
    if (!o) return EMPTY;
    const amountPaid = Number(o.paymentAmount) || Number(o.amount_paid) || 0;
    if (!(amountPaid > 0)) return EMPTY;

    // Whatever a dispute already returned is not available to be returned again. Every branch
    // below runs its result through this cap, so the total refunded can never exceed the total
    // collected however many times a refund path is invoked.
    const refundable = round2(Math.max(amountPaid - (Number(o.alreadyRefunded) || 0), 0));
    const cap = (n: number) => round2(Math.min(Math.max(n, 0), refundable));

    if (canceller === 'provider' || canceller === 'admin') {
      const bonusPercent = canceller === 'provider' ? await GroomingModuleConfig.getGoodwillBonusPercent() : 0;
      return {
        hasPayment: true, amountPaid, refundAmount: cap(amountPaid), processingCharge: 0,
        goodwillBonus: round2(amountPaid * bonusPercent / 100),
        policy: 'provider_cancel_full_refund',
      };
    }

    const gatewayFee = Number(o.gatewayFee) || 0;
    const processingFlat = await GroomingModuleConfig.getCancellationProcessingFlatFee();
    const processingCharge = round2(gatewayFee + processingFlat);

    // A no-show is the customer failing to turn up — same commercial outcome as cancelling with
    // no notice at all, so it deliberately skips the window maths.
    if (canceller === 'no_show') {
      return { hasPayment: true, amountPaid, refundAmount: 0, processingCharge: 0, goodwillBonus: 0, policy: 'customer_no_show' };
    }

    const freeWindow = await GroomingModuleConfig.getCancellationFreeWindowHours();
    const partialWindow = await GroomingModuleConfig.getCancellationPartialWindowHours();
    const partialPercent = await GroomingModuleConfig.getCancellationPartialPercent();
    const hoursUntil = this.hoursUntilAppointment(o.scheduled_date, o.time_slot_start);

    if (hoursUntil >= freeWindow) {
      return {
        hasPayment: true, amountPaid,
        refundAmount: cap(round2(amountPaid - processingCharge)),
        processingCharge: Math.min(processingCharge, amountPaid), goodwillBonus: 0,
        policy: 'customer_free_window',
      };
    }
    if (hoursUntil >= partialWindow) {
      const base = round2(amountPaid * partialPercent / 100);
      return {
        hasPayment: true, amountPaid,
        refundAmount: cap(round2(base - processingCharge)),
        processingCharge: Math.min(processingCharge, base), goodwillBonus: 0,
        policy: 'customer_partial_window',
      };
    }
    return { hasPayment: true, amountPaid, refundAmount: 0, processingCharge: 0, goodwillBonus: 0, policy: 'customer_no_refund_window' };
  }

  /**
   * Execute the policy: move the money, then reconcile the provider ledger.
   *
   * Returns null when there is nothing to refund (unpaid order), so callers can cancel freely
   * without special-casing. Never throws for policy reasons — a zero refund is a valid outcome.
   */
  async refundForCancellation(orderId: string, canceller: GroomingCanceller, reason: string,
    destination?: 'wallet' | 'gateway'): Promise<GroomingRefundOutcome | null> {
    const o = await this.loadPaidOrder(orderId);
    if (!o) return null;
    const preview = await this.computeRefundPreview(orderId, canceller);
    if (!preview.hasPayment) return null;

    let dest: 'wallet' | 'gateway' = destination || await GroomingModuleConfig.getDefaultRefundDestination();
    const gatewayPaymentId = o.payGatewayPaymentId || o.gateway_payment_id;

    // Gateway refunds go out BEFORE the ledger transaction, because an external side effect
    // cannot be rolled back with it. A failure here falls back to the wallet so the customer is
    // never left with nothing — the same guarantee the consultation engine makes.
    let gatewayRefundAmount = 0;
    let walletRefundAmount = preview.refundAmount;
    if (dest === 'gateway' && preview.refundAmount > 0 && gatewayPaymentId && o.gateway && o.gateway !== 'demo') {
      try {
        const gateway = await getGatewayForMode(o.gateway);
        await gateway.refund(gatewayPaymentId, preview.refundAmount, { orderId, reason, kind: 'grooming' });
        gatewayRefundAmount = preview.refundAmount;
        walletRefundAmount = 0;
      } catch (err: any) {
        logger.error('Grooming gateway refund failed — falling back to wallet', { orderId, error: err.message });
        gatewayRefundAmount = 0;
        walletRefundAmount = preview.refundAmount;
        dest = 'wallet';
      }
    } else if (dest === 'gateway') {
      // Nothing to send to the gateway (demo mode, or no captured payment id) — wallet it is.
      dest = 'wallet';
    }

    const clearanceNote = `${canceller} cancellation — ${preview.policy}`;
    try {
      await database.transaction(async (client: any) => {
        const locked = await client.query(
          `SELECT status, COALESCE(refund_amount, 0) AS refunded, amount FROM payments WHERE id = $1 FOR UPDATE`,
          [o.paymentId]);
        const lockedRow = locked.rows[0];
        // 'partially_refunded' is still refundable; anything else means another path already
        // finished with this payment and this call must not move money again.
        if (!lockedRow || !['completed', 'partially_refunded'].includes(lockedRow.status)) return;

        // Cumulative, never overwritten — a prior dispute refund on the same payment must stay
        // counted, otherwise the ledger would under-report what was returned.
        const totalRefunded = round2(Number(lockedRow.refunded) + preview.refundAmount);
        const isFull = round2(totalRefunded + preview.processingCharge) >= round2(Number(lockedRow.amount));
        const payStatus = totalRefunded <= 0 ? 'completed' : (isFull ? 'refunded' : 'partially_refunded');
        const refundStatus = totalRefunded <= 0 ? 'none' : (isFull ? 'full' : 'partial');

        if (preview.refundAmount > 0 || preview.processingCharge > 0) {
          await client.query(
            `UPDATE payments SET status = $2, refund_amount = $3, refund_reason = $4,
                    processing_charge_amount = $5, refund_destination = $6, updated_at = NOW()
             WHERE id = $1`,
            [o.paymentId, payStatus, totalRefunded, reason, preview.processingCharge, dest]);
        }
        // $2 is cast explicitly: it feeds both a numeric column and a comparison, and without the
        // cast Postgres reports "inconsistent types deduced for parameter $2".
        await client.query(
          `UPDATE grooming_orders SET refund_amount = $2::numeric, refund_status = $3, refund_destination = $4,
                  refund_reason = $5, refunded_at = CASE WHEN $2::numeric > 0 THEN NOW() ELSE refunded_at END,
                  updated_at = NOW()
           WHERE id = $1`,
          [orderId, totalRefunded, refundStatus, dest, reason]);

        // Wallet leg (refund and/or goodwill bonus)
        if (walletRefundAmount > 0 || preview.goodwillBonus > 0) {
          const wRes = await client.query(`SELECT id FROM wallets WHERE user_id = $1 FOR UPDATE`, [o.pet_owner_id]);
          let walletId = wRes.rows[0]?.id;
          if (!walletId) {
            await client.query(
              `INSERT INTO wallets (id, user_id, balance, bonus_credits, currency, created_at, updated_at)
               VALUES ($1, $2, 0, 0, $3, NOW(), NOW()) ON CONFLICT (user_id) DO NOTHING`,
              [uuidv4(), o.pet_owner_id, o.currency || 'INR']);
            const again = await client.query(`SELECT id FROM wallets WHERE user_id = $1`, [o.pet_owner_id]);
            walletId = again.rows[0].id;
          }
          if (walletRefundAmount > 0) {
            await client.query(`UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
              [walletRefundAmount, walletId]);
            await client.query(
              `INSERT INTO wallet_transactions (id, wallet_id, type, amount, description, reference_id, reference_type, created_at)
               VALUES ($1,$2,'refund',$3,$4,$5,'grooming_order',NOW())`,
              [uuidv4(), walletId, walletRefundAmount, `Grooming refund: ${reason}`, orderId]);
          }
          if (preview.goodwillBonus > 0) {
            await client.query(`UPDATE wallets SET bonus_credits = bonus_credits + $1, updated_at = NOW() WHERE id = $2`,
              [preview.goodwillBonus, walletId]);
            await client.query(
              `INSERT INTO wallet_transactions (id, wallet_id, type, amount, description, reference_id, reference_type, created_at)
               VALUES ($1,$2,'bonus',$3,'Goodwill bonus — the groomer cancelled your appointment',$4,'grooming_order',NOW())`,
              [uuidv4(), walletId, preview.goodwillBonus, orderId]);
          }
        }

        // ── Provider ledger (grooming_earnings only) ──
        // The original clearing earning can never mature once the order is cancelled.
        const earnRes = await client.query(
          `SELECT COALESCE(SUM(net_amount), 0) AS net FROM grooming_earnings
           WHERE order_id = $1 AND entry_type = 'earning'`, [orderId]);
        const originalNet = Number(earnRes.rows[0]?.net) || 0;
        await client.query(
          `UPDATE grooming_earnings SET status = 'reversed', updated_at = NOW()
           WHERE order_id = $1 AND status = 'clearing'`, [orderId]);

        if (canceller === 'provider') {
          // The provider funds the goodwill bonus and the gateway fee the platform cannot recover.
          const penalty = round2(preview.goodwillBonus + (Number(o.gatewayFee) || 0));
          if (penalty > 0) {
            await client.query(
              `INSERT INTO grooming_earnings (provider_id, order_id, gross_amount, commission_amount, tax_amount, net_amount, entry_type, status, note)
               VALUES ($1,$2,0,0,0,$3,'penalty','available',$4)`,
              [o.provider_id, orderId, -penalty,
               `Cancellation penalty: goodwill ${preview.goodwillBonus.toFixed(2)} + gateway fee ${(Number(o.gatewayFee) || 0).toFixed(2)}`]);
          }
        } else if (preview.policy === 'customer_partial_window') {
          const retained = round2(Math.max(preview.amountPaid - preview.refundAmount - preview.processingCharge, 0));
          const sharePct = await GroomingModuleConfig.getProviderShareOfRetainedPercent();
          const comp = round2(retained * sharePct / 100);
          if (comp > 0) {
            await client.query(
              `INSERT INTO grooming_earnings (provider_id, order_id, gross_amount, commission_amount, tax_amount, net_amount, entry_type, status, note)
               VALUES ($1,$2,0,0,0,$3,'compensation','clearing',$4)`,
              [o.provider_id, orderId, comp, `Late customer cancellation — ${sharePct}% of retained amount`]);
          }
        } else if (preview.policy === 'customer_no_refund_window' || preview.policy === 'customer_no_show') {
          const sharePct = await GroomingModuleConfig.getProviderShareOnNoShowPercent();
          const comp = round2(originalNet * sharePct / 100);
          if (comp > 0) {
            await client.query(
              `INSERT INTO grooming_earnings (provider_id, order_id, gross_amount, commission_amount, tax_amount, net_amount, entry_type, status, note)
               VALUES ($1,$2,0,0,0,$3,'compensation','clearing',$4)`,
              [o.provider_id, orderId, comp,
               preview.policy === 'customer_no_show'
                 ? `Customer no-show — ${sharePct}% of net share`
                 : `Very late customer cancellation — ${sharePct}% of net share`]);
          }
        }

        const creditNote = await this.issueCreditNote(client, o, preview.refundAmount, reason);
        await client.query(
          `INSERT INTO grooming_order_status_history (order_id, from_status, to_status, changed_by, note)
           VALUES ($1,$2,$2,NULL,$3)`,
          [orderId, o.status,
           `Refund ${preview.refundAmount.toFixed(2)} (${preview.policy}, ${dest})${creditNote ? ` — credit note ${creditNote}` : ''} — ${clearanceNote}`]);

        try {
          await client.query(
            `INSERT INTO payment_events (id, payment_id, event_type, from_status, to_status, payload, created_at)
             VALUES (gen_random_uuid(), $1, 'grooming_refund_processed', 'completed', $2, $3, NOW())`,
            [o.paymentId, payStatus,
             JSON.stringify({ ...preview, orderId, canceller, reason, destination: dest, gatewayRefundAmount, walletRefundAmount })]);
        } catch (err: any) {
          logger.warn('grooming refund payment_events insert failed (non-blocking)', { orderId, error: err.message });
        }
      });
    } catch (err: any) {
      if (gatewayRefundAmount > 0) {
        logger.error('CRITICAL: grooming gateway refund issued but the ledger update failed — manual reconciliation needed',
          { orderId, paymentId: o.paymentId, gatewayRefundAmount });
      }
      logger.error('Grooming refund failed', { orderId, error: err.message });
      await database.query(
        `UPDATE grooming_orders SET refund_status = 'failed', updated_at = NOW() WHERE id = $1`, [orderId]
      ).catch(() => {});
      throw new DatabaseError('Refund processing failed', { originalError: err.message });
    }

    if (preview.refundAmount > 0 || preview.goodwillBonus > 0) {
      try {
        await NotificationService.createNotification(
          o.pet_owner_id, 'payment', 'Grooming Refund Processed',
          dest === 'gateway'
            ? `₹${preview.refundAmount.toFixed(2)} has been refunded to your original payment method. It can take 5–7 working days to appear.`
            : `₹${preview.refundAmount.toFixed(2)} has been credited to your wallet${preview.goodwillBonus > 0 ? `, plus a ₹${preview.goodwillBonus.toFixed(2)} goodwill bonus` : ''}.`,
          'all', { orderId, refundAmount: preview.refundAmount });
      } catch { /* non-blocking */ }
    }

    logger.info('Grooming refund processed', { orderId, canceller, destination: dest, ...preview });
    return { ...preview, refunded: preview.refundAmount > 0, destination: dest, gatewayRefundAmount, walletRefundAmount };
  }

  /**
   * Discretionary refund agreed on a dispute — an amount a human decided, not a policy window.
   * Capped at whatever of the payment is still unrefunded, so repeated dispute responses can
   * never return more than was collected. The provider's ledger is debited by the same amount.
   */
  async refundDiscretionary(orderId: string, amount: number, reason: string,
    destination?: 'wallet' | 'gateway'): Promise<GroomingRefundOutcome | null> {
    const o = await this.loadPaidOrder(orderId);
    if (!o) return null;
    const paid = Number(o.paymentAmount) || 0;
    const alreadyRefunded = Number(
      (await database.query(`SELECT COALESCE(refund_amount, 0) AS r FROM payments WHERE id = $1`, [o.paymentId])).rows[0]?.r) || 0;
    const refundAmount = round2(Math.min(Math.max(amount, 0), Math.max(paid - alreadyRefunded, 0)));
    if (!(refundAmount > 0)) return null;

    let dest: 'wallet' | 'gateway' = destination || await GroomingModuleConfig.getDefaultRefundDestination();
    const gatewayPaymentId = o.payGatewayPaymentId || o.gateway_payment_id;
    let gatewayRefundAmount = 0;
    let walletRefundAmount = refundAmount;
    if (dest === 'gateway' && gatewayPaymentId && o.gateway && o.gateway !== 'demo') {
      try {
        const gateway = await getGatewayForMode(o.gateway);
        await gateway.refund(gatewayPaymentId, refundAmount, { orderId, reason, kind: 'grooming_dispute' });
        gatewayRefundAmount = refundAmount; walletRefundAmount = 0;
      } catch (err: any) {
        logger.error('Grooming dispute gateway refund failed — falling back to wallet', { orderId, error: err.message });
        dest = 'wallet';
      }
    } else if (dest === 'gateway') {
      dest = 'wallet';
    }

    try {
      await database.transaction(async (client: any) => {
        const locked = await client.query(`SELECT status, COALESCE(refund_amount,0) AS refunded, amount FROM payments WHERE id = $1 FOR UPDATE`, [o.paymentId]);
        const row = locked.rows[0];
        if (!row) return;
        const totalRefunded = round2(Number(row.refunded) + refundAmount);
        const payStatus = totalRefunded >= round2(Number(row.amount)) ? 'refunded' : 'partially_refunded';
        await client.query(
          `UPDATE payments SET status = $2, refund_amount = $3, refund_reason = $4, refund_destination = $5, updated_at = NOW()
           WHERE id = $1`, [o.paymentId, payStatus, totalRefunded, reason, dest]);
        await client.query(
          `UPDATE grooming_orders SET refund_amount = $2, refund_status = $3, refund_destination = $4,
                  refund_reason = $5, refunded_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [orderId, totalRefunded, payStatus === 'refunded' ? 'full' : 'partial', dest, reason]);

        if (walletRefundAmount > 0) {
          const wRes = await client.query(`SELECT id FROM wallets WHERE user_id = $1 FOR UPDATE`, [o.pet_owner_id]);
          let walletId = wRes.rows[0]?.id;
          if (!walletId) {
            await client.query(
              `INSERT INTO wallets (id, user_id, balance, bonus_credits, currency, created_at, updated_at)
               VALUES ($1,$2,0,0,$3,NOW(),NOW()) ON CONFLICT (user_id) DO NOTHING`,
              [uuidv4(), o.pet_owner_id, o.currency || 'INR']);
            const again = await client.query(`SELECT id FROM wallets WHERE user_id = $1`, [o.pet_owner_id]);
            walletId = again.rows[0].id;
          }
          await client.query(`UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
            [walletRefundAmount, walletId]);
          await client.query(
            `INSERT INTO wallet_transactions (id, wallet_id, type, amount, description, reference_id, reference_type, created_at)
             VALUES ($1,$2,'refund',$3,$4,$5,'grooming_order',NOW())`,
            [uuidv4(), walletId, walletRefundAmount, `Grooming dispute refund: ${reason}`, orderId]);
        }

        // The provider funds the agreed refund.
        await client.query(
          `INSERT INTO grooming_earnings (provider_id, order_id, gross_amount, commission_amount, tax_amount, net_amount, entry_type, status, note)
           VALUES ($1,$2,0,0,0,$3,'refund_adjustment','available',$4)`,
          [o.provider_id, orderId, -refundAmount, reason]);

        const creditNote = await this.issueCreditNote(client, o, refundAmount, reason);
        try {
          await client.query(
            `INSERT INTO payment_events (id, payment_id, event_type, from_status, to_status, payload, created_at)
             VALUES (gen_random_uuid(), $1, 'grooming_dispute_refund', 'completed', $2, $3, NOW())`,
            [o.paymentId, payStatus, JSON.stringify({ orderId, refundAmount, reason, destination: dest, creditNote })]);
        } catch { /* non-blocking */ }
      });
    } catch (err: any) {
      if (gatewayRefundAmount > 0) {
        logger.error('CRITICAL: grooming dispute gateway refund issued but the ledger update failed — manual reconciliation needed',
          { orderId, gatewayRefundAmount });
      }
      throw new DatabaseError('Dispute refund processing failed', { originalError: err.message });
    }

    try {
      await NotificationService.createNotification(
        o.pet_owner_id, 'payment', 'Grooming Dispute Refund',
        `₹${refundAmount.toFixed(2)} has been refunded to your ${dest === 'gateway' ? 'original payment method' : 'wallet'} for your grooming order.`,
        'all', { orderId, refundAmount });
    } catch { /* non-blocking */ }

    logger.info('Grooming dispute refund processed', { orderId, refundAmount, destination: dest });
    return {
      hasPayment: true, amountPaid: paid, refundAmount, processingCharge: 0, goodwillBonus: 0,
      policy: 'dispute_resolution', refunded: true, destination: dest, gatewayRefundAmount, walletRefundAmount,
    };
  }


  /**
   * GST credit note for a refund (GRMCN/FY series, separate from the GRM invoice series).
   *
   * A refunded order previously kept its full-value GRM invoice standing, which does not survive
   * a GST audit — the outward supply has to be reduced by a credit note referencing the original
   * invoice. Numbering continues from the highest suffix issued, never COUNT(*), for the same
   * reason the invoice series does.
   */
  private async issueCreditNote(client: any, o: any, amount: number, reason: string): Promise<string | null> {
    if (!(amount > 0)) return null;
    const prefix = await GroomingModuleConfig.getCreditNotePrefix();
    const sac = await GroomingModuleConfig.getSacCode();
    const d = new Date();
    const y = d.getFullYear(); const m = d.getMonth();
    const startYear = m >= 3 ? y : y - 1;
    const fy = `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;

    await client.query(`SELECT pg_advisory_xact_lock(hashtext('grooming_credit_note_seq'))`);
    const res = await client.query(
      `SELECT COALESCE(MAX(substring(invoice_number from '([0-9]+)$')::bigint), 0) AS last
       FROM invoices WHERE invoice_number LIKE $1 AND invoice_number ~ '/[0-9]+$'`,
      [`${prefix}/${fy}/%`]);
    const number = `${prefix}/${fy}/${String(Number(res.rows[0].last) + 1).padStart(5, '0')}`;

    // Split the refund back into taxable value + tax at the order's effective rate so the credit
    // note reverses GST proportionally rather than treating the whole refund as taxable value.
    const grossTotal = Number(o.subtotal || 0) + Number(o.addons_total || 0) + Number(o.variable_total || 0);
    const orderTotal = Number(o.paymentAmount) || Number(o.amount_paid) || 0;
    const taxShare = orderTotal > 0 ? Number(o.tax_total || 0) / orderTotal : 0;
    const taxPortion = +(amount * taxShare).toFixed(2);
    const valuePortion = +(amount - taxPortion).toFixed(2);
    const taxRate = valuePortion > 0 ? +(taxPortion / valuePortion * 100).toFixed(2) : 0;
    void grossTotal;

    await client.query(
      `INSERT INTO invoices (invoice_number, invoice_type, payment_id, issuer_details, recipient_details,
         line_items, subtotal, tax_amount, total, sac_code, tax_rate, currency)
       VALUES ($1,'grooming_credit_note',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [number, o.paymentId,
       JSON.stringify({ name: o.providerLegal || o.providerName || null, gstin: o.providerGstin || null, address: o.providerAddress || null }),
       JSON.stringify({ orderNumber: o.order_number, userId: o.pet_owner_id, againstInvoice: o.invoice_number || null, reason }),
       JSON.stringify([{ name: `Refund — ${reason}`, qty: 1, unitPrice: valuePortion, taxPercent: taxRate, lineTotal: amount }]),
       valuePortion, taxPortion, amount, sac, taxRate, o.currency || 'INR']);
    return number;
  }

  /**
   * A capture that arrived after the slot-hold already expired. Standard gateway practice is to
   * return it in full rather than keep money for a slot the customer no longer holds — the order
   * stays expired and the payment is refunded end to end.
   */
  async refundExpiredCapture(orderId: string, gatewayPaymentId: string): Promise<void> {
    const r = await database.query(
      `SELECT o.id, o.pet_owner_id, o.currency, o.gateway, o.payment_id, o.order_number, o.invoice_number,
              o.subtotal, o.addons_total, o.variable_total, o.tax_total, o.amount_paid,
              gp.legal_name AS "providerLegal", gp.business_name AS "providerName",
              gp.gstin AS "providerGstin", gp.business_address AS "providerAddress",
              p.amount, p.status
       FROM grooming_orders o
       JOIN grooming_providers gp ON gp.id = o.provider_id
       JOIN payments p ON p.id = o.payment_id WHERE o.id = $1`, [orderId]);
    if (r.rows.length === 0) throw new NotFoundError('GroomingOrder', orderId);
    const o = r.rows[0];
    const amount = Number(o.amount) || 0;
    if (!(amount > 0)) return;

    let destination: 'wallet' | 'gateway' = 'wallet';
    if (o.gateway && o.gateway !== 'demo' && gatewayPaymentId) {
      try {
        const gateway = await getGatewayForMode(o.gateway);
        await gateway.refund(gatewayPaymentId, amount, { orderId, reason: 'slot_hold_expired', kind: 'grooming' });
        destination = 'gateway';
      } catch (err: any) {
        logger.error('Grooming expired-capture gateway refund failed — crediting wallet instead', { orderId, error: err.message });
      }
    }

    await database.transaction(async (client: any) => {
      await client.query(
        `UPDATE payments SET status = 'refunded', refund_amount = $2, refund_reason = 'Slot hold expired before payment confirmation',
                refund_destination = $3, gateway_payment_id = COALESCE(gateway_payment_id, $4), updated_at = NOW()
         WHERE id = $1`, [o.payment_id, amount, destination, gatewayPaymentId]);
      await client.query(
        `UPDATE grooming_orders SET refund_amount = $2, refund_status = 'full', refund_destination = $3,
                refund_reason = 'Slot hold expired before payment confirmation', refunded_at = NOW(), updated_at = NOW()
         WHERE id = $1`, [orderId, amount, destination]);
      if (destination === 'wallet') {
        const wRes = await client.query(`SELECT id FROM wallets WHERE user_id = $1 FOR UPDATE`, [o.pet_owner_id]);
        let walletId = wRes.rows[0]?.id;
        if (!walletId) {
          await client.query(
            `INSERT INTO wallets (id, user_id, balance, bonus_credits, currency, created_at, updated_at)
             VALUES ($1,$2,0,0,$3,NOW(),NOW()) ON CONFLICT (user_id) DO NOTHING`,
            [uuidv4(), o.pet_owner_id, o.currency || 'INR']);
          const again = await client.query(`SELECT id FROM wallets WHERE user_id = $1`, [o.pet_owner_id]);
          walletId = again.rows[0].id;
        }
        await client.query(`UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2`, [amount, walletId]);
        await client.query(
          `INSERT INTO wallet_transactions (id, wallet_id, type, amount, description, reference_id, reference_type, created_at)
           VALUES ($1,$2,'refund',$3,'Grooming slot hold expired — payment returned',$4,'grooming_order',NOW())`,
          [uuidv4(), walletId, amount, orderId]);
      }
      const creditNote = await this.issueCreditNote(client,
        { ...o, paymentId: o.payment_id, paymentAmount: amount }, amount, 'Slot hold expired before payment confirmation');
      await client.query(
        `INSERT INTO grooming_order_status_history (order_id, from_status, to_status, changed_by, note)
         VALUES ($1,'payment_expired','payment_expired',NULL,$2)`,
        [orderId, `Late capture refunded in full to ${destination}${creditNote ? ` — credit note ${creditNote}` : ''}`]);
    });

    try {
      await NotificationService.createNotification(
        o.pet_owner_id, 'payment', 'Grooming Payment Refunded',
        `Your booking slot had already expired when the payment completed, so the full amount has been returned to your ${destination === 'gateway' ? 'original payment method' : 'wallet'}. Please book again.`,
        'all', { orderId, refundAmount: amount });
    } catch { /* non-blocking */ }
    logger.warn('Grooming late capture refunded — slot hold had expired', { orderId, amount, destination });
  }
}

export default new GroomingRefundService();
